import { BadgeCheck, Calculator, CircleHelp } from "lucide-react";
import type { Confidence } from "@/lib/types";
import { cn } from "@/lib/cn";

const STYLE: Record<Confidence, { cls: string; label: string; Icon: typeof BadgeCheck }> = {
  confirmed: { cls: "text-confirm bg-confirm/10", label: "Confirmed", Icon: BadgeCheck },
  estimated: { cls: "text-estimate bg-estimate/10", label: "Estimate", Icon: Calculator },
  unknown: { cls: "text-muted bg-sand", label: "Unverified", Icon: CircleHelp },
};

/** Every price and hours value carries one of these so users can tell facts from estimates. */
export function ConfidenceBadge({ c, title, className }: { c: Confidence; title?: string; className?: string }) {
  const s = STYLE[c];
  return (
    <span
      title={title}
      className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide", s.cls, className)}
    >
      <s.Icon className="size-3" />
      {s.label}
    </span>
  );
}

/** Price label for one place. Unknown prices say "Varies" instead of pretending to be free. */
export function costLabel(c: { low: number; high: number; confidence: Confidence }) {
  if (c.confidence === "unknown" && c.high === 0) return "Varies";
  return money(c.low, c.high);
}

export function money(low: number, high: number) {
  if (high === 0) return "Free";
  if (low === high) return `$${low}`;
  return `$${low}–${high}`;
}
