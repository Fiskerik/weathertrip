import {
  planningDestinations,
  scoreForecast,
  summarizePlan,
  validateTripBrief,
  type ApiError,
  type Coordinates,
  type DailyForecast,
  type Destination,
  type PlanLeg,
  type PlanResponse,
  type PlanStop,
  type TripBrief,
  type TripPlan
} from "@weathertrip/shared";
import { getForecastBatch, getHourlyForecast } from "./forecast.js";
import { getRouteBetween, getRouteMatrix } from "./routing.js";

type Candidate = {
  destination: Destination;
  forecast: DailyForecast[];
  weatherScore: number;
};

export async function buildPlans(brief: TripBrief): Promise<PlanResponse | ApiError> {
  const validation = validateTripBrief(brief);
  if (validation) return validation;
  if (brief.borderRule === "leave-country" && !brief.startLocation.country) {
    return {
      error: "We need the country for your start location before planning an international route.",
      details: ["Choose your start location from the suggestions again."],
      code: "START_COUNTRY_REQUIRED"
    };
  }

  const filtered = planningDestinations.filter((destination) => {
    if (brief.endLocation && sameCoordinates(destination.coordinates, brief.endLocation.coordinates)) return false;
    if (brief.borderRule === "stay-country") return destination.country === brief.startLocation.country;
    if (brief.borderRule === "leave-country") return destination.country !== brief.startLocation.country;
    return true;
  });
  const reachable = filtered
    .filter((destination) => estimateHours(brief.startLocation.coordinates, destination.coordinates) <= brief.maxDriveHoursPerDay * brief.durationDays * 1.35)
    .sort((left, right) => estimateHours(brief.startLocation.coordinates, left.coordinates) - estimateHours(brief.startLocation.coordinates, right.coordinates))
    .slice(0, 36);

  if (reachable.length < 1) {
    return {
      error: "No destinations fit that travel window.",
      details: ["Try allowing more driving time, more days, or a wider country preference."],
      code: "NO_DESTINATIONS"
    };
  }

  let forecastMap: Map<string, DailyForecast[]>;
  try {
    forecastMap = await getForecastBatch(reachable, brief.dateRange, brief.durationDays);
  } catch {
    return {
      error: "The forecast service is temporarily unavailable.",
      details: ["Your brief is valid. Try again in a moment."],
      code: "FORECAST_UNAVAILABLE"
    };
  }

  const candidates = reachable
    .map((destination) => ({
      destination,
      forecast: forecastMap.get(destination.id) ?? [],
      weatherScore: scoreForecast(forecastMap.get(destination.id) ?? [], brief.weatherGoal)
    }))
    .filter((candidate) => candidate.forecast.length > 0)
    .sort((left, right) => right.weatherScore - left.weatherScore);

  if (!candidates.length) {
    return {
      error: "No destinations have forecast data for those dates.",
      details: ["Try dates within the next 16 days."],
      code: "NO_FORECAST_DATA"
    };
  }

  const routeEnd = brief.endLocation?.coordinates;
  const matrixCandidateLimit = routeEnd ? 23 : 24;
  const matrixPoints = [
    brief.startLocation.coordinates,
    ...candidates.slice(0, matrixCandidateLimit).map((candidate) => candidate.destination.coordinates),
    ...(routeEnd ? [routeEnd] : [])
  ];
  const matrix = await getRouteMatrix(matrixPoints);
  const endMatrixIndex = routeEnd ? matrixPoints.length - 1 : 0;
  const primary = await buildRoutePlan(brief, candidates, matrix, endMatrixIndex, 0, new Set(), forecastMap);
  if (!primary) return impossibleRouteError(brief);

  const alternatives: TripPlan[] = [];
  const usedAlternativeSeeds = new Set<string>(primary.stops[0] ? [primary.stops[0].destination.id] : []);
  const primarySignature = primary.stops.map((stop) => stop.destination.id).join("-");
  for (let index = 1; index <= Math.min(24, candidates.length) && alternatives.length < 2; index += 1) {
    const alternative = await buildRoutePlan(brief, candidates, matrix, endMatrixIndex, index, usedAlternativeSeeds, forecastMap);
    if (!alternative) continue;
    if (alternative.stops.map((stop) => stop.destination.id).join("-") === primarySignature) continue;
    alternatives.push(alternative);
    if (alternative.stops[0]) usedAlternativeSeeds.add(alternative.stops[0].destination.id);
  }

  return {
    generatedAt: new Date().toISOString(),
    primaryPlan: primary,
    alternatives
  };
}

