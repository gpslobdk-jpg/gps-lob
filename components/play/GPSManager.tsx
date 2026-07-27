"use client";

import { useEffect, useRef } from "react";

import {
  STUDENT_LOCATION_STALE_AFTER_MS,
  STUDENT_LOCATION_UNLOCK_MAX_ACCURACY_METERS,
} from "@/lib/location/studentLocationState";
import {
  createClientTelemetryMessage,
  sendTelemetry,
} from "@/utils/telemetry";

import type { Location } from "./types";
import {
  AUTO_UNLOCK_CONFIRMATION_HITS,
  GPS_JUMP_FILTER_MAX_SPEED_METERS_PER_SECOND,
  GPS_JUMP_FILTER_MIN_DISTANCE_METERS,
  LOCATION_SYNC_DISTANCE_METERS,
  LOCATION_SYNC_INTERVAL_MS,
  getDistance,
} from "./playUtils";

export type GpsErrorType =
  | "permission_denied"
  | "position_unavailable"
  | "timeout"
  | "unknown";

export type StudentLocationRuntimeState = {
  supported: boolean;
  isLocating: boolean;
  hasPosition: boolean;
  observedAtMs: number;
  positionTimestampMs: number | null;
  accuracyMeters: number | null;
  errorType: GpsErrorType | null;
  resumedAtMs: number | null;
};

type GPSManagerProps = {
  enabled: boolean;
  standardStudentLocationFlow?: boolean;
  allowAutomaticUnlock?: boolean;
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
  onGpsErrorTypeChange?: (errorType: GpsErrorType | null) => void;
  onLocationRuntimeChange?: (state: StudentLocationRuntimeState) => void;
  restartNonce?: number;
};

type AcceptedGpsLocation = Location & {
  accuracy: number;
  timestampMs: number;
};

const MOVEMENT_SYNC_MIN_INTERVAL_MS = 10000; // Throttle: minimum 10s between syncs
const GPS_HEARTBEAT_INTERVAL_MS = 20_000;
const GPS_HEARTBEAT_STALE_THRESHOLD_MS = 15_000;
const LIVE_TRACKING_MAX_ACCURACY_METERS =
  STUDENT_LOCATION_UNLOCK_MAX_ACCURACY_METERS;
const AUTO_UNLOCK_CONFIRMATION_GRACE_MS = 4_000;
// Fallback: if no position has been accepted for this long (e.g. WiFi→4G switch),
// temporarily allow readings up to the fallback ceiling so the user isn't stuck.
const GPS_ACCURACY_FALLBACK_AFTER_MS = 10_000;
const GPS_ACCURACY_FALLBACK_MAX_METERS = 500;
const INITIAL_LOCATION_ATTEMPT_TIMEOUT_MS = 30_000;

function getRoundedAccuracyMeters(rawAccuracy: number) {
  return Number.isFinite(rawAccuracy) ? Math.max(0, Math.round(rawAccuracy)) : null;
}

function getMeasurementTimestampMs(rawTimestamp: number) {
  const nowMs = Date.now();
  const earliestReasonableEpochMs = Date.UTC(2000, 0, 1);
  return Number.isFinite(rawTimestamp) &&
    rawTimestamp >= earliestReasonableEpochMs &&
    rawTimestamp <= nowMs + 60_000
    ? rawTimestamp
    : nowMs;
}

const toMeters = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371000;
  const x = (lng2 - lng1) * Math.cos(((lat1 + lat2) / 2) * Math.PI / 180);
  const y = lat2 - lat1;
  return Math.sqrt(x * x + y * y) * Math.PI / 180 * R;
};

const metersToLat = (m: number) => (m / 6371000) * (180 / Math.PI);

const metersToLng = (m: number, lat: number) => (m / (6371000 * Math.cos(lat * Math.PI / 180))) * (180 / Math.PI);

function calculateDistanceMeters(prev: AcceptedGpsLocation, next: AcceptedGpsLocation) {
  return getDistance(prev.lat, prev.lng, next.lat, next.lng);
}

