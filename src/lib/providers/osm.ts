import { CATEGORIES, cuisineLabel } from "../categories";
import type { CategoryKey, Interest, Place } from "../types";

/**
 * Real places come from OpenStreetMap through the Overpass API.
 * Free, no API key, worldwide. Only named, publicly accessible places are kept.
 */

const OVERPASS_ENDPOINTS = (process.env.OVERPASS_URLS ?? "https://overpass-api.de/api/interpreter,https://overpass.private.coffee/api/interpreter,https://maps.mail.ru/osm/tools/overpass/api/interpreter")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export const USER_AGENT = `WANDER/0.1 (student project${process.env.CONTACT_EMAIL ? `; ${process.env.CONTACT_EMAIL}` : ""})`;

/** Overpass selectors per interest. Food uses a tighter radius since restaurants are dense. */
const SELECTORS: Record<Interest, string[]> = {
  food: ['nwr["amenity"~"^(restaurant|fast_food|food_court)$"]', 'nwr["amenity"="ice_cream"]'],
  coffee: ['nwr["amenity"="cafe"]', 'nwr["amenity"="ice_cream"]', 'nwr["shop"~"^(pastry|confectionery|chocolate)$"]'],
  outdoors: ['nwr["leisure"~"^(park|garden|nature_reserve)$"]', 'nwr["natural"="beach"]', 'nwr["tourism"="viewpoint"]', 'nwr["leisure"="playground"]'],
  museums: ['nwr["tourism"~"^(museum|gallery)$"]', 'nwr["amenity"="arts_centre"]'],
  sights: ['nwr["tourism"~"^(attraction|viewpoint)$"]', 'nwr["historic"~"^(monument|castle|fort|ruins|ship|battlefield|lighthouse)$"]'],
  entertainment: [
    'nwr["amenity"~"^(cinema|theatre)$"]',
    'nwr["leisure"~"^(bowling_alley|amusement_arcade|escape_game|miniature_golf|trampoline_park|water_park)$"]',
    'nwr["tourism"~"^(zoo|aquarium|theme_park)$"]',
  ],
  sports: ['nwr["leisure"~"^(sports_centre|stadium|ice_rink|golf_course|bowling_alley)$"]', 'nwr["sport"="climbing"]["leisure"]'],
  shopping: ['nwr["shop"~"^(mall|department_store|books|gift|toys|antiques|art|second_hand|music)$"]', 'nwr["amenity"="marketplace"]'],
  nightlife: ['nwr["amenity"~"^(bar|pub|nightclub|biergarten)$"]'],
};

export function buildOverpassQuery(lat: number, lng: number, radiusKm: number, interests: Interest[]): string {
  const keys = interests.length ? interests : (Object.keys(SELECTORS) as Interest[]).filter((i) => i !== "nightlife");
  // Always include a few food options so the planner can add a meal.
  const set = new Set<Interest>([...keys, "food"]);
  const r = Math.round(radiusKm * 1000);
  const lines: string[] = [];
  for (const k of set) {
    const radius = k === "food" || k === "coffee" || k === "nightlife" ? Math.min(r, 3500) : r;
    for (const sel of SELECTORS[k]) lines.push(`${sel}["name"](around:${radius},${lat},${lng});`);
  }
  return `[out:json][timeout:25];(\n${lines.join("\n")}\n);out center tags 1200;`;
}

type Tags = Record<string, string>;

