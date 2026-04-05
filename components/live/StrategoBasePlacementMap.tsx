"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { MapPinned } from "lucide-react";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";

import { DEFAULT_MAP_CENTER, type BaseLocation } from "@/utils/gpsRuns";

const DEFAULT_MAP_CENTER_TUPLE: [number, number] = [DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng];

function createBaseIcon(teamCode: "red" | "blue") {
  const background = teamCode === "blue" ? "#0ea5e9" : "#f43f5e";
  const label = teamCode === "blue" ? "B" : "R";

  return L.divIcon({
    className: "stratego-base-icon-shell",
    html: `
      <div style="position:relative;width:34px;height:42px;">
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;border-radius:18px 18px 18px 0;transform:rotate(-45deg);background:${background};box-shadow:0 14px 28px ${teamCode === "blue" ? "rgba(14,165,233,0.35)" : "rgba(244,63,94,0.35)"};">
          <span style="transform:rotate(45deg);font-size:14px;font-weight:900;color:white;">${label}</span>
        </div>
      </div>
    `,
    iconSize: [34, 42],
    iconAnchor: [17, 38],
  });
}

function MapViewportSync({
  redBase,
  blueBase,
}: {
  redBase: BaseLocation | null;
  blueBase: BaseLocation | null;
}) {
  const map = useMap();

  useEffect(() => {
    const points = [redBase, blueBase]
      .filter((value): value is BaseLocation => value !== null)
      .map((value) => [value.lat, value.lng] as [number, number]);

    if (points.length === 0) {
      map.setView(DEFAULT_MAP_CENTER_TUPLE, 16, { animate: true });
      return;
    }

    if (points.length === 1) {
      map.setView(points[0] ?? DEFAULT_MAP_CENTER_TUPLE, 17, { animate: true });
      return;
    }

    map.fitBounds(L.latLngBounds(points), {
      padding: [64, 64],
      maxZoom: 17,
      animate: true,
    });
  }, [blueBase, map, redBase]);

  return null;
}

function SetupMapClicks({
  onPick,
}: {
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click: (event) => {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
}

type StrategoBasePlacementMapProps = {
  redBase: BaseLocation | null;
  blueBase: BaseLocation | null;
  onPick: (lat: number, lng: number) => void;
  title?: string;
  description?: string;
  readyLabel?: string;
  pendingLabel?: string;
  className?: string;
  mapHeightClassName?: string;
};

export default function StrategoBasePlacementMap({
  redBase,
  blueBase,
  onPick,
  title = "Baseplacering",
  description = "Klik første gang for rød base og anden gang for blå base. Derefter kan du finjustere ved at vælge farven ovenfor.",
  readyLabel = "Klar",
  pendingLabel = "Afventer 2 klik",
  className = "",
  mapHeightClassName = "h-[24rem] w-full",
}: StrategoBasePlacementMapProps) {
  const redBaseIcon = useMemo(() => createBaseIcon("red"), []);
  const blueBaseIcon = useMemo(() => createBaseIcon("blue"), []);

  return (
    <section
      className={`relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/60 shadow-[0_30px_80px_rgba(2,6,23,0.38)] backdrop-blur-2xl ${className}`}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.26em] text-cyan-300">{title}</p>
          <p className="mt-1 text-sm text-white/55">{description}</p>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/65">
          {redBase && blueBase ? readyLabel : pendingLabel}
        </div>
      </div>

      <div className={mapHeightClassName}>
        <MapContainer center={DEFAULT_MAP_CENTER_TUPLE} zoom={16} className="h-full w-full" zoomControl>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; CARTO'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          <MapViewportSync redBase={redBase} blueBase={blueBase} />
          <SetupMapClicks onPick={onPick} />

          {redBase ? <Marker position={[redBase.lat, redBase.lng]} icon={redBaseIcon} /> : null}
          {blueBase ? <Marker position={[blueBase.lat, blueBase.lng]} icon={blueBaseIcon} /> : null}
        </MapContainer>
      </div>

      {!redBase || !blueBase ? (
        <div className="pointer-events-none absolute bottom-6 left-6 right-6">
          <div className="mx-auto flex max-w-xl items-center gap-3 rounded-[1.4rem] border border-amber-300/20 bg-amber-500/12 px-4 py-3 text-sm text-amber-100 shadow-[0_18px_40px_rgba(245,158,11,0.12)] backdrop-blur-xl">
            <MapPinned className="h-5 w-5 shrink-0" />
            <span>
              {redBase && !blueBase
                ? "Rød base er sat. Klik nu for at placere blå base."
                : "Klik på kortet for at placere rød base først."}
            </span>
          </div>
        </div>
      ) : null}
    </section>
  );
}
