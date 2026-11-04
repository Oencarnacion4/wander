"use client";

import { ArrowRight, BookmarkPlus, Check, ExternalLink, Loader2, Map as MapIcon, Plane, PlaneTakeoff, Search } from "lucide-react";
import { useState } from "react";
import { ConfidenceBadge, costLabel } from "@/components/Badges";
import { LocationPicker, type PickedLocation } from "@/components/LocationPicker";
import { Photo } from "@/components/Photo";
import { useWander } from "@/components/WanderProvider";
import { snapshot } from "@/components/explore/PlaceActions";
import { fmtTime } from "@/lib/hours";
import type { FlightDeal } from "@/lib/providers/flights";
import type { PlanStop } from "@/lib/store-types";
import type { TripResponse } from "@/app/api/trip/route";
import { cn } from "@/lib/cn";

function fmtDate(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
function ago(iso: string | null) {
  if (!iso) return "recently";
  const h = Math.max(0, (Date.now() - Date.parse(iso)) / 3600000);
  if (!Number.isFinite(h)) return "recently";
  if (h < 1) return "under an hour ago";
  if (h < 48) return `${Math.round(h)}h ago`;
  return `${Math.round(h / 24)} days ago`;
}
function nights(a: string, b: string | null) {
  if (!b) return null;
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}
function nextMonths() {
  const out: { value: string; label: string }[] = [];
  const d = new Date();
  for (let i = 0; i < 12; i++) {
    const x = new Date(d.getFullYear(), d.getMonth() + i, 1);
    out.push({ value: `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`, label: x.toLocaleDateString("en-US", { month: "long", year: "numeric" }) });
  }
  return out;
}

export function CheapFlights() {
  const { profile, savePlan } = useWander();
  const [picked, setPicked] = useState<PickedLocation | null>(null);
  const [touched, setTouched] = useState(false);
  const origin: PickedLocation | null = touched ? picked : profile.homeBase ? { ...profile.homeBase, source: "home" } : null;
  const [oneWay, setOneWay] = useState(false);
  const [month, setMonth] = useState("");
  const [nonstop, setNonstop] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ origins: { code: string; name: string; km: number }[]; deals: FlightDeal[] } | null>(null);
  const [planFor, setPlanFor] = useState<FlightDeal | null>(null);

  async function search() {
    if (!origin) return;
    setLoading(true);
    setError(null);
    setPlanFor(null);
    try {
      const sp = new URLSearchParams({ lat: String(origin.lat), lng: String(origin.lng), oneWay: oneWay ? "1" : "0", nonstop: nonstop ? "1" : "0" });
      if (month) sp.set("month", month);
      const r = await fetch(`/api/flights?${sp}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Flight search failed");
      setResult(j);
    } catch (e) {
      setError((e as Error).message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  const toggle = (on: boolean) => (on ? "bg-plum text-white" : "text-ink-soft");

  return (
    <div>
      <div className="rounded-[28px] bg-card border border-line shadow-lift p-5 md:p-7 space-y-5">
        <div>
          <p className="font-display text-2xl font-bold">Just want to go somewhere cheap?</p>
          <p className="text-sm text-muted mt-1">We find the airports near you and list the cheapest fares to anywhere.</p>
        </div>
        <div>
          <p className="text-sm font-semibold mb-2">Flying from near</p>
          <LocationPicker
            value={origin}
            onChange={(l) => {
              setTouched(true);
              setPicked(l);
            }}
            homeBase={profile.homeBase}
            placeholder="Your city"
          />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid grid-cols-2 rounded-full border border-line p-1 text-sm">
            <button type="button" onClick={() => setOneWay(false)} className={cn("rounded-full px-4 py-1.5 font-medium", toggle(!oneWay))}>
              Round trip
            </button>
            <button type="button" onClick={() => setOneWay(true)} className={cn("rounded-full px-4 py-1.5 font-medium", toggle(oneWay))}>
              One way
            </button>
          </div>
          <label className="text-sm">
            <span className="sr-only">When</span>
            <select value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-full border border-line bg-card px-4 py-2" aria-label="When">
              <option value="">Any time</option>
              {nextMonths().map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm cursor-pointer">
            <input type="checkbox" checked={nonstop} onChange={(e) => setNonstop(e.target.checked)} className="accent-[var(--color-orchid)]" />
            Nonstop only
          </label>
          <button type="button" onClick={search} disabled={!origin || loading} className="ml-auto inline-flex items-center gap-2 rounded-full bg-orchid hover:bg-orchid-dark text-white font-semibold px-6 py-3 disabled:opacity-50">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            {loading ? "Finding fares…" : "Find cheap flights"}
          </button>
        </div>
        {error && <p className="rounded-2xl bg-orchid/10 text-orchid-dark px-4 py-3 text-sm">{error}</p>}
      </div>

      {result && (
        <div className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-3xl font-extrabold">{result.deals.length ? "Cheapest places to fly" : "No fares found"}</h2>
              <p className="text-sm text-ink-soft mt-1">
                From {result.origins.map((o) => `${o.name} (${o.code}, ${o.km} km away)`).join(" · ") || "no nearby airport"}
              </p>
            </div>
          </div>
          <p className="mt-3 rounded-2xl bg-mist border border-line px-4 py-3 text-xs text-ink-soft">
            Prices are real fares other travelers found recently on Aviasales, per person in USD. Fares change quickly, so tap <b>Check price</b> for the live price before you book.
          </p>
          {result.deals.length === 0 && (
            <p className="mt-4 text-sm text-muted">No recent fares from these airports{nonstop ? " with nonstop flights" : ""}{month ? " for that month" : ""}. Try Any time, turn off Nonstop only, or pick a bigger city nearby.</p>
          )}

          {planFor && <TripFromFlight deal={planFor} onClose={() => setPlanFor(null)} savePlan={savePlan} />}

          <div className="mt-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {result.deals.map((d, i) => {
              const n = nights(d.departDate, d.returnDate);
              return (
                <article key={d.destination} className="rounded-3xl overflow-hidden border border-line bg-card shadow-card hover:shadow-lift transition-shadow">
                  <Photo title={d.city} className="h-32" fallbackHue={(i * 41) % 360}>
                    <div className="absolute inset-0 bg-gradient-to-t from-plum-dark/85 to-transparent" />
                    <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-ink">#{i + 1}</span>
                    <div className="absolute bottom-3 left-3 text-white">
                      <p className="font-display text-xl font-bold leading-tight">{d.city}</p>
                      <p className="text-xs text-white/80">{d.country}</p>
                    </div>
                    <p className="absolute bottom-3 right-3 font-display text-3xl font-extrabold text-white">${d.price}</p>
                  </Photo>
                  <div className="p-4 text-sm space-y-2">
                    <p className="flex items-center gap-1.5 font-medium">
                      <PlaneTakeoff className="size-4 text-plum" /> {d.origin} <ArrowRight className="size-3.5" /> {d.destination}
                      <span className="text-muted font-normal">· {d.stops === 0 ? "Nonstop" : d.stops == null ? "Stops unknown" : `${d.stops} stop${d.stops > 1 ? "s" : ""}`}</span>
                    </p>
                    <p className="text-ink-soft">
                      {fmtDate(d.departDate)}
                      {d.returnDate && ` → ${fmtDate(d.returnDate)}`}
                      {n != null && n > 0 && <span className="text-muted"> · {n} night{n > 1 ? "s" : ""}</span>}
                      {!d.returnDate && <span className="text-muted"> · one way</span>}
                    </p>
                    <p className="text-xs text-muted">Fare found {ago(d.foundAt)} · may have changed</p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <a href={d.checkUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-plum text-white px-3 py-1.5 text-xs font-semibold hover:bg-plum-dark">
                        <ExternalLink className="size-3.5" /> Check price
                      </a>
                      {d.lat != null && (
                        <button type="button" onClick={() => setPlanFor(d)} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold hover:bg-mist">
                          <MapIcon className="size-3.5" /> Plan a trip there
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** Day-by-day plan at the flight's destination, for the flight's dates. */
function TripFromFlight({ deal, onClose, savePlan }: { deal: FlightDeal; onClose: () => void; savePlan: ReturnType<typeof useWander>["savePlan"] }) {
  const [trip, setTrip] = useState<TripResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const n = nights(deal.departDate, deal.returnDate);
  const days = Math.min(5, Math.max(1, (n ?? 2) + 1));

  async function build() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/trip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: deal.lat, lng: deal.lng, label: deal.city, startDate: deal.departDate, days, adults: 1, kids: [], interests: ["food", "sights", "museums", "outdoors", "coffee"], transport: "transit", dailyActivityBudget: 70 }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Couldn't build the trip");
      setTrip(j);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!trip) return;
    const stops: PlanStop[] = trip.days.flatMap((d, i) =>
      d.itinerary.stops.map((s) => ({ place: snapshot(trip.places[s.placeId].place), arrive: s.arrive, depart: s.depart, costLow: s.cost.low, costHigh: s.cost.high, costConfidence: s.cost.confidence, day: i + 1 })),
    );
    await savePlan({
      kind: "trip",
      title: `${days} day${days > 1 ? "s" : ""} in ${deal.city}`,
      locationLabel: `${deal.city}, ${deal.country}`,
      lat: deal.lat!,
      lng: deal.lng!,
      planDate: deal.departDate,
      query: { flight: { from: deal.origin, to: deal.destination, price: deal.price, departDate: deal.departDate, returnDate: deal.returnDate, foundAt: deal.foundAt } },
      stops,
    });
    setSaved(true);
  }

  return (
    <div className="mt-5 rounded-[28px] border border-orchid/40 bg-card shadow-lift p-5 md:p-6 rise">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-orchid-dark flex items-center gap-1.5">
            <Plane className="size-3.5" /> {deal.origin} → {deal.destination} · ${deal.price} fare
          </p>
          <p className="font-display text-2xl font-bold mt-1">
            {days} day{days > 1 ? "s" : ""} in {deal.city}
          </p>
          <p className="text-sm text-muted">Starting {fmtDate(deal.departDate)}{n != null && n + 1 > 5 ? " · showing the first 5 days" : ""}</p>
        </div>
        <div className="flex gap-2">
          {trip && (
            <button type="button" onClick={save} disabled={saved} className="inline-flex items-center gap-2 rounded-full bg-plum text-white px-4 py-2 text-sm font-semibold hover:bg-plum-dark disabled:opacity-80">
              {saved ? <Check className="size-4" /> : <BookmarkPlus className="size-4" />} {saved ? "Saved to My Adventures" : "Save trip"}
            </button>
          )}
          <button type="button" onClick={onClose} className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:bg-mist">
            Close
          </button>
        </div>
      </div>
      {!trip && (
        <div className="mt-4">
          <button type="button" onClick={build} disabled={loading} className="inline-flex items-center gap-2 rounded-full bg-orchid text-white font-semibold px-5 py-2.5 hover:bg-orchid-dark disabled:opacity-60">
            {loading && <Loader2 className="size-4 animate-spin" />}
            {loading ? "Finding real places…" : "Build my itinerary"}
          </button>
          {error && <p className="mt-3 text-sm text-orchid-dark">{error}</p>}
        </div>
      )}
      {trip && (
        <div className="mt-4 grid md:grid-cols-2 gap-3">
          {trip.days.map((d, i) => (
            <div key={d.date} className="rounded-2xl border border-line p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-orchid-dark">
                Day {i + 1} · {fmtDate(d.date)}
              </p>
              {d.itinerary.stops.length === 0 && <p className="text-sm text-muted mt-2">A free day — nothing matched well enough to schedule.</p>}
              <ol className="mt-2 space-y-1.5">
                {d.itinerary.stops.map((s) => {
                  const c = trip.places[s.placeId];
                  return (
                    <li key={s.placeId} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0">
                        <span className="tabular-nums text-muted mr-2">{fmtTime(s.arrive)}</span>
                        <span className="font-medium">{c.place.name}</span>
                        <span className="text-muted"> · {c.place.kind}</span>
                      </span>
                      <span className="shrink-0 text-xs inline-flex items-center gap-1">
                        {costLabel(s.cost)} <ConfidenceBadge c={s.cost.confidence} />
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
