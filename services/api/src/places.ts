import type {
  AccommodationSuggestion,
  AccommodationTag,
  Coordinates,
  Destination,
  RouteMetrics,
  TripRequest
} from "@weathertrip/shared";

type OverpassElement = {
  id: number;
  type: "node" | "way" | "relation";
  lat?: number;
  lon?: number;
  center?: {
    lat?: number;
    lon?: number;
  };
  tags?: Record<string, string>;
};

type OverpassResponse = {
  elements?: OverpassElement[];
};

type NominatimPlace = {
  display_name?: string;
  name?: string;
  lat?: string;
  lon?: string;
  osm_id?: number;
  osm_type?: "node" | "way" | "relation";
  type?: string;
};

type GooglePlace = {
  id?: string;
  displayName?: {
    text?: string;
  };
  formattedAddress?: string;
  location?: Coordinates;
  types?: string[];
  primaryType?: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  googleMapsUri?: string;
};

type GooglePlacesResponse = {
  places?: GooglePlace[];
};

const placeCache = new Map<string, AccommodationSuggestion[]>();
const googlePlacesEndpoint = "https://places.googleapis.com/v1/places:searchNearby";
const overpassEndpoint = "https://overpass-api.de/api/interpreter";
const nominatimEndpoint = "https://nominatim.openstreetmap.org/search";
const fallbackSpeedKph = 76;
const googleLodgingTypes = [
  "bed_and_breakfast",
  "campground",
  "camping_cabin",
  "cottage",
  "extended_stay_hotel",
  "farmstay",
  "guest_house",
  "hostel",
  "hotel",
  "inn",
  "lodging",
  "mobile_home_park",
  "motel",
  "private_guest_room",
  "resort_hotel",
  "rv_park"
];

export async function getAccommodationSuggestions(
  destination: Destination,
  request: TripRequest,
  routeMetrics: RouteMetrics
): Promise<AccommodationSuggestion[]> {
  if (!routeMetrics.routePath.length) return [];

  const lower = lowerBand(request.maxHoursPerDay);
  const upper = upperBand(request.maxHoursPerDay);
  const searchPoint = getSearchPoint(routeMetrics, request.maxHoursPerDay);
  const cacheKey = [
    destination.id,
    request.accommodations.join(","),
    round(searchPoint.latitude),
    round(searchPoint.longitude),
    lower,
    upper
  ].join(":");

  const cached = placeCache.get(cacheKey);
  if (cached) return cached;

  const googleSuggestions = await getGooglePlacesAccommodationSuggestions(request, routeMetrics, searchPoint);
  if (googleSuggestions.length) {
    placeCache.set(cacheKey, googleSuggestions);
    return googleSuggestions;
  }

  try {
    const response = await fetch(overpassEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "User-Agent": "Weathertrip MVP local development"
      },
      body: new URLSearchParams({
        data: buildOverpassQuery(searchPoint)
      }),
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) return [];

    const body = (await response.json()) as OverpassResponse;
    const overpassSuggestions = mapAccommodationElements(body.elements ?? [], request, routeMetrics)
      .filter((suggestion) => {
        const timeFits = suggestion.travelHoursFromStart >= lower && suggestion.travelHoursFromStart <= upper;
        const typeFits = request.accommodations.length === 0 || request.accommodations.includes(suggestion.type);
        return timeFits && typeFits;
      })
      .sort((a, b) => {
        const targetHours = request.maxHoursPerDay;
        return Math.abs(a.travelHoursFromStart - targetHours) - Math.abs(b.travelHoursFromStart - targetHours);
      })
      .slice(0, 4);

    const suggestions = overpassSuggestions.length
      ? overpassSuggestions
      : await getNominatimAccommodationSuggestions(request, routeMetrics, searchPoint);

    placeCache.set(cacheKey, suggestions);
    return suggestions;
  } catch {
    const suggestions = await getNominatimAccommodationSuggestions(request, routeMetrics, searchPoint);
    placeCache.set(cacheKey, suggestions);
    return suggestions;
  }
}

