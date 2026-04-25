"use client";

import { useEffect, useRef } from "react";

import { sendTelemetry } from "@/utils/telemetry";

import type { Location } from "./types";
import {
  AUTO_UNLOCK_CONFIRMATION_HITS,
  GPS_JUMP_FILTER_MAX_SPEED_METERS_PER_SECOND,
  GPS_JUMP_FILTER_MIN_DISTANCE_METERS,
  LOCATION_SYNC_DISTANCE_METERS,
  LOCATION_SYNC_INTERVAL_MS,
  getDistance,
} from "./playUtils";

type GPSManagerProps = {
  enabled: boolean;
  target: Location | null;
  autoUnlockRadius: number | null;
  currentPostIndex: number;
  showQuestion: boolean;
  dismissedPostIndex: number | null;
  onLocationChange: (location: Location | null) => void;
  onDistanceChange: (distance: number | null) => void;
  onAutoUnlock: () => void;
  onDismissedReset: () => void;
  onSyncLocation: (lat: number, lng: number, accuracy: number | null) => Promise<void>;
  onGpsErrorChange?: (hasError: boolean) => void;
  restartNonce?: number;
};

type AcceptedGpsLocation = Location & {
  accuracy: number;
  timestampMs: number;
};

  const MOVEMENT_SYNC_MIN_INTERVAL_MS = 10000; // Throttle: minimum 10s between syncs
const GPS_HEARTBEAT_INTERVAL_MS = 20_000;
const GPS_HEARTBEAT_STALE_THRESHOLD_MS = 15_000;
const LIVE_TRACKING_MAX_ACCURACY_METERS = 250;
const AUTO_UNLOCK_CONFIRMATION_GRACE_MS = 4_000;
// Fallback: if no position has been accepted for this long (e.g. WiFi→4G switch),
// temporarily allow readings up to the fallback ceiling so the user isn't stuck.
const GPS_ACCURACY_FALLBACK_AFTER_MS = 10_000;
const GPS_ACCURACY_FALLBACK_MAX_METERS = 500;

function getRoundedAccuracyMeters(rawAccuracy: number) {
  return Number.isFinite(rawAccuracy) ? Math.max(0, Math.round(rawAccuracy)) : null;
}

