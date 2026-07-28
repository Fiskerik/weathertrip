import type { AccommodationTag, BudgetLevel, Destination, DirectionPreference } from "./types.js";
import { destinations } from "./destinations.js";

type CatalogEntry = [
  string,
  string,
  string,
  string,
  number,
  number,
  DirectionPreference,
  number,
  AccommodationTag[],
  BudgetLevel,
  string[]
];

const catalog: CatalogEntry[] = [
  ["gothenburg", "Gothenburg", "Sweden", "West Coast", 57.7089, 11.9746, "west", 4.8, ["hotel", "hostel", "cabin", "glamping"], "balanced", ["archipelago boats", "food halls", "coastal walks"]],
  ["malmo", "Malmo", "Sweden", "Skane", 55.605, 13.0038, "south", 6.2, ["hotel", "hostel", "glamping"], "balanced", ["beaches", "old town", "easy Denmark access"]],
  ["uppsala", "Uppsala", "Sweden", "Uppland", 59.8586, 17.6389, "north", 1.1, ["hotel", "hostel", "cabin"], "lean", ["cathedral", "river walks", "bikeable center"]],
  ["turku", "Turku", "Finland", "Southwest Finland", 60.4518, 22.2666, "east", 12.4, ["hotel", "hostel", "cabin"], "balanced", ["riverfront", "archipelago", "castle"]],
  ["tallinn", "Tallinn", "Estonia", "Baltic", 59.437, 24.7536, "east", 15.2, ["hotel", "hostel"], "lean", ["medieval old town", "saunas", "coastal walks"]],
  ["oslo", "Oslo", "Norway", "Oslofjord", 59.9139, 10.7522, "west", 7.2, ["hotel", "hostel", "cabin"], "comfort", ["fjord ferries", "museums", "forest trails"]],
  ["aarhus", "Aarhus", "Denmark", "Jutland", 56.1629, 10.2039, "south", 8.7, ["hotel", "hostel", "glamping"], "balanced", ["harbor baths", "art museum", "food markets"]],
  ["odense", "Odense", "Denmark", "Funen", 55.4038, 10.4024, "south", 8.2, ["hotel", "hostel", "cabin"], "lean", ["old town", "gardens", "family museums"]],
  ["bergen", "Bergen", "Norway", "West Norway", 60.3913, 5.3221, "west", 17.5, ["hotel", "hostel", "cabin"], "comfort", ["harbor", "mountain cable car", "fjord gateways"]],
  ["stavanger", "Stavanger", "Norway", "Rogaland", 58.969, 5.7331, "west", 15.6, ["hotel", "hostel", "cabin"], "comfort", ["old harbor", "cliff hikes", "island ferries"]],
  ["riga", "Riga", "Latvia", "Baltic", 56.9496, 24.1052, "east", 18.5, ["hotel", "hostel"], "lean", ["art nouveau", "riverfront", "beach day trips"]],
  ["vilnius", "Vilnius", "Lithuania", "Baltic", 54.6872, 25.2797, "east", 21.5, ["hotel", "hostel"], "lean", ["old town", "green hills", "courtyards"]],
  ["hamburg", "Hamburg", "Germany", "Northern Germany", 53.5511, 9.9937, "south", 11.7, ["hotel", "hostel"], "balanced", ["harbor", "canals", "lakeside parks"]],
  ["lubeck", "Lubeck", "Germany", "Baltic Coast", 53.8655, 10.6866, "south", 10.6, ["hotel", "hostel", "cabin"], "lean", ["medieval center", "marzipan", "coastal day trips"]],
  ["dresden", "Dresden", "Germany", "Saxony", 51.0504, 13.7373, "south", 14.5, ["hotel", "hostel"], "lean", ["river terraces", "baroque center", "national park access"]],
  ["munich", "Munich", "Germany", "Bavaria", 48.1351, 11.582, "south", 19.3, ["hotel", "hostel", "cabin"], "comfort", ["parks", "lakes", "alpine day trips"]],
  ["nuremberg", "Nuremberg", "Germany", "Bavaria", 49.4521, 11.0767, "south", 17.4, ["hotel", "hostel"], "lean", ["old walls", "museums", "river walks"]],
  ["amsterdam", "Amsterdam", "Netherlands", "Randstad", 52.3676, 4.9041, "south", 17.2, ["hotel", "hostel", "glamping"], "comfort", ["canals", "museums", "bike rides"]],
  ["brussels", "Brussels", "Belgium", "Flanders", 50.8503, 4.3517, "south", 18.8, ["hotel", "hostel"], "balanced", ["grand place", "parks", "food markets"]],
  ["bruges", "Bruges", "Belgium", "West Flanders", 51.2093, 3.2247, "south", 19.7, ["hotel", "hostel"], "comfort", ["canals", "historic center", "coastal trains"]],
  ["luxembourg", "Luxembourg", "Luxembourg", "Benelux", 49.6116, 6.1319, "south", 21.4, ["hotel", "hostel"], "comfort", ["ravines", "old town", "castle day trips"]],
  ["paris", "Paris", "France", "Ile-de-France", 48.8566, 2.3522, "south", 24.8, ["hotel", "hostel"], "comfort", ["museums", "river walks", "neighborhood cafes"]],
  ["strasbourg", "Strasbourg", "France", "Alsace", 48.5734, 7.7521, "south", 21.9, ["hotel", "hostel", "cabin"], "comfort", ["canals", "half-timbered streets", "vineyards"]],
  ["lyon", "Lyon", "France", "Rhone-Alpes", 45.764, 4.8357, "south", 27.2, ["hotel", "hostel"], "comfort", ["river confluence", "food halls", "old town"]],
  ["nice", "Nice", "France", "French Riviera", 43.7102, 7.262, "south", 31.5, ["hotel", "hostel", "glamping"], "comfort", ["Mediterranean coast", "old town", "hill villages"]],
  ["marseille", "Marseille", "France", "Provence", 43.2965, 5.3698, "south", 32.8, ["hotel", "hostel", "glamping"], "comfort", ["calanques", "harbor", "island ferries"]],
  ["zurich", "Zurich", "Switzerland", "Swiss Plateau", 47.3769, 8.5417, "south", 23.6, ["hotel", "hostel", "cabin"], "comfort", ["lake swimming", "old town", "mountain trains"]],
  ["geneva", "Geneva", "Switzerland", "Lake Geneva", 46.2044, 6.1432, "south", 26.4, ["hotel", "hostel", "cabin"], "comfort", ["lakefront", "old town", "alpine day trips"]],
  ["innsbruck", "Innsbruck", "Austria", "Tyrol", 47.2692, 11.4041, "south", 23.2, ["hotel", "hostel", "cabin"], "comfort", ["mountains", "old town", "river cycling"]],
  ["vienna", "Vienna", "Austria", "Lower Austria", 48.2082, 16.3738, "south", 22.5, ["hotel", "hostel"], "comfort", ["parks", "museums", "coffee houses"]],
  ["graz", "Graz", "Austria", "Styria", 47.0707, 15.4395, "south", 23.7, ["hotel", "hostel", "cabin"], "balanced", ["castle hill", "river walks", "food markets"]],
  ["ljubljana", "Ljubljana", "Slovenia", "Central Slovenia", 46.0569, 14.5058, "south", 25.1, ["hotel", "hostel", "cabin"], "balanced", ["river cafes", "castle hill", "lake day trips"]],
  ["zagreb", "Zagreb", "Croatia", "Northern Croatia", 45.815, 15.9819, "south", 25.4, ["hotel", "hostel"], "lean", ["upper town", "parks", "market halls"]],
  ["budapest", "Budapest", "Hungary", "Central Hungary", 47.4979, 19.0402, "south", 23.6, ["hotel", "hostel"], "lean", ["thermal baths", "river views", "ruin bars"]],
  ["bratislava", "Bratislava", "Slovakia", "Danube", 48.1486, 17.1077, "south", 21.7, ["hotel", "hostel"], "lean", ["castle", "riverfront", "small historic center"]],
  ["wroclaw", "Wroclaw", "Poland", "Lower Silesia", 51.1079, 17.0385, "south", 18.2, ["hotel", "hostel"], "lean", ["islands", "market square", "river walks"]],
  ["gdansk", "Gdansk", "Poland", "Baltic Coast", 54.352, 18.6466, "south", 14.6, ["hotel", "hostel", "cabin"], "balanced", ["old town", "beaches", "shipyard history"]],
  ["warsaw", "Warsaw", "Poland", "Mazovia", 52.2297, 21.0122, "south", 16.7, ["hotel", "hostel"], "lean", ["river boulevards", "parks", "old town"]],
  ["poznan", "Poznan", "Poland", "Greater Poland", 52.4064, 16.9252, "south", 15.8, ["hotel", "hostel"], "lean", ["market square", "lake parks", "food halls"]],
  ["venice", "Venice", "Italy", "Veneto", 45.4408, 12.3155, "south", 28.8, ["hotel", "hostel"], "comfort", ["lagoon islands", "historic lanes", "sunset promenades"]],
  ["verona", "Verona", "Italy", "Veneto", 45.4384, 10.9916, "south", 27.2, ["hotel", "hostel", "cabin"], "comfort", ["old center", "river walks", "lake day trips"]],
  ["milan", "Milan", "Italy", "Lombardy", 45.4642, 9.19, "south", 28.6, ["hotel", "hostel"], "comfort", ["design", "parks", "lake access"]],
  ["bologna", "Bologna", "Italy", "Emilia-Romagna", 44.4949, 11.3426, "south", 30.2, ["hotel", "hostel"], "comfort", ["porticos", "food markets", "hills"]],
  ["florence", "Florence", "Italy", "Tuscany", 43.7696, 11.2558, "south", 32.1, ["hotel", "hostel"], "comfort", ["art museums", "hill viewpoints", "river walks"]],
  ["turin", "Turin", "Italy", "Piedmont", 45.0703, 7.6869, "south", 29.7, ["hotel", "hostel"], "comfort", ["cafes", "mountain views", "river parks"]],
  ["frankfurt", "Frankfurt", "Germany", "Hesse", 50.1109, 8.6821, "south", 18.1, ["hotel", "hostel"], "balanced", ["riverfront", "museums", "forest trails"]],
  ["cologne", "Cologne", "Germany", "North Rhine-Westphalia", 50.9375, 6.9603, "south", 18.6, ["hotel", "hostel"], "balanced", ["riverside", "cathedral", "museum quarter"]],
  ["rotterdam", "Rotterdam", "Netherlands", "South Holland", 51.9244, 4.4777, "south", 18.6, ["hotel", "hostel"], "balanced", ["modern architecture", "harbor", "food halls"]],
  ["split", "Split", "Croatia", "Dalmatia", 43.5081, 16.4402, "south", 30.5, ["hotel", "hostel", "glamping"], "comfort", ["seafront", "island ferries", "palace quarter"]],
  ["sarajevo", "Sarajevo", "Bosnia and Herzegovina", "Dinaric Alps", 43.8563, 18.4131, "south", 31.4, ["hotel", "hostel", "cabin"], "lean", ["mountain views", "old bazaar", "river valley"]],
  ["dubrovnik", "Dubrovnik", "Croatia", "Dalmatia", 42.6507, 18.0944, "south", 34.1, ["hotel", "hostel", "glamping"], "comfort", ["sea walls", "island boats", "sunny coves"]],
  ["tromso", "Tromso", "Norway", "Northern Norway", 69.6492, 18.9553, "north", 23.5, ["hotel", "hostel", "cabin"], "comfort", ["fjord views", "midnight sun", "mountain cable car"]]
];

function makeDestination(entry: CatalogEntry): Destination {
  const [id, name, country, region, latitude, longitude, directionFromStockholm, baselineTravelHoursFromStockholm, tags, budgetLevel, highlights] = entry;
  return {
    id,
    name,
    country,
    region,
    directionFromStockholm,
    coordinates: { latitude, longitude },
    tags,
    budgetLevel,
    highlights,
    baselineTravelHoursFromStockholm
  };
}

export const planningDestinations: Destination[] = [...destinations, ...catalog.map(makeDestination)];
