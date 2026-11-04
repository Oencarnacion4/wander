import { describe, expect, it } from "vitest";
import { buildItinerary, retime, swapOptions } from "../itinerary";
import { classify, normalize } from "../providers/osm";
import { estimateCost, rankPlaces, scorePlace, totalBudget } from "../scoring";
import { openForVisit } from "../hours";
import type { ExploreQuery, Place } from "../types";

// TEST FIXTURES ONLY — fictional places used to exercise the math. Never shown in the app.
const base = { lat: 36.0, lng: -78.9 };
function place(id: string, category: Place["category"], dLat: number, extra: Partial<Place> = {}): Place {
  return { id, name: `Fixture ${id}`, lat: base.lat + dLat, lng: base.lng, category, kind: category, notable: false, source: "openstreetmap", ...extra };
}
const q: ExploreQuery = {
  ...base,
  locationLabel: "Test",
  date: "2026-11-07", // a Saturday
  startMinutes: 10 * 60,
  durationMinutes: 4 * 60,
  budget: 50,
  budgetMode: "total",
  adults: 2,
  children: [{ age: 4 }],
  transport: "drive",
  interests: ["outdoors", "entertainment"],
};

describe("hard constraints", () => {
  it("excludes bars when young kids are coming", () => {
    expect(scorePlace(place("b", "bar", 0.01), q).excluded).toBe("kids");
  });
  it("excludes places closed for the whole window", () => {
    const p = place("m", "museum", 0.01, { openingHours: "Sa 18:00-22:00" });
    expect(scorePlace(p, q).excluded).toBe("closed");
  });
  it("keeps places with unknown hours but warns", () => {
    const r = scorePlace(place("p", "park", 0.01), q);
    expect(r.scored?.warnings).toContain("Opening hours not confirmed");
  });
  it("excludes things over budget", () => {
    expect(scorePlace(place("t", "theme_park", 0.01), q).excluded).toBe("budget");
  });
});

describe("costs", () => {
  it("is free and confirmed when OSM says fee=no", () => {
    expect(estimateCost(place("z", "zoo", 0, { fee: "free" }), q)).toMatchObject({ low: 0, high: 0, confidence: "confirmed" });
  });
  it("labels category prices as estimates and discounts kids", () => {
    const c = estimateCost(place("c", "cinema", 0), q);
    expect(c.confidence).toBe("estimated");
    expect(c.low).toBe(Math.round(11 * (2 + 0.75)));
  });
  it("converts per-person budgets to group totals", () => {
    expect(totalBudget({ ...q, budget: 20, budgetMode: "per_person" })).toBe(60);
  });
});

describe("ranking", () => {
  it("ranks a nearby interest match above a far non-match", () => {
    const near = place("near", "park", 0.005, { openingHours: "Mo-Su 06:00-21:00" });
    const far = place("far", "gallery", 0.08);
    const { scored } = rankPlaces([far, near], q);
    expect(scored[0].place.id).toBe("near");
  });
  it("still recommends a visited place, just with lower novelty", () => {
    const p = place("bowl", "bowling", 0.01);
    const fresh = scorePlace(p, q).scored!;
    const visited = scorePlace(p, { ...q, visited: { bowl: "2026-11-01" } }).scored!;
    expect(visited).toBeDefined();
    expect(visited.score).toBeLessThan(fresh.score);
    const longAgo = scorePlace(p, { ...q, visited: { bowl: "2024-01-01" } }).scored!;
    expect(longAgo.score).toBeGreaterThan(visited.score);
  });
});

