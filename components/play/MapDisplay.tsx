"use client";

import "leaflet/dist/leaflet.css";

import { MapPin } from "lucide-react";
import type { DivIcon } from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";

import type { Location } from "./types";

type MapDisplayProps = {
  playerLocation: Location | null;
  targetLocation: Location | null;
  targetLabel: string;
  playerName: string;
  dimmed: boolean;
};

type MapViewportSyncProps = {
  center: [number, number];
  dimmed: boolean;
};

const DEFAULT_MAP_CENTER: [number, number] = [55.6761, 12.5683];

function MapViewportSync({ center, dimmed }: MapViewportSyncProps) {
  const map = useMap();

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      map.invalidateSize();
      map.setView(center, map.getZoom(), { animate: false });
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
  const fittedRef = useRef(false);

  useEffect(() => {
    if (!playerLocation || !targetLocation) return;
    if (fittedRef.current) return;

    const bounds: [number, number][] = [
      [playerLocation.lat, playerLocation.lng],
      [targetLocation.lat, targetLocation.lng],
    ];

    try {
      map.fitBounds(bounds as any, { padding: [80, 80], maxZoom: 17, animate: true });
      fittedRef.current = true;
    } catch (e) {
      // ignore fitBounds errors (map may not be ready)
    }
  }, [playerLocation, targetLocation, map]);

  return null;
}

export default function MapDisplay({
  playerLocation,
  targetLocation,
  targetLabel,
  playerName,
  dimmed,
}: MapDisplayProps) {
  const [playerIcon, setPlayerIcon] = useState<DivIcon | null>(null);
  const [targetIcon, setTargetIcon] = useState<DivIcon | null>(null);

  useEffect(() => {
    let isDisposed = false;

    void import("leaflet")
      .then((leafletModule) => {
        if (isDisposed) return;

        const leaflet = leafletModule.default ?? leafletModule;

        setPlayerIcon(
          leaflet.divIcon({
            className: "bg-transparent border-none",
            html: '<div class="h-5 w-5 rounded-full border-2 border-emerald-100 bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.9)]"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          })
        );

        setTargetIcon(
          leaflet.divIcon({
            className: "bg-transparent border-none",
            html: '<div class="relative h-8 w-8"><div class="absolute inset-0 rounded-full bg-amber-300/20 animate-ping"></div><div class="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-amber-200 bg-amber-950 text-amber-100 font-black shadow-[0_0_18px_rgba(251,191,36,0.8)]">&#9678;</div></div>',
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          })
        );
      })
      .catch(() => {
        if (isDisposed) return;
        setPlayerIcon(null);
        setTargetIcon(null);
      });

    return () => {
      isDisposed = true;
    };
  }, []);

  const mapCenter = useMemo<[number, number]>(() => {
    if (playerLocation) {
      return [playerLocation.lat, playerLocation.lng];
    }

    if (targetLocation) {
      return [targetLocation.lat, targetLocation.lng];
    }

    return DEFAULT_MAP_CENTER;
  }, [playerLocation, targetLocation]);

  return (
    <div
      className={`relative h-full min-h-[100svh] w-full transition-all duration-300 ${
        dimmed ? "pointer-events-none opacity-60 blur-sm" : "opacity-100"
      }`}
    >
      <MapContainer
        center={mapCenter}
        zoom={17}
        zoomControl={false}
        className="h-full w-full"
        style={{ height: "100%", width: "100%" }}
      >
        <MapViewportSync center={mapCenter} dimmed={dimmed} />
        <FitBoundsSync playerLocation={playerLocation} targetLocation={targetLocation} />
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />

        {targetLocation && targetIcon ? (
          <Marker position={[targetLocation.lat, targetLocation.lng]} icon={targetIcon}>
            <Popup>
              <div className="text-sm break-words [overflow-wrap:anywhere] hyphens-auto">
                <div className="mb-1 flex items-center gap-2 font-semibold text-amber-600">
                  <MapPin className="h-4 w-4" />
                  Næste post
                </div>
                {targetLabel}
              </div>
            </Popup>
          </Marker>
        ) : null}

        {playerLocation && playerIcon ? (
          <Marker position={[playerLocation.lat, playerLocation.lng]} icon={playerIcon}>
            <Popup>Du er her{playerName ? `, ${playerName}` : ""}</Popup>
          </Marker>
        ) : null}
      </MapContainer>

      <div className="pointer-events-none absolute right-4 bottom-6 left-4 z-[900] flex justify-center">
        <div className="rounded-full border border-white/10 bg-slate-900/78 px-3 py-2 text-xs text-emerald-100/80 shadow-[0_18px_30px_rgba(15,23,42,0.4)] backdrop-blur-md">
          Hold kursen mod den ravgule markør
        </div>
      </div>
    </div>
  );
}
