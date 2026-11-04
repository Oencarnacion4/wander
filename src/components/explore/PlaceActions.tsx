"use client";

import { CalendarSearch, Check, ExternalLink, Heart, Navigation } from "lucide-react";
import { useState } from "react";
import { useWander } from "@/components/WanderProvider";
import type { PlaceSnapshot } from "@/lib/store-types";
import { CATEGORIES } from "@/lib/categories";
import type { Place } from "@/lib/types";
import { cn } from "@/lib/cn";

export function snapshot(p: Place): PlaceSnapshot {
  return { id: p.id, name: p.name, category: p.category, kind: p.kind, lat: p.lat, lng: p.lng, address: p.address, website: p.website };
}

export function directionsUrl(p: { lat: number; lng: number; name: string }) {
  return `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
}

/** Wishlist / "I went here" / directions / website buttons shared by stop and idea cards. */
export function PlaceActions({ place, city, compact = false }: { place: Place; city?: string; compact?: boolean }) {
  const { wishlist, toggleWishlist, addVisit, lastVisitByPlace } = useWander();
  const saved = wishlist.some((w) => w.placeId === place.id);
  const [justLogged, setJustLogged] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const btn = "inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold hover:bg-mist transition-colors";
  const run = (fn: () => Promise<void>) => fn().catch((e) => setErr((e as Error).message));
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className={cn(btn, saved && "bg-orchid/10 border-orchid/40 text-orchid-dark")} onClick={() => run(() => toggleWishlist(snapshot(place), city))} aria-pressed={saved}>
        <Heart className={cn("size-3.5", saved && "fill-current")} /> {saved ? "Saved" : "Want to go"}
      </button>
      <button
        type="button"
        className={cn(btn, justLogged && "bg-confirm/10 border-confirm/40 text-confirm")}
        onClick={() =>
          run(async () => {
            await addVisit(snapshot(place), { city });
            setJustLogged(true);
            setTimeout(() => setJustLogged(false), 2500);
          })
        }
        title="Log a visit. You can log the same place again any time."
      >
        <Check className="size-3.5" /> {justLogged ? "Logged!" : lastVisitByPlace[place.id] ? "Went again" : "I went here"}
      </button>
      {!compact && (
        <a className={btn} href={directionsUrl(place)} target="_blank" rel="noreferrer">
          <Navigation className="size-3.5" /> Directions
        </a>
      )}
      {CATEGORIES[place.category].eventOnly && (
        <a className={cn(btn, "border-plum/40 text-plum")} href={`https://www.google.com/search?q=${encodeURIComponent(`${place.name} ${city ?? ""} events schedule`)}`} target="_blank" rel="noreferrer">
          <CalendarSearch className="size-3.5" /> See what&apos;s on
        </a>
      )}
      {!compact && place.website && (
        <a className={btn} href={place.website} target="_blank" rel="noreferrer">
          <ExternalLink className="size-3.5" /> Website
        </a>
      )}
      {err && <span className="text-xs text-orchid-dark">{err}</span>}
    </div>
  );
}
