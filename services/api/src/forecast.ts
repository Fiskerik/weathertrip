import type { DailyForecast, Destination, TripRequest } from "@weathertrip/shared";

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

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
