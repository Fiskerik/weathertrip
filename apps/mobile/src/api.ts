import type { ApiError, RecommendationResponse, TripRequest } from "@weathertrip/shared";
import Constants from "expo-constants";
import { Platform } from "react-native";

const apiUrl = resolveApiUrl();

export async function fetchRecommendations(request: TripRequest): Promise<RecommendationResponse> {
  let response: Response;
  try {
    response = await fetch(`${apiUrl}/recommendations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(request)
    });
  } catch {
    throw new Error(`Could not reach Weathertrip API at ${apiUrl}. Check that the API is running and reachable from this device.`);
  }

  const body = (await response.json()) as RecommendationResponse | ApiError;
  if (!response.ok || "error" in body) {
    const details = "details" in body && body.details?.length ? ` ${body.details.join(" ")}` : "";
    throw new Error(`${"error" in body ? body.error : "Recommendations unavailable."}${details}`);
  }

  return body;
}

function resolveApiUrl(): string {
  const configured = readConfiguredApiUrl();
  if (configured) return trimTrailingSlash(configured);

  const expoHost = readExpoHost();
  if (expoHost) return `http://${expoHost}:4100`;

  if (Platform.OS === "android") {
    return "http://10.0.2.2:4100";
  }

  return "http://localhost:4100";
}

function readConfiguredApiUrl(): string | null {
  const extra = Constants.expoConfig?.extra as { apiUrl?: unknown } | undefined;
  return typeof extra?.apiUrl === "string" && extra.apiUrl.trim() ? extra.apiUrl.trim() : null;
}

function readExpoHost(): string | null {
  const expoConfig = Constants.expoConfig as { hostUri?: string } | null;
  const hostUri = expoConfig?.hostUri;
  if (!hostUri) return null;

  const host = hostUri.split(":")[0];
  return host && host !== "localhost" && host !== "127.0.0.1" ? host : null;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
