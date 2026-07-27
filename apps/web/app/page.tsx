"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import {
  BedDouble,
  CalendarDays,
  Car,
  CloudRain,
  CloudSun,
  Compass,
  Gauge,
  Hotel,
  LocateFixed,
  MapPin,
  MapPinned,
  Navigation,
  RotateCcw,
  Route,
  Sun,
  Tent,
  Thermometer,
  Wind
} from "lucide-react";
import {
  accommodationLabels,
  destinations,
  tripPresets,
  validateTripRequest,
  type AccommodationTag,
  type ApiError,
  type AccommodationSuggestion,
  type DirectionPreference,
  type ItinerarySegment,
  type Recommendation,
  type RecommendationResponse,
  type TripRequest,
  type WeatherConstraintKey
} from "@weathertrip/shared";
import { createDefaultTrip } from "../lib/defaultTrip";

type WeatherKey = WeatherConstraintKey;

const RouteMap = dynamic(() => import("../components/RouteMap"), {
  ssr: false,
  loading: () => <div className="routeMapLoading">Loading route map...</div>
});

const accommodationOptions = Object.keys(accommodationLabels) as AccommodationTag[];
const directionOptions: DirectionPreference[] = ["north", "east", "south", "west"];
const defaultTrip = createDefaultTrip();
const defaultWeather = defaultTrip.weather;
const weatherConfig: Array<{
  key: WeatherKey;
  label: string;
  detail: string;
  min: number;
  max: number;
  suffix: string;
  icon: React.ReactNode;
}> = [
  {
    key: "tempMinC",
    label: "Minimum temp",
    detail: "Coldest acceptable daytime feel",
    min: 4,
    max: 28,
    suffix: "C",
    icon: <Thermometer />
  },
  {
    key: "tempMaxC",
    label: "Maximum temp",
    detail: "Avoid trips that get too hot",
    min: 10,
    max: 36,
    suffix: "C",
    icon: <Gauge />
  },
  {
    key: "maxPrecipitationMm",
    label: "Max rain",
    detail: "Daily rain tolerance",
    min: 0,
    max: 12,
    suffix: "mm",
    icon: <CloudRain />
  },
  {
    key: "minSunshineHours",
    label: "Sunshine",
    detail: "Minimum daylight reward",
    min: 1,
    max: 12,
    suffix: "h",
    icon: <Sun />
  },
  {
    key: "maxWindKph",
    label: "Wind tolerance",
    detail: "Keeps exposed stops calmer",
    min: 10,
    max: 55,
    suffix: "kph",
    icon: <Wind />
  }
];

const apiUrl = process.env.NEXT_PUBLIC_WEATHERTRIP_API_URL ?? "http://localhost:4100";