describe("itinerary", () => {
  const places = [
    place("park", "park", 0.004, { openingHours: "Mo-Su 06:00-21:00" }),
    place("zoo", "zoo", 0.02, { openingHours: "Mo-Su 09:00-17:00", fee: "free" }),
    place("lunch", "restaurant", 0.012, { openingHours: "Mo-Su 11:00-22:00" }),
    place("lunch2", "restaurant", 0.013, { openingHours: "Mo-Su 11:00-22:00" }),
    place("ice", "dessert", 0.006, { openingHours: "Mo-Su 12:00-21:00" }),
    place("late", "museum", 0.01, { openingHours: "Sa 13:30-14:00" }),
  ];
  const { scored } = rankPlaces(places, q);
  const plan = buildItinerary(scored, q);

  it("fits inside the time window and respects hours", () => {
    expect(plan.stops.length).toBeGreaterThan(1);
    expect(plan.endMinutes).toBeLessThanOrEqual(q.startMinutes + q.durationMinutes);
    const byId = new Map(scored.map((s) => [s.place.id, s]));
    for (const s of plan.stops) {
      expect(openForVisit(byId.get(s.placeId)!.place.openingHours, q.date, s.arrive, s.depart)).not.toBe("closed");
    }
  });
  it("never books two restaurants back to back", () => {
    const ids = plan.stops.map((s) => s.placeId);
    expect(ids.includes("lunch") && ids.includes("lunch2")).toBe(false);
  });
  it("stays within budget", () => {
    expect(plan.totalCostLow).toBeLessThanOrEqual(totalBudget(q));
  });
  it("offers swaps that keep the plan valid", () => {
    const ids = plan.stops.map((s) => s.placeId);
    const opts = swapOptions(ids, 0, scored, q);
    for (const o of opts) expect(o.itinerary.notes.filter((n) => n.includes("closed")).length).toBe(0);
    const byId = new Map(scored.map((s) => [s.place.id, s]));
    expect(retime(ids, byId, q).stops.length).toBe(ids.length);
  });
});

describe("OpenStreetMap normalisation", () => {
  it("maps tags to categories and drops unnamed/private places", () => {
    expect(classify({ leisure: "bowling_alley" })?.category).toBe("bowling");
    expect(classify({ amenity: "restaurant", cuisine: "thai" })?.kind).toBe("Thai restaurant");
    expect(normalize({ type: "node", id: 1, lat: 1, lon: 1, tags: { amenity: "cafe" } })).toBeNull();
    expect(normalize({ type: "node", id: 1, lat: 1, lon: 1, tags: { amenity: "cafe", name: "X", access: "private" } })).toBeNull();
    expect(normalize({ type: "way", id: 7, center: { lat: 1, lon: 2 }, tags: { leisure: "park", name: "P", fee: "no", wikidata: "Q1" } })).toMatchObject({ id: "osm:way/7", fee: "free", notable: true });
  });
});

describe("event venues", () => {
  const stadium = place("stadium", "stadium", 0.002, { notable: true });
  const park = place("park2", "park", 0.004, { openingHours: "Mo-Su 06:00-21:00" });
  const q2 = { ...q, children: [], interests: ["sports" as const, "outdoors" as const] };
  it("never auto-adds a stadium to a plan, but still lists it as an idea", () => {
    const { scored } = rankPlaces([stadium, park], q2);
    expect(scored.some((s) => s.place.id === "stadium")).toBe(true);
    const plan = buildItinerary(scored, q2);
    expect(plan.stops.map((s) => s.placeId)).not.toContain("stadium");
  });
  it("says ticket prices are unknown instead of free", () => {
    expect(estimateCost(stadium, q2)).toMatchObject({ confidence: "unknown" });
  });
});

describe("meals make sense", () => {
  const q3 = { ...q, startMinutes: 12 * 60 + 30, durationMinutes: 4 * 60, children: [], budget: 200, interests: ["food" as const, "outdoors" as const] };
  const places = [
    place("thai", "restaurant", 0.003, { openingHours: "Mo-Su 11:00-22:00" }),
    place("sub", "fast_food", 0.004, { openingHours: "Mo-Su 08:00-22:00" }),
    place("tacos", "fast_food", 0.005, { openingHours: "Mo-Su 08:00-22:00" }),
    place("gardens", "garden", 0.006, { openingHours: "Mo-Su 08:00-20:00" }),
    place("ice", "dessert", 0.004, { openingHours: "Mo-Su 12:00-22:00" }),
  ];
  const { scored } = rankPlaces(places, q3);
  const plan = buildItinerary(scored, q3);
  const byId = new Map(scored.map((s) => [s.place.id, s]));
  const meals = plan.stops.filter((s) => ["restaurant", "fast_food"].includes(byId.get(s.placeId)!.place.category));
  it("has at most one meal in an afternoon outing, at a meal time", () => {
    expect(meals.length).toBeLessThanOrEqual(1);
    for (const m of meals) expect(m.arrive).toBeLessThanOrEqual(14 * 60 + 30);
  });
  it("won't offer a second lunch as a swap", () => {
    const ids = plan.stops.map((s) => s.placeId);
    const nonMeal = plan.stops.findIndex((s) => !meals.includes(s));
    if (meals.length && nonMeal >= 0) {
      const opts = swapOptions(ids, nonMeal, scored, q3, 10);
      const offered = opts.map((o) => byId.get(o.candidate.place.id)!.place.category);
      expect(offered).not.toContain("fast_food");
    }
  });
});

