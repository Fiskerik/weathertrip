import {
  buildPlanSummary,
  destinations,
  scoreDestination,
  validateTripRequest,
  type ApiError,
  type RecommendationResponse,
  type TripRequest
} from "@weathertrip/shared";
import { getForecast } from "./forecast.js";
import { getAccommodationSuggestions } from "./places.js";
import { getRouteMetrics } from "./routing.js";

export async function buildRecommendations(
  request: TripRequest
): Promise<RecommendationResponse | ApiError> {
  const validation = validateTripRequest(request);
  if (validation) return validation;

  const settled = await Promise.allSettled(
    destinations.map(async (destination) => {
      const forecast = await getForecast(destination, request);
      const routeMetrics = await getRouteMetrics(destination, request);
      return scoreDestination(destination, request, forecast, routeMetrics);
    })
  );

  const recommendations = settled
    .filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof scoreDestination>>> => {
      return result.status === "fulfilled";
    })
    .map((result) => result.value)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  if (!recommendations.length) {
    return {
      error: "Weather data is temporarily unavailable.",
      details: ["Try again in a moment. Weathertrip could not reach the forecast service."]
    };
  }

  const enrichedRecommendations = await Promise.all(
    recommendations.map(async (recommendation) => {
      const liveAccommodationSuggestions = await getAccommodationSuggestions(
        recommendation.destination,
        request,
        recommendation.routeMetrics
      );
      if (!liveAccommodationSuggestions.length) return recommendation;
      return scoreDestination(
        recommendation.destination,
        request,
        recommendation.forecast,
        recommendation.routeMetrics,
        liveAccommodationSuggestions
      );
    })
  );

  return {
    generatedAt: new Date().toISOString(),
    planSummary: buildPlanSummary(request, enrichedRecommendations[0]),
    recommendations: enrichedRecommendations
  };
}
