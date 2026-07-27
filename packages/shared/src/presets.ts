import type { TripRequest } from "./types.js";

export type TripPreset = {
  id: "sunny-city" | "camping-weather" | "low-rain-road-trip";
  label: string;
  description: string;
  patch: Pick<TripRequest, "weather" | "accommodations" | "maxHoursPerDay" | "budget">;
};

export const tripPresets: TripPreset[] = [
  {
    id: "sunny-city",
    label: "Sunny city break",
    description: "Warmer days, easy hotels, and plenty of daylight for wandering.",
    patch: {
      accommodations: ["hotel", "hostel"],
      maxHoursPerDay: 7,
      budget: "balanced",
      weather: {
        tempMinC: 18,
        tempMaxC: 29,
        maxPrecipitationMm: 4,
        minSunshineHours: 7,
        maxWindKph: 28
      }
    }
  },
  {
    id: "camping-weather",
    label: "Camping weather",
    description: "Dry, calm nights and mild days for tent, trailer, or cabin trips.",
    patch: {
      accommodations: ["tent", "trailer", "cabin", "glamping"],
      maxHoursPerDay: 5,
      budget: "lean",
      weather: {
        tempMinC: 14,
        tempMaxC: 25,
        maxPrecipitationMm: 2,
        minSunshineHours: 6,
        maxWindKph: 22
      }
    }
  },
  {
    id: "low-rain-road-trip",
    label: "Low-rain road trip",
    description: "Prioritizes dry days and reasonable daily driving time.",
    patch: {
      accommodations: ["hotel", "cabin", "trailer"],
      maxHoursPerDay: 6,
      budget: "balanced",
      weather: {
        tempMinC: 15,
        tempMaxC: 27,
        maxPrecipitationMm: 1.5,
        minSunshineHours: 5,
        maxWindKph: 30
      }
    }
  }
];
