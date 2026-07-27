import type {
  AccommodationSuggestion,
  AccommodationFallbackNotice,
  BudgetLevel,
  Coordinates,
  DailyForecast,
  Destination,
  ItinerarySegment,
  Recommendation,
  RouteMetrics,
  ScoreBreakdown,
  TripRequest,
  WeatherConstraintKey
} from "./types.js";
import { accommodationSuggestions } from "./accommodations.js";

const budgetFit: Record<BudgetLevel, Record<BudgetLevel, number>> = {
  lean: { lean: 100, balanced: 78, comfort: 52 },
  balanced: { lean: 86, balanced: 100, comfort: 82 },
  comfort: { lean: 64, balanced: 88, comfort: 100 }
};

type WeatherCriterion = {
  key: WeatherConstraintKey;
  score: number;
  weight: number;
};

type AccommodationSelection = {
  preferred: AccommodationSuggestion[];
  alternatives: AccommodationSuggestion[];
  notice?: AccommodationFallbackNotice | undefined;
};

export function scoreDestination(
  destination: Destination,
  request: TripRequest,
  forecast: DailyForecast[],
  routeMetrics?: RouteMetrics,
  liveAccommodationSuggestions: AccommodationSuggestion[] = []
): Recommendation {
  const weather = Math.round(scoreWeather(request, forecast));
  const travelHours = routeMetrics?.durationHours ?? estimateTravelHours(destination, request);
  const metrics = routeMetrics ?? estimateRouteMetrics(destination, travelHours);
  const travel = Math.round(scoreTravel(request, travelHours));
  const accommodation = Math.round(scoreAccommodation(destination, request));
  const budget = Math.round(budgetFit[request.budget ?? "balanced"][destination.budgetLevel]);
  const preference = scorePreference(destination, request);
  const score = Math.round(clamp(weather * 0.46 + travel * 0.18 + accommodation * 0.18 + budget * 0.08 + preference * 0.1));
  const scoreBreakdown: ScoreBreakdown = {
    weather,
    travel,
    accommodation,
    budget,
    confidence: confidenceForForecast(forecast)
  };
  const staySelection = selectAccommodationSuggestions(request, metrics, liveAccommodationSuggestions);

  return {
    destination,
    score,
    scoreBreakdown,
    why: buildWhy(destination, request, scoreBreakdown),
    travelHours,
    routeMetrics: metrics,
    travelPlan: buildTravelPlan(destination, request, metrics, forecast),
    itinerary: buildDetailedItinerary(destination, request, metrics, forecast, staySelection.preferred),
    accommodationSuggestions: staySelection.preferred,
    alternativeAccommodationSuggestions: staySelection.alternatives.length ? staySelection.alternatives : undefined,
    accommodationFallbackNotice: staySelection.notice,
    packingHints: buildPackingHints(forecast),
    forecast,
    routeStops: buildRouteStops(destination, request)
  };
}

export function buildPlanSummary(request: TripRequest, top?: Recommendation): string {
  const accommodationText = request.accommodations.length
    ? request.accommodations.join(", ")
    : "any stay";
  const destinationText = top
    ? `${top.destination.name} leads with a ${top.score}/100 weather fit`
    : "No destination is available yet";

  return `${request.durationDays} days from ${request.startLocation.label}, ${request.maxHoursPerDay} h / day by ${request.travelMode}, ${accommodationText}. ${destinationText}.`;
}

function scoreWeather(request: TripRequest, forecast: DailyForecast[]): number {
  if (!forecast.length) return 0;
  const ignored = new Set(request.ignoredWeather ?? []);

  const dailyScores = forecast.map((day) => {
    const averageTemp = (day.tempMinC + day.tempMaxC) / 2;
    const criteria: WeatherCriterion[] = [
      {
        key: "tempMinC",
        score: clamp(100 - Math.max(0, request.weather.tempMinC - averageTemp) * 6),
        weight: 0.2
      },
      {
        key: "tempMaxC",
        score: clamp(100 - Math.max(0, averageTemp - request.weather.tempMaxC) * 6),
        weight: 0.2
      },
      {
        key: "maxPrecipitationMm",
        score: clamp(100 - (day.precipitationMm / Math.max(0.5, request.weather.maxPrecipitationMm)) * 38),
        weight: 0.25
      },
      {
        key: "minSunshineHours",
        score: clamp((day.sunshineHours / Math.max(1, request.weather.minSunshineHours)) * 100),
        weight: 0.25
      },
      {
        key: "maxWindKph",
        score: clamp(100 - Math.max(0, day.windKph - request.weather.maxWindKph) * 3.2),
        weight: 0.1
      }
    ];
    const activeCriteria = criteria.filter((criterion) => !ignored.has(criterion.key));

    if (!activeCriteria.length) return 100;
    const totalWeight = activeCriteria.reduce((sum, criterion) => sum + criterion.weight, 0);
    return activeCriteria.reduce((sum, criterion) => sum + criterion.score * criterion.weight, 0) / totalWeight;
  });

  return average(dailyScores);
}

