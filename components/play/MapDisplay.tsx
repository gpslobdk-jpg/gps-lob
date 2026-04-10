"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { ArrowUp } from "lucide-react";
import type { LatLngBoundsExpression } from "leaflet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";

import GlidingPlayerMarker from "./GlidingPlayerMarker";
import type { Location, MapDisplayProps } from "./types";

type MapViewportSyncProps = {
  center: [number, number];
  dimmed: boolean;
};

const DEFAULT_MAP_CENTER: [number, number] = [55.6761, 12.5683];

function getTargetHeadingDegrees(from: Location | null, to: Location | null) {
  if (!from || !to) {
    return null;
  }

  const fromLatRadians = (from.lat * Math.PI) / 180;
  const toLatRadians = (to.lat * Math.PI) / 180;
  const deltaLongitudeRadians = ((to.lng - from.lng) * Math.PI) / 180;

  const y = Math.sin(deltaLongitudeRadians) * Math.cos(toLatRadians);
  const x =
    Math.cos(fromLatRadians) * Math.sin(toLatRadians) -
    Math.sin(fromLatRadians) * Math.cos(toLatRadians) * Math.cos(deltaLongitudeRadians);
  const headingDegrees = (Math.atan2(y, x) * 180) / Math.PI;

  return (headingDegrees + 360) % 360;
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

function MapViewportSync({ center, dimmed }: MapViewportSyncProps) {
  const map = useMap();
  const hasCenteredRef = useRef(false);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      map.invalidateSize();

      if (!hasCenteredRef.current) {
        map.setView(center, map.getZoom(), { animate: false });
        hasCenteredRef.current = true;
        return;
      }

      map.panTo(center, {
        animate: true,
        duration: 0.75,
      });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [center, dimmed, map]);

  useEffect(() => {
    const handleResize = () => {
      map.invalidateSize();
    };

    const timeoutId = window.setTimeout(handleResize, 180);
    window.addEventListener("resize", handleResize);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("resize", handleResize);
    };
  }, [map]);

  return null;
}

function FitBoundsSync({
  playerLocation,
  targetLocation,
}: {
  playerLocation: Location | null;
  targetLocation: Location | null;
}) {
  const map = useMap();
  const hasFittedInitialRef = useRef(false);
  const prevTargetKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (hasFittedInitialRef.current) return;
    if (!targetLocation || !playerLocation) return;

    const bounds: [number, number][] = [
      [playerLocation.lat, playerLocation.lng],
      [targetLocation.lat, targetLocation.lng],
    ];

    try {
      map.fitBounds(bounds as LatLngBoundsExpression, { padding: [80, 80], maxZoom: 17, animate: true });
      hasFittedInitialRef.current = true;
      prevTargetKeyRef.current = `${targetLocation.lat},${targetLocation.lng}`;
      try {
        console.debug("Map auto-zoomed (fitBounds) triggered by: initial", {
          playerLocation,
          targetLocation,
        });
      } catch {
        /* no-op */
      }
    } catch {
      // ignore
    }
  }, [map, playerLocation, targetLocation]);

  useEffect(() => {
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
        map.fitBounds(bounds as LatLngBoundsExpression, { padding: [80, 80], maxZoom: 17, animate: true });
        prevTargetKeyRef.current = targetKey;
        try {
          console.debug("Map auto-zoomed (fitBounds) triggered by: target_change", {
            playerLocation,
            targetLocation,
          });
        } catch {
          /* no-op */
        }
      } catch {
        // ignore
      }
    }
  }, [map, playerLocation, targetLocation]);

  return null;
}

export default function MapDisplay({
  playerLocation,
  targetLocation,
  targetLabel,
  targetNumber,
  playerName,
  dimmed,
  isNearTarget,
  canOpenTarget,
  distanceToTargetMeters,
  onTargetClick,
}: MapDisplayProps) {
  const [targetClickHint, setTargetClickHint] = useState<string | null>(null);
  const targetIcon = useMemo(
    () => createTargetIcon(targetNumber, isNearTarget),
    [isNearTarget, targetNumber]
  );
  const targetHeading = useMemo(
    () => getTargetHeadingDegrees(playerLocation, targetLocation),
    [playerLocation, targetLocation]
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

  const handleTargetMarkerClick = useCallback(() => {
    if (canOpenTarget) {
      setTargetClickHint(null);
      onTargetClick?.();
      return;
    }

    if (distanceToTargetMeters !== null && Number.isFinite(distanceToTargetMeters)) {
      setTargetClickHint(`Du er ${Math.max(1, Math.round(distanceToTargetMeters))} meter fra posten - gå lidt tættere på`);
      return;
    }

    setTargetClickHint("Vi finder stadig din position - prøv igen om et øjeblik");
  }, [canOpenTarget, distanceToTargetMeters, onTargetClick]);

  useEffect(() => {
    if (!targetClickHint) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setTargetClickHint(null);
    }, 2200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [targetClickHint]);

  useEffect(() => {
    if (canOpenTarget && targetClickHint) {
      setTargetClickHint(null);
    }
  }, [canOpenTarget, targetClickHint]);

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
        <MapViewportSync center={mapCenter} dimmed={dimmed} />
        <FitBoundsSync playerLocation={playerLocation} targetLocation={targetLocation} />
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
            eventHandlers={{ click: handleTargetMarkerClick }}
          />
        ) : null}

        {playerLocation ? (
          <GlidingPlayerMarker
            location={playerLocation}
            popupContent={`Du er her${playerName ? `, ${playerName}` : ""}`}
          />
        ) : null}
      </MapContainer>

      {targetClickHint ? (
        <div className="pointer-events-none absolute inset-x-4 bottom-28 z-950 flex justify-center sm:bottom-24">
          <div className="max-w-md rounded-full border border-white/12 bg-slate-950/90 px-4 py-2 text-center text-xs font-semibold text-amber-100 shadow-[0_18px_30px_rgba(15,23,42,0.45)] backdrop-blur-md">
            {targetClickHint}
          </div>
        </div>
      ) : null}

      {/* compact indicator for mobile */}
      {targetLocation ? (
        <div className="pointer-events-none absolute right-4 bottom-6 left-4 z-900 flex justify-center sm:hidden">
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/88 px-3 py-2 shadow-[0_18px_30px_rgba(15,23,42,0.4)] backdrop-blur-md" aria-hidden="true">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-slate-800/90 text-slate-100 shadow-inner shadow-black/20">
              <ArrowUp
                className="h-5 w-5 transition-transform duration-300"
                style={{ transform: `rotate(${targetHeading ?? 0}deg)` }}
              />
            </div>
            <div className="text-left">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Retning</div>
              <div className="text-xs font-semibold text-slate-100">Mod næste post</div>
            </div>
          </div>
          <span className="sr-only">Retningspil mod næste post</span>
        </div>
      ) : null}

      {/* full hint visible on tablet+ */}
      <div className="pointer-events-none absolute right-4 bottom-6 left-4 z-900 hidden sm:flex justify-center">
        <div className="rounded-full border border-white/10 bg-slate-900/78 px-3 py-2 text-xs text-emerald-100/80 shadow-[0_18px_30px_rgba(15,23,42,0.4)] backdrop-blur-md">
          Hold kursen mod den ravgule markør
        </div>
      </div>
    </div>
  );
}
