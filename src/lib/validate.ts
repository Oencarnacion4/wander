import type { BudgetMode, ExploreQuery, Interest, Transport } from "./types";

const INTERESTS: Interest[] = ["food", "coffee", "shopping", "sports", "museums", "sights", "nightlife", "outdoors", "entertainment"];
const TRANSPORTS: Transport[] = ["walk", "bike", "transit", "drive", "rideshare"];

function num(v: unknown, name: string, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${name} must be between ${min} and ${max}`);
  return n;
}

/** Validate untrusted JSON from the browser into an ExploreQuery. */
export function parseExploreQuery(raw: unknown): ExploreQuery {
  const b = (raw ?? {}) as Record<string, unknown>;
  const date = String(b.date ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("date must be YYYY-MM-DD");
  const transport = String(b.transport) as Transport;
  if (!TRANSPORTS.includes(transport)) throw new Error("unknown transport");
  const budgetMode = (b.budgetMode === "total" ? "total" : "per_person") as BudgetMode;
  const interests = (Array.isArray(b.interests) ? b.interests : []).filter((i): i is Interest => INTERESTS.includes(i as Interest));
  const children = (Array.isArray(b.children) ? b.children : []).slice(0, 10).map((c) => ({ age: num((c as { age: unknown })?.age, "child age", 0, 17) }));
  const visited: Record<string, string> = {};
  if (b.visited && typeof b.visited === "object") {
    for (const [k, v] of Object.entries(b.visited as Record<string, unknown>).slice(0, 2000)) {
      if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) visited[k] = v.slice(0, 10);
    }
  }
  const wishlist = (Array.isArray(b.wishlist) ? b.wishlist : []).filter((x): x is string => typeof x === "string").slice(0, 2000);
  return {
    lat: num(b.lat, "lat", -90, 90),
    lng: num(b.lng, "lng", -180, 180),
    locationLabel: String(b.locationLabel ?? "").slice(0, 120),
    date,
    startMinutes: num(b.startMinutes, "start time", 0, 1439),
    durationMinutes: num(b.durationMinutes, "duration", 60, 14 * 60),
    budget: num(b.budget, "budget", 0, 100000),
    budgetMode,
    adults: num(b.adults, "adults", 1, 30),
    children,
    transport,
    interests,
    visited,
    wishlist,
    dining: (["any", "casual", "sitdown", "upscale"] as const).find((d) => d === b.dining) ?? "any",
  };
}
