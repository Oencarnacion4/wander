import type { Interest, Place } from "../types";
import { haversineKm } from "../geo";
import { normalize, USER_AGENT } from "./osm";

/**
 * Geoapify Places API: the same real OpenStreetMap data as Overpass, served
 * from a fast commercial server. Free tier: 3,000 credits/day, no credit card.
 * Each result includes the original OSM tags ("datasource.raw"), so we reuse
 * the exact same classification and place IDs as the Overpass provider.
 */

const BASE = process.env.GEOAPIFY_URL ?? "https://api.geoapify.com/v2/places";

/** Geoapify categories per interest, plus a broader fallback in case a specific one is rejected. */
const GROUPS: Record<Interest, { categories: string; fallback: string; dense: boolean; limit: number }> = {
  food: { categories: "catering.restaurant,catering.fast_food,catering.ice_cream,catering.food_court", fallback: "catering", dense: true, limit: 120 },
  coffee: { categories: "catering.cafe,catering.ice_cream", fallback: "catering", dense: true, limit: 60 },
  outdoors: { categories: "leisure.park,leisure.playground,beach", fallback: "leisure", dense: false, limit: 80 },
  museums: { categories: "entertainment.museum,entertainment.culture", fallback: "entertainment", dense: false, limit: 60 },
  sights: { categories: "tourism.attraction", fallback: "tourism", dense: false, limit: 60 },
  entertainment: {
    categories:
      "entertainment.cinema,entertainment.zoo,entertainment.aquarium,entertainment.theme_park,entertainment.water_park,entertainment.bowling_alley,entertainment.miniature_golf,entertainment.escape_game,entertainment.amusement_arcade",
    fallback: "entertainment",
    dense: false,
    limit: 60,
  },
  sports: { categories: "sport.stadium,sport.sports_centre,sport.ice_rink", fallback: "sport", dense: false, limit: 40 },
  shopping: { categories: "commercial.shopping_mall,commercial.department_store,commercial.books,commercial.marketplace", fallback: "commercial.shopping_mall", dense: true, limit: 60 },
  nightlife: { categories: "catering.bar,catering.pub,catering.biergarten,adult.nightclub", fallback: "catering.bar,catering.pub", dense: true, limit: 60 },
};
const DENSE_MAX_KM = 3;

/** When a result has no raw OSM tags, rebuild the key tag from its most specific Geoapify category. */
const CATEGORY_TAGS: [string, Record<string, string>][] = [
  ["catering.restaurant", { amenity: "restaurant" }],
  ["catering.fast_food", { amenity: "fast_food" }],
  ["catering.cafe", { amenity: "cafe" }],
  ["catering.ice_cream", { amenity: "ice_cream" }],
  ["catering.food_court", { amenity: "food_court" }],
  ["catering.bar", { amenity: "bar" }],
  ["catering.pub", { amenity: "pub" }],
  ["catering.biergarten", { amenity: "biergarten" }],
  ["adult.nightclub", { amenity: "nightclub" }],
  ["entertainment.museum", { tourism: "museum" }],
  ["entertainment.culture.gallery", { tourism: "gallery" }],
  ["entertainment.culture.theatre", { amenity: "theatre" }],
  ["entertainment.culture.arts_centre", { amenity: "arts_centre" }],
  ["entertainment.cinema", { amenity: "cinema" }],
  ["entertainment.zoo", { tourism: "zoo" }],
  ["entertainment.aquarium", { tourism: "aquarium" }],
  ["entertainment.theme_park", { tourism: "theme_park" }],
  ["entertainment.water_park", { leisure: "water_park" }],
  ["entertainment.bowling_alley", { leisure: "bowling_alley" }],
  ["entertainment.miniature_golf", { leisure: "miniature_golf" }],
  ["entertainment.escape_game", { leisure: "escape_game" }],
  ["entertainment.amusement_arcade", { leisure: "amusement_arcade" }],
  ["leisure.park.garden", { leisure: "garden" }],
  ["leisure.park.nature_reserve", { leisure: "nature_reserve" }],
  ["leisure.playground", { leisure: "playground" }],
  ["leisure.park", { leisure: "park" }],
  ["beach", { natural: "beach" }],
  ["tourism.attraction.viewpoint", { tourism: "viewpoint" }],
  ["tourism.attraction", { tourism: "attraction" }],
  ["sport.stadium", { leisure: "stadium" }],
  ["sport.ice_rink", { leisure: "ice_rink" }],
  ["sport.sports_centre", { leisure: "sports_centre" }],
  ["commercial.shopping_mall", { shop: "mall" }],
  ["commercial.department_store", { shop: "department_store" }],
  ["commercial.books", { shop: "books" }],
  ["commercial.marketplace", { amenity: "marketplace" }],
];

