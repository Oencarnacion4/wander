"use client";

import { BarChart3, BookmarkPlus, Check, ChevronDown, Info, ListFilter, Loader2, Map as MapIcon, RotateCcw, SlidersHorizontal } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { money } from "@/components/Badges";
import { Photo } from "@/components/Photo";
import { useWander } from "@/components/WanderProvider";
import { CATEGORIES } from "@/lib/categories";
import { fmtTime } from "@/lib/hours";
import { retime, swapOptions } from "@/lib/itinerary";
import { EXCLUSION_LABELS, WEIGHTS, FEATURE_LABELS, totalBudget, type ExclusionReason } from "@/lib/scoring";
import type { ExploreQuery, ExploreResponse, Itinerary } from "@/lib/types";
import type { PlanStop } from "@/lib/store-types";
import { cn } from "@/lib/cn";
import { ExploreForm, SLOTS, type FormState } from "./ExploreForm";
import { IdeaCard } from "./IdeaCard";
import { snapshot } from "./PlaceActions";
import { StopCard } from "./StopCard";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => <div className="size-full grid place-items-center bg-sand text-muted text-sm">Loading map…</div>,
});

function localDate() {
  return new Date().toLocaleDateString("en-CA");
}
function defaultSlot(): FormState["slot"] {
  const h = new Date().getHours();
  return h < 11 ? "morning" : h < 16 ? "afternoon" : "evening";
}
function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}
function dayName(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "long" });
}
function partOfDay(min: number) {
  return min < 720 ? "morning" : min < 1020 ? "afternoon" : "evening";
}

