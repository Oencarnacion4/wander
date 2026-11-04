import type { Interest, Place } from "../types";
import { fetchGeoapify } from "./geoapify";
import { fetchOverpass } from "./osm";

/**
 * Where real places come from:
 *   1. Geoapify (fast, reliable) when GEOAPIFY_API_KEY is set.
 *   2. Otherwise, or if Geoapify fails, the free public Overpass servers.
 * Both serve OpenStreetMap data, so results look the same either way.
 */
export async function fetchPlaces(lat: number, lng: number, radiusKm: number, interests: Interest[]): Promise<Place[]> {
  const key = process.env.GEOAPIFY_API_KEY?.trim();
  if (key) {
    try {
      const places = await fetchGeoapify(lat, lng, radiusKm, interests, key);
      if (places.length > 0) return places;
    } catch (e) {
      console.warn("[wander] Geoapify failed, falling back to Overpass:", String(e));
    }
  }
  return fetchOverpass(lat, lng, radiusKm, interests);
}