describe("food stops", () => {
  const qa = { ...q, startMinutes: 11 * 60 + 30, durationMinutes: 4 * 60, children: [], budget: 300, interests: ["food" as const, "coffee" as const, "outdoors" as const] };
  const places = [
    place("bakery", "cafe", 0.002, { openingHours: "Mo-Su 07:00-16:00" }),
    place("cafe2", "cafe", 0.0025, { openingHours: "Mo-Su 07:00-18:00" }),
    place("lunch", "restaurant", 0.003, { openingHours: "Mo-Su 11:00-22:00" }),
    place("sub", "fast_food", 0.0035, { openingHours: "Mo-Su 08:00-22:00", brand: "Subway" }),
    place("icecream", "dessert", 0.004, { openingHours: "Mo-Su 11:00-23:00" }),
    place("garden", "garden", 0.005, { openingHours: "Mo-Su 08:00-20:00" }),
    place("park3", "park", 0.006, { openingHours: "Mo-Su 06:00-21:00" }),
  ];
  const { scored } = rankPlaces(places, qa);
  const plan = buildItinerary(scored, qa);
  const cats = plan.stops.map((s) => scored.find((c) => c.place.id === s.placeId)!.place.category);
  const food = (c: string) => ["cafe", "dessert", "restaurant", "fast_food"].includes(c);
  it("never puts two food stops back to back", () => {
    for (let i = 1; i < cats.length; i++) expect(food(cats[i - 1]) && food(cats[i])).toBe(false);
  });
  it("allows only one coffee/dessert stop in a 4-hour outing", () => {
    expect(cats.filter((c) => c === "cafe" || c === "dessert").length).toBeLessThanOrEqual(1);
  });
});

describe("fancy night out", () => {
  const qf = { ...q, startMinutes: 18 * 60, durationMinutes: 3 * 60, children: [], budget: 150, budgetMode: "per_person" as const, interests: ["food" as const, "sights" as const], dining: "upscale" as const };
  const steak = place("steak", "restaurant", 0.004, { openingHours: "Mo-Su 17:00-23:00", cuisine: "steak_house", reservation: "recommended", website: "https://example.org" });
  const chain = place("chain", "restaurant", 0.002, { openingHours: "Mo-Su 11:00-23:00", brand: "Applebee's" });
  const plain = place("plain", "restaurant", 0.003, { openingHours: "Mo-Su 11:00-23:00" });
  const sub = place("sub2", "fast_food", 0.001, { openingHours: "Mo-Su 08:00-23:00", brand: "Subway" });
  const view = place("view", "viewpoint", 0.005);
  const { scored, excluded } = rankPlaces([steak, chain, plain, sub, view], qf);
  it("rules out chains and fast food", () => {
    expect(scored.map((s) => s.place.id)).not.toContain("chain");
    expect(scored.map((s) => s.place.id)).not.toContain("sub2");
    expect(excluded.dining_style).toBe(2);
  });
  it("ranks the reservation-taking steakhouse above a plain restaurant and plans dinner there", () => {
    const ids = scored.map((s) => s.place.id);
    expect(ids.indexOf("steak")).toBeLessThan(ids.indexOf("plain"));
    expect(buildItinerary(scored, qf).stops.map((s) => s.placeId)).toContain("steak");
    expect(scored.find((s) => s.place.id === "steak")!.reasons[0]).toMatch(/Likely upscale/);
  });
  it("estimates upscale prices, labeled as an estimate", () => {
    expect(estimateCost(steak, qf)).toMatchObject({ low: 90, high: 220, confidence: "estimated" });
  });
});
