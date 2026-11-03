import OpeningHours from "opening_hours";
import type { HoursStatus } from "./types";

/**
 * Opening hours come from OpenStreetMap's `opening_hours` tag, which has its
 * own mini-language ("Mo-Fr 09:00-17:00; Sa 10:00-14:00"). We use the
 * reference parser for it.
 *
 * Times are treated as wall-clock time in the city being explored: we build
 * Date objects with the runtime's local constructor and only ever compare them
 * to each other, so the server's own timezone doesn't matter.
 */

const cache = new Map<string, OpeningHours | null>();

function parse(spec: string): OpeningHours | null {
  if (cache.has(spec)) return cache.get(spec)!;
  let oh: OpeningHours | null = null;
  try {
    oh = new OpeningHours(spec, null);
  } catch {
    oh = null; // unparseable -> treat as unknown, never guess
  }
  cache.set(spec, oh);
  return oh;
}

export function wallClock(date: string, minutes: number): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d, Math.floor(minutes / 60), minutes % 60);
}

export type OpenCheck = "open" | "closed" | "unknown";

/** Is the place open for the whole visit [start, end] (minutes after midnight)? */
export function openForVisit(spec: string | undefined, date: string, start: number, end: number): OpenCheck {
  if (!spec) return "unknown";
  const oh = parse(spec);
  if (!oh) return "unknown";
  try {
    const from = wallClock(date, start);
    const to = wallClock(date, end);
    const intervals = oh.getOpenIntervals(from, to);
    const covered = intervals.some(([a, b, unknown]) => !unknown && a.getTime() <= from.getTime() && b.getTime() >= to.getTime());
    if (covered) return "open";
    if (intervals.some(([, , unknown]) => unknown)) return "unknown";
    return "closed";
  } catch {
    return "unknown";
  }
}

export function fmtTime(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, "0");
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mm}${suffix}`;
}

/** Human summary of the day's hours, e.g. "Open today 9:00am–5:00pm". */
export function hoursStatus(spec: string | undefined, date: string): HoursStatus {
  if (!spec) return { confidence: "unknown", label: "Hours not listed — check before you go" };
  const oh = parse(spec);
  if (!oh) return { confidence: "unknown", label: `Listed as "${spec}"` };
  if (spec.trim() === "24/7") return { confidence: "confirmed", label: "Open 24 hours" };
  try {
    const from = wallClock(date, 0);
    const to = wallClock(date, 1440);
    const intervals = oh.getOpenIntervals(from, to);
    if (intervals.length === 0) return { confidence: "confirmed", label: "Closed on this day" };
    const toMin = (d: Date) => Math.round((d.getTime() - from.getTime()) / 60000);
    const parts = intervals.map(([a, b]) => `${fmtTime(toMin(a))}–${fmtTime(toMin(b))}`);
    return { confidence: "confirmed", label: `Open ${parts.join(", ")}` };
  } catch {
    return { confidence: "unknown", label: `Listed as "${spec}"` };
  }
}
