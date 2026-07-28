import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useFocusEffect, useNavigation, type NavigationProp } from "@react-navigation/native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Location from "expo-location";
import * as Linking from "expo-linking";
import {
  ArrowLeft,
  BedDouble,
  Car,
  Check,
  ChevronDown,
  ChevronRight,
  CloudRain,
  Compass,
  Edit3,
  Gauge,
  Globe2,
  Heart,
  Landmark,
  Map as MapIcon,
  MapPin,
  MapPinned,
  Minus,
  Plus,
  RefreshCw,
  Route,
  Save,
  Settings2,
  ShieldCheck,
  Sun,
  ThermometerSun,
  Trash2,
  UserRound,
  UsersRound,
  Wind,
  type LucideIcon
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import * as React from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from "react-native";
import MapView, { Marker, Polyline, type Region } from "react-native-maps";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import type {
  AccommodationTag,
  BorderRule,
  PlanResponse,
  SavedTrip,
  TemperatureComfort,
  TripBrief,
  TripPlan,
  UserProfile,
  WeatherGoal
} from "@weathertrip/shared";
import { planningDestinations } from "@weathertrip/shared";
import type { RootStackParamList } from "./App";
import {
  createSavedTrip,
  deleteProfile,
  deleteSavedTrip,
  fetchPlans,
  fetchProfile,
  fetchSavedTrips,
  renameSavedTrip,
  updateProfile
} from "./api";
import { supabase } from "./supabase";
import { loadLocalTrips, removeLocalTrip, saveLocalTrip } from "./storage";
import { colors } from "./theme";

const accommodationOptions: Array<{ id: AccommodationTag; label: string; icon: LucideIcon }> = [
  { id: "hotel", label: "Hotel", icon: BedDouble },
  { id: "hostel", label: "Hostel", icon: UsersRound },
  { id: "cabin", label: "Cabin", icon: Landmark },
  { id: "tent", label: "Camping", icon: Compass }
];

const goalOptions: Array<{ id: WeatherGoal; label: string; detail: string; icon: LucideIcon }> = [
  { id: "sunny", label: "Sunniest", detail: "More daylight", icon: Sun },
  { id: "dry", label: "Driest", detail: "Less rain", icon: CloudRain },
  { id: "warm", label: "Warm", detail: "Comfortable heat", icon: ThermometerSun },
  { id: "cool", label: "Cool", detail: "Milder days", icon: Wind },
  { id: "balanced", label: "Balanced", detail: "A little of everything", icon: Compass }
];

const defaultStart = { label: "Stockholm", country: "Sweden", coordinates: { latitude: 59.3293, longitude: 18.0686 } };

export function PlanScreen() {
  const [brief, setBrief] = useState<TripBrief>(() => createBrief());
  const [result, setResult] = useState<PlanResponse | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<TripPlan | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [locationQuery, setLocationQuery] = useState(defaultStart.label);
  const [showDates, setShowDates] = useState<"start" | "end" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const suggestions = useMemo(() => {
    const query = locationQuery.trim().toLowerCase();
    if (!query) return [];
    return planningDestinations.filter((destination) => `${destination.name} ${destination.country}`.toLowerCase().includes(query)).slice(0, 5);
  }, [locationQuery]);

  async function generate() {
    setError(null);
    setSaved(false);
    setLoading(true);
    try {
      const next = await fetchPlans(brief);
      setResult(next);
      setSelectedPlan(next.primaryPlan);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not build that route.");
    } finally {
      setLoading(false);
    }
  }

  async function useGps() {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setError("Location permission was not granted. You can still search for a city.");
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const reverse = await Location.reverseGeocodeAsync(position.coords);
      const place = reverse[0];
      const label = place?.city ?? place?.district ?? "Current location";
      setLocationQuery(label);
      setBrief((current) => ({
        ...current,
        startLocation: {
          label,
          country: place?.country ?? current.startLocation.country,
          coordinates: { latitude: position.coords.latitude, longitude: position.coords.longitude }
        }
      }));
    } catch {
      setError("Could not read your location. Search for a city instead.");
    }
  }

  function selectLocation(label: string, country: string, coordinates: { latitude: number; longitude: number }) {
    setLocationQuery(label);
    setBrief((current) => ({ ...current, startLocation: { label, country, coordinates } }));
  }

  async function savePlan() {
    if (!selectedPlan) return;
    const now = new Date().toISOString();
    const localTrip: SavedTrip = {
      id: `local-${Date.now()}`,
      title: selectedPlan.title,
      brief,
      plan: selectedPlan,
      createdAt: now,
      updatedAt: now,
      source: "local"
    };
    await saveLocalTrip(localTrip);
    const session = (await supabase.auth.getSession()).data.session;
    if (session) {
      try {
        await createSavedTrip(selectedPlan.title, brief, selectedPlan);
      } catch {
        setError("Saved on this device. Cloud sync will retry after your account reconnects.");
      }
    }
    setSaved(true);
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.topBar}>
          <View>
            <Text style={styles.eyebrow}>WEATHERTRIP</Text>
            <Text style={styles.title}>Find your next good-weather route.</Text>
          </View>
          <BrandMark />
        </View>

        <View style={styles.section}>
          <SectionHeading icon={MapPin} label="When and from where" />
          <View style={styles.locationLine}>
            <View style={styles.locationInputWrap}>
              <MapPin size={18} color={colors.green} />
              <TextInput
                value={locationQuery}
                onChangeText={(value) => {
                  setLocationQuery(value);
                  setBrief((current) => ({ ...current, startLocation: { ...current.startLocation, label: value } }));
                }}
                placeholder="Start city"
                placeholderTextColor={colors.muted}
                style={styles.locationInput}
                accessibilityLabel="Start city"
              />
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Use current location" style={styles.iconButton} onPress={useGps}>
              <Compass size={19} color={colors.green} />
            </Pressable>
          </View>
          {suggestions.length ? (
            <View style={styles.suggestions}>
              {suggestions.map((suggestion) => (
                <Pressable key={suggestion.id} style={styles.suggestion} onPress={() => selectLocation(suggestion.name, suggestion.country, suggestion.coordinates)}>
                  <MapPin size={16} color={colors.green} />
                  <Text style={styles.suggestionText}>{suggestion.name}, {suggestion.country}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <View style={styles.dateLine}>
            <DateButton label="Leave" value={brief.dateRange.start} onPress={() => setShowDates("start")} />
            <DateButton label="Back" value={brief.dateRange.end} onPress={() => setShowDates("end")} />
          </View>
          <View style={styles.durationLine}><Text style={styles.muted}>Trip length</Text><Text style={styles.strong}>{brief.durationDays} days</Text></View>
        </View>

        <View style={styles.section}>
          <SectionHeading icon={Sun} label="What matters most?" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.goalRow}>
            {goalOptions.map((goal) => <ChoiceTile key={goal.id} selected={brief.weatherGoal === goal.id} icon={goal.icon} label={goal.label} detail={goal.detail} onPress={() => setBrief((current) => ({ ...current, weatherGoal: goal.id }))} />)}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <SectionHeading icon={Car} label="How should the route feel?" />
          <Text style={styles.controlLabel}>Maximum driving per day</Text>
          <ChoiceRow values={[4, 6, 8]} selected={brief.maxDriveHoursPerDay} suffix=" h" onSelect={(value) => setBrief((current) => ({ ...current, maxDriveHoursPerDay: value }))} />
          <Text style={styles.controlLabel}>Places to discover</Text>
          <ChoiceRow values={["smart", 1, 2, 3, 4]} selected={brief.placeCount} labels={{ smart: "Smart" }} onSelect={(value) => setBrief((current) => ({ ...current, placeCount: value as TripBrief["placeCount"] }))} />
          <Text style={styles.controlLabel}>Borders</Text>
          <ChoiceRow values={["anywhere", "leave-country", "stay-country"]} selected={brief.borderRule} labels={{ anywhere: "Anywhere", "leave-country": "Leave country", "stay-country": "Stay home" }} onSelect={(value) => setBrief((current) => ({ ...current, borderRule: value as BorderRule }))} />
        </View>

        <View style={styles.section}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: advancedOpen }} style={styles.advancedHeader} onPress={() => setAdvancedOpen((current) => !current)}>
            <View style={styles.advancedIcon}><Settings2 size={19} color={colors.blue} /></View>
            <View style={styles.flex}><Text style={styles.advancedTitle}>Advanced</Text><Text style={styles.advancedSummary}>{advancedSummary(brief)}</Text></View>
            <ChevronDown size={21} color={colors.muted} style={advancedOpen ? styles.rotated : undefined} />
          </Pressable>
          {advancedOpen ? <AdvancedEditor brief={brief} setBrief={setBrief} /> : null}
        </View>

        {showDates ? <DateTimePicker value={parseDate(showDates === "start" ? brief.dateRange.start : brief.dateRange.end)} mode="date" minimumDate={showDates === "end" ? parseDate(brief.dateRange.start) : undefined} onChange={(event, date) => onDateChange(event, date, showDates, brief, setBrief, setShowDates)} /> : null}
        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}

        <Pressable accessibilityRole="button" style={[styles.primaryButton, loading && styles.disabled]} disabled={loading} onPress={generate}>
          {loading ? <ActivityIndicator color={colors.surface} /> : <><Route size={20} color={colors.surface} /><Text style={styles.primaryText}>Find my route</Text></>}
        </Pressable>

        {selectedPlan ? <PlanResult plan={selectedPlan} alternatives={(result ? [result.primaryPlan, ...result.alternatives] : []).filter((candidate) => candidate.id !== selectedPlan.id)} onSelect={setSelectedPlan} onSave={savePlan} saved={saved} /> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function TripsScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [trips, setTrips] = useState<SavedTrip[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const local = await loadLocalTrips();
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) {
      setTrips(local);
      setLoading(false);
      return;
    }
    try {
      setTrips(await fetchSavedTrips());
    } catch {
      setTrips(local);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <ScreenHeader title="Saved trips" subtitle="Your plans, ready when you are." />
      {loading ? <ActivityIndicator color={colors.green} /> : null}
      {!loading && !trips.length ? <EmptyState icon={MapPinned} title="No saved trips yet" detail="Build a route on Plan and tap Save when it feels right." /> : null}
      {trips.map((trip) => <Pressable key={trip.id} style={styles.tripRow} onPress={() => navigation.navigate("SavedTrip", { tripId: trip.id })}>
        <View style={styles.tripRowIcon}><MapPinned size={20} color={colors.green} /></View>
        <View style={styles.flex}><Text style={styles.tripRowTitle}>{trip.title}</Text><Text style={styles.tripRowMeta}>{trip.brief.dateRange.start} - {trip.brief.dateRange.end} · {trip.plan.stops.length} places</Text></View>
        <ChevronRight size={20} color={colors.muted} />
      </Pressable>)}
    </ScrollView>
  );
}

export function SavedTripScreen({ route, navigation }: { route: { params: { tripId: string } }; navigation: NavigationProp<RootStackParamList> }) {
  const [trip, setTrip] = useState<SavedTrip | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const local = (await loadLocalTrips()).find((item) => item.id === route.params.tripId);
      if (local) { setTrip(local); return; }
      try { setTrip((await fetchSavedTrips()).find((item) => item.id === route.params.tripId) ?? null); } catch { setError("Could not load this saved trip."); }
    })();
  }, [route.params.tripId]);

  async function rename() {
    if (!trip) return;
    Alert.prompt("Rename trip", "Give this route a name", async (title) => {
      if (!title?.trim()) return;
      if (trip.source === "local") {
        const next = { ...trip, title: title.trim(), updatedAt: new Date().toISOString() };
        await saveLocalTrip(next);
        setTrip(next);
      } else {
        setTrip(await renameSavedTrip(trip.id, title.trim()));
      }
    });
  }

  async function remove() {
    if (!trip) return;
    if (trip.source === "local") await removeLocalTrip(trip.id); else await deleteSavedTrip(trip.id);
    navigation.goBack();
  }

  if (!trip) return <View style={styles.center}><ActivityIndicator color={colors.green} />{error ? <Text style={styles.errorText}>{error}</Text> : null}</View>;
  return <ScrollView contentContainerStyle={styles.page}><Pressable style={styles.backButton} onPress={() => navigation.goBack()}><ArrowLeft size={19} color={colors.ink} /><Text style={styles.backText}>Saved trips</Text></Pressable><ScreenHeader title={trip.title} subtitle={`${trip.brief.dateRange.start} - ${trip.brief.dateRange.end}`} /><PlanResult plan={trip.plan} alternatives={[]} onSelect={() => undefined} onSave={() => undefined} saved /><View style={styles.actionRow}><ActionButton icon={Edit3} label="Rename" onPress={rename} /><ActionButton icon={Trash2} label="Delete" tone="danger" onPress={remove} /></View></ScrollView>;
}

