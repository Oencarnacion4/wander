"use client";

import type { User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";
import type { HomeBase, PlaceSnapshot, Profile, SavedPlan, Visit, WishItem } from "@/lib/store-types";

/**
 * One place for all of a user's data. When Supabase is configured and the
 * user is signed in, data lives in Postgres (protected by Row-Level Security).
 * Otherwise WANDER runs in "guest mode" and keeps data in this browser.
 * Guest data is uploaded to the account the first time you sign in.
 */

interface Data {
  profile: Profile;
  plans: SavedPlan[];
  wishlist: WishItem[];
  visits: Visit[];
}

const EMPTY: Data = { profile: {}, plans: [], wishlist: [], visits: [] };
const LS_KEY = "wander:guest:v1";

interface Ctx extends Data {
  ready: boolean;
  user: User | null;
  cloud: boolean;
  setHomeBase: (h: HomeBase | null) => Promise<void>;
  setPreferences: (p: { defaultInterests?: string[]; defaultTransport?: string; displayName?: string }) => Promise<void>;
  savePlan: (p: Omit<SavedPlan, "id" | "createdAt">) => Promise<SavedPlan>;
  deletePlan: (id: string) => Promise<void>;
  toggleWishlist: (place: PlaceSnapshot, city?: string) => Promise<void>;
  addVisit: (place: PlaceSnapshot, opts?: { city?: string; visitedOn?: string; rating?: number | null; note?: string | null }) => Promise<void>;
  deleteVisit: (id: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** placeId -> most recent visit date, fed to the recommender. */
  lastVisitByPlace: Record<string, string>;
}

const WanderContext = createContext<Ctx | null>(null);

function loadGuest(): Data {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
  } catch {
    return EMPTY;
  }
}
function saveGuest(d: Data) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(d));
  } catch {
    /* storage full or blocked: nothing we can do */
  }
}
const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now() + Math.random()));
const today = () => new Date().toLocaleDateString("en-CA");

/* ---------- Supabase row mappers ---------- */
type Row = Record<string, unknown>;
const planFromRow = (r: Row): SavedPlan => ({
  id: r.id as string,
  kind: r.kind as SavedPlan["kind"],
  title: r.title as string,
  locationLabel: (r.location_label as string) ?? "",
  lat: r.lat as number,
  lng: r.lng as number,
  planDate: (r.plan_date as string) ?? "",
  query: r.query as SavedPlan["query"],
  stops: r.stops as SavedPlan["stops"],
  createdAt: r.created_at as string,
});
const wishFromRow = (r: Row): WishItem => ({ id: r.id as string, placeId: r.place_id as string, place: r.place as PlaceSnapshot, city: (r.city as string) ?? undefined, createdAt: r.created_at as string });
const visitFromRow = (r: Row): Visit => ({
  id: r.id as string,
  placeId: r.place_id as string,
  place: r.place as PlaceSnapshot,
  city: (r.city as string) ?? undefined,
  visitedOn: r.visited_on as string,
  rating: r.rating as number | null,
  note: r.note as string | null,
});

