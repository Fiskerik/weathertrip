import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import type {
  ApiError,
  AccommodationTag,
  Recommendation,
  RecommendationResponse,
  TripRequest
} from "@weathertrip/shared";
import { fetchRecommendations } from "../src/api";
import { createDefaultTrip } from "../src/defaultTrip";
import { colors } from "../src/theme";

declare const require: (id: "expo-location") => typeof import("expo-location");

type TripPreset = {
  id: "sunny-city" | "camping-weather" | "low-rain-road-trip";
  label: string;
  description: string;
  patch: Pick<TripRequest, "weather" | "accommodations" | "maxHoursPerDay" | "budget">;
};

const accommodationLabels: Record<AccommodationTag, string> = {
  tent: "Tent",
  trailer: "Trailer",
  hotel: "Hotel",
  hostel: "Hostel",
  cabin: "Cabin",
  glamping: "Glamping"
};

const accommodationOptions = Object.keys(accommodationLabels) as AccommodationTag[];

const tripPresets: TripPreset[] = [
  {
    id: "sunny-city",
    label: "Sunny city break",
    description: "Warmer days, easy hotels, and plenty of daylight for wandering.",
    patch: {
      accommodations: ["hotel", "hostel"],
      maxHoursPerDay: 7,
      budget: "balanced",
      weather: {
        tempMinC: 18,
        tempMaxC: 29,
        maxPrecipitationMm: 4,
        minSunshineHours: 7,
        maxWindKph: 28
      }
    }
  },
  {
    id: "camping-weather",
    label: "Camping weather",
    description: "Dry, calm nights and mild days for tent, trailer, or cabin trips.",
    patch: {
      accommodations: ["tent", "trailer", "cabin", "glamping"],
      maxHoursPerDay: 5,
      budget: "lean",
      weather: {
        tempMinC: 14,
        tempMaxC: 25,
        maxPrecipitationMm: 2,
        minSunshineHours: 6,
        maxWindKph: 22
      }
    }
  },
  {
    id: "low-rain-road-trip",
    label: "Low-rain road trip",
    description: "Prioritizes dry days and reasonable daily driving time.",
    patch: {
      accommodations: ["hotel", "cabin", "trailer"],
      maxHoursPerDay: 6,
      budget: "balanced",
      weather: {
        tempMinC: 15,
        tempMaxC: 27,
        maxPrecipitationMm: 1.5,
        minSunshineHours: 5,
        maxWindKph: 30
      }
    }
  }
];

