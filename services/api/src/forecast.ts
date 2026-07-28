import type { Coordinates, DailyForecast, Destination, TripRequest } from "@weathertrip/shared";

type OpenMeteoDailyResponse = {
  daily?: {
    time?: string[];
    temperature_2m_min?: number[];
    temperature_2m_max?: number[];
    precipitation_sum?: number[];
    sunshine_duration?: number[];
    wind_speed_10m_max?: number[];
  };
};

const forecastCache = new Map<string, DailyForecast[]>();

export async function getForecastBatch(
  destinations: Destination[],
  dateRange: { start: string; end: string },
  durationDays: number
): Promise<Map<string, DailyForecast[]>> {
  const result = new Map<string, DailyForecast[]>();
  const missing = destinations.filter((destination) => {
    const cacheKey = [destination.id, dateRange.start, dateRange.end, durationDays].join(":");
    const cached = forecastCache.get(cacheKey);
    if (cached) result.set(destination.id, cached);
    return !cached;
  });

  for (let index = 0; index < missing.length; index += 20) {
    const chunk = missing.slice(index, index + 20);
    const forecasts = await fetchForecastBatch(
      chunk.map((destination) => destination.coordinates),
      dateRange,
      durationDays
    );
    chunk.forEach((destination, chunkIndex) => {
      const forecast = forecasts[chunkIndex] ?? [];
      forecastCache.set([destination.id, dateRange.start, dateRange.end, durationDays].join(":"), forecast);
      result.set(destination.id, forecast);
    });
  }

  return result;
}

export async function getForecast(destination: Destination, request: TripRequest): Promise<DailyForecast[]> {
  const cacheKey = [
    destination.id,
    request.dateRange.start,
    request.dateRange.end,
    request.durationDays
  ].join(":");

  const cached = forecastCache.get(cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({
    latitude: String(destination.coordinates.latitude),
    longitude: String(destination.coordinates.longitude),
    daily: [
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_sum",
      "sunshine_duration",
      "wind_speed_10m_max"
    ].join(","),
    timezone: "auto",
    start_date: request.dateRange.start,
    end_date: request.dateRange.end
  });

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Open-Meteo returned ${response.status}`);
  }

  const body = (await response.json()) as OpenMeteoDailyResponse;
  const daily = body.daily;
  if (!daily?.time?.length) {
    throw new Error("Open-Meteo did not return daily forecast data");
  }

  const forecast = daily.time.slice(0, request.durationDays).map((date, index) => ({
    date,
    tempMinC: round(daily.temperature_2m_min?.[index] ?? 0),
    tempMaxC: round(daily.temperature_2m_max?.[index] ?? 0),
    precipitationMm: round(daily.precipitation_sum?.[index] ?? 0),
    sunshineHours: round((daily.sunshine_duration?.[index] ?? 0) / 3600),
    windKph: round(daily.wind_speed_10m_max?.[index] ?? 0)
  }));

  forecastCache.set(cacheKey, forecast);
  return forecast;
}

export function clearForecastCache(): void {
  forecastCache.clear();
}

async function fetchForecastBatch(
  coordinates: Coordinates[],
  dateRange: { start: string; end: string },
  durationDays: number
): Promise<DailyForecast[][]> {
  const params = new URLSearchParams({
    latitude: coordinates.map((point) => point.latitude).join(","),
    longitude: coordinates.map((point) => point.longitude).join(","),
    daily: [
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_sum",
      "sunshine_duration",
      "wind_speed_10m_max"
    ].join(","),
    timezone: "auto",
    start_date: dateRange.start,
    end_date: dateRange.end
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  if (!response.ok) throw new Error(`Open-Meteo returned ${response.status}`);

  const body = await response.json() as OpenMeteoDailyResponse | OpenMeteoDailyResponse[];
  const responses = Array.isArray(body) ? body : [body];
  return coordinates.map((_coordinate, index) => toForecast(responses[index], durationDays));
}

function toForecast(body: OpenMeteoDailyResponse | undefined, durationDays: number): DailyForecast[] {
  const daily = body?.daily;
  if (!daily?.time?.length) return [];
  return daily.time.slice(0, durationDays).map((date, index) => ({
    date,
    tempMinC: round(daily.temperature_2m_min?.[index] ?? 0),
    tempMaxC: round(daily.temperature_2m_max?.[index] ?? 0),
    precipitationMm: round(daily.precipitation_sum?.[index] ?? 0),
    sunshineHours: round((daily.sunshine_duration?.[index] ?? 0) / 3600),
    windKph: round(daily.wind_speed_10m_max?.[index] ?? 0)
  }));
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