async function buildRoutePlan(
  brief: TripBrief,
  candidates: Candidate[],
  matrix: number[][],
  endMatrixIndex: number,
  seed: number,
  banned: Set<string>,
  forecastMap: Map<string, DailyForecast[]>
): Promise<TripPlan | null> {
  const count = brief.placeCount === "smart"
    ? brief.durationDays >= 8 ? 3 : brief.durationDays >= 5 ? 2 : 1
    : brief.placeCount;
  const shortlist = candidates.filter((candidate) => !banned.has(candidate.destination.id));
  const stops = findFeasibleSequence(brief, shortlist, candidates, matrix, endMatrixIndex, count, seed);
  if (!stops) return null;

  const endLocation = brief.endLocation ?? brief.startLocation;
  const points = [brief.startLocation.coordinates, ...stops.map((stop) => stop.destination.coordinates), endLocation.coordinates];
  const directRoutes = await Promise.all(points.slice(0, -1).map((point, index) => getRouteBetween(point, points[index + 1]!)));
  const travelDays = directRoutes.reduce((sum, route) => sum + Math.max(1, Math.ceil(route.durationHours / brief.maxDriveHoursPerDay)), 0);
  const stayNights = brief.durationDays - travelDays;
  if (stayNights < stops.length) return null;

  const nights = distributeNights(stayNights, stops.length);
  const planLegs: PlanLeg[] = [];
  const planStops: PlanStop[] = [];
  let currentDay = 1;

  for (let index = 0; index < stops.length; index += 1) {
    const route = directRoutes[index]!;
    const destination = stops[index]!.destination;
    const segments = splitRoute(
      route.routePath,
      route.distanceKm,
      route.durationHours * 60,
      brief.maxDriveHoursPerDay * 60,
      currentDay,
      index === 0 ? brief.startLocation.label : stops[index - 1]!.destination.name,
      destination.name,
      brief,
      route.source
    );
    planLegs.push(...segments);
    const segmentDays = Math.max(1, Math.ceil(route.durationHours / brief.maxDriveHoursPerDay));
    const arrivalDate = dateAt(brief.dateRange.start, currentDay + segmentDays - 1);
    const departureDate = dateAt(brief.dateRange.start, currentDay + segmentDays + nights[index]! - 1);
    const forecast = selectForecast(forecastMap.get(destination.id) ?? [], arrivalDate, departureDate);
    planStops.push({
      id: `stop-${index + 1}-${destination.id}`,
      destination,
      arrivalDate,
      departureDate,
      nights: nights[index]!,
      sunshineHours: round(average(forecast.map((day) => day.sunshineHours))),
      forecast,
      why: `${destination.name} has ${weatherScoreText(stops[index]!.weatherScore)} and keeps this route within your driving comfort target.`,
      accommodationSuggestions: []
    });
    currentDay += segmentDays + nights[index]!;
  }

  const finalRoute = directRoutes[directRoutes.length - 1]!;
  planLegs.push(...splitRoute(
    finalRoute.routePath,
    finalRoute.distanceKm,
    finalRoute.durationHours * 60,
    brief.maxDriveHoursPerDay * 60,
    currentDay,
    stops[stops.length - 1]!.destination.name,
    endLocation.label,
    brief,
    finalRoute.source
  ));

  const totalDrivingMinutes = planLegs.reduce((sum, leg) => sum + leg.drivingMinutes, 0);
  const longestDrivingDayMinutes = Math.max(...groupDrivingByDay(planLegs).values());
  const countries = Array.from(new Set(planStops.map((stop) => stop.destination.country)));
  const weather = average(planStops.map((stop) => scoreForecast(stop.forecast, brief.weatherGoal)));
  const comfort = Math.max(0, 100 - Math.max(0, longestDrivingDayMinutes - brief.maxDriveHoursPerDay * 60) * 0.3);
  const diversity = countries.length / Math.max(1, planStops.length) * 100;
  const accommodation = average(planStops.map((stop) => stop.destination.tags.some((tag) => brief.accommodations.includes(tag)) ? 100 : 55));
  const score = Math.round(weather * 0.55 + comfort * 0.2 + diversity * 0.1 + accommodation * 0.1 + 85 * 0.05);
  const plan: TripPlan = {
    id: `plan-${seed}-${planStops.map((stop) => stop.destination.id).join("-")}`,
    title: `${planStops.map((stop) => stop.destination.name).join(" - ")} route`,
    score,
    confidence: planLegs.every((leg) => leg.source === "openrouteservice") ? "high" : "medium",
    summary: "",
    totalDistanceKm: Math.round(planLegs.reduce((sum, leg) => sum + leg.distanceKm, 0)),
    totalDrivingMinutes: Math.round(totalDrivingMinutes),
    longestDrivingDayMinutes: Math.round(longestDrivingDayMinutes),
    countries,
    stops: planStops,
    legs: planLegs,
    generatedAt: new Date().toISOString()
  };
  await Promise.all(plan.stops.map(async (stop) => {
    try {
      const hourly = await getHourlyForecast(stop.destination, { start: stop.arrivalDate, end: stop.departureDate });
      stop.hourlyForecast = hourly;
    } catch {
      stop.hourlyForecast = [];
    }
  }));
  plan.summary = summarizePlan(plan, brief);
  return plan;
}