function scoreTravel(request: TripRequest, estimatedHours: number): number {
  const availableHours = request.maxHoursPerDay * Math.max(1, Math.ceil(request.durationDays / 2));

  if (estimatedHours <= request.maxHoursPerDay) return 100;
  if (estimatedHours <= availableHours) return 82;
  return clamp(76 - (estimatedHours - availableHours) * 3);
}

function estimateTravelHours(destination: Destination, request: TripRequest): number {
  const modeFactor = request.travelMode === "car" ? 1 : request.travelMode === "train" ? 1.15 : 0.65;
  return Math.round(destination.baselineTravelHoursFromStockholm * modeFactor * 10) / 10;
}

function estimateRouteMetrics(destination: Destination, travelHours: number): RouteMetrics {
  return {
    distanceKm: Math.round(destination.baselineTravelHoursFromStockholm * 78),
    durationHours: travelHours,
    source: "estimate",
    routePath: [
      { latitude: 59.3293, longitude: 18.0686 },
      destination.coordinates
    ]
  };
}

function scoreAccommodation(destination: Destination, request: TripRequest): number {
  if (!request.accommodations.length) return 100;
  const matches = request.accommodations.filter((tag) => destination.tags.includes(tag)).length;
  return clamp(45 + (matches / request.accommodations.length) * 55);
}

function scorePreference(destination: Destination, request: TripRequest): number {
  if (request.destinationPreference?.destinationId) {
    return destination.id === request.destinationPreference.destinationId ? 100 : 62;
  }

  if (request.destinationPreference?.direction) {
    return destination.directionFromStockholm === request.destinationPreference.direction ? 100 : 70;
  }

  return 82;
}

function buildWhy(destination: Destination, request: TripRequest, score: ScoreBreakdown): string {
  const bestHighlight = destination.highlights[0] ?? "reliable trip options";
  const preferencePhrase = request.destinationPreference?.destinationId === destination.id
    ? "it matches your selected destination"
    : request.destinationPreference?.direction === destination.directionFromStockholm
      ? `it keeps the route loosely ${destination.directionFromStockholm}`
      : "it stays flexible around your weather target";
  const weatherPhrase =
    score.weather >= 82
      ? "forecast is close to your ideal weather"
      : score.weather >= 65
        ? "forecast is workable with a few tradeoffs"
        : "forecast needs a little flexibility";
  const travelPhrase =
    score.travel >= 82 ? "travel time fits the plan" : "travel time is the main compromise";

  return `${destination.name} ranks well because ${preferencePhrase}, the ${weatherPhrase}, ${travelPhrase}, and it is strong for ${bestHighlight}.`;
}

function buildPackingHints(forecast: DailyForecast[]): string[] {
  const hints = new Set<string>();

  if (forecast.some((day) => day.precipitationMm > 3)) hints.add("Pack a light rain shell.");
  if (forecast.some((day) => day.windKph > 30)) hints.add("Bring a wind layer for exposed stops.");
  if (forecast.some((day) => day.tempMinC < 12)) hints.add("Add one warm evening layer.");
  if (forecast.every((day) => day.sunshineHours >= 6)) hints.add("Sunscreen and sunglasses should earn their space.");

  if (!hints.size) hints.add("A simple daypack should cover this forecast.");
  return Array.from(hints);
}

