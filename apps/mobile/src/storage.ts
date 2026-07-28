import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SavedTrip } from "@weathertrip/shared";

const savedTripsKey = "weathertrip.savedTrips.v2";

export async function loadLocalTrips(): Promise<SavedTrip[]> {
  const raw = await AsyncStorage.getItem(savedTripsKey);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as SavedTrip[];
  } catch {
    return [];
  }
}

export async function saveLocalTrip(trip: SavedTrip): Promise<SavedTrip[]> {
  const trips = [trip, ...(await loadLocalTrips()).filter((item) => item.id !== trip.id)];
  await AsyncStorage.setItem(savedTripsKey, JSON.stringify(trips));
  return trips;
}

export async function replaceLocalTrips(trips: SavedTrip[]): Promise<void> {
  await AsyncStorage.setItem(savedTripsKey, JSON.stringify(trips));
}

export async function removeLocalTrip(id: string): Promise<SavedTrip[]> {
  const trips = (await loadLocalTrips()).filter((trip) => trip.id !== id);
  await replaceLocalTrips(trips);
  return trips;
}
