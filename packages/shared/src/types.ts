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
};
