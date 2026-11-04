# WANDER — Project Plan

> **Less Planning. More Living.** Discover real places, build realistic plans, and keep track of everywhere you've been.

This file tracks scope, architecture and progress. Update the checkboxes as features land.

---

## 1. Stack and why

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 16 (App Router) + TypeScript** | One codebase for pages and API routes; easy deploy to Vercel. |
| Styling | **Tailwind CSS v4** | Fast, consistent design tokens (see `src/app/globals.css`). |
| Database + auth | **Supabase** (Postgres + Auth + Row-Level Security) | Free tier, real SQL, email/password sign-in. RLS means users can only ever read their own rows. |
| Places | **OpenStreetMap data via Geoapify Places API** (free key), with the public **Overpass API** as a no-key backup | Real businesses with opening hours, worldwide. Geoapify is fast and reliable; Overpass is free but often overloaded. |
| Geocoding | **OpenStreetMap Nominatim** | Free, no key. |
| Maps | **Leaflet + CARTO/OSM tiles** | Free, no key, interactive. |
| Photos | **Wikipedia REST API** (Wikimedia Commons images) | Real photos of cities and landmarks, free, no key. Falls back to a gradient — never a fake image. |
| Opening hours | **`opening_hours` npm package** | The reference parser for OSM's hours syntax. |
| Tests | **Vitest** (engine) + **Playwright** (browser flows) | |

**Guest mode:** if Supabase keys aren't set, WANDER still works fully and saves data in the browser (localStorage). When a user later signs in, guest data is uploaded to their account.

---

## 2. Architecture

```
Browser (React)                          Server (Next.js API routes)            External (free, no key)
────────────────                         ───────────────────────────            ───────────────────────
ExploreForm ──POST /api/explore──────▶   validate → fetch places ───────────▶   Overpass (OSM)
                                          → rankPlaces (scoring.ts)
                                          → buildItinerary (itinerary.ts)
           ◀── candidates + itinerary ──
Swap / remove / add stops: re-run retime() & swapOptions() IN THE BROWSER (same code, no extra request)

LocationPicker ──GET /api/geocode────▶   Nominatim
Photo ─────────GET /api/photo────────▶   Wikipedia
Take Me Somewhere: rankDestinations() runs in the browser over a curated destination list
                  ──POST /api/trip───▶   Overpass at the destination → planner per day
WanderProvider ───────────────────────────────────────────────────────────────▶ Supabase (RLS) or localStorage
```

Key files:

- `src/lib/scoring.ts` — the recommendation model (hard constraints + weighted features)
- `src/lib/itinerary.ts` — beam-search planner, re-timing, swap suggestions
- `src/lib/categories.ts` — typical durations/costs/kid-suitability per place type (all labeled *estimates*)
- `src/lib/trips.ts` + `src/lib/destinations.ts` — Take Me Somewhere ranking + Surprise Me
- `src/lib/providers/osm.ts`, `geocode.ts` — data sources
- `src/components/WanderProvider.tsx` — all user data (Supabase or guest mode)
- `supabase/migrations/0001_init.sql` — database schema

---

## 3. The recommendation system (for the class presentation)

**Step 1: Hard constraints.** These remove places that can't work at all:
closed for your whole window (from real `opening_hours`) · not allowed for your kids (bars, clubs) · minimum cost already over budget · too far for your transport mode · needs more time than you have.

**Step 2: Features.** Every remaining place gets seven features scaled 0–1:

| Feature | How it's computed | Weight |
|---|---|---|
| Interest match | 1 if primary category matches, 0.85 secondary, 0.4 "related", 0.1 otherwise | 0.28 |
| Proximity | `exp(−travelMinutes / 15)` — exponential decay | 0.17 |
| Cost fit | 1 if it uses ≤35% of budget, linear decline to 0 at 100% | 0.14 |
| Group fit | min suitability across all kids (the group is as happy as its least-suited member) | 0.12 |
| Time of day | overlap of your window with morning/afternoon/evening × category suitability | 0.10 |
| Data quality | Wikidata entry, website, listed hours, address (a notability proxy, since OSM has no ratings) | 0.11 |
| Novelty | `1 − 0.6·exp(−daysSinceVisit / 90)` — a recent visit lowers it, it recovers over months | 0.08 |

