"use client";

import { useEffect, useRef } from "react";

import type { GpsErrorState, Location } from "./types";
import {
  AUTO_UNLOCK_CONFIRMATION_HITS,
  GPS_JUMP_FILTER_MAX_SPEED_METERS_PER_SECOND,
  GPS_JUMP_FILTER_MIN_DISTANCE_METERS,
  LOCATION_SYNC_DISTANCE_METERS,
  LOCATION_SYNC_INTERVAL_MS,
  MAX_ACCEPTABLE_GPS_ACCURACY_METERS,
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
  onGpsError: (error: GpsErrorState | null) => void;
  onAutoUnlock: () => void;
  onDismissedReset: () => void;
  onSyncLocation: (lat: number, lng: number, accuracy: number | null) => Promise<void>;
};

type AcceptedGpsLocation = Location & {
  accuracy: number;
  timestampMs: number;
};

const MOVEMENT_SYNC_MIN_INTERVAL_MS = 2000;

function getRoundedAccuracyMeters(rawAccuracy: number) {
  return Number.isFinite(rawAccuracy) ? Math.max(0, Math.round(rawAccuracy)) : null;
}

function getMeasurementTimestampMs(rawTimestamp: number) {
  return Number.isFinite(rawTimestamp) && rawTimestamp > 0 ? rawTimestamp : Date.now();
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
  onGpsError,
  onAutoUnlock,
  onDismissedReset,
  onSyncLocation,
}: GPSManagerProps) {
  const autoUnlockConfirmationRef = useRef(0);
  const lastAcceptedLocationRef = useRef<AcceptedGpsLocation | null>(null);
  const lastLocationSyncRef = useRef<{ lat: number; lng: number; at: number } | null>(null);
  const isLocationSyncInFlightRef = useRef(false);

  useEffect(() => {
    autoUnlockConfirmationRef.current = 0;
  }, [currentPostIndex, showQuestion]);

  useEffect(() => {
    if (enabled) return;

    autoUnlockConfirmationRef.current = 0;
    lastAcceptedLocationRef.current = null;
    lastLocationSyncRef.current = null;
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      queueMicrotask(() => {
        onGpsError("unsupported");
      });
      return;
    }

    const watchIdRef = { current: null as number | null };

    const gpsOptions: PositionOptions = {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000,
    };

    const successHandler = async (position: GeolocationPosition) => {
      const accuracy = getRoundedAccuracyMeters(position.coords.accuracy);
      if (accuracy === null || accuracy > MAX_ACCEPTABLE_GPS_ACCURACY_METERS) {
        autoUnlockConfirmationRef.current = 0;
        onGpsError("low_accuracy");
        onDistanceChange(null);
        return;
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
        autoUnlockConfirmationRef.current = 0;
        onGpsError("unstable_signal");
        onDistanceChange(null);
        return;
      }

      const acceptedLocation: AcceptedGpsLocation = {
        lat,
        lng,
        accuracy,
        timestampMs,
      };

      lastAcceptedLocationRef.current = acceptedLocation;
      onGpsError(null);
      onLocationChange(acceptedLocation);

      if (target && Number.isFinite(target.lat) && Number.isFinite(target.lng)) {
        const nextDistance = getDistance(lat, lng, target.lat, target.lng);
        onDistanceChange(nextDistance);

        if (
          autoUnlockRadius !== null &&
          nextDistance <= autoUnlockRadius &&
          !showQuestion &&
          dismissedPostIndex !== currentPostIndex
        ) {
          autoUnlockConfirmationRef.current += 1;
          if (autoUnlockConfirmationRef.current >= AUTO_UNLOCK_CONFIRMATION_HITS) {
            autoUnlockConfirmationRef.current = 0;
            onAutoUnlock();
          }
        } else {
          autoUnlockConfirmationRef.current = 0;
        }

        if (
          autoUnlockRadius !== null &&
          nextDistance > autoUnlockRadius &&
          dismissedPostIndex === currentPostIndex
        ) {
          onDismissedReset();
        }
      } else {
        autoUnlockConfirmationRef.current = 0;
      }

      const nowMs = Date.now();
      const lastLocationSync = lastLocationSyncRef.current;
      const waitedLongEnough =
        !lastLocationSync || nowMs - lastLocationSync.at >= LOCATION_SYNC_INTERVAL_MS;
      const movedFarEnoughToSync =
        !lastLocationSync ||
        getDistance(lastLocationSync.lat, lastLocationSync.lng, lat, lng) >=
          LOCATION_SYNC_DISTANCE_METERS;
      const canEarlySyncOnMovement =
        Boolean(lastLocationSync) && nowMs - (lastLocationSync?.at ?? 0) >= MOVEMENT_SYNC_MIN_INTERVAL_MS;
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
      autoUnlockConfirmationRef.current = 0;
      onDistanceChange(null);

      if (error.code === error.PERMISSION_DENIED || error.code === 1) {
        onGpsError("permission_denied");
        return;
      }

      if (error.code === error.POSITION_UNAVAILABLE || error.code === 2) {
        onGpsError("position_unavailable");
        return;
      }

      if (error.code === error.TIMEOUT || error.code === 3) {
        onGpsError("timeout");
        return;
      }

      onGpsError("timeout");
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
      }
    };

    startWatch();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        try {
          console.debug("Wake-up: Genstarter GPS");
        } catch {
          /* no-op */
        }
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
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [
    currentPostIndex,
    dismissedPostIndex,
    enabled,
    onAutoUnlock,
    onDismissedReset,
    onDistanceChange,
    onGpsError,
    onLocationChange,
    onSyncLocation,
    showQuestion,
    target,
    autoUnlockRadius,
  ]);

  return null;
}
