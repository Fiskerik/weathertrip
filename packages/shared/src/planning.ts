import type {
  ApiError,
  BreakStop,
  DailyForecast,
  PlanLeg,
  TripBrief,
  TripPlan,
  WeatherGoal
} from "./types.js";

export function validateTripBrief(brief: TripBrief): ApiError | null {
  const details: string[] = [];
  const start = new Date(brief.dateRange?.start);
  const end = new Date(brief.dateRange?.end);

  if (!brief.startLocation?.label?.trim()) details.push("Choose a start location.");
  if (!Number.isFinite(brief.startLocation?.coordinates?.latitude) || !Number.isFinite(brief.startLocation?.coordinates?.longitude)) {
    details.push("Choose a start location from the suggestions so we can calculate a real route.");
  }
  if (brief.endLocation?.label?.trim() && (!Number.isFinite(brief.endLocation.coordinates?.latitude) || !Number.isFinite(brief.endLocation.coordinates?.longitude))) {
    details.push("Choose the end destination from the suggestions so we can calculate a real route.");
  }
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    details.push("Choose valid trip dates.");
  } else if (end < start) {
    details.push("Return date must be after the start date.");
  }
  if (!Number.isFinite(brief.durationDays) || brief.durationDays < 1 || brief.durationDays > 16) {
    details.push("Trips must be between 1 and 16 days.");
  }
  if (!Number.isFinite(brief.maxDriveHoursPerDay) || brief.maxDriveHoursPerDay < 1 || brief.maxDriveHoursPerDay > 10) {
    details.push("Daily driving must be between 1 and 10 hours.");
  }
  if (!Number.isFinite(brief.travelers?.adults) || brief.travelers.adults < 1 || brief.travelers.adults > 8) {
    details.push("Add at least one adult traveler.");
  }
  if (!Number.isFinite(brief.travelers?.children) || brief.travelers.children < 0 || brief.travelers.children > 8) {
    details.push("Children must be between 0 and 8.");
  }
  if (!brief.weatherGoal) details.push("Choose what matters most for the weather.");
  if (!brief.accommodations?.length) details.push("Choose at least one stay style.");

  return details.length
    ? { error: "Trip brief needs a few fixes.", details, code: "INVALID_TRIP_BRIEF" }
    : null;
}

export function calculateDurationDays(start: string, end: string): number {
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  return Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1);
}

export function buildBreakSchedule(
  drivingMinutes: number,
  hasChildren: boolean,
  hasEv: boolean,
  legLabel: string,
  coordinates?: { latitude: number; longitude: number }
): BreakStop[] {
  const breaks: BreakStop[] = [];
  const comfortInterval = 120;
  const lunchWindowStart = 150;
  const lunchWindowEnd = 330;
  let nextComfortAt = comfortInterval;
  let lunchAdded = false;

  while (nextComfortAt < drivingMinutes) {
    const lunchDue = hasChildren && !lunchAdded && nextComfortAt >= lunchWindowStart && nextComfortAt <= lunchWindowEnd;
    breaks.push({
      id: `${legLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${nextComfortAt}`,
      kind: lunchDue ? "lunch" : hasEv && nextComfortAt % 2 === 0 ? "charging" : "comfort",
      title: lunchDue ? "Lunch break" : hasEv && nextComfortAt % 2 === 0 ? "Charging and stretch" : "Comfort break",
      detail: lunchDue
        ? "Take a proper one-hour lunch before the next driving block."
        : "Toilets, water, and a 15-minute reset before continuing.",
      durationMinutes: lunchDue ? 60 : 15,
      plannedAfterDrivingMinutes: nextComfortAt,
      locationName: "Nearby service stop",
      ...(coordinates ? { coordinates } : {}),
      amenitiesVerified: false
    });
    if (lunchDue) lunchAdded = true;
    nextComfortAt += comfortInterval;
  }

  if (hasChildren && !lunchAdded && drivingMinutes >= 180) {
    breaks.splice(Math.min(1, breaks.length), 0, {
      id: `${legLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-lunch`,
      kind: "lunch",
      title: "Lunch break",
      detail: "Take a proper one-hour lunch before the final driving block.",
      durationMinutes: 60,
      plannedAfterDrivingMinutes: Math.min(300, Math.round(drivingMinutes / 2)),
      locationName: "Nearby family-friendly stop",
      ...(coordinates ? { coordinates } : {}),
      amenitiesVerified: false
    });
  }

  return breaks.sort((a, b) => a.plannedAfterDrivingMinutes - b.plannedAfterDrivingMinutes);
}

export function weatherGoalLabel(goal: WeatherGoal): string {
  return {
    sunny: "sunniest",
    dry: "driest",
    warm: "warmest",
    cool: "coolest",
    balanced: "most balanced weather"
  }[goal];
}

export function scoreForecast(forecast: DailyForecast[], goal: WeatherGoal): number {
  if (!forecast.length) return 0;
  const daily = forecast.map((day) => {
    const sunshine = Math.min(100, day.sunshineHours / 10 * 100);
    const dry = Math.max(0, 100 - day.precipitationMm * 14);
    const warm = clamp(100 - Math.abs(23 - day.tempMaxC) * 8);
    const cool = clamp(100 - Math.abs(18 - day.tempMaxC) * 8);
    const balanced = clamp(100 - Math.abs(22 - day.tempMaxC) * 6) * 0.6 + dry * 0.4;
    return goal === "sunny"
      ? sunshine * 0.7 + dry * 0.3
      : goal === "dry"
        ? dry * 0.75 + sunshine * 0.25
        : goal === "warm"
          ? warm * 0.7 + sunshine * 0.3
          : goal === "cool"
            ? cool * 0.7 + dry * 0.3
            : balanced;
  });
  return Math.round(average(daily));
}

export function summarizePlan(plan: TripPlan, brief: TripBrief): string {
  const stopText = `${plan.stops.length} ${plan.stops.length === 1 ? "place" : "places"}`;
  const countryText = plan.countries.join(", ");
  return `${brief.durationDays} days, ${stopText} across ${countryText}, with ${formatDurationMinutes(plan.totalDrivingMinutes)} of driving and the ${weatherGoalLabel(brief.weatherGoal)} forecast windows.`;
}

export function formatDurationMinutes(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder}m`;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

export function buildPlanLeg(
  id: string,
  day: number,
  fromName: string,
  toName: string,
  distanceKm: number,
  drivingMinutes: number,
  routePath: { latitude: number; longitude: number }[],
  brief: TripBrief
): PlanLeg {
  const breaks = buildBreakSchedule(
    drivingMinutes,
    brief.travelers.children > 0,
    brief.travelers.hasEv,
    `${fromName}-${toName}`,
    routePath[routePath.length - 1]
  );
  return {
    id,
    day,
    fromName,
    toName,
    distanceKm,
    drivingMinutes,
    elapsedMinutes: drivingMinutes + breaks.reduce((sum, stop) => sum + stop.durationMinutes, 0),
    routePath,
    breaks,
    source: "estimate",
    isFinalSegment: true
  };
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}
