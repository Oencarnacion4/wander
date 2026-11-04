"use client";

import { ChevronDown, Clock, MapPin, Repeat, Shuffle, Trash2, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { ConfidenceBadge, costLabel } from "@/components/Badges";
import { fmtTime } from "@/lib/hours";
import { TRANSPORT } from "@/lib/geo";
import type { ItineraryStop, ScoredPlace, Transport } from "@/lib/types";
import { cn } from "@/lib/cn";
import { PlaceActions } from "./PlaceActions";
import { ScoreBars } from "./ScoreBars";

export function StopCard({
  n,
  stop,
  c,
  transport,
  city,
  active,
  onFocus,
  onSwap,
  onRemove,
  swapOpen,
  children,
}: {
  n: number;
  stop: ItineraryStop;
  c: ScoredPlace;
  transport: Transport;
  city?: string;
  active: boolean;
  onFocus: () => void;
  onSwap: () => void;
  onRemove: () => void;
  swapOpen: boolean;
  children?: React.ReactNode;
}) {
  const [why, setWhy] = useState(false);
  return (
    <li className="relative pl-12">
      {stop.travelMinutes > 0 && (
        <p className="text-xs text-muted mb-2 flex items-center gap-1.5">
          <Clock className="size-3" /> ~{stop.travelMinutes} min {TRANSPORT[transport].label.toLowerCase()} · estimate
        </p>
      )}
      <span className={cn("absolute left-0 top-auto size-9 rounded-full grid place-items-center font-display font-bold text-white shadow-card", active ? "bg-orchid" : "bg-ink")} style={{ marginTop: 4 }}>
        {n}
      </span>
      <article
        onMouseEnter={onFocus}
        className={cn("rounded-3xl border bg-card p-4 sm:p-5 shadow-card transition-all", active ? "border-orchid/60 ring-2 ring-orchid/20" : "border-line")}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-orchid-dark tabular-nums">
              {fmtTime(stop.arrive)} – {fmtTime(stop.depart)}
            </p>
            <h3 className="font-display text-xl font-bold leading-tight mt-0.5">{c.place.name}</h3>
            <p className="text-sm text-muted mt-0.5">
              {c.place.kind}
              {c.place.address && (
                <>
                  {" · "}
                  <MapPin className="inline size-3 -mt-0.5" /> {c.place.address}
                </>
              )}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-display text-lg font-bold">{costLabel(stop.cost)}</p>
            <ConfidenceBadge c={stop.cost.confidence} title={stop.cost.note} />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 text-ink-soft">
            <ConfidenceBadge c={c.hours.confidence} /> {c.hours.label}
          </span>
        </div>

        {(c.reasons.length > 0 || c.warnings.length > 0) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {c.reasons.map((r) => (
              <span key={r} className="rounded-full bg-plum/10 text-plum px-2.5 py-1 text-xs font-medium">
                {r}
              </span>
            ))}
            {c.warnings.map((w) => (
              <span key={w} className="rounded-full bg-estimate/10 text-estimate px-2.5 py-1 text-xs font-medium inline-flex items-center gap-1">
                <TriangleAlert className="size-3" /> {w}
              </span>
            ))}
          </div>
        )}

        <p className="mt-2 text-xs text-muted">{stop.cost.note}.</p>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
          <PlaceActions place={c.place} city={city} />
          <div className="flex items-center gap-1">
            <button type="button" onClick={onSwap} className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold", swapOpen ? "bg-plum text-white" : "bg-sand hover:bg-line")}>
              <Shuffle className="size-3.5" /> Swap
            </button>
            <button type="button" onClick={onRemove} aria-label={`Remove ${c.place.name}`} className="rounded-full p-2 text-muted hover:text-orchid-dark hover:bg-mist">
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>

        <button type="button" onClick={() => setWhy(!why)} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-ink-soft hover:text-ink">
          <Repeat className="size-3" /> Why this? <ChevronDown className={cn("size-3 transition-transform", why && "rotate-180")} />
        </button>
        {why && (
          <div className="mt-2">
            <ScoreBars breakdown={c.breakdown} score={c.score} />
          </div>
        )}
        {children}
      </article>
    </li>
  );
}
