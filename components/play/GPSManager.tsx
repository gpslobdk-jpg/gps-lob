"use client";

import { useEffect, useRef } from "react";

import type { GpsErrorState, Location } from "./types";
import {
  AUTO_UNLOCK_CONFIRMATION_HITS,
  AUTO_UNLOCK_RADIUS,
  LOCATION_SYNC_DISTANCE_METERS,
  LOCATION_SYNC_INTERVAL_MS,
  getDistance,
} from "./playUtils";

type GPSManagerProps = {
  enabled: boolean;
  target: Location | null;
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
  const lastLocationSyncRef = useRef<{ lat: number; lng: number; at: number } | null>(null);
  const isLocationSyncInFlightRef = useRef(false);

  useEffect(() => {
    autoUnlockConfirmationRef.current = 0;
  }, [currentPostIndex, showQuestion]);

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

    const successHandler = async (position: GeolocationPosition) => {
      onGpsError(null);

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      onLocationChange({ lat, lng });

      if (target && Number.isFinite(target.lat) && Number.isFinite(target.lng)) {
        const nextDistance = getDistance(lat, lng, target.lat, target.lng);
        onDistanceChange(nextDistance);

        if (
          nextDistance <= AUTO_UNLOCK_RADIUS &&
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

        if (nextDistance > AUTO_UNLOCK_RADIUS && dismissedPostIndex === currentPostIndex) {
          onDismissedReset();
        }
      } else {
        autoUnlockConfirmationRef.current = 0;
      }

      const lastLocationSync = lastLocationSyncRef.current;
      const hasMovedEnough =
        !lastLocationSync ||
        getDistance(lat, lng, lastLocationSync.lat, lastLocationSync.lng) >=
          LOCATION_SYNC_DISTANCE_METERS;
      const waitedLongEnough =
        !lastLocationSync || Date.now() - lastLocationSync.at >= LOCATION_SYNC_INTERVAL_MS;

      if ((hasMovedEnough || waitedLongEnough) && !isLocationSyncInFlightRef.current) {
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
          { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
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
        } catch (e) {
          /* no-op */
        }
        try {
          // Try an immediate position read to wake GPS
          if (navigator.geolocation.getCurrentPosition) {
            navigator.geolocation.getCurrentPosition(
              (pos) => void successHandler(pos),
              () => undefined,
              { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
            );
          }
        } catch (e) {
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
  ]);

  return null;
}
