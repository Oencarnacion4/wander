import { FEATURE_LABELS, WEIGHTS } from "@/lib/scoring";
import type { ScoreBreakdown } from "@/lib/types";

/** Shows each feature's value and its weighted contribution to the final score. */
export function ScoreBars({ breakdown, score }: { breakdown: ScoreBreakdown; score: number }) {
  const keys = Object.keys(WEIGHTS) as (keyof ScoreBreakdown)[];
  return (
    <div className="rounded-xl bg-paper border border-line p-3 text-xs">
      <div className="flex items-baseline justify-between mb-2">
        <p className="font-semibold text-ink">Score = Σ weight × feature</p>
        <p className="font-display text-base font-bold text-ink">{Math.round(score * 100)}<span className="text-muted text-xs">/100</span></p>
      </div>
      <ul className="space-y-1.5">
        {keys.map((k) => (
          <li key={k} className="grid grid-cols-[1fr_auto] gap-x-3 items-center">
            <div>
              <div className="flex justify-between text-ink-soft">
                <span>{FEATURE_LABELS[k]}</span>
                <span className="tabular-nums text-muted">
                  {breakdown[k].toFixed(2)} × {WEIGHTS[k].toFixed(2)}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-sand mt-0.5 overflow-hidden">
                <div className="h-full rounded-full bg-plum" style={{ width: `${breakdown[k] * 100}%` }} />
              </div>
            </div>
            <span className="tabular-nums font-semibold w-8 text-right">+{Math.round(WEIGHTS[k] * breakdown[k] * 100)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
