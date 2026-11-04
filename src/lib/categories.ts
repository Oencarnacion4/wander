import type { CategoryKey, Interest } from "./types";

/**
 * The category table is the "domain knowledge" the recommender uses.
 *
 * Every number here is a TYPICAL value for that kind of place, not a fact about
 * a specific business. The UI always labels values derived from this table as
 * "estimated". When the data source has a real value (e.g. fee=no), that wins.
 */
export interface CategoryInfo {
  label: string;
  interests: Interest[];
  /** Typical visit length in minutes. */
  duration: number;
  /** Typical spend per adult in USD [low, high]. */
  cost: [number, number];
  /** Kids pay this fraction of the adult price (ages 3–12). Under 3 is free. */
  childCostFactor: number;
  /** How suitable for young kids (under 6) and older kids (6–12), 0..1. 0 = not allowed. */
  kidsYoung: number;
  kidsOlder: number;
  /** Suitability for morning (before 12), afternoon (12–17), evening (after 17), 0..1. */
  timeOfDay: [number, number, number];
  /** Is this a meal stop? Used to keep the itinerary to one meal per meal window. */
  meal?: boolean;
  /** Only worth a trip when an event is on (a game, a show). Never auto-added to plans. */
  eventOnly?: boolean;
  icon: string;
}

