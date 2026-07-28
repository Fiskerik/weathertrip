import type {
  ApiError,
  PlanResponse,
  SavedTrip,
  TripBrief,
  TripPlan,
  UserProfile
} from "@weathertrip/shared";
import NetInfo from "@react-native-community/netinfo";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "./supabase";

const apiUrl = resolveApiUrl();

export async function fetchPlans(brief: TripBrief): Promise<PlanResponse> {
  return apiRequest<PlanResponse>("/v2/plans", {
    method: "POST",
    body: JSON.stringify(brief)
  });
}

export async function fetchProfile(): Promise<UserProfile> {
  return apiRequest<UserProfile>("/v1/profile");
}

export async function updateProfile(profile: Partial<UserProfile>): Promise<UserProfile> {
  return apiRequest<UserProfile>("/v1/profile", {
    method: "PATCH",
    body: JSON.stringify(profile)
  });
}

export async function deleteProfile(): Promise<void> {
  await apiRequest<{ ok: boolean }>("/v1/profile", { method: "DELETE" });
}

export async function fetchSavedTrips(): Promise<SavedTrip[]> {
  return apiRequest<SavedTrip[]>("/v1/saved-trips");
}

export async function createSavedTrip(title: string, brief: TripBrief, plan: TripPlan): Promise<SavedTrip> {
  return apiRequest<SavedTrip>("/v1/saved-trips", {
    method: "POST",
    body: JSON.stringify({ title, brief, plan })
  });
}

export async function renameSavedTrip(id: string, title: string): Promise<SavedTrip> {
  return apiRequest<SavedTrip>(`/v1/saved-trips/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ title })
  });
}

export async function deleteSavedTrip(id: string): Promise<void> {
  await apiRequest<{ ok: boolean }>(`/v1/saved-trips/${encodeURIComponent(id)}`, { method: "DELETE" });
}

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const connectivity = await NetInfo.fetch();
  if (connectivity.isConnected === false) {
    throw new Error("You are offline. Reconnect to plan or refresh this trip.");
  }
  const session = (await supabase.auth.getSession()).data.session;
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (session?.access_token) headers.set("Authorization", `Bearer ${session.access_token}`);

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch(`${apiUrl}${path}`, { ...init, headers, signal: controller.signal });
      const body = await response.json() as T | ApiError;
      if (!response.ok || isApiError(body)) {
        throw new Error(formatApiError(body, response.status));
      }
      return body as T;
    } catch (error) {
      lastError = error instanceof Error
        ? error.name === "AbortError" ? new Error("The request took too long. Check your connection and try again.") : error
        : new Error("Weathertrip is unavailable right now. Please try again.");
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 350));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError ?? new Error(`Could not reach Weathertrip API at ${apiUrl}.`);
}

function resolveApiUrl(): string {
  const configured = readConfiguredApiUrl();
  if (configured) {
    if (!__DEV__) {
      let parsed: URL;
      try {
        parsed = new URL(configured);
      } catch {
        throw new Error("Weathertrip release builds require a valid HTTPS API URL.");
      }
      if (parsed.protocol !== "https:" || parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
        throw new Error("Weathertrip release builds require a public HTTPS API URL.");
      }
    }
    return trimTrailingSlash(configured);
  }

  if (!__DEV__) {
    throw new Error("Weathertrip is missing its production API URL.");
  }

  const expoHost = readExpoHost();
  if (expoHost) return `http://${expoHost}:4100`;
  if (Platform.OS === "android") return "http://10.0.2.2:4100";
  return "http://localhost:4100";
}

function readConfiguredApiUrl(): string | null {
  const extra = Constants.expoConfig?.extra as { apiUrl?: unknown } | undefined;
  const value = extra?.apiUrl;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readExpoHost(): string | null {
  const hostUri = (Constants.expoConfig as { hostUri?: string } | null)?.hostUri;
  if (!hostUri) return null;
  const host = hostUri.split(":")[0];
  return host && host !== "localhost" && host !== "127.0.0.1" ? host : null;
}

function isApiError(value: unknown): value is ApiError {
  return Boolean(value && typeof value === "object" && "error" in value);
}

function formatApiError(value: unknown, status: number): string {
  if (!isApiError(value)) return `Weathertrip request failed (${status}).`;
  const details = value.details?.length ? ` ${value.details.join(" ")}` : "";
  return `${value.error}${details}`;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
