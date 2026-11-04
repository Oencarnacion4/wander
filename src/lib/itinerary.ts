import { CATEGORIES } from "./categories";
import { haversineKm, rideshareCost, travelMinutes } from "./geo";
import { openForVisit } from "./hours";
import { totalBudget } from "./scoring";
import type { CostEstimate, ExploreQuery, Itinerary, ItineraryStop, ScoredPlace } from "./types";

/**
 * Building the plan is an "orienteering problem with time windows": choose an
 * ordered set of stops that maximises total value, where each stop must be
 * open when you arrive and everything must fit in your time and budget.
 * That problem is NP-hard, so we use BEAM SEARCH — a greedy search that keeps
 * the best B partial plans at each step instead of just one. It's fast
 * (milliseconds) and finds better plans than pure greedy.
 */
const BEAM_WIDTH = 8;
const EXPANSIONS_PER_STATE = 10;
const CANDIDATE_POOL = 60;
const MAX_WAIT_MIN = 30; // we'll wait up to 30 min for a place to open
const REPEAT_CATEGORY_PENALTY = 0.14;
/**
 * Meals follow how people actually eat: only at meal times, one per meal
 * window, and at least 4 hours apart. Cafés and dessert aren't meals, so
 * they can still follow lunch.
 */
const MEAL_WINDOWS: { name: string; range: [number, number] }[] = [
  { name: "breakfast", range: [7 * 60, 10 * 60 + 30] },
  { name: "lunch", range: [11 * 60, 14 * 60 + 30] },
  { name: "dinner", range: [17 * 60, 21 * 60 + 30] },
];
const MIN_MINUTES_BETWEEN_MEALS = 240;
const TREATS = new Set(["cafe", "dessert"]);
/** Anything you eat or drink at. Two of these in a row (café → sandwich → ice cream) isn't a plan. */
function isFoodStop(category: string) {
  return Boolean(CATEGORIES[category as keyof typeof CATEGORIES]?.meal) || TREATS.has(category);
}
/** Coffee/dessert stops allowed: one per 4 hours of outing. */
function maxTreats(duration: number) {
  return Math.max(1, Math.floor(duration / 240));
}

export function mealWindow(t: number): string | null {
  return MEAL_WINDOWS.find(({ range: [a, b] }) => t >= a && t <= b)?.name ?? null;
}

/** How many meals an outing can include: one per meal window it really overlaps (45+ minutes). */
export function maxMeals(start: number, duration: number): number {
  const end = start + duration;
  return MEAL_WINDOWS.filter(({ range: [a, b] }) => Math.min(end, b) - Math.max(start, a) >= 45).length;
}

interface State {
  stops: ItineraryStop[];
  t: number;
  lat: number;
  lng: number;
  costLow: number;
  costMid: number;
  costHigh: number;
  used: Set<string>;
  catCount: Map<string, number>;
  meals: { at: number; window: string }[];
  treats: number;
  lastWasFood: boolean;
  objective: number;
}

function addCost(a: CostEstimate, rideshare: number): CostEstimate {
  if (!rideshare) return a;
  return {
    low: a.low + rideshare,
    high: a.high + rideshare,
    confidence: "estimated",
    note: `${a.note} + ~$${rideshare} rideshare (estimate)`,
  };
}

