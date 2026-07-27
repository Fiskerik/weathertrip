import type { Destination } from "./types.js";

export const accommodationLabels = {
  tent: "Tent",
  trailer: "Trailer",
  hotel: "Hotel",
  hostel: "Hostel",
  cabin: "Cabin",
  glamping: "Glamping"
} as const;

export const destinations: Destination[] = [
  {
    id: "stockholm-archipelago",
    name: "Stockholm Archipelago",
    country: "Sweden",
    region: "Scandinavia",
    imageUrl: "https://unsplash.com/photos/zPEXjUKxeL8/download?force=true&w=360",
    directionFromStockholm: "east",
    coordinates: { latitude: 59.387, longitude: 18.735 },
    tags: ["tent", "cabin", "glamping", "hotel"],
    budgetLevel: "balanced",
    highlights: ["island ferries", "swim-friendly coves", "quiet cabins"],
    baselineTravelHoursFromStockholm: 1.4
  },
  {
    id: "gotland",
    name: "Gotland",
    country: "Sweden",
    region: "Baltic Sea",
    imageUrl: "https://unsplash.com/photos/3IiD2ghwJQ4/download?force=true&w=360",
    directionFromStockholm: "south",
    coordinates: { latitude: 57.6348, longitude: 18.2948 },
    tags: ["tent", "trailer", "hotel", "hostel", "cabin"],
    budgetLevel: "balanced",
    highlights: ["limestone coast", "medieval Visby", "long sunny evenings"],
    baselineTravelHoursFromStockholm: 4.5
  },
  {
    id: "lofoten",
    name: "Lofoten",
    country: "Norway",
    region: "Scandinavia",
    imageUrl: "https://unsplash.com/photos/ut7XZMquCoU/download?force=true&w=360",
    directionFromStockholm: "north",
    coordinates: { latitude: 68.209, longitude: 13.652 },
    tags: ["tent", "cabin", "hostel", "hotel"],
    budgetLevel: "comfort",
    highlights: ["dramatic mountains", "midnight sun", "fishing villages"],
    baselineTravelHoursFromStockholm: 17
  },
  {
    id: "copenhagen",
    name: "Copenhagen",
    country: "Denmark",
    region: "Scandinavia",
    imageUrl: "https://unsplash.com/photos/hRnXE3CoSXA/download?force=true&w=360",
    directionFromStockholm: "south",
    coordinates: { latitude: 55.6761, longitude: 12.5683 },
    tags: ["hotel", "hostel", "glamping"],
    budgetLevel: "comfort",
    highlights: ["bikeable city", "harbor swimming", "food markets"],
    baselineTravelHoursFromStockholm: 6.5
  },
  {
    id: "helsinki",
    name: "Helsinki",
    country: "Finland",
    region: "Scandinavia",
    imageUrl: "https://unsplash.com/photos/PV3IW664mZg/download?force=true&w=360",
    directionFromStockholm: "east",
    coordinates: { latitude: 60.1699, longitude: 24.9384 },
    tags: ["hotel", "hostel", "cabin"],
    budgetLevel: "balanced",
    highlights: ["sauna culture", "island hopping", "design district"],
    baselineTravelHoursFromStockholm: 13
  },
  {
    id: "fjallbacka",
    name: "Fjallbacka",
    country: "Sweden",
    region: "West Coast",
    imageUrl: "https://unsplash.com/photos/Pf83O5tN1YQ/download?force=true&w=360",
    directionFromStockholm: "west",
    coordinates: { latitude: 58.599, longitude: 11.287 },
    tags: ["tent", "trailer", "cabin", "hotel"],
    budgetLevel: "balanced",
    highlights: ["granite coast", "kayaking", "seafood stops"],
    baselineTravelHoursFromStockholm: 5.6
  },
  {
    id: "berlin",
    name: "Berlin",
    country: "Germany",
    region: "Central Europe",
    imageUrl: "https://unsplash.com/photos/o2kT3cHuyzI/download?force=true&w=360",
    directionFromStockholm: "south",
    coordinates: { latitude: 52.52, longitude: 13.405 },
    tags: ["hotel", "hostel"],
    budgetLevel: "lean",
    highlights: ["parks and lakes", "museums", "late summer terraces"],
    baselineTravelHoursFromStockholm: 12
  },
  {
    id: "prague",
    name: "Prague",
    country: "Czechia",
    region: "Central Europe",
    imageUrl: "https://unsplash.com/photos/3Ovurn490hw/download?force=true&w=360",
    directionFromStockholm: "south",
    coordinates: { latitude: 50.0755, longitude: 14.4378 },
    tags: ["hotel", "hostel"],
    budgetLevel: "lean",
    highlights: ["historic center", "beer gardens", "river walks"],
    baselineTravelHoursFromStockholm: 15
  },
  {
    id: "krakow",
    name: "Krakow",
    country: "Poland",
    region: "Central Europe",
    imageUrl: "https://unsplash.com/photos/j8O9keEhpxE/download?force=true&w=360",
    directionFromStockholm: "south",
    coordinates: { latitude: 50.0647, longitude: 19.945 },
    tags: ["hotel", "hostel"],
    budgetLevel: "lean",
    highlights: ["old town", "planty park", "day trips"],
    baselineTravelHoursFromStockholm: 16
  },
  {
    id: "salzburg",
    name: "Salzburg",
    country: "Austria",
    region: "Alps",
    imageUrl: "https://unsplash.com/photos/DxHz_U_dEoo/download?force=true&w=360",
    directionFromStockholm: "south",
    coordinates: { latitude: 47.8095, longitude: 13.055 },
    tags: ["hotel", "hostel", "cabin", "glamping"],
    budgetLevel: "comfort",
    highlights: ["alpine lakes", "old town", "mountain weather windows"],
    baselineTravelHoursFromStockholm: 20
  }
];
