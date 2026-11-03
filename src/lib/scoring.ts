import { CATEGORIES, RELATED_INTERESTS } from "./categories";
import { haversineKm, travelMinutes } from "./geo";
import { hoursStatus, openForVisit } from "./hours";
import type { CostEstimate, ExploreQuery, Place, ScoreBreakdown, ScoredPlace } from "./types";

/**
 * WANDER's recommender is a transparent multi-attribute utility model:
 *
 *   1. HARD CONSTRAINTS remove places that can't work at all
 *      (closed the whole time, not allowed for kids, over budget, too far, too long).
 *   2. Every remaining place gets seven FEATURES, each scaled to 0..1.
 *   3. The SCORE is a weighted sum of the features:  U = Σ wᵢ · xᵢ  (weights sum to 1).
 *
 * Because it's a weighted sum, every recommendation can be explained by
 * showing the per-feature contributions — the UI does exactly that.
 */
export const WEIGHTS: Record<keyof ScoreBreakdown, number> = {
  interest: 0.28,
  proximity: 0.17,
  cost: 0.14,
  group: 0.12,
  timeOfDay: 0.1,
  quality: 0.11,
  novelty: 0.08,
};

export const FEATURE_LABELS: Record<keyof ScoreBreakdown, string> = {
  interest: "Matches your interests",
  proximity: "Close by",
  cost: "Fits your budget",
  group: "Right for your group",
  timeOfDay: "Good time of day",
  quality: "Well-documented place",
  novelty: "Something new",
};

/** Proximity decays exponentially: a place 15 travel-minutes away scores e⁻¹ ≈ 0.37. */
const PROXIMITY_TAU_MIN = 15;
/** Revisiting is allowed; a recent visit just lowers novelty, recovering over ~3 months. */
const NOVELTY_RECOVERY_DAYS = 90;
const WISHLIST_BONUS = 0.06;

/** Categories whose visit can shrink to fit the time you have (you can do a short park walk). */
const FLEXIBLE = new Set(["park", "garden", "nature", "beach", "mall", "zoo", "market", "playground", "theme_park"]);

export function groupSize(q: Pick<ExploreQuery, "adults" | "children">): number {
  return q.adults + q.children.length;
}

export function totalBudget(q: Pick<ExploreQuery, "budget" | "budgetMode" | "adults" | "children">): number {
  return q.budgetMode === "per_person" ? q.budget * groupSize(q) : q.budget;
}

/** Cost for the whole group. Uses the source's fee tag when present; otherwise the category's typical range. */
export function estimateCost(place: Place, q: Pick<ExploreQuery, "adults" | "children">): CostEstimate {
  const cat = CATEGORIES[place.category];
  if (place.fee === "free") {
    return { low: 0, high: 0, confidence: "confirmed", note: "Free entry (listed on OpenStreetMap)" };
  }
  const payingUnits =
    q.adults +
    q.children.reduce((s, c) => s + (c.age < 3 ? 0 : c.age <= 12 ? cat.childCostFactor : 1), 0);
  const high = cat.cost[1];
  let low = cat.cost[0];
  if (place.fee === "paid" && low === 0) low = Math.min(5, high || 5);
  const est = { low: Math.round(low * payingUnits), high: Math.round(high * payingUnits) };
  if (est.high === 0) {
    return { ...est, confidence: "estimated", note: `Usually free for a ${cat.label.toLowerCase()}` };
  }
  const listed = place.charge ? ` · listed charge: ${place.charge}` : "";
  return { ...est, confidence: "estimated", note: `Typical spend for a ${cat.label.toLowerCase()}${listed}` };
}

export function visitDuration(place: Place, windowMinutes: number): number | null {
  const typical = CATEGORIES[place.category].duration;
  if (typical <= windowMinutes) return typical;
  if (FLEXIBLE.has(place.category)) return Math.max(30, Math.round((windowMinutes * 0.6) / 5) * 5);
  return null; // e.g. a 2.5 hour movie when you only have 2 hours
}

function interestFeature(place: Place, q: ExploreQuery): number {
  if (q.interests.length === 0) return 0.6; // no preference given: neutral
  const own = CATEGORIES[place.category].interests;
  if (own.some((i) => q.interests.includes(i))) {
    // Primary interest match is worth slightly more than a secondary one.
    return q.interests.includes(own[0]) ? 1 : 0.85;
  }
  const related = q.interests.flatMap((i) => RELATED_INTERESTS[i]);
  return own.some((i) => related.includes(i)) ? 0.4 : 0.1;
}

/** Fraction of the outing spent in morning / afternoon / evening, dotted with the category's suitability. */
function timeOfDayFeature(place: Place, start: number, duration: number): number {
  const s = CATEGORIES[place.category].timeOfDay;
  const bands: [number, number, number][] = [
    [0, 720, s[0]],
    [720, 1020, s[1]],
    [1020, 1440 * 2, s[2]],
  ];
  const end = start + duration;
  let acc = 0;
  for (const [a, b, w] of bands) acc += Math.max(0, Math.min(end, b) - Math.max(start, a)) * w;
  return duration > 0 ? acc / duration : s[1];
}

function groupFeature(place: Place, q: ExploreQuery): number {
  const cat = CATEGORIES[place.category];
  if (q.children.length === 0) {
    if (place.category === "playground") return 0.2;
    return 1;
  }
  // The group is only as happy as its least-suited member.
  return Math.min(...q.children.map((c) => (c.age < 6 ? cat.kidsYoung : c.age <= 12 ? cat.kidsOlder : 1)));
}