export function ProfileScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);

  const loadProfile = useCallback(async () => {
    const session = (await supabase.auth.getSession()).data.session;
    setSessionEmail(session?.user.email ?? null);
    if (session) {
      try { setProfile(await fetchProfile()); } catch { setProfile(null); }
    } else setProfile(null);
  }, []);

  useFocusEffect(useCallback(() => { void loadProfile(); }, [loadProfile]));
  useEffect(() => { void AppleAuthentication.isAvailableAsync().then(setAppleAvailable); }, []);

  async function signInApple() {
    try {
      const credential = await AppleAuthentication.signInAsync({ requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL, AppleAuthentication.AppleAuthenticationScope.FULL_NAME] });
      if (!credential.identityToken) throw new Error("Apple did not return an identity token.");
      const { error } = await supabase.auth.signInWithIdToken({ provider: "apple", token: credential.identityToken });
      if (error) throw error;
      setMessage("Signed in successfully.");
      await loadProfile();
    } catch (caught) { setMessage(caught instanceof Error ? caught.message : "Apple sign-in was cancelled."); }
  }

  async function signInEmail() {
    if (!email.trim()) { setMessage("Enter your email address first."); return; }
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: Linking.createURL("auth/callback") } });
    setMessage(error ? error.message : "Check your email for the sign-in link.");
  }

  async function signOut() { await supabase.auth.signOut(); setSessionEmail(null); setProfile(null); setMessage("Signed out."); }

  async function saveSettings(next: Partial<UserProfile>) {
    const nextProfile = { ...(profile ?? defaultProfile("")), ...next };
    setProfile(nextProfile);
    try { setProfile(await updateProfile(nextProfile)); } catch { setMessage("Settings saved on this device, but cloud sync is unavailable."); }
  }

  async function removeAccount() {
    Alert.alert("Delete account?", "This removes your cloud profile and saved trips.", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: async () => { try { await deleteProfile(); await supabase.auth.signOut(); setProfile(null); setSessionEmail(null); } catch { setMessage("Could not delete the account."); } } }]);
  }

  return <ScrollView contentContainerStyle={styles.page}><ScreenHeader title="Profile" subtitle="Defaults that make planning faster." />
    {!sessionEmail ? <View style={styles.signInPanel}><View style={styles.avatar}><UserRound size={23} color={colors.green} /></View><Text style={styles.panelTitle}>Save plans across devices</Text><Text style={styles.panelText}>You can plan and save locally without an account. Sign in when you want cloud sync.</Text>{appleAvailable ? <AppleAuthentication.AppleAuthenticationButton buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE} buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK} cornerRadius={10} style={styles.appleButton} onPress={signInApple} /> : null}<TextInput value={email} onChangeText={setEmail} placeholder="Email address" placeholderTextColor={colors.muted} autoCapitalize="none" keyboardType="email-address" style={styles.textInput} /><Pressable style={styles.secondaryButton} onPress={signInEmail}><Text style={styles.secondaryText}>Email me a sign-in link</Text></Pressable></View> : <View style={styles.profileHeader}><View style={styles.avatar}><ShieldCheck size={23} color={colors.green} /></View><View><Text style={styles.panelTitle}>Signed in</Text><Text style={styles.muted}>{sessionEmail}</Text></View></View>}
    {profile ? <View style={styles.section}><SectionHeading icon={Settings2} label="Planning defaults" /><SettingStepper label="Adults" value={profile.defaultAdults} min={1} max={8} onChange={(value) => void saveSettings({ defaultAdults: value })} /><SettingStepper label="Children" value={profile.defaultChildren} min={0} max={8} onChange={(value) => void saveSettings({ defaultChildren: value })} /><SettingStepper label="Driving limit" value={profile.defaultMaxDriveHours} min={2} max={10} suffix=" h" onChange={(value) => void saveSettings({ defaultMaxDriveHours: value })} /><View style={styles.settingRow}><Text style={styles.settingLabel}>Electric car</Text><Switch value={profile.defaultHasEv} onValueChange={(value) => void saveSettings({ defaultHasEv: value })} trackColor={{ false: colors.line, true: colors.greenSoft }} thumbColor={profile.defaultHasEv ? colors.green : colors.muted} /></View><Text style={styles.controlLabel}>Units</Text><ChoiceRow values={["metric", "imperial"]} selected={profile.units} labels={{ metric: "Metric", imperial: "Imperial" }} onSelect={(value) => void saveSettings({ units: value as UserProfile["units"] })} /></View> : null}
    {message ? <Text style={styles.statusText}>{message}</Text> : null}
    {sessionEmail ? <View style={styles.section}><ActionButton icon={MapIcon} label="Open saved trips" onPress={() => navigation.navigate("Tabs", { screen: "Trips" })} /><ActionButton icon={ShieldCheck} label="Sign out" onPress={signOut} /><ActionButton icon={Trash2} label="Delete account" tone="danger" onPress={removeAccount} /></View> : null}
  </ScrollView>;
}

