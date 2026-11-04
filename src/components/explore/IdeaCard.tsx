"use client";

import { Plus } from "lucide-react";
import { ConfidenceBadge, costLabel } from "@/components/Badges";
import type { ScoredPlace } from "@/lib/types";
import { cn } from "@/lib/cn";
import { PlaceActions } from "./PlaceActions";

/** A ranked alternative: shown in "More ideas" and in the swap panel. */
export function IdeaCard({
  c,
  rank,
  city,
  active,
  onFocus,
  actionLabel,
  onAction,
  actionNote,
}: {
  c: ScoredPlace;
  rank?: number;
  city?: string;
  active?: boolean;
  onFocus?: () => void;
  actionLabel?: string;
  onAction?: () => void;
  actionNote?: string;
}) {
  return (
    <div onMouseEnter={onFocus} className={cn("rounded-2xl border bg-card p-4 transition-all", active ? "border-plum ring-2 ring-plum/15" : "border-line")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted">
            {rank != null && <span className="font-semibold text-ink-soft">#{rank} · </span>}
            {c.place.kind} · {c.distanceKm < 1 ? `${Math.round(c.distanceKm * 1000)} m` : `${c.distanceKm.toFixed(1)} km`} away
          </p>
          <h4 className="font-semibold leading-snug mt-0.5">{c.place.name}</h4>
        </div>
        <div className="text-right shrink-0">
          <p className="font-display font-bold text-plum text-lg leading-none">{Math.round(c.score * 100)}</p>
          <p className="text-[10px] uppercase tracking-wide text-muted">match</p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
        <span className="inline-flex items-center gap-1">
          {costLabel(c.cost)} <ConfidenceBadge c={c.cost.confidence} title={c.cost.note} />
        </span>
        <span className="inline-flex items-center gap-1">
          <ConfidenceBadge c={c.hours.confidence} /> <span className="truncate max-w-56">{c.hours.label}</span>
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <PlaceActions place={c.place} city={city} compact />
        {onAction && (
          <button type="button" onClick={onAction} className="inline-flex items-center gap-1.5 rounded-full bg-plum text-white px-3 py-1.5 text-xs font-semibold hover:bg-plum-dark">
            <Plus className="size-3.5" /> {actionLabel}
          </button>
        )}
      </div>
      {actionNote && <p className="mt-2 text-xs text-muted">{actionNote}</p>}
    </div>
  );
}