function buildTravelPlan(
  destination: Destination,
  request: TripRequest,
  routeMetrics: RouteMetrics,
  forecast: DailyForecast[]
) {
  const bestDay = [...forecast].sort((a, b) => {
    const aComfort = a.sunshineHours * 2 - a.precipitationMm * 3 - Math.max(0, a.windKph - request.weather.maxWindKph);
    const bComfort = b.sunshineHours * 2 - b.precipitationMm * 3 - Math.max(0, b.windKph - request.weather.maxWindKph);
    return bComfort - aComfort;
  })[0];

  return [
    {
      title: `Depart from ${request.startLocation.label}`,
      detail: `${routeMetrics.durationHours} h ${routeMetrics.source === "openrouteservice" ? "routed" : "estimated"} ${request.travelMode} travel toward ${destination.name}.`,
      durationHours: routeMetrics.durationHours
    },
    {
      title: "Check in near the route window",
      detail: `Use stays around ${lowerBand(request.maxHoursPerDay)}-${upperBand(request.maxHoursPerDay)} h from the start when possible.`
    },
    {
      title: "Best weather window",
      detail: bestDay
        ? `${bestDay.date}: ${bestDay.tempMinC}-${bestDay.tempMaxC} °C, ${bestDay.sunshineHours} h sun, ${bestDay.precipitationMm} mm rain.`
        : "Weather window will appear when forecast data is available."
    },
    {
      title: "Return buffer",
      detail: `Keep day ${request.durationDays} lighter so the return does not exceed ${request.maxHoursPerDay} h / day.`
    }
  ];
}

function buildRouteStops(destination: Destination, request: TripRequest) {
  if (destination.id === "gotland") {
    return [
      {
        destinationId: "nynashamn-ferry-terminal",
        destinationName: "Nynashamn ferry terminal",
        nights: 0,
        order: 1
      },
      {
        destinationId: "visby-ferry-terminal",
        destinationName: "Visby ferry terminal",
        nights: 0,
        order: 2
      },
      {
        destinationId: destination.id,
        destinationName: destination.name,
        nights: Math.max(1, request.durationDays - 2),
        order: 3
      }
    ];
  }

  return [
    {
      destinationId: destination.id,
      destinationName: destination.name,
      nights: Math.max(1, request.durationDays - 1),
      order: 1
    }
  ];
}

