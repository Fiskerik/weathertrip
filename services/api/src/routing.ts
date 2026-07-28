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
const matrixCache = new Map<string, number[][]>();
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

export async function getRouteBetween(start: Coordinates, end: Coordinates): Promise<RouteMetrics> {
  const cacheKey = `between:${start.latitude}:${start.longitude}:${end.latitude}:${end.longitude}`;
  const cached = routeCache.get(cacheKey);
  if (cached) return cached;

  const fallback = estimateBetween(start, end);
  const apiKey = process.env.OPENROUTESERVICE_API_KEY;
  if (!apiKey) return fallback;

  try {
    const response = await fetch("https://api.openrouteservice.org/v2/directions/driving-car/geojson", {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        coordinates: [[start.longitude, start.latitude], [end.longitude, end.latitude]],
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
      routePath: mapRoutePath(feature?.geometry?.coordinates, start, end)
    };
    routeCache.set(cacheKey, metrics);
    return metrics;
  } catch {
    return fallback;
  }
}

export async function getRouteMatrix(points: Coordinates[]): Promise<number[][]> {
  const cacheKey = points.map((point) => `${point.latitude.toFixed(3)},${point.longitude.toFixed(3)}`).join("|");
  const cached = matrixCache.get(cacheKey);
  if (cached) return cached;

  const fallback = points.map((from) => points.map((to) => estimateBetween(from, to).durationHours * 60));
  const apiKey = process.env.OPENROUTESERVICE_API_KEY;
  if (!apiKey || points.length < 2 || points.length > 25) return fallback;

  try {
    const response = await fetch("https://api.openrouteservice.org/v2/matrix/driving-car", {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        locations: points.map((point) => [point.longitude, point.latitude]),
        metrics: ["duration", "distance"],
        units: "km"
      })
    });
    if (!response.ok) return fallback;
    const body = (await response.json()) as { durations?: Array<Array<number | null>> };
    const matrix = body.durations?.map((row) => row.map((value) => value == null ? 0 : value / 60));
    if (!matrix?.length) return fallback;
    matrixCache.set(cacheKey, matrix);
    return matrix;
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

function estimateBetween(start: Coordinates, end: Coordinates): RouteMetrics {
  const distanceKm = Math.max(1, haversineKm(start, end) * 1.2);
  return {
    distanceKm: round(distanceKm),
    durationHours: round(distanceKm / 72),
    source: "estimate",
    routePath: [start, end]
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

function haversineKm(start: Coordinates, end: Coordinates): number {
  const earthRadius = 6371;
  const latitudeDelta = toRadians(end.latitude - start.latitude);
  const longitudeDelta = toRadians(end.longitude - start.longitude);
  const latitudeA = toRadians(start.latitude);
  const latitudeB = toRadians(end.latitude);
  const value = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function toRadians(value: number): number {
  return value * Math.PI / 180;
}
