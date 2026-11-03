"use client";

import { Check, CloudOff, Home, LogOut, Trash2 } from "lucide-react";
import { useState } from "react";
import { AuthForm } from "@/components/AuthForm";
import { LocationPicker, type PickedLocation } from "@/components/LocationPicker";
import { Photo } from "@/components/Photo";
import { supabaseConfigured, useWander } from "@/components/WanderProvider";
import { INTERESTS } from "@/lib/categories";
import { TRANSPORT } from "@/lib/geo";
import type { Interest, Transport } from "@/lib/types";
import { cn } from "@/lib/cn";

export default function HomeBasePage() {
  const { ready, user, profile, setHomeBase, setPreferences, signOut, visits, plans, wishlist } = useWander();
  const [picked, setPicked] = useState<PickedLocation | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const home = profile.homeBase;

  async function saveHome() {
    if (!picked) return;
    const { source: _source, ...h } = picked;
    void _source;
    try {
      await setHomeBase(h);
      setPicked(null);
      setStatus("Home Base saved.");
    } catch (e) {
      setStatus((e as Error).message);
    }
  }

  const interests = (profile.defaultInterests ?? []) as Interest[];

  return (
    <div className="mx-auto max-w-5xl px-4 md:px-6 py-10">
      <p className="text-orchid font-semibold text-sm tracking-widest uppercase">Home Base</p>
      <h1 className="font-display text-4xl md:text-5xl font-extrabold mt-1">Where you&apos;re based</h1>
      <p className="text-ink-soft mt-2 max-w-xl">Your Home Base is the default starting point for Explore My City and Take Me Somewhere. You can always explore another city without changing it.</p>

      <div className="mt-8 grid lg:grid-cols-[1.2fr_1fr] gap-6 items-start">
        <section className="rounded-[28px] bg-card border border-line shadow-card overflow-hidden">
          {home ? (
            <Photo title={home.countryCode === "US" && home.region ? `${home.city}, ${home.region}` : home.city} className="h-44" fallbackHue={160}>
              <div className="absolute inset-0 bg-gradient-to-t from-plum-dark/85 to-plum-dark/10" />
              <div className="absolute bottom-0 p-5 text-white">
                <p className="text-xs uppercase tracking-widest text-lilac font-semibold flex items-center gap-1.5">
                  <Home className="size-3.5" /> Current Home Base
                </p>
                <p className="font-display text-3xl font-extrabold">{home.label}</p>
              </div>
            </Photo>
          ) : (
            <div className="h-44 bg-plum topo grid place-items-center text-white/80">
              <p className="flex items-center gap-2">
                <Home className="size-5" /> No Home Base yet
              </p>
            </div>
          )}
          <div className="p-5 md:p-6 space-y-4">
            <p className="font-semibold">{home ? "Move your Home Base" : "Set your Home Base"}</p>
            <LocationPicker value={picked} onChange={setPicked} placeholder="Your city or neighborhood" />
            {picked && (
              <button type="button" onClick={saveHome} className="w-full rounded-full bg-plum text-white font-semibold py-3 hover:bg-plum-dark inline-flex justify-center items-center gap-2">
                <Check className="size-4" /> Make {picked.label} my Home Base
              </button>
            )}
            {home && !picked && (
              <button type="button" onClick={() => setHomeBase(null)} className="text-sm text-muted hover:text-orchid-dark inline-flex items-center gap-1.5">
                <Trash2 className="size-3.5" /> Clear Home Base
              </button>
            )}
            {status && <p className="text-sm text-confirm">{status}</p>}
          </div>
        </section>

        <div className="space-y-6">
          <section className="rounded-[28px] bg-card border border-line shadow-card p-5 md:p-6">
            <p className="font-semibold mb-3">Account</p>
            {!ready ? (
              <p className="text-sm text-muted">Loading…</p>
            ) : user ? (
              <div className="space-y-3">
                <p className="text-sm">
                  Signed in as <b>{user.email}</b>
                </p>
                <p className="text-sm text-muted">
                  {plans.length} saved plans · {wishlist.length} saved places · {visits.length} visits — synced to your account.
                </p>
                <button type="button" onClick={signOut} className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-semibold hover:bg-mist">
                  <LogOut className="size-4" /> Sign out
                </button>
              </div>
            ) : supabaseConfigured ? (
              <>
                <p className="text-sm text-muted mb-4">Sign in to keep your Home Base, plans and visits across devices. Anything you saved as a guest moves into your account.</p>
                <AuthForm />
              </>
            ) : (
              <div className="rounded-2xl bg-sand p-4 text-sm text-ink-soft flex gap-3">
                <CloudOff className="size-5 shrink-0 text-muted" />
                <p>
                  <b className="text-ink">Guest mode.</b> Accounts aren&apos;t set up on this server yet, so everything is saved in this browser. Add Supabase keys (see SETUP.md) to turn on sign-in and cloud sync.
                </p>
              </div>
            )}
          </section>

          <section className="rounded-[28px] bg-card border border-line shadow-card p-5 md:p-6">
            <p className="font-semibold">Default preferences</p>
            <p className="text-sm text-muted mb-3">Pre-filled every time you explore.</p>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map((i) => {
                const on = interests.includes(i.key);
                return (
                  <button
                    key={i.key}
                    type="button"
                    onClick={() => setPreferences({ defaultInterests: on ? interests.filter((x) => x !== i.key) : [...interests, i.key] })}
                    className={cn("rounded-full border px-3 py-1.5 text-sm font-medium", on ? "bg-plum text-white border-plum" : "border-line bg-paper hover:bg-mist")}
                  >
                    {i.label}
                  </button>
                );
              })}
            </div>
            <label className="block mt-4 text-sm">
              <span className="font-medium">Usually getting around by</span>
              <select
                value={profile.defaultTransport ?? ""}
                onChange={(e) => setPreferences({ defaultTransport: e.target.value as Transport })}
                className="mt-1 w-full rounded-2xl border border-line bg-paper px-3 py-2.5"
              >
                <option value="" disabled>
                  Choose…
                </option>
                {(Object.keys(TRANSPORT) as Transport[]).map((t) => (
                  <option key={t} value={t}>
                    {TRANSPORT[t].label}
                  </option>
                ))}
              </select>
            </label>
          </section>
        </div>
      </div>
    </div>
  );
}