function buildDetailedItinerary(
  destination: Destination,
  request: TripRequest,
  routeMetrics: RouteMetrics,
  forecast: DailyForecast[],
  accommodationSuggestionsForRoute: AccommodationSuggestion[] = []
): ItinerarySegment[] {
  if (destination.id === "gotland") {
    return buildGotlandFerryItinerary(destination, request, routeMetrics, forecast);
  }

  const childBreakHours = request.travelers.children > 0 ? 1.5 : 2.25;
  const evBreakHours = request.travelers.hasEv ? 2.2 : Number.POSITIVE_INFINITY;
  const breakEveryHours = Math.min(childBreakHours, evBreakHours, Math.max(2, request.maxHoursPerDay - 1));
  const arrivalPoint = routeMetrics.routePath.at(-1) ?? destination.coordinates;
  const firstStop = routeMetrics.durationHours >= lowerBand(request.maxHoursPerDay)
    ? accommodationSuggestionsForRoute[0] ?? selectAccommodationSuggestions(request, routeMetrics).preferred[0]
    : undefined;
  const startPoint = routeMetrics.routePath[0] ?? { latitude: 59.3293, longitude: 18.0686 };
  const comfortReason = [
    request.travelers.children > 0 ? "kid-friendly toilet and snack break" : "driver reset",
    request.travelers.hasEv ? "EV charging window" : ""
  ].filter(Boolean).join(" plus ");

  const itinerary: ItinerarySegment[] = [];
  let cumulativeHours = 0;
  let currentName = request.startLocation.label;
  let currentCoordinates = startPoint;
  const maxTravelSegments = Math.max(1, Math.ceil(routeMetrics.durationHours / request.maxHoursPerDay));

  for (let index = 0; index < maxTravelSegments && cumulativeHours < routeMetrics.durationHours - 0.05; index += 1) {
    const remainingBeforeLeg = routeMetrics.durationHours - cumulativeHours;
    const preferredFirstStopHours = index === 0 ? firstStop?.travelHoursFromStart : undefined;
    const legHours = Math.min(remainingBeforeLeg, preferredFirstStopHours ?? request.maxHoursPerDay);
    const nextCumulativeHours = cumulativeHours + legHours;
    const arrives = nextCumulativeHours >= routeMetrics.durationHours - 0.15;
    const stopCoordinates = arrives
      ? arrivalPoint
      : index === 0 && firstStop?.coordinates
        ? firstStop.coordinates
        : pointAlongRoute(routeMetrics.routePath, Math.min(0.96, nextCumulativeHours / Math.max(0.1, routeMetrics.durationHours)));
    const stopName = arrives
      ? destination.name
      : index === 0 && firstStop
        ? firstStop.name
        : `Route stop ${index + 1} toward ${destination.name}`;
    const distanceKm = estimateRouteLegDistanceKm(routeMetrics, currentCoordinates, stopCoordinates);
    const remainingAfterLeg = Math.max(0, routeMetrics.durationHours - nextCumulativeHours);

    itinerary.push({
      day: index + 1,
      title: index === 0
        ? `Drive ${destination.directionFromStockholm} from ${request.startLocation.label}`
        : `Continue toward ${destination.name}`,
      timing: index === 0
        ? `Leave 09:00, first comfort stop after about ${formatDurationText(breakEveryHours)}.`
        : `Leave 09:30 after breakfast; plan about ${formatDurationText(legHours)} of travel.`,
      direction: `${currentName} - ${stopName}, est ${formatDurationText(legHours)} and about ${distanceKm} km.`,
      startName: currentName,
      startCoordinates: currentCoordinates,
      startTravelHoursFromStart: cumulativeHours,
      endTravelHoursFromStart: nextCumulativeHours,
      distanceKm,
      travelHours: legHours,
      stopName,
      stopCoordinates,
      stopReason: index === 0 && firstStop
        ? buildStayStopReason(firstStop, request)
        : arrives
          ? comfortReason || "Arrival stop within the daily travel budget."
          : `Stop before exceeding the ${request.maxHoursPerDay} h daily travel limit.`,
      continueAfter: remainingAfterLeg > 0.15
        ? `Continue from ${stopName} to ${destination.name} with about ${formatDurationText(remainingAfterLeg)} still to go.`
        : `Stay ${Math.min(request.maxStayDays, Math.max(request.minStayDays, request.durationDays - itinerary.length - 1))} days before the return leg.`,
      activities: buildActivities(destination, forecast[index] ?? forecast[0], request)
    });

    cumulativeHours = arrives ? routeMetrics.durationHours : nextCumulativeHours;
    currentName = stopName;
    currentCoordinates = stopCoordinates;
  }

  itinerary.push({
    day: Math.max(2, itinerary.length + 1),
    title: `Weather-fit day in ${destination.name}`,
    timing: "Keep the main activity between 10:00 and 16:00 for best daylight.",
    direction: "Local day with no long transfer.",
    startName: destination.name,
    startCoordinates: arrivalPoint,
    startTravelHoursFromStart: routeMetrics.durationHours,
    endTravelHoursFromStart: routeMetrics.durationHours,
    travelHours: 0,
    stopName: destination.name,
    stopCoordinates: arrivalPoint,
    stopReason: "Use the best forecast window instead of moving again.",
    continueAfter: `Return with the same ${request.maxHoursPerDay} h / day cap, adding breaks every ${round(breakEveryHours)} h.`,
    activities: buildActivities(destination, forecast[2] ?? forecast[0], request)
  });

  return itinerary;
}