function PlanResult({ plan, alternatives, onSelect, onSave, saved }: { plan: TripPlan; alternatives: TripPlan[]; onSelect: (plan: TripPlan) => void; onSave: () => void; saved: boolean }) {
  const allPlans = [plan, ...alternatives];
  const region: Region = { latitude: plan.stops[0]?.destination.coordinates.latitude ?? 59.33, longitude: plan.stops[0]?.destination.coordinates.longitude ?? 18.07, latitudeDelta: 12, longitudeDelta: 12 };
  const routeCoordinates = plan.legs.flatMap((leg) => leg.routePath);
  return <View style={styles.results}><View style={styles.resultHeader}><View style={styles.flex}><Text style={styles.resultEyebrow}>BEST ROUTE · {plan.score}/100 FIT</Text><Text style={styles.resultTitle}>{plan.title}</Text><Text style={styles.resultSummary}>{plan.summary}</Text></View><Pressable accessibilityLabel={saved ? "Trip saved" : "Save trip"} style={[styles.saveButton, saved && styles.saveButtonActive]} onPress={onSave}><Save size={18} color={saved ? colors.surface : colors.green} /></Pressable></View>
    <MapView style={styles.map} initialRegion={region} scrollEnabled={false} zoomEnabled={false} accessibilityLabel="Trip route map"><Polyline coordinates={routeCoordinates} strokeColor={colors.green} strokeWidth={4} />{plan.stops.map((stop, index) => <Marker key={stop.id} coordinate={stop.destination.coordinates} title={`${index + 1}. ${stop.destination.name}`} description={`${stop.nights} nights`}><View style={styles.marker}><Text style={styles.markerText}>{index + 1}</Text></View></Marker>)}</MapView>
    {alternatives.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.alternativeRow}>{allPlans.map((alternative, index) => <Pressable key={alternative.id} style={[styles.alternative, alternative.id === plan.id && styles.alternativeActive]} onPress={() => onSelect(alternative)}><Text style={styles.alternativeLabel}>{index === 0 ? "Best fit" : `Option ${index + 1}`}</Text><Text style={styles.alternativeTitle}>{alternative.stops.map((stop) => stop.destination.name).join(" · ")}</Text><Text style={styles.alternativeMeta}>{alternative.score}/100 · {Math.round(alternative.totalDrivingMinutes / 60)} h driving</Text></Pressable>)}</ScrollView> : null}
    <View style={styles.metricRow}><Metric icon={Sun} label="Weather" value={`${plan.score}/100`} /><Metric icon={MapPinned} label="Places" value={String(plan.stops.length)} /><Metric icon={Car} label="Driving" value={`${Math.round(plan.totalDrivingMinutes / 60)} h`} /></View>
    <View style={styles.timeline}>{plan.stops.map((stop, index) => <View key={stop.id} style={styles.stopBlock}><View style={styles.stopRail}><View style={styles.stopDot}><Text style={styles.stopNumber}>{index + 1}</Text></View>{index < plan.stops.length - 1 ? <View style={styles.railLine} /> : null}</View><View style={styles.stopContent}><Text style={styles.stopDates}>{stop.arrivalDate} · {stop.nights} {stop.nights === 1 ? "night" : "nights"}</Text><Text style={styles.stopTitle}>{stop.destination.name}</Text><Text style={styles.stopMeta}>{stop.destination.country} · {stop.sunshineHours} h average sun</Text><Text style={styles.stopWhy}>{stop.why}</Text>{stop.forecast.slice(0, 3).map((day) => <View key={day.date} style={styles.forecastLine}><Sun size={15} color={colors.yellow} /><Text style={styles.forecastText}>{day.date.slice(5)} · {Math.round(day.tempMinC)}-{Math.round(day.tempMaxC)}° · {day.sunshineHours} h sun · {day.precipitationMm} mm rain</Text></View>)}{plan.legs.filter((leg) => leg.toName === stop.destination.name).map((leg) => <LegBlock key={leg.id} leg={leg} />)}</View></View>)}</View>
  </View>;
}

