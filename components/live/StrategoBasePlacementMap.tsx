"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { MapPinned } from "lucide-react";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";

import { DEFAULT_MAP_CENTER, type BaseLocation } from "@/utils/gpsRuns";

const DEFAULT_MAP_CENTER_TUPLE: [number, number] = [DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng];
const GEOLOCATION_ZOOM = 17;

function createBaseIcon(teamCode: "red" | "blue") {
  const background = teamCode === "blue" ? "#0ea5e9" : "#f43f5e";
  const label = teamCode === "blue" ? "B" : "R";
  const teamName = teamCode === "blue" ? "Blå" : "Rød";

  return L.divIcon({
    className: "stratego-base-icon-shell",
    html: `
      <div style="position:relative;width:76px;height:92px;display:flex;align-items:flex-start;justify-content:center;pointer-events:auto;cursor:grab;touch-action:none;">
        <div style="position:absolute;left:50%;top:0;transform:translateX(-50%);width:68px;height:68px;border-radius:9999px;background:${teamCode === "blue" ? "rgba(14,165,233,0.2)" : "rgba(244,63,94,0.2)"};filter:blur(1px);"></div>
        <div style="position:absolute;left:50%;top:8px;display:flex;align-items:center;justify-content:center;width:50px;height:50px;border:3px solid rgba(255,255,255,0.92);border-radius:18px 18px 18px 0;transform:translateX(-50%) rotate(-45deg);background:${background};box-shadow:0 18px 34px ${teamCode === "blue" ? "rgba(14,165,233,0.42)" : "rgba(244,63,94,0.42)"};">
          <span style="transform:rotate(45deg);font-size:20px;font-weight:900;line-height:1;color:white;">${label}</span>
        </div>
        <div style="position:absolute;left:50%;bottom:8px;transform:translateX(-50%);padding:6px 12px;border-radius:9999px;background:rgba(15,23,42,0.84);border:1px solid rgba(255,255,255,0.16);box-shadow:0 12px 24px rgba(15,23,42,0.32);font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;white-space:nowrap;color:white;">${teamName} base</div>
      </div>
    `,
    iconSize: [76, 92],
    iconAnchor: [38, 58],
  });
}

function AutoLocate() {
  const map = useMap();

  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        map.setView(
          [position.coords.latitude, position.coords.longitude],
          GEOLOCATION_ZOOM,
          { animate: true }
        );
      },
      () => {
        // Geolocation denied or unavailable — keep default center
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  }, [map]);

  return null;
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
  onBaseMove?: (teamCode: "red" | "blue", lat: number, lng: number) => void;
  title?: string;
  description?: string;
  readyLabel?: string;
  pendingLabel?: string;
  className?: string;
  mapHeightClassName?: string;
  hideInstructionOverlay?: boolean;
};

export default function StrategoBasePlacementMap({
  redBase,
  blueBase,
  onPick,
  onBaseMove,
  title = "Baseplacering",
  description = "Klik for at placere rød og blå base. Træk derefter markørerne for at finjustere placeringen.",
  readyLabel = "Klar",
  pendingLabel = "Afventer 2 klik",
  className = "",
  mapHeightClassName = "h-[24rem] w-full",
  hideInstructionOverlay = false,
}: StrategoBasePlacementMapProps) {
  const redBaseIcon = useMemo(() => createBaseIcon("red"), []);
  const blueBaseIcon = useMemo(() => createBaseIcon("blue"), []);

  return (
    <section
      className={`relative overflow-hidden rounded-4xl border border-white/10 bg-slate-900/60 shadow-[0_30px_80px_rgba(2,6,23,0.38)] backdrop-blur-2xl ${className}`}
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
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <AutoLocate />
          <MapViewportSync redBase={redBase} blueBase={blueBase} />
          <SetupMapClicks onPick={onPick} />

          {redBase ? (
            <Marker
              position={[redBase.lat, redBase.lng]}
              icon={redBaseIcon}
              draggable
              autoPan
              title="Rød base. Træk for at finjustere placeringen."
              eventHandlers={{
                dragend: (event: L.LeafletEvent) => {
                  const nextLatLng = (event.target as L.Marker).getLatLng();
                  onBaseMove?.("red", nextLatLng.lat, nextLatLng.lng);
                },
              }}
            />
          ) : null}
          {blueBase ? (
            <Marker
              position={[blueBase.lat, blueBase.lng]}
              icon={blueBaseIcon}
              draggable
              autoPan
              title="Blå base. Træk for at finjustere placeringen."
              eventHandlers={{
                dragend: (event: L.LeafletEvent) => {
                  const nextLatLng = (event.target as L.Marker).getLatLng();
                  onBaseMove?.("blue", nextLatLng.lat, nextLatLng.lng);
                },
              }}
            />
          ) : null}
        </MapContainer>
      </div>

      {!hideInstructionOverlay && (!redBase || !blueBase) ? (
        <div className="pointer-events-none absolute bottom-6 left-6 right-6">
          <div className="mx-auto flex max-w-xl items-center gap-3 rounded-[1.4rem] border border-amber-300/20 bg-amber-500/12 px-4 py-3 text-sm text-amber-100 shadow-[0_18px_40px_rgba(245,158,11,0.12)] backdrop-blur-xl">
            <MapPinned className="h-5 w-5 shrink-0" />
            <span>
              {redBase && !blueBase
                ? "Rød base er sat. Klik nu for at placere blå base, eller træk rød base for at finjustere."
                : "Klik på kortet for at placere rød base først. Når en markør er sat, kan den trækkes."}
            </span>
          </div>
        </div>
      ) : null}
    </section>
  );
}