function buildGotlandFerryItinerary(
  destination: Destination,
  request: TripRequest,
  routeMetrics: RouteMetrics,
  forecast: DailyForecast[]
): ItinerarySegment[] {
  const nynashamnTerminal = { latitude: 58.9031, longitude: 17.9466 };
  const visbyTerminal = { latitude: 57.6348, longitude: 18.2867 };
  const childBreakHours = request.travelers.children > 0 ? 1.5 : 2.25;
  const evNote = request.travelers.hasEv ? " Add an EV top-up before boarding if range is tight." : "";
  const travelerNote = request.travelers.children > 0
    ? " Build in toilet, snack, and stretch time before boarding."
    : " Keep a calm boarding buffer before the sailing.";
  const startPoint = routeMetrics.routePath[0] ?? request.startLocation.coordinates ?? { latitude: 59.3293, longitude: 18.0686 };
  const ferryHours = 3.2;
  const driveToTerminalHours = Math.min(1.2, Math.max(0.8, routeMetrics.durationHours - ferryHours));
  const arrivalDriveHours = Math.max(0.2, Math.min(0.5, routeMetrics.durationHours - ferryHours - driveToTerminalHours));

  return [
    {
      day: 1,
      title: "Drive to Nynashamn ferry terminal",
      timing: "Leave 08:30 and aim to arrive well before ferry check-in.",
      direction: `Head south from ${request.startLocation.label} toward Nynashamn.`,
      startName: request.startLocation.label,
      startCoordinates: startPoint,
      startTravelHoursFromStart: 0,
      endTravelHoursFromStart: round(driveToTerminalHours),
      distanceKm: estimateRouteLegDistanceKm(routeMetrics, startPoint, nynashamnTerminal),
      travelHours: round(driveToTerminalHours),
      stopName: "Nynashamn ferry terminal",
      stopCoordinates: nynashamnTerminal,
      stopReason: `Mandatory ferry connection for Gotland trips.${travelerNote}${evNote}`,
      continueAfter: "Board the Gotland ferry and keep the car leg light after arrival.",
      activities: [
        "Terminal toilet and snack break",
        request.travelers.hasEv ? "EV top-up before boarding" : "Short harbor walk",
        "Confirm ferry tickets and boarding lane"
      ]
    },
    {
      day: 1,
      title: "Ferry crossing to Visby",
      timing: "Choose a sailing that reaches Visby before evening check-in.",
      direction: "Cross the Baltic Sea toward Visby.",
      startName: "Nynashamn ferry terminal",
      startCoordinates: nynashamnTerminal,
      startTravelHoursFromStart: round(driveToTerminalHours),
      endTravelHoursFromStart: round(driveToTerminalHours + ferryHours),
      distanceKm: Math.round(haversineKm(nynashamnTerminal, visbyTerminal)),
      travelHours: ferryHours,
      stopName: "Visby ferry terminal",
      stopCoordinates: visbyTerminal,
      stopReason: "This sea crossing is the key route leg, so it is treated as a planned stop rather than hidden travel time.",
      continueAfter: `Drive the last ${round(arrivalDriveHours)} h to your stay and keep dinner local.`,
      activities: [
        "Sea views from deck",
        "On-board meal or coffee",
        "Stretch break before the Visby arrival drive"
      ]
    },
    {
      day: Math.min(request.durationDays, 2),
      title: `Weather-fit day in ${destination.name}`,
      timing: "Keep the main activity between 10:00 and 16:00 for best daylight.",
      direction: "Stay local around Visby and the limestone coast.",
      startName: destination.name,
      startCoordinates: destination.coordinates,
      startTravelHoursFromStart: routeMetrics.durationHours,
      endTravelHoursFromStart: routeMetrics.durationHours,
      travelHours: 0,
      stopName: destination.name,
      stopCoordinates: destination.coordinates,
      stopReason: "Use the best forecast window on the island instead of adding another transfer.",
      continueAfter: `Return via the ferry with the same ${request.maxHoursPerDay} h / day cap, adding breaks every ${round(childBreakHours)} h.`,
      activities: buildActivities(destination, forecast[1] ?? forecast[0], request)
    }
  ];
}

function pointAlongRoute(path: Coordinates[], fraction: number): Coordinates {
  if (!path.length) return { latitude: 59.3293, longitude: 18.0686 };
  const firstPoint = path[0] ?? { latitude: 59.3293, longitude: 18.0686 };
  if (path.length === 1) return firstPoint;
  const bounded = Math.min(1, Math.max(0, fraction));
  const index = Math.min(path.length - 1, Math.max(0, Math.round((path.length - 1) * bounded)));
  return path[index] ?? path[path.length - 1] ?? firstPoint;
}

function buildActivities(
  destination: Destination,
  forecast: DailyForecast | undefined,
  request: TripRequest
): string[] {
  const activities = new Set<string>();
  destination.highlights.slice(0, 2).forEach((highlight) => activities.add(capitalize(highlight)));

  if (forecast) {
    if (forecast.precipitationMm <= request.weather.maxPrecipitationMm || request.ignoredWeather?.includes("maxPrecipitationMm")) {
      activities.add("Outdoor lunch or picnic stop");
    } else {
      activities.add("Museum, sauna, or covered market backup");
    }

    if (forecast.sunshineHours >= request.weather.minSunshineHours || request.ignoredWeather?.includes("minSunshineHours")) {
      activities.add("Golden-hour walk before dinner");
    }
  }

  if (request.travelers.children > 0) activities.add("Playground or swim stop with toilets nearby");
  if (request.travelers.hasEv) activities.add("Charging stop paired with coffee or groceries");

  return Array.from(activities).slice(0, 4);
}