function LegBlock({ leg }: { leg: TripPlan["legs"][number] }) { return <View style={styles.legBlock}><View style={styles.legHeader}><Route size={16} color={colors.blue} /><Text style={styles.legTitle}>Day {leg.day}: {leg.fromName} to {leg.toName}</Text><Text style={styles.legTime}>{Math.round(leg.drivingMinutes / 60 * 10) / 10} h</Text></View>{leg.breaks.map((stop) => <View key={stop.id} style={styles.breakLine}><View style={[styles.breakIcon, stop.kind === "lunch" && styles.lunchIcon]}><Text style={styles.breakIconText}>{stop.kind === "lunch" ? "L" : stop.kind === "charging" ? "E" : "15"}</Text></View><View style={styles.flex}><Text style={styles.breakTitle}>{stop.title}</Text><Text style={styles.breakText}>{stop.detail}</Text></View></View>)}</View>; }

function AdvancedEditor({ brief, setBrief }: { brief: TripBrief; setBrief: React.Dispatch<React.SetStateAction<TripBrief>> }) { return <View style={styles.advancedContent}><Text style={styles.controlLabel}>Travelers</Text><SettingStepper label="Adults" value={brief.travelers.adults} min={1} max={8} onChange={(value) => setBrief((current) => ({ ...current, travelers: { ...current.travelers, adults: value } }))} /><SettingStepper label="Children" value={brief.travelers.children} min={0} max={8} onChange={(value) => setBrief((current) => ({ ...current, travelers: { ...current.travelers, children: value } }))} /><View style={styles.settingRow}><Text style={styles.settingLabel}>Electric car</Text><Switch value={brief.travelers.hasEv} onValueChange={(value) => setBrief((current) => ({ ...current, travelers: { ...current.travelers, hasEv: value } }))} trackColor={{ false: colors.line, true: colors.greenSoft }} thumbColor={brief.travelers.hasEv ? colors.green : colors.muted} /></View><Text style={styles.controlLabel}>Stay style</Text><View style={styles.chipWrap}>{accommodationOptions.map((option) => { const active = brief.accommodations.includes(option.id); const Icon = option.icon; return <Pressable key={option.id} style={[styles.smallChoice, active && styles.smallChoiceActive]} onPress={() => setBrief((current) => ({ ...current, accommodations: active ? current.accommodations.filter((item) => item !== option.id) : [...current.accommodations, option.id] }))}><Icon size={16} color={active ? colors.surface : colors.muted} /><Text style={[styles.smallChoiceText, active && styles.smallChoiceTextActive]}>{option.label}</Text>{active ? <Check size={14} color={colors.surface} /> : null}</Pressable>; })}</View><Text style={styles.controlLabel}>Temperature comfort</Text><ChoiceRow values={["cool", "mild", "warm"]} selected={brief.temperatureComfort ?? "mild"} labels={{ cool: "Cool", mild: "Mild", warm: "Warm" }} onSelect={(value) => setBrief((current) => ({ ...current, temperatureComfort: value as TemperatureComfort }))} /></View>; }

