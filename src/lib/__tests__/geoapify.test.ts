import { describe, expect, it } from "vitest";
import { buildGeoapifyUrl, fromGeoapify } from "../providers/geoapify";

// TEST FIXTURES ONLY — shaped like Geoapify Places API results.
describe("Geoapify provider", () => {
  it("reuses OSM tags and ids from datasource.raw", () => {
    const p = fromGeoapify({
      properties: {
        name: "Fixture Bowl",
        lat: 36,
        lon: -78.9,
        categories: ["entertainment", "entertainment.bowling_alley"],
        datasource: { sourcename: "openstreetmap", raw: { name: "Fixture Bowl", leisure: "bowling_alley", osm_type: "w", osm_id: 42, opening_hours: "Mo-Su 10:00-23:00", wikidata: "Q9" } },
      },
    });
    expect(p).toMatchObject({ id: "osm:way/42", category: "bowling", openingHours: "Mo-Su 10:00-23:00", notable: true });
  });

  it("falls back to the Geoapify category when raw tags are missing", () => {
    const p = fromGeoapify({ properties: { name: "Fixture Café", lat: 1, lon: 2, place_id: "abc", categories: ["catering", "catering.cafe"], opening_hours: "Mo-Fr 07:00-15:00" } });
    expect(p).toMatchObject({ id: "geoapify:abc", category: "cafe", openingHours: "Mo-Fr 07:00-15:00" });
  });

  it("skips unnamed places and plain places of worship", () => {
    expect(fromGeoapify({ properties: { lat: 1, lon: 2, categories: ["catering.cafe"] } })).toBeNull();
    expect(fromGeoapify({ properties: { name: "Church", lat: 1, lon: 2, categories: ["religion.place_of_worship", "tourism.sights"] } })).toBeNull();
  });

  it("builds a circle-filtered, distance-biased request", () => {
    const u = new URL(buildGeoapifyUrl(36, -78.9, 2.5, "catering.cafe", 50, "KEY"));
    expect(u.searchParams.get("filter")).toBe("circle:-78.9,36,2500");
    expect(u.searchParams.get("bias")).toBe("proximity:-78.9,36");
    expect(u.searchParams.get("apiKey")).toBe("KEY");
  });
});

import { fromGeoapifyGeocode } from "../providers/geocode";
describe("Geoapify location search", () => {
  it("labels US cities with the state code", () => {
    expect(fromGeoapifyGeocode({ lat: 35.99, lon: -78.9, city: "Durham", state: "North Carolina", state_code: "NC", country: "United States", country_code: "us" })).toMatchObject({ label: "Durham, NC", countryCode: "US", region: "North Carolina" });
  });
  it("labels other countries with the country name", () => {
    expect(fromGeoapifyGeocode({ lat: 38.7, lon: -9.1, city: "Lisbon", state: "Lisbon", country: "Portugal", country_code: "pt" }).label).toBe("Lisbon, Portugal");
  });
});