export function ExploreClient() {
  const { profile, ready, lastVisitByPlace, wishlist, savePlan } = useWander();
  const slot = defaultSlot();
  const [form, setForm] = useState<FormState>({
    location: null,
    date: localDate(),
    slot,
    startTime: SLOTS[slot].time,
    hours: 4,
    budget: 40,
    budgetMode: "per_person",
    adults: 2,
    kids: [],
    transport: "drive",
    interests: ["food", "outdoors"],
    dining: "any",
  });
  const [res, setRes] = useState<ExploreResponse | null>(null);
  const [planIds, setPlanIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [swapIndex, setSwapIndex] = useState<number | null>(null);
  const [tab, setTab] = useState<"plan" | "ideas">("plan");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [saved, setSaved] = useState<"idle" | "saving" | "done">("idle");
  const [showForm, setShowForm] = useState(true);
  const [showMath, setShowMath] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Default to Home Base once the profile has loaded.
  const seeded = useRef(false);
  useEffect(() => {
    if (!ready || seeded.current) return;
    seeded.current = true;
    setForm((f) => ({
      ...f,
      location: f.location ?? (profile.homeBase ? { ...profile.homeBase, source: "home" } : null),
      interests: profile.defaultInterests?.length ? (profile.defaultInterests as FormState["interests"]) : f.interests,
      transport: (profile.defaultTransport as FormState["transport"]) ?? f.transport,
    }));
  }, [ready, profile]);

  const byId = useMemo(() => new Map((res?.candidates ?? []).map((c) => [c.place.id, c])), [res]);
  const itinerary: Itinerary | null = useMemo(() => (res ? retime(planIds, byId, res.query) : null), [res, planIds, byId]);

  async function run() {
    if (!form.location) return;
    setLoading(true);
    setError(null);
    setSwapIndex(null);
    setSaved("idle");
    const query: ExploreQuery = {
      lat: form.location.lat,
      lng: form.location.lng,
      locationLabel: form.location.label,
      date: form.date,
      startMinutes: toMinutes(form.startTime || "09:00"),
      durationMinutes: Math.round(form.hours * 60),
      budget: form.budget,
      budgetMode: form.budgetMode,
      adults: form.adults,
      children: form.kids.map((age) => ({ age })),
      transport: form.transport,
      interests: form.kids.length ? form.interests.filter((i) => i !== "nightlife") : form.interests,
      dining: form.dining,
      visited: lastVisitByPlace,
      wishlist: wishlist.map((w) => w.placeId),
    };
    try {
      const r = await fetch("/api/explore", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(query) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Something went wrong");
      const data = j as ExploreResponse;
      setRes(data);
      setPlanIds(data.itinerary.stops.map((s) => s.placeId));
      setTab("plan");
      setShowForm(false);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const swapChoices = useMemo(() => (res && swapIndex !== null ? swapOptions(planIds, swapIndex, res.candidates, res.query) : []), [res, swapIndex, planIds]);

  const ideas = useMemo(() => {
    if (!res) return [];
    const inPlan = new Set(planIds);
    return res.candidates.filter((c) => !inPlan.has(c.place.id) && (catFilter === "all" || CATEGORIES[c.place.category].interests[0] === catFilter));
  }, [res, planIds, catFilter]);

  const ideaCats = useMemo(() => {
    const s = new Set((res?.candidates ?? []).map((c) => CATEGORIES[c.place.category].interests[0]));
    return [...s];
  }, [res]);

  const points = useMemo(() => {
    if (!res || !itinerary) return [];
    const plan = itinerary.stops.map((s, i) => {
      const c = byId.get(s.placeId)!;
      return { id: c.place.id, lat: c.place.lat, lng: c.place.lng, label: `${i + 1}. ${c.place.name}`, sub: `${fmtTime(s.arrive)} · ${c.place.kind}`, n: i + 1, tone: "plan" as const };
    });
    const start = { id: "__start", lat: res.query.lat, lng: res.query.lng, label: res.query.locationLabel || "Start", sub: "Starting point", tone: "home" as const };
    const others =
      tab === "ideas"
        ? ideas.slice(0, 60).map((c) => ({ id: c.place.id, lat: c.place.lat, lng: c.place.lng, label: c.place.name, sub: c.place.kind, tone: "option" as const }))
        : swapChoices.map((o) => ({ id: o.candidate.place.id, lat: o.candidate.place.lat, lng: o.candidate.place.lng, label: o.candidate.place.name, sub: `Swap option · ${o.candidate.place.kind}`, tone: "option" as const }));
    return [start, ...plan, ...others];
  }, [res, itinerary, byId, tab, ideas, swapChoices]);

  const route = useMemo<[number, number][]>(() => {
    if (!res || !itinerary) return [];
    return [[res.query.lat, res.query.lng], ...itinerary.stops.map((s) => [byId.get(s.placeId)!.place.lat, byId.get(s.placeId)!.place.lng] as [number, number])];
  }, [res, itinerary, byId]);

  async function save() {
    if (!res || !itinerary) return;
    setSaved("saving");
    const stops: PlanStop[] = itinerary.stops.map((s) => ({
      place: snapshot(byId.get(s.placeId)!.place),
      arrive: s.arrive,
      depart: s.depart,
      costLow: s.cost.low,
      costHigh: s.cost.high,
      costConfidence: s.cost.confidence,
    }));
    try {
      await savePlan({
        kind: "explore",
        title: `${dayName(res.query.date)} ${partOfDay(res.query.startMinutes)} in ${res.query.locationLabel.split(",")[0]}`,
        locationLabel: res.query.locationLabel,
        lat: res.query.lat,
        lng: res.query.lng,
        planDate: res.query.date,
        query: res.query,
        stops,
      });
      setSaved("done");
    } catch (e) {
      setError((e as Error).message);
      setSaved("idle");
    }
  }

  const city = res?.query.locationLabel;
  // Wikipedia names US cities "Durham, North Carolina", so use the full state name for the photo lookup.
  const photoTitle = form.location?.countryCode === "US" && form.location.region ? `${form.location.city}, ${form.location.region}` : (form.location?.city ?? "");

  return (
    <div>
      {/* Header band */}
      <section className="plum-band text-white topo">
        <div className="mx-auto max-w-7xl px-4 md:px-6 pt-10 pb-24 md:pt-14">
          <p className="text-lilac font-semibold text-sm tracking-widest uppercase">Explore My City</p>
          <h1 className="font-display text-4xl md:text-5xl font-extrabold mt-2 max-w-2xl leading-[1.05]">What should we do today?</h1>
          <p className="text-white/70 mt-3 max-w-xl">Tell us your time, budget and crew. WANDER ranks real places nearby and builds a plan that fits opening hours and travel time.</p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 md:px-6 -mt-16">
        <div className="rounded-[28px] bg-card border border-line shadow-lift p-5 md:p-7">
          {showForm || !res ? (
            <ExploreForm form={form} setForm={setForm} onSubmit={run} loading={loading} homeBase={profile.homeBase} />
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-ink-soft">
                <p className="font-semibold text-ink text-base">{res.query.locationLabel}</p>
                <p>
                  {dayName(res.query.date)} {fmtTime(res.query.startMinutes)} · {form.hours} h · {res.query.adults} adult{res.query.adults > 1 ? "s" : ""}
                  {res.query.children.length ? ` + ${res.query.children.length} kid${res.query.children.length > 1 ? "s" : ""}` : ""} · ${totalBudget(res.query)} total budget
                </p>
              </div>
              <button type="button" onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-semibold hover:bg-mist">
                <SlidersHorizontal className="size-4" /> Edit search
              </button>
            </div>
          )}
          {error && (
            <p role="alert" className="mt-4 rounded-2xl bg-orchid/10 text-orchid-dark px-4 py-3 text-sm">
              {error}
            </p>
          )}
        </div>
      </div>

      {res && itinerary && (
        <div ref={resultsRef} className="mx-auto max-w-7xl px-4 md:px-6 mt-10 scroll-mt-20">
          {/* Summary */}
          <Photo title={photoTitle} className="rounded-[28px] h-48 md:h-56" fallbackHue={170}>
            <div className="absolute inset-0 bg-gradient-to-t from-plum-dark/90 via-plum-dark/40 to-plum-dark/10" />
            <div className="absolute inset-x-0 bottom-0 p-5 md:p-7 text-white flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-white/75 text-sm">Your plan</p>
                <h2 className="font-display text-3xl md:text-4xl font-extrabold">
                  {dayName(res.query.date)} {partOfDay(res.query.startMinutes)} in {res.query.locationLabel.split(",")[0]}
                </h2>
                <p className="text-white/80 text-sm mt-1">
                  {itinerary.stops.length} stops · {fmtTime(res.query.startMinutes)}–{fmtTime(itinerary.endMinutes)} · {money(itinerary.totalCostLow, itinerary.totalCostHigh)} est. for the group
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={run} className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur px-4 py-2 text-sm font-semibold hover:bg-white/25">
                  <RotateCcw className="size-4" /> Rebuild
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={saved !== "idle" || itinerary.stops.length === 0}
                  className="inline-flex items-center gap-2 rounded-full bg-orchid px-4 py-2 text-sm font-semibold hover:bg-orchid-dark disabled:opacity-80"
                >
                  {saved === "done" ? <Check className="size-4" /> : saved === "saving" ? <Loader2 className="size-4 animate-spin" /> : <BookmarkPlus className="size-4" />}
                  {saved === "done" ? "Saved" : "Save plan"}
                </button>
              </div>
            </div>
          </Photo>
          {saved === "done" && (
            <p className="mt-3 text-sm text-confirm">
              Saved to <Link href="/adventures" className="underline font-semibold">My Adventures</Link>.
            </p>
          )}

          <div className="mt-6 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] gap-6 items-start">
            <div>
              <div className="flex items-center gap-1 rounded-full bg-sand p-1 w-fit mb-5">
                {(["plan", "ideas"] as const).map((t) => (
                  <button key={t} type="button" onClick={() => setTab(t)} className={cn("rounded-full px-4 py-2 text-sm font-semibold", tab === t ? "bg-card shadow-card text-ink" : "text-ink-soft")}>
                    {t === "plan" ? `Itinerary (${itinerary.stops.length})` : `More ideas (${ideas.length})`}
                  </button>
                ))}
              </div>

              {tab === "plan" && (
                <>
                  {itinerary.notes.map((n) => (
                    <p key={n} className="mb-3 rounded-2xl bg-estimate/10 text-estimate px-4 py-3 text-sm flex gap-2">
                      <Info className="size-4 shrink-0 mt-0.5" /> {n}
                    </p>
                  ))}
                  {itinerary.stops.length === 0 && (
                    <div className="rounded-3xl border border-dashed border-line p-8 text-center text-ink-soft">
                      <p className="font-semibold text-ink">No plan fits yet.</p>
                      <p className="text-sm mt-1">
                        {res.candidates.length ? "Add places from More ideas, or loosen your time or budget." : "We couldn't find matching places nearby. Try another interest or a farther-reaching transport mode."}
                      </p>
                    </div>
                  )}
                  <ol className="space-y-5">
                    {itinerary.stops.map((s, i) => {
                      const c = byId.get(s.placeId)!;
                      return (
                        <StopCard
                          key={s.placeId}
                          n={i + 1}
                          stop={s}
                          c={c}
                          transport={res.query.transport}
                          city={city}
                          active={activeId === s.placeId}
                          onFocus={() => setActiveId(s.placeId)}
                          swapOpen={swapIndex === i}
                          onSwap={() => setSwapIndex(swapIndex === i ? null : i)}
                          onRemove={() => {
                            setPlanIds(planIds.filter((id) => id !== s.placeId));
                            setSwapIndex(null);
                            setSaved("idle");
                          }}
                        >
                          {swapIndex === i && (
                            <div className="mt-4 rounded-2xl bg-paper border border-line p-3">
                              <p className="text-sm font-semibold mb-2">Swap for one of these — each keeps the rest of your plan working:</p>
                              {swapChoices.length === 0 && <p className="text-sm text-muted">No alternatives fit this slot. Try removing this stop instead.</p>}
                              <div className="grid gap-2">
                                {swapChoices.map((o) => (
                                  <IdeaCard
                                    key={o.candidate.place.id}
                                    c={o.candidate}
                                    city={city}
                                    active={activeId === o.candidate.place.id}
                                    onFocus={() => setActiveId(o.candidate.place.id)}
                                    actionLabel="Use this"
                                    actionNote={`Plan would end ${fmtTime(o.itinerary.endMinutes)} · ${money(o.itinerary.totalCostLow, o.itinerary.totalCostHigh)} total`}
                                    onAction={() => {
                                      const next = [...planIds];
                                      next[i] = o.candidate.place.id;
                                      setPlanIds(next);
                                      setSwapIndex(null);
                                      setSaved("idle");
                                    }}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </StopCard>
                      );
                    })}
                  </ol>
                </>
              )}

              {tab === "ideas" && (
                <>
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <ListFilter className="size-4 text-muted" />
                    {["all", ...ideaCats].map((k) => (
                      <button key={k} type="button" onClick={() => setCatFilter(k)} className={cn("rounded-full border px-3 py-1 text-xs font-semibold capitalize", catFilter === k ? "bg-plum text-white border-plum" : "border-line bg-card")}>
                        {k}
                      </button>
                    ))}
                  </div>
                  <div className="grid gap-3">
                    {ideas.slice(0, 60).map((c) => (
                      <IdeaCard
                        key={c.place.id}
                        c={c}
                        rank={res.candidates.indexOf(c) + 1}
                        city={city}
                        active={activeId === c.place.id}
                        onFocus={() => setActiveId(c.place.id)}
                        actionLabel="Add to plan"
                        onAction={() => {
                          setPlanIds([...planIds, c.place.id]);
                          setSaved("idle");
                        }}
                      />
                    ))}
                    {ideas.length === 0 && <p className="text-sm text-muted">Nothing else matched.</p>}
                  </div>
                </>
              )}

              {/* How it works */}
              <div className="mt-8 rounded-3xl border border-line bg-card p-5">
                <button type="button" onClick={() => setShowMath(!showMath)} className="w-full flex items-center justify-between font-semibold">
                  <span className="inline-flex items-center gap-2">
                    <BarChart3 className="size-4 text-plum" /> How WANDER ranked these
                  </span>
                  <ChevronDown className={cn("size-4 transition-transform", showMath && "rotate-180")} />
                </button>
                {showMath && <RankingExplainer res={res} />}
              </div>
            </div>

            <div className="lg:sticky lg:top-20">
              <div className="rounded-[28px] overflow-hidden border border-line shadow-card h-[340px] md:h-[460px] lg:h-[calc(100vh-7rem)]">
                <MapView points={points} route={route} activeId={activeId} onSelect={setActiveId} />
              </div>
              <p className="mt-2 text-xs text-muted flex items-center gap-1.5">
                <MapIcon className="size-3.5" /> Numbered pins are your plan. {tab === "ideas" ? "Green dots are more ideas." : swapIndex !== null ? "Green dots are swap options." : ""}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RankingExplainer({ res }: { res: ExploreResponse }) {
  const excluded = Object.entries(res.stats.excluded) as [ExclusionReason, number][];
  return (
    <div className="mt-4 text-sm text-ink-soft space-y-4">
      <p>
        We pulled <b className="text-ink">{res.stats.fetched}</b> real places within <b className="text-ink">{res.stats.radiusKm} km</b> from OpenStreetMap.{" "}
        <b className="text-ink">{res.stats.afterFilters}</b> passed the hard constraints
        {excluded.length > 0 && <> — the rest were {excluded.map(([k, n]) => `${n} ${EXCLUSION_LABELS[k]}`).join(", ")}</>}.
      </p>
      <div>
        <p className="font-semibold text-ink mb-2">Each place gets a score from 0 to 100:</p>
        <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
          {(Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]).map((k) => (
            <li key={k} className="flex justify-between border-b border-line/70 py-1">
              <span>{FEATURE_LABELS[k]}</span>
              <span className="tabular-nums font-semibold text-ink">{Math.round(WEIGHTS[k] * 100)}%</span>
            </li>
          ))}
        </ul>
      </div>
      <p>
        Then a <b className="text-ink">beam search</b> builds the itinerary: it tries many orderings, keeps the 8 best partial plans at each step, and only adds a stop if it&apos;s open when you&apos;d arrive and still fits your time and budget. Repeating a
        category costs points, so you get variety. Places you&apos;ve visited are never hidden — a recent visit just lowers their &quot;something new&quot; score.
      </p>
      <p className="text-xs">
        <b>Confirmed</b> = from the map data. <b>Estimate</b> = WANDER&apos;s typical value for that kind of place. <b>Unverified</b> = not listed; check before you go.
      </p>
    </div>
  );
}
