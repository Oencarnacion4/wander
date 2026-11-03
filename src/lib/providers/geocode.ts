import { USER_AGENT } from "./osm";

/** Geocoding (place name -> coordinates) via OpenStreetMap Nominatim. Free, no key, max ~1 request/second. */

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

export async function geocode(q: string, opts: { usOnly?: boolean } = {}): Promise<GeoResult[]> {
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

export async function reverseGeocode(lat: number, lng: number): Promise<GeoResult | null> {
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
