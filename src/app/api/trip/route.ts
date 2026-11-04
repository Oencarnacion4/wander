import { cached } from "@/lib/cache";
import { buildItinerary } from "@/lib/itinerary";
import { fetchPlaces } from "@/lib/providers/places";
import { rankPlaces } from "@/lib/scoring";
import type { ExploreQuery, Interest, Itinerary, ScoredPlace, Transport } from "@/lib/types";

/**
 * Day-by-day plan for a trip. Fetches real places around the destination once,
 * then runs the Explore planner for each day, removing places already used so
 * every day is different.
 */
export interface TripDay {
  date: string;
  itinerary: Itinerary;
}
export interface TripResponse {
  days: TripDay[];
  places: Record<string, ScoredPlace>;
}

const RADIUS_KM = 6;
const INTERESTS: Interest[] = ["food", "coffee", "shopping", "sports", "museums", "sights", "nightlife", "outdoors", "entertainment"];

function addDays(date: string, n: number) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const lat = Number(b.lat), lng = Number(b.lng);
  const days = Math.min(5, Math.max(1, Number(b.days) || 1));
  const startDate = String(b.startDate ?? "");
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return Response.json({ error: "lat, lng and startDate are required" }, { status: 400 });
  }
  const interests = (Array.isArray(b.interests) ? b.interests : []).filter((i): i is Interest => INTERESTS.includes(i as Interest));
  const children = (Array.isArray(b.kids) ? b.kids : []).map((a) => ({ age: Math.max(0, Math.min(17, Number(a) || 0)) }));
  const adults = Math.max(1, Math.min(30, Number(b.adults) || 1));
  const transport: Transport = b.transport === "drive" ? "drive" : "transit";
  const dailyBudget = Math.max(0, Number(b.dailyActivityBudget) || 60);

  let places;
  try {
    places = await cached(`trip:${lat.toFixed(3)},${lng.toFixed(3)}:${[...interests].sort().join(",")}`, 30 * 60000, () => fetchPlaces(lat, lng, RADIUS_KM, interests));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }

  const used = new Set<string>();
  const out: TripDay[] = [];
  const placesById: Record<string, ScoredPlace> = {};
  for (let i = 0; i < days; i++) {
    const q: ExploreQuery = {
      lat,
      lng,
      locationLabel: String(b.label ?? ""),
      date: addDays(startDate, i),
      startMinutes: 9 * 60 + 30,
      durationMinutes: 11 * 60,
      budget: dailyBudget,
      budgetMode: "total",
      adults,
      children,
      transport,
      interests,
    };
    const { scored } = rankPlaces(places.filter((p) => !used.has(p.id)), q);
    const itinerary = buildItinerary(scored, q);
    for (const s of itinerary.stops) {
      used.add(s.placeId);
      placesById[s.placeId] = scored.find((c) => c.place.id === s.placeId)!;
    }
    out.push({ date: q.date, itinerary });
  }
  const body: TripResponse = { days: out, places: placesById };
  return Response.json(body);
}