export interface GeoapifyFeature {
  properties: {
    name?: string;
    lat: number;
    lon: number;
    place_id?: string;
    categories?: string[];
    address_line2?: string;
    opening_hours?: string;
    website?: string;
    contact?: { phone?: string };
    datasource?: { sourcename?: string; raw?: Record<string, string | number> };
  };
}

const OSM_TYPES: Record<string, "node" | "way" | "relation"> = { n: "node", w: "way", r: "relation", node: "node", way: "way", relation: "relation" };

export function fromGeoapify(f: GeoapifyFeature): Place | null {
  const p = f.properties;
  const cats = p.categories ?? [];
  // Places of worship show up under "sights"; skip them unless they're a listed attraction.
  if (cats.some((c) => c.startsWith("religion")) && !cats.includes("tourism.attraction")) return null;
  const raw = Object.fromEntries(Object.entries(p.datasource?.raw ?? {}).map(([k, v]) => [k, String(v)]));
  const fromCategory = CATEGORY_TAGS.find(([c]) => cats.includes(c))?.[1] ?? {};
  const tags: Record<string, string> = { ...fromCategory, ...raw };
  tags.name = tags.name ?? p.name ?? "";
  if (p.opening_hours && !tags.opening_hours) tags.opening_hours = p.opening_hours;
  if (p.website && !tags.website) tags.website = p.website;
  if (p.contact?.phone && !tags.phone) tags.phone = p.contact.phone;
  const osmType = OSM_TYPES[String(raw.osm_type ?? "")];
  const osmId = Number(raw.osm_id);
  const place = normalize({ type: osmType ?? "node", id: Number.isFinite(osmId) ? Math.abs(osmId) : 0, lat: p.lat, lon: p.lon, tags });
  if (!place) return null;
  // Keep OSM ids (so visits match across providers); otherwise use Geoapify's own stable id.
  if (!osmType || !Number.isFinite(osmId)) place.id = `geoapify:${p.place_id ?? `${p.lat},${p.lon}`}`;
  if (!place.address && p.address_line2) place.address = p.address_line2;
  return place;
}

export function buildGeoapifyUrl(lat: number, lng: number, km: number, categories: string, limit: number, key: string): string {
  const u = new URL(BASE);
  u.searchParams.set("categories", categories);
  u.searchParams.set("filter", `circle:${lng},${lat},${Math.round(km * 1000)}`);
  u.searchParams.set("bias", `proximity:${lng},${lat}`);
  u.searchParams.set("limit", String(limit));
  u.searchParams.set("apiKey", key);
  return u.toString();
}

async function getFeatures(url: string): Promise<GeoapifyFeature[]> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(12000) });
  if (!res.ok) {
    const err = new Error(`Geoapify ${res.status}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  const json = (await res.json()) as { features?: GeoapifyFeature[] };
  return json.features ?? [];
}

export async function fetchGeoapify(lat: number, lng: number, radiusKm: number, interests: Interest[], key: string): Promise<Place[]> {
  const keys = new Set<Interest>([...(interests.length ? interests : (Object.keys(GROUPS) as Interest[]).filter((i) => i !== "nightlife")), "food"]);
  // One small request per interest, all at the same time.
  const results = await Promise.allSettled(
    [...keys].map(async (k) => {
      const g = GROUPS[k];
      const km = g.dense ? Math.min(radiusKm, DENSE_MAX_KM) : radiusKm;
      try {
        return await getFeatures(buildGeoapifyUrl(lat, lng, km, g.categories, g.limit, key));
      } catch (e) {
        // 400 = a category name was rejected: retry this group with the broader one.
        if ((e as { status?: number }).status === 400) return getFeatures(buildGeoapifyUrl(lat, lng, km, g.fallback, g.limit, key));
        throw e;
      }
    }),
  );
  const ok = results.filter((r): r is PromiseFulfilledResult<GeoapifyFeature[]> => r.status === "fulfilled");
  if (ok.length === 0) {
    const first = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
    throw first?.reason ?? new Error("Geoapify returned nothing");
  }
  const seen = new Set<string>();
  const places: Place[] = [];
  for (const f of ok.flatMap((r) => r.value)) {
    const p = fromGeoapify(f);
    if (!p || seen.has(p.id)) continue;
    const dupKey = `${p.name.toLowerCase()}|${p.lat.toFixed(3)}|${p.lng.toFixed(3)}`;
    if (seen.has(dupKey)) continue;
    if (haversineKm(lat, lng, p.lat, p.lng) > radiusKm * 1.05) continue;
    seen.add(p.id);
    seen.add(dupKey);
    places.push(p);
  }
  return places;
}
