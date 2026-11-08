# WANDER — Less Planning. More Living.

**Live site:** _link coming after deployment_

WANDER helps people decide what to do, where to eat and where to go next. You tell it who you're with, how much you want to spend, how much time you have and when you're going. It recommends **real, verified places**, builds a **realistic itinerary**, and keeps track of everywhere you've been.

The idea came from a problem I run into all the time: I'm constantly looking up things to do, but what makes sense depends on the group, the budget, the time and the day, and I never know where to start.

---

## Features

### Explore My City
Enter a location (or use your Home Base), a date, morning/afternoon/evening or a custom time, how long you have, a budget (per person or for the group), adults, kids and their ages, transport, interests and a food style (Any, Casual, Sit-down or Fancy night out). WANDER:
- ranks real nearby places from OpenStreetMap data,
- builds a timed itinerary that respects opening hours, travel time and budget,
- shows the plan on an interactive map,
- lets you **Swap** any stop (it only suggests replacements that keep the rest of the plan valid), remove stops or add ideas,
- explains every pick with **"Why this?"**, which shows the exact score breakdown,
- saves the plan to My Adventures.

### Take Me Somewhere
- **Find a destination:** ranks 72 real destinations in the US and abroad by your dates, budget, group, travel modes and maximum travel time. Includes a **Surprise Me** button and a day-by-day itinerary built from live place data at the destination.
- **Cheapest flights:** finds the airports near any location and lists the cheapest recent fares to anywhere, round trip or one way, for any time or a chosen month. Every fare shows when it was found. **Check price** opens Google Flights for the live price, and **Plan a trip there** builds an itinerary for those dates.

### Home Base
Your saved home city becomes the default starting point everywhere. You can explore any other city without changing it.

### My Adventures
A personal tracker with a wishlist ("Want to go"), visit history, saved plans, cities explored and a personal map.
**Visits are events, not checkboxes:** going bowling records a visit to *that bowling alley*. It never marks "bowling" as done. You can revisit places as often as you like, and they keep being recommended.

### Accounts
Email sign-up with Supabase. Home Base, plans, wishlist and visits are stored in Postgres with row-level security, so each user can only read their own data. Without an account, WANDER still works in guest mode and saves to the browser. Guest data moves into your account when you sign up.

---

## How the recommendation system works

WANDER does not rely on an AI chatbot or random suggestions. It is a transparent scoring and optimization system.

**1. Hard constraints.** These remove anything that can't work:
- closed for your entire time window (from real `opening_hours` data),
- not suitable for your kids (bars, clubs),
- minimum cost already over budget,
- too far for your transport mode,
- needs more time than you have,
- doesn't match your food style (Fancy night out rules out fast food and chains).

**2. Seven features, each scaled 0–1, combined as a weighted sum: `score = Σ weightᵢ × featureᵢ`**

| Feature | How it's measured | Weight |
|---|---|---|
| Interest match | Primary, secondary or related category match | 28% |
| Proximity | Exponential decay: `exp(−travel minutes / 15)` | 17% |
| Cost fit | Full credit up to 35% of the budget, then linear decline | 14% |
| Group fit | Suitability for the youngest kid's age group | 12% |
| Time of day | Overlap of your window with when the place makes sense | 10% |
| Data quality | Wikidata entry, website, listed hours (chains slightly lower) | 11% |
| Novelty | `1 − 0.6·exp(−days since your last visit / 90)`: a recent visit lowers it, then it recovers | 8% |

**3. Building the itinerary.** Choosing an ordered set of stops that are open on arrival and fit your time and budget is an *orienteering problem with time windows*, which is NP-hard. WANDER solves it with **beam search**: at each step it extends the 8 best partial plans with feasible next stops and keeps the best. Plans follow how people actually spend a day:
- meals only at meal times, one per meal window, at least 4 hours apart,
- no two food stops back to back,
- at most one coffee or dessert stop per 4 hours,
- variety across categories,
- event venues (stadiums, theaters) are never auto-added without an event.

**4. Take Me Somewhere** applies the same approach to destinations. Hard limits come first (travel time, budget, domestic or international). Then a weighted score uses interest overlap, cost fit, share of the trip spent traveling, season, group fit and novelty. **Surprise Me** samples from a **softmax** over the scores, `P(i) ∝ exp(scoreᵢ / T)`: better matches are more likely, but not guaranteed.

### Honest data
WANDER never invents businesses, prices or availability. Every price and set of opening hours is labeled:
- **Confirmed** — taken directly from the data source,
- **Estimate** — WANDER's typical value for that kind of place, clearly marked,
- **Unverified** — not listed; check before you go.

Flight prices show how long ago each fare was found and link to a live price. "Fancy night out" is labeled as an estimate built from real map signals (takes reservations, not a chain, cuisine type), because the map data has no price levels.

---

## Built with

| Layer | Technology |
|---|---|
| App | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4 |
| Database and accounts | Supabase (Postgres, Auth, row-level security) |
| Places, location search, map tiles | Geoapify (OpenStreetMap data), with the public Overpass and Nominatim servers as backups |
| Opening hours | `opening_hours` parser for OpenStreetMap's hours format |
| Flights | Travelpayouts / Aviasales flight data API |
| Photos | Wikipedia / Wikimedia Commons |
| Maps | Leaflet |
| Tests | Vitest (33 tests covering the scoring model, itinerary rules, providers and flights) |
| Hosting | Vercel |

API keys stay on the server: the browser talks only to WANDER's own API routes, which call the outside services.

## More detail
- [`PROJECT_PLAN.md`](PROJECT_PLAN.md): architecture, database design, roadmap and known limitations
- [`SETUP.md`](SETUP.md): configuration and deployment notes

Place data © OpenStreetMap contributors. Photos from Wikimedia Commons via Wikipedia.