async function getGooglePlacesAccommodationSuggestions(
  request: TripRequest,
  routeMetrics: RouteMetrics,
  searchPoint: Coordinates
): Promise<AccommodationSuggestion[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return [];

  try {
    const response = await fetch(googlePlacesEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": [
          "places.id",
          "places.displayName",
          "places.formattedAddress",
          "places.location",
          "places.types",
          "places.primaryType",
          "places.rating",
          "places.userRatingCount",
          "places.priceLevel",
          "places.googleMapsUri"
        ].join(",")
      },
      body: JSON.stringify({
        includedTypes: googleLodgingTypes,
        maxResultCount: 20,
        rankPreference: "POPULARITY",
        locationRestriction: {
          circle: {
            center: searchPoint,
            radius: 50000
          }
        }
      }),
      signal: AbortSignal.timeout(12000)
    });

    if (!response.ok) return [];
    const body = (await response.json()) as GooglePlacesResponse;
    return mapGooglePlaces(body.places ?? [], request, routeMetrics);
  } catch {
    return [];
  }
}

function mapGooglePlaces(
  places: GooglePlace[],
  request: TripRequest,
  routeMetrics: RouteMetrics
): AccommodationSuggestion[] {
  const lower = lowerBand(request.maxHoursPerDay);
  const upper = upperBand(request.maxHoursPerDay);

  return places
    .map((place): AccommodationSuggestion | null => {
      const coordinates = place.location;
      const name = place.displayName?.text?.trim();
      const type = mapGooglePlaceType(place.types ?? [], place.primaryType);
      if (!place.id || !coordinates || !name || !type) return null;

      const travelHoursFromStart = estimateTravelHoursFromRoute(coordinates, routeMetrics);
      return {
        id: `google-${place.id}`,
        name,
        type,
        coordinates,
        travelHoursFromStart,
        priceLevel: mapGooglePriceLevel(place.priceLevel),
        reason: `Google Places result near the ${lower}-${upper} h route window.`,
        source: "Google Places",
        sourceUrl: place.googleMapsUri ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&query_place_id=${encodeURIComponent(place.id)}`,
        rating: place.rating,
        userRatingCount: place.userRatingCount
      };
    })
    .filter((suggestion): suggestion is AccommodationSuggestion => Boolean(suggestion))
    .filter((suggestion) => suggestion.travelHoursFromStart >= lower && suggestion.travelHoursFromStart <= upper)
    .sort((a, b) => {
      const aRating = (a.rating ?? 0) + Math.log10((a.userRatingCount ?? 0) + 1) * 0.25;
      const bRating = (b.rating ?? 0) + Math.log10((b.userRatingCount ?? 0) + 1) * 0.25;
      return bRating - aRating || Math.abs(a.travelHoursFromStart - request.maxHoursPerDay) - Math.abs(b.travelHoursFromStart - request.maxHoursPerDay);
    });
}

function mapGooglePlaceType(types: string[], primaryType?: string): AccommodationTag | null {
  const allTypes = new Set([primaryType, ...types].filter(Boolean));
  if (allTypes.has("hostel")) return "hostel";
  if (allTypes.has("rv_park") || allTypes.has("mobile_home_park")) return "trailer";
  if (allTypes.has("campground")) return "tent";
  if (allTypes.has("camping_cabin") || allTypes.has("cottage") || allTypes.has("farmstay")) return "cabin";
  if (allTypes.has("resort_hotel")) return "glamping";
  if (
    allTypes.has("hotel") ||
    allTypes.has("motel") ||
    allTypes.has("lodging") ||
    allTypes.has("inn") ||
    allTypes.has("guest_house") ||
    allTypes.has("bed_and_breakfast") ||
    allTypes.has("extended_stay_hotel") ||
    allTypes.has("private_guest_room")
  ) {
    return "hotel";
  }
  return null;
}

function mapGooglePriceLevel(priceLevel: string | undefined) {
  if (priceLevel === "PRICE_LEVEL_INEXPENSIVE" || priceLevel === "PRICE_LEVEL_FREE") return "lean";
  if (priceLevel === "PRICE_LEVEL_EXPENSIVE" || priceLevel === "PRICE_LEVEL_VERY_EXPENSIVE") return "comfort";
  return "balanced";
}

function buildOverpassQuery(center: Coordinates): string {
  const radiusMeters = 50000;
  const tourismValues = "hotel|hostel|guest_house|camp_site|caravan_site|chalet|apartment";

  return `
    [out:json][timeout:10];
    (
      node["tourism"~"^(${tourismValues})$"](around:${radiusMeters},${center.latitude},${center.longitude});
      way["tourism"~"^(${tourismValues})$"](around:${radiusMeters},${center.latitude},${center.longitude});
      relation["tourism"~"^(${tourismValues})$"](around:${radiusMeters},${center.latitude},${center.longitude});
    );
    out center tags 40;
  `;
}

function mapAccommodationElements(
  elements: OverpassElement[],
  request: TripRequest,
  routeMetrics: RouteMetrics
): AccommodationSuggestion[] {
  const seen = new Set<string>();

  return elements.flatMap((element): AccommodationSuggestion[] => {
    const tags = element.tags ?? {};
    const coordinates = getElementCoordinates(element);
    const name = tags.name?.trim();
    const accommodationType = mapTourismType(tags.tourism);

    if (!coordinates || !name || !accommodationType) return [];

    const key = `${name.toLowerCase()}:${round(coordinates.latitude)}:${round(coordinates.longitude)}`;
    if (seen.has(key)) return [];
    seen.add(key);

    const travelHoursFromStart = estimateTravelHoursFromRoute(coordinates, routeMetrics);
    return [
      {
        id: `osm-${element.type}-${element.id}`,
        name,
        type: accommodationType,
        coordinates,
        travelHoursFromStart,
        priceLevel: inferPriceLevel(tags),
        reason: `OpenStreetMap place near the ${lowerBand(request.maxHoursPerDay)}-${upperBand(request.maxHoursPerDay)} h route window.`,
        source: "OpenStreetMap",
        sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`
      }
    ];
  });
}

