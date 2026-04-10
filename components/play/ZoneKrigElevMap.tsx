"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";

import GlidingPlayerMarker from "./GlidingPlayerMarker";
import { createZoneKrigMarkerIcon } from "@/components/play/zoneMarkerHelper";
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
        const isShielded = Boolean(zone.shield_until && new Date(zone.shield_until).getTime() > nowMs);
        return (
          <Marker
            key={`${zone.id}-label`}
            position={[zone.center_lat, zone.center_lng]}
            icon={createZoneKrigMarkerIcon({
              state: isSelected ? "selected" : owner ? "owner" : "neutral",
              teamColor: owner?.color ?? null,
              label: `Z${zone.zone_index + 1}`,
              isShielded,
            })}
            eventHandlers={{
              click: () => onSelectZone(zone.zone_index),
            }}
          />
        );
      })}

      {playerLocation ? (
        <GlidingPlayerMarker location={playerLocation} popupContent="Du er her" />
      ) : null}
    </MapContainer>
  );
}