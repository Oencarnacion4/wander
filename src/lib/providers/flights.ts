import { cached } from "../cache";
import { haversineKm } from "../geo";

/**
 * Cheapest flights "from here to anywhere" via the Travelpayouts (Aviasales)
 * Data API. Free with a token. Prices are REAL fares that Aviasales users
 * found recently (cached, not live), so every deal carries `foundAt` and the
 * UI says how old it is. A "Check price" link opens Google Flights for a live
 * quote. WANDER never invents fares: no token or no data means no results.
 */

const API = process.env.TRAVELPAYOUTS_URL ?? "https://api.travelpayouts.com";
const DATA = process.env.TRAVELPAYOUTS_DATA_URL ?? "https://api.travelpayouts.com/data/en";

export interface Airport {
  code: string;
  name: string;
  city_code: string;
  country_code: string;
  coordinates?: { lat: number; lon: number };
  flightable?: boolean;
  iata_type?: string;
}
interface City {
  code: string;
  name: string;
  country_code: string;
  coordinates?: { lat: number; lon: number };
}
interface Country {
  code: string;
  name: string;
}

export interface FlightDeal {
  origin: string;
  originName: string;
  destination: string;
  city: string;
  country: string;
  countryCode: string;
  lat: number | null;
  lng: number | null;
  /** USD, per passenger, for the whole trip (round trip unless oneWay). */
  price: number;
  departDate: string;
  returnDate: string | null;
  stops: number | null;
  /** When an Aviasales user found this fare (ISO). */
  foundAt: string | null;
  checkUrl: string;
}

const DAY = 86400000;
const loadAirports = () => cached("tp:airports", DAY, async () => getJson<Airport[]>(`${DATA}/airports.json`));
const loadCities = () => cached("tp:cities", DAY, async () => getJson<City[]>(`${DATA}/cities.json`));
const loadCountries = () => cached("tp:countries", DAY, async () => getJson<Country[]>(`${DATA}/countries.json`));

async function getJson<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Flight data ${res.status}`);
  return (await res.json()) as T;
}

/** Up to 3 real commercial airports near a point (within 120 km, else the single nearest). */
export function nearbyAirports(airports: Airport[], lat: number, lng: number): (Airport & { km: number })[] {
  const list = airports
    .filter((a) => a.flightable !== false && (a.iata_type ?? "airport") === "airport" && a.coordinates)
    .map((a) => ({ ...a, km: haversineKm(lat, lng, a.coordinates!.lat, a.coordinates!.lon) }))
    .sort((a, b) => a.km - b.km);
  const near = list.filter((a) => a.km <= 120);
  const pick = near.length ? near : list.slice(0, 1);
  // One airport per city code (e.g. NYC has JFK/LGA/EWR, searchable together as "NYC").
  const seen = new Set<string>();
  return pick.filter((a) => (seen.has(a.city_code) ? false : (seen.add(a.city_code), true))).slice(0, 3);
}

type Row = Record<string, unknown>;

/** Travelpayouts has two fare endpoints with slightly different field names; accept both. */
export function normalizeFare(row: Row) {
  const str = (v: unknown) => (typeof v === "string" && v ? v : null);
  const price = Number(row.value ?? row.price);
  const departDate = (str(row.depart_date) ?? str(row.departure_at) ?? "").slice(0, 10);
  const ret = str(row.return_date) ?? str(row.return_at);
  const stops = row.number_of_changes ?? row.transfers;
  return {
    origin: String(row.origin ?? ""),
    destination: String(row.destination ?? ""),
    price,
    departDate,
    returnDate: ret ? ret.slice(0, 10) : null,
    stops: typeof stops === "number" ? stops : null,
    foundAt: str(row.found_at),
  };
}

export function googleFlightsUrl(origin: string, destination: string, depart: string, ret: string | null) {
  const q = `Flights from ${origin} to ${destination} on ${depart}${ret ? ` through ${ret}` : " one way"}`;
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}`;
}

