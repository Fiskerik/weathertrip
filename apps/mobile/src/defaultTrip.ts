import type { TripRequest } from "@weathertrip/shared";

export function createDefaultTrip(): TripRequest {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  const end = new Date(start);
  end.setDate(start.getDate() + 4);

  return {
    startLocation: { label: "Stockholm" },
    dateRange: {
      start: toDateInput(start),
      end: toDateInput(end)
    },
    durationDays: 5,
    travelMode: "car",
    maxHoursPerDay: 6,
    travelers: {
      adults: 2,
      children: 0,
      hasEv: false
    },
    minStayDays: 2,
    maxStayDays: 5,
    accommodations: ["hotel", "cabin"],
    weather: {
      tempMinC: 16,
      tempMaxC: 27,
      maxPrecipitationMm: 3,
      minSunshineHours: 5,
      maxWindKph: 30
    },
    budget: "balanced"
  };
}

function toDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}
