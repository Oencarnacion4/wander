import { describe, expect, it } from "vitest";
import { googleFlightsUrl, nearbyAirports, normalizeFare, type Airport } from "../providers/flights";

// TEST FIXTURES ONLY.
const airports: Airport[] = [
  { code: "RDU", name: "Raleigh-Durham International", city_code: "RDU", country_code: "US", coordinates: { lat: 35.877, lon: -78.787 }, flightable: true, iata_type: "airport" },
  { code: "GSO", name: "Piedmont Triad International", city_code: "GSO", country_code: "US", coordinates: { lat: 36.097, lon: -79.937 }, flightable: true, iata_type: "airport" },
  { code: "XXX", name: "Some Heliport", city_code: "XXX", country_code: "US", coordinates: { lat: 35.99, lon: -78.9 }, flightable: true, iata_type: "heliport" },
  { code: "CLT", name: "Charlotte Douglas", city_code: "CLT", country_code: "US", coordinates: { lat: 35.214, lon: -80.943 }, flightable: true, iata_type: "airport" },
];

describe("flights", () => {
  it("finds real airports near Durham, nearest first, skipping heliports", () => {
    const near = nearbyAirports(airports, 35.994, -78.8986);
    expect(near.map((a) => a.code)).toEqual(["RDU", "GSO"]);
  });
  it("falls back to the single nearest airport when nothing is within 120 km", () => {
    expect(nearbyAirports(airports, 40, -100).length).toBe(1);
  });
  it("reads both Travelpayouts fare formats", () => {
    expect(normalizeFare({ origin: "RDU", destination: "LIS", value: 412, depart_date: "2027-01-10", return_date: "2027-01-17", number_of_changes: 1, found_at: "2026-11-03T10:00:00" })).toMatchObject({
      price: 412,
      departDate: "2027-01-10",
      returnDate: "2027-01-17",
      stops: 1,
    });
    expect(normalizeFare({ origin: "RDU", destination: "MIA", price: 89, departure_at: "2026-12-01T07:00:00-05:00", transfers: 0 })).toMatchObject({ price: 89, departDate: "2026-12-01", returnDate: null, stops: 0 });
  });
  it("links to Google Flights for a live price", () => {
    expect(googleFlightsUrl("RDU", "LIS", "2027-01-10", null)).toContain("google.com/travel/flights?q=Flights%20from%20RDU%20to%20LIS%20on%202027-01-10%20one%20way");
  });
});