export default function Home() {
  const [trip, setTrip] = useState<TripRequest>(() => defaultTrip);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [activeWeather, setActiveWeather] = useState<Set<WeatherKey>>(() => new Set());
  const [expandedWeather, setExpandedWeather] = useState<WeatherKey | null>(null);
  const [result, setResult] = useState<RecommendationResponse | null>(null);
  const [selected, setSelected] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const validation = useMemo(() => validateTripRequest(trip), [trip]);

  function setDateRange(next: Partial<TripRequest["dateRange"]>) {
    setTrip((current) => {
      const dateRange = { ...current.dateRange, ...next };
      return {
        ...current,
        dateRange,
        durationDays: calculateTripDays(dateRange.start, dateRange.end)
      };
    });
  }

  function useGpsLocation() {
    if (!("geolocation" in navigator)) {
      setLocationStatus("GPS is not available in this browser.");
      return;
    }

    setLocationStatus("Waiting for GPS signal...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coordinates = {
          latitude: roundCoordinate(position.coords.latitude),
          longitude: roundCoordinate(position.coords.longitude)
        };
        setTrip((current) => ({
          ...current,
          startLocation: {
            label: "Current location",
            coordinates
          }
        }));
        setLocationStatus(`GPS set: ${coordinates.latitude}, ${coordinates.longitude}`);
      },
      () => {
        setLocationStatus("Could not access GPS. Check browser location permission.");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 60000,
        timeout: 10000
      }
    );
  }

  async function submit() {
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/recommendations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(trip)
      });
      const body = (await response.json()) as RecommendationResponse | ApiError;
      if (!response.ok || "error" in body) {
        throw new Error("error" in body ? [body.error, ...(body.details ?? [])].join(" ") : "Recommendations unavailable.");
      }
      setResult(body);
      setSelected(body.recommendations[0] ?? null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load recommendations.");
    } finally {
      setLoading(false);
    }
  }

  function applyPreset(presetId: string) {
    const preset = tripPresets.find((item) => item.id === presetId);
    if (!preset) return;
    setTrip((current) => ({ ...current, ...preset.patch, ignoredWeather: [] }));
    setSelectedPresetId(presetId);
    setActiveWeather(new Set(weatherConfig.map((item) => item.key)));
    setExpandedWeather(null);
  }

  function clearPreset() {
    setSelectedPresetId(null);
    setActiveWeather(new Set());
    setExpandedWeather(null);
    setTrip((current) => ({
      ...current,
      maxHoursPerDay: defaultTrip.maxHoursPerDay,
      accommodations: defaultTrip.accommodations,
      budget: "balanced",
      weather: defaultWeather,
      ignoredWeather: []
    }));
  }

  return (
    <main className="shell">
      <section className="planner">
        <div className="topbar">
          <div>
            <p className="eyebrow">Weathertrip MVP</p>
            <h1>Plan around the forecast.</h1>
          </div>
          <div className="mark" aria-hidden="true">
            <CloudSun size={30} />
          </div>
        </div>

        <div className="layout">
          <form className="form" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
            <Panel icon={<MapPin />} tone="green" title="Start and dates">
              <div className="locationRow">
                <label className="field">
                  <span>Start location</span>
                  <input
                    value={trip.startLocation.label}
                    onChange={(event) => setTrip((current) => ({ ...current, startLocation: { label: event.target.value } }))}
                  />
                </label>
                <button className="secondaryButton" type="button" onClick={useGpsLocation}>
                  <LocateFixed size={16} />
                  Use GPS
                </button>
              </div>
              {locationStatus ? <p className="fieldHint">{locationStatus}</p> : null}
              <div className="two">
                <label className="field">
                  <span>Leave</span>
                  <input
                    type="date"
                    value={trip.dateRange.start}
                    onChange={(event) => setDateRange({ start: event.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Back</span>
                  <input
                    type="date"
                    value={trip.dateRange.end}
                    onChange={(event) => setDateRange({ end: event.target.value })}
                  />
                </label>
              </div>
              <div className="tripLengthSummary">
                <span>Trip length</span>
                <strong>{formatDays(trip.durationDays)}</strong>
              </div>
            </Panel>

            <Panel icon={<MapPinned />} tone="blue" title="Destination intent">
              <label className="field">
                <span>Optional destination</span>
                <select
                  value={trip.destinationPreference?.destinationId ?? ""}
                  onChange={(event) =>
                    setTrip((current) => {
                      const destinationId = event.target.value || undefined;
                      return withDestinationPreference(
                        current,
                        destinationId,
                        current.destinationPreference?.direction
                      );
                    })
                  }
                >
                  <option value="">No fixed destination</option>
                  {destinations.map((destination) => (
                    <option key={destination.id} value={destination.id}>
                      {destination.name}, {destination.country}
                    </option>
                  ))}
                </select>
              </label>
              <div className="intentHelp">Or bias the trip in a direction. It nudges ranking without forcing the route.</div>
              <div className="segments compass" aria-label="Route direction">
                {directionOptions.map((direction) => {
                  const active = trip.destinationPreference?.direction === direction;
                  return (
                    <button
                      key={direction}
                      className={active ? "segment active" : "segment"}
                      type="button"
                      onClick={() =>
                        setTrip((current) =>
                          withDestinationPreference(
                            current,
                            current.destinationPreference?.destinationId,
                            active ? undefined : direction
                          )
                        )
                      }
                    >
                      <Compass size={14} />
                      {direction}
                    </button>
                  );
                })}
              </div>
            </Panel>

            <Panel icon={<Navigation />} tone="green" title="Trip presets">
              <div className="presets">
                <button
                  className={selectedPresetId === null ? "preset active" : "preset"}
                  type="button"
                  onClick={clearPreset}
                >
                  <strong>No preference</strong>
                  <span>Use balanced defaults and tune individual fields yourself.</span>
                </button>
                {tripPresets.map((preset) => (
                  <button
                    className={selectedPresetId === preset.id ? "preset active" : "preset"}
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset.id)}
                  >
                    <strong>{preset.label}</strong>
                    <span>{preset.description}</span>
                  </button>
                ))}
              </div>
            </Panel>

            <Panel icon={<Car />} tone="yellow" title="Travel limits">
              <div className="segments" aria-label="Travel mode">
                <span className="segment active">Car</span>
                <span className="segment">Train soon</span>
                <span className="segment">Flight soon</span>
              </div>
              <Range
                label="Max travel per day"
                value={trip.maxHoursPerDay}
                min={1}
                max={12}
                suffix=" h"
                onChange={(maxHoursPerDay) => setTrip((current) => ({ ...current, maxHoursPerDay }))}
              />
              <div className="two">
                <label className="field">
                  <span>Min stay (days)</span>
                  <input
                    type="number"
                    min={1}
                    value={trip.minStayDays}
                    onChange={(event) => setTrip((current) => ({ ...current, minStayDays: Number(event.target.value) || 1 }))}
                  />
                </label>
                <label className="field">
                  <span>Max stay (days)</span>
                  <input
                    type="number"
                    min={1}
                    value={trip.maxStayDays}
                    onChange={(event) => setTrip((current) => ({ ...current, maxStayDays: Number(event.target.value) || 1 }))}
                  />
                </label>
              </div>
              <div className="travelerGrid">
                <label className="field">
                  <span>Adults</span>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={trip.travelers.adults}
                    onChange={(event) =>
                      setTrip((current) => ({
                        ...current,
                        travelers: { ...current.travelers, adults: Number(event.target.value) || 1 }
                      }))
                    }
                  />
                </label>
                <label className="field">
                  <span>Children</span>
                  <input
                    type="number"
                    min={0}
                    max={8}
                    value={trip.travelers.children}
                    onChange={(event) =>
                      setTrip((current) => ({
                        ...current,
                        travelers: { ...current.travelers, children: Number(event.target.value) || 0 }
                      }))
                    }
                  />
                </label>
                <label className="evToggle">
                  <input
                    type="checkbox"
                    checked={trip.travelers.hasEv}
                    onChange={(event) =>
                      setTrip((current) => ({
                        ...current,
                        travelers: { ...current.travelers, hasEv: event.target.checked }
                      }))
                    }
                  />
                  <span>EV trip</span>
                </label>
              </div>
            </Panel>

            <Panel icon={<Tent />} tone="green" title="Stay style">
              <div className="chips">
                {accommodationOptions.map((tag) => {
                  const active = trip.accommodations.includes(tag);
                  return (
                    <button
                      key={tag}
                      className={active ? "chip active" : "chip"}
                      type="button"
                      onClick={() =>
                        setTrip((current) => ({
                          ...current,
                          accommodations: active
                            ? current.accommodations.filter((item) => item !== tag)
                            : [...current.accommodations, tag]
                        }))
                      }
                    >
                      {accommodationLabels[tag]}
                    </button>
                  );
                })}
              </div>
            </Panel>

            <Panel icon={<Wind />} tone="blue" title="Weather preferences">
              <div className="weatherButtons">
                <div className="weatherTabs">
                  {weatherConfig.map((item) => {
                  const active = activeWeather.has(item.key);
                  const expanded = expandedWeather === item.key;
                  const ignored = isWeatherIgnored(trip, item.key);
                  return (
                    <button
                      type="button"
                      className={[
                        "weatherTab",
                        active ? "active" : "",
                        expanded ? "expanded" : "",
                        ignored ? "ignored" : ""
                      ].filter(Boolean).join(" ")}
                      key={item.key}
                      aria-expanded={expanded}
                      onClick={() => setExpandedWeather((current) => current === item.key ? null : item.key)}
                    >
                      <span className="weatherIcon">{item.icon}</span>
                      <span>
                        <strong>{item.label}</strong>
                        <em>
                          {ignored
                            ? "Not important"
                            : active
                              ? formatWeatherValue(item.key, trip.weather[item.key])
                              : `Default ${formatWeatherValue(item.key, defaultWeather[item.key])}`}
                        </em>
                      </span>
                    </button>
                  );
                  })}
                </div>
                {expandedWeather ? (
                  <WeatherEditor
                    item={weatherConfig.find((config) => config.key === expandedWeather)!}
                    ignored={isWeatherIgnored(trip, expandedWeather)}
                    value={trip.weather[expandedWeather]}
                    onIgnore={(checked) => {
                      setTrip((current) => withIgnoredWeather(current, expandedWeather, checked));
                      if (checked) {
                        setActiveWeather((current) => {
                          const next = new Set(current);
                          next.delete(expandedWeather);
                          return next;
                        });
                      }
                    }}
                    onChange={(value) => {
                      setTrip((current) => ({
                        ...withIgnoredWeather(current, expandedWeather, false),
                        weather: { ...current.weather, [expandedWeather]: value }
                      }));
                      setActiveWeather((current) => new Set(current).add(expandedWeather));
                    }}
                    onReset={() => {
                      setTrip((current) => ({
                        ...withIgnoredWeather(current, expandedWeather, false),
                        weather: { ...current.weather, [expandedWeather]: defaultWeather[expandedWeather] }
                      }));
                      setActiveWeather((current) => {
                        const next = new Set(current);
                        next.delete(expandedWeather);
                        return next;
                      });
                    }}
                  />
                ) : null}
              </div>
            </Panel>

            {validation ? (
              <div className="errorBox">
                {validation.details?.map((detail) => <p key={detail}>{detail}</p>)}
              </div>
            ) : null}

            <button className="primary" type="submit" disabled={loading || Boolean(validation)}>
              {loading ? "Finding trips..." : "Find weather-fit trips"}
            </button>
            {error ? <p className="error">{error}</p> : null}
          </form>

          <aside className="results" aria-label="Weathertrip results">
            <PlanSummary trip={trip} result={result} selected={selected} />

            {result ? (
              <>
                <div className="resultList">
                  {result.recommendations.map((recommendation) => (
                    <button
                      className={selected?.destination.id === recommendation.destination.id ? "result active" : "result"}
                      key={recommendation.destination.id}
                      type="button"
                      onClick={() => setSelected(recommendation)}
                    >
                      <div className="resultHead">
                        <DestinationThumb recommendation={recommendation} />
                        <span>
                          <strong>{recommendation.destination.name}</strong>
                          <em>{recommendation.destination.country} - {recommendation.destination.region}</em>
                        </span>
                        <b>{recommendation.score}</b>
                      </div>
                      <div className="scoreBars">
                        <ScoreBar label="Weather" value={recommendation.scoreBreakdown.weather} />
                        <ScoreBar label="Travel" value={recommendation.scoreBreakdown.travel} />
                        <ScoreBar label="Stay" value={recommendation.scoreBreakdown.accommodation} />
                      </div>
                      <p>{recommendation.why}</p>
                      <small>{recommendation.scoreBreakdown.confidence.toUpperCase()} confidence - click for plan</small>
                    </button>
                  ))}
                </div>
                {selected ? <TripPlanPanel recommendation={selected} trip={trip} /> : null}
              </>
            ) : (
              <div className="empty">
                <CloudSun size={34} />
                <p>Recommendations will appear here with a plan, forecast, travel fit, and stay suggestions.</p>
              </div>
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}

function PlanSummary({
  trip,
  result,
  selected
}: {
  trip: TripRequest;
  result: RecommendationResponse | null;
  selected: Recommendation | null;
}) {
  return (
    <section className="summary">
      <div className="panelTitle blue">
        <CalendarDays size={18} />
        <h2>Plan summary</h2>
      </div>
      <div className="summaryGrid">
        <Metric label="Trip" value={formatDays(trip.durationDays)} detail={`${trip.dateRange.start} to ${trip.dateRange.end}`} />
        <Metric label="Travel cap" value={`${formatHours(trip.maxHoursPerDay)} / day`} detail={`${trip.travelers.adults + trip.travelers.children} travelers${trip.travelers.hasEv ? ", EV" : ""}`} />
        <Metric label="Route intent" value={routeIntentLabel(trip)} detail="Preference, not a hard filter" />
        <Metric label="Best match" value={selected?.destination.name ?? "Not calculated"} detail={result ? `${selected?.score ?? 0} / 100 fit` : "Run a search first"} />
      </div>
      <p className="summarySentence">
        {result?.planSummary ??
          "Set the travel cap, stay style, optional destination or direction, then compare trips by weather fit and route practicality."}
      </p>
    </section>
  );
}

function TripPlanPanel({ recommendation, trip }: { recommendation: Recommendation; trip: TripRequest }) {
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0);
  const [showAlternativeStays, setShowAlternativeStays] = useState(false);
  const [savedStays, setSavedStays] = useState<Record<number, AccommodationSuggestion>>({});
  const displaySegments = useMemo(
    () => recommendation.itinerary.map((segment, index) => applySavedStay(segment, savedStays[index], recommendation)),
    [recommendation.itinerary, savedStays]
  );
  const displayedStays = showAlternativeStays && recommendation.alternativeAccommodationSuggestions?.length
    ? recommendation.alternativeAccommodationSuggestions
    : recommendation.accommodationSuggestions;

  useEffect(() => {
    setActiveSegmentIndex(0);
    setShowAlternativeStays(false);
    setSavedStays({});
  }, [recommendation.destination.id]);

  return (
    <section className="detail">
      <div className="detailHeader">
        <span className="detailIcon"><Route size={22} /></span>
        <div>
          <h2>{recommendation.destination.name} plan</h2>
          <p>
            {formatHours(recommendation.routeMetrics.durationHours)} - {recommendation.routeMetrics.distanceKm} km - {recommendation.routeMetrics.source === "openrouteservice" ? "real route" : "estimate"} - {recommendation.score} / 100 fit
          </p>
        </div>
      </div>

      <RouteMap
        recommendation={{ ...recommendation, itinerary: displaySegments }}
        activeSegmentIndex={activeSegmentIndex}
        onSelectSegment={setActiveSegmentIndex}
      />

      <div className="itineraryBlock">
        {displaySegments.map((segment, index) => (
          <article
            className={activeSegmentIndex === index ? "itineraryCard selected" : "itineraryCard"}
            id={`itinerary-segment-${index}`}
            key={`${segment.day}-${segment.title}`}
            onClick={() => setActiveSegmentIndex(index)}
          >
            <div className="itineraryDay">Day {segment.day}</div>
            <div>
              <h3>{segment.title}</h3>
              <p>{segment.timing}</p>
              <dl>
                <div>
                  <dt>Direction</dt>
                  <dd>{segment.direction}</dd>
                </div>
                <div>
                  <dt>Travel</dt>
                  <dd>{formatLegTravel(segment)}</dd>
                </div>
                <div>
                  <dt>Stop</dt>
                  <dd>{segment.stopName}</dd>
                </div>
                <div>
                  <dt>Why stop</dt>
                  <dd>{segment.stopReason}</dd>
                </div>
                <div>
                  <dt>Continue</dt>
                  <dd>{segment.continueAfter}</dd>
                </div>
              </dl>
              <div className="activityChips">
                {segment.activities.map((activity) => (
                  <span key={activity}>{activity}</span>
                ))}
              </div>
              {recommendation.accommodationSuggestions.length || recommendation.alternativeAccommodationSuggestions?.length ? (
                <div className="nearbyStays">
                  <strong>Browse nearby stays</strong>
                  <div className="nearbyStayList">
                    {[...recommendation.accommodationSuggestions, ...(recommendation.alternativeAccommodationSuggestions ?? [])]
                      .filter((stay) => stayFitsSegment(stay, segment))
                      .slice(0, 5)
                      .map((stay) => (
                        <button
                          type="button"
                          className={savedStays[index]?.id === stay.id ? "nearbyStay active" : "nearbyStay"}
                          key={`${index}-${stay.id}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSavedStays((current) => ({ ...current, [index]: stay }));
                            setActiveSegmentIndex(index);
                          }}
                        >
                          <span>{stay.name}</span>
                          <em>{accommodationLabels[stay.type]} - {formatHours(stay.travelHoursFromStart)}</em>
                        </button>
                      ))}
                  </div>
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      <div className="accommodationBlock">
        <div className="panelTitle yellow">
          <BedDouble size={18} />
          <h3>Stays in your travel window</h3>
        </div>
        <p className="helperText">
          Showing options around {formatHours(Math.max(0, trip.maxHoursPerDay - 0.5))}-{formatHours(trip.maxHoursPerDay + 0.5)} from your start.
        </p>
        {recommendation.accommodationFallbackNotice ? (
          <div className="stayHint">
            <p>{recommendation.accommodationFallbackNotice.message}</p>
            <button type="button" onClick={() => setShowAlternativeStays((current) => !current)}>
              {showAlternativeStays ? "Hide alternatives" : "View available stays"}
            </button>
          </div>
        ) : null}
        {displayedStays.length ? (
          <div className="stayGrid">
            {displayedStays.map((stay) => (
              <div className="stayCard" key={stay.id}>
                <span className="stayIcon">{stay.type === "hotel" || stay.type === "hostel" ? <Hotel size={17} /> : <Tent size={17} />}</span>
                <strong>{stay.name}</strong>
                <em>
                  {accommodationLabels[stay.type]} - {formatHours(stay.travelHoursFromStart)} - {stay.priceLevel}
                  {stay.rating ? ` - ${stay.rating} (${stay.userRatingCount ?? 0})` : ""}
                </em>
                <p>{stay.reason}</p>
                {stay.sourceUrl ? (
                  <a className="sourceLink" href={stay.sourceUrl} target="_blank" rel="noreferrer">
                    {stay.source ?? "Open source"}
                  </a>
                ) : stay.source ? (
                  <span className="sourceText">{stay.source}</span>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="helperText">No exact stay matches in that time band yet. Widen travel time or select more stay styles.</p>
        )}
      </div>

      <div className="forecastCard">
        <div className="forecastHeader">
          <span><CalendarDays size={16} /> Day</span>
          <span><Thermometer size={16} /> Temp</span>
          <span><CloudRain size={16} /> Rain</span>
          <span><Sun size={16} /> Sun</span>
        </div>
        {recommendation.forecast.map((day) => (
          <div className="day" key={day.date}>
            <b>{day.date.slice(5)}</b>
            <span>{formatTempRange(day.tempMinC, day.tempMaxC)}</span>
            <span>{formatMm(day.precipitationMm)}</span>
            <span>{formatHours(day.sunshineHours)}</span>
          </div>
        ))}
      </div>

      <div className="packing">
        <h3>Packing hints</h3>
        <ul>
          {recommendation.packingHints.map((hint) => <li key={hint}>{hint}</li>)}
        </ul>
      </div>
    </section>
  );
}

function WeatherEditor({
  item,
  ignored,
  value,
  onIgnore,
  onChange,
  onReset
}: {
  item: (typeof weatherConfig)[number];
  ignored: boolean;
  value: number;
  onIgnore: (checked: boolean) => void;
  onChange: (value: number) => void;
  onReset: () => void;
}) {
  return (
    <div className="weatherEditor">
      <p>{item.detail}</p>
      <strong className="weatherEditorValue">
        {ignored ? "Not important" : formatWeatherValue(item.key, value)}
      </strong>
      <label className="notImportant">
        <input
          type="checkbox"
          checked={ignored}
          onChange={(event) => onIgnore(event.target.checked)}
        />
        <span>Not important</span>
      </label>
      <input
        type="range"
        min={item.min}
        max={item.max}
        step={1}
        value={value}
        disabled={ignored}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <button type="button" className="resetButton" onClick={onReset}>
        <RotateCcw size={14} />
        Restore default
      </button>
    </div>
  );
}

function DestinationThumb({ recommendation }: { recommendation: Recommendation }) {
  const imageUrl = recommendation.destination.imageUrl;
  return (
    <span className="destinationThumb" aria-hidden="true">
      {imageUrl ? <img src={imageUrl} alt="" loading="lazy" /> : <MapPinned size={24} />}
    </span>
  );
}

function formatWeatherValue(key: WeatherKey, value: number): string {
  if (key === "tempMinC" || key === "tempMaxC") return formatTemp(value);
  if (key === "maxPrecipitationMm" && value === 0) return "Rain free";
  if (key === "maxPrecipitationMm") return formatMm(value);
  if (key === "minSunshineHours") return formatHours(value);
  return `${value} kph`;
}

function formatTemp(value: number): string {
  return `${value} °C`;
}

function formatTempRange(min: number, max: number): string {
  return `${min}-${max} °C`;
}

function formatMm(value: number): string {
  return `${value} mm`;
}

function formatHours(value: number): string {
  const totalMinutes = Math.max(0, Math.round(value * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes} min`;
  if (!minutes) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

function formatDays(value: number): string {
  return `${value} days`;
}

function calculateTripDays(start: string, end: string): number {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 1;
  const diffMs = endDate.getTime() - startDate.getTime();
  return Math.max(1, Math.round(diffMs / 86400000) + 1);
}

function roundCoordinate(value: number): number {
  return Math.round(value * 100000) / 100000;
}

function formatLegTravel(segment: ItinerarySegment): string {
  const distance = segment.distanceKm ? `, ${segment.distanceKm} km` : "";
  const label = segment.startName ? `${segment.startName} - ${segment.stopName}` : segment.stopName;
  return `${label}, est ${formatHours(segment.travelHours)}${distance}`;
}

function stayFitsSegment(stay: AccommodationSuggestion, segment: ItinerarySegment): boolean {
  if (segment.travelHours <= 0) return false;
  const start = segment.startTravelHoursFromStart ?? 0;
  const end = segment.endTravelHoursFromStart ?? start + segment.travelHours;
  return stay.travelHoursFromStart >= start - 0.4 && stay.travelHoursFromStart <= end + 0.8;
}

function applySavedStay(
  segment: ItinerarySegment,
  stay: AccommodationSuggestion | undefined,
  recommendation: Recommendation
): ItinerarySegment {
  if (!stay?.coordinates) return segment;
  const start = segment.startTravelHoursFromStart ?? 0;
  const legHours = Math.max(0, stay.travelHoursFromStart - start);
  const distanceKm = recommendation.routeMetrics.durationHours > 0
    ? Math.max(1, Math.round(recommendation.routeMetrics.distanceKm * (legHours / recommendation.routeMetrics.durationHours)))
    : segment.distanceKm;
  const remainingHours = Math.max(0, recommendation.routeMetrics.durationHours - stay.travelHoursFromStart);
  const distancePatch = distanceKm ? { distanceKm } : {};
  return {
    ...segment,
    direction: `${segment.startName ?? "Start"} - ${stay.name}, est ${formatHours(legHours)}${distanceKm ? ` and about ${distanceKm} km` : ""}.`,
    endTravelHoursFromStart: stay.travelHoursFromStart,
    ...distancePatch,
    travelHours: legHours,
    stopName: stay.name,
    stopCoordinates: stay.coordinates,
    stopReason: `Saved stay from nearby options. Data: ${stay.source ?? "accommodation provider"}.`,
    continueAfter: remainingHours > 0.2
      ? `Continue from ${stay.name} to ${recommendation.destination.name} with about ${formatHours(remainingHours)} still to go.`
      : segment.continueAfter
  };
}

function Panel({
  icon,
  title,
  tone,
  children
}: {
  icon: React.ReactNode;
  title: string;
  tone: "green" | "blue" | "yellow";
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className={`panelTitle ${tone}`}>{icon}<h2>{title}</h2></div>
      {children}
    </section>
  );
}

function Range({
  label,
  value,
  min,
  max,
  suffix,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="range">
      <span>
        <b>{label}</b>
        <em>{value}{suffix}</em>
      </span>
      <input type="range" min={min} max={max} step={1} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <span className="scoreBar">
      <em>{label}</em>
      <i><b style={{ width: `${value}%` }} /></i>
    </span>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <em>{detail}</em>
    </div>
  );
}

function routeIntentLabel(trip: TripRequest): string {
  const selectedDestination = destinations.find((destination) => destination.id === trip.destinationPreference?.destinationId);
  if (selectedDestination) return selectedDestination.name;
  if (trip.destinationPreference?.direction) return trip.destinationPreference.direction;
  return "Open";
}

function withDestinationPreference(
  trip: TripRequest,
  destinationId?: string,
  direction?: DirectionPreference
): TripRequest {
  const { destinationPreference: _destinationPreference, ...rest } = trip;
  if (!destinationId && !direction) return rest;
  return {
    ...rest,
    destinationPreference: {
      ...(destinationId ? { destinationId } : {}),
      ...(direction ? { direction } : {})
    }
  };
}

function isWeatherIgnored(trip: TripRequest, key: WeatherKey): boolean {
  return Boolean(trip.ignoredWeather?.includes(key));
}

function withIgnoredWeather(trip: TripRequest, key: WeatherKey, ignored: boolean): TripRequest {
  const ignoredWeather = new Set(trip.ignoredWeather ?? []);
  if (ignored) {
    ignoredWeather.add(key);
  } else {
    ignoredWeather.delete(key);
  }

  if (!ignoredWeather.size) {
    const { ignoredWeather: _ignoredWeather, ...rest } = trip;
    return rest;
  }

  return {
    ...trip,
    ignoredWeather: Array.from(ignoredWeather)
  };
}
