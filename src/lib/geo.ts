import type { Transport } from "./types";

const R = 6371; // Earth radius in km

/** Great-circle distance in km (haversine formula). */
export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Travel model. Streets aren't straight lines, so straight-line distance is
 * multiplied by a "detour factor" (~1.3 is a common urban average). Then a
 * typical speed plus fixed overhead (waiting, parking) gives minutes.
 * These are ESTIMATES and the UI labels them as such.
 */
export const TRANSPORT: Record<Transport, { label: string; kmh: number; overhead: number; detour: number; maxRadiusKm: number }> = {
  walk: { label: "Walking", kmh: 4.8, overhead: 0, detour: 1.25, maxRadiusKm: 2.5 },
  bike: { label: "Biking", kmh: 14, overhead: 2, detour: 1.3, maxRadiusKm: 7 },
  transit: { label: "Public transit", kmh: 18, overhead: 9, detour: 1.35, maxRadiusKm: 8 },
  rideshare: { label: "Rideshare / taxi", kmh: 32, overhead: 7, detour: 1.35, maxRadiusKm: 10 },
  drive: { label: "Driving", kmh: 35, overhead: 5, detour: 1.35, maxRadiusKm: 12 },
};

export function travelMinutes(km: number, mode: Transport): number {
  const t = TRANSPORT[mode];
  if (km < 0.05) return 0;
  // Very short hops are walked even if you have a car.
  if (mode !== "walk" && km < 0.6) return Math.max(2, Math.round(((km * 1.25) / 4.8) * 60));
  return Math.max(2, Math.round(((km * t.detour) / t.kmh) * 60 + t.overhead));
}

/** Search radius: how far it's reasonable to go given the mode and total time. */
export function searchRadiusKm(mode: Transport, durationMinutes: number): number {
  const t = TRANSPORT[mode];
  // Spend at most ~25% of the outing getting to the farthest stop.
  const budgetMin = Math.max(15, durationMinutes * 0.25);
  const reach = (((budgetMin - t.overhead) / 60) * t.kmh) / t.detour;
  return Math.max(1, Math.min(t.maxRadiusKm, Math.round(reach * 10) / 10));
}

/** Rideshare is the only mode with a per-km cost we add to the budget (estimate). */
export function rideshareCost(km: number): number {
  return km < 0.6 ? 0 : Math.round(4 + km * 1.6);
}
