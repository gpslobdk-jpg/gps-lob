/**
 * usePlayGPS – Premium GPS engine with compass heading.
 *
 * Features:
 *  1. Aggressive geolocation via watchPosition (high accuracy, no cache).
 *  2. Compass heading via DeviceOrientation API (with iOS permission).
 *  3. Haversine distance to target, "in range" flag.
 *  4. GPS jump filter (reject teleportation artefacts).
 *  5. Heartbeat that restarts a stale watcher.
 *  6. Periodic location sync to /api/play/location.
 *  7. WakeLock while tracking is active.
 *  8. Auto-restart on visibility change / online events.
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sendTelemetry } from "@/utils/telemetry";
import type { Location, NavigatorWithWakeLock, WakeLockSentinelLike } from "../types";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type GpsPermission = "prompt" | "granted" | "denied" | "unavailable";

export interface GpsTarget {
  lat: number;
  lng: number;
}

export interface PlayGpsState {
  /** Latest accepted device position. */
  location: Location | null;
  /** Compass heading in degrees 0-360 (null if unavailable). */
  heading: number | null;
  /** Raw accuracy reported by the device (meters). */
  accuracy: number | null;
  /** Distance in meters from current location to the active target. */
  distanceToTarget: number | null;
  /** True when the player is within unlock range of the target. */
  isInRange: boolean;
  /** Current permission status for geolocation. */
  permission: GpsPermission;
  /** True while the first fix hasn't arrived yet. */
  isAcquiring: boolean;
  /** True when gpsOverride means we skip distance checks entirely. */
  gpsOverrideActive: boolean;
  /** Human-readable error string (null when healthy). */
  gpsError: string | null;
}

export interface PlayGpsActions {
  /** Manually request geolocation permission (e.g. after denial). */
  requestPermission: () => Promise<void>;
  /** Trigger the iOS 13+ DeviceOrientation permission prompt. */
  requestCompassPermission: () => Promise<boolean>;
  /** Update the target post the player is navigating toward. */
  setTarget: (target: GpsTarget | null) => void;
  /** Update the unlock radius (from session config). */
  setUnlockRadius: (meters: number) => void;
  /** Enable / disable gpsOverride mode. */
  setGpsOverride: (enabled: boolean) => void;
  /** Force an immediate location sync to the server. */
  forceSyncLocation: () => Promise<void>;
}

export interface UsePlayGpsReturn {
  state: PlayGpsState;
  actions: PlayGpsActions;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const TARGET_VISUAL_RADIUS_METERS = 25;
export const TARGET_CLICK_BUFFER_METERS = 20;

/** Reject position updates with accuracy worse than this. */
const MAX_ACCEPTED_ACCURACY_METERS = 250;

/** If a GPS fix implies faster than this, treat it as a jump artefact. */
const JUMP_FILTER_MAX_SPEED_MPS = 15;

/** Minimum distance delta before the jump filter kicks in. */
const JUMP_FILTER_MIN_DISTANCE_M = 35;

/** Minimum interval between server location syncs (ms). */
const SYNC_MIN_INTERVAL_MS = 10_000;

/** Minimum horizontal movement before we sync early (meters). */
const SYNC_MIN_DISTANCE_M = 3;

/** Heartbeat checks every N ms whether the watcher is alive. */
const HEARTBEAT_INTERVAL_MS = 20_000;

/** If no position callback for this long, consider the watcher stale. */
const HEARTBEAT_STALE_MS = 15_000;

/** Default unlock radius when none is explicitly set. */
const DEFAULT_UNLOCK_RADIUS_M = TARGET_VISUAL_RADIUS_METERS + TARGET_CLICK_BUFFER_METERS;

// ---------------------------------------------------------------------------
// Haversine distance (meters, rounded)
// ---------------------------------------------------------------------------

export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6_371_000; // Earth radius in meters
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function roundAccuracy(raw: number): number | null {
  return Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : null;
}

function measurementTs(raw: number): number {
  return Number.isFinite(raw) && raw > 0 ? raw : Date.now();
}

/** Normalise a compass alpha into 0-360 true-north heading. */
function normaliseHeading(event: DeviceOrientationEvent): number | null {
  // iOS provides webkitCompassHeading (true-north, 0-360).
  const iosHeading = (event as DeviceOrientationEvent & { webkitCompassHeading?: number })
    .webkitCompassHeading;
  if (typeof iosHeading === "number" && Number.isFinite(iosHeading)) {
    return Math.round(iosHeading) % 360;
  }

  // Android/Chrome: alpha is degrees from the Z-axis, measured counter-clockwise.
  // True-north heading ≈ 360 - alpha (when absolute === true).
  const alpha = event.alpha;
  if (typeof alpha === "number" && Number.isFinite(alpha)) {
    // If the event is not absolute, the value is relative to an arbitrary reference.
    // Still useful for rotation deltas, so we expose it.
    return Math.round((360 - alpha) % 360);
  }

  return null;
}

type AcceptedFix = {
  lat: number;
  lng: number;
  accuracy: number;
  timestampMs: number;
};

type SyncBookmark = {
  lat: number;
  lng: number;
  at: number;
};

// ---------------------------------------------------------------------------
// iOS DeviceOrientation permission helper
// ---------------------------------------------------------------------------

type DeviceOrientationEventWithPermission = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied" | "default">;
};

