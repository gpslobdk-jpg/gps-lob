"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";

import type { Location } from "./types";

export type ZoneKrigGameTeam = {
  id: string;
  team_name: string;
  color: string;
  score: number;
};

export type ZoneKrigGameZone = {
  id: string;
  session_id: string;
  zone_index: number;
  center_lat: number;
  center_lng: number;
  radius_m: number;
  owner_team_id: string | null;
  shield_until: string | null;
};

type ZoneKrigElevMapProps = {
  center: [number, number];
  zones: ZoneKrigGameZone[];
  teams: ZoneKrigGameTeam[];
  playerLocation: Location | null;
  selectedZoneIndex: number;
  onSelectZone: (index: number) => void;
};

const DEFAULT_CENTER: [number, number] = [55.6761, 12.5683];

function zoneColor(teamColor: string | null) {
  return teamColor ?? "#475569";
}

function zoneLabelIcon(zoneIndex: number, labelColor: string, isSelected: boolean) {
  return L.divIcon({
    className: "",
    html: `<div style="background:${isSelected ? "rgba(15,23,42,0.96)" : "rgba(15,23,42,0.82)"};border:1px solid ${isSelected ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.18)"};border-radius:999px;padding:4px 10px;font-size:11px;font-weight:800;color:${labelColor};text-align:center;white-space:nowrap;backdrop-filter:blur(10px);box-shadow:${isSelected ? "0 0 24px rgba(255,255,255,0.18)" : "none"};">Z${zoneIndex + 1}</div>`,
    iconSize: [52, 28],
    iconAnchor: [26, 14],
  });
}

function playerIcon() {
  return L.divIcon({
    className: "",
    html: '<div style="height:18px;width:18px;border-radius:999px;border:2px solid rgba(255,255,255,0.95);background:#10b981;box-shadow:0 0 0 6px rgba(16,185,129,0.18),0 0 18px rgba(16,185,129,0.6);"></div>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function FitBattlefield({
  zones,
  playerLocation,
}: {
  zones: ZoneKrigGameZone[];
  playerLocation: Location | null;
}) {
  const map = useMap();
  const hasFittedRef = useRef(false);

  useEffect(() => {
    if (hasFittedRef.current) {
      return;
    }

    const points = zones
      .filter(
        (zone) =>
          Number.isFinite(zone.center_lat) &&
          Number.isFinite(zone.center_lng) &&
          zone.center_lat !== 0 &&
          zone.center_lng !== 0
      )
      .map((zone) => [zone.center_lat, zone.center_lng] as [number, number]);

    if (playerLocation) {
      points.push([playerLocation.lat, playerLocation.lng]);
    }

    if (points.length === 0) {
      return;
    }

    if (points.length === 1) {
      map.setView(points[0] ?? DEFAULT_CENTER, 17, { animate: true });
      hasFittedRef.current = true;
      return;
    }

    map.fitBounds(L.latLngBounds(points), {
      padding: [48, 48],
      maxZoom: 17,
      animate: true,
    });
    hasFittedRef.current = true;
  }, [map, playerLocation, zones]);

  return null;
}

export default function ZoneKrigElevMap({
  center,
  zones,
  teams,
  playerLocation,
  selectedZoneIndex,
  onSelectZone,
}: ZoneKrigElevMapProps) {
  const teamMap = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const playerMarkerIcon = useMemo(() => playerIcon(), []);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <MapContainer center={center} zoom={16} className="h-full w-full" zoomControl>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <FitBattlefield zones={zones} playerLocation={playerLocation} />

      {zones.map((zone) => {
        const owner = zone.owner_team_id ? teamMap.get(zone.owner_team_id) ?? null : null;
        const color = zoneColor(owner?.color ?? null);
        const isSelected = zone.zone_index === selectedZoneIndex;
        const isShielded = Boolean(zone.shield_until && new Date(zone.shield_until).getTime() > nowMs);

        return (
          <Circle
            key={zone.id}
            center={[zone.center_lat, zone.center_lng]}
            radius={zone.radius_m}
            eventHandlers={{
              click: () => onSelectZone(zone.zone_index),
            }}
            pathOptions={{
              color: isSelected ? "#f8fafc" : color,
              fillColor: color,
              fillOpacity: owner ? (isSelected ? 0.34 : 0.24) : isSelected ? 0.18 : 0.08,
              weight: isSelected ? 4 : isShielded ? 3 : 2,
              dashArray: isShielded ? "7 5" : undefined,
            }}
          >
            <Popup>
              <div className="text-sm text-slate-900">
                <div className="font-black">Zone {zone.zone_index + 1}</div>
                <div>{owner ? `Ejes af ${owner.team_name}` : "Neutral zone"}</div>
                <div>Radius: {zone.radius_m} m</div>
              </div>
            </Popup>
          </Circle>
        );
      })}

      {zones.map((zone) => {
        const owner = zone.owner_team_id ? teamMap.get(zone.owner_team_id) ?? null : null;
        const isSelected = zone.zone_index === selectedZoneIndex;
        return (
          <Marker
            key={`${zone.id}-label`}
            position={[zone.center_lat, zone.center_lng]}
            icon={zoneLabelIcon(zone.zone_index, owner?.color ?? "#e2e8f0", isSelected)}
            eventHandlers={{
              click: () => onSelectZone(zone.zone_index),
            }}
          />
        );
      })}

      {playerLocation ? (
        <Marker position={[playerLocation.lat, playerLocation.lng]} icon={playerMarkerIcon}>
          <Popup>Du er her</Popup>
        </Marker>
      ) : null}
    </MapContainer>
  );
}