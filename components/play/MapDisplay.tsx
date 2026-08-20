"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import type { LatLngBoundsExpression, LeafletEventHandlerFnMap } from "leaflet";
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";

import GlidingPlayerMarker from "./GlidingPlayerMarker";
import type { Location, MapDisplayProps } from "./types";

type TargetClickHintTone = "opening" | "blocked";

type TargetClickHintState = {
  message: string;
  tone: TargetClickHintTone;
} | null;

type ProgrammaticMapMotionRef = MutableRefObject<boolean>;

type StandardMapResumeState = {
  scopeKey: string;
  isFollowingPlayer: boolean;
  center: [number, number] | null;
  zoom: number | null;
};

type MapViewportSyncProps = {
  initialResumeState: StandardMapResumeState | null;
  resumeScopeKey: string;
  playerLocation: Location | null;
  isFollowingPlayer: boolean;
  onMapResume: () => void;
  onUserMapInteraction: () => void;
  programmaticMapMotionRef: ProgrammaticMapMotionRef;
};

const DEFAULT_MAP_CENTER: [number, number] = [55.6761, 12.5683];
const MAP_RESUME_SETTLE_DELAY_MS = 180;
let standardMapResumeState: StandardMapResumeState | null = null;

function getStandardMapResumeScopeKey() {
  return typeof window === "undefined" ? "" : window.location.pathname;
}

function readStandardMapResumeState(scopeKey: string) {
  return standardMapResumeState?.scopeKey === scopeKey
    ? standardMapResumeState
    : null;
}

function updateStandardMapFollowState(
  scopeKey: string,
  isFollowingPlayer: boolean
) {
  const current = readStandardMapResumeState(scopeKey);
  standardMapResumeState = {
    scopeKey,
    isFollowingPlayer,
    center: current?.center ?? null,
    zoom: current?.zoom ?? null,
  };
}

function withProgrammaticMapMotion(
  programmaticMapMotionRef: ProgrammaticMapMotionRef,
  motion: () => void
) {
  programmaticMapMotionRef.current = true;

  try {
    motion();
  } finally {
    window.requestAnimationFrame(() => {
      programmaticMapMotionRef.current = false;
    });
  }
}

