import { useMemo, useState } from "react";
import * as Location from "expo-location";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import Slider from "@react-native-community/slider";
import { SafeAreaView } from "react-native-safe-area-context";
import { CalendarDays, Car, CloudSun, LocateFixed, MapPin, Navigation, Tent, Wind } from "lucide-react-native";
import {
  accommodationLabels,
  tripPresets,
  validateTripRequest,
  type AccommodationTag,
  type Recommendation,
  type RecommendationResponse,
  type TripRequest
} from "@weathertrip/shared";
import { fetchRecommendations } from "../src/api";
import { createDefaultTrip } from "../src/defaultTrip";
import { colors } from "../src/theme";

const accommodationOptions = Object.keys(accommodationLabels) as AccommodationTag[];

export default function HomeScreen() {
  const [trip, setTrip] = useState<TripRequest>(() => createDefaultTrip());
  const [result, setResult] = useState<RecommendationResponse | null>(null);
  const [selected, setSelected] = useState<Recommendation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);
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
            <CloudSun size={22} color={colors.blue} />
          </View>
        </View>

        <View style={styles.panel}>
          <SectionTitle icon={<MapPin size={18} color={colors.green} />} label="Start and dates" />
          <View style={styles.locationRow}>
            <TextInput
              style={[styles.input, styles.locationInput]}
              value={trip.startLocation.label}
              placeholder="Start location"
              onChangeText={(label) => setTrip((current) => ({ ...current, startLocation: { label } }))}
            />
            <Pressable style={styles.secondaryButton} onPress={useGpsLocation}>
              <LocateFixed size={16} color={colors.blue} />
              <Text style={styles.secondaryButtonText}>Use GPS</Text>
            </Pressable>
          </View>
          {locationStatus ? <Text style={styles.locationHint}>{locationStatus}</Text> : null}
          <View style={styles.row}>
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
        </View>

        <View style={styles.panel}>
          <SectionTitle icon={<Navigation size={18} color={colors.green} />} label="Trip presets" />
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
        </View>

        <View style={styles.panel}>
          <SectionTitle icon={<Car size={18} color={colors.green} />} label="Travel limits" />
          <View style={styles.segmentRow}>
            <Segment label="Car" active />
            <Segment label="Train soon" />
            <Segment label="Flight soon" />
          </View>
          <NumberSlider
            label="Max travel per day"
            value={trip.maxHoursPerDay}
            min={1}
            max={12}
            suffix="h"
            onChange={(maxHoursPerDay) => setTrip((current) => ({ ...current, maxHoursPerDay }))}
          />
          <View style={styles.row}>
            <Field label="Min stay (days)">
              <TextInput
                keyboardType="number-pad"
                style={styles.input}
                value={String(trip.minStayDays)}
                onChangeText={(value) =>
                  setTrip((current) => ({ ...current, minStayDays: Number(value) || 1 }))
                }
              />
            </Field>
            <Field label="Max stay (days)">
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
        </View>

        <View style={styles.panel}>
          <SectionTitle icon={<Tent size={18} color={colors.green} />} label="Stay style" />
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
        </View>

        <View style={styles.panel}>
          <SectionTitle icon={<Wind size={18} color={colors.green} />} label="Weather preferences" />
          <NumberSlider
            label="Minimum temp"
            value={trip.weather.tempMinC}
            min={4}
            max={28}
            suffix="°C"
            onChange={(tempMinC) =>
              setTrip((current) => ({ ...current, weather: { ...current.weather, tempMinC } }))
            }
          />
          <NumberSlider
            label="Maximum temp"
            value={trip.weather.tempMaxC}
            min={10}
            max={36}
            suffix="°C"
            onChange={(tempMaxC) =>
              setTrip((current) => ({ ...current, weather: { ...current.weather, tempMaxC } }))
            }
          />
          <NumberSlider
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
          <NumberSlider
            label="Sunshine"
            value={trip.weather.minSunshineHours}
            min={1}
            max={12}
            suffix="h"
            onChange={(minSunshineHours) =>
              setTrip((current) => ({ ...current, weather: { ...current.weather, minSunshineHours } }))
            }
          />
          <NumberSlider
            label="Wind tolerance"
            value={trip.weather.maxWindKph}
            min={10}
            max={55}
            suffix="kph"
            onChange={(maxWindKph) =>
              setTrip((current) => ({ ...current, weather: { ...current.weather, maxWindKph } }))
            }
          />
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
              <SectionTitle icon={<CalendarDays size={18} color={colors.blue} />} label="Plan summary" />
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
            {day.tempMinC}-{day.tempMaxC} °C, {day.precipitationMm} mm, {day.sunshineHours} h sun
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

function NumberSlider({
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
    <View style={styles.sliderBlock}>
      <View style={styles.sliderLabelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.valueText}>{formatUnit(value, suffix)}</Text>
      </View>
      <Slider
        value={value}
        minimumValue={min}
        maximumValue={max}
        step={1}
        minimumTrackTintColor={colors.green}
        maximumTrackTintColor={colors.line}
        thumbTintColor={colors.green}
        onValueChange={onChange}
      />
    </View>
  );
}

function SectionTitle({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View style={styles.sectionTitle}>
      {icon}
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
    gap: 14,
    padding: 18,
    paddingBottom: 34
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2
  },
  kicker: {
    color: colors.green,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  title: {
    color: colors.ink,
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: 0,
    lineHeight: 36,
    maxWidth: 280
  },
  weatherBadge: {
    alignItems: "center",
    backgroundColor: colors.blueSoft,
    borderRadius: 8,
    height: 48,
    justifyContent: "center",
    width: 48
  },
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 14
  },
  sectionTitle: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8
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
    fontSize: 16,
    minHeight: 46,
    paddingHorizontal: 12
  },
  locationRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10
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
    minHeight: 46,
    paddingHorizontal: 11
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
    gap: 4
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
  presetGrid: {
    gap: 10
  },
  preset: {
    backgroundColor: colors.greenSoft,
    borderColor: "#b9dccb",
    borderRadius: 8,
    borderWidth: 1,
    padding: 12
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
