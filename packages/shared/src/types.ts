export type TravelMode = "car" | "train" | "flight";

export type DirectionPreference = "north" | "east" | "south" | "west";

export type AccommodationTag =
  | "tent"
  | "trailer"
  | "hotel"
  | "hostel"
  | "cabin"
  | "glamping";

export type BudgetLevel = "lean" | "balanced" | "comfort";

export type WeatherConstraintKey =
  | "tempMinC"
  | "tempMaxC"
  | "maxPrecipitationMm"
  | "minSunshineHours"
  | "maxWindKph";

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type TravelerProfile = {
  adults: number;
  children: number;
  hasEv: boolean;
};

export type TripRequest = {
  startLocation: {
    label: string;
    coordinates?: Coordinates;
  };
  destinationPreference?: {
    destinationId?: string;
    direction?: DirectionPreference;
  };
  dateRange: {
    start: string;
    end: string;
  };
  durationDays: number;
  travelMode: TravelMode;
  maxHoursPerDay: number;
  travelers: TravelerProfile;
  minStayDays: number;
  maxStayDays: number;
  accommodations: AccommodationTag[];
  weather: {
    tempMinC: number;
    tempMaxC: number;
    maxPrecipitationMm: number;
    minSunshineHours: number;
    maxWindKph: number;
  };
  ignoredWeather?: WeatherConstraintKey[];
  budget?: BudgetLevel;
};

export type Destination = {
  id: string;
  name: string;
  country: string;
  region: string;
  imageUrl?: string;
  directionFromStockholm: DirectionPreference;
  coordinates: Coordinates;
  tags: AccommodationTag[];
  budgetLevel: BudgetLevel;
  highlights: string[];
  baselineTravelHoursFromStockholm: number;
};

export type DailyForecast = {
  date: string;
  tempMinC: number;
  tempMaxC: number;
  precipitationMm: number;
  sunshineHours: number;
  windKph: number;
};

export type TravelPlanStep = {
  title: string;
  detail: string;
  durationHours?: number;
};

export type RouteMetrics = {
  distanceKm: number;
  durationHours: number;
  source: "openrouteservice" | "estimate";
  routePath: Coordinates[];
};

export type ItinerarySegment = {
  day: number;
  title: string;
  timing: string;
  direction: string;
  startName?: string;
  startCoordinates?: Coordinates;
  startTravelHoursFromStart?: number;
  endTravelHoursFromStart?: number;
  distanceKm?: number;
  travelHours: number;
  stopName: string;
  stopCoordinates: Coordinates;
  stopReason: string;
  continueAfter: string;
  activities: string[];
};

export type AccommodationSuggestion = {
  id: string;
  name: string;
  type: AccommodationTag;
  coordinates?: Coordinates;
  travelHoursFromStart: number;
  priceLevel: BudgetLevel;
  reason: string;
  source?: string;
  sourceUrl?: string;
  rating?: number | undefined;
  userRatingCount?: number | undefined;
};

export type AccommodationFallbackNotice = {
  message: string;
  availableTypes: AccommodationTag[];
};

export type ScoreBreakdown = {
  weather: number;
  travel: number;
  accommodation: number;
  budget: number;
  confidence: "high" | "medium" | "low";
};

export type RouteStop = {
  destinationId: string;
  destinationName: string;
  nights: number;
  order: number;
};

export type Recommendation = {
  destination: Destination;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  why: string;
  travelHours: number;
  routeMetrics: RouteMetrics;
  travelPlan: TravelPlanStep[];
  itinerary: ItinerarySegment[];
  accommodationSuggestions: AccommodationSuggestion[];
  alternativeAccommodationSuggestions?: AccommodationSuggestion[] | undefined;
  accommodationFallbackNotice?: AccommodationFallbackNotice | undefined;
  packingHints: string[];
  forecast: DailyForecast[];
  routeStops: RouteStop[];
};

export type RecommendationResponse = {
  generatedAt: string;
  planSummary: string;
  recommendations: Recommendation[];
};

export type ApiError = {
  error: string;
  details?: string[];
  code?: string;
};

export type WeatherGoal = "sunny" | "dry" | "warm" | "cool" | "balanced";
export type PlaceCountMode = "smart" | 1 | 2 | 3 | 4;
export type BorderRule = "anywhere" | "leave-country" | "stay-country";
export type TemperatureComfort = "cool" | "mild" | "warm";

export type TripBrief = {
  startLocation: {
    label: string;
    country?: string;
    coordinates: Coordinates;
  };
  dateRange: {
    start: string;
    end: string;
  };
  durationDays: number;
  weatherGoal: WeatherGoal;
  temperatureComfort?: TemperatureComfort;
  maxDriveHoursPerDay: number;
  placeCount: PlaceCountMode;
  borderRule: BorderRule;
  travelers: TravelerProfile;
  accommodations: AccommodationTag[];
  budget: BudgetLevel;
};

export type BreakStopKind = "comfort" | "lunch" | "charging";

export type BreakStop = {
  id: string;
  kind: BreakStopKind;
  title: string;
  detail: string;
  durationMinutes: number;
  plannedAfterDrivingMinutes: number;
  locationName: string;
  coordinates?: Coordinates;
  amenitiesVerified: boolean;
};

export type PlanLeg = {
  id: string;
  day: number;
  fromName: string;
  toName: string;
  distanceKm: number;
  drivingMinutes: number;
  elapsedMinutes: number;
  routePath: Coordinates[];
  breaks: BreakStop[];
  source: "openrouteservice" | "estimate";
};

export type PlanStop = {
  id: string;
  destination: Destination;
  arrivalDate: string;
  departureDate: string;
  nights: number;
  sunshineHours: number;
  forecast: DailyForecast[];
  why: string;
  accommodationSuggestions: AccommodationSuggestion[];
};

export type TripPlan = {
  id: string;
  title: string;
  score: number;
  confidence: "high" | "medium" | "low";
  summary: string;
  totalDistanceKm: number;
  totalDrivingMinutes: number;
  longestDrivingDayMinutes: number;
  countries: string[];
  stops: PlanStop[];
  legs: PlanLeg[];
  generatedAt: string;
};

export type PlanResponse = {
  generatedAt: string;
  primaryPlan: TripPlan;
  alternatives: TripPlan[];
};

export type UserProfile = {
  id: string;
  email?: string;
  displayName?: string;
  homeLocation?: TripBrief["startLocation"];
  units: "metric" | "imperial";
  defaultAdults: number;
  defaultChildren: number;
  defaultHasEv: boolean;
  defaultMaxDriveHours: number;
  createdAt: string;
  updatedAt: string;
};

export type SavedTrip = {
  id: string;
  title: string;
  brief: TripBrief;
  plan: TripPlan;
  createdAt: string;
  updatedAt: string;
  source: "local" | "cloud";
};
