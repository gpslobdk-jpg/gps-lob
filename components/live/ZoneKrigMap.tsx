"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { Fragment, useEffect, useRef, useState } from "react";
import { Circle, MapContainer, Marker, TileLayer, useMap } from "react-leaflet";

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

function zoneLabelIcon(zoneIndex: number, teamColor: string | null) {
  const resolvedColor = teamColor ?? "#cbd5e1";
  return L.divIcon({
    className: "",
    html: `<div style="display:flex;align-items:center;justify-content:center;min-width:44px;height:30px;padding:0 10px;background:rgba(2,6,23,0.88);border:1px solid ${resolvedColor};border-radius:999px;font-size:11px;font-weight:900;color:${resolvedColor};text-align:center;white-space:nowrap;backdrop-filter:blur(8px);pointer-events:none;line-height:1;box-shadow:0 0 24px rgba(2,6,23,0.28);">Z${zoneIndex + 1}</div>`,
    iconSize: [44, 30],
    iconAnchor: [22, 15],
  });
}

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

    if (valid.length === 1) {
      map.setView([valid[0].center_lat, valid[0].center_lng], 17, { animate: true });
    } else {
      const bounds = L.latLngBounds(valid.map((z) => [z.center_lat, z.center_lng] as [number, number]));
      map.fitBounds(bounds, { padding: [60, 60], animate: true });
    }

    hasFittedRef.current = true;
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
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapAutoFit zones={zones} />

      {zones.map((zone) => {
        const team = zone.owner_team_id ? teamMap.get(zone.owner_team_id) : null;
        const color = team?.color ?? "#475569";
        const isShielded = Boolean(
          zone.shield_until && new Date(zone.shield_until).getTime() > nowMs
        );
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
            />
            <Marker
              position={[zone.center_lat, zone.center_lng]}
              icon={zoneLabelIcon(zone.zone_index, team?.color ?? null)}
              interactive={false}
            />
          </Fragment>
        );
      })}
    </MapContainer>
  );
}