/** Try to place candidate `c` next. Returns the stop and its marginal value, or null if infeasible. */
function tryNext(state: State, c: ScoredPlace, q: ExploreQuery, budget: number) {
  const end = q.startMinutes + q.durationMinutes;
  const km = haversineKm(state.lat, state.lng, c.place.lat, c.place.lng);
  const travel = travelMinutes(km, q.transport);
  const rideCost = q.transport === "rideshare" ? rideshareCost(km) : 0;
  const cat = CATEGORIES[c.place.category];

  let arrive = state.t + travel;
  let hoursKnown = false;
  for (let wait = 0; wait <= MAX_WAIT_MIN; wait += 15) {
    const a = state.t + travel + wait;
    if (a + c.durationMinutes > end) return null;
    const open = openForVisit(c.place.openingHours, q.date, a, a + c.durationMinutes);
    if (open === "closed") continue;
    arrive = a;
    hoursKnown = open === "open";
    break;
  }
  const depart = arrive + c.durationMinutes;
  if (depart > end) return null;
  if (c.place.openingHours && !hoursKnown && openForVisit(c.place.openingHours, q.date, arrive, depart) === "closed") return null;

  const cost = addCost(c.cost, rideCost);
  const mid = (cost.low + cost.high) / 2;
  if (state.costLow + cost.low > budget || state.costMid + mid > budget * 1.1) return null;

  if (isFoodStop(c.place.category) && state.lastWasFood) return null;
  if (TREATS.has(c.place.category) && state.treats >= maxTreats(q.durationMinutes)) return null;
  if (cat.meal) {
    const w = mealWindow(arrive);
    if (!w) return null; // no sit-down meals at 3:30pm
    if (state.meals.length >= maxMeals(q.startMinutes, q.durationMinutes)) return null;
    if (state.meals.some((m) => m.window === w || arrive - m.at < MIN_MINUTES_BETWEEN_MEALS)) return null;
  }

  // Value of a stop: its score, discounted for travel, and scaled so that
  // substantial visits count more than quick hops (avoids 8 tiny stops).
  let gain = c.score * Math.exp(-travel / 25) * (0.55 + 0.45 * Math.min(1, c.durationMinutes / 90));
  gain -= (state.catCount.get(c.place.category) ?? 0) * REPEAT_CATEGORY_PENALTY;
  // Eating at mealtime is part of a good day out.
  if (cat.meal) gain += c.place.category === "restaurant" ? 0.12 : 0.06;
  // Asked for a fancy night out: make dinner the centerpiece.
  if (q.dining === "upscale" && c.place.category === "restaurant" && mealWindow(arrive) === "dinner") gain += 0.25;
  // Time spent waiting is wasted time.
  gain -= (arrive - state.t - travel) * 0.002;
  if (gain <= 0) return null;

  const stop: ItineraryStop = { placeId: c.place.id, arrive, depart, travelMinutes: travel, cost };
  return { stop, gain, mid };
}

