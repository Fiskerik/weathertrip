import { buildRecommendations } from "./recommendations.js";

const today = new Date();
const start = new Date(today);
start.setDate(today.getDate() + 1);
const end = new Date(start);
end.setDate(start.getDate() + 5);

const result = await buildRecommendations({
  startLocation: { label: "Stockholm" },
  dateRange: {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10)
  },
  durationDays: 5,
  travelMode: "car",
  maxHoursPerDay: 6,
  travelers: {
    adults: 2,
    children: 1,
    hasEv: true
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
});

if ("error" in result) {
  console.error(result);
  process.exit(1);
}

console.log(`Smoke check returned ${result.recommendations.length} recommendations.`);