function qualityFeature(place: Place): number {
  return Math.min(
    1,
    0.3 +
      (place.notable ? 0.3 : 0) +
      (place.website ? 0.15 : 0) +
      (place.openingHours ? 0.15 : 0) +
      (place.address || place.phone ? 0.1 : 0),
  );
}

function costFeature(cost: CostEstimate, budget: number): number {
  if (cost.high === 0) return 1;
  if (budget <= 0) return 0;
  // Smoothly penalise places that would eat a large share of the total budget.
  const ratio = (cost.low + cost.high) / 2 / budget;
  if (ratio <= 0.35) return 1;
  return Math.max(0, 1 - (ratio - 0.35) / 0.65);
}

function noveltyFeature(lastVisit: string | undefined, today: string): number {
  if (!lastVisit) return 1;
  const days = Math.max(0, (Date.parse(today) - Date.parse(lastVisit)) / 86400000);
  return 1 - 0.6 * Math.exp(-days / NOVELTY_RECOVERY_DAYS);
}

/**
 * Find whether the place is open for a full visit at some point in the window.
 * We try start times every 30 minutes.
 */
function openSomewhereInWindow(place: Place, q: ExploreQuery, duration: number): "open" | "closed" | "unknown" {
  if (!place.openingHours) return "unknown";
  let sawUnknown = false;
  for (let t = q.startMinutes; t + duration <= q.startMinutes + q.durationMinutes; t += 30) {
    const r = openForVisit(place.openingHours, q.date, t, t + duration);
    if (r === "open") return "open";
    if (r === "unknown") sawUnknown = true;
  }
  return sawUnknown ? "unknown" : "closed";
}

export type ExclusionReason = "closed" | "kids" | "budget" | "distance" | "duration" | "nightlife_hours";

export function scorePlace(place: Place, q: ExploreQuery): { scored?: ScoredPlace; excluded?: ExclusionReason } {
  const budget = totalBudget(q);
  const duration = visitDuration(place, q.durationMinutes);
  if (duration === null) return { excluded: "duration" };

  const group = groupFeature(place, q);
  if (group === 0) return { excluded: "kids" };

  const distanceKm = haversineKm(q.lat, q.lng, place.lat, place.lng);
  const travel = travelMinutes(distanceKm, q.transport);
  if (travel > Math.max(20, q.durationMinutes * 0.4)) return { excluded: "distance" };

  const cost = estimateCost(place, q);
  if (cost.low > budget) return { excluded: "budget" };

  const tod = timeOfDayFeature(place, q.startMinutes, q.durationMinutes);
  if (tod === 0) return { excluded: "nightlife_hours" };

  const open = openSomewhereInWindow(place, q, duration);
  if (open === "closed") return { excluded: "closed" };

  const breakdown: ScoreBreakdown = {
    interest: interestFeature(place, q),
    proximity: Math.exp(-travel / PROXIMITY_TAU_MIN),
    cost: costFeature(cost, budget),
    group,
    timeOfDay: tod,
    quality: qualityFeature(place),
    novelty: noveltyFeature(q.visited?.[place.id], q.date),
  };
  const onWishlist = q.wishlist?.includes(place.id) ?? false;
  let score = (Object.keys(WEIGHTS) as (keyof ScoreBreakdown)[]).reduce((s, k) => s + WEIGHTS[k] * breakdown[k], 0);
  if (onWishlist) score += WISHLIST_BONUS;
  // Unknown hours aren't excluded, but carry a small uncertainty penalty.
  if (open === "unknown") score -= 0.04;
  score = Math.max(0, Math.min(1, score));

  const hours = open === "unknown" && place.openingHours ? { confidence: "unknown" as const, label: `Listed as "${place.openingHours}"` } : hoursStatus(place.openingHours, q.date);

  const reasons = (Object.keys(WEIGHTS) as (keyof ScoreBreakdown)[])
    .map((k) => ({ k, contribution: WEIGHTS[k] * breakdown[k], value: breakdown[k] }))
    .filter((r) => r.value >= 0.8)
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 3)
    .map((r) => FEATURE_LABELS[r.k]);
  if (onWishlist) reasons.unshift("On your wishlist");

  const warnings: string[] = [];
  if (open === "unknown") warnings.push("Opening hours not confirmed");
  if (q.visited?.[place.id]) warnings.push(`You've been here (last ${q.visited[place.id]})`);

  return {
    scored: {
      place,
      score,
      breakdown,
      distanceKm,
      travelMinutes: travel,
      cost,
      durationMinutes: duration,
      hours,
      visitedBefore: q.visited?.[place.id],
      onWishlist,
      reasons,
      warnings,
    },
  };
}

export const EXCLUSION_LABELS: Record<ExclusionReason, string> = {
  closed: "closed during your time",
  kids: "not suitable for your kids",
  budget: "over budget",
  distance: "too far for your transport",
  duration: "need more time than you have",
  nightlife_hours: "wrong time of day",
};

export function rankPlaces(places: Place[], q: ExploreQuery) {
  const excluded: Record<string, number> = {};
  const scored: ScoredPlace[] = [];
  for (const p of places) {
    const r = scorePlace(p, q);
    if (r.scored) scored.push(r.scored);
    else if (r.excluded) excluded[r.excluded] = (excluded[r.excluded] ?? 0) + 1;
  }
  scored.sort((a, b) => b.score - a.score);
  return { scored, excluded };
}