function findFeasibleSequence(
  brief: TripBrief,
  shortlist: Candidate[],
  allCandidates: Candidate[],
  matrix: number[][],
  endMatrixIndex: number,
  count: number,
  seed: number
): Candidate[] | null {
  const ordered = [...shortlist].sort((left, right) => right.weatherScore - left.weatherScore);
  const rotation = ordered.length ? seed % ordered.length : 0;
  const rotated = [...ordered.slice(rotation), ...ordered.slice(0, rotation)].slice(0, 30);
  const requiredFirstId = seed > 0 ? rotated[0]?.destination.id : undefined;
  const matrixCandidateLimit = endMatrixIndex === 0 ? 24 : endMatrixIndex - 1;
  const indexById = new Map(allCandidates.slice(0, matrixCandidateLimit).map((candidate, index) => [candidate.destination.id, index + 1]));
  let bestSequence: Candidate[] | null = null;
  let bestValue = Number.NEGATIVE_INFINITY;

  function visit(sequence: Candidate[]): void {
    if (sequence.length === count) {
      const endCoordinates = brief.endLocation?.coordinates ?? brief.startLocation.coordinates;
      const points = [brief.startLocation.coordinates, ...sequence.map((candidate) => candidate.destination.coordinates), endCoordinates];
      const matrixIndices = [0, ...sequence.map((candidate) => indexById.get(candidate.destination.id)), endMatrixIndex];
      const minutes = points.slice(0, -1).reduce((sum, point, index) => sum + matrixMinutes(point, points[index + 1]!, matrixIndices[index], matrixIndices[index + 1], matrix), 0);
      const travelDays = points.slice(0, -1).reduce((sum, _point, index) => sum + Math.max(1, Math.ceil(matrixMinutes(points[index]!, points[index + 1]!, matrixIndices[index], matrixIndices[index + 1], matrix) / (brief.maxDriveHoursPerDay * 60))), 0);
      if (travelDays + count > brief.durationDays) return;
      const countries = new Set(sequence.map((candidate) => candidate.destination.country));
      const value = sequence.reduce((sum, candidate) => sum + candidate.weatherScore, 0) / count + countries.size * 5 - minutes / 180;
      if (value > bestValue) {
        bestValue = value;
        bestSequence = sequence;
      }
      return;
    }

    for (const candidate of rotated) {
      if (sequence.length === 0 && requiredFirstId && candidate.destination.id !== requiredFirstId) continue;
      if (sequence.some((item) => item.destination.id === candidate.destination.id)) continue;
      visit([...sequence, candidate]);
    }
  }

  visit([]);
  return bestSequence;
}

function matrixMinutes(
  from: Coordinates,
  to: Coordinates,
  fromIndex: number | undefined,
  toIndex: number | undefined,
  matrix: number[][]
): number {
  const duration = fromIndex == null || toIndex == null ? undefined : matrix[fromIndex]?.[toIndex];
  return Number.isFinite(duration) && duration! > 0 ? duration! : estimateHours(from, to) * 60;
}

function splitRoute(
  path: Coordinates[],
  distanceKm: number,
  drivingMinutes: number,
  maxMinutes: number,
  firstDay: number,
  fromName: string,
  toName: string,
  brief: TripBrief,
  source: PlanLeg["source"]
): PlanLeg[] {
  const days = Math.max(1, Math.ceil(drivingMinutes / maxMinutes));
  const result: PlanLeg[] = [];
  for (let index = 0; index < days; index += 1) {
    const startFraction = index / days;
    const endFraction = (index + 1) / days;
    const segmentMinutes = Math.round((drivingMinutes / days) * 10) / 10;
    const segmentPath = [pointAlongPath(path, startFraction), pointAlongPath(path, endFraction)];
    const segmentFrom = fromName;
    const segmentTo = toName;
    const leg: PlanLeg = {
      id: `leg-${firstDay}-${index}-${segmentFrom}-${segmentTo}`,
      day: firstDay + index,
      fromName: segmentFrom,
      toName: segmentTo,
      distanceKm: Math.round(distanceKm / days),
      drivingMinutes: segmentMinutes,
      elapsedMinutes: segmentMinutes,
      routePath: segmentPath,
      breaks: [],
      source,
      isFinalSegment: index === days - 1
    };
    const breaks = buildBreaksForLeg(segmentMinutes, brief, `${segmentFrom}-${segmentTo}`, segmentPath[1] ?? segmentPath[0]!);
    leg.breaks = breaks;
    leg.elapsedMinutes += breaks.reduce((sum, stop) => sum + stop.durationMinutes, 0);
    result.push(leg);
  }
  return result;
}

