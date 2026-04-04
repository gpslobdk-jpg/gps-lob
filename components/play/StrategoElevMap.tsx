"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";

import type { Location, StrategoPresenceEntry } from "./types";

export type StrategoBaseMarker = {
  teamCode: "red" | "blue";
  lat: number;
  lng: number;
};

export type StrategoAllyMarker = {
  participantId: string;
  displayName: string;
  glyph: string;
  state: string;
  lat: number | null;
  lng: number | null;
};

type StrategoElevMapProps = {
  playerLocation: Location | null;
  playerName: string;
  selfTeamCode: string | null;
  allyMarkers: StrategoAllyMarker[];
  enemyMarkers: StrategoPresenceEntry[];
  baseMarkers: StrategoBaseMarker[];
  dimmed?: boolean;
  radarAlertActive?: boolean;
  isInSafeZone?: boolean;
  isRadarOffline?: boolean;
};

const DEFAULT_CENTER: [number, number] = [55.6761, 12.5683];
const STRATEGO_SAFE_ZONE_RADIUS_METERS = 30;
const STRATEGO_ENEMY_SIGNAL_PRIMARY_RADIUS_METERS = 38;
const STRATEGO_ENEMY_SIGNAL_SECONDARY_RADIUS_METERS = 26;
const STRATEGO_ENEMY_SIGNAL_TERTIARY_RADIUS_METERS = 18;

type StrategoEnemySignalCloud = {
  key: string;
  teamCode: string;
  lat: number;
  lng: number;
  radius: number;
  weight: number;
  opacity: number;
  fillOpacity: number;
  dashArray?: string;
};

function getTeamHex(teamCode: string | null | undefined) {
  return teamCode === "blue" ? "#38bdf8" : "#f43f5e";
}

