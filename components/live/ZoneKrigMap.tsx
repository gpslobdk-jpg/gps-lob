"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { Fragment, useEffect, useRef, useState } from "react";
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";

import { createZoneKrigMarkerIcon } from "@/components/play/zoneMarkerHelper";
import { formatZoneKrigShieldCountdown } from "@/utils/zoneKrigShield";

export type GameTeam = {
  id: string;
  session_id: string;
  team_name: string;
  color: string;
  score: number;
};

export type GameZone = {
  id: string;
  session_id: string;
  zone_index: number;
  center_lat: number;
  center_lng: number;
  radius_m: number;
  owner_team_id: string | null;
  shield_until: string | null;
};

type ZoneKrigMapProps = {
  center: [number, number];
  zones: GameZone[];
  teams: GameTeam[];
};

function MapAutoFit({ zones }: { zones: GameZone[] }) {
  const map = useMap();
  const hasFittedRef = useRef(false);

  useEffect(() => {
    if (hasFittedRef.current) return;
    const valid = zones.filter(
      (z) =>
        typeof z.center_lat === "number" &&
        typeof z.center_lng === "number" &&
        Number.isFinite(z.center_lat) &&
        Number.isFinite(z.center_lng) &&
        z.center_lat !== 0 &&
        z.center_lng !== 0
    );
    if (valid.length === 0) return;
    try {
      if (!map || !map.getContainer()) return;

      if (valid.length === 1) {
        map.setView([valid[0].center_lat, valid[0].center_lng], 17, { animate: true });
      } else {
        const bounds = L.latLngBounds(valid.map((z) => [z.center_lat, z.center_lng] as [number, number]));
        map.fitBounds(bounds, { padding: [60, 60], animate: true });
      }

      hasFittedRef.current = true;
    } catch (err) {
      console.warn("ZoneKrigMap: failed to auto-fit map view:", err);
    }
  }, [map, zones]);

  return null;
}

export default function ZoneKrigMap({ center, zones, teams }: ZoneKrigMapProps) {
  const teamMap = new Map(teams.map((t) => [t.id, t]));
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
    <MapContainer
      center={center}
      zoom={16}
      className="h-full w-full"
      zoomControl
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />

      <MapAutoFit zones={zones} />

      {zones.map((zone) => {
        const team = zone.owner_team_id ? teamMap.get(zone.owner_team_id) : null;
        const color = team?.color ?? "#475569";
        const shieldCountdown = team ? formatZoneKrigShieldCountdown(zone.shield_until, nowMs) : null;
        const isShielded = Boolean(shieldCountdown);
        const fillOpacity = team ? (isShielded ? 0.38 : 0.22) : 0.07;

        return (
          <Fragment key={zone.id}>
            <Circle
              center={[zone.center_lat, zone.center_lng]}
              radius={zone.radius_m}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity,
                weight: isShielded ? 3 : 2,
                dashArray: isShielded ? "7 5" : undefined,
              }}
            >
              <Popup>
                <div className="text-sm text-slate-900">
                  <div className="font-black">Zone {zone.zone_index + 1}</div>
                  <div>{team ? `Ejes af ${team.team_name}` : "Neutral zone"}</div>
                  {shieldCountdown ? <div>Skjold: {shieldCountdown}</div> : null}
                </div>
              </Popup>
            </Circle>
            <Marker
              position={[zone.center_lat, zone.center_lng]}
              icon={createZoneKrigMarkerIcon({
                state: team ? "owner" : "neutral",
                teamColor: team?.color ?? null,
                label: `Z${zone.zone_index + 1}`,
                isShielded,
              })}
              interactive={false}
            />
          </Fragment>
        );
      })}
    </MapContainer>
  );
}