export function buildItinerary(candidates: ScoredPlace[], q: ExploreQuery): Itinerary {
  const budget = totalBudget(q);
  // Event venues (stadiums, theaters) are never auto-added: without a scheduled event there is nothing to do there.
  const pool = candidates.filter((c) => !CATEGORIES[c.place.category].eventOnly).slice(0, CANDIDATE_POOL);
  const start: State = {
    stops: [],
    t: q.startMinutes,
    lat: q.lat,
    lng: q.lng,
    costLow: 0,
    costMid: 0,
    costHigh: 0,
    used: new Set(),
    catCount: new Map(),
    meals: [],
    treats: 0,
    lastWasFood: false,
    objective: 0,
  };
  let beam: State[] = [start];
  let best = start;

  for (let depth = 0; depth < 12 && beam.length; depth++) {
    const next: State[] = [];
    for (const s of beam) {
      const moves = pool
        .filter((c) => !s.used.has(c.place.id))
        .map((c) => ({ c, r: tryNext(s, c, q, budget) }))
        .filter((m): m is { c: ScoredPlace; r: NonNullable<ReturnType<typeof tryNext>> } => m.r !== null)
        .sort((a, b) => b.r.gain - a.r.gain)
        .slice(0, EXPANSIONS_PER_STATE);
      for (const { c, r } of moves) {
        const catCount = new Map(s.catCount);
        catCount.set(c.place.category, (catCount.get(c.place.category) ?? 0) + 1);
        next.push({
          stops: [...s.stops, r.stop],
          t: r.stop.depart,
          lat: c.place.lat,
          lng: c.place.lng,
          costLow: s.costLow + r.stop.cost.low,
          costMid: s.costMid + r.mid,
          costHigh: s.costHigh + r.stop.cost.high,
          used: new Set([...s.used, c.place.id]),
          catCount,
          meals: CATEGORIES[c.place.category].meal ? [...s.meals, { at: r.stop.arrive, window: mealWindow(r.stop.arrive) ?? "" }] : s.meals,
          treats: s.treats + (TREATS.has(c.place.category) ? 1 : 0),
          lastWasFood: isFoodStop(c.place.category),
          objective: s.objective + r.gain,
        });
      }
    }
    // Deduplicate plans that visit the same set of places, keep the best B.
    const seen = new Set<string>();
    beam = next
      .sort((a, b) => b.objective - a.objective)
      .filter((s) => {
        const key = [...s.used].sort().join("|");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, BEAM_WIDTH);
    for (const s of beam) if (s.objective > best.objective) best = s;
  }

  const notes: string[] = [];
  if (q.dining === "upscale" && !best.stops.some((st) => pool.find((c) => c.place.id === st.placeId)?.place.category === "restaurant")) {
    notes.push("No restaurant nearby looked upscale in the map data, or none fit your time and budget. Try Sit-down, a bigger budget, or an evening start.");
  }
  if (best.stops.length === 0) notes.push("Nothing fit all of your constraints. Try more time, a bigger budget, or a different transport mode.");
  const endMinutes = best.stops.length ? best.stops[best.stops.length - 1].depart : q.startMinutes;
  if (endMinutes < q.startMinutes + q.durationMinutes - 45 && best.stops.length) {
    notes.push(`Leaves about ${Math.round((q.startMinutes + q.durationMinutes - endMinutes) / 5) * 5} minutes free — room to linger.`);
  }
  return {
    stops: best.stops,
    totalCostLow: best.costLow,
    totalCostHigh: best.costHigh,
    endMinutes,
    objective: best.objective,
    notes,
  };
}

/**
 * Recompute arrival times for a hand-edited list of stops (after a swap,
 * removal or reorder). Flags anything that no longer works instead of hiding it.
 */
export function retime(placeIds: string[], byId: Map<string, ScoredPlace>, q: ExploreQuery): Itinerary {
  const end = q.startMinutes + q.durationMinutes;
  const budget = totalBudget(q);
  const notes: string[] = [];
  const stops: ItineraryStop[] = [];
  let t = q.startMinutes;
  let lat = q.lat;
  let lng = q.lng;
  let low = 0;
  let high = 0;
  for (const id of placeIds) {
    const c = byId.get(id);
    if (!c) continue;
    const km = haversineKm(lat, lng, c.place.lat, c.place.lng);
    const travel = travelMinutes(km, q.transport);
    let arrive = t + travel;
    for (let wait = 0; wait <= MAX_WAIT_MIN; wait += 15) {
      if (openForVisit(c.place.openingHours, q.date, t + travel + wait, t + travel + wait + c.durationMinutes) !== "closed") {
        arrive = t + travel + wait;
        break;
      }
    }
    const depart = arrive + c.durationMinutes;
    if (openForVisit(c.place.openingHours, q.date, arrive, depart) === "closed") notes.push(`${c.place.name} may be closed when you'd arrive.`);
    const cost = addCost(c.cost, q.transport === "rideshare" ? rideshareCost(km) : 0);
    stops.push({ placeId: id, arrive, depart, travelMinutes: travel, cost });
    low += cost.low;
    high += cost.high;
    t = depart;
    lat = c.place.lat;
    lng = c.place.lng;
  }
  for (let i = 1; i < stops.length; i++) {
    const a = byId.get(stops[i - 1].placeId)!.place;
    const b = byId.get(stops[i].placeId)!.place;
    if (isFoodStop(a.category) && isFoodStop(b.category)) notes.push(`${a.name} and ${b.name} are back-to-back food stops.`);
  }
  const meals = stops.filter((st) => CATEGORIES[byId.get(st.placeId)!.place.category].meal);
  for (let i = 1; i < meals.length; i++) {
    if (meals[i].arrive - meals[i - 1].arrive < MIN_MINUTES_BETWEEN_MEALS) {
      notes.push(`${byId.get(meals[i - 1].placeId)!.place.name} and ${byId.get(meals[i].placeId)!.place.name} are two meals close together.`);
    }
  }
  if (t > end) notes.push(`This plan runs ${t - end} minutes past your end time.`);
  if (low > budget) notes.push("This plan is likely over your budget.");
  const objective = stops.reduce((s, st) => s + (byId.get(st.placeId)?.score ?? 0), 0);
  return { stops, totalCostLow: low, totalCostHigh: high, endMinutes: t, objective, notes };
}

/** Ranked replacements for the stop at `index` that keep the rest of the plan valid. */
export function swapOptions(placeIds: string[], index: number, candidates: ScoredPlace[], q: ExploreQuery, limit = 6) {
  const byId = new Map(candidates.map((c) => [c.place.id, c]));
  const baseline = retime(placeIds, byId, q).notes.length;
  const inPlan = new Set(placeIds);
  const out: { candidate: ScoredPlace; itinerary: Itinerary }[] = [];
  for (const c of candidates) {
    if (inPlan.has(c.place.id) || CATEGORIES[c.place.category].eventOnly) continue;
    const ids = [...placeIds];
    ids[index] = c.place.id;
    const it = retime(ids, byId, q);
    if (it.notes.length > baseline) continue; // would break something that worked
    out.push({ candidate: c, itinerary: it });
    if (out.length >= limit * 3) break;
  }
  // Prefer high scores and keep variety: favour a different category than the one being replaced.
  const replaced = byId.get(placeIds[index])?.place.category;
  return out
    .sort((a, b) => b.candidate.score - (b.candidate.place.category === replaced ? 0.05 : 0) - (a.candidate.score - (a.candidate.place.category === replaced ? 0.05 : 0)))
    .slice(0, limit);
}
