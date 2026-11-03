import { DESTINATIONS, TIER_DAILY, type DestTag, type Destination } from "./destinations";
import { haversineKm } from "./geo";
import type { BudgetMode, Interest } from "./types";

/**
 * Take Me Somewhere ranks destinations with the same idea as Explore My City:
 * hard constraints first, then a weighted sum of 0..1 features.
 * Trip costs are formula-based ESTIMATES and are always labeled that way.
 */

export type TripMode = "drive" | "ground" | "fly";

export interface TripQuery {
  originLat: number;
  originLng: number;
  originCountry: string;
  startDate: string;
  nights: number;
  budget: number;
  budgetMode: BudgetMode;
  adults: number;
  kids: number[];
  modes: TripMode[];
  maxTravelHours: number;
  scope: "domestic" | "anywhere";
  interests: DestTag[];
  /** City names the user has logged visits in. */
  visitedCities?: string[];
}

export interface TravelOption {
  mode: TripMode;
  hours: number;
  cost: number;
}

export interface ScoredDestination {
  dest: Destination;
  score: number;
  breakdown: Record<keyof typeof TRIP_WEIGHTS, number>;
  distanceKm: number;
  travel: TravelOption;
  stayCost: number;
  totalLow: number;
  totalHigh: number;
  inSeason: boolean;
  passport: boolean;
  reasons: string[];
}

export const TRIP_WEIGHTS = { interest: 0.3, cost: 0.22, travel: 0.18, season: 0.15, group: 0.1, novelty: 0.05 };
export const TRIP_LABELS: Record<keyof typeof TRIP_WEIGHTS, string> = {
  interest: "Matches what you're into",
  cost: "Fits your budget",
  travel: "Worth the travel time",
  season: "Good time of year",
  group: "Right for your group",
  novelty: "Somewhere new",
};

// Rough "can you get there over land" groups. Islands get their own group.
const LANDMASS: Record<string, string> = {
  US: "na", CA: "na", MX: "na",
  GB: "eu", IE: "ie", FR: "eu", NL: "eu", ES: "eu", PT: "eu", IT: "eu", GR: "eu", CZ: "eu", HU: "eu", TR: "eu", DE: "eu", BE: "eu", CH: "eu", AT: "eu", PL: "eu",
  CO: "sa", PE: "sa", AR: "sa", BR: "sa", MA: "af", ZA: "af", KR: "kr", TH: "sea", SG: "sea",
};
const ISLAND_IDS = new Set(["honolulu", "sanjuan", "reykjavik", "bali", "sydney", "tokyo", "kyoto"]);

function landmass(code: string, id?: string) {
  if (id && ISLAND_IDS.has(id)) return `island:${id === "kyoto" ? "tokyo" : id}`;
  return LANDMASS[code] ?? `other:${code}`;
}

export function travelOptions(km: number, sameLand: boolean, people: number, payingFlyers: number): TravelOption[] {
  const out: TravelOption[] = [];
  const road = km * 1.25;
  if (sameLand && road < 5000) {
    const cars = Math.ceil(people / 5);
    // Fuel + wear ~ $0.18/km, round trip, per car. Long drives add rest stops.
    out.push({ mode: "drive", hours: road / 85 + Math.floor(road / 400) * 0.33, cost: Math.round(road * 2 * 0.18 * cars) });
  }
  if (sameLand && road < 1500) {
    out.push({ mode: "ground", hours: road / 65 + 0.75, cost: Math.round((road * 0.1 + 12) * 2 * people) });
  }
  if (km > 250) {
    // Round-trip economy fare model: base + per-km. Plus ~2.5 h of airport time each way.
    out.push({ mode: "fly", hours: km / 780 + 2.5, cost: Math.round(2 * (60 + 0.075 * km) * payingFlyers) });
  }
  return out;
}

function month(date: string) {
  return Number(date.split("-")[1]);
}

