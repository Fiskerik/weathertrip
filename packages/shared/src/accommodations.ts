import type { AccommodationSuggestion } from "./types.js";

export const accommodationSuggestions: AccommodationSuggestion[] = [
  {
    id: "nynashamn-cabins",
    name: "Nynashamn Harbor Cabins",
    type: "cabin",
    coordinates: { latitude: 58.9031, longitude: 17.9466 },
    travelHoursFromStart: 1.2,
    priceLevel: "balanced",
    reason: "Fallback stay near the Nynashamn ferry and harbor area.",
    source: "Curated fallback"
  },
  {
    id: "grisslehamn-camping",
    name: "Grisslehamn Coastal Camping",
    type: "tent",
    coordinates: { latitude: 60.1006, longitude: 18.8126 },
    travelHoursFromStart: 1.7,
    priceLevel: "lean",
    reason: "Fallback camping stop near the coast north of Stockholm.",
    source: "Curated fallback"
  },
  {
    id: "visby-hostel",
    name: "Visby Ringwall Hostel",
    type: "hostel",
    coordinates: { latitude: 57.6388, longitude: 18.2948 },
    travelHoursFromStart: 4.6,
    priceLevel: "lean",
    reason: "Fallback hostel-style stay inside the useful Gotland travel window.",
    source: "Curated fallback"
  },
  {
    id: "visby-hotel",
    name: "Visby Garden Hotel",
    type: "hotel",
    coordinates: { latitude: 57.6371, longitude: 18.2964 },
    travelHoursFromStart: 4.9,
    priceLevel: "balanced",
    reason: "Fallback hotel-style base after a ferry-and-drive day.",
    source: "Curated fallback"
  },
  {
    id: "bohuslan-trailer",
    name: "Bohuslan Trailer Park",
    type: "trailer",
    coordinates: { latitude: 58.599, longitude: 11.287 },
    travelHoursFromStart: 5.2,
    priceLevel: "balanced",
    reason: "Fallback trailer-friendly stop close to the preferred daily drive limit.",
    source: "Curated fallback"
  },
  {
    id: "copenhagen-hotel",
    name: "Copenhagen Harbor Hotel",
    type: "hotel",
    coordinates: { latitude: 55.6818, longitude: 12.5948 },
    travelHoursFromStart: 6.4,
    priceLevel: "comfort",
    reason: "Fallback hotel-style stop near Copenhagen harbor.",
    source: "Curated fallback"
  },
  {
    id: "helsinki-hotel",
    name: "Helsinki Design Hotel",
    type: "hotel",
    coordinates: { latitude: 60.1684, longitude: 24.9426 },
    travelHoursFromStart: 12.8,
    priceLevel: "balanced",
    reason: "Fallback hotel-style destination stay for a ferry-led plan.",
    source: "Curated fallback"
  },
  {
    id: "berlin-hostel",
    name: "Berlin Lakeside Hostel",
    type: "hostel",
    coordinates: { latitude: 52.4933, longitude: 13.2547 },
    travelHoursFromStart: 11.7,
    priceLevel: "lean",
    reason: "Fallback hostel-style stay near parks and lakes.",
    source: "Curated fallback"
  },
  {
    id: "salzburg-glamping",
    name: "Salzburg Alpine Glamping",
    type: "glamping",
    coordinates: { latitude: 47.8095, longitude: 13.055 },
    travelHoursFromStart: 19.8,
    priceLevel: "comfort",
    reason: "Fallback glamping-style stay for a high-comfort route.",
    source: "Curated fallback"
  }
];