export function classify(t: Tags): { category: CategoryKey; kind: string } | null {
  const a = t.amenity, l = t.leisure, tr = t.tourism, s = t.shop, h = t.historic;
  const pick = (category: CategoryKey, kind?: string) => ({ category, kind: kind ?? CATEGORIES[category].label });
  if (a === "restaurant" || a === "food_court") {
    const c = cuisineLabel(t.cuisine);
    return pick("restaurant", c ? `${c} restaurant` : a === "food_court" ? "Food court" : "Restaurant");
  }
  if (a === "fast_food") return pick("fast_food", cuisineLabel(t.cuisine) ?? "Quick bite");
  if (a === "cafe") return pick("cafe", t.cuisine?.includes("bubble_tea") ? "Bubble tea" : "Café");
  if (a === "ice_cream") return pick("dessert", "Ice cream");
  if (s === "pastry" || s === "confectionery" || s === "chocolate") return pick("dessert", s === "pastry" ? "Bakery & pastry" : "Sweets");
  if (a === "bar" || a === "pub" || a === "biergarten") return pick("bar", a === "pub" ? "Pub" : a === "biergarten" ? "Beer garden" : "Bar");
  if (a === "nightclub") return pick("nightclub");
  if (tr === "museum") return pick("museum");
  if (tr === "gallery" || a === "arts_centre") return pick("gallery", a === "arts_centre" ? "Arts center" : "Art gallery");
  if (tr === "zoo") return pick("zoo");
  if (tr === "aquarium") return pick("aquarium");
  if (tr === "theme_park" || l === "water_park") return pick("theme_park", l === "water_park" ? "Water park" : "Theme park");
  if (a === "cinema") return pick("cinema");
  if (a === "theatre") return pick("theatre");
  if (l === "bowling_alley") return pick("bowling");
  if (l === "amusement_arcade") return pick("arcade");
  if (l === "miniature_golf") return pick("minigolf");
  if (l === "escape_game") return pick("escape_room");
  if (l === "trampoline_park") return pick("trampoline");
  if (l === "ice_rink") return pick("ice_rink");
  if (t.sport === "climbing") return pick("climbing");
  if (l === "golf_course") return pick("golf");
  if (l === "stadium") return pick("stadium");
  if (l === "sports_centre") return pick("sports_centre");
  if (l === "garden") return pick("garden");
  if (l === "nature_reserve") return pick("nature");
  if (t.natural === "beach") return pick("beach");
  if (l === "playground") return pick("playground");
  if (l === "park") return pick("park");
  if (tr === "viewpoint") return pick("viewpoint");
  if (h) return pick("historic", h === "castle" ? "Castle" : h === "fort" ? "Fort" : h === "lighthouse" ? "Lighthouse" : "Historic site");
  if (tr === "attraction") return pick("attraction");
  if (s === "mall" || s === "department_store") return pick("mall", s === "mall" ? "Shopping center" : "Department store");
  if (a === "marketplace") return pick("market");
  if (s === "books") return pick("bookstore");
  if (s) return pick("shop", s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) + " shop");
  return null;
}

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Tags;
}

export function normalize(el: OverpassElement): Place | null {
  const t = el.tags ?? {};
  if (!t.name) return null;
  if (["private", "no", "customers"].includes(t.access ?? "")) return null;
  if (t.disused === "yes" || t["disused:amenity"] || t.opening_hours === "closed") return null;
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (lat == null || lng == null) return null;
  const c = classify(t);
  if (!c) return null;
  const street = [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ");
  const address = [street, t["addr:city"]].filter(Boolean).join(", ") || undefined;
  return {
    id: `osm:${el.type}/${el.id}`,
    name: t.name,
    lat,
    lng,
    category: c.category,
    kind: c.kind,
    address,
    website: t.website ?? t["contact:website"],
    phone: t.phone ?? t["contact:phone"],
    openingHours: t.opening_hours,
    cuisine: t.cuisine,
    wheelchair: t.wheelchair,
    notable: Boolean(t.wikidata || t.wikipedia),
    fee: t.fee === "no" ? "free" : t.fee === "yes" ? "paid" : undefined,
    charge: t.charge,
    source: "openstreetmap",
  };
}

export async function fetchPlaces(lat: number, lng: number, radiusKm: number, interests: Interest[]): Promise<Place[]> {
  const query = buildOverpassQuery(lat, lng, radiusKm, interests);
  let lastError: unknown;
  for (const url of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": USER_AGENT },
        body: "data=" + encodeURIComponent(query),
        signal: AbortSignal.timeout(28000),
      });
      if (!res.ok) throw new Error(`Overpass ${res.status}`);
      const json = (await res.json()) as { elements: OverpassElement[] };
      const seen = new Set<string>();
      const places: Place[] = [];
      for (const el of json.elements) {
        const p = normalize(el);
        // The same business is sometimes mapped twice (node + building); dedupe by name + rough location.
        if (!p) continue;
        const key = `${p.name.toLowerCase()}|${p.lat.toFixed(3)}|${p.lng.toFixed(3)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        places.push(p);
      }
      return places;
    } catch (e) {
      lastError = e;
    }
  }
  throw new Error(`Could not reach OpenStreetMap place data (${String(lastError)})`);
}