async function getNominatimAccommodationSuggestions(
  request: TripRequest,
  routeMetrics: RouteMetrics,
  searchPoint: Coordinates
): Promise<AccommodationSuggestion[]> {
  const lower = lowerBand(request.maxHoursPerDay);
  const upper = upperBand(request.maxHoursPerDay);
  const queryTypes = getNominatimQueryTypes();
  const viewbox = getViewbox(searchPoint, 0.45);

  try {
    const placeGroups = await Promise.all(
      queryTypes.map(async (queryType) => {
        const url = new URL(nominatimEndpoint);
        url.searchParams.set("format", "jsonv2");
        url.searchParams.set("q", queryType.query);
        url.searchParams.set("limit", "8");
        url.searchParams.set("bounded", "1");
        url.searchParams.set("viewbox", viewbox);

        const response = await fetch(url, {
          headers: {
            "User-Agent": "Weathertrip MVP local development"
          },
          signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) return [];
        const places = (await response.json()) as NominatimPlace[];
        return places.map((place) => ({ place, queryType }));
      })
    );

    const seen = new Set<string>();
    return placeGroups.flat()
      .map((place): AccommodationSuggestion | null => {
        const latitude = Number(place.place.lat);
        const longitude = Number(place.place.lon);
        const name = place.place.name?.trim() || place.place.display_name?.split(",")[0]?.trim();
        if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude) || !place.place.osm_id || !place.place.osm_type) {
          return null;
        }

        const coordinates = { latitude, longitude };
        const travelHoursFromStart = estimateTravelHoursFromRoute(coordinates, routeMetrics);
        const key = `${place.place.osm_type}-${place.place.osm_id}`;
        if (seen.has(key)) return null;
        seen.add(key);
        return {
          id: `osm-${place.place.osm_type}-${place.place.osm_id}`,
          name,
          type: place.queryType.type,
          coordinates,
          travelHoursFromStart,
          priceLevel: inferPriceLevel({ name, tourism: place.queryType.query }),
          reason: `OpenStreetMap search result near the ${lower}-${upper} h route window.`,
          source: "OpenStreetMap Nominatim",
          sourceUrl: `https://www.openstreetmap.org/${place.place.osm_type}/${place.place.osm_id}`
        };
      })
      .filter((suggestion): suggestion is AccommodationSuggestion => Boolean(suggestion))
      .filter((suggestion) => suggestion.travelHoursFromStart >= lower && suggestion.travelHoursFromStart <= upper)
      .sort((a, b) => {
        const targetHours = request.maxHoursPerDay;
        return Math.abs(a.travelHoursFromStart - targetHours) - Math.abs(b.travelHoursFromStart - targetHours);
      })
      .slice(0, 4);
  } catch {
    return [];
  }
}

