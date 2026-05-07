/**
 * Unit tests for GPS pin proximity helpers.
 * These run in Node.js context – no browser page is required.
 *
 * Coordinate reference: Copenhagen (55.6761°N, 12.5683°E)
 *   1 m ≈ 0.000009° latitude
 *   1 m ≈ 0.000016° longitude  (at ~56°N)
 */

import { test, expect } from "@playwright/test";

import {
  haversineDistanceMeters,
  findNearbyPinConflict,
  findOverlappingPinGroups,
  PIN_PROXIMITY_BLOCK_METERS,
} from "../utils/pinProximity";

const BASE_LAT = 55.6761;
const BASE_LNG = 12.5683;

// ---------------------------------------------------------------------------
// haversineDistanceMeters
// ---------------------------------------------------------------------------

test.describe("haversineDistanceMeters", () => {
  test("returns 0 for identical coordinates", () => {
    expect(haversineDistanceMeters(BASE_LAT, BASE_LNG, BASE_LAT, BASE_LNG)).toBe(0);
  });

  test("returns ~4 m for a 0.000036° latitude offset", () => {
    const dist = haversineDistanceMeters(BASE_LAT, BASE_LNG, BASE_LAT + 0.000036, BASE_LNG);
    expect(dist).toBeGreaterThan(3);
    expect(dist).toBeLessThan(5);
  });

  test("returns ~10 m for a 0.00016° longitude offset at 56°N", () => {
    const dist = haversineDistanceMeters(BASE_LAT, BASE_LNG, BASE_LAT, BASE_LNG + 0.00016);
    expect(dist).toBeGreaterThan(8);
    expect(dist).toBeLessThan(12);
  });

  test("is symmetric (dist(A,B) === dist(B,A))", () => {
    const d1 = haversineDistanceMeters(BASE_LAT, BASE_LNG, BASE_LAT + 0.01, BASE_LNG + 0.01);
    const d2 = haversineDistanceMeters(BASE_LAT + 0.01, BASE_LNG + 0.01, BASE_LAT, BASE_LNG);
    expect(Math.abs(d1 - d2)).toBeLessThan(0.001);
  });
});

// ---------------------------------------------------------------------------
// findNearbyPinConflict  (threshold = PIN_PROXIMITY_BLOCK_METERS = 5 m)
// ---------------------------------------------------------------------------

test.describe(`findNearbyPinConflict (threshold = ${PIN_PROXIMITY_BLOCK_METERS} m)`, () => {
  const existingPins = [
    { id: 1, number: 1, lat: BASE_LAT, lng: BASE_LNG },
    { id: 2, number: 2, lat: BASE_LAT + 0.001, lng: BASE_LNG + 0.001 }, // ~100 m away
  ];

  test("returns null when coordinate is far from all pins", () => {
    const result = findNearbyPinConflict(existingPins, BASE_LAT + 0.01, BASE_LNG + 0.01, 99);
    expect(result).toBeNull();
  });

  test("returns conflict when coordinate exactly matches an existing pin", () => {
    const result = findNearbyPinConflict(existingPins, BASE_LAT, BASE_LNG, 99);
    expect(result).not.toBeNull();
    expect(result?.conflictingNumber).toBe(1);
    expect(result?.distanceMeters).toBe(0);
  });

  test("returns conflict when coordinate is within the 5 m threshold (~3 m north of pin 1)", () => {
    const result = findNearbyPinConflict(existingPins, BASE_LAT + 0.000027, BASE_LNG, 99);
    expect(result).not.toBeNull();
    expect(result?.conflictingNumber).toBe(1);
  });

  test("returns null when coordinate is just outside the 5 m threshold (~10 m north of pin 1)", () => {
    const result = findNearbyPinConflict(existingPins, BASE_LAT + 0.00009, BASE_LNG, 99);
    expect(result).toBeNull();
  });

  test("ignores pin with excludeId — placing pin 1 at its own location does not conflict", () => {
    const result = findNearbyPinConflict(existingPins, BASE_LAT, BASE_LNG, 1);
    expect(result).toBeNull();
  });

  test("skips pins with null coordinates", () => {
    const pinsWithNull = [
      { id: 1, number: 1, lat: null, lng: null },
      { id: 2, number: 2, lat: BASE_LAT + 0.001, lng: BASE_LNG + 0.001 },
    ];
    const result = findNearbyPinConflict(pinsWithNull, BASE_LAT, BASE_LNG, 99);
    expect(result).toBeNull();
  });

  test("returns empty array for an empty pin list", () => {
    expect(findNearbyPinConflict([], BASE_LAT, BASE_LNG, 99)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// findOverlappingPinGroups
// ---------------------------------------------------------------------------

test.describe("findOverlappingPinGroups", () => {
  test("returns empty array when no pins have coordinates", () => {
    const result = findOverlappingPinGroups([
      { id: 1, number: 1, lat: null, lng: null },
      { id: 2, number: 2, lat: null, lng: null },
    ]);
    expect(result).toHaveLength(0);
  });

  test("returns empty array when all pins are well-separated (> 5 m)", () => {
    const result = findOverlappingPinGroups([
      { id: 1, number: 1, lat: BASE_LAT, lng: BASE_LNG },
      { id: 2, number: 2, lat: BASE_LAT + 0.01, lng: BASE_LNG },        // ~1100 m
      { id: 3, number: 3, lat: BASE_LAT + 0.02, lng: BASE_LNG + 0.01 }, // far
    ]);
    expect(result).toHaveLength(0);
  });

  test("detects one overlap group when two pins share the same coordinate", () => {
    const result = findOverlappingPinGroups([
      { id: 1, number: 1, lat: BASE_LAT, lng: BASE_LNG },
      { id: 2, number: 2, lat: BASE_LAT, lng: BASE_LNG }, // identical
      { id: 3, number: 3, lat: BASE_LAT + 0.01, lng: BASE_LNG }, // far
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.postNumbers).toContain(1);
    expect(result[0]?.postNumbers).toContain(2);
    expect(result[0]?.postNumbers).not.toContain(3);
  });

  test("detects two separate overlap groups", () => {
    const result = findOverlappingPinGroups([
      { id: 1, number: 1, lat: BASE_LAT, lng: BASE_LNG },
      { id: 2, number: 2, lat: BASE_LAT, lng: BASE_LNG },           // overlaps with 1
      { id: 3, number: 3, lat: BASE_LAT + 0.01, lng: BASE_LNG },
      { id: 4, number: 4, lat: BASE_LAT + 0.01, lng: BASE_LNG },    // overlaps with 3
    ]);
    expect(result).toHaveLength(2);
  });

  test("groups three stacked pins into a single group", () => {
    const result = findOverlappingPinGroups([
      { id: 1, number: 1, lat: BASE_LAT, lng: BASE_LNG },
      { id: 2, number: 2, lat: BASE_LAT, lng: BASE_LNG },
      { id: 3, number: 3, lat: BASE_LAT, lng: BASE_LNG },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.postNumbers).toHaveLength(3);
  });

  test("skips pins with null coordinates when computing groups", () => {
    const result = findOverlappingPinGroups([
      { id: 1, number: 1, lat: BASE_LAT, lng: BASE_LNG },
      { id: 2, number: 2, lat: null, lng: null }, // unplaced — ignored
      { id: 3, number: 3, lat: BASE_LAT + 0.01, lng: BASE_LNG }, // far from pin 1
    ]);
    expect(result).toHaveLength(0);
  });

  test("returns empty array for an empty list", () => {
    expect(findOverlappingPinGroups([])).toHaveLength(0);
  });
});