function buildBreaksForLeg(
  minutes: number,
  brief: TripBrief,
  label: string,
  coordinates: Coordinates
) {
  const breaks = [] as PlanLeg["breaks"];
  let next = 120;
  let lunchAdded = false;
  while (next < minutes) {
    const lunch: boolean = brief.travelers.children > 0 && !lunchAdded && next >= 150 && next <= 330;
    breaks.push({
      id: `${label}-${next}`,
      kind: lunch ? "lunch" : brief.travelers.hasEv && next % 2 === 0 ? "charging" : "comfort",
      title: lunch ? "Lunch break" : brief.travelers.hasEv && next % 2 === 0 ? "Charging and stretch" : "Comfort break",
      detail: lunch ? "One hour for lunch, toilets, and a proper reset." : "15 minutes for toilets, water, and a stretch.",
      durationMinutes: lunch ? 60 : 15,
      plannedAfterDrivingMinutes: next,
      locationName: "Nearby service stop",
      coordinates,
      amenitiesVerified: false
    });
    lunchAdded ||= lunch;
    next += 120;
  }
  if (brief.travelers.children > 0 && !lunchAdded && minutes >= 180) {
    breaks.push({
      id: `${label}-lunch`,
      kind: "lunch",
      title: "Lunch break",
      detail: "One hour for lunch, toilets, and a proper reset.",
      durationMinutes: 60,
      plannedAfterDrivingMinutes: Math.round(minutes / 2),
      locationName: "Nearby family-friendly stop",
      coordinates,
      amenitiesVerified: false
    });
  }
  return breaks.sort((left, right) => left.plannedAfterDrivingMinutes - right.plannedAfterDrivingMinutes);
}

function selectForecast(forecast: DailyForecast[], start: string, end: string): DailyForecast[] {
  const selected = forecast.filter((day) => day.date >= start && day.date <= end);
  return selected.length ? selected : forecast.slice(0, 1);
}

function distributeNights(total: number, count: number): number[] {
  const base = Math.floor(total / count);
  const remainder = total % count;
  return Array.from({ length: count }, (_value, index) => base + (index < remainder ? 1 : 0));
}

function pointAlongPath(path: Coordinates[], fraction: number): Coordinates {
  if (path.length < 2) return path[0] ?? { latitude: 59.3293, longitude: 18.0686 };
  const scaled = Math.max(0, Math.min(0.999999, fraction)) * (path.length - 1);
  const index = Math.floor(scaled);
  const local = scaled - index;
  const start = path[index] ?? path[0]!;
  const end = path[index + 1] ?? path[path.length - 1]!;
  return {
    latitude: start.latitude + (end.latitude - start.latitude) * local,
    longitude: start.longitude + (end.longitude - start.longitude) * local
  };
}

function groupDrivingByDay(legs: PlanLeg[]): Map<number, number> {
  const grouped = new Map<number, number>();
  legs.forEach((leg) => grouped.set(leg.day, (grouped.get(leg.day) ?? 0) + leg.drivingMinutes));
  return grouped;
}

function impossibleRouteError(brief: TripBrief): ApiError {
  return {
    error: "That route does not fit your dates and daily driving limit yet.",
    details: [
      `We could not fit ${brief.placeCount === "smart" ? "the requested number of places" : `${brief.placeCount} places`} and the return journey.`,
      "Try fewer places, more days, or a higher daily driving limit."
    ],
    code: "ROUTE_DOES_NOT_FIT"
  };
}

function estimateHours(start: Coordinates, end: Coordinates): number {
  const radians = Math.PI / 180;
  const latitude = (end.latitude - start.latitude) * radians;
  const longitude = (end.longitude - start.longitude) * radians;
  const value = Math.sin(latitude / 2) ** 2 + Math.cos(start.latitude * radians) * Math.cos(end.latitude * radians) * Math.sin(longitude / 2) ** 2;
  return (6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value)) * 1.2) / 72;
}

function sameCoordinates(left: Coordinates, right: Coordinates): boolean {
  return Math.abs(left.latitude - right.latitude) < 0.02 && Math.abs(left.longitude - right.longitude) < 0.02;
}

function dateAt(start: string, dayOffset: number): string {
  const date = new Date(`${start}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + dayOffset);
  return date.toISOString().slice(0, 10);
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function weatherScoreText(score: number): string {
  return score >= 80 ? "a strong weather fit" : score >= 60 ? "workable weather" : "some weather tradeoffs";
}
