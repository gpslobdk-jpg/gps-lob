"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { Fragment, useEffect, useRef } from "react";
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

const DEFAULT_CENTER: [number, number] = [55.3959, 10.3883];

type ZoneKrigMapProps = {
  center: [number, number];
  zones: GameZone[];
  teams: GameTeam[];
};

function zoneLabelIcon(zoneIndex: number, teamName: string | null) {
  const label = `Z${zoneIndex + 1}${teamName ? `<br/><span style="font-size:9px;opacity:0.8;">${teamName}</span>` : ""}`;
  return L.divIcon({
    className: "",
    html: `<div style="background:rgba(2,6,23,0.85);border:1px solid rgba(255,255,255,0.18);border-radius:0.6rem;padding:3px 8px;font-size:11px;font-weight:800;color:#e2e8f0;text-align:center;white-space:nowrap;backdrop-filter:blur(8px);pointer-events:none;line-height:1.4;">${label}</div>`,
    iconSize: [70, 36],
    iconAnchor: [35, 18],
  });
}

function MapAutoFit({ zones }: { zones: GameZone[] }) {
  const map = useMap();
  const hasFittedRef = useRef(false);

  useEffect(() => {
    if (hasFittedRef.current) return;
    const valid = zones.filter((z) => z.center_lat && z.center_lng);
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
  const now = new Date();

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
        const isShielded = Boolean(zone.shield_until && new Date(zone.shield_until) > now);
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
              icon={zoneLabelIcon(zone.zone_index, team?.team_name ?? null)}
              interactive={false}
            />
          </Fragment>
        );
      })}
    </MapContainer>
  );
}