export const CATEGORIES: Record<CategoryKey, CategoryInfo> = {
  restaurant: { label: "Restaurant", interests: ["food"], duration: 75, cost: [18, 40], childCostFactor: 0.5, kidsYoung: 0.7, kidsOlder: 0.85, timeOfDay: [0.4, 0.9, 1], meal: true, icon: "utensils" },
  fast_food: { label: "Quick bite", interests: ["food"], duration: 35, cost: [9, 16], childCostFactor: 0.6, kidsYoung: 0.9, kidsOlder: 0.9, timeOfDay: [0.6, 1, 0.8], meal: true, icon: "sandwich" },
  cafe: { label: "Café", interests: ["coffee", "food"], duration: 40, cost: [5, 14], childCostFactor: 0.6, kidsYoung: 0.7, kidsOlder: 0.8, timeOfDay: [1, 0.8, 0.4], icon: "coffee" },
  dessert: { label: "Dessert & ice cream", interests: ["coffee", "food"], duration: 25, cost: [5, 10], childCostFactor: 0.8, kidsYoung: 1, kidsOlder: 1, timeOfDay: [0.3, 1, 0.9], icon: "ice-cream" },
  bar: { label: "Bar", interests: ["nightlife"], duration: 75, cost: [15, 35], childCostFactor: 0, kidsYoung: 0, kidsOlder: 0, timeOfDay: [0, 0.3, 1], icon: "wine" },
  nightclub: { label: "Nightclub", interests: ["nightlife"], duration: 120, cost: [15, 45], childCostFactor: 0, kidsYoung: 0, kidsOlder: 0, timeOfDay: [0, 0, 1], icon: "music" },
  museum: { label: "Museum", interests: ["museums", "sights"], duration: 100, cost: [0, 25], childCostFactor: 0.5, kidsYoung: 0.6, kidsOlder: 0.85, timeOfDay: [1, 1, 0.3], icon: "landmark" },
  gallery: { label: "Art gallery", interests: ["museums"], duration: 50, cost: [0, 15], childCostFactor: 0.5, kidsYoung: 0.3, kidsOlder: 0.6, timeOfDay: [1, 1, 0.4], icon: "palette" },
  attraction: { label: "Attraction", interests: ["sights", "entertainment"], duration: 60, cost: [0, 20], childCostFactor: 0.6, kidsYoung: 0.8, kidsOlder: 0.9, timeOfDay: [1, 1, 0.6], icon: "star" },
  viewpoint: { label: "Viewpoint", interests: ["sights", "outdoors"], duration: 25, cost: [0, 0], childCostFactor: 0, kidsYoung: 0.8, kidsOlder: 0.9, timeOfDay: [1, 1, 0.8], icon: "mountain" },
  historic: { label: "Historic site", interests: ["sights", "museums"], duration: 45, cost: [0, 12], childCostFactor: 0.5, kidsYoung: 0.5, kidsOlder: 0.75, timeOfDay: [1, 1, 0.5], icon: "castle" },
  park: { label: "Park", interests: ["outdoors"], duration: 60, cost: [0, 0], childCostFactor: 0, kidsYoung: 1, kidsOlder: 1, timeOfDay: [1, 1, 0.5], icon: "trees" },
  garden: { label: "Garden", interests: ["outdoors", "sights"], duration: 60, cost: [0, 15], childCostFactor: 0.5, kidsYoung: 0.8, kidsOlder: 0.8, timeOfDay: [1, 1, 0.4], icon: "flower" },
  nature: { label: "Nature reserve", interests: ["outdoors"], duration: 90, cost: [0, 5], childCostFactor: 0, kidsYoung: 0.7, kidsOlder: 0.9, timeOfDay: [1, 1, 0.3], icon: "leaf" },
  beach: { label: "Beach", interests: ["outdoors"], duration: 120, cost: [0, 10], childCostFactor: 0, kidsYoung: 0.9, kidsOlder: 1, timeOfDay: [1, 1, 0.4], icon: "waves" },
  playground: { label: "Playground", interests: ["outdoors"], duration: 45, cost: [0, 0], childCostFactor: 0, kidsYoung: 1, kidsOlder: 0.7, timeOfDay: [1, 1, 0.3], icon: "baby" },
  zoo: { label: "Zoo", interests: ["outdoors", "entertainment", "sights"], duration: 150, cost: [15, 35], childCostFactor: 0.7, kidsYoung: 1, kidsOlder: 1, timeOfDay: [1, 0.9, 0.1], icon: "paw-print" },
  aquarium: { label: "Aquarium", interests: ["entertainment", "sights", "museums"], duration: 120, cost: [20, 40], childCostFactor: 0.7, kidsYoung: 1, kidsOlder: 1, timeOfDay: [1, 1, 0.3], icon: "fish" },
  theme_park: { label: "Theme park", interests: ["entertainment"], duration: 240, cost: [40, 110], childCostFactor: 0.85, kidsYoung: 0.8, kidsOlder: 1, timeOfDay: [1, 1, 0.5], icon: "ferris-wheel" },
  cinema: { label: "Movie theater", interests: ["entertainment"], duration: 140, cost: [11, 18], childCostFactor: 0.75, kidsYoung: 0.5, kidsOlder: 0.9, timeOfDay: [0.3, 0.9, 1], icon: "clapperboard" },
  theatre: { label: "Theater", interests: ["entertainment", "museums"], duration: 150, cost: [25, 80], childCostFactor: 0.8, kidsYoung: 0.3, kidsOlder: 0.6, timeOfDay: [0.1, 0.6, 1], eventOnly: true, icon: "drama" },
  bowling: { label: "Bowling alley", interests: ["entertainment", "sports"], duration: 90, cost: [12, 25], childCostFactor: 0.8, kidsYoung: 0.7, kidsOlder: 1, timeOfDay: [0.4, 1, 1], icon: "circle-dot" },
  arcade: { label: "Arcade", interests: ["entertainment"], duration: 75, cost: [10, 30], childCostFactor: 1, kidsYoung: 0.7, kidsOlder: 1, timeOfDay: [0.4, 1, 1], icon: "gamepad-2" },
  minigolf: { label: "Mini golf", interests: ["entertainment", "sports", "outdoors"], duration: 60, cost: [8, 16], childCostFactor: 0.8, kidsYoung: 0.8, kidsOlder: 1, timeOfDay: [0.6, 1, 0.8], icon: "flag" },
  escape_room: { label: "Escape room", interests: ["entertainment"], duration: 75, cost: [25, 40], childCostFactor: 1, kidsYoung: 0, kidsOlder: 0.6, timeOfDay: [0.4, 1, 1], icon: "key-round" },
  trampoline: { label: "Trampoline park", interests: ["entertainment", "sports"], duration: 90, cost: [15, 28], childCostFactor: 1, kidsYoung: 0.6, kidsOlder: 1, timeOfDay: [0.7, 1, 0.7], icon: "rocket" },
  sports_centre: { label: "Sports & recreation", interests: ["sports"], duration: 90, cost: [0, 20], childCostFactor: 0.7, kidsYoung: 0.5, kidsOlder: 0.8, timeOfDay: [1, 1, 0.8], icon: "dumbbell" },
  stadium: { label: "Stadium", interests: ["sports", "sights"], duration: 150, cost: [0, 0], childCostFactor: 0, kidsYoung: 0.6, kidsOlder: 0.8, timeOfDay: [0.8, 1, 0.8], eventOnly: true, icon: "trophy" },
  ice_rink: { label: "Ice rink", interests: ["sports", "entertainment"], duration: 75, cost: [10, 20], childCostFactor: 0.8, kidsYoung: 0.5, kidsOlder: 1, timeOfDay: [0.6, 1, 0.9], icon: "snowflake" },
  climbing: { label: "Climbing gym", interests: ["sports"], duration: 100, cost: [18, 30], childCostFactor: 0.8, kidsYoung: 0.2, kidsOlder: 0.8, timeOfDay: [0.8, 1, 0.9], icon: "mountain-snow" },
  golf: { label: "Golf course", interests: ["sports", "outdoors"], duration: 180, cost: [25, 80], childCostFactor: 0.7, kidsYoung: 0.1, kidsOlder: 0.5, timeOfDay: [1, 0.9, 0.2], icon: "flag-triangle-right" },
  mall: { label: "Shopping center", interests: ["shopping"], duration: 90, cost: [0, 60], childCostFactor: 0.3, kidsYoung: 0.7, kidsOlder: 0.8, timeOfDay: [0.7, 1, 0.8], icon: "shopping-bag" },
  market: { label: "Market", interests: ["shopping", "food"], duration: 60, cost: [5, 30], childCostFactor: 0.3, kidsYoung: 0.8, kidsOlder: 0.9, timeOfDay: [1, 0.9, 0.4], icon: "store" },
  bookstore: { label: "Bookstore", interests: ["shopping"], duration: 40, cost: [0, 25], childCostFactor: 0.5, kidsYoung: 0.8, kidsOlder: 0.9, timeOfDay: [0.8, 1, 0.7], icon: "book-open" },
  shop: { label: "Shop", interests: ["shopping"], duration: 30, cost: [0, 30], childCostFactor: 0.3, kidsYoung: 0.6, kidsOlder: 0.7, timeOfDay: [0.7, 1, 0.7], icon: "shopping-basket" },
};

