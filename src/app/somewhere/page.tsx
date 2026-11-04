"use client";

import { BookmarkPlus, Car, Check, Dices, Loader2, Minus, Plane, Plus, Stamp, Sun, TrainFront, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo, useRef, useState } from "react";
import { ConfidenceBadge, costLabel, money } from "@/components/Badges";
import { LocationPicker, type PickedLocation } from "@/components/LocationPicker";
import { Photo } from "@/components/Photo";
import { useWander } from "@/components/WanderProvider";
import { snapshot } from "@/components/explore/PlaceActions";
import type { DestTag } from "@/lib/destinations";
import { TIER_DAILY } from "@/lib/destinations";
import { fmtTime } from "@/lib/hours";
import type { PlanStop } from "@/lib/store-types";
import { MODE_LABELS, TRIP_LABELS, TRIP_WEIGHTS, rankDestinations, surprisePick, tagsToInterests, type ScoredDestination, type TripMode, type TripQuery } from "@/lib/trips";
import type { BudgetMode } from "@/lib/types";
import type { TripResponse } from "@/app/api/trip/route";
import { cn } from "@/lib/cn";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false, loading: () => <div className="size-full bg-sand" /> });

const VIBES: { key: DestTag; label: string }[] = [
  { key: "beach", label: "Beach" },
  { key: "mountains", label: "Mountains" },
  { key: "outdoors", label: "Outdoors" },
  { key: "city", label: "Big city" },
  { key: "food", label: "Food" },
  { key: "culture", label: "Arts & culture" },
  { key: "history", label: "History" },
  { key: "nightlife", label: "Nightlife" },
  { key: "family", label: "Family fun" },
  { key: "relaxing", label: "Relaxing" },
];
const MODE_ICONS: Record<TripMode, typeof Car> = { drive: Car, ground: TrainFront, fly: Plane };
const HOURS = [2, 4, 6, 10, 16, 30];