export function WanderProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Data>(EMPTY);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const sb = getSupabase();
  const cloud = Boolean(sb && user);

  const loadCloud = useCallback(async (u: User) => {
    if (!sb) return;
    // Upload any guest data first, so nothing saved before signing in is lost.
    const guest = loadGuest();
    if (guest.plans.length || guest.wishlist.length || guest.visits.length || guest.profile.homeBase) {
      if (guest.profile.homeBase) {
        const h = guest.profile.homeBase;
        await sb.from("profiles").upsert({ id: u.id, home_label: h.label, home_city: h.city, home_region: h.region, home_country: h.countryCode, home_lat: h.lat, home_lng: h.lng });
      }
      if (guest.plans.length)
        await sb.from("plans").insert(guest.plans.map((p) => ({ user_id: u.id, kind: p.kind, title: p.title, location_label: p.locationLabel, lat: p.lat, lng: p.lng, plan_date: p.planDate || null, query: p.query, stops: p.stops })));
      if (guest.wishlist.length)
        await sb.from("wishlist").upsert(guest.wishlist.map((w) => ({ user_id: u.id, place_id: w.placeId, place: w.place, city: w.city })), { onConflict: "user_id,place_id" });
      if (guest.visits.length)
        await sb.from("visits").insert(guest.visits.map((v) => ({ user_id: u.id, place_id: v.placeId, place: v.place, city: v.city, visited_on: v.visitedOn, rating: v.rating, note: v.note })));
      localStorage.removeItem(LS_KEY);
    }
    const [prof, plans, wish, visits] = await Promise.all([
      sb.from("profiles").select("*").eq("id", u.id).maybeSingle(),
      sb.from("plans").select("*").order("created_at", { ascending: false }),
      sb.from("wishlist").select("*").order("created_at", { ascending: false }),
      sb.from("visits").select("*").order("visited_on", { ascending: false }),
    ]);
    const p = prof.data as Row | null;
    setData({
      profile: {
        displayName: (p?.display_name as string) ?? u.email?.split("@")[0],
        homeBase:
          p && p.home_lat != null
            ? { label: p.home_label as string, city: p.home_city as string, region: (p.home_region as string) ?? undefined, country: (p.home_country as string) ?? "", countryCode: (p.home_country as string) ?? "", lat: p.home_lat as number, lng: p.home_lng as number }
            : null,
        defaultInterests: (p?.default_interests as string[]) ?? [],
        defaultTransport: (p?.default_transport as string) ?? null,
      },
      plans: (plans.data ?? []).map(planFromRow),
      wishlist: (wish.data ?? []).map(wishFromRow),
      visits: (visits.data ?? []).map(visitFromRow),
    });
  }, [sb]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (!sb) {
        setData(loadGuest());
        setReady(true);
        return;
      }
      const { data: s } = await sb.auth.getSession();
      if (cancelled) return;
      const u = s.session?.user ?? null;
      setUser(u);
      if (u) await loadCloud(u).catch(() => setData(loadGuest()));
      else setData(loadGuest());
      setReady(true);
    }
    init();
    const sub = sb?.auth.onAuthStateChange((event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (event === "SIGNED_IN" && u) loadCloud(u);
      if (event === "SIGNED_OUT") setData(loadGuest());
    });
    return () => {
      cancelled = true;
      sub?.data.subscription.unsubscribe();
    };
  }, [sb, loadCloud]);

  /** Update local state, and persist to guest storage when not in cloud mode. */
  const mutate = useCallback(
    (fn: (d: Data) => Data) => {
      setData((d) => {
        const next = fn(d);
        if (!cloud) saveGuest(next);
        return next;
      });
    },
    [cloud],
  );

  const must = (res: { error: { message: string } | null }) => {
    if (res.error) throw new Error(res.error.message);
  };

  const value = useMemo<Ctx>(() => {
    const lastVisitByPlace: Record<string, string> = {};
    for (const v of data.visits) if (!lastVisitByPlace[v.placeId] || v.visitedOn > lastVisitByPlace[v.placeId]) lastVisitByPlace[v.placeId] = v.visitedOn;
    return {
      ...data,
      ready,
      user,
      cloud,
      lastVisitByPlace,
      async setHomeBase(h) {
        if (cloud && sb && user) {
          must(await sb.from("profiles").upsert({ id: user.id, home_label: h?.label ?? null, home_city: h?.city ?? null, home_region: h?.region ?? null, home_country: h?.countryCode ?? null, home_lat: h?.lat ?? null, home_lng: h?.lng ?? null, updated_at: new Date().toISOString() }));
        }
        mutate((d) => ({ ...d, profile: { ...d.profile, homeBase: h } }));
      },
      async setPreferences(p) {
        if (cloud && sb && user) {
          must(await sb.from("profiles").upsert({ id: user.id, ...(p.defaultInterests && { default_interests: p.defaultInterests }), ...(p.defaultTransport && { default_transport: p.defaultTransport }), ...(p.displayName !== undefined && { display_name: p.displayName }) }));
        }
        mutate((d) => ({ ...d, profile: { ...d.profile, ...p } }));
      },
      async savePlan(p) {
        let plan: SavedPlan = { ...p, id: uid(), createdAt: new Date().toISOString() };
        if (cloud && sb && user) {
          const res = await sb.from("plans").insert({ user_id: user.id, kind: p.kind, title: p.title, location_label: p.locationLabel, lat: p.lat, lng: p.lng, plan_date: p.planDate || null, query: p.query, stops: p.stops }).select().single();
          must(res);
          plan = planFromRow(res.data as Row);
        }
        mutate((d) => ({ ...d, plans: [plan, ...d.plans] }));
        return plan;
      },
      async deletePlan(id) {
        if (cloud && sb) must(await sb.from("plans").delete().eq("id", id));
        mutate((d) => ({ ...d, plans: d.plans.filter((p) => p.id !== id) }));
      },
      async toggleWishlist(place, city) {
        const existing = data.wishlist.find((w) => w.placeId === place.id);
        if (existing) {
          if (cloud && sb) must(await sb.from("wishlist").delete().eq("id", existing.id));
          mutate((d) => ({ ...d, wishlist: d.wishlist.filter((w) => w.placeId !== place.id) }));
          return;
        }
        let item: WishItem = { id: uid(), placeId: place.id, place, city, createdAt: new Date().toISOString() };
        if (cloud && sb && user) {
          const res = await sb.from("wishlist").insert({ user_id: user.id, place_id: place.id, place, city }).select().single();
          must(res);
          item = wishFromRow(res.data as Row);
        }
        mutate((d) => ({ ...d, wishlist: [item, ...d.wishlist] }));
      },
      async addVisit(place, opts = {}) {
        let v: Visit = { id: uid(), placeId: place.id, place, city: opts.city, visitedOn: opts.visitedOn ?? today(), rating: opts.rating ?? null, note: opts.note ?? null };
        if (cloud && sb && user) {
          const res = await sb.from("visits").insert({ user_id: user.id, place_id: place.id, place, city: opts.city, visited_on: v.visitedOn, rating: v.rating, note: v.note }).select().single();
          must(res);
          v = visitFromRow(res.data as Row);
        }
        mutate((d) => ({ ...d, visits: [v, ...d.visits].sort((a, b) => b.visitedOn.localeCompare(a.visitedOn)) }));
      },
      async deleteVisit(id) {
        if (cloud && sb) must(await sb.from("visits").delete().eq("id", id));
        mutate((d) => ({ ...d, visits: d.visits.filter((v) => v.id !== id) }));
      },
      async signOut() {
        await sb?.auth.signOut();
      },
    };
  }, [data, ready, user, cloud, sb, mutate]);

  return <WanderContext.Provider value={value}>{children}</WanderContext.Provider>;
}

export function useWander() {
  const ctx = useContext(WanderContext);
  if (!ctx) throw new Error("useWander must be used inside <WanderProvider>");
  return ctx;
}

export { supabaseConfigured };