function selectAccommodationSuggestions(
  request: TripRequest,
  routeMetrics: RouteMetrics,
  liveSuggestions: AccommodationSuggestion[] = []
): AccommodationSelection {
  const lower = lowerBand(request.maxHoursPerDay);
  const upper = upperBand(request.maxHoursPerDay);
  const selectedTypes = request.accommodations;
  const candidates = liveSuggestions.length ? liveSuggestions : accommodationSuggestions;
  const routeCandidates = candidates
    .filter((suggestion) => {
      const timeFits = suggestion.travelHoursFromStart >= lower && suggestion.travelHoursFromStart <= upper;
      const routeFits = suggestion.travelHoursFromStart <= routeMetrics.durationHours + 0.5;
      const corridorFits = !suggestion.coordinates || distanceToRouteKm(suggestion.coordinates, routeMetrics.routePath) <= 85;
      return timeFits && routeFits && corridorFits;
    })
    .sort((a, b) => Math.abs(a.travelHoursFromStart - request.maxHoursPerDay) - Math.abs(b.travelHoursFromStart - request.maxHoursPerDay));

  const preferred = routeCandidates
    .filter((suggestion) => selectedTypes.length === 0 || selectedTypes.includes(suggestion.type))
    .slice(0, 4);
  const alternatives = routeCandidates
    .filter((suggestion) => selectedTypes.length > 0 && !selectedTypes.includes(suggestion.type))
    .slice(0, 4);
  const notice = !preferred.length && alternatives.length
    ? {
        message: `No preferred accommodations are available in this route window. ${formatAccommodationTypes(alternatives)} are nearby if you want to view them.`,
        availableTypes: uniqueAccommodationTypes(alternatives)
      }
    : undefined;

  return { preferred, alternatives, notice };
}

function buildStayStopReason(stay: AccommodationSuggestion, request: TripRequest): string {
  const source = stay.source ? ` Data: ${stay.source}.` : "";
  return `Within the ${lowerBand(request.maxHoursPerDay)}-${upperBand(request.maxHoursPerDay)} h travel window.${source}`;
}

function formatDurationText(hours: number): string {
  const totalMinutes = Math.max(0, Math.round(hours * 60));
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!wholeHours) return `${minutes} min`;
  if (!minutes) return `${wholeHours} h`;
  return `${wholeHours} h ${minutes} min`;
}

function estimateRouteLegDistanceKm(routeMetrics: RouteMetrics, start: Coordinates, end: Coordinates): number {
  const path = routeMetrics.routePath;
  if (path.length < 2) return Math.round(haversineKm(start, end));

  const startIndex = nearestRouteIndex(start, path);
  const endIndex = nearestRouteIndex(end, path);
  const from = Math.min(startIndex, endIndex);
  const to = Math.max(startIndex, endIndex);
  const routeDistanceKm = routePathDistanceKm(path);
  const rawLegDistance = path.slice(from, to + 1).reduce((sum, point, index, legPath) => {
    const previous = legPath[index - 1];
    return previous ? sum + haversineKm(previous, point) : sum;
  }, 0);

  if (!routeDistanceKm) return Math.round(haversineKm(start, end));
  const scale = routeMetrics.distanceKm / routeDistanceKm;
  return Math.max(1, Math.round((rawLegDistance + haversineKm(start, path[startIndex]!) + haversineKm(end, path[endIndex]!)) * scale));
}

function nearestRouteIndex(point: Coordinates, path: Coordinates[]): number {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  path.forEach((routePoint, index) => {
    const distance = haversineKm(point, routePoint);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function routePathDistanceKm(path: Coordinates[]): number {
  return path.reduce((sum, point, index) => {
    const previous = path[index - 1];
    return previous ? sum + haversineKm(previous, point) : sum;
  }, 0);
}

function distanceToRouteKm(point: Coordinates, path: Coordinates[]): number {
  if (!path.length) return Number.POSITIVE_INFINITY;
  return Math.min(...path.map((routePoint) => haversineKm(point, routePoint)));
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

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function uniqueAccommodationTypes(suggestions: AccommodationSuggestion[]) {
  return Array.from(new Set(suggestions.map((suggestion) => suggestion.type)));
}

function formatAccommodationTypes(suggestions: AccommodationSuggestion[]): string {
  const types = uniqueAccommodationTypes(suggestions);
  if (types.length === 1) return `${types[0]}s`;
  return `${types.slice(0, -1).join(", ")} or ${types.at(-1)}`;
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

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function confidenceForForecast(forecast: DailyForecast[]): ScoreBreakdown["confidence"] {
  if (forecast.length >= 7) return "high";
  if (forecast.length >= 3) return "medium";
  return "low";
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function clamp(value: number): number {
  return Math.min(100, Math.max(0, value));
}
