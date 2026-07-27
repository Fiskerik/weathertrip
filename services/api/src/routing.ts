import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Coordinates, Destination, RouteMetrics, TripRequest } from "@weathertrip/shared";

const currentDir = dirname(fileURLToPath(import.meta.url));
config({ path: [resolve(currentDir, "../../../.env"), resolve(currentDir, "../.env")] });

type OrsDirectionsResponse = {
  features?: Array<{
    geometry?: {
      coordinates?: Array<[number, number]>;
    };
    properties?: {
      summary?: {
        distance?: number;
        duration?: number;
      };
    };
  }>;
};

const routeCache = new Map<string, RouteMetrics>();
const practicalDrivingBuffer = 1.1;

const fallbackStartCoordinates: Coordinates = {
  latitude: 59.3293,
  longitude: 18.0686
};

export async function getRouteMetrics(
  destination: Destination,
  request: TripRequest
): Promise<RouteMetrics> {
  const fallback = estimateRouteMetrics(destination);
  const apiKey = process.env.OPENROUTESERVICE_API_KEY;
  if (!apiKey || request.travelMode !== "car") return fallback;

  const start = request.startLocation.coordinates ?? fallbackStartCoordinates;
  const cacheKey = [
    start.latitude,
    start.longitude,
    destination.coordinates.latitude,
    destination.coordinates.longitude,
    request.travelMode
  ].join(":");

  const cached = routeCache.get(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch("https://api.openrouteservice.org/v2/directions/driving-car/geojson", {
      method: "POST",
      headers: {
        "Authorization": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        coordinates: [
          [start.longitude, start.latitude],
          [destination.coordinates.longitude, destination.coordinates.latitude]
        ],
        radiuses: [1000, 5000],
        units: "km"
      })
    });

    if (!response.ok) return fallback;

    const body = (await response.json()) as OrsDirectionsResponse;
    const feature = body.features?.[0];
    const summary = feature?.properties?.summary;
    if (!summary?.distance || !summary.duration) return fallback;

    const metrics: RouteMetrics = {
      distanceKm: round(summary.distance),
      durationHours: round((summary.duration / 3600) * practicalDrivingBuffer),
      source: "openrouteservice",
      routePath: mapRoutePath(feature?.geometry?.coordinates, start, destination.coordinates)
    };

    routeCache.set(cacheKey, metrics);
    return metrics;
  } catch {
    return fallback;
  }
}

function estimateRouteMetrics(destination: Destination): RouteMetrics {
  return {
    distanceKm: Math.round(destination.baselineTravelHoursFromStockholm * 78),
    durationHours: destination.baselineTravelHoursFromStockholm,
    source: "estimate",
    routePath: [fallbackStartCoordinates, destination.coordinates]
  };
}

function mapRoutePath(
  coordinates: Array<[number, number]> | undefined,
  start: Coordinates,
  end: Coordinates
): Coordinates[] {
  if (!coordinates?.length) return [start, end];
  return coordinates.map(([longitude, latitude]) => ({ latitude, longitude }));
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