function getMeasurementTimestampMs(rawTimestamp: number) {
  return Number.isFinite(rawTimestamp) && rawTimestamp > 0 ? rawTimestamp : Date.now();
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function smoothLocation(
  prev: AcceptedGpsLocation,
  next: AcceptedGpsLocation,
  factor: number
): AcceptedGpsLocation {
  return {
    ...next,
    lat: lerp(prev.lat, next.lat, factor),
    lng: lerp(prev.lng, next.lng, factor),
  };
}

function calculateDistanceMeters(prev: AcceptedGpsLocation, next: AcceptedGpsLocation) {
  return getDistance(prev.lat, prev.lng, next.lat, next.lng);
}

export default function GPSManager({
  enabled,
  target,
  autoUnlockRadius,
  currentPostIndex,
  showQuestion,
  dismissedPostIndex,
  onLocationChange,
  onDistanceChange,
  onAutoUnlock,
  onDismissedReset,
  onSyncLocation,
  onGpsErrorChange,
  restartNonce = 0,
}: GPSManagerProps) {
  const targetLat = target?.lat ?? null;
  const targetLng = target?.lng ?? null;
  const autoUnlockConfirmationRef = useRef(0);
  const lastAutoUnlockInRangeAtMsRef = useRef(0);
  const lastAcceptedLocationRef = useRef<AcceptedGpsLocation | null>(null);
  const lastAcceptedAtMsRef = useRef(0);
  const displayLocationRef = useRef<AcceptedGpsLocation | null>(null);
  const lastLocationSyncRef = useRef<{ lat: number; lng: number; at: number } | null>(null);
  const isLocationSyncInFlightRef = useRef(false);
  const lastPositionTimestampRef = useRef(0);
  const heartbeatRestartCountRef = useRef(0);

  useEffect(() => {
    autoUnlockConfirmationRef.current = 0;
    lastAutoUnlockInRangeAtMsRef.current = 0;
  }, [currentPostIndex, showQuestion]);

  useEffect(() => {
    if (!enabled) {
      onGpsErrorChange?.(false);
      displayLocationRef.current = null;
    }
  }, [enabled, onGpsErrorChange]);

  useEffect(() => {
    if (enabled) return;

    autoUnlockConfirmationRef.current = 0;
    lastAutoUnlockInRangeAtMsRef.current = 0;
    lastAcceptedLocationRef.current = null;
    lastAcceptedAtMsRef.current = 0;
    lastLocationSyncRef.current = null;
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      onGpsErrorChange?.(true);
      onDistanceChange(null);
      return;
    }

    const watchIdRef = { current: null as number | null };

    const gpsOptions: PositionOptions = {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 30000,
    };

    const resetAutoUnlockConfirmationIfGraceExpired = (nowMs: number) => {
      if (
        lastAutoUnlockInRangeAtMsRef.current > 0 &&
        nowMs - lastAutoUnlockInRangeAtMsRef.current <= AUTO_UNLOCK_CONFIRMATION_GRACE_MS
      ) {
        return;
      }

      autoUnlockConfirmationRef.current = 0;
    };

    const successHandler = async (position: GeolocationPosition) => {
      // Track that the watcher is alive (used by heartbeat)
      lastPositionTimestampRef.current = Date.now();
      const nowMs = Date.now();

      const accuracy = getRoundedAccuracyMeters(position.coords.accuracy);

      // Determine the effective accuracy ceiling for this reading.
      // After GPS_ACCURACY_FALLBACK_AFTER_MS without any accepted position
      // (typical during WiFi→4G network switch), temporarily raise the ceiling
      // so the user is not left without a location entirely.
      const msSinceLastAccepted = lastAcceptedAtMsRef.current > 0
        ? Date.now() - lastAcceptedAtMsRef.current
        : Number.MAX_SAFE_INTEGER;
      const isPositionStale = msSinceLastAccepted >= GPS_ACCURACY_FALLBACK_AFTER_MS;
      const effectiveMaxAccuracy = isPositionStale
        ? GPS_ACCURACY_FALLBACK_MAX_METERS
        : LIVE_TRACKING_MAX_ACCURACY_METERS;

      if (accuracy === null || accuracy > effectiveMaxAccuracy) {
        resetAutoUnlockConfirmationIfGraceExpired(nowMs);
        return;
      }

      // A degraded-accuracy fallback reading must not trigger auto-unlock —
      // it only keeps the location indicator alive during a network transition.
      const isDegradedFallback = accuracy > LIVE_TRACKING_MAX_ACCURACY_METERS;
      if (isDegradedFallback) {
        sendTelemetry("gps_fallback_activated", {
          message: `accuracy=${accuracy}m msSinceLastAccepted=${msSinceLastAccepted}`,
        });
      }

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const timestampMs = getMeasurementTimestampMs(position.timestamp);
      const previousAcceptedLocation = lastAcceptedLocationRef.current;
      const distanceSinceLastAccepted = previousAcceptedLocation
        ? getDistance(previousAcceptedLocation.lat, previousAcceptedLocation.lng, lat, lng)
        : null;
      const elapsedMs =
        previousAcceptedLocation && Number.isFinite(previousAcceptedLocation.timestampMs)
          ? Math.max(1, timestampMs - previousAcceptedLocation.timestampMs)
          : null;
      const speedMetersPerSecond =
        distanceSinceLastAccepted !== null && elapsedMs !== null
          ? distanceSinceLastAccepted / (elapsedMs / 1000)
          : null;

      if (
        distanceSinceLastAccepted !== null &&
        elapsedMs !== null &&
        distanceSinceLastAccepted >= GPS_JUMP_FILTER_MIN_DISTANCE_METERS &&
        speedMetersPerSecond !== null &&
        speedMetersPerSecond > GPS_JUMP_FILTER_MAX_SPEED_METERS_PER_SECOND
      ) {
        resetAutoUnlockConfirmationIfGraceExpired(nowMs);
        return;
      }

      const acceptedLocation: AcceptedGpsLocation = {
        lat,
        lng,
        accuracy,
        timestampMs,
      };

      lastAcceptedLocationRef.current = acceptedLocation;
      lastAcceptedAtMsRef.current = Date.now();
  onGpsErrorChange?.(false);

      let displayLocation = acceptedLocation;

      if (!displayLocationRef.current) {
        displayLocationRef.current = acceptedLocation;
        onLocationChange(acceptedLocation);
        return;
      }

      if (displayLocationRef.current) {
        const prev = displayLocationRef.current;
        const distanceMeters = calculateDistanceMeters(prev, acceptedLocation);
        const factor = Math.min(0.4, Math.max(0.1, distanceMeters / 50));
        displayLocation = smoothLocation(prev, acceptedLocation, factor);
      }

      displayLocationRef.current = displayLocation;
      onLocationChange(displayLocation);

      if (targetLat !== null && targetLng !== null) {
        const nextDistance = getDistance(lat, lng, targetLat, targetLng);
        onDistanceChange(nextDistance);

        if (
          !isDegradedFallback &&
          autoUnlockRadius !== null &&
          nextDistance <= autoUnlockRadius &&
          !showQuestion &&
          dismissedPostIndex !== currentPostIndex
        ) {
          lastAutoUnlockInRangeAtMsRef.current = nowMs;
          autoUnlockConfirmationRef.current += 1;
          if (autoUnlockConfirmationRef.current >= AUTO_UNLOCK_CONFIRMATION_HITS) {
            autoUnlockConfirmationRef.current = 0;
            lastAutoUnlockInRangeAtMsRef.current = 0;
            onAutoUnlock();
          }
        } else {
          resetAutoUnlockConfirmationIfGraceExpired(nowMs);
        }

        if (
          autoUnlockRadius !== null &&
          nextDistance > autoUnlockRadius &&
          dismissedPostIndex === currentPostIndex
        ) {
          onDismissedReset();
        }
      } else {
        resetAutoUnlockConfirmationIfGraceExpired(nowMs);
        onDistanceChange(null);
      }

      const syncNowMs = Date.now();
      const lastLocationSync = lastLocationSyncRef.current;
      const waitedLongEnough =
        !lastLocationSync || syncNowMs - lastLocationSync.at >= LOCATION_SYNC_INTERVAL_MS;
      const movedFarEnoughToSync =
        !lastLocationSync ||
        getDistance(lastLocationSync.lat, lastLocationSync.lng, lat, lng) >=
          LOCATION_SYNC_DISTANCE_METERS;
      const canEarlySyncOnMovement =
        Boolean(lastLocationSync) && syncNowMs - (lastLocationSync?.at ?? 0) >= MOVEMENT_SYNC_MIN_INTERVAL_MS;
      const shouldSyncLocation =
        !lastLocationSync ||
        waitedLongEnough ||
        (movedFarEnoughToSync && canEarlySyncOnMovement);

      if (shouldSyncLocation && !isLocationSyncInFlightRef.current) {
        isLocationSyncInFlightRef.current = true;
        lastLocationSyncRef.current = {
          lat,
          lng,
          at: nowMs,
        };

        try {
          await onSyncLocation(lat, lng, accuracy);
        } finally {
          isLocationSyncInFlightRef.current = false;
        }
      }
    };

    const errorHandler = (error: GeolocationPositionError) => {
      console.error("GPS Error:", error);
      resetAutoUnlockConfirmationIfGraceExpired(Date.now());
      onDistanceChange(null);
      onGpsErrorChange?.(true);

      if (error.code === error.PERMISSION_DENIED || error.code === 1) {
        return;
      }

      if (error.code === error.POSITION_UNAVAILABLE || error.code === 2) {
        return;
      }

      if (error.code === error.TIMEOUT || error.code === 3) {
        lastPositionTimestampRef.current = 1;
      }
    };

    const startWatch = () => {
      try {
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
        watchIdRef.current = navigator.geolocation.watchPosition(
          successHandler,
          errorHandler,
          gpsOptions
        );
      } catch (e) {
        console.warn("Failed to start geolocation watch:", e);
        onGpsErrorChange?.(true);
      }
    };

    startWatch();

    // Heartbeat: if no GPS update in 15s, force a watcher restart
    const heartbeatId = setInterval(() => {
      const stale =
        Date.now() - lastPositionTimestampRef.current > GPS_HEARTBEAT_STALE_THRESHOLD_MS;
      if (stale) {
        console.debug("GPS heartbeat: ingen opdatering i >15s, genstarter watcher");
        heartbeatRestartCountRef.current++;
        if (heartbeatRestartCountRef.current >= 2) {
          sendTelemetry("gps_died", {
            message: `GPS heartbeat restarted ${heartbeatRestartCountRef.current} times (no update in >15s)`,
          });
        }
        startWatch();
      }
    }, GPS_HEARTBEAT_INTERVAL_MS);

    const restartTracking = () => {
      // Refresh the current position, then start a fresh high-accuracy watcher.
      try {
        if (navigator.geolocation.getCurrentPosition) {
          navigator.geolocation.getCurrentPosition(
            (pos) => void successHandler(pos),
            () => undefined,
            gpsOptions
          );
        }
      } catch {
        /* no-op */
      }

      startWatch();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        restartTracking();
      }
    };

    const handleOnline = () => {
      restartTracking();
    };

    const handlePageShow = () => {
      restartTracking();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("online", handleOnline);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      clearInterval(heartbeatId);
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [
    currentPostIndex,
    dismissedPostIndex,
    enabled,
    onAutoUnlock,
    onDismissedReset,
    onDistanceChange,
    onGpsErrorChange,
    onLocationChange,
    onSyncLocation,
    showQuestion,
    targetLat,
    targetLng,
    autoUnlockRadius,
    restartNonce,
  ]);

  return null;
}
