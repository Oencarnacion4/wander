import { cached } from "@/lib/cache";
import { searchRadiusKm } from "@/lib/geo";
import { buildItinerary } from "@/lib/itinerary";
import { fetchPlaces } from "@/lib/providers/places";
import { rankPlaces } from "@/lib/scoring";
import { parseExploreQuery } from "@/lib/validate";
import type { ExploreResponse } from "@/lib/types";

export async function POST(request: Request) {
  let q;
  try {
    q = parseExploreQuery(await request.json());
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
  const radiusKm = searchRadiusKm(q.transport, q.durationMinutes);
  const interestsKey = [...q.interests].sort().join(",");
  let places;
  try {
    places = await cached(`places:${q.lat.toFixed(3)},${q.lng.toFixed(3)}:${radiusKm}:${interestsKey}`, 30 * 60000, () =>
      fetchPlaces(q.lat, q.lng, radiusKm, q.interests),
    );
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
  const { scored, excluded } = rankPlaces(places, q);
  const itinerary = buildItinerary(scored, q);
  const inPlan = new Set(itinerary.stops.map((s) => s.placeId));
  // Send the top candidates (plus anything in the plan) so the browser can swap stops without another request.
  const candidates = scored.filter((c, i) => i < 120 || inPlan.has(c.place.id));
  const body: ExploreResponse = {
    query: q,
    candidates,
    itinerary,
    stats: { fetched: places.length, afterFilters: scored.length, excluded, radiusKm },
  };
  return Response.json(body);
}
