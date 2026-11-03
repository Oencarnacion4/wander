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
const LUNCH: [number, number] = [11 * 60 + 15, 14 * 60];
const DINNER: [number, number] = [17 * 60 + 15, 20 * 60 + 30];

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
  lastMealAt: number | null;
  objective: number;
}

function inWindow(t: number, [a, b]: [number, number]) {
  return t >= a && t <= b;
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

  // Meals: at most one per meal window, never two meals within 2.5 hours.
  if (cat.meal && state.lastMealAt !== null && arrive - state.lastMealAt < 150) return null;

  // Value of a stop: its score, discounted for travel, and scaled so that
  // substantial visits count more than quick hops (avoids 8 tiny stops).
  let gain = c.score * Math.exp(-travel / 25) * (0.55 + 0.45 * Math.min(1, c.durationMinutes / 90));
  gain -= (state.catCount.get(c.place.category) ?? 0) * REPEAT_CATEGORY_PENALTY;
  if (cat.meal && c.place.category === "restaurant") {
    gain += inWindow(arrive, LUNCH) || inWindow(arrive, DINNER) ? 0.12 : -0.15;
  }
  // Time spent waiting is wasted time.
  gain -= (arrive - state.t - travel) * 0.002;
  if (gain <= 0) return null;

  const stop: ItineraryStop = { placeId: c.place.id, arrive, depart, travelMinutes: travel, cost };
  return { stop, gain, mid };
}

export function buildItinerary(candidates: ScoredPlace[], q: ExploreQuery): Itinerary {
  const budget = totalBudget(q);
  const pool = candidates.slice(0, CANDIDATE_POOL);
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
    lastMealAt: null,
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
          lastMealAt: CATEGORIES[c.place.category].meal ? r.stop.arrive : s.lastMealAt,
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
    if (inPlan.has(c.place.id)) continue;
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
