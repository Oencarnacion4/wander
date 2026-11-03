import type { CategoryKey, Confidence, ExploreQuery } from "./types";

export interface HomeBase {
  label: string;
  city: string;
  region?: string;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
}

export interface PlaceSnapshot {
  id: string;
  name: string;
  category: CategoryKey;
  kind: string;
  lat: number;
  lng: number;
  address?: string;
  website?: string;
}

export interface WishItem {
  id: string;
  placeId: string;
  place: PlaceSnapshot;
  city?: string;
  createdAt: string;
}

export interface Visit {
  id: string;
  placeId: string;
  place: PlaceSnapshot;
  city?: string;
  visitedOn: string;
  rating?: number | null;
  note?: string | null;
}

export interface PlanStop {
  place: PlaceSnapshot;
  arrive: number;
  depart: number;
  costLow: number;
  costHigh: number;
  costConfidence: Confidence;
  /** For multi-day trips. */
  day?: number;
}

export interface SavedPlan {
  id: string;
  kind: "explore" | "trip";
  title: string;
  locationLabel: string;
  lat: number;
  lng: number;
  planDate: string;
  query: ExploreQuery | Record<string, unknown>;
  stops: PlanStop[];
  createdAt: string;
}

export interface Profile {
  displayName?: string;
  homeBase?: HomeBase | null;
  defaultInterests?: string[];
  defaultTransport?: string | null;
}