export const INTERESTS: { key: Interest; label: string; blurb: string }[] = [
  { key: "food", label: "Food", blurb: "Restaurants & quick bites" },
  { key: "coffee", label: "Coffee & sweets", blurb: "Cafés, dessert, ice cream" },
  { key: "outdoors", label: "Outdoors", blurb: "Parks, gardens, trails" },
  { key: "museums", label: "Museums & art", blurb: "Museums, galleries" },
  { key: "sights", label: "Sights", blurb: "Landmarks, viewpoints, history" },
  { key: "entertainment", label: "Entertainment", blurb: "Bowling, movies, zoos" },
  { key: "sports", label: "Sports", blurb: "Rinks, climbing, rec centers" },
  { key: "shopping", label: "Shopping", blurb: "Markets, malls, bookstores" },
  { key: "nightlife", label: "Nightlife", blurb: "Bars & clubs (21+)" },
];

/** Interests that are "next door" to each other get partial credit. */
export const RELATED_INTERESTS: Record<Interest, Interest[]> = {
  food: ["coffee"],
  coffee: ["food"],
  outdoors: ["sights", "sports"],
  museums: ["sights"],
  sights: ["museums", "outdoors"],
  entertainment: ["sports"],
  sports: ["outdoors", "entertainment"],
  shopping: ["food"],
  nightlife: ["food", "entertainment"],
};

const CUISINE_LABELS: Record<string, string> = {
  pizza: "Pizza", mexican: "Mexican", italian: "Italian", chinese: "Chinese", japanese: "Japanese",
  sushi: "Sushi", thai: "Thai", indian: "Indian", burger: "Burgers", american: "American",
  barbecue: "Barbecue", bbq: "Barbecue", vietnamese: "Vietnamese", korean: "Korean", mediterranean: "Mediterranean",
  greek: "Greek", french: "French", seafood: "Seafood", sandwich: "Sandwiches", coffee_shop: "Coffee",
  ice_cream: "Ice cream", chicken: "Chicken", steak_house: "Steakhouse", vegan: "Vegan", vegetarian: "Vegetarian",
  breakfast: "Breakfast", donut: "Doughnuts", bagel: "Bagels", ramen: "Ramen", tacos: "Tacos", middle_eastern: "Middle Eastern",
};

export function cuisineLabel(cuisine?: string): string | undefined {
  if (!cuisine) return undefined;
  const first = cuisine.split(";")[0].trim().toLowerCase();
  return CUISINE_LABELS[first] ?? first.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}