function SectionHeading({ icon: Icon, label }: { icon: LucideIcon; label: string }) { return <View style={styles.sectionHeading}><Icon size={19} color={colors.green} /><Text style={styles.sectionTitle}>{label}</Text></View>; }
function ScreenHeader({ title, subtitle }: { title: string; subtitle: string }) { return <View style={styles.screenHeader}><View style={styles.screenBrand}><BrandMark size={34} /><Text style={styles.eyebrow}>WEATHERTRIP</Text></View><Text style={styles.screenTitle}>{title}</Text><Text style={styles.screenSubtitle}>{subtitle}</Text></View>; }
function BrandMark({ size = 58 }: { size?: number }) { return <View accessibilityLabel="Weathertrip logo" style={[styles.brandMark, { height: size, width: size, borderRadius: size * 0.21 }]}><Svg height={size} width={size} viewBox="0 0 1024 1024"><Rect width="1024" height="1024" rx="220" fill={colors.paper} /><Circle cx="680" cy="300" r="174" fill={colors.yellow} /><Path d="M110 742c118-124 246-181 383-161 129 19 171 101 280 53 54-24 99-60 141-107v387H110z" fill={colors.green} /><Path d="M150 786c115-108 216-159 323-158 119 1 169-104 277-143 52-19 105-21 152-8" fill="none" stroke={colors.ink} strokeLinecap="round" strokeLinejoin="round" strokeWidth="38" /><Circle cx="150" cy="786" r="29" fill={colors.blue} stroke={colors.paper} strokeWidth="14" /><Circle cx="473" cy="628" r="29" fill={colors.blue} stroke={colors.paper} strokeWidth="14" /><Circle cx="750" cy="485" r="29" fill={colors.blue} stroke={colors.paper} strokeWidth="14" /></Svg></View>; }
function DateButton({ label, value, onPress }: { label: string; value: string; onPress: () => void }) { return <Pressable style={styles.dateButton} onPress={onPress}><Text style={styles.dateLabel}>{label}</Text><Text style={styles.dateValue}>{value}</Text></Pressable>; }
function ChoiceTile({ selected, icon: Icon, label, detail, onPress }: { selected: boolean; icon: LucideIcon; label: string; detail: string; onPress: () => void }) { return <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} style={[styles.goalTile, selected && styles.goalTileActive]} onPress={onPress}><View style={[styles.goalIcon, selected && styles.goalIconActive]}><Icon size={20} color={selected ? colors.surface : colors.green} /></View><Text style={[styles.goalLabel, selected && styles.goalLabelActive]}>{label}</Text><Text style={[styles.goalDetail, selected && styles.goalDetailActive]}>{detail}</Text>{selected ? <View style={styles.check}><Check size={13} color={colors.surface} /></View> : null}</Pressable>; }
function ChoiceRow<T extends string | number>({ values, selected, suffix = "", labels, onSelect }: { values: T[]; selected: T; suffix?: string; labels?: Record<string, string>; onSelect: (value: T) => void }) { return <View style={styles.choiceRow}>{values.map((value) => { const active = value === selected; const label = labels?.[String(value)] ?? `${value}${suffix}`; return <Pressable key={String(value)} accessibilityRole="radio" accessibilityState={{ checked: active }} style={[styles.choice, active && styles.choiceActive]} onPress={() => onSelect(value)}><Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label}</Text>{active ? <Check size={14} color={colors.surface} /> : null}</Pressable>; })}</View>; }
function SettingStepper({ label, value, min, max, suffix = "", onChange }: { label: string; value: number; min: number; max: number; suffix?: string; onChange: (value: number) => void }) { return <View style={styles.settingRow}><Text style={styles.settingLabel}>{label}</Text><View style={styles.stepper}><Pressable accessibilityLabel={`Decrease ${label}`} style={styles.stepButton} onPress={() => onChange(Math.max(min, value - 1))}><Minus size={16} color={colors.ink} /></Pressable><Text style={styles.stepValue}>{value}{suffix}</Text><Pressable accessibilityLabel={`Increase ${label}`} style={styles.stepButton} onPress={() => onChange(Math.min(max, value + 1))}><Plus size={16} color={colors.ink} /></Pressable></View></View>; }
function Metric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) { return <View style={styles.metric}><Icon size={17} color={colors.green} /><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text></View>; }
function ActionButton({ icon: Icon, label, tone, onPress }: { icon: LucideIcon; label: string; tone?: "danger"; onPress: () => void }) { return <Pressable style={[styles.actionButton, tone === "danger" && styles.actionButtonDanger]} onPress={onPress}><Icon size={18} color={tone === "danger" ? colors.coral : colors.ink} /><Text style={[styles.actionText, tone === "danger" && styles.dangerText]}>{label}</Text></Pressable>; }
function EmptyState({ icon: Icon, title, detail }: { icon: LucideIcon; title: string; detail: string }) { return <View style={styles.empty}><Icon size={30} color={colors.green} /><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyText}>{detail}</Text></View>; }
function advancedSummary(brief: TripBrief): string { return `${brief.travelers.adults + brief.travelers.children} travelers · ${brief.accommodations.map((item) => item[0]?.toUpperCase() + item.slice(1)).join(", ")}`; }
function createBrief(): TripBrief { const start = new Date(); start.setDate(start.getDate() + 1); const end = new Date(start); end.setDate(end.getDate() + 9); return { startLocation: defaultStart, dateRange: { start: toDateInput(start), end: toDateInput(end) }, durationDays: 10, weatherGoal: "sunny", temperatureComfort: "mild", maxDriveHoursPerDay: 6, placeCount: "smart", borderRule: "anywhere", travelers: { adults: 2, children: 0, hasEv: false }, accommodations: ["hotel", "cabin"], budget: "balanced" }; }
function defaultProfile(email: string): UserProfile { const now = new Date().toISOString(); return { id: "", email, units: "metric", defaultAdults: 2, defaultChildren: 0, defaultHasEv: false, defaultMaxDriveHours: 6, createdAt: now, updatedAt: now }; }
function parseDate(value: string): Date { return new Date(`${value}T12:00:00`); }
function toDateInput(value: Date): string { return value.toISOString().slice(0, 10); }
function onDateChange(event: DateTimePickerEvent, date: Date | undefined, field: "start" | "end", brief: TripBrief, setBrief: React.Dispatch<React.SetStateAction<TripBrief>>, setShowDates: (value: "start" | "end" | null) => void) { if (event.type === "dismissed" || !date) { setShowDates(null); return; } const value = toDateInput(date); const range = { ...brief.dateRange, [field]: value }; setBrief((current) => ({ ...current, dateRange: range, durationDays: Math.max(1, Math.round((parseDate(range.end).getTime() - parseDate(range.start).getTime()) / 86_400_000) + 1) })); setShowDates(null); }

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { backgroundColor: colors.paper, gap: 14, padding: 18, paddingBottom: 40 },
  topBar: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingBottom: 4 },
  eyebrow: { color: colors.green, fontSize: 11, fontWeight: "900", letterSpacing: 1.4 },
  title: { color: colors.ink, fontSize: 27, fontWeight: "900", lineHeight: 32, marginTop: 4, maxWidth: 300 },
  brandMark: { alignItems: "center", backgroundColor: colors.yellow, borderRadius: 16, flexDirection: "row", gap: 0, height: 58, justifyContent: "center", width: 58 },
  section: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, padding: 16 },
  sectionHeading: { alignItems: "center", flexDirection: "row", gap: 9, marginBottom: 14 },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  locationLine: { alignItems: "center", flexDirection: "row", gap: 8 },
  locationInputWrap: { alignItems: "center", backgroundColor: colors.paper, borderColor: colors.line, borderRadius: 11, borderWidth: 1, flex: 1, flexDirection: "row", gap: 8, paddingHorizontal: 12 },
  locationInput: { color: colors.ink, flex: 1, fontSize: 16, height: 48 },
  iconButton: { alignItems: "center", backgroundColor: colors.greenSoft, borderRadius: 11, height: 48, justifyContent: "center", width: 48 },
  suggestions: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 10, borderWidth: 1, marginTop: 5, overflow: "hidden" },
  suggestion: { alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", gap: 8, minHeight: 44, paddingHorizontal: 12 },
  suggestionText: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  dateLine: { flexDirection: "row", gap: 10, marginTop: 12 },
  dateButton: { backgroundColor: colors.paper, borderColor: colors.line, borderRadius: 11, borderWidth: 1, flex: 1, minHeight: 64, padding: 11 },
  dateLabel: { color: colors.muted, fontSize: 12, fontWeight: "800", marginBottom: 5 },
  dateValue: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  durationLine: { alignItems: "center", borderTopColor: colors.line, borderTopWidth: 1, flexDirection: "row", justifyContent: "space-between", marginTop: 12, paddingTop: 12 },
  muted: { color: colors.muted, fontSize: 14, fontWeight: "700" },
  strong: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  goalRow: { gap: 9, paddingBottom: 2 },
  goalTile: { backgroundColor: colors.paper, borderColor: colors.line, borderRadius: 12, minHeight: 118, padding: 11, position: "relative", width: 112 },
  goalTileActive: { backgroundColor: colors.greenSoft, borderColor: colors.green, borderWidth: 2 },
  goalIcon: { alignItems: "center", backgroundColor: colors.surface, borderRadius: 18, height: 36, justifyContent: "center", marginBottom: 10, width: 36 },
  goalIconActive: { backgroundColor: colors.green },
  goalLabel: { color: colors.ink, fontSize: 14, fontWeight: "900" },
  goalLabelActive: { color: colors.green },
  goalDetail: { color: colors.muted, fontSize: 11, fontWeight: "600", marginTop: 3 },
  goalDetailActive: { color: colors.green },
  check: { alignItems: "center", backgroundColor: colors.green, borderRadius: 10, height: 20, justifyContent: "center", position: "absolute", right: 8, top: 8, width: 20 },
  controlLabel: { color: colors.muted, fontSize: 13, fontWeight: "800", marginBottom: 8, marginTop: 3 },
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  choice: { alignItems: "center", backgroundColor: colors.paper, borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 5, minHeight: 42, paddingHorizontal: 13 },
  choiceActive: { backgroundColor: colors.green, borderColor: colors.green },
  choiceText: { color: colors.muted, fontSize: 14, fontWeight: "800" },
  choiceTextActive: { color: colors.surface },
  advancedHeader: { alignItems: "center", flexDirection: "row", gap: 10, minHeight: 44 },
  advancedIcon: { alignItems: "center", backgroundColor: colors.blueSoft, borderRadius: 10, height: 38, justifyContent: "center", width: 38 },
  advancedTitle: { color: colors.ink, fontSize: 17, fontWeight: "900" },
  advancedSummary: { color: colors.muted, fontSize: 12, fontWeight: "600", marginTop: 2 },
  rotated: { transform: [{ rotate: "180deg" }] },
  advancedContent: { borderTopColor: colors.line, borderTopWidth: 1, marginTop: 14, paddingTop: 13 },
  settingRow: { alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", minHeight: 52 },
  settingLabel: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  stepper: { alignItems: "center", flexDirection: "row", gap: 8 },
  stepButton: { alignItems: "center", backgroundColor: colors.paper, borderColor: colors.line, borderRadius: 9, borderWidth: 1, height: 38, justifyContent: "center", width: 38 },
  stepValue: { color: colors.ink, fontSize: 15, fontWeight: "900", minWidth: 28, textAlign: "center" },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  smallChoice: { alignItems: "center", backgroundColor: colors.paper, borderColor: colors.line, borderRadius: 9, borderWidth: 1, flexDirection: "row", gap: 6, minHeight: 42, paddingHorizontal: 10 },
  smallChoiceActive: { backgroundColor: colors.green, borderColor: colors.green },
  smallChoiceText: { color: colors.muted, fontSize: 13, fontWeight: "800" },
  smallChoiceTextActive: { color: colors.surface },
  primaryButton: { alignItems: "center", backgroundColor: colors.ink, borderRadius: 13, flexDirection: "row", gap: 9, justifyContent: "center", minHeight: 56, paddingHorizontal: 20 },
  primaryText: { color: colors.surface, fontSize: 16, fontWeight: "900" },
  disabled: { opacity: 0.55 },
  errorBox: { backgroundColor: "#fff0eb", borderColor: colors.coral, borderRadius: 10, borderWidth: 1, padding: 12 },
  errorText: { color: colors.coral, fontSize: 14, fontWeight: "800", lineHeight: 20 },
  results: { gap: 13, paddingTop: 6 },
  resultHeader: { alignItems: "flex-start", flexDirection: "row", gap: 12 },
  resultEyebrow: { color: colors.green, fontSize: 11, fontWeight: "900", letterSpacing: 0.7 },
  resultTitle: { color: colors.ink, fontSize: 21, fontWeight: "900", lineHeight: 26, marginTop: 3 },
  resultSummary: { color: colors.muted, fontSize: 14, fontWeight: "600", lineHeight: 20, marginTop: 4 },
  saveButton: { alignItems: "center", borderColor: colors.green, borderRadius: 11, borderWidth: 1, height: 44, justifyContent: "center", width: 44 },
  saveButtonActive: { backgroundColor: colors.green },
  map: { borderRadius: 14, height: 250, overflow: "hidden" },
  marker: { alignItems: "center", backgroundColor: colors.green, borderColor: colors.surface, borderRadius: 16, borderWidth: 2, height: 32, justifyContent: "center", width: 32 },
  markerText: { color: colors.surface, fontSize: 13, fontWeight: "900" },
  alternativeRow: { gap: 9 },
  alternative: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 11, borderWidth: 1, padding: 11, width: 185 },
  alternativeActive: { backgroundColor: colors.greenSoft, borderColor: colors.green },
  alternativeLabel: { color: colors.green, fontSize: 11, fontWeight: "900" },
  alternativeTitle: { color: colors.ink, fontSize: 13, fontWeight: "800", lineHeight: 18, marginTop: 4 },
  alternativeMeta: { color: colors.muted, fontSize: 11, fontWeight: "700", marginTop: 5 },
  metricRow: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 12, borderWidth: 1, flexDirection: "row", justifyContent: "space-around", padding: 12 },
  metric: { alignItems: "center", gap: 3 },
  metricLabel: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  metricValue: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  timeline: { gap: 0 },
  stopBlock: { flexDirection: "row", gap: 12 },
  stopRail: { alignItems: "center", width: 26 },
  stopDot: { alignItems: "center", backgroundColor: colors.green, borderRadius: 14, height: 28, justifyContent: "center", width: 28 },
  stopNumber: { color: colors.surface, fontSize: 12, fontWeight: "900" },
  railLine: { backgroundColor: colors.greenSoft, flex: 1, minHeight: 110, width: 3 },
  stopContent: { flex: 1, paddingBottom: 18 },
  stopDates: { color: colors.green, fontSize: 12, fontWeight: "900" },
  stopTitle: { color: colors.ink, fontSize: 19, fontWeight: "900", marginTop: 3 },
  stopMeta: { color: colors.muted, fontSize: 13, fontWeight: "700", marginTop: 2 },
  stopWhy: { color: colors.ink, fontSize: 13, fontWeight: "600", lineHeight: 19, marginTop: 7 },
  forecastLine: { alignItems: "center", flexDirection: "row", gap: 6, marginTop: 7 },
  forecastText: { color: colors.muted, flex: 1, fontSize: 12, fontWeight: "700" },
  legBlock: { backgroundColor: colors.blueSoft, borderRadius: 10, marginTop: 10, padding: 10 },
  legHeader: { alignItems: "center", flexDirection: "row", gap: 6 },
  legTitle: { color: colors.blue, flex: 1, fontSize: 12, fontWeight: "900" },
  legTime: { color: colors.blue, fontSize: 12, fontWeight: "900" },
  breakLine: { alignItems: "center", flexDirection: "row", gap: 8, marginTop: 9 },
  breakIcon: { alignItems: "center", backgroundColor: colors.surface, borderRadius: 7, height: 27, justifyContent: "center", width: 32 },
  lunchIcon: { backgroundColor: colors.yellow },
  breakIconText: { color: colors.ink, fontSize: 10, fontWeight: "900" },
  breakTitle: { color: colors.ink, fontSize: 12, fontWeight: "900" },
  breakText: { color: colors.muted, fontSize: 11, fontWeight: "600", marginTop: 2 },
  screenHeader: { paddingBottom: 4, paddingTop: 8 },
  screenBrand: { alignItems: "center", flexDirection: "row", gap: 8 },
  screenTitle: { color: colors.ink, fontSize: 28, fontWeight: "900", marginTop: 4 },
  screenSubtitle: { color: colors.muted, fontSize: 15, fontWeight: "600", marginTop: 4 },
  tripRow: { alignItems: "center", backgroundColor: colors.surface, borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", gap: 12, minHeight: 75, paddingHorizontal: 4 },
  tripRowIcon: { alignItems: "center", backgroundColor: colors.greenSoft, borderRadius: 12, height: 43, justifyContent: "center", width: 43 },
  tripRowTitle: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  tripRowMeta: { color: colors.muted, fontSize: 12, fontWeight: "700", marginTop: 4 },
  empty: { alignItems: "center", paddingHorizontal: 28, paddingTop: 70 },
  emptyTitle: { color: colors.ink, fontSize: 19, fontWeight: "900", marginTop: 12 },
  emptyText: { color: colors.muted, fontSize: 14, fontWeight: "600", lineHeight: 20, marginTop: 6, textAlign: "center" },
  backButton: { alignItems: "center", flexDirection: "row", gap: 7, paddingVertical: 5 },
  backText: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  center: { alignItems: "center", backgroundColor: colors.paper, flex: 1, justifyContent: "center", padding: 20 },
  actionRow: { flexDirection: "row", gap: 10 },
  actionButton: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 11, borderWidth: 1, flex: 1, flexDirection: "row", gap: 8, justifyContent: "center", minHeight: 48, paddingHorizontal: 10 },
  actionButtonDanger: { borderColor: "#f2c1b5" },
  actionText: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  dangerText: { color: colors.coral },
  signInPanel: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, padding: 17 },
  avatar: { alignItems: "center", backgroundColor: colors.greenSoft, borderRadius: 22, height: 44, justifyContent: "center", marginBottom: 10, width: 44 },
  panelTitle: { color: colors.ink, fontSize: 17, fontWeight: "900" },
  panelText: { color: colors.muted, fontSize: 13, fontWeight: "600", lineHeight: 19, marginTop: 5 },
  appleButton: { height: 46, marginTop: 15, width: "100%" },
  textInput: { backgroundColor: colors.paper, borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, height: 48, marginTop: 10, paddingHorizontal: 13 },
  secondaryButton: { alignItems: "center", backgroundColor: colors.blueSoft, borderRadius: 10, justifyContent: "center", minHeight: 45, paddingHorizontal: 14 },
  secondaryText: { color: colors.blue, fontSize: 13, fontWeight: "900" },
  profileHeader: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 12, padding: 16 },
  statusText: { color: colors.green, fontSize: 13, fontWeight: "800" }
});