export function rankDestinations(q: TripQuery): { results: ScoredDestination[]; excluded: Record<string, number> } {
  const people = q.adults + q.kids.length;
  const budget = q.budgetMode === "per_person" ? q.budget * people : q.budget;
  const days = q.nights + 1;
  const flyers = q.adults + q.kids.filter((a) => a >= 2).length;
  const stayUnits = q.adults + q.kids.reduce((s, a) => s + (a < 3 ? 0.1 : a <= 12 ? 0.5 : 0.8), 0);
  const m = month(q.startDate);
  const originLand = landmass(q.originCountry);
  const excluded: Record<string, number> = {};
  const bump = (k: string) => (excluded[k] = (excluded[k] ?? 0) + 1);
  const results: ScoredDestination[] = [];

  for (const d of DESTINATIONS) {
    const km = haversineKm(q.originLat, q.originLng, d.lat, d.lng);
    if (km < 60) continue; // that's Explore My City territory
    const domestic = d.countryCode === q.originCountry || (q.originCountry === "US" && d.countryCode === "PR");
    if (q.scope === "domestic" && !domestic) {
      bump("outside your country");
      continue;
    }
    const sameLand = landmass(d.countryCode, d.id) === originLand;
    const options = travelOptions(km, sameLand, people, flyers).filter((o) => q.modes.includes(o.mode) && o.hours <= q.maxTravelHours);
    if (!options.length) {
      bump("too far for your travel limits");
      continue;
    }
    const stayCost = Math.round(TIER_DAILY[d.costTier] * stayUnits * days);
    // Pick the option with the best balance of time and money (an hour of travel is "worth" $25/person).
    const travel = options.reduce((best, o) => (o.cost + o.hours * 25 * people < best.cost + best.hours * 25 * people ? o : best));
    const mid = travel.cost + stayCost;
    const totalLow = Math.round(mid * 0.8);
    const totalHigh = Math.round(mid * 1.25);
    if (totalLow > budget) {
      bump("over budget");
      continue;
    }
    const interest = q.interests.length ? q.interests.filter((t) => d.tags.includes(t)).length / q.interests.length : 0.6;
    const ratio = mid / Math.max(1, budget);
    const cost = ratio <= 0.75 ? 1 : Math.max(0, 1 - (ratio - 0.75) / 0.5);
    // Share of waking hours spent travelling (round trip).
    const travelShare = (travel.hours * 2) / (days * 15);
    const travelF = Math.max(0, 1 - travelShare * 1.6);
    const inSeason = d.bestMonths.includes(m);
    const season = inSeason ? 1 : 0.35;
    const group = q.kids.length ? (d.tags.includes("family") ? 1 : d.tags.includes("nightlife") && d.tags.length <= 4 ? 0.45 : 0.75) : 1;
    const visited = q.visitedCities?.some((c) => c.toLowerCase().includes(d.name.toLowerCase().split(" (")[0].toLowerCase()));
    const novelty = visited ? 0.4 : 1;
    const breakdown = { interest, cost, travel: travelF, season, group, novelty };
    const score = (Object.keys(TRIP_WEIGHTS) as (keyof typeof TRIP_WEIGHTS)[]).reduce((s, k) => s + TRIP_WEIGHTS[k] * breakdown[k], 0);
    const reasons = (Object.keys(TRIP_WEIGHTS) as (keyof typeof TRIP_WEIGHTS)[])
      .filter((k) => breakdown[k] >= 0.8)
      .sort((a, b) => TRIP_WEIGHTS[b] * breakdown[b] - TRIP_WEIGHTS[a] * breakdown[a])
      .slice(0, 3)
      .map((k) => TRIP_LABELS[k]);
    results.push({ dest: d, score, breakdown, distanceKm: km, travel, stayCost, totalLow, totalHigh, inSeason, passport: !domestic, reasons });
  }
  results.sort((a, b) => b.score - a.score);
  return { results, excluded };
}

/**
 * Surprise Me: weighted random choice among the top matches.
 * P(i) = exp(score_i / T) / Σ exp(score_j / T)  — a softmax. Lower T = safer picks.
 */
export function surprisePick<T extends { score: number }>(items: T[], temperature = 0.06, rand = Math.random): T | null {
  const pool = items.slice(0, 15);
  if (!pool.length) return null;
  const max = Math.max(...pool.map((p) => p.score));
  const weights = pool.map((p) => Math.exp((p.score - max) / temperature));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

/** Map destination vibes to Explore interests when building the day-by-day plan. */
export function tagsToInterests(tags: DestTag[], hasKids: boolean): Interest[] {
  const map: Record<DestTag, Interest[]> = {
    food: ["food"],
    culture: ["museums"],
    history: ["sights", "museums"],
    nightlife: hasKids ? [] : ["nightlife"],
    outdoors: ["outdoors"],
    mountains: ["outdoors"],
    beach: ["outdoors"],
    city: ["sights", "shopping"],
    family: ["entertainment", "outdoors"],
    relaxing: ["coffee", "outdoors"],
  };
  return [...new Set(tags.flatMap((t) => map[t]))];
}

export const MODE_LABELS: Record<TripMode, string> = { drive: "Drive", ground: "Train / bus", fly: "Fly" };
