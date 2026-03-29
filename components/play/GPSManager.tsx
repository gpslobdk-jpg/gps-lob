"use client";

import { useEffect, useRef } from "react";

import type { GpsErrorState, Location } from "./types";
import {
  AUTO_UNLOCK_CONFIRMATION_HITS,
  LOCATION_SYNC_INTERVAL_MS,
  LOCATION_SYNC_DISTANCE_METERS,
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
  onSyncLocation: (lat: number, lng: number) => Promise<void>;
};

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
  const lastAcceptedLocationRef = useRef<Location | null>(null);
  const lastLocationSyncRef = useRef<{ lat: number; lng: number; at: number } | null>(null);
  const isLocationSyncInFlightRef = useRef(false);

  useEffect(() => {
    autoUnlockConfirmationRef.current = 0;
    lastAcceptedLocationRef.current = null;
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
      const accuracy = position.coords.accuracy;
      if (Number.isFinite(accuracy) && accuracy > MAX_ACCEPTABLE_GPS_ACCURACY_METERS) {
        autoUnlockConfirmationRef.current = 0;
        onGpsError("low_accuracy");
        return;
      }

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const previousAcceptedLocation = lastAcceptedLocationRef.current;
      const distanceSinceLastAccepted = previousAcceptedLocation
        ? getDistance(previousAcceptedLocation.lat, previousAcceptedLocation.lng, lat, lng)
        : null;

      if (
        distanceSinceLastAccepted !== null &&
        distanceSinceLastAccepted < LOCATION_SYNC_DISTANCE_METERS
      ) {
        onGpsError(null);
        return;
      }

      lastAcceptedLocationRef.current = { lat, lng };
      onGpsError(null);
      onLocationChange({ lat, lng });

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

      const lastLocationSync = lastLocationSyncRef.current;
      const waitedLongEnough =
        !lastLocationSync || Date.now() - lastLocationSync.at >= LOCATION_SYNC_INTERVAL_MS;
      const movedFarEnoughToSync =
        !lastLocationSync ||
        getDistance(lastLocationSync.lat, lastLocationSync.lng, lat, lng) >=
          LOCATION_SYNC_DISTANCE_METERS;

      const shouldSyncLocation = !lastLocationSync || (waitedLongEnough && movedFarEnoughToSync);

      if (shouldSyncLocation && !isLocationSyncInFlightRef.current) {
        isLocationSyncInFlightRef.current = true;
        lastLocationSyncRef.current = {
          lat,
          lng,
          at: Date.now(),
        };

        try {
          await onSyncLocation(lat, lng);
        } finally {
          isLocationSyncInFlightRef.current = false;
        }
      }
    };

    const errorHandler = (error: GeolocationPositionError) => {
      console.error("GPS Error:", error);
      autoUnlockConfirmationRef.current = 0;

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
          // Try an immediate position read to wake GPS
          if (navigator.geolocation.getCurrentPosition) {
            navigator.geolocation.getCurrentPosition(
              (pos) => void successHandler(pos),
              () => undefined,
              gpsOptions
            );
          }
        } catch {
          // ignore
        }

        // Restart watch to ensure watcher isn't stale
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