export default function GPSManager({
  enabled,
  standardStudentLocationFlow = false,
  allowAutomaticUnlock = true,
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
  onGpsErrorTypeChange,
  onLocationRuntimeChange,
  restartNonce = 0,
}: GPSManagerProps) {
  const targetLat = target?.lat ?? null;
  const targetLng = target?.lng ?? null;
  const autoUnlockConfirmationRef = useRef(0);
  const lastAutoUnlockInRangeAtMsRef = useRef(0);
  const lastAcceptedLocationRef = useRef<AcceptedGpsLocation | null>(null);
  const lastAcceptedAtMsRef = useRef(0);
  const lastAcceptedRef = useRef<AcceptedGpsLocation | null>(null);
  const lastAcceptedAtRef = useRef<number>(0);
  const displayLocationRef = useRef<AcceptedGpsLocation | null>(null);
  const targetLocationRef = useRef<AcceptedGpsLocation | null>(null);
  const velocityRef = useRef<{ vx: number; vy: number } | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastLocationSyncRef = useRef<{ lat: number; lng: number; at: number } | null>(null);
  const isLocationSyncInFlightRef = useRef(false);
  const lastPositionTimestampRef = useRef(0);
  const heartbeatRestartCountRef = useRef(0);
  const repeatedTimeoutCountRef = useRef(0);
  const locationTelemetrySentRef = useRef(new Set<string>());
  const currentPostIndexRef = useRef(currentPostIndex);
  const showQuestionRef = useRef(showQuestion);
  const dismissedPostIndexRef = useRef(dismissedPostIndex);
  const onLocationChangeRef = useRef(onLocationChange);
  const onDistanceChangeRef = useRef(onDistanceChange);
  const onAutoUnlockRef = useRef(onAutoUnlock);
  const onDismissedResetRef = useRef(onDismissedReset);
  const onSyncLocationRef = useRef(onSyncLocation);
  const onGpsErrorChangeRef = useRef(onGpsErrorChange);
  const onGpsErrorTypeChangeRef = useRef(onGpsErrorTypeChange);
  const onLocationRuntimeChangeRef = useRef(onLocationRuntimeChange);

  useEffect(() => {
    currentPostIndexRef.current = currentPostIndex;
    showQuestionRef.current = showQuestion;
    dismissedPostIndexRef.current = dismissedPostIndex;
    onLocationChangeRef.current = onLocationChange;
    onDistanceChangeRef.current = onDistanceChange;
    onAutoUnlockRef.current = onAutoUnlock;
    onDismissedResetRef.current = onDismissedReset;
    onSyncLocationRef.current = onSyncLocation;
    onGpsErrorChangeRef.current = onGpsErrorChange;
    onGpsErrorTypeChangeRef.current = onGpsErrorTypeChange;
    onLocationRuntimeChangeRef.current = onLocationRuntimeChange;
  }, [
    currentPostIndex,
    dismissedPostIndex,
    onAutoUnlock,
    onDismissedReset,
    onDistanceChange,
    onGpsErrorChange,
    onGpsErrorTypeChange,
    onLocationChange,
    onLocationRuntimeChange,
    onSyncLocation,
    showQuestion,
  ]);

  useEffect(() => {
    autoUnlockConfirmationRef.current = 0;
    lastAutoUnlockInRangeAtMsRef.current = 0;
  }, [currentPostIndex, showQuestion]);

  useEffect(() => {
    if (!enabled) {
      onGpsErrorChangeRef.current?.(false);
      onGpsErrorTypeChangeRef.current?.(null);
      displayLocationRef.current = null;
      targetLocationRef.current = null;
      velocityRef.current = null;
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled) return;

    autoUnlockConfirmationRef.current = 0;
    lastAutoUnlockInRangeAtMsRef.current = 0;
    lastAcceptedLocationRef.current = null;
    lastAcceptedAtMsRef.current = 0;
    lastAcceptedRef.current = null;
    lastAcceptedAtRef.current = 0;
    velocityRef.current = null;
    lastLocationSyncRef.current = null;
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      onGpsErrorChangeRef.current?.(true);
      onGpsErrorTypeChangeRef.current?.("unknown");
      onDistanceChangeRef.current(null);
      onLocationRuntimeChangeRef.current?.({
        supported: false,
        isLocating: false,
        hasPosition: false,
        observedAtMs: Date.now(),
        positionTimestampMs: null,
        accuracyMeters: null,
        errorType: null,
        resumedAtMs: null,
      });
      return;
    }

    const watchIdRef = { current: null as number | null };
    let isDisposed = false;
    let callbackGeneration = 0;
    let staleTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let lastRestartAtMs = Date.now();
    let resumedAtMs: number | null = null;
    let hasAcceptedPositionInEffect = false;
    const trackingStartedAtMs = Date.now();

    const gpsOptions: PositionOptions = {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 30000,
    };

    const emitRuntimeState = (
      overrides: Partial<StudentLocationRuntimeState> = {}
    ) => {
      const lastAccepted = lastAcceptedLocationRef.current;
      onLocationRuntimeChangeRef.current?.({
        supported: true,
        isLocating: false,
        hasPosition: Boolean(lastAccepted),
        observedAtMs: Date.now(),
        positionTimestampMs: lastAccepted?.timestampMs ?? null,
        accuracyMeters: lastAccepted?.accuracy ?? null,
        errorType: null,
        resumedAtMs,
        ...overrides,
      });
    };

    const sendLocationTelemetryOnce = (
      eventType: string,
      phase: string
    ) => {
      if (locationTelemetrySentRef.current.has(eventType)) {
        return;
      }

      locationTelemetrySentRef.current.add(eventType);
      sendTelemetry(eventType, {
        message: createClientTelemetryMessage({
          accuracy_category: "unknown",
          online: navigator.onLine,
          phase,
        }),
      });
    };

    const invalidateUnlockDistance = () => {
      autoUnlockConfirmationRef.current = 0;
      lastAutoUnlockInRangeAtMsRef.current = 0;
      onDistanceChangeRef.current(null);
    };

    const clearActiveWatch = () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };

    const clearStaleTimeout = () => {
      if (staleTimeoutId !== null) {
        clearTimeout(staleTimeoutId);
        staleTimeoutId = null;
      }
    };

    const scheduleFreshnessExpiry = (initialAttempt = false) => {
      clearStaleTimeout();
      staleTimeoutId = setTimeout(() => {
        staleTimeoutId = null;
        if (
          isDisposed ||
          document.visibilityState !== "visible" ||
          Date.now() - lastPositionTimestampRef.current <
            STUDENT_LOCATION_STALE_AFTER_MS
        ) {
          return;
        }

        if (initialAttempt && !hasAcceptedPositionInEffect) {
          if (standardStudentLocationFlow) {
            invalidateUnlockDistance();
            onGpsErrorChangeRef.current?.(true);
            onGpsErrorTypeChangeRef.current?.("timeout");
            emitRuntimeState({
              isLocating: false,
              errorType: "timeout",
            });
            return;
          }

          startWatch("stale");
          return;
        }

        if (standardStudentLocationFlow) {
          invalidateUnlockDistance();
          emitRuntimeState({
            isLocating: true,
            errorType: "position_unavailable",
          });
          sendLocationTelemetryOnce(
            "student_location_watch_stopped",
            "stale"
          );
        }
        startWatch("stale");
      }, (initialAttempt
        ? standardStudentLocationFlow
          ? INITIAL_LOCATION_ATTEMPT_TIMEOUT_MS
          : 20_000
        : STUDENT_LOCATION_STALE_AFTER_MS) + 50);
    };

    if (standardStudentLocationFlow) {
      invalidateUnlockDistance();
    }
    emitRuntimeState({
      isLocating: true,
      errorType: null,
    });

    const resetAutoUnlockConfirmationIfGraceExpired = (nowMs: number) => {
      if (
        lastAutoUnlockInRangeAtMsRef.current > 0 &&
        nowMs - lastAutoUnlockInRangeAtMsRef.current <= AUTO_UNLOCK_CONFIRMATION_GRACE_MS
      ) {
        return;
      }

      autoUnlockConfirmationRef.current = 0;
    };

    const animate = () => {
      if (!displayLocationRef.current || !targetLocationRef.current) {
        animationFrameRef.current = null;
        return;
      }

      const current = displayLocationRef.current;
      const target = targetLocationRef.current;

      const distanceMeters = calculateDistanceMeters(current, target);

      const speed = velocityRef.current
        ? Math.sqrt(velocityRef.current.vx ** 2 + velocityRef.current.vy ** 2)
        : 0;
      const predictionActive = speed > 0.5;

      const base = Math.min(0.5, Math.max(0.15, distanceMeters / 30));
      const speedBoost = Math.min(0.25, speed / 10);
      const factor = Math.min(0.6, base + speedBoost);

      let predicted = target;

      if (velocityRef.current) {
        const lookaheadSec = Math.min(0.6, Math.max(0.1, speed / 5));
        const dxm = velocityRef.current.vx * lookaheadSec;
        const dym = velocityRef.current.vy * lookaheadSec;

        predicted = {
          ...target,
          lat: target.lat + metersToLat(dym),
          lng: target.lng + metersToLng(dxm, target.lat),
        };
      }

      const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

      const next = {
        ...predicted,
        lat: lerp(current.lat, predicted.lat, factor),
        lng: lerp(current.lng, predicted.lng, factor),
      };

      const msSinceLast = Date.now() - lastAcceptedAtRef.current;

      if (msSinceLast > 1200 && velocityRef.current && !predictionActive) {
        const dt = Math.min(1.0, msSinceLast / 1000);
        const dxm = velocityRef.current.vx * dt;
        const dym = velocityRef.current.vy * dt;

        next.lat += metersToLat(dym);
        next.lng += metersToLng(dxm, next.lat);
      }

      if (distanceMeters > 0.5) {
        displayLocationRef.current = next;
        onLocationChangeRef.current(next);
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        displayLocationRef.current = target;
        onLocationChangeRef.current(target);
        animationFrameRef.current = null;
      }
    };

    const successHandler = async (position: GeolocationPosition) => {
      const nowMs = Date.now();
      if (!standardStudentLocationFlow) {
        // Preserve the legacy heartbeat contract for special game flows.
        lastPositionTimestampRef.current = nowMs;
      }

      const accuracy = getRoundedAccuracyMeters(position.coords.accuracy);

      // Determine the effective accuracy ceiling for this reading.
      // After GPS_ACCURACY_FALLBACK_AFTER_MS without any accepted position
      // (typical during WiFi→4G network switch), temporarily raise the ceiling
      // so the user is not left without a location entirely.
      const msSinceLastAccepted = lastAcceptedAtMsRef.current > 0
        ? nowMs - lastAcceptedAtMsRef.current
        : standardStudentLocationFlow
          ? nowMs - trackingStartedAtMs
          : Number.MAX_SAFE_INTEGER;
      const isPositionStale = msSinceLastAccepted >= GPS_ACCURACY_FALLBACK_AFTER_MS;
      const effectiveMaxAccuracy = isPositionStale
        ? GPS_ACCURACY_FALLBACK_MAX_METERS
        : LIVE_TRACKING_MAX_ACCURACY_METERS;

      if (accuracy === null || accuracy > effectiveMaxAccuracy) {
        resetAutoUnlockConfirmationIfGraceExpired(nowMs);
        if (standardStudentLocationFlow) {
          invalidateUnlockDistance();
          emitRuntimeState({
            isLocating: false,
            hasPosition: true,
            positionTimestampMs: getMeasurementTimestampMs(position.timestamp),
            accuracyMeters: accuracy,
            errorType: null,
          });
        }
        return;
      }

      // A degraded-accuracy fallback reading must not trigger auto-unlock —
      // it only keeps the location indicator alive during a network transition.
      const isDegradedFallback = accuracy > LIVE_TRACKING_MAX_ACCURACY_METERS;

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const timestampMs = getMeasurementTimestampMs(position.timestamp);
      if (
        standardStudentLocationFlow &&
        (nowMs - timestampMs > STUDENT_LOCATION_STALE_AFTER_MS ||
          timestampMs > nowMs ||
          (resumedAtMs !== null && timestampMs < resumedAtMs))
      ) {
        invalidateUnlockDistance();
        emitRuntimeState({
          isLocating: true,
          hasPosition: true,
          positionTimestampMs: timestampMs,
          accuracyMeters: accuracy,
          errorType: "position_unavailable",
        });
        return;
      }

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

      if (standardStudentLocationFlow) {
        lastPositionTimestampRef.current = nowMs;
      }
      const acceptedLocation: AcceptedGpsLocation = {
        lat,
        lng,
        accuracy,
        timestampMs,
      };

      const acceptedNow = Date.now();

      if (lastAcceptedRef.current) {
        const prev = lastAcceptedRef.current;
        const dt = Math.max(0.016, (acceptedNow - lastAcceptedAtRef.current) / 1000);
        const dx = toMeters(prev.lat, prev.lng, acceptedLocation.lat, acceptedLocation.lng);
        const bearingX = acceptedLocation.lng - prev.lng;
        const bearingY = acceptedLocation.lat - prev.lat;

        const len = Math.sqrt(bearingX * bearingX + bearingY * bearingY) || 1;
        const dirX = bearingX / len;
        const dirY = bearingY / len;

        const speed = dx / dt;

        velocityRef.current = {
          vx: dirX * speed,
          vy: dirY * speed,
        };
      }

      lastAcceptedRef.current = acceptedLocation;
      lastAcceptedAtRef.current = acceptedNow;

      lastAcceptedLocationRef.current = acceptedLocation;
      lastAcceptedAtMsRef.current = acceptedNow;
      hasAcceptedPositionInEffect = true;
      repeatedTimeoutCountRef.current = 0;
      onGpsErrorChangeRef.current?.(false);
      onGpsErrorTypeChangeRef.current?.(null);
      emitRuntimeState({
        isLocating: false,
        hasPosition: true,
        positionTimestampMs: timestampMs,
        accuracyMeters: accuracy,
        errorType: null,
      });
      if (standardStudentLocationFlow) {
        scheduleFreshnessExpiry();
      }

      targetLocationRef.current = acceptedLocation;

      if (!displayLocationRef.current) {
        displayLocationRef.current = acceptedLocation;
        onLocationChangeRef.current(acceptedLocation);
        if (!standardStudentLocationFlow) {
          return;
        }
      } else if (!animationFrameRef.current) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }

      if (targetLat !== null && targetLng !== null) {
        const nextDistance = getDistance(lat, lng, targetLat, targetLng);
        if (standardStudentLocationFlow && isDegradedFallback) {
          invalidateUnlockDistance();
        } else {
          onDistanceChangeRef.current(nextDistance);
        }

        if (
          allowAutomaticUnlock &&
          !isDegradedFallback &&
          autoUnlockRadius !== null &&
          nextDistance <= autoUnlockRadius &&
          !showQuestionRef.current &&
          dismissedPostIndexRef.current !== currentPostIndexRef.current
        ) {
          lastAutoUnlockInRangeAtMsRef.current = nowMs;
          autoUnlockConfirmationRef.current += 1;
          if (autoUnlockConfirmationRef.current >= AUTO_UNLOCK_CONFIRMATION_HITS) {
            autoUnlockConfirmationRef.current = 0;
            lastAutoUnlockInRangeAtMsRef.current = 0;
            onAutoUnlockRef.current();
          }
        } else {
          resetAutoUnlockConfirmationIfGraceExpired(nowMs);
        }

        if (
          autoUnlockRadius !== null &&
          nextDistance > autoUnlockRadius &&
          dismissedPostIndexRef.current === currentPostIndexRef.current
        ) {
          onDismissedResetRef.current();
        }
      } else {
        resetAutoUnlockConfirmationIfGraceExpired(nowMs);
        onDistanceChangeRef.current(null);
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
          await onSyncLocationRef.current(lat, lng, accuracy);
        } finally {
          isLocationSyncInFlightRef.current = false;
        }
      }
    };

    const errorHandler = (error: GeolocationPositionError) => {
      clearStaleTimeout();
      resetAutoUnlockConfirmationIfGraceExpired(Date.now());
      invalidateUnlockDistance();
      onGpsErrorChangeRef.current?.(true);

      if (error.code === error.PERMISSION_DENIED || error.code === 1) {
        onGpsErrorTypeChangeRef.current?.("permission_denied");
        emitRuntimeState({
          isLocating: false,
          errorType: "permission_denied",
        });
        if (standardStudentLocationFlow) {
          clearActiveWatch();
        }
        return;
      }

      if (error.code === error.POSITION_UNAVAILABLE || error.code === 2) {
        onGpsErrorTypeChangeRef.current?.("position_unavailable");
        emitRuntimeState({
          isLocating: false,
          errorType: "position_unavailable",
        });
        return;
      }

      if (error.code === error.TIMEOUT || error.code === 3) {
        onGpsErrorTypeChangeRef.current?.("timeout");
        if (!standardStudentLocationFlow) {
          lastPositionTimestampRef.current = 1;
        }
        emitRuntimeState({
          isLocating: false,
          errorType: "timeout",
        });
        if (standardStudentLocationFlow) {
          repeatedTimeoutCountRef.current += 1;
        }
        if (
          standardStudentLocationFlow &&
          repeatedTimeoutCountRef.current >= 2
        ) {
          sendLocationTelemetryOnce(
            "student_location_repeated_timeout",
            "watch"
          );
        }
        return;
      }

      onGpsErrorTypeChangeRef.current?.("unknown");
      emitRuntimeState({
        isLocating: false,
        errorType: "unknown",
      });
    };

    function startWatch(
      reason: "start" | "retry" | "resume" | "stale"
    ) {
      try {
        clearActiveWatch();
        callbackGeneration += 1;
        const generation = callbackGeneration;
        emitRuntimeState({
          isLocating: true,
          errorType: reason === "stale" ? "position_unavailable" : null,
        });
        watchIdRef.current = navigator.geolocation.watchPosition(
          (position) => {
            if (!isDisposed && generation === callbackGeneration) {
              void successHandler(position);
            }
          },
          (error) => {
            if (!isDisposed && generation === callbackGeneration) {
              errorHandler(error);
            }
          },
          gpsOptions
        );
      } catch {
        onGpsErrorChangeRef.current?.(true);
        onGpsErrorTypeChangeRef.current?.("unknown");
        emitRuntimeState({
          isLocating: false,
          errorType: "unknown",
        });
        if (standardStudentLocationFlow) {
          sendLocationTelemetryOnce(
            "student_location_initialization_failed",
            reason
          );
        }
      }
    }

    startWatch(restartNonce > 0 ? "retry" : "start");
    if (standardStudentLocationFlow) {
      scheduleFreshnessExpiry(true);
    }

    const heartbeatId = !standardStudentLocationFlow
      ? setInterval(() => {
          const stale =
            Date.now() - lastPositionTimestampRef.current >
            GPS_HEARTBEAT_STALE_THRESHOLD_MS;
          if (!stale) {
            return;
          }

          heartbeatRestartCountRef.current += 1;
          if (heartbeatRestartCountRef.current >= 2) {
            sendTelemetry("gps_died", {
              message: createClientTelemetryMessage({
                online: navigator.onLine,
                phase: "legacy_heartbeat",
                restart_count: heartbeatRestartCountRef.current,
              }),
            });
          }
          startWatch("stale");
        }, GPS_HEARTBEAT_INTERVAL_MS)
      : null;

    const restartTracking = () => {
      const nowMs = Date.now();
      if (
        watchIdRef.current !== null &&
        nowMs - lastRestartAtMs < 750
      ) {
        return;
      }

      lastRestartAtMs = nowMs;
      resumedAtMs = nowMs;
      if (standardStudentLocationFlow) {
        invalidateUnlockDistance();
      }
      startWatch("resume");
      if (standardStudentLocationFlow) {
        scheduleFreshnessExpiry();
      }
      const generation = callbackGeneration;

      try {
        if (navigator.geolocation.getCurrentPosition) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              if (!isDisposed && generation === callbackGeneration) {
                void successHandler(position);
              }
            },
            (error) => {
              if (
                standardStudentLocationFlow &&
                !isDisposed &&
                generation === callbackGeneration
              ) {
                errorHandler(error);
              }
            },
            gpsOptions
          );
        }
      } catch {
        if (standardStudentLocationFlow) {
          errorHandler({
            code: 2,
            message: "",
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          });
        }
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        restartTracking();
      } else if (standardStudentLocationFlow) {
        callbackGeneration += 1;
        clearActiveWatch();
        clearStaleTimeout();
        invalidateUnlockDistance();
        emitRuntimeState({
          isLocating: false,
          errorType: "position_unavailable",
        });
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
      isDisposed = true;
      callbackGeneration += 1;
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      velocityRef.current = null;
      if (heartbeatId !== null) {
        clearInterval(heartbeatId);
      }
      clearStaleTimeout();
      clearActiveWatch();
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [
    enabled,
    allowAutomaticUnlock,
    standardStudentLocationFlow,
    targetLat,
    targetLng,
    autoUnlockRadius,
    restartNonce,
  ]);

  return null;
}