**Step 3: Score** = Σ weight × feature (multi-attribute utility). Small adjustments: +0.06 if on your wishlist, −0.04 if hours are unconfirmed. Every card has a **"Why this?"** panel showing the exact breakdown.

**Step 4: Itinerary = orienteering problem with time windows** (NP-hard). We use **beam search** (width 8): at each step, extend the best partial plans with feasible next stops (open on arrival, fits time and budget), score them by value discounted for travel time, penalize repeated categories (variety), and keep only one meal per meal window.

**Take Me Somewhere** uses the same idea: hard limits (max travel time, budget, domestic vs international) then weighted features (interest overlap, cost fit, share of trip spent traveling, season, group, novelty). **Surprise Me** samples from a **softmax** over scores: `P(i) ∝ exp(score_i / T)`, so better matches are likelier but not guaranteed.

**Honesty rules:** every price and hours value carries a badge: **Confirmed** (from the data), **Estimate** (WANDER's typical value), or **Unverified** (not listed). WANDER never invents businesses, prices or availability.

**Visits are events, not checkboxes.** Logging "I went to Lucky Strike" adds a row to `visits`; it never marks "bowling" as done. Repeat visits are allowed, and visited places still get recommended.

---

## 4. Database (Supabase)

| Table | Purpose | Notes |
|---|---|---|
| `profiles` | Home Base + default preferences | 1 row per user, created by trigger on sign-up |
| `plans` | Saved outings and trips | `query` (inputs) + `stops` (snapshot) as JSONB |
| `wishlist` | Places I want to go | unique per (user, place) |
| `visits` | Every visit to a place | **no** uniqueness — repeat visits allowed |

All tables have Row-Level Security: `auth.uid() = user_id`.

---

## 5. Roadmap

### Stage 1 — Core (done ✅)
- [x] Project setup (Next.js, TS, Tailwind, Supabase client, Vitest)
- [x] Homepage, navigation (desktop header + mobile bottom tabs)
- [x] Explore My City form: location / Home Base / GPS, date, morning/afternoon/evening/custom, duration, budget per person or total, adults, kids + ages, transport, interests
- [x] Real places from OpenStreetMap; geocoding via Nominatim
- [x] Scoring model with hard constraints + 7 weighted features + "Why this?"
- [x] Beam-search itinerary with opening hours, travel time, budget, meal logic
- [x] Interactive map with numbered route
- [x] Swap a stop (only suggests replacements that keep the plan valid), remove, add from "More ideas"
- [x] Save plans
- [x] Home Base: set/move/clear; explore elsewhere without changing it
- [x] Accounts (Supabase email/password) + guest mode with auto-upload on sign-in
- [x] My Adventures: visit history with repeat visits, wishlist, saved plans, cities explored, personal map
- [x] Take Me Somewhere: 72 real destinations (US + international), travel/cost model, Surprise Me, multi-day itinerary from live data, save trip
- [x] Unit tests for the engine (14) + browser end-to-end test of every main flow

### Stage 2 — Better data (next)
- [ ] **Live events (Ticketmaster Discovery API, free key):** real games, concerts and shows during your time window, with venue, start time and listed price range. Event venues (stadiums, theaters) are already kept out of auto-generated plans until this lands.
- [ ] **Google Places API (optional key)** as a second provider: ratings, `priceLevel`, photos → more *confirmed* prices and a real popularity feature
- [ ] Real routing times (OSRM or Google Routes) instead of the distance × detour estimate
- [ ] Reorder stops by drag-and-drop
- [ ] Rate visits (1–5) and use ratings to learn personal weights
- [ ] Weather check for the chosen date (Open-Meteo, free)

### Stage 3 — Smarter recommendations
- [ ] Learn feature weights from user behavior (logistic regression on "kept" vs "swapped" stops)
- [ ] Collaborative signal: places similar users visited
- [ ] Live flight/hotel price estimates for Take Me Somewhere
- [ ] Share a plan with a public link
- [ ] PWA / offline saved plans

### Known limitations
- OSM has no ratings or prices, so most costs are category-based **estimates** (clearly labeled).
- Travel times are straight-line × detour-factor estimates, not live traffic.
- Public Overpass servers can be slow at peak times. WANDER tries 3 mirrors and caches results for 30 minutes.
- Destination cost tiers and best months are editorial estimates.
