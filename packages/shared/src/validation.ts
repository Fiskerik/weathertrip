import type { ApiError, TripRequest } from "./types.js";

export function validateTripRequest(request: TripRequest): ApiError | null {
  const details: string[] = [];
  const startDate = new Date(request.dateRange?.start);
  const endDate = new Date(request.dateRange?.end);
  const ignoredWeather = new Set(request.ignoredWeather ?? []);

  if (!request.startLocation?.label?.trim() && !request.startLocation?.coordinates) {
    details.push("Choose a start location.");
  }

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    details.push("Choose valid trip dates.");
  } else if (endDate < startDate) {
    details.push("Return date must be after the start date.");
  }

  if (!Number.isFinite(request.durationDays) || request.durationDays < 1 || request.durationDays > 16) {
    details.push("Duration must be between 1 and 16 days.");
  }

  if (!Number.isFinite(request.maxHoursPerDay) || request.maxHoursPerDay < 1 || request.maxHoursPerDay > 12) {
    details.push("Travel time must be between 1 and 12 hours per day.");
  }

  if (!Number.isFinite(request.travelers?.adults) || request.travelers.adults < 1 || request.travelers.adults > 8) {
    details.push("Add at least one adult traveler.");
  }

  if (!Number.isFinite(request.travelers?.children) || request.travelers.children < 0 || request.travelers.children > 8) {
    details.push("Children must be between 0 and 8.");
  }

  if (request.minStayDays < 1 || request.maxStayDays < request.minStayDays) {
    details.push("Stay length must be at least one night and max stay must be after min stay.");
  }

  if (
    !ignoredWeather.has("tempMinC") &&
    !ignoredWeather.has("tempMaxC") &&
    request.weather.tempMinC > request.weather.tempMaxC
  ) {
    details.push("Minimum temperature cannot be higher than maximum temperature.");
  }

  return details.length ? { error: "Trip request needs a few fixes.", details } : null;
}
