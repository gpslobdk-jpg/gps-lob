/**
 * Helpers for detecting and preventing near-duplicate GPS post placements.
 *
 * Background
 * ----------
 * Every GPS post stores its coordinates as `lat`/`lng` on the question object
 * in `gps_runs.questions`. The builders expose a shared map center state and a
 * per-post "Hent pin til kortet" button that assigns the CURRENT map center to
 * that post. If the teacher presses the button for several posts without moving
 * the map between clicks, all posts receive the same coordinate. With stacked
 * Leaflet markers only the topmost one is interactive, leaving the rest
 * inaccessible to the teacher.
 *
 * Threshold choice: PIN_PROXIMITY_BLOCK_METERS = 5 m
 * ---------------------------------------------------
 * Typical consumer GPS accuracy is ±3–10 m. Two posts within 5 m of each other
 * are functionally indistinguishable from the same physical location—students
 * standing at one post are already within the GPS radius of the other. This
 * tight threshold blocks genuinely accidental stacking while still permitting
 * intentionally close-but-distinct posts (e.g. two doors of the same building
 * ~8 m apart).
 */

export const PIN_PROXIMITY_BLOCK_METERS = 5;

/**
 * Haversine great-circle distance between two GPS coordinates, in metres.
 * Accurate to within ~0.3 % for distances under a few kilometres.
 */
export function haversineDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6_371_000; // Earth mean radius in metres
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export type PinCandidate = {
  id: number | string;
  /** 1-based display number shown to the teacher */
  number: number;
  lat: number | null;
  lng: number | null;
};

export type NearbyConflict = {
  conflictingId: number | string;
  conflictingNumber: number;
  /** Distance rounded to one decimal place */
  distanceMeters: number;
};

/**
 * Returns the first existing pin closer than `thresholdMeters` to
 * (newLat, newLng), ignoring the pin with `excludeId` (the post being placed).
 * Returns `null` when the position is safe to use.
 */
export function findNearbyPinConflict(
  existingPins: PinCandidate[],
  newLat: number,
  newLng: number,
  excludeId: number | string,
  thresholdMeters = PIN_PROXIMITY_BLOCK_METERS
): NearbyConflict | null {
  for (const pin of existingPins) {
    if (pin.id === excludeId) continue;
    if (pin.lat === null || pin.lng === null) continue;

    const dist = haversineDistanceMeters(newLat, newLng, pin.lat, pin.lng);
    if (dist <= thresholdMeters) {
      return {
        conflictingId: pin.id,
        conflictingNumber: pin.number,
        distanceMeters: Math.round(dist * 10) / 10,
      };
    }
  }
  return null;
}

export type OverlapGroup = {
  /** 1-based post numbers that are stacked at the same location */
  postNumbers: number[];
  /** Question/pin ids that are stacked */
  ids: Array<number | string>;
};

/**
 * Returns all groups of pins that overlap within `thresholdMeters` of each
 * other. Returns an empty array when no overlaps exist.
 *
 * Uses a greedy O(n²) scan—acceptable for the typical builder size of ≤20 pins.
 */
export function findOverlappingPinGroups(
  pins: PinCandidate[],
  thresholdMeters = PIN_PROXIMITY_BLOCK_METERS
): OverlapGroup[] {
  const groups: OverlapGroup[] = [];
  const alreadyGrouped = new Set<number | string>();

  for (let i = 0; i < pins.length; i++) {
    const a = pins[i];
    if (alreadyGrouped.has(a.id) || a.lat === null || a.lng === null) continue;

    const group: OverlapGroup = { postNumbers: [a.number], ids: [a.id] };

    for (let j = i + 1; j < pins.length; j++) {
      const b = pins[j];
      if (b.lat === null || b.lng === null) continue;

      const dist = haversineDistanceMeters(a.lat, a.lng, b.lat, b.lng);
      if (dist <= thresholdMeters) {
        group.postNumbers.push(b.number);
        group.ids.push(b.id);
        alreadyGrouped.add(b.id);
      }
    }

    if (group.postNumbers.length > 1) {
      alreadyGrouped.add(a.id);
      groups.push(group);
    }
  }

  return groups;
}