function addDays(date: string, n: number) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
function fmtDate(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function SomewherePage() {
  const { profile, visits, savePlan } = useWander();
  const [pickedOrigin, setPickedOrigin] = useState<PickedLocation | null>(null);
  const [startDate, setStartDate] = useState(() => addDays(new Date().toLocaleDateString("en-CA"), 14));
  const [nights, setNights] = useState(3);
  const [budget, setBudget] = useState(1500);
  const [budgetMode, setBudgetMode] = useState<BudgetMode>("total");
  const [adults, setAdults] = useState(2);
  const [kids, setKids] = useState<number[]>([]);
  const [modes, setModes] = useState<TripMode[]>(["drive", "fly"]);
  const [maxHours, setMaxHours] = useState(6);
  const [scope, setScope] = useState<"domestic" | "anywhere">("anywhere");
  const [vibes, setVibes] = useState<DestTag[]>(["food", "outdoors"]);
  const [submitted, setSubmitted] = useState<TripQuery | null>(null);
  const [selected, setSelected] = useState<ScoredDestination | null>(null);
  const [surprised, setSurprised] = useState(false);
  const [trip, setTrip] = useState<TripResponse | null>(null);
  const [tripLoading, setTripLoading] = useState(false);
  const [tripError, setTripError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const detailRef = useRef<HTMLDivElement>(null);

  // Until the user picks somewhere else, start from their Home Base.
  const [originTouched, setOriginTouched] = useState(false);
  const origin: PickedLocation | null = originTouched ? pickedOrigin : profile.homeBase ? { ...profile.homeBase, source: "home" } : null;
  const setOrigin = (l: PickedLocation | null) => {
    setOriginTouched(true);
    setPickedOrigin(l);
  };

  const ranked = useMemo(() => (submitted ? rankDestinations(submitted) : null), [submitted]);

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!origin) return;
    setSelected(null);
    setTrip(null);
    setSurprised(false);
    setSubmitted({
      originLat: origin.lat,
      originLng: origin.lng,
      originCountry: origin.countryCode || "US",
      startDate,
      nights,
      budget,
      budgetMode,
      adults,
      kids,
      modes,
      maxTravelHours: maxHours,
      scope,
      interests: vibes,
      visitedCities: visits.map((v) => v.city ?? "").filter(Boolean),
    });
  }

  function choose(d: ScoredDestination, viaSurprise = false) {
    setSelected(d);
    setSurprised(viaSurprise);
    setTrip(null);
    setTripError(null);
    setSaved(false);
    setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  async function buildTrip() {
    if (!selected || !submitted) return;
    setTripLoading(true);
    setTripError(null);
    try {
      const r = await fetch("/api/trip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: selected.dest.lat,
          lng: selected.dest.lng,
          label: selected.dest.name,
          startDate: submitted.startDate,
          days: Math.min(5, submitted.nights + 1),
          adults: submitted.adults,
          kids: submitted.kids,
          interests: tagsToInterests(selected.dest.tags.filter((t) => submitted.interests.length === 0 || submitted.interests.includes(t) || t === "food"), submitted.kids.length > 0),
          transport: selected.travel.mode === "drive" ? "drive" : "transit",
          dailyActivityBudget: Math.round(TIER_DAILY[selected.dest.costTier] * 0.3 * (submitted.adults + submitted.kids.length * 0.5)),
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Couldn't build the trip");
      setTrip(j);
    } catch (e) {
      setTripError((e as Error).message);
    } finally {
      setTripLoading(false);
    }
  }

  async function saveTrip() {
    if (!trip || !selected || !submitted) return;
    const stops: PlanStop[] = trip.days.flatMap((d, i) =>
      d.itinerary.stops.map((s) => ({
        place: snapshot(trip.places[s.placeId].place),
        arrive: s.arrive,
        depart: s.depart,
        costLow: s.cost.low,
        costHigh: s.cost.high,
        costConfidence: s.cost.confidence,
        day: i + 1,
      })),
    );
    await savePlan({
      kind: "trip",
      title: `${submitted.nights + 1} days in ${selected.dest.name}`,
      locationLabel: `${selected.dest.name}, ${selected.dest.country}`,
      lat: selected.dest.lat,
      lng: selected.dest.lng,
      planDate: submitted.startDate,
      query: { ...submitted, destination: selected.dest.id },
      stops,
    });
    setSaved(true);
  }

  const originLabel = origin?.label;
  const points = useMemo(() => {
    if (!ranked || !submitted) return [];
    return [
      { id: "__origin", lat: submitted.originLat, lng: submitted.originLng, label: originLabel ?? "Start", sub: "You start here", tone: "home" as const },
      ...ranked.results.slice(0, 12).map((r, i) => ({ id: r.dest.id, lat: r.dest.lat, lng: r.dest.lng, label: r.dest.name, sub: `#${i + 1} · ${Math.round(r.score * 100)} match`, n: i + 1, tone: (selected?.dest.id === r.dest.id ? "plan" : "option") as "plan" | "option" })),
    ];
  }, [ranked, submitted, originLabel, selected]);

  const people = adults + kids.length;

  return (
    <div>
      <section className="relative">
        <Photo title="Santorini" className="h-[300px] md:h-[360px]" fallbackHue={205}>
          <div className="absolute inset-0 bg-gradient-to-t from-plum-dark/90 via-plum-dark/40 to-plum-dark/20" />
          <div className="relative h-full mx-auto max-w-7xl px-4 md:px-6 flex flex-col justify-end pb-24">
            <p className="text-lilac font-semibold text-sm tracking-widest uppercase">Take Me Somewhere</p>
            <h1 className="font-display text-white text-4xl md:text-6xl font-extrabold mt-1 max-w-3xl leading-[1.02]">Somewhere new. We&apos;ll figure out where.</h1>
          </div>
        </Photo>
      </section>

      <div className="mx-auto max-w-7xl px-4 md:px-6 -mt-16 relative">
        <form onSubmit={submit} className="rounded-[28px] bg-card border border-line shadow-lift p-5 md:p-7 space-y-6">
          <div className="grid md:grid-cols-2 gap-5">
            <div>
              <p className="text-sm font-semibold mb-2">Leaving from</p>
              <LocationPicker value={origin} onChange={setOrigin} homeBase={profile.homeBase} placeholder="Your city" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-semibold">
                Departing
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-2 w-full rounded-2xl border border-line bg-card px-3 py-2.5 font-normal" required />
              </label>
              <label className="text-sm font-semibold">
                Nights
                <select value={nights} onChange={(e) => setNights(Number(e.target.value))} className="mt-2 w-full rounded-2xl border border-line bg-card px-3 py-2.5 font-normal">
                  {Array.from({ length: 14 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n} night{n > 1 ? "s" : ""} · back {fmtDate(addDays(startDate, n))}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            <div>
              <p className="text-sm font-semibold mb-2">Travelers</p>
              <div className="space-y-2">
                {[
                  { label: "Adults", v: adults, set: (n: number) => setAdults(Math.max(1, n)), min: 1 },
                  { label: "Kids", v: kids.length, set: (n: number) => setKids(n > kids.length ? [...kids, 8] : kids.slice(0, Math.max(0, n))), min: 0 },
                ].map((s) => (
                  <div key={s.label} className="flex items-center justify-between rounded-2xl border border-line px-3 py-2">
                    <span className="text-sm">{s.label}</span>
                    <div className="flex items-center gap-3">
                      <button type="button" aria-label={`Fewer ${s.label}`} disabled={s.v <= s.min} onClick={() => s.set(s.v - 1)} className="size-8 rounded-full border border-line grid place-items-center disabled:opacity-30">
                        <Minus className="size-3.5" />
                      </button>
                      <span className="w-4 text-center font-semibold">{s.v}</span>
                      <button type="button" aria-label={`More ${s.label}`} onClick={() => s.set(s.v + 1)} className="size-8 rounded-full border border-line grid place-items-center">
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                {kids.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {kids.map((a, i) => (
                      <select key={i} aria-label={`Age of kid ${i + 1}`} value={a} onChange={(e) => setKids(kids.map((x, j) => (j === i ? Number(e.target.value) : x)))} className="rounded-full border border-line px-3 py-1 text-sm">
                        {Array.from({ length: 18 }, (_, n) => (
                          <option key={n} value={n}>
                            {n === 0 ? "Under 1" : `${n} yrs`}
                          </option>
                        ))}
                      </select>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold mb-2">
                Budget <span className="font-normal text-muted">· travel + stay{people > 1 && budgetMode === "per_person" ? ` · ≈ $${budget * people} total` : ""}</span>
              </p>
              <div className="flex items-center gap-2 rounded-2xl border border-line px-3 py-2">
                <span className="text-muted">$</span>
                <input type="text" inputMode="numeric" placeholder="0" value={budget === 0 ? "" : String(budget)} onChange={(e) => setBudget(Number(e.target.value.replace(/\D/g, "").slice(0, 7)) || 0)} className="w-full bg-transparent outline-none font-semibold" aria-label="Trip budget" />
              </div>
              <div className="mt-2 grid grid-cols-2 rounded-full border border-line p-1 text-sm">
                {(["per_person", "total"] as BudgetMode[]).map((m) => (
                  <button key={m} type="button" onClick={() => setBudgetMode(m)} className={cn("rounded-full py-1.5 font-medium", budgetMode === m ? "bg-plum text-white" : "text-ink-soft")}>
                    {m === "per_person" ? "Per person" : "Whole group"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold mb-2">Getting there</p>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(MODE_LABELS) as TripMode[]).map((m) => {
                  const Icon = MODE_ICONS[m];
                  const on = modes.includes(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setModes(on ? (modes.length > 1 ? modes.filter((x) => x !== m) : modes) : [...modes, m])}
                      className={cn("flex flex-col items-center gap-1 rounded-2xl border py-2.5 text-xs font-medium", on ? "border-orchid bg-orchid/10 text-orchid-dark" : "border-line")}
                    >
                      <Icon className="size-5" /> {MODE_LABELS[m]}
                    </button>
                  );
                })}
              </div>
              <label className="block mt-3 text-sm">
                <span className="font-medium">Max travel time each way</span>
                <select value={maxHours} onChange={(e) => setMaxHours(Number(e.target.value))} className="mt-1 w-full rounded-2xl border border-line px-3 py-2">
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {h >= 30 ? "Anywhere — I'll go far" : `Up to ${h} hours`}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold mb-2">The vibe</p>
              <div className="flex flex-wrap gap-2">
                {VIBES.map((v) => {
                  const on = vibes.includes(v.key);
                  return (
                    <button key={v.key} type="button" onClick={() => setVibes(on ? vibes.filter((x) => x !== v.key) : [...vibes, v.key])} className={cn("rounded-full border px-4 py-2 text-sm font-medium", on ? "bg-plum text-white border-plum" : "border-line hover:bg-mist")}>
                      {v.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 rounded-full border border-line p-1 text-sm">
              {(["domestic", "anywhere"] as const).map((s) => (
                <button key={s} type="button" onClick={() => setScope(s)} className={cn("rounded-full px-4 py-1.5 font-medium", scope === s ? "bg-plum text-white" : "text-ink-soft")}>
                  {s === "domestic" ? "Stay in my country" : "International OK"}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" disabled={!origin} className="w-full rounded-full bg-orchid hover:bg-orchid-dark text-white font-semibold py-3.5 text-base disabled:opacity-50">
            Find destinations
          </button>
        </form>
      </div>

      {ranked && submitted && (
        <div className="mx-auto max-w-7xl px-4 md:px-6 mt-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-3xl font-extrabold">{ranked.results.length ? `${ranked.results.length} places that make sense` : "Nothing fits yet"}</h2>
              <p className="text-ink-soft text-sm mt-1">
                {ranked.results.length
                  ? "Ranked by fit. Trip costs are estimates for travel + lodging + food — not live prices."
                  : `Every destination was filtered out (${Object.entries(ranked.excluded).map(([k, n]) => `${n} ${k}`).join(", ")}). Try a bigger budget, more travel time, or another way to travel.`}
              </p>
            </div>
            {ranked.results.length > 0 && (
              <button type="button" onClick={() => choose(surprisePick(ranked.results)!, true)} className="inline-flex items-center gap-2 rounded-full bg-plum text-white font-semibold px-5 py-3 hover:bg-plum-dark">
                <Dices className="size-5" /> Surprise me
              </button>
            )}
          </div>

          {selected && (
            <div ref={detailRef} className="mt-6 scroll-mt-20 rounded-[28px] border border-line bg-card shadow-lift overflow-hidden rise">
              <Photo title={selected.dest.wiki} className="h-56 md:h-72" fallbackHue={200}>
                <div className="absolute inset-0 bg-gradient-to-t from-plum-dark/90 to-transparent" />
                <button type="button" onClick={() => setSelected(null)} aria-label="Close" className="absolute right-4 top-4 rounded-full bg-white/20 p-2 text-white backdrop-blur hover:bg-white/30">
                  <X className="size-4" />
                </button>
                <div className="absolute bottom-0 p-5 md:p-7 text-white">
                  {surprised && <p className="inline-flex items-center gap-1.5 rounded-full bg-lilac text-ink px-3 py-1 text-xs font-bold uppercase mb-2"><Dices className="size-3.5" /> Surprise pick</p>}
                  <h3 className="font-display text-4xl md:text-5xl font-extrabold">{selected.dest.name}</h3>
                  <p className="text-white/80">{selected.dest.region}, {selected.dest.country} · {selected.dest.blurb}</p>
                </div>
              </Photo>
              <div className="p-5 md:p-7 grid md:grid-cols-[1fr_1.4fr] gap-6">
                <div className="space-y-3 text-sm">
                  <div className="rounded-2xl bg-paper border border-line p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">Estimated trip cost</p>
                      <ConfidenceBadge c="estimated" />
                    </div>
                    <p className="font-display text-3xl font-extrabold mt-1">{money(selected.totalLow, selected.totalHigh)}</p>
                    <p className="text-muted mt-1">
                      {MODE_LABELS[selected.travel.mode]} ~${selected.travel.cost} round trip + ~${selected.stayCost} for {submitted.nights + 1} days of lodging, food & activities.
                    </p>
                  </div>
                  <ul className="space-y-1.5 text-ink-soft">
                    <li>
                      {(() => {
                        const Icon = MODE_ICONS[selected.travel.mode];
                        return <Icon className="inline size-4 mr-1.5 -mt-0.5" />;
                      })()}
                      About {selected.travel.hours < 1 ? "1" : selected.travel.hours.toFixed(1)} hours each way ({Math.round(selected.distanceKm).toLocaleString()} km) · estimate
                    </li>
                    <li>
                      <Sun className="inline size-4 mr-1.5 -mt-0.5" />
                      {selected.inSeason ? "A great time of year to go" : "Off-season then — fewer crowds, iffier weather"}
                    </li>
                    {selected.passport && (
                      <li>
                        <Stamp className="inline size-4 mr-1.5 -mt-0.5" />
                        International — check passport and entry requirements
                      </li>
                    )}
                  </ul>
                  <div className="rounded-2xl bg-paper border border-line p-3 text-xs">
                    <p className="font-semibold mb-1.5 text-ink">Match score {Math.round(selected.score * 100)}/100</p>
                    {(Object.keys(TRIP_WEIGHTS) as (keyof typeof TRIP_WEIGHTS)[]).map((k) => (
                      <div key={k} className="flex items-center gap-2 py-0.5">
                        <span className="w-40 text-ink-soft">{TRIP_LABELS[k]}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-sand overflow-hidden">
                          <div className="h-full bg-plum" style={{ width: `${selected.breakdown[k] * 100}%` }} />
                        </div>
                        <span className="w-8 text-right tabular-nums">+{Math.round(TRIP_WEIGHTS[k] * selected.breakdown[k] * 100)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  {!trip && (
                    <div className="h-full rounded-2xl border border-dashed border-line grid place-items-center p-6 text-center">
                      <div>
                        <p className="font-semibold">Ready to see what you&apos;d actually do?</p>
                        <p className="text-sm text-muted mt-1">We&apos;ll pull real places in {selected.dest.name} and plan up to 5 days.</p>
                        <button type="button" onClick={buildTrip} disabled={tripLoading} className="mt-4 inline-flex items-center gap-2 rounded-full bg-orchid text-white font-semibold px-5 py-3 hover:bg-orchid-dark disabled:opacity-60">
                          {tripLoading && <Loader2 className="size-4 animate-spin" />}
                          {tripLoading ? "Planning…" : "Build my itinerary"}
                        </button>
                        {tripError && <p className="mt-3 text-sm text-orchid-dark">{tripError}</p>}
                      </div>
                    </div>
                  )}
                  {trip && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="font-display text-xl font-bold">Day by day</p>
                        <button type="button" onClick={saveTrip} disabled={saved} className="inline-flex items-center gap-2 rounded-full bg-plum text-white px-4 py-2 text-sm font-semibold hover:bg-plum-dark disabled:opacity-80">
                          {saved ? <Check className="size-4" /> : <BookmarkPlus className="size-4" />} {saved ? "Saved to My Adventures" : "Save trip"}
                        </button>
                      </div>
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
                      {submitted.nights + 1 > 5 && <p className="text-xs text-muted">Showing the first 5 days.</p>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {ranked.results.length > 0 && (
            <div className="mt-6 grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-6 items-start">
              <div className="grid sm:grid-cols-2 gap-4">
                {ranked.results.slice(0, 12).map((r, i) => (
                  <button key={r.dest.id} type="button" onClick={() => choose(r)} className={cn("text-left rounded-3xl overflow-hidden border bg-card shadow-card hover:shadow-lift transition-shadow", selected?.dest.id === r.dest.id ? "border-orchid ring-2 ring-orchid/25" : "border-line")}>
                    <Photo title={r.dest.wiki} className="h-36" fallbackHue={(i * 37) % 360}>
                      <div className="absolute inset-0 bg-gradient-to-t from-plum-dark/80 to-transparent" />
                      <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold">#{i + 1}</span>
                      <span className="absolute right-3 top-3 rounded-full bg-plum text-white px-2.5 py-1 text-xs font-bold">{Math.round(r.score * 100)} match</span>
                      <div className="absolute bottom-3 left-3 text-white">
                        <p className="font-display text-xl font-bold leading-tight">{r.dest.name}</p>
                        <p className="text-xs text-white/80">{r.dest.country}</p>
                      </div>
                    </Photo>
                    <div className="p-4 text-sm">
                      <p className="text-ink-soft line-clamp-2">{r.dest.blurb}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                        <span>
                          {MODE_LABELS[r.travel.mode]} · ~{r.travel.hours < 1 ? 1 : r.travel.hours.toFixed(1)} h
                        </span>
                        <span className="font-semibold text-ink">{money(r.totalLow, r.totalHigh)} est.</span>
                        {r.passport && <span>Passport</span>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <div className="lg:sticky lg:top-20 rounded-[28px] overflow-hidden border border-line shadow-card h-[360px] lg:h-[600px]">
                <MapView points={points} activeId={selected?.dest.id} onSelect={(id) => {
                  const r = ranked.results.find((x) => x.dest.id === id);
                  if (r) choose(r);
                }} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
