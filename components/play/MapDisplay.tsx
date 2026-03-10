"use client";

import "leaflet/dist/leaflet.css";

import dynamic from "next/dynamic";
import { MapPin } from "lucide-react";
import type { DivIcon } from "leaflet";
import { useEffect, useMemo, useState } from "react";

import type { Location } from "./types";

const MapContainer = dynamic(() => import("react-leaflet").then((m) => m.MapContainer), {
  ssr: false,
});
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), {
  ssr: false,
});
const Marker = dynamic(() => import("react-leaflet").then((m) => m.Marker), {
  ssr: false,
});
const Popup = dynamic(() => import("react-leaflet").then((m) => m.Popup), {
  ssr: false,
});

type MapDisplayProps = {
  playerLocation: Location | null;
  targetLocation: Location | null;
  targetLabel: string;
  playerName: string;
  dimmed: boolean;
};

const DEFAULT_MAP_CENTER: [number, number] = [55.6761, 12.5683];

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
            html: '<div class="w-5 h-5 rounded-full bg-emerald-400 border-2 border-emerald-100 shadow-[0_0_18px_rgba(52,211,153,0.9)]"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          })
        );

        setTargetIcon(
          leaflet.divIcon({
            className: "bg-transparent border-none",
            html: '<div class="relative w-8 h-8"><div class="absolute inset-0 rounded-full bg-amber-300/20 animate-ping"></div><div class="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-amber-200 bg-amber-950 text-amber-100 font-black shadow-[0_0_18px_rgba(251,191,36,0.8)]">◎</div></div>',
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

  const mapKey = useMemo(() => {
    const [lat, lng] = mapCenter;
    const targetLat = targetLocation?.lat ?? 0;
    const targetLng = targetLocation?.lng ?? 0;
    return `${lat.toFixed(4)}-${lng.toFixed(4)}-${targetLat.toFixed(4)}-${targetLng.toFixed(4)}`;
  }, [mapCenter, targetLocation]);

  return (
    <div
      className={`relative z-0 flex-1 transition-all duration-300 ${
        dimmed ? "pointer-events-none opacity-0 blur-xl" : "opacity-100"
      }`}
    >
      <MapContainer key={mapKey} center={mapCenter} zoom={17} className="h-full w-full" zoomControl={false}>
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
