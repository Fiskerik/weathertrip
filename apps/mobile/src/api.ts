import type { ApiError, RecommendationResponse, TripRequest } from "@weathertrip/shared";

const apiUrl = process.env.EXPO_PUBLIC_WEATHERTRIP_API_URL ?? "http://localhost:4100";

export async function fetchRecommendations(request: TripRequest): Promise<RecommendationResponse> {
  const response = await fetch(`${apiUrl}/recommendations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  const body = (await response.json()) as RecommendationResponse | ApiError;
  if (!response.ok || "error" in body) {
    const details = "details" in body && body.details?.length ? ` ${body.details.join(" ")}` : "";
    throw new Error(`${"error" in body ? body.error : "Recommendations unavailable."}${details}`);
  }

  return body;
}
