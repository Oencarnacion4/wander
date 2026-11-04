import type { Place } from "./types";

/**
 * Food style. OpenStreetMap has no price levels, so "Fancy night out" is an
 * ESTIMATE built from real map tags, and the UI labels it that way:
 *  - reservation=yes/recommended/required  (strongest signal)
 *  - not a chain (no brand tag; chains like Subway are tagged with brand=*)
 *  - cuisine typical of upscale dining (steakhouse, French, sushi, seafood…)
 *  - has a website / a Wikipedia entry
 */
export type Dining = "any" | "casual" | "sitdown" | "upscale";

export const DINING_OPTIONS: { key: Dining; label: string; hint: string }[] = [
  { key: "any", label: "Any", hint: "Whatever fits" },
  { key: "casual", label: "Casual", hint: "Quick & easy" },
  { key: "sitdown", label: "Sit-down", hint: "A real meal" },
  { key: "upscale", label: "Fancy night out", hint: "Special occasion" },
];

const STRONG = new Set(["french", "steak_house", "seafood", "sushi", "fine_dining", "tapas", "oyster", "wine", "omakase"]);
const MEDIUM = new Set(["italian", "japanese", "mediterranean", "spanish", "new_american", "greek", "lebanese", "peruvian"]);

export function isChain(p: Place): boolean {
  return Boolean(p.brand);
}

/** 0..1 likelihood a restaurant is upscale, from map signals. Chains and non-restaurants are 0. */
export function upscaleScore(p: Place): number {
  if (p.category !== "restaurant" || isChain(p)) return 0;
  let s = 0.2;
  if (p.reservation === "required" || p.reservation === "recommended") s += 0.35;
  else if (p.reservation === "yes") s += 0.25;
  const cuisines = (p.cuisine ?? "").toLowerCase().split(";").map((c) => c.trim());
  if (cuisines.some((c) => STRONG.has(c))) s += 0.25;
  else if (cuisines.some((c) => MEDIUM.has(c))) s += 0.12;
  if (p.website) s += 0.1;
  if (p.notable) s += 0.1;
  return Math.min(1, s);
}

export const LIKELY_UPSCALE = 0.55;