function getNominatimQueryTypes(): Array<{ query: string; type: AccommodationTag }> {
  return [
    { query: "hotel", type: "hotel" },
    { query: "hostel", type: "hostel" },
    { query: "camping", type: "tent" },
    { query: "rv park", type: "trailer" },
    { query: "cabin", type: "cabin" }
  ];
}

function getViewbox(center: Coordinates, delta: number): string {
  const west = center.longitude - delta;
  const east = center.longitude + delta;
  const north = center.latitude + delta;
  const south = center.latitude - delta;
  return `${west},${north},${east},${south}`;
}

function getElementCoordinates(element: OverpassElement): Coordinates | null {
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;
  if (typeof latitude !== "number" || typeof longitude !== "number") return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function mapTourismType(value: string | undefined): AccommodationTag | null {
  if (value === "hotel" || value === "guest_house" || value === "apartment") return "hotel";
  if (value === "hostel") return "hostel";
  if (value === "camp_site") return "tent";
  if (value === "caravan_site") return "trailer";
  if (value === "chalet") return "cabin";
  return null;
}

function inferPriceLevel(tags: Record<string, string>) {
  const name = `${tags.name ?? ""} ${tags.tourism ?? ""}`.toLowerCase();
  if (name.includes("hostel") || name.includes("camp")) return "lean";
  if (name.includes("spa") || name.includes("grand") || name.includes("resort")) return "comfort";
  return "balanced";
}

function estimateTravelHoursFromRoute(point: Coordinates, routeMetrics: RouteMetrics): number {
  if (routeMetrics.routePath.length < 2) return routeMetrics.durationHours;

  let bestIndex = 0;
  let bestDistanceKm = Number.POSITIVE_INFINITY;
  routeMetrics.routePath.forEach((routePoint, index) => {
    const distanceKm = haversineKm(point, routePoint);
    if (distanceKm < bestDistanceKm) {
      bestDistanceKm = distanceKm;
      bestIndex = index;
    }
  });

  const routeFraction = bestIndex / Math.max(1, routeMetrics.routePath.length - 1);
  const offRouteHours = Math.min(0.9, bestDistanceKm / fallbackSpeedKph);
  return round(routeMetrics.durationHours * routeFraction + offRouteHours);
}

function getSearchPoint(routeMetrics: RouteMetrics, maxHoursPerDay: number): Coordinates {
  const targetFraction = Math.min(0.95, Math.max(0.05, maxHoursPerDay / Math.max(0.1, routeMetrics.durationHours)));
  const index = Math.min(
    routeMetrics.routePath.length - 1,
    Math.max(0, Math.round((routeMetrics.routePath.length - 1) * targetFraction))
  );
  return routeMetrics.routePath[index] ?? routeMetrics.routePath[0]!;
}

function haversineKm(a: Coordinates, b: Coordinates): number {
  const earthRadiusKm = 6371;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
}

function lowerBand(hours: number): number {
  return Math.max(0, Math.round((hours - 0.5) * 10) / 10);
}

function upperBand(hours: number): number {
  return Math.round((hours + 0.5) * 10) / 10;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}
