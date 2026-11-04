"use client";

import { Crosshair, Home, Loader2, MapPin, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { HomeBase } from "@/lib/store-types";
import { cn } from "@/lib/cn";

export type PickedLocation = HomeBase & { source: "home" | "search" | "gps" };

/**
 * Search box for a city or address. Searches run when you press Enter or the
 * search button (the free geocoder doesn't allow per-keystroke autocomplete).
 */
export function LocationPicker({
  value,
  onChange,
  homeBase,
  usOnly = false,
  placeholder = "City, neighborhood, or address",
}: {
  value: PickedLocation | null;
  onChange: (l: PickedLocation | null) => void;
  homeBase?: HomeBase | null;
  usOnly?: boolean;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const [results, setResults] = useState<HomeBase[] | null>(null);
  const [busy, setBusy] = useState<"search" | "gps" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wantEdit, setWantEdit] = useState(false);
  const editing = !value || wantEdit;
  const setEditing = setWantEdit;
  const pick = (l: PickedLocation | null) => {
    setWantEdit(false);
    onChange(l);
  };
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setResults(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  async function search() {
    if (text.trim().length < 2) return;
    setBusy("search");
    setError(null);
    try {
      const r = await fetch(`/api/geocode?q=${encodeURIComponent(text)}${usOnly ? "&us=1" : ""}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setResults(j.results);
      if (!j.results.length) setError(usOnly ? "No matches in the US. Explore My City currently covers the United States." : "No matches found.");
    } catch (e) {
      setError((e as Error).message || "Search failed");
    } finally {
      setBusy(null);
    }
  }

  function useGps() {
    if (!navigator.geolocation) return setError("Your browser doesn't share location.");
    setBusy("gps");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const fallback: HomeBase = { label: "Current location", city: "Current location", country: "", countryCode: "", lat, lng };
        try {
          const r = await fetch(`/api/reverse?lat=${lat}&lng=${lng}`);
          const j = await r.json();
          pick({ ...(j.result ?? fallback), lat, lng, source: "gps" });
        } catch {
          pick({ ...fallback, source: "gps" });
        }
        setBusy(null);
      },
      () => {
        setBusy(null);
        setError("Couldn't get your location. Check browser permissions, or search instead.");
      },
      { timeout: 10000 },
    );
  }

  if (value && !editing) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3">
        <span className={cn("size-9 shrink-0 rounded-full grid place-items-center", value.source === "home" ? "bg-plum text-white" : "bg-orchid/15 text-orchid")}>
          {value.source === "home" ? <Home className="size-4" /> : <MapPin className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold truncate">{value.label}</p>
          <p className="text-xs text-muted">
            {value.source === "home" ? "Your Home Base" : value.source === "gps" ? "Your current location" : "Exploring somewhere else · your Home Base stays the same"}
          </p>
        </div>
        <button type="button" onClick={() => setEditing(true)} className="text-sm font-semibold text-orchid hover:underline">
          Change
        </button>
      </div>
    );
  }

  return (
    <div ref={box} className="relative">
      <div className="flex items-center gap-2 rounded-2xl border border-line bg-card px-3 py-2 focus-within:ring-2 focus-within:ring-orchid/40">
        <Search className="size-4 text-muted shrink-0" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              search();
            }
          }}
          placeholder={placeholder}
          className="flex-1 min-w-0 bg-transparent py-1.5 outline-none placeholder:text-muted"
          aria-label="Search for a location"
        />
        <button type="button" onClick={search} disabled={busy !== null} className="rounded-full bg-plum text-white text-sm font-semibold px-3.5 py-1.5 disabled:opacity-50">
          {busy === "search" ? <Loader2 className="size-4 animate-spin" /> : "Search"}
        </button>
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        <button type="button" onClick={useGps} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5 text-sm hover:bg-mist">
          {busy === "gps" ? <Loader2 className="size-3.5 animate-spin" /> : <Crosshair className="size-3.5" />} Use my location
        </button>
        {homeBase && (
          <button type="button" onClick={() => pick({ ...homeBase, source: "home" })} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5 text-sm hover:bg-mist">
            <Home className="size-3.5" /> {homeBase.label}
          </button>
        )}
        {value && (
          <button type="button" onClick={() => setEditing(false)} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-muted hover:text-ink">
            <X className="size-3.5" /> Cancel
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-orchid-dark">{error}</p>}
      {results && results.length > 0 && (
        <ul className="relative mt-2 w-full rounded-2xl border border-line bg-card shadow-card overflow-hidden">
          {results.map((r, i) => (
            <li key={i}>
              <button
                type="button"
                className="w-full text-left px-4 py-3 hover:bg-mist flex items-center gap-3"
                onClick={() => {
                  pick({ ...r, source: "search" });
                  setResults(null);
                  setText("");
                }}
              >
                <MapPin className="size-4 text-orchid shrink-0" />
                <span>
                  <span className="font-medium">{r.label}</span>
                  <span className="block text-xs text-muted">{r.country}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
