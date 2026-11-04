import { USER_AGENT } from "./osm";

/**
 * Geocoding (place name -> coordinates).
 * Uses Geoapify when GEOAPIFY_API_KEY is set (fast, reliable), and the free
 * OpenStreetMap Nominatim server otherwise or as a backup.
 */

export interface GeoResult {
  label: string;
  city: string;
  region?: string;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
}

const BASE = process.env.NOMINATIM_URL ?? "https://nominatim.openstreetmap.org";

interface NominatimItem {
  lat: string;
  lon: string;
  display_name: string;
  address?: Record<string, string>;
}

function toResult(r: NominatimItem): GeoResult {
  const a = r.address ?? {};
  const city = a.city ?? a.town ?? a.village ?? a.hamlet ?? a.municipality ?? a.county ?? r.display_name.split(",")[0];
  const region = a.state ?? a.region ?? a.province;
  const country = a.country ?? "";
  const countryCode = (a.country_code ?? "").toUpperCase();
  const regionShort = countryCode === "US" && a["ISO3166-2-lvl4"] ? a["ISO3166-2-lvl4"].replace("US-", "") : region;
  return {
    label: [city, countryCode === "US" ? regionShort : country].filter(Boolean).join(", "),
    city,
    region,
    country,
    countryCode,
    lat: Number(r.lat),
    lng: Number(r.lon),
  };
}

async function nominatimSearch(q: string, opts: { usOnly?: boolean } = {}): Promise<GeoResult[]> {
  const url = new URL(`${BASE}/search`);
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "5");
  if (opts.usOnly) url.searchParams.set("countrycodes", "us");
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, "Accept-Language": "en" }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Geocoder ${res.status}`);
  const items = (await res.json()) as NominatimItem[];
  return items.map(toResult);
}

async function nominatimReverse(lat: number, lng: number): Promise<GeoResult | null> {
  const url = new URL(`${BASE}/reverse`);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("zoom", "12");
  url.searchParams.set("addressdetails", "1");
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, "Accept-Language": "en" }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) return null;
  const item = (await res.json()) as NominatimItem & { error?: string };
  if (item.error) return null;
  return { ...toResult(item), lat, lng };
}

/* ---------- Geoapify ---------- */
const GEOAPIFY = process.env.GEOAPIFY_GEOCODE_URL ?? "https://api.geoapify.com/v1/geocode";

interface GeoapifyResult {
  lat: number;
  lon: number;
  name?: string;
  city?: string;
  town?: string;
  village?: string;
  suburb?: string;
  county?: string;
  state?: string;
  state_code?: string;
  country?: string;
  country_code?: string;
  formatted?: string;
}

export function fromGeoapifyGeocode(r: GeoapifyResult): GeoResult {
  const city = r.city ?? r.town ?? r.village ?? r.suburb ?? r.name ?? r.county ?? (r.formatted ?? "").split(",")[0];
  const countryCode = (r.country_code ?? "").toUpperCase();
  const regionShort = countryCode === "US" ? (r.state_code ?? r.state) : r.state;
  return {
    label: [city, countryCode === "US" ? regionShort : r.country].filter(Boolean).join(", "),
    city,
    region: r.state,
    country: r.country ?? "",
    countryCode,
    lat: r.lat,
    lng: r.lon,
  };
}

async function geoapifyGet(path: string, params: Record<string, string>, key: string): Promise<GeoapifyResult[]> {
  const url = new URL(`${GEOAPIFY}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("format", "json");
  url.searchParams.set("lang", "en");
  url.searchParams.set("apiKey", key);
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Geoapify geocoder ${res.status}`);
  const j = (await res.json()) as { results?: GeoapifyResult[] };
  return j.results ?? [];
}

function dedupe(results: GeoResult[]): GeoResult[] {
  const seen = new Set<string>();
  return results.filter((r) => {
    const k = `${r.label}|${r.lat.toFixed(2)}|${r.lng.toFixed(2)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export async function geocode(q: string, opts: { usOnly?: boolean } = {}): Promise<GeoResult[]> {
  const key = process.env.GEOAPIFY_API_KEY?.trim();
  if (key) {
    try {
      const params: Record<string, string> = { text: q, limit: "5" };
      if (opts.usOnly) params.filter = "countrycode:us";
      const results = dedupe((await geoapifyGet("search", params, key)).map(fromGeoapifyGeocode));
      if (results.length) return results;
    } catch (e) {
      console.warn("[wander] Geoapify location search failed, trying OpenStreetMap:", String(e));
    }
  }
  return nominatimSearch(q, opts);
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeoResult | null> {
  const key = process.env.GEOAPIFY_API_KEY?.trim();
  if (key) {
    try {
      const [r] = await geoapifyGet("reverse", { lat: String(lat), lon: String(lng) }, key);
      if (r) return { ...fromGeoapifyGeocode(r), lat, lng };
    } catch (e) {
      console.warn("[wander] Geoapify reverse lookup failed, trying OpenStreetMap:", String(e));
    }
  }
  return nominatimReverse(lat, lng);
}
