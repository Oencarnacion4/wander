// Shared types used by the server (API routes) and the browser (UI, swapping stops).

export type Interest =
  | "food"
  | "coffee"
  | "shopping"
  | "sports"
  | "museums"
  | "sights"
  | "nightlife"
  | "outdoors"
  | "entertainment";

export type Transport = "walk" | "bike" | "transit" | "drive" | "rideshare";

export type BudgetMode = "per_person" | "total";

/** Where a value came from. The UI shows these labels so estimates are never mistaken for facts. */
export type Confidence =
  | "confirmed" // taken directly from the data source (e.g. an OpenStreetMap tag)
  | "estimated" // computed by WANDER from typical values for this kind of place
  | "unknown"; // the source has no data and we refuse to guess

export interface Place {
  /** Stable source id, e.g. "osm:node/123456". Used to track visits. */
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: CategoryKey;
  /** Human label for the sub-type, e.g. "Bowling alley", "Thai restaurant". */
  kind: string;
  address?: string;
  website?: string;
  phone?: string;
  /** Raw opening_hours string from the source, if any. */
  openingHours?: string;
  cuisine?: string;
  wheelchair?: string;
  /** True when the source says the place has a Wikidata/Wikipedia entry (a notability signal). */
  notable: boolean;
  /** fee=no / fee=yes / charge=… from the source, when present. */
  fee?: "free" | "paid";
  charge?: string;
  source: "openstreetmap";
}

export type CategoryKey =
  | "restaurant"
  | "fast_food"
  | "cafe"
  | "dessert"
  | "bar"
  | "nightclub"
  | "museum"
  | "gallery"
  | "attraction"
  | "viewpoint"
  | "historic"
  | "park"
  | "garden"
  | "nature"
  | "beach"
  | "playground"
  | "zoo"
  | "aquarium"
  | "theme_park"
  | "cinema"
  | "theatre"
  | "bowling"
  | "arcade"
  | "minigolf"
  | "escape_room"
  | "trampoline"
  | "sports_centre"
  | "stadium"
  | "ice_rink"
  | "climbing"
  | "golf"
  | "mall"
  | "market"
  | "bookstore"
  | "shop";

export interface ChildInfo {
  age: number;
}

export interface ExploreQuery {
  lat: number;
  lng: number;
  locationLabel: string;
  /** YYYY-MM-DD, local to the place being explored. */
  date: string;
  /** Minutes after midnight, local time. */
  startMinutes: number;
  /** How long the outing lasts, in minutes. */
  durationMinutes: number;
  budget: number;
  budgetMode: BudgetMode;
  adults: number;
  children: ChildInfo[];
  transport: Transport;
  interests: Interest[];
  /** Places the user has visited before (id -> ISO date of most recent visit). */
  visited?: Record<string, string>;
  /** Places on the user's wishlist. */
  wishlist?: string[];
}

/** Estimated (or confirmed) cost for the whole group, in USD. */
export interface CostEstimate {
  low: number;
  high: number;
  confidence: Confidence;
  note: string;
}

export interface ScoreBreakdown {
  interest: number;
  proximity: number;
  cost: number;
  group: number;
  timeOfDay: number;
  quality: number;
  novelty: number;
}

export interface ScoredPlace {
  place: Place;
  /** Weighted utility in [0, 1]. */
  score: number;
  breakdown: ScoreBreakdown;
  distanceKm: number;
  travelMinutes: number;
  cost: CostEstimate;
  durationMinutes: number;
  hours: HoursStatus;
  visitedBefore?: string;
  onWishlist: boolean;
  reasons: string[];
  warnings: string[];
}

export interface HoursStatus {
  confidence: Confidence;
  /** Short label such as "Open 9:00–17:00" or "Hours not listed". */
  label: string;
}

export interface ItineraryStop {
  placeId: string;
  /** Minutes after midnight. */
  arrive: number;
  depart: number;
  travelMinutes: number;
  cost: CostEstimate;
}

export interface Itinerary {
  stops: ItineraryStop[];
  totalCostLow: number;
  totalCostHigh: number;
  endMinutes: number;
  /** Sum of stop utilities, the objective the planner maximises. */
  objective: number;
  notes: string[];
}

export interface ExploreResponse {
  query: ExploreQuery;
  candidates: ScoredPlace[];
  itinerary: Itinerary;
  stats: {
    fetched: number;
    afterFilters: number;
    excluded: Record<string, number>;
    radiusKm: number;
  };
}