export default function HomeScreen() {
  const [trip, setTrip] = useState<TripRequest>(() => createDefaultTrip());
  const [result, setResult] = useState<RecommendationResponse | null>(null);
  const [selected, setSelected] = useState<Recommendation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const validation = useMemo(() => validateTripRequest(trip), [trip]);

  async function submit() {
    setError(null);
    setLoading(true);
    try {
      const next = await fetchRecommendations(trip);
      setResult(next);
      setSelected(next.recommendations[0] ?? null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load recommendations.");
    } finally {
      setLoading(false);
    }
  }

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

  async function useGpsLocation() {
    setLocationStatus("Waiting for GPS signal...");
    try {
      const Location = require("expo-location");
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setLocationStatus("Location permission was not granted.");
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });
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
    } catch {
      setLocationStatus("Could not read GPS location.");
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>Weathertrip MVP</Text>
            <Text style={styles.title}>Plan around the forecast.</Text>
          </View>
          <View style={styles.weatherBadge}>
            <Text style={styles.weatherBadgeText}>WT</Text>
          </View>
        </View>

        <View style={styles.tripPanel}>
          <SectionTitle label="Travel dates" />
          <View style={styles.dateRow}>
            <Field label="Leave">
              <TextInput
                style={styles.input}
                value={trip.dateRange.start}
                onChangeText={(start) => setDateRange({ start })}
              />
            </Field>
            <Field label="Back">
              <TextInput
                style={styles.input}
                value={trip.dateRange.end}
                onChangeText={(end) => setDateRange({ end })}
              />
            </Field>
          </View>
          <View style={styles.tripLengthSummary}>
            <Text style={styles.label}>Trip length</Text>
            <Text style={styles.valueText}>{formatUnit(trip.durationDays, "days")}</Text>
          </View>
          <View style={styles.locationRow}>
            <TextInput
              style={[styles.input, styles.locationInput]}
              value={trip.startLocation.label}
              placeholder="Start location"
              onChangeText={(label) => setTrip((current) => ({ ...current, startLocation: { label } }))}
            />
            <Pressable style={styles.secondaryButton} onPress={useGpsLocation}>
              <Text style={styles.secondaryButtonText}>GPS</Text>
            </Pressable>
          </View>
          {locationStatus ? <Text style={styles.locationHint}>{locationStatus}</Text> : null}
        </View>

        <View style={styles.advancedPanel}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: advancedOpen }}
            onPress={() => setAdvancedOpen((open) => !open)}
            style={styles.advancedHeader}
          >
            <View>
              <Text style={styles.advancedTitle}>Advanced</Text>
              <Text style={styles.advancedSummary}>
                Presets, stay style, travel limits, and weather preferences
              </Text>
            </View>
            <Text style={styles.advancedChevron}>{advancedOpen ? "^" : "v"}</Text>
          </Pressable>

          {advancedOpen ? (
            <View style={styles.advancedContent}>
              <SettingGroup label="Trip presets">
                <View style={styles.presetGrid}>
                  {tripPresets.map((preset) => (
                    <Pressable
                      key={preset.id}
                      style={styles.preset}
                      onPress={() => setTrip((current) => ({ ...current, ...preset.patch }))}
                    >
                      <Text style={styles.presetLabel}>{preset.label}</Text>
                      <Text style={styles.presetText}>{preset.description}</Text>
                    </Pressable>
                  ))}
                </View>
              </SettingGroup>

              <SettingGroup label="Travel limits">
                <View style={styles.segmentRow}>
                  <Segment label="Car" active />
                  <Segment label="Train soon" />
                  <Segment label="Flight soon" />
                </View>
                <NumberStepper
                  label="Max travel per day"
                  value={trip.maxHoursPerDay}
                  min={1}
                  max={12}
                  suffix="h"
                  onChange={(maxHoursPerDay) => setTrip((current) => ({ ...current, maxHoursPerDay }))}
                />
                <View style={styles.dateRow}>
                  <Field label="Min stay">
                    <TextInput
                      keyboardType="number-pad"
                      style={styles.input}
                      value={String(trip.minStayDays)}
                      onChangeText={(value) =>
                        setTrip((current) => ({ ...current, minStayDays: Number(value) || 1 }))
                      }
                    />
                  </Field>
                  <Field label="Max stay">
                    <TextInput
                      keyboardType="number-pad"
                      style={styles.input}
                      value={String(trip.maxStayDays)}
                      onChangeText={(value) =>
                        setTrip((current) => ({ ...current, maxStayDays: Number(value) || 1 }))
                      }
                    />
                  </Field>
                </View>
              </SettingGroup>

              <SettingGroup label="Stay style">
                <View style={styles.chips}>
                  {accommodationOptions.map((tag) => {
                    const active = trip.accommodations.includes(tag);
                    return (
                      <Pressable
                        key={tag}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() =>
                          setTrip((current) => ({
                            ...current,
                            accommodations: active
                              ? current.accommodations.filter((item) => item !== tag)
                              : [...current.accommodations, tag]
                          }))
                        }
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {accommodationLabels[tag]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </SettingGroup>

              <SettingGroup label="Weather preferences">
                <NumberStepper
                  label="Minimum temp"
                  value={trip.weather.tempMinC}
                  min={4}
                  max={28}
                  suffix="C"
                  onChange={(tempMinC) =>
                    setTrip((current) => ({ ...current, weather: { ...current.weather, tempMinC } }))
                  }
                />
                <NumberStepper
                  label="Maximum temp"
                  value={trip.weather.tempMaxC}
                  min={10}
                  max={36}
                  suffix="C"
                  onChange={(tempMaxC) =>
                    setTrip((current) => ({ ...current, weather: { ...current.weather, tempMaxC } }))
                  }
                />
                <NumberStepper
                  label="Max rain"
                  value={trip.weather.maxPrecipitationMm}
                  min={0}
                  max={12}
                  suffix="mm"
                  onChange={(maxPrecipitationMm) =>
                    setTrip((current) => ({
                      ...current,
                      weather: { ...current.weather, maxPrecipitationMm }
                    }))
                  }
                />
                <NumberStepper
                  label="Sunshine"
                  value={trip.weather.minSunshineHours}
                  min={1}
                  max={12}
                  suffix="h"
                  onChange={(minSunshineHours) =>
                    setTrip((current) => ({ ...current, weather: { ...current.weather, minSunshineHours } }))
                  }
                />
                <NumberStepper
                  label="Wind tolerance"
                  value={trip.weather.maxWindKph}
                  min={10}
                  max={55}
                  suffix="kph"
                  onChange={(maxWindKph) =>
                    setTrip((current) => ({ ...current, weather: { ...current.weather, maxWindKph } }))
                  }
                />
              </SettingGroup>
            </View>
          ) : null}
        </View>

        {validation ? (
          <View style={styles.errorBox}>
            {validation.details?.map((detail) => (
              <Text key={detail} style={styles.errorText}>{detail}</Text>
            ))}
          </View>
        ) : null}

        <Pressable
          style={[styles.primaryButton, (loading || validation) && styles.primaryButtonDisabled]}
          disabled={loading || Boolean(validation)}
          onPress={submit}
        >
          {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryText}>Find weather-fit trips</Text>}
        </Pressable>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {result ? (
          <View style={styles.results}>
            <View style={styles.summaryCard}>
              <SectionTitle label="Plan summary" />
              <Text style={styles.summaryText}>{result.planSummary}</Text>
            </View>

            {result.recommendations.map((recommendation) => (
              <Pressable
                key={recommendation.destination.id}
                style={[
                  styles.resultCard,
                  selected?.destination.id === recommendation.destination.id && styles.resultCardActive
                ]}
                onPress={() => setSelected(recommendation)}
              >
                <View style={styles.resultHeader}>
                  {recommendation.destination.imageUrl ? (
                    <Image
                      source={{ uri: recommendation.destination.imageUrl }}
                      style={styles.destinationThumb}
                    />
                  ) : null}
                  <View style={styles.resultTextBlock}>
                    <Text style={styles.resultTitle}>{recommendation.destination.name}</Text>
                    <Text style={styles.resultMeta}>
                      {recommendation.destination.country} - {recommendation.destination.region}
                    </Text>
                  </View>
                  <View style={styles.scorePill}>
                    <Text style={styles.scoreText}>{recommendation.score}</Text>
                  </View>
                </View>
                <Text style={styles.why}>{recommendation.why}</Text>
                <Text style={styles.confidence}>
                  {recommendation.scoreBreakdown.confidence.toUpperCase()} confidence
                </Text>
              </Pressable>
            ))}

            {selected ? <DestinationDetail recommendation={selected} /> : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function DestinationDetail({ recommendation }: { recommendation: Recommendation }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.detailTitle}>{recommendation.destination.name} forecast</Text>
      {recommendation.forecast.map((day) => (
        <View key={day.date} style={styles.dayRow}>
          <Text style={styles.dayDate}>{day.date.slice(5)}</Text>
          <Text style={styles.dayText}>
            {day.tempMinC}-{day.tempMaxC} C, {day.precipitationMm} mm, {day.sunshineHours} h sun
          </Text>
        </View>
      ))}
      <Text style={styles.detailTitle}>Packing hints</Text>
      {recommendation.packingHints.map((hint) => (
        <Text key={hint} style={styles.hint}>- {hint}</Text>
      ))}
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function SettingGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.settingGroup}>
      <Text style={styles.settingTitle}>{label}</Text>
      {children}
    </View>
  );
}

function validateTripRequest(request: TripRequest): ApiError | null {
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

function NumberStepper({
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
  const decrement = () => onChange(Math.max(min, value - 1));
  const increment = () => onChange(Math.min(max, value + 1));

  return (
    <View style={styles.sliderBlock}>
      <View style={styles.sliderLabelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.valueText}>{formatUnit(value, suffix)}</Text>
      </View>
      <View style={styles.stepperRow}>
        <Pressable
          accessibilityRole="button"
          disabled={value <= min}
          onPress={decrement}
          style={[styles.stepperButton, value <= min && styles.stepperButtonDisabled]}
        >
          <Text style={styles.stepperButtonText}>-</Text>
        </Pressable>
        <View style={styles.stepperTrack}>
          <View
            style={[
              styles.stepperFill,
              { width: `${((value - min) / Math.max(1, max - min)) * 100}%` }
            ]}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={value >= max}
          onPress={increment}
          style={[styles.stepperButton, value >= max && styles.stepperButtonDisabled]}
        >
          <Text style={styles.stepperButtonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function SectionTitle({ label }: { label: string }) {
  return (
    <View style={styles.sectionTitle}>
      <View style={styles.sectionDot} />
      <Text style={styles.sectionTitleText}>{label}</Text>
    </View>
  );
}

function Segment({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <View style={[styles.segment, active && styles.segmentActive]}>
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </View>
  );
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

function formatUnit(value: number, suffix: string): string {
  return `${value} ${suffix}`;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.paper
  },
  page: {
    gap: 12,
    padding: 16,
    paddingBottom: 34
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4
  },
  kicker: {
    color: colors.green,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  title: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 0,
    lineHeight: 31,
    maxWidth: 245
  },
  weatherBadge: {
    alignItems: "center",
    backgroundColor: colors.blueSoft,
    borderRadius: 8,
    height: 48,
    justifyContent: "center",
    width: 48
  },
  weatherBadgeText: {
    color: colors.blue,
    fontSize: 15,
    fontWeight: "900"
  },
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 14
  },
  tripPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 14
  },
  advancedPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden"
  },
  advancedHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    minHeight: 58,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  advancedTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900"
  },
  advancedSummary: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
    maxWidth: 260,
    marginTop: 2
  },
  advancedChevron: {
    color: colors.green,
    fontSize: 18,
    fontWeight: "900"
  },
  advancedContent: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    gap: 16,
    padding: 14,
    paddingTop: 12
  },
  settingGroup: {
    gap: 10
  },
  settingTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900"
  },
  sectionTitle: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  sectionDot: {
    backgroundColor: colors.green,
    borderRadius: 5,
    height: 10,
    width: 10
  },
  sectionTitleText: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "800"
  },
  input: {
    backgroundColor: "#fbfaf7",
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 15,
    minHeight: 44,
    paddingHorizontal: 12
  },
  locationRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  locationInput: {
    flex: 1
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: colors.blueSoft,
    borderColor: "#b8d3e3",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 62,
    paddingHorizontal: 10
  },
  secondaryButtonText: {
    color: colors.blue,
    fontSize: 13,
    fontWeight: "900"
  },
  locationHint: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17
  },
  tripLengthSummary: {
    alignItems: "center",
    backgroundColor: "#fbfaf7",
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 46,
    paddingHorizontal: 12
  },
  row: {
    flexDirection: "row",
    gap: 10
  },
  dateRow: {
    flexDirection: "row",
    gap: 10
  },
  field: {
    flex: 1,
    gap: 6
  },
  label: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700"
  },
  sliderBlock: {
    gap: 8
  },
  sliderLabelRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  valueText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800"
  },
  stepperRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 9,
    minHeight: 36
  },
  stepperButton: {
    alignItems: "center",
    backgroundColor: colors.green,
    borderRadius: 8,
    height: 34,
    justifyContent: "center",
    width: 40
  },
  stepperButtonDisabled: {
    opacity: 0.35
  },
  stepperButtonText: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 22
  },
  stepperTrack: {
    backgroundColor: colors.line,
    borderRadius: 8,
    flex: 1,
    height: 10,
    overflow: "hidden"
  },
  stepperFill: {
    backgroundColor: colors.green,
    height: "100%"
  },
  presetGrid: {
    gap: 8
  },
  preset: {
    backgroundColor: "#fbfaf7",
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    padding: 11
  },
  presetLabel: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800"
  },
  presetText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3
  },
  segmentRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  segment: {
    backgroundColor: "#f2f0ea",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9
  },
  segmentActive: {
    backgroundColor: colors.green
  },
  segmentText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800"
  },
  segmentTextActive: {
    color: "#ffffff"
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  chip: {
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 9
  },
  chipActive: {
    backgroundColor: colors.green,
    borderColor: colors.green
  },
  chipText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800"
  },
  chipTextActive: {
    color: "#ffffff"
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.ink,
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 52
  },
  primaryButtonDisabled: {
    opacity: 0.45
  },
  primaryText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900"
  },
  errorBox: {
    backgroundColor: "#fcebe6",
    borderColor: "#e1b1a4",
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    padding: 12
  },
  errorText: {
    color: colors.coral,
    fontSize: 14,
    fontWeight: "700"
  },
  results: {
    gap: 12
  },
  summaryCard: {
    backgroundColor: colors.blueSoft,
    borderColor: "#b8d3e3",
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 14
  },
  summaryText: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 21
  },
  resultCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 14
  },
  resultCardActive: {
    borderColor: colors.green,
    borderWidth: 2
  },
  resultHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12
  },
  destinationThumb: {
    backgroundColor: colors.greenSoft,
    borderRadius: 8,
    height: 62,
    width: 82
  },
  resultTextBlock: {
    flex: 1
  },
  resultTitle: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: "900"
  },
  resultMeta: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 2
  },
  scorePill: {
    alignItems: "center",
    backgroundColor: colors.yellow,
    borderRadius: 8,
    minWidth: 42,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  scoreText: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900"
  },
  why: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20
  },
  confidence: {
    color: colors.blue,
    fontSize: 12,
    fontWeight: "900"
  },
  detail: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 14
  },
  detailTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
    marginTop: 2
  },
  dayRow: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    paddingVertical: 8
  },
  dayDate: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800"
  },
  dayText: {
    color: colors.ink,
    flex: 1,
    fontSize: 13,
    textAlign: "right"
  },
  hint: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20
  }
});