async function faresFrom(origin: string, opts: { oneWay: boolean; month?: string }, token: string): Promise<Row[]> {
  const headers = { "X-Access-Token": token };
  const latest = new URL(`${API}/aviasales/v3/get_latest_prices`);
  const p: Record<string, string> = {
    origin,
    currency: "usd",
    one_way: String(opts.oneWay),
    sorting: "price",
    limit: "100",
    page: "1",
    show_to_affiliates: "true",
    trip_class: "0",
    token,
    ...(opts.month ? { period_type: "month", beginning_of_period: `${opts.month}-01` } : { period_type: "year" }),
  };
  for (const [k, v] of Object.entries(p)) latest.searchParams.set(k, v);
  try {
    const j = await getJson<{ success?: boolean; data?: Row[]; error?: string }>(latest.toString(), headers);
    if (j.success !== false && j.data?.length) return j.data;
  } catch (e) {
    if (String(e).includes("401") || String(e).includes("403")) throw e;
  }
  // Second endpoint, in case the first has nothing for this origin.
  const dates = new URL(`${API}/aviasales/v3/prices_for_dates`);
  const q: Record<string, string> = { origin, currency: "usd", sorting: "price", direct: "false", limit: "100", one_way: String(opts.oneWay), token, ...(opts.month ? { departure_at: opts.month } : {}) };
  for (const [k, v] of Object.entries(q)) dates.searchParams.set(k, v);
  const j = await getJson<{ success?: boolean; data?: Row[]; error?: string }>(dates.toString(), headers);
  if (j.success === false) throw new Error(j.error ?? "Flight search failed");
  return j.data ?? [];
}

export async function cheapestFlights(
  lat: number,
  lng: number,
  opts: { oneWay: boolean; month?: string; nonstop?: boolean; today: string },
  token: string,
): Promise<{ origins: { code: string; name: string; km: number }[]; deals: FlightDeal[] }> {
  const [airports, cities, countries] = await Promise.all([loadAirports(), loadCities(), loadCountries()]);
  const origins = nearbyAirports(airports, lat, lng);
  if (!origins.length) return { origins: [], deals: [] };
  const cityBy = new Map(cities.map((c) => [c.code, c]));
  const airportBy = new Map(airports.map((a) => [a.code, a]));
  const countryBy = new Map(countries.map((c) => [c.code, c.name]));

  const key = `fares:${origins.map((o) => o.city_code).join(",")}:${opts.oneWay}:${opts.month ?? "any"}`;
  const rows = await cached(key, 60 * 60000, async () => {
    const settled = await Promise.allSettled(origins.map((o) => faresFrom(o.city_code, opts, token)));
    const ok = settled.filter((s): s is PromiseFulfilledResult<Row[]> => s.status === "fulfilled");
    if (!ok.length) throw (settled.find((s) => s.status === "rejected") as PromiseRejectedResult).reason;
    return ok.flatMap((s) => s.value);
  });

  const originCities = new Set(origins.map((o) => o.city_code));
  const best = new Map<string, FlightDeal>();
  for (const r of rows.map(normalizeFare)) {
    if (!(r.price > 0) || !r.destination || originCities.has(r.destination)) continue;
    if (!r.departDate || r.departDate < opts.today) continue; // stale fare for a date that has passed
    if (opts.nonstop && r.stops !== 0) continue;
    // Destinations may be a city code or an airport code.
    const city = cityBy.get(r.destination) ?? cityBy.get(airportBy.get(r.destination)?.city_code ?? "");
    const coords = city?.coordinates ?? airportBy.get(r.destination)?.coordinates;
    const countryCode = city?.country_code ?? airportBy.get(r.destination)?.country_code ?? "";
    const originName = cityBy.get(r.origin)?.name ?? airportBy.get(r.origin)?.name ?? r.origin;
    const deal: FlightDeal = {
      origin: r.origin,
      originName,
      destination: r.destination,
      city: city?.name ?? airportBy.get(r.destination)?.name ?? r.destination,
      country: countryBy.get(countryCode) ?? countryCode,
      countryCode,
      lat: coords?.lat ?? null,
      lng: coords?.lon ?? null,
      price: Math.round(r.price),
      departDate: r.departDate,
      returnDate: opts.oneWay ? null : r.returnDate,
      stops: r.stops,
      foundAt: r.foundAt,
      checkUrl: googleFlightsUrl(r.origin, r.destination, r.departDate, opts.oneWay ? null : r.returnDate),
    };
    const prev = best.get(deal.destination);
    if (!prev || deal.price < prev.price) best.set(deal.destination, deal);
  }
  return {
    origins: origins.map((o) => ({ code: o.city_code, name: o.name, km: Math.round(o.km) })),
    deals: [...best.values()].sort((a, b) => a.price - b.price).slice(0, 40),
  };
}