function createPlayerIcon(teamCode: string | null) {
  const teamHex = getTeamHex(teamCode);

  return L.divIcon({
    className: "stratego-leaflet-icon",
    html: `
      <div class="stratego-self-marker" style="--stratego-team:${teamHex};">
        <div class="stratego-self-marker__ring"></div>
        <div class="stratego-self-marker__core"></div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function createAllyIcon(teamCode: string | null, glyph: string, dimmed: boolean) {
  const teamHex = getTeamHex(teamCode);
  const opacity = dimmed ? 0.55 : 1;

  return L.divIcon({
    className: "stratego-leaflet-icon",
    html: `
      <div class="stratego-ally-marker" style="--stratego-team:${teamHex};opacity:${opacity};">
        <div class="stratego-ally-marker__glyph">${glyph}</div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function hashSignalSeed(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function offsetLocationByMeters(
  latitude: number,
  longitude: number,
  distanceMeters: number,
  bearingDegrees: number
) {
  const bearingRadians = (bearingDegrees * Math.PI) / 180;
  const latOffset = (distanceMeters * Math.cos(bearingRadians)) / 111320;
  const longitudeScale = Math.max(0.2, Math.cos((latitude * Math.PI) / 180));
  const lngOffset = (distanceMeters * Math.sin(bearingRadians)) / (111320 * longitudeScale);

  return {
    lat: latitude + latOffset,
    lng: longitude + lngOffset,
  };
}

function buildEnemySignalClouds(enemy: StrategoPresenceEntry): StrategoEnemySignalCloud[] {
  if (enemy.lat === null || enemy.lng === null) {
    return [];
  }

  const seed = hashSignalSeed(enemy.participantId);
  const primary = offsetLocationByMeters(enemy.lat, enemy.lng, 12, seed % 360);
  const secondary = offsetLocationByMeters(
    enemy.lat,
    enemy.lng,
    21,
    (seed * 7 + 120) % 360
  );
  const tertiary = offsetLocationByMeters(
    enemy.lat,
    enemy.lng,
    16,
    (seed * 11 + 255) % 360
  );

  return [
    {
      key: `enemy-signal-primary-${enemy.participantId}`,
      teamCode: enemy.teamCode,
      lat: primary.lat,
      lng: primary.lng,
      radius: STRATEGO_ENEMY_SIGNAL_PRIMARY_RADIUS_METERS,
      weight: 1.2,
      opacity: 0.2,
      fillOpacity: 0.12,
      dashArray: "9 10",
    },
    {
      key: `enemy-signal-secondary-${enemy.participantId}`,
      teamCode: enemy.teamCode,
      lat: secondary.lat,
      lng: secondary.lng,
      radius: STRATEGO_ENEMY_SIGNAL_SECONDARY_RADIUS_METERS,
      weight: 1,
      opacity: 0.16,
      fillOpacity: 0.1,
      dashArray: "5 11",
    },
    {
      key: `enemy-signal-tertiary-${enemy.participantId}`,
      teamCode: enemy.teamCode,
      lat: tertiary.lat,
      lng: tertiary.lng,
      radius: STRATEGO_ENEMY_SIGNAL_TERTIARY_RADIUS_METERS,
      weight: 0.9,
      opacity: 0.14,
      fillOpacity: 0.08,
    },
  ];
}

function createBaseIcon(teamCode: "red" | "blue") {
  const teamHex = getTeamHex(teamCode);
  const label = teamCode === "blue" ? "B" : "R";

  return L.divIcon({
    className: "stratego-leaflet-icon",
    html: `
      <div class="stratego-base-marker" style="--stratego-team:${teamHex};">
        <div class="stratego-base-marker__pin">
          <span class="stratego-base-marker__label">${label}</span>
        </div>
      </div>
    `,
    iconSize: [34, 42],
    iconAnchor: [17, 38],
  });
}

function FitStrategoBattlefield({
  playerLocation,
  allyMarkers,
  enemyMarkers,
  baseMarkers,
}: {
  playerLocation: Location | null;
  allyMarkers: StrategoAllyMarker[];
  enemyMarkers: StrategoPresenceEntry[];
  baseMarkers: StrategoBaseMarker[];
}) {
  const map = useMap();
  const hasFittedRef = useRef(false);

  useEffect(() => {
    if (hasFittedRef.current) {
      return;
    }

    const points: [number, number][] = [];

    if (playerLocation) {
      points.push([playerLocation.lat, playerLocation.lng]);
    }

    for (const ally of allyMarkers) {
      if (ally.lat !== null && ally.lng !== null) {
        points.push([ally.lat, ally.lng]);
      }
    }

    for (const enemy of enemyMarkers) {
      if (enemy.lat !== null && enemy.lng !== null) {
        points.push([enemy.lat, enemy.lng]);
      }
    }

    for (const base of baseMarkers) {
      points.push([base.lat, base.lng]);
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
      padding: [42, 42],
      maxZoom: 17,
      animate: true,
    });
    hasFittedRef.current = true;
  }, [allyMarkers, baseMarkers, enemyMarkers, map, playerLocation]);

  return null;
}

export default function StrategoElevMap({
  playerLocation,
  playerName,
  selfTeamCode,
  allyMarkers,
  enemyMarkers,
  baseMarkers,
  dimmed = false,
  radarAlertActive = false,
  isInSafeZone = false,
  isRadarOffline = false,
}: StrategoElevMapProps) {
  const center = useMemo<[number, number]>(() => {
    if (playerLocation) {
      return [playerLocation.lat, playerLocation.lng];
    }

    const firstBase = baseMarkers[0];
    if (firstBase) {
      return [firstBase.lat, firstBase.lng];
    }

    const firstAlly = allyMarkers.find((entry) => entry.lat !== null && entry.lng !== null);
    if (firstAlly && firstAlly.lat !== null && firstAlly.lng !== null) {
      return [firstAlly.lat, firstAlly.lng];
    }

    return DEFAULT_CENTER;
  }, [allyMarkers, baseMarkers, playerLocation]);

  const playerIcon = useMemo(() => createPlayerIcon(selfTeamCode), [selfTeamCode]);
  const baseIcons = useMemo(() => {
    return {
      red: createBaseIcon("red"),
      blue: createBaseIcon("blue"),
    };
  }, []);
  const enemySignalClouds = useMemo(
    () => enemyMarkers.flatMap((enemy) => buildEnemySignalClouds(enemy)),
    [enemyMarkers]
  );

  return (
    <>
      <div
        className={`relative h-full w-full transition duration-300 ${
          dimmed ? "pointer-events-none opacity-55 blur-[2px]" : "opacity-100"
        } ${
          radarAlertActive
            ? "ring-1 ring-rose-300/35 shadow-[0_0_0_1px_rgba(251,113,133,0.14),0_0_44px_rgba(244,63,94,0.18)]"
            : ""
        } ${
          isRadarOffline ? "grayscale-[0.2] saturate-[0.7]" : ""
        }`}
      >
        <MapContainer center={center} zoom={16} className="h-full w-full" zoomControl>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; CARTO'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />

          <FitStrategoBattlefield
            playerLocation={playerLocation}
            allyMarkers={allyMarkers}
            enemyMarkers={enemyMarkers}
            baseMarkers={baseMarkers}
          />

          {baseMarkers.map((base) => (
            <Circle
              key={`safe-zone-${base.teamCode}-${base.lat}-${base.lng}`}
              center={[base.lat, base.lng]}
              radius={STRATEGO_SAFE_ZONE_RADIUS_METERS}
              pathOptions={{
                color: getTeamHex(base.teamCode),
                weight: base.teamCode === selfTeamCode ? 2.2 : 1.5,
                opacity: base.teamCode === selfTeamCode ? 0.65 : 0.42,
                fillColor: getTeamHex(base.teamCode),
                fillOpacity: base.teamCode === selfTeamCode ? 0.16 : 0.1,
                dashArray: "8 8",
              }}
            />
          ))}

          {baseMarkers.map((base) => (
            <Marker
              key={`${base.teamCode}-${base.lat}-${base.lng}`}
              position={[base.lat, base.lng]}
              icon={baseIcons[base.teamCode]}
            >
              <Popup>
                <div className="text-sm text-slate-900">
                  <div className="font-black">{base.teamCode === "red" ? "Hold Rød Base" : "Hold Blå Base"}</div>
                  <div>Sikker zone og genoplivning</div>
                </div>
              </Popup>
            </Marker>
          ))}

          {enemySignalClouds.map((cloud) => (
            <Circle
              key={cloud.key}
              center={[cloud.lat, cloud.lng]}
              radius={cloud.radius}
              pathOptions={{
                color: getTeamHex(cloud.teamCode),
                weight: cloud.weight,
                opacity: dimmed ? cloud.opacity * 0.55 : cloud.opacity,
                fillColor: getTeamHex(cloud.teamCode),
                fillOpacity: dimmed ? cloud.fillOpacity * 0.55 : cloud.fillOpacity,
                dashArray: cloud.dashArray,
              }}
            />
          ))}

          {allyMarkers.map((ally) =>
            ally.lat !== null && ally.lng !== null ? (
              <Marker
                key={`ally-${ally.participantId}`}
                position={[ally.lat, ally.lng]}
                icon={createAllyIcon(selfTeamCode, ally.glyph, ally.state !== "alive")}
              >
                <Popup>
                  <div className="text-sm text-slate-900">
                    <div className="font-black">{ally.displayName}</div>
                    <div>{ally.state === "alive" ? "Klar på slagmarken" : "På vej tilbage til basen"}</div>
                  </div>
                </Popup>
              </Marker>
            ) : null
          )}

          {playerLocation ? (
            <>
              <Circle
                center={[playerLocation.lat, playerLocation.lng]}
                radius={12}
                pathOptions={{
                  color: "#f8fafc",
                  weight: 1.5,
                  fillColor: getTeamHex(selfTeamCode),
                  fillOpacity: 0.08,
                }}
              />
              <Marker position={[playerLocation.lat, playerLocation.lng]} icon={playerIcon}>
                <Popup>
                  <div className="text-sm text-slate-900">
                    <div className="font-black">{playerName || "Du"}</div>
                    <div>Din aktuelle position</div>
                  </div>
                </Popup>
              </Marker>
            </>
          ) : null}
        </MapContainer>

        {isRadarOffline ? (
          <div className="pointer-events-none absolute inset-0 z-[920] flex items-center justify-center bg-[linear-gradient(180deg,rgba(148,163,184,0.08),rgba(15,23,42,0.34))] px-6 backdrop-blur-[2px]">
            <div className="max-w-md rounded-[1.7rem] border border-white/12 bg-slate-950/72 px-5 py-4 text-center shadow-[0_24px_60px_rgba(2,6,23,0.46)]">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-300/72">
                Realtime Afbrudt
              </p>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-100/90 sm:text-base">
                Søger efter netværk... Radaren er midlertidigt blind.
              </p>
            </div>
          </div>
        ) : null}

        <div className="pointer-events-none absolute inset-x-4 bottom-4 z-[900] flex justify-center">
          <div
            className={`rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] shadow-[0_18px_34px_rgba(2,6,23,0.44)] backdrop-blur-xl transition ${
              isRadarOffline
                ? "border border-slate-300/14 bg-slate-700/30 text-slate-100"
                : isInSafeZone
                ? "border border-emerald-300/20 bg-emerald-500/14 text-emerald-100"
                : radarAlertActive
                  ? "border border-rose-300/20 bg-rose-500/14 text-rose-100"
                  : "border border-white/10 bg-slate-950/78 text-white/65"
            }`}
          >
            {isRadarOffline
              ? "Radaren søger efter netværk"
              : isInSafeZone
              ? "Du står i fredszonen"
              : radarAlertActive
                ? "Fjende låst på radaren"
                : "Fjender vises som diffuse signalzoner"}
          </div>
        </div>
      </div>

      <style jsx global>{`
        .stratego-leaflet-icon {
          background: transparent;
          border: 0;
        }

        .stratego-self-marker {
          position: relative;
          width: 28px;
          height: 28px;
        }

        .stratego-self-marker__ring {
          position: absolute;
          inset: 0;
          border-radius: 999px;
          background: color-mix(in srgb, var(--stratego-team) 22%, transparent);
          box-shadow: 0 0 0 8px color-mix(in srgb, var(--stratego-team) 18%, transparent),
            0 0 26px color-mix(in srgb, var(--stratego-team) 70%, transparent);
        }

        .stratego-self-marker__core {
          position: absolute;
          inset: 5px;
          border-radius: 999px;
          border: 2px solid rgba(255, 255, 255, 0.92);
          background: var(--stratego-team);
        }

        .stratego-ally-marker {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.7);
          background: color-mix(in srgb, var(--stratego-team) 58%, #020617);
          box-shadow: 0 0 16px color-mix(in srgb, var(--stratego-team) 48%, transparent);
        }

        .stratego-ally-marker__glyph {
          color: white;
          font-size: 11px;
          font-weight: 800;
          line-height: 1;
        }

        .stratego-base-marker {
          width: 34px;
          height: 42px;
          position: relative;
        }

        .stratego-base-marker__pin {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 18px 18px 18px 0;
          transform: rotate(-45deg);
          background: linear-gradient(
            145deg,
            color-mix(in srgb, var(--stratego-team) 92%, white 8%),
            color-mix(in srgb, var(--stratego-team) 65%, #020617)
          );
          color: white;
          font-size: 14px;
          font-weight: 900;
          box-shadow: 0 12px 28px color-mix(in srgb, var(--stratego-team) 38%, transparent);
        }

        .stratego-base-marker__pin::before {
          content: "";
          position: absolute;
          inset: 8px;
          border-radius: 999px;
          background: rgba(2, 6, 23, 0.28);
        }

        .stratego-base-marker__label {
          position: relative;
          z-index: 1;
          transform: rotate(45deg);
        }
      `}</style>
    </>
  );
}
