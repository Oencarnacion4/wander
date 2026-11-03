"use client";

import { CalendarDays, Check, ChevronDown, Compass, Heart, MapPinned, Repeat, Route, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ConfidenceBadge, money } from "@/components/Badges";
import { useWander } from "@/components/WanderProvider";
import { CATEGORIES } from "@/lib/categories";
import { fmtTime } from "@/lib/hours";
import type { PlaceSnapshot, SavedPlan } from "@/lib/store-types";
import { cn } from "@/lib/cn";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false, loading: () => <div className="size-full bg-sand" /> });

type Tab = "visits" | "wishlist" | "plans" | "cities";

function fmtDate(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function AdventuresPage() {
  const { ready, visits, wishlist, plans, addVisit, deleteVisit, toggleWishlist, deletePlan } = useWander();
  const [tab, setTab] = useState<Tab>("visits");
  const [logDate, setLogDate] = useState<Record<string, string>>({});

  // Group visits by place: a place can be visited many times.
  const byPlace = useMemo(() => {
    const m = new Map<string, { place: PlaceSnapshot; city?: string; dates: { id: string; date: string }[] }>();
    for (const v of visits) {
      const e = m.get(v.placeId) ?? { place: v.place, city: v.city, dates: [] };
      e.dates.push({ id: v.id, date: v.visitedOn });
      m.set(v.placeId, e);
    }
    return [...m.values()].sort((a, b) => b.dates[0].date.localeCompare(a.dates[0].date));
  }, [visits]);

  const cities = useMemo(() => {
    const m = new Map<string, { visits: number; places: Set<string>; last: string }>();
    for (const v of visits) {
      const c = v.city ?? "Unknown city";
      const e = m.get(c) ?? { visits: 0, places: new Set(), last: v.visitedOn };
      e.visits++;
      e.places.add(v.placeId);
      if (v.visitedOn > e.last) e.last = v.visitedOn;
      m.set(c, e);
    }
    for (const p of plans) if (!m.has(p.locationLabel)) m.set(p.locationLabel, { visits: 0, places: new Set(), last: p.planDate || p.createdAt.slice(0, 10) });
    return [...m.entries()].sort((a, b) => b[1].visits - a[1].visits);
  }, [visits, plans]);

  const points = useMemo(
    () => [
      ...byPlace.map((e) => ({ id: e.place.id, lat: e.place.lat, lng: e.place.lng, label: e.place.name, sub: `Visited ${e.dates.length}× · last ${fmtDate(e.dates[0].date)}`, tone: "visited" as const })),
      ...wishlist.filter((w) => !byPlace.some((b) => b.place.id === w.placeId)).map((w) => ({ id: w.placeId, lat: w.place.lat, lng: w.place.lng, label: w.place.name, sub: "Want to go", tone: "plan" as const })),
    ],
    [byPlace, wishlist],
  );

  const stats = [
    { label: "Visits", value: visits.length },
    { label: "Places", value: byPlace.length },
    { label: "Cities", value: new Set(visits.map((v) => v.city).filter(Boolean)).size },
    { label: "Want to go", value: wishlist.length },
  ];

  const tabs: { key: Tab; label: string; icon: typeof Check }[] = [
    { key: "visits", label: "Places I've been", icon: Check },
    { key: "wishlist", label: "Want to go", icon: Heart },
    { key: "plans", label: "Saved plans", icon: Route },
    { key: "cities", label: "Cities", icon: MapPinned },
  ];

  const empty = ready && visits.length === 0 && wishlist.length === 0 && plans.length === 0;

  return (
    <div>
      <section className="plum-band text-white topo">
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-10 md:py-14">
          <p className="text-lilac font-semibold text-sm tracking-widest uppercase">My Adventures</p>
          <h1 className="font-display text-4xl md:text-5xl font-extrabold mt-1">Everywhere you&apos;ve been.</h1>
          <p className="text-white/70 mt-2 max-w-xl">WANDER tracks the specific places you visit — never &quot;bowling: done.&quot; Go back as often as you like; every visit counts.</p>
          <div className="mt-6 grid grid-cols-4 gap-3 max-w-xl">
            {stats.map((s) => (
              <div key={s.label} className="rounded-2xl bg-white/[0.07] border border-white/10 px-3 py-3">
                <p className="font-display text-2xl md:text-3xl font-extrabold">{s.value}</p>
                <p className="text-[11px] md:text-xs text-white/60">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 md:px-6 py-8">
        {empty ? (
          <div className="rounded-[28px] border border-dashed border-line p-10 text-center">
            <Compass className="size-10 text-orchid mx-auto" />
            <h2 className="font-display text-2xl font-bold mt-3">Your map is empty — for now.</h2>
            <p className="text-ink-soft mt-1">Plan an outing, tap &quot;Want to go&quot; on places that catch your eye, and &quot;I went here&quot; when you do.</p>
            <Link href="/explore" className="mt-5 inline-flex rounded-full bg-orchid text-white font-semibold px-5 py-3 hover:bg-orchid-dark">
              Explore my city
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] gap-6 items-start">
            <div>
              <div className="flex gap-1 rounded-full bg-sand p-1 overflow-x-auto mb-5">
                {tabs.map((t) => (
                  <button key={t.key} type="button" onClick={() => setTab(t.key)} className={cn("shrink-0 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold", tab === t.key ? "bg-card shadow-card" : "text-ink-soft")}>
                    <t.icon className="size-4" /> {t.label}
                  </button>
                ))}
              </div>

              {tab === "visits" && (
                <ul className="space-y-3">
                  {byPlace.length === 0 && <p className="text-muted text-sm">No visits logged yet. Tap &quot;I went here&quot; on any place.</p>}
                  {byPlace.map((e) => (
                    <li key={e.place.id} className="rounded-3xl border border-line bg-card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs text-muted">
                            {e.place.kind}
                            {e.city && ` · ${e.city}`}
                          </p>
                          <h3 className="font-semibold text-lg leading-snug">{e.place.name}</h3>
                        </div>
                        <span className="shrink-0 rounded-full bg-sky/10 text-sky px-3 py-1 text-xs font-bold">
                          {e.dates.length} visit{e.dates.length > 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {e.dates.map((d) => (
                          <span key={d.id} className="group inline-flex items-center gap-1 rounded-full bg-paper border border-line px-2.5 py-1 text-xs">
                            <CalendarDays className="size-3 text-muted" /> {fmtDate(d.date)}
                            <button type="button" onClick={() => deleteVisit(d.id)} aria-label={`Delete visit on ${d.date}`} className="ml-0.5 text-muted hover:text-orchid-dark">
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <input
                          type="date"
                          aria-label="Visit date"
                          value={logDate[e.place.id] ?? new Date().toLocaleDateString("en-CA")}
                          onChange={(ev) => setLogDate({ ...logDate, [e.place.id]: ev.target.value })}
                          className="rounded-full border border-line bg-paper px-3 py-1 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => addVisit(e.place, { city: e.city, visitedOn: logDate[e.place.id] })}
                          className="inline-flex items-center gap-1.5 rounded-full bg-plum text-white px-3 py-1.5 text-xs font-semibold hover:bg-plum-dark"
                        >
                          <Repeat className="size-3.5" /> Log another visit
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {tab === "wishlist" && (
                <ul className="space-y-3">
                  {wishlist.length === 0 && <p className="text-muted text-sm">Nothing saved yet. Tap &quot;Want to go&quot; on any place.</p>}
                  {wishlist.map((w) => {
                    const been = visits.filter((v) => v.placeId === w.placeId).length;
                    return (
                      <li key={w.id} className="rounded-3xl border border-line bg-card p-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs text-muted">
                            {w.place.kind}
                            {w.city && ` · ${w.city}`}
                            {been > 0 && ` · been ${been}×`}
                          </p>
                          <h3 className="font-semibold text-lg leading-snug">{w.place.name}</h3>
                          {w.place.address && <p className="text-xs text-muted">{w.place.address}</p>}
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => addVisit(w.place, { city: w.city })} className="inline-flex items-center gap-1.5 rounded-full bg-plum text-white px-3 py-1.5 text-xs font-semibold hover:bg-plum-dark">
                            <Check className="size-3.5" /> I went
                          </button>
                          <button type="button" onClick={() => toggleWishlist(w.place, w.city)} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold hover:bg-mist">
                            <Trash2 className="size-3.5" /> Remove
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {tab === "plans" && (
                <ul className="space-y-3">
                  {plans.length === 0 && <p className="text-muted text-sm">No saved plans yet.</p>}
                  {plans.map((p) => (
                    <PlanItem key={p.id} plan={p} onDelete={() => deletePlan(p.id)} onLogVisit={(pl) => addVisit(pl, { city: p.locationLabel, visitedOn: p.planDate || undefined })} />
                  ))}
                </ul>
              )}

              {tab === "cities" && (
                <ul className="grid sm:grid-cols-2 gap-3">
                  {cities.map(([name, c]) => (
                    <li key={name} className="rounded-3xl border border-line bg-card p-4">
                      <h3 className="font-display text-xl font-bold">{name}</h3>
                      <p className="text-sm text-muted mt-1">
                        {c.places.size} place{c.places.size === 1 ? "" : "s"} · {c.visits} visit{c.visits === 1 ? "" : "s"}
                      </p>
                      <p className="text-xs text-muted mt-0.5">Last: {fmtDate(c.last)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="lg:sticky lg:top-20">
              <div className="rounded-[28px] overflow-hidden border border-line shadow-card h-[340px] lg:h-[calc(100vh-7rem)]">
                <MapView points={points} />
              </div>
              <p className="mt-2 text-xs text-muted">Blue = places you&apos;ve been · Orange = want to go</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PlanItem({ plan, onDelete, onLogVisit }: { plan: SavedPlan; onDelete: () => void; onLogVisit: (p: PlaceSnapshot) => void }) {
  const [open, setOpen] = useState(false);
  const low = plan.stops.reduce((s, x) => s + x.costLow, 0);
  const high = plan.stops.reduce((s, x) => s + x.costHigh, 0);
  const days = [...new Set(plan.stops.map((s) => s.day ?? 1))];
  return (
    <li className="rounded-3xl border border-line bg-card p-4">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-start justify-between gap-3 text-left">
        <div>
          <p className="text-xs text-muted">
            {plan.kind === "trip" ? "Trip" : "Outing"} · {plan.planDate ? fmtDate(plan.planDate) : "No date"} · {plan.stops.length} stops · {money(low, high)} est.
          </p>
          <h3 className="font-semibold text-lg leading-snug">{plan.title}</h3>
        </div>
        <ChevronDown className={cn("size-5 shrink-0 mt-1 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          {days.map((d) => (
            <div key={d}>
              {days.length > 1 && <p className="text-xs font-bold uppercase tracking-wide text-orchid-dark mb-1">Day {d}</p>}
              <ol className="space-y-2">
                {plan.stops
                  .filter((s) => (s.day ?? 1) === d)
                  .map((s, i) => (
                    <li key={s.place.id + i} className="flex items-center justify-between gap-3 rounded-2xl bg-paper px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-xs text-muted tabular-nums">
                          {fmtTime(s.arrive)}–{fmtTime(s.depart)} · {CATEGORIES[s.place.category]?.label ?? s.place.kind}
                        </p>
                        <p className="font-medium truncate">{s.place.name}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs">{money(s.costLow, s.costHigh)}</span>
                        <ConfidenceBadge c={s.costConfidence} />
                        <button type="button" onClick={() => onLogVisit(s.place)} title="Log a visit" className="rounded-full p-1.5 hover:bg-mist">
                          <Check className="size-4" />
                        </button>
                      </div>
                    </li>
                  ))}
              </ol>
            </div>
          ))}
          <button type="button" onClick={onDelete} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-orchid-dark">
            <Trash2 className="size-4" /> Delete plan
          </button>
        </div>
      )}
    </li>
  );
}