function createTargetIcon(targetNumber: number | null, isNearTarget: boolean) {
  const label = Number.isFinite(targetNumber) ? String(targetNumber) : "?";
  const haloMarkup = isNearTarget
    ? '<div class="absolute inset-0 rounded-full bg-orange-400/30 animate-ping"></div><div class="absolute inset-0.75 rounded-full bg-orange-300/22 blur-[1px]"></div>'
    : '<div class="absolute inset-0.75 rounded-full bg-amber-200/16"></div>';
  const badgeToneClasses = isNearTarget
    ? "border-white bg-orange-500 text-white shadow-[0_0_18px_rgba(249,115,22,0.92)]"
    : "border-white/70 bg-amber-200 text-slate-900 shadow-[0_0_10px_rgba(251,191,36,0.24)]";

  return L.divIcon({
    className: "bg-transparent border-none",
    html: `
      <div class="relative flex h-11 w-11 items-center justify-center overflow-visible">
        ${haloMarkup}
        <div class="relative flex h-11 w-11 items-center justify-center rounded-full border-2 text-lg font-black ${badgeToneClasses}">
          ${label}
        </div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

function MapViewportSync({
  initialResumeState,
  resumeScopeKey,
  playerLocation,
  isFollowingPlayer,
  onMapResume,
  onUserMapInteraction,
  programmaticMapMotionRef,
}: MapViewportSyncProps) {
  const map = useMap();
  const playerLocationRef = useRef(playerLocation);
  const isFollowingPlayerRef = useRef(isFollowingPlayer);
  const hasRestoredInitialViewportRef = useRef(false);

  useEffect(() => {
    playerLocationRef.current = playerLocation;
    isFollowingPlayerRef.current = isFollowingPlayer;
  }, [isFollowingPlayer, playerLocation]);

  useEffect(() => {
    const captureViewport = () => {
      try {
        if (!map || !map.getContainer()) return;
        const center = map.getCenter();
        standardMapResumeState = {
          scopeKey: resumeScopeKey,
          isFollowingPlayer:
            readStandardMapResumeState(resumeScopeKey)?.isFollowingPlayer ??
            isFollowingPlayerRef.current,
          center: [center.lat, center.lng],
          zoom: map.getZoom(),
        };
      } catch {
        // The map may already be detached during a transient route remount.
      }
    };

    if (
      !hasRestoredInitialViewportRef.current &&
      initialResumeState?.scopeKey === resumeScopeKey &&
      initialResumeState.center &&
      initialResumeState.zoom !== null
    ) {
      hasRestoredInitialViewportRef.current = true;
      withProgrammaticMapMotion(programmaticMapMotionRef, () => {
        map.setView(initialResumeState.center!, initialResumeState.zoom!, {
          animate: false,
        });
      });
    }

    captureViewport();
    map.on("moveend", captureViewport);
    map.on("zoomend", captureViewport);

    return () => {
      captureViewport();
      map.off("moveend", captureViewport);
      map.off("zoomend", captureViewport);
    };
  }, [initialResumeState, map, programmaticMapMotionRef, resumeScopeKey]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      try {
        if (!map || !map.getContainer()) return;

        map.invalidateSize();
      } catch (err) {
        console.warn("MapViewportSync: map operation failed:", err);
      }
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [map]);

  useEffect(() => {
    let firstFrameId: number | null = null;
    let secondFrameId: number | null = null;
    let settleTimerId: number | null = null;
    let resumeScheduled = false;

    const restoreViewport = (remountPlayerMarker: boolean) => {
      try {
        if (!map || !map.getContainer()) return;

        map.invalidateSize({ animate: false });

        const currentPlayerLocation = playerLocationRef.current;
        if (
          isFollowingPlayerRef.current &&
          currentPlayerLocation &&
          Number.isFinite(currentPlayerLocation.lat) &&
          Number.isFinite(currentPlayerLocation.lng)
        ) {
          map.panTo([currentPlayerLocation.lat, currentPlayerLocation.lng], {
            animate: false,
          });
        }

        if (remountPlayerMarker) {
          onMapResume();
        }
      } catch {
        // Resume recovery is best-effort. The existing GPS retry remains available.
      }
    };

    const scheduleResume = () => {
      if (resumeScheduled || document.visibilityState !== "visible") {
        return;
      }

      resumeScheduled = true;
      firstFrameId = window.requestAnimationFrame(() => {
        firstFrameId = null;
        secondFrameId = window.requestAnimationFrame(() => {
          secondFrameId = null;
          restoreViewport(true);
          settleTimerId = window.setTimeout(() => {
            settleTimerId = null;
            restoreViewport(false);
            resumeScheduled = false;
          }, MAP_RESUME_SETTLE_DELAY_MS);
        });
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        scheduleResume();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pageshow", scheduleResume);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pageshow", scheduleResume);
      if (firstFrameId !== null) {
        window.cancelAnimationFrame(firstFrameId);
      }
      if (secondFrameId !== null) {
        window.cancelAnimationFrame(secondFrameId);
      }
      if (settleTimerId !== null) {
        window.clearTimeout(settleTimerId);
      }
    };
  }, [map, onMapResume]);

  useEffect(() => {
    const handleResize = () => {
      try {
        if (!map || !map.getContainer()) return;
        map.invalidateSize();
      } catch (err) {
        console.warn("MapViewportSync resize handler failed:", err);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [map]);

  useEffect(() => {
    if (!map || !isFollowingPlayer || programmaticMapMotionRef.current) {
      return;
    }

    if (!playerLocation || !Number.isFinite(playerLocation.lat) || !Number.isFinite(playerLocation.lng)) {
      return;
    }

    try {
      if (!map || !map.getContainer()) return;

      const nextCenter: [number, number] = [playerLocation.lat, playerLocation.lng];
      const currentCenter = map.getCenter();

      if (currentCenter.lat === nextCenter[0] && currentCenter.lng === nextCenter[1]) {
        return;
      }

      withProgrammaticMapMotion(programmaticMapMotionRef, () => {
        map.panTo(nextCenter, {
          animate: false,
          duration: 0.55,
        });
      });
    } catch (err) {
      console.warn("MapViewportSync follow pan failed:", err);
    }
  }, [isFollowingPlayer, map, playerLocation, programmaticMapMotionRef]);

  useEffect(() => {
    if (!map) {
      return;
    }

    const handleUserMapInteraction = () => {
      if (programmaticMapMotionRef.current) {
        return;
      }

      onUserMapInteraction();
    };

    map.on("dragstart", handleUserMapInteraction);
    map.on("zoomstart", handleUserMapInteraction);

    return () => {
      map.off("dragstart", handleUserMapInteraction);
      map.off("zoomstart", handleUserMapInteraction);
    };
  }, [map, onUserMapInteraction, programmaticMapMotionRef]);

  return null;
}

function FitBoundsSync({
  playerLocation,
  targetLocation,
  allowAutoFrame,
  programmaticMapMotionRef,
}: {
  playerLocation: Location | null;
  targetLocation: Location | null;
  allowAutoFrame: boolean;
  programmaticMapMotionRef: ProgrammaticMapMotionRef;
}) {
  const map = useMap();
  const hasFittedInitialRef = useRef(false);
  const prevTargetKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!allowAutoFrame) {
      return;
    }

    if (hasFittedInitialRef.current) return;
    if (!targetLocation || !playerLocation) return;
    if (!Number.isFinite(playerLocation.lat) || !Number.isFinite(playerLocation.lng)) return;
    if (!Number.isFinite(targetLocation.lat) || !Number.isFinite(targetLocation.lng)) return;

    const bounds: [number, number][] = [
      [playerLocation.lat, playerLocation.lng],
      [targetLocation.lat, targetLocation.lng],
    ];

    try {
      if (!map || !map.getContainer()) return;
      // Use animate:false for the very first fit so Leaflet does not start an
      // internal requestAnimationFrame zoom animation during startup.  At game
      // start, MapViewportSync's panTo(animate:true) fires in the same React
      // commit phase.  If fitBounds also uses animate:true, Leaflet cancels the
      // pan mid-flight via _panAnim.stop() but its already-queued RAF callback
      // can still fire on Mobile Safari (which has slower RAF scheduling),
      // accessing t.classList on a cleaned-up element → crash.  The map is not
      // visible to the user yet (tiles are still loading) so the non-animated
      // jump is imperceptible.
      withProgrammaticMapMotion(programmaticMapMotionRef, () => {
        map.fitBounds(bounds as LatLngBoundsExpression, { padding: [80, 80], maxZoom: 17, animate: false });
      });
      hasFittedInitialRef.current = true;
      prevTargetKeyRef.current = `${targetLocation.lat},${targetLocation.lng}`;
    } catch (err) {
      console.warn("FitBoundsSync initial fit failed:", err);
    }
  }, [allowAutoFrame, map, playerLocation, programmaticMapMotionRef, targetLocation]);

  useEffect(() => {
    if (!allowAutoFrame) {
      return;
    }

    if (!targetLocation) return;
    const targetKey = `${targetLocation.lat},${targetLocation.lng}`;
    const hasPlayer = !!playerLocation && Number.isFinite(playerLocation.lat) && Number.isFinite(playerLocation.lng);
    if (!hasPlayer) return;

    if (prevTargetKeyRef.current !== targetKey) {
      const bounds: [number, number][] = [
        [playerLocation!.lat, playerLocation!.lng],
        [targetLocation.lat, targetLocation.lng],
      ];

      try {
        if (!map || !map.getContainer()) return;
        // Keep animate:false to avoid Leaflet transition callbacks firing after
        // React unmounts the map on network/status changes (Sentry JAVASCRIPT-NEXTJS-2G).
        withProgrammaticMapMotion(programmaticMapMotionRef, () => {
          map.fitBounds(bounds as LatLngBoundsExpression, { padding: [80, 80], maxZoom: 17, animate: false });
        });
        prevTargetKeyRef.current = targetKey;
      } catch (err) {
        console.warn("FitBoundsSync target change fit failed:", err);
      }
    }
  }, [allowAutoFrame, map, playerLocation, programmaticMapMotionRef, targetLocation]);

  return null;
}

export default function MapDisplay({
  playerLocation,
  targetLocation,
  targetLabel,
  targetNumber,
  playerName,
  avatarUrl,
  dimmed,
  isNearTarget,
  canOpenTarget,
  distanceToTargetMeters,
  onTargetClick,
}: MapDisplayProps) {
  const [resumeScopeKey] = useState(getStandardMapResumeScopeKey);
  const [initialResumeState] = useState(() =>
    readStandardMapResumeState(resumeScopeKey)
  );
  const [isFollowingPlayer, setIsFollowingPlayer] = useState(
    initialResumeState?.isFollowingPlayer ?? true
  );
  const [hasManualMapInteraction, setHasManualMapInteraction] = useState(false);
  const [playerMarkerResumeGeneration, setPlayerMarkerResumeGeneration] = useState(0);
  const [targetClickHint, setTargetClickHint] = useState<TargetClickHintState>(null);
  const lastTouchActivationAtRef = useRef(0);
  const isOpeningTargetRef = useRef(false);
  const targetClickHintTimeoutRef = useRef<number | null>(null);
  const targetClickOpenTimeoutRef = useRef<number | null>(null);
  const programmaticMapMotionRef = useRef(false);
  const targetIcon = useMemo(
    () => createTargetIcon(targetNumber, isNearTarget),
    [isNearTarget, targetNumber]
  );

  const mapCenter = useMemo<[number, number]>(() => {
    if (playerLocation) {
      return [playerLocation.lat, playerLocation.lng];
    }

    if (targetLocation) {
      return [targetLocation.lat, targetLocation.lng];
    }

    return DEFAULT_MAP_CENTER;
  }, [playerLocation, targetLocation]);

  useEffect(() => {
    if (!canOpenTarget) {
      isOpeningTargetRef.current = false;
    }
  }, [canOpenTarget]);

  const clearTargetClickTimers = useCallback(() => {
    if (targetClickHintTimeoutRef.current !== null) {
      window.clearTimeout(targetClickHintTimeoutRef.current);
      targetClickHintTimeoutRef.current = null;
    }

    if (targetClickOpenTimeoutRef.current !== null) {
      window.clearTimeout(targetClickOpenTimeoutRef.current);
      targetClickOpenTimeoutRef.current = null;
    }
  }, []);

  const showTargetClickHint = useCallback(
    (message: string, tone: TargetClickHintTone, durationMs = 2200) => {
      clearTargetClickTimers();
      setTargetClickHint({ message, tone });
      targetClickHintTimeoutRef.current = window.setTimeout(() => {
        setTargetClickHint(null);
        targetClickHintTimeoutRef.current = null;
      }, durationMs);
    },
    [clearTargetClickTimers]
  );

  useEffect(() => {
    return () => {
      clearTargetClickTimers();
    };
  }, [clearTargetClickTimers]);

  const handleTargetMarkerActivate = useCallback(
    (source: "click" | "touchend") => {
      const now = Date.now();
      if (source === "click" && now - lastTouchActivationAtRef.current < 450) {
        return;
      }

      if (source === "touchend") {
        lastTouchActivationAtRef.current = now;
      }

      if (canOpenTarget) {
        if (isOpeningTargetRef.current) {
          return;
        }

        isOpeningTargetRef.current = true;
        showTargetClickHint("Åbner post…", "opening", 900);
        targetClickOpenTimeoutRef.current = window.setTimeout(() => {
          targetClickOpenTimeoutRef.current = null;
          onTargetClick?.();
        }, 120);
        return;
      }

      if (distanceToTargetMeters !== null && Number.isFinite(distanceToTargetMeters)) {
        showTargetClickHint(
          `Du er stadig ca. ${Math.max(1, Math.round(distanceToTargetMeters))} meter fra posten`,
          "blocked"
        );
        return;
      }

      showTargetClickHint("Vi finder stadig din position - prøv igen om et øjeblik", "blocked");
    },
    [canOpenTarget, distanceToTargetMeters, onTargetClick, showTargetClickHint]
  );

  const handleUserMapInteraction = useCallback(() => {
    updateStandardMapFollowState(resumeScopeKey, false);
    setIsFollowingPlayer(false);
    setHasManualMapInteraction(true);
  }, [resumeScopeKey]);

  const handleFollowToggle = useCallback(() => {
    setIsFollowingPlayer((current) => {
      const next = !current;
      updateStandardMapFollowState(resumeScopeKey, next);
      return next;
    });
  }, [resumeScopeKey]);

  const handleMapResume = useCallback(() => {
    setPlayerMarkerResumeGeneration((current) => current + 1);
  }, []);

  const allowAutoFrame = isFollowingPlayer && !hasManualMapInteraction;

  return (
    <div
      className={`relative h-full min-h-svh w-full transition-all duration-300 ${
        dimmed ? "pointer-events-none opacity-60 blur-sm" : "opacity-100"
      }`}
    >
      <MapContainer
        center={mapCenter}
        zoom={17}
        zoomControl={true}
        scrollWheelZoom={true}
        dragging={true}
        doubleClickZoom={true}
        touchZoom={true}
        className="h-full w-full"
        style={{ height: "100%", width: "100%", filter: "none", backgroundColor: "#ffffff" }}
      >
        {/*
         * FitBoundsSync MUST come before MapViewportSync in the JSX so its
         * useEffect fires first in React's commit phase.
         *
         * When the first GPS fix arrives both components want to animate the
         * map in the same React render.  If MapViewportSync fires first it
         * calls map.panTo(animate:true), then FitBoundsSync calls
         * map.fitBounds(animate:true).  Leaflet cancels the pan internally via
         * _panAnim.stop() but the pan's requestAnimationFrame callback is
         * already queued.  On Mobile Safari (slower RAF scheduling) that stale
         * callback fires after Leaflet has cleaned up the animation element,
         * causing "TypeError: undefined is not an object (evaluating
         * 't.classList')" inside leaflet-src.js.
         *
         * By putting FitBoundsSync first it sets programmaticMapMotionRef to
         * true before MapViewportSync reads it, so MapViewportSync skips panTo
         * and only one Leaflet animation is ever in flight at a time.
         */}
        <FitBoundsSync
          playerLocation={playerLocation}
          targetLocation={targetLocation}
          allowAutoFrame={allowAutoFrame}
          programmaticMapMotionRef={programmaticMapMotionRef}
        />
        <MapViewportSync
          initialResumeState={initialResumeState}
          resumeScopeKey={resumeScopeKey}
          playerLocation={playerLocation}
          isFollowingPlayer={isFollowingPlayer}
          onMapResume={handleMapResume}
          onUserMapInteraction={handleUserMapInteraction}
          programmaticMapMotionRef={programmaticMapMotionRef}
        />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        {targetLocation ? (
          <Marker
            position={[targetLocation.lat, targetLocation.lng]}
            icon={targetIcon}
            title={
              canOpenTarget
                ? targetLabel || (targetNumber !== null ? `Post ${targetNumber}` : "Næste post")
                : "Gå tættere på for at åbne posten"
            }
            eventHandlers={{
              click: () => handleTargetMarkerActivate("click"),
              touchend: () => handleTargetMarkerActivate("touchend"),
            } as LeafletEventHandlerFnMap & { touchend: () => void }}
          />
        ) : null}

        {playerLocation ? (
          <GlidingPlayerMarker
            key={`player-resume-${playerMarkerResumeGeneration}`}
            location={playerLocation}
            avatarUrl={avatarUrl}
            popupContent={`Du er her${playerName ? `, ${playerName}` : ""}`}
          />
        ) : null}
      </MapContainer>

      <div className="pointer-events-none absolute inset-y-0 right-0 z-960 flex items-center pr-4 sm:pr-5">
        <button
          type="button"
          aria-pressed={isFollowingPlayer}
          onClick={handleFollowToggle}
          className={`pointer-events-auto inline-flex min-h-12 items-center gap-2 rounded-full border px-4 py-3 text-xs font-black uppercase tracking-[0.24em] shadow-[0_18px_30px_rgba(2,6,23,0.3)] backdrop-blur-md transition active:scale-[0.99] ${
            isFollowingPlayer
              ? "border-emerald-300/30 bg-emerald-500/18 text-emerald-50"
              : "border-white/12 bg-slate-950/88 text-white/82"
          }`}
        >
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              isFollowingPlayer ? "bg-emerald-300 shadow-[0_0_0_4px_rgba(16,185,129,0.18)]" : "bg-white/45"
            }`}
          />
          <span className="flex flex-col items-start leading-none">
            <span>Følg mig</span>
            <span className="mt-1 text-[10px] font-semibold tracking-[0.28em] opacity-70">
              {isFollowingPlayer ? "aktiv" : "slået fra"}
            </span>
          </span>
        </button>
      </div>

      {targetClickHint ? (
        <div className="pointer-events-none absolute inset-x-4 bottom-28 z-950 flex justify-center sm:bottom-24">
          <div
            className={`max-w-md rounded-[1.4rem] border px-5 py-4 text-center shadow-[0_18px_30px_rgba(15,23,42,0.45)] backdrop-blur-md animate-[map-display-hint-pop_180ms_cubic-bezier(0.22,1,0.36,1)] ${
              targetClickHint.tone === "opening"
                ? "border-emerald-300/24 bg-emerald-500/16 text-emerald-50"
                : "border-white/12 bg-slate-950/92 text-amber-100"
            }`}
          >
            <p className="text-[10px] font-black uppercase tracking-[0.34em] opacity-70">
              {targetClickHint.tone === "opening" ? "Åbner post" : "Afstand"}
            </p>
            <p className="mt-2 text-sm font-extrabold leading-6 sm:text-base">
              {targetClickHint.message}
            </p>
            {targetClickHint.tone === "blocked" ? (
              <p className="mt-1 text-xs font-semibold leading-5 text-white/72">
                Gå lidt tættere på og tryk igen.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <style jsx global>{`
        @keyframes map-display-hint-pop {
          0% {
            opacity: 0;
            transform: translateY(8px) scale(0.98);
          }

          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}