function iosOrientationPermissionAvailable(): boolean {
  return (
    typeof DeviceOrientationEvent !== "undefined" &&
    typeof (DeviceOrientationEvent as DeviceOrientationEventWithPermission).requestPermission ===
      "function"
  );
}

async function requestIOSOrientationPermission(): Promise<boolean> {
  if (!iosOrientationPermissionAvailable()) return true; // not iOS, no gate
  try {
    const result = await (
      DeviceOrientationEvent as DeviceOrientationEventWithPermission
    ).requestPermission!();
    return result === "granted";
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePlayGps(params: {
  participantId: string | null;
  sessionId: string | undefined;
  enabled: boolean;
}): UsePlayGpsReturn {
  const { participantId, sessionId, enabled } = params;

  // ---- Reactive state ----
  const [location, setLocation] = useState<Location | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [distanceToTarget, setDistanceToTarget] = useState<number | null>(null);
  const [permission, setPermission] = useState<GpsPermission>("prompt");
  const [isAcquiring, setIsAcquiring] = useState(true);
  const [gpsOverrideActive, setGpsOverrideActive] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // ---- Refs (mutable, not triggering renders) ----
  const targetRef = useRef<GpsTarget | null>(null);
  const unlockRadiusRef = useRef<number>(DEFAULT_UNLOCK_RADIUS_M);
  const lastAcceptedFixRef = useRef<AcceptedFix | null>(null);
  const lastSyncRef = useRef<SyncBookmark | null>(null);
  const syncInFlightRef = useRef(false);
  const lastPositionTsRef = useRef(0);
  const heartbeatRestartCountRef = useRef(0);
  const watchIdRef = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  const isMountedRef = useRef(true);
  const headingGrantedRef = useRef(false);

  // Stable refs for values needed inside callbacks without re-subscribing.
  const participantIdRef = useRef(participantId);
  participantIdRef.current = participantId;
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const gpsOverrideRef = useRef(gpsOverrideActive);
  gpsOverrideRef.current = gpsOverrideActive;

  // ---- Derived "isInRange" ----
  const isInRange = useMemo(() => {
    if (gpsOverrideActive) return true;
    if (distanceToTarget === null) return false;
    return distanceToTarget <= unlockRadiusRef.current;
  }, [distanceToTarget, gpsOverrideActive]);

  // ---- Location sync to server ----
  const syncToServer = useCallback(
    async (lat: number, lng: number, acc: number | null) => {
      const sid = sessionIdRef.current;
      const pid = participantIdRef.current;
      if (!sid || !pid) return;
      if (syncInFlightRef.current) return;

      const now = Date.now();
      const last = lastSyncRef.current;

      const waitedLongEnough = !last || now - last.at >= SYNC_MIN_INTERVAL_MS;
      const movedFarEnough =
        !last || haversineDistance(last.lat, last.lng, lat, lng) >= SYNC_MIN_DISTANCE_M;
      const canEarlySync = !!last && now - last.at >= SYNC_MIN_INTERVAL_MS;

      if (last && !waitedLongEnough && !(movedFarEnough && canEarlySync)) return;

      syncInFlightRef.current = true;
      lastSyncRef.current = { lat, lng, at: now };

      try {
        const res = await fetch("/api/play/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ sessionId: sid, participantId: pid, lat, lng, accuracy: acc }),
        });
        if (!res.ok && res.status === 401) {
          sendTelemetry("auth_error", {
            participant_id: pid,
            session_id: sid,
            message: "401 on location sync",
          });
        }
      } catch {
        // Network failure — silently dropped; next sync will succeed.
      } finally {
        syncInFlightRef.current = false;
      }
    },
    [],
  );

  // ---- Force sync (exposed action) ----
  const forceSyncLocation = useCallback(async () => {
    const fix = lastAcceptedFixRef.current;
    if (!fix) return;
    // Reset bookmark so syncToServer doesn't throttle.
    lastSyncRef.current = null;
    await syncToServer(fix.lat, fix.lng, fix.accuracy);
  }, [syncToServer]);

  // ---- Process a raw GeolocationPosition ----
  const handlePosition = useCallback(
    (pos: GeolocationPosition) => {
      if (!isMountedRef.current) return;

      lastPositionTsRef.current = Date.now();

      const acc = roundAccuracy(pos.coords.accuracy);
      if (acc === null || acc > MAX_ACCEPTED_ACCURACY_METERS) return;

      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const ts = measurementTs(pos.timestamp);

      // ---- Jump filter ----
      const prev = lastAcceptedFixRef.current;
      if (prev) {
        const dist = haversineDistance(prev.lat, prev.lng, lat, lng);
        const elapsed = Math.max(1, ts - prev.timestampMs);
        const speed = dist / (elapsed / 1000);
        if (dist >= JUMP_FILTER_MIN_DISTANCE_M && speed > JUMP_FILTER_MAX_SPEED_MPS) {
          return; // reject teleport artefact
        }
      }

      const fix: AcceptedFix = { lat, lng, accuracy: acc, timestampMs: ts };
      lastAcceptedFixRef.current = fix;

      // Update React state.
      const loc: Location = { lat, lng, accuracy: acc, timestampMs: ts };
      setLocation(loc);
      setAccuracy(acc);
      setGpsError(null);
      setPermission("granted");
      setIsAcquiring(false);

      // Distance to target.
      const target = targetRef.current;
      if (target) {
        const d = haversineDistance(lat, lng, target.lat, target.lng);
        setDistanceToTarget(d);
      } else {
        setDistanceToTarget(null);
      }

      // Sync to server.
      void syncToServer(lat, lng, acc);
    },
    [syncToServer],
  );

  // ---- Handle geolocation errors ----
  const handleError = useCallback((err: GeolocationPositionError) => {
    if (!isMountedRef.current) return;

    if (err.code === err.PERMISSION_DENIED) {
      setPermission("denied");
      setGpsError("GPS-adgang er blokeret. Tillad GPS i dine browserindstillinger.");
    } else if (err.code === err.POSITION_UNAVAILABLE) {
      setGpsError("GPS-signal utilgængeligt. Prøv at gå udenfor.");
    } else if (err.code === err.TIMEOUT) {
      setGpsError("GPS-timeout. Søger stadig efter signal…");
    }
  }, []);

  // ---- Geolocation watcher lifecycle ----
  useEffect(() => {
    isMountedRef.current = true;

    if (!enabled) {
      // Clean up when disabled.
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      lastAcceptedFixRef.current = null;
      lastSyncRef.current = null;
      return;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setPermission("unavailable");
      setGpsError("Denne enhed understøtter ikke GPS.");
      setIsAcquiring(false);
      return;
    }

    const gpsOptions: PositionOptions = {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10_000,
    };

    const startWatch = () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      try {
        watchIdRef.current = navigator.geolocation.watchPosition(
          handlePosition,
          handleError,
          gpsOptions,
        );
      } catch (e) {
        console.warn("Failed to start geolocation watch:", e);
      }
    };

    startWatch();

    // ---- Heartbeat: restart stale watcher ----
    const heartbeatId = setInterval(() => {
      const stale =
        lastPositionTsRef.current > 0 &&
        Date.now() - lastPositionTsRef.current > HEARTBEAT_STALE_MS;
      if (stale) {
        heartbeatRestartCountRef.current++;
        if (heartbeatRestartCountRef.current >= 2) {
          sendTelemetry("gps_died", {
            message: `GPS heartbeat restarted ${heartbeatRestartCountRef.current}× (no update in >${HEARTBEAT_STALE_MS / 1000}s)`,
          });
        }
        startWatch();
      }
    }, HEARTBEAT_INTERVAL_MS);

    // ---- Visibility / online restart ----
    const restartTracking = () => {
      // Refresh the current position, then start fresh high-accuracy watcher.
      try {
        navigator.geolocation.getCurrentPosition(
          (p) => handlePosition(p),
          () => undefined,
          gpsOptions,
        );
      } catch {
        /* no-op */
      }
      startWatch();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") restartTracking();
    };
    const onOnline = () => restartTracking();
    const onPageShow = () => restartTracking();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      isMountedRef.current = false;
      clearInterval(heartbeatId);
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [enabled, handlePosition, handleError]);

  // ---- Compass heading (DeviceOrientation) ----
  useEffect(() => {
    if (!enabled) {
      setHeading(null);
      return;
    }

    // On non-iOS or if permission was already granted, just listen.
    // On iOS 13+, we can't listen until requestPermission() is called from
    // a user gesture. We attach the listener optimistically — if no events
    // arrive the heading stays null, and the UI can show requestCompassPermission.

    const onOrientation = (e: DeviceOrientationEvent) => {
      const h = normaliseHeading(e);
      if (h !== null) {
        headingGrantedRef.current = true;
        setHeading(h);
      }
    };

    // Prefer `deviceorientationabsolute` (true-north on Android Chrome).
    const absoluteSupported = "ondeviceorientationabsolute" in window;
    const eventName = absoluteSupported ? "deviceorientationabsolute" : "deviceorientation";

    window.addEventListener(
      eventName,
      onOrientation as EventListener,
      { passive: true },
    );

    return () => {
      window.removeEventListener(eventName, onOrientation as EventListener);
    };
  }, [enabled]);

  // ---- WakeLock ----
  useEffect(() => {
    if (!enabled) {
      if (wakeLockRef.current && !wakeLockRef.current.released) {
        void wakeLockRef.current.release().catch(() => undefined);
        wakeLockRef.current = null;
      }
      return;
    }

    const nav = navigator as NavigatorWithWakeLock;
    if (!nav.wakeLock) return;

    let released = false;

    const acquireLock = async () => {
      try {
        const sentinel = await nav.wakeLock!.request("screen");
        if (released) {
          void sentinel.release().catch(() => undefined);
          return;
        }
        wakeLockRef.current = sentinel;
      } catch {
        // WakeLock not available or denied — non-critical.
      }
    };

    void acquireLock();

    // Re-acquire on visibility change (lock is auto-released when the tab is hidden).
    const onVisibility = () => {
      if (document.visibilityState === "visible" && !released) {
        void acquireLock();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisibility);
      if (wakeLockRef.current && !wakeLockRef.current.released) {
        void wakeLockRef.current.release().catch(() => undefined);
        wakeLockRef.current = null;
      }
    };
  }, [enabled]);

  // ---- Actions ----
  const requestPermission = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setPermission("unavailable");
      return;
    }
    // Triggering getCurrentPosition forces the browser permission prompt.
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPermission("granted");
        handlePosition(pos);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setPermission("denied");
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 },
    );
  }, [handlePosition]);

  const requestCompassPermission = useCallback(async (): Promise<boolean> => {
    const granted = await requestIOSOrientationPermission();
    if (!granted) {
      setGpsError("Kompas-adgang er blokeret. Tillad bevægelses-sensorer i indstillinger.");
    }
    return granted;
  }, []);

  const setTarget = useCallback((t: GpsTarget | null) => {
    targetRef.current = t;
    // Immediately recalculate distance with the current fix.
    const fix = lastAcceptedFixRef.current;
    if (fix && t) {
      setDistanceToTarget(haversineDistance(fix.lat, fix.lng, t.lat, t.lng));
    } else {
      setDistanceToTarget(null);
    }
  }, []);

  const setUnlockRadius = useCallback((meters: number) => {
    unlockRadiusRef.current = meters;
  }, []);

  const setGpsOverride = useCallback((value: boolean) => {
    setGpsOverrideActive(value);
  }, []);

  // ---- Return ----
  const state: PlayGpsState = useMemo(
    () => ({
      location,
      heading,
      accuracy,
      distanceToTarget,
      isInRange,
      permission,
      isAcquiring,
      gpsOverrideActive,
      gpsError,
    }),
    [location, heading, accuracy, distanceToTarget, isInRange, permission, isAcquiring, gpsOverrideActive, gpsError],
  );

  const actions: PlayGpsActions = useMemo(
    () => ({
      requestPermission,
      requestCompassPermission,
      setTarget,
      setUnlockRadius,
      setGpsOverride,
      forceSyncLocation,
    }),
    [requestPermission, requestCompassPermission, setTarget, setUnlockRadius, setGpsOverride, forceSyncLocation],
  );

  return { state, actions };
}
