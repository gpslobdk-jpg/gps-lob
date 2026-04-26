"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { Poppins, Rubik } from "next/font/google";
import { useEffect, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";

import { escapeHtml, toFiniteNumber } from "@/components/live/liveUtils";
import { getStudentInitials } from "@/components/live/liveDashboardUtils";
import type {
  LiveStudentLocation,
  RunQuestion,
  TeacherLiveFeedStatus,
} from "@/components/live/types";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

type TeacherLiveMapProps = {
  mapCenter: [number, number];
  mapKey: string;
  runQuestions: RunQuestion[];
  studentLocations: LiveStudentLocation[];
  liveFeedStatus: TeacherLiveFeedStatus;
  liveFeedLastSyncedAt: string | null;
  hasParticipantsTable: boolean;
  isEndingRun: boolean;
  onEndRun: () => Promise<void>;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
};

const LIVE_STATUS_WINDOW_MS = 30_000;

const TILE_LAYERS = {
  default: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap &copy; CARTO",
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "&copy; Esri",
  },
} as const;

type TileLayerKey = keyof typeof TILE_LAYERS;

function createPostIcon(index: number) {
  return L.divIcon({
    className: "bg-transparent border-none",
    html: `<div class="w-8 h-8 rounded-md bg-blue-800 flex items-center justify-center text-white font-bold text-sm shadow-md border border-blue-600">${index + 1}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function isStudentRecentlyActive(student: LiveStudentLocation) {
  if (!student.updated_at) return true;

  const lastPing = new Date(student.updated_at).getTime();
  if (!Number.isFinite(lastPing)) return true;

  return Date.now() - lastPing < LIVE_STATUS_WINDOW_MS;
}

function getMapPoints(
  runQuestions: RunQuestion[],
  studentLocations: LiveStudentLocation[]
): [number, number][] {
  const questionPoints = runQuestions
    .map((question) => {
      const lat = toFiniteNumber(question.lat);
      const lng = toFiniteNumber(question.lng);
      return lat === null || lng === null ? null : ([lat, lng] as [number, number]);
    })
    .filter((point): point is [number, number] => point !== null);

  const studentPoints = studentLocations
    .map((student) =>
      student.lat === null || student.lng === null ? null : ([student.lat, student.lng] as [number, number])
    )
    .filter((point): point is [number, number] => point !== null);

  return [...questionPoints, ...studentPoints];
}

function formatLiveFeedTimestamp(timestamp: string | null) {
  if (!timestamp) {
    return null;
  }

  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleTimeString("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getLiveFeedIndicatorCopy(
  status: TeacherLiveFeedStatus,
  lastSyncedAt: string | null
) {
  const formattedSyncTime = formatLiveFeedTimestamp(lastSyncedAt);

  switch (status) {
    case "live":
      return {
        label: "Live-feed aktiv",
        shellClass: "border-emerald-400/25 bg-emerald-500/15 text-emerald-200",
        dotClass: "bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.55)]",
        detail: formattedSyncTime
          ? `Sidst synkroniseret ${formattedSyncTime}.`
          : "Live-feedet er forbundet nu.",
      };
    case "recovering":
      return {
        label: "Genopretter live-feed",
        shellClass: "border-amber-400/25 bg-amber-500/15 text-amber-200",
        dotClass: "bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.5)]",
        detail: formattedSyncTime
          ? `Viser sidste kendte data fra ${formattedSyncTime}.`
          : "Henter forbindelse og opdateringer igen.",
      };
    default:
      return {
        label: "Kobler på live-feed",
        shellClass: "border-white/15 bg-white/10 text-slate-300",
        dotClass: "bg-slate-400 shadow-[0_0_8px_rgba(148,163,184,0.35)]",
        detail: formattedSyncTime
          ? `Opkobler igen. Sidste synk var ${formattedSyncTime}.`
          : "Venter på første live-forbindelse.",
      };
  }
}

const MARKER_COLORS = [
  "#10b981", "#f59e0b", "#3b82f6", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#06b6d4", "#84cc16",
  "#6366f1", "#d946ef", "#0ea5e9", "#22c55e", "#e11d48",
];

function getMarkerColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return MARKER_COLORS[Math.abs(hash) % MARKER_COLORS.length];
}

function createStudentIcon(id: string, name: string, isLive: boolean) {
  const initials = escapeHtml(getStudentInitials(name));
  const bgColor = getMarkerColor(id);
  const statusDotColor = isLive ? "#22c55e" : "#ef4444";
  const statusGlow = isLive
    ? "box-shadow:0 0 6px 2px rgba(34,197,94,0.6)"
    : "box-shadow:0 0 4px 1px rgba(239,68,68,0.5)";
  const opacityStyle = isLive ? "" : "opacity:0.55;";

  return L.divIcon({
    className: "bg-transparent border-none",
    html: `<div style="position:relative;width:40px;height:40px;${opacityStyle}">
      <div style="width:40px;height:40px;border-radius:50%;background:${bgColor};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:12px;letter-spacing:0.04em;border:2.5px solid rgba(255,255,255,0.85);box-shadow:0 2px 10px rgba(0,0,0,0.25);font-family:inherit;">${initials}</div>
      <span style="position:absolute;bottom:-2px;right:-2px;width:12px;height:12px;border-radius:50%;background:${statusDotColor};border:2px solid #fff;${statusGlow}"></span>
    </div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

function MapController({
  mapCenter,
  runQuestions,
  studentLocations,
}: {
  mapCenter: [number, number];
  runQuestions: RunQuestion[];
  studentLocations: LiveStudentLocation[];
}) {
  const map = useMap();

  useEffect(() => {
    const points = getMapPoints(runQuestions, studentLocations);

    try {
      if (!map || !map.getContainer()) return;

      if (points.length <= 1) {
        map.setView(mapCenter, 16, { animate: true });
        return;
      }

      map.fitBounds(L.latLngBounds(points), {
        padding: [50, 50],
        animate: true,
      });
    } catch (err) {
      console.warn("MapController: failed to update viewport:", err);
    }
  }, [map, mapCenter, runQuestions, studentLocations]);

  return null;
}

export default function TeacherLiveMap({
  mapCenter,
  mapKey,
  runQuestions,
  studentLocations,
  liveFeedStatus,
  liveFeedLastSyncedAt,
  hasParticipantsTable,
  isEndingRun,
  onEndRun,
  sidebarCollapsed,
  onToggleSidebar,
}: TeacherLiveMapProps) {
  const recentActiveCount = studentLocations.filter((student) => isStudentRecentlyActive(student)).length;
  const staleCount = Math.max(0, studentLocations.length - recentActiveCount);
  const liveFeedIndicator = getLiveFeedIndicatorCopy(liveFeedStatus, liveFeedLastSyncedAt);

  const [mapStyle, setMapStyle] = useState<TileLayerKey>("default");
  const [isLoadingTiles, setIsLoadingTiles] = useState(false);

  return (
    <div
      className={`relative z-0 h-full overflow-hidden rounded-4xl border border-white/15 shadow-2xl transition-all duration-500 ease-in-out ${
        sidebarCollapsed ? "w-full" : "w-2/3"
      } ${poppins.className}`}
    >
      {/* Nature-Glass info overlay */}
      <div className="absolute left-5 top-5 z-1000 max-w-xs rounded-2xl border border-white/20 bg-slate-900/60 p-5 shadow-[0_16px_48px_rgba(0,0,0,0.3)] backdrop-blur-xl">
        <h2
          className={`text-lg font-black tracking-widest text-white/90 uppercase ${rubik.className}`}
        >
          Live Overvågning
        </h2>
        <p className="mt-1 text-sm text-white/50">
          {studentLocations.length} deltagere · {recentActiveCount} live
        </p>
        <div
          className={`mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] ${liveFeedIndicator.shellClass}`}
        >
          <span className={`h-2.5 w-2.5 rounded-full ${liveFeedIndicator.dotClass}`} />
          <span>{liveFeedIndicator.label}</span>
        </div>
        <p className="mt-2 text-[11px] text-white/40">{liveFeedIndicator.detail}</p>
        {staleCount > 0 ? (
          <p className="mt-1 text-[11px] text-white/30">
            {staleCount} sidst set — venter på ping.
          </p>
        ) : null}
        {!hasParticipantsTable ? (
          <p className="mt-1 text-[11px] text-white/30">`participants` mangler — fallback.</p>
        ) : null}
        <button
          type="button"
          onClick={() => void onEndRun()}
          disabled={isEndingRun}
          className="mt-4 rounded-xl border border-red-400/30 bg-red-500/80 px-4 py-2 text-xs font-bold tracking-widest text-white uppercase shadow-lg backdrop-blur-sm transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isEndingRun ? "Afslutter løb..." : "Afslut Løb 🛑"}
        </button>
      </div>

      {/* Focus toggle button */}
      <button
        type="button"
        onClick={onToggleSidebar}
        className="absolute right-5 top-5 z-1000 inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-slate-900/60 px-4 py-3 text-sm font-semibold text-white/90 shadow-[0_8px_24px_rgba(0,0,0,0.25)] backdrop-blur-xl transition-all hover:bg-slate-900/80"
        title={sidebarCollapsed ? "Vis sidepanel" : "Skjul sidepanel – fuld fokus"}
      >
        {sidebarCollapsed ? (
          <><PanelRightOpen className="h-4 w-4" /> Panel</>
        ) : (
          <><PanelRightClose className="h-4 w-4" /> Fokus</>
        )}
      </button>
      
      {isLoadingTiles && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1100] bg-black/70 text-white px-3 py-1 rounded-lg text-sm">
          Indlæser kort…
        </div>
      )}

      <div className="absolute bottom-4 left-4 z-[1000]">
        <select
          value={mapStyle}
          onChange={(e) => {
            setIsLoadingTiles(true);
            setMapStyle(e.target.value as TileLayerKey);
          }}
          className="rounded-xl border border-slate-200/80 bg-white/95 px-3 py-2 text-sm font-semibold text-slate-900 shadow-lg backdrop-blur"
          aria-label="Vælg korttype"
        >
          <option value="default">🗺 Kort</option>
          <option value="satellite">🛰 Satellit</option>
        </select>
      </div>

      <MapContainer
        key={mapKey}
        center={mapCenter}
        zoom={16}
        className="z-0 h-full w-full"
        zoomControl={false}
      >
        <MapController
          mapCenter={mapCenter}
          runQuestions={runQuestions}
          studentLocations={studentLocations}
        />
        <TileLayer
          url={TILE_LAYERS[mapStyle].url}
          attribution={TILE_LAYERS[mapStyle].attribution}
          updateWhenIdle={true}
          eventHandlers={{
            loading: () => setIsLoadingTiles(true),
            load: () => setIsLoadingTiles(false),
          }}
        />

        {runQuestions.map((question, index) => {
          const lat = toFiniteNumber(question.lat);
          const lng = toFiniteNumber(question.lng);
          if (lat === null || lng === null) return null;

          return (
            <Marker
              key={`post-${index}`}
              position={[lat, lng]}
              icon={createPostIcon(index)}
            >
              <Popup>
                <strong className="text-blue-800">Post {index + 1}</strong>
                <br />
                {question.text}
              </Popup>
            </Marker>
          );
        })}

        {studentLocations.map(
          (student) =>
            student.lat !== null &&
            student.lng !== null && (
              <Marker
                key={student.id}
                position={[student.lat, student.lng]}
                icon={createStudentIcon(student.id, student.name, isStudentRecentlyActive(student))}
              />
            )
        )}
      </MapContainer>
    </div>
  );
}
