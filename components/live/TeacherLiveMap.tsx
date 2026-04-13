"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { Poppins, Rubik } from "next/font/google";
import { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";

import { escapeHtml, toFiniteNumber } from "@/components/live/liveUtils";
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
};

const LIVE_STATUS_WINDOW_MS = 30_000;

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
        shellClass: "border-emerald-300/40 bg-emerald-500/10 text-emerald-900",
        dotClass: "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.55)]",
        detail: formattedSyncTime
          ? `Sidst synkroniseret ${formattedSyncTime}.`
          : "Live-feedet er forbundet nu.",
      };
    case "recovering":
      return {
        label: "Genopretter live-feed",
        shellClass: "border-amber-300/45 bg-amber-400/12 text-amber-950",
        dotClass: "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]",
        detail: formattedSyncTime
          ? `Viser sidste kendte data fra ${formattedSyncTime}.`
          : "Henter forbindelse og opdateringer igen.",
      };
    default:
      return {
        label: "Kobler på live-feed",
        shellClass: "border-slate-300/50 bg-white/80 text-slate-700",
        dotClass: "bg-slate-400 shadow-[0_0_8px_rgba(148,163,184,0.45)]",
        detail: formattedSyncTime
          ? `Opkobler igen. Sidste synk var ${formattedSyncTime}.`
          : "Venter på første live-forbindelse.",
      };
  }
}

function createStudentIcon(name: string, isLive: boolean) {
  const initial = escapeHtml(name.trim().charAt(0).toUpperCase() || "?");
  const safeName = escapeHtml(name);
  const statusMarkup = isLive
    ? `<span class="absolute inline-flex h-3.5 w-3.5 animate-ping rounded-full bg-orange-400 opacity-75"></span><span class="relative inline-flex h-3 w-3 rounded-full border border-orange-100/80 bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]"></span>`
    : `<span class="relative inline-flex h-3 w-3 rounded-full border border-slate-300/60 bg-slate-400 shadow-[0_0_6px_rgba(100,116,139,0.5)]"></span>`;

  return L.divIcon({
    className: "bg-transparent border-none w-auto",
    html: `<div class="relative flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-800 shadow-md whitespace-nowrap ${isLive ? "" : "opacity-50"}">
      <span class="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-[11px] font-black uppercase text-slate-700 shadow-inner shadow-slate-200">${initial}</span>
      <span class="text-xs font-bold tracking-wide text-slate-800">${safeName}</span>
      <span class="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center">
        ${statusMarkup}
      </span>
    </div>`,
    iconSize: [0, 0],
    iconAnchor: [-8, 12],
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

    if (points.length <= 1) {
      map.setView(mapCenter, 16, { animate: true });
      return;
    }

    map.fitBounds(L.latLngBounds(points), {
      padding: [50, 50],
      animate: true,
    });
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
}: TeacherLiveMapProps) {
  const recentActiveCount = studentLocations.filter((student) => isStudentRecentlyActive(student)).length;
  const staleCount = Math.max(0, studentLocations.length - recentActiveCount);
  const liveFeedIndicator = getLiveFeedIndicatorCopy(liveFeedStatus, liveFeedLastSyncedAt);

  return (
    <div
      className={`relative z-0 h-full w-2/3 overflow-hidden rounded-[2rem] border-4 border-white/20 shadow-2xl ${poppins.className}`}
    >
      <div className="absolute left-6 top-6 z-[1000] rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-xl backdrop-blur-md">
        <h2
          className={`text-xl font-black tracking-widest text-slate-800 uppercase ${rubik.className}`}
        >
          Live Overvågning
        </h2>
        <p className="text-sm text-slate-500">
          {studentLocations.length} deltagere registreret · {recentActiveCount} live nu
        </p>
        <div
          className={`mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] ${liveFeedIndicator.shellClass}`}
        >
          <span className={`h-2.5 w-2.5 rounded-full ${liveFeedIndicator.dotClass}`} />
          <span>{liveFeedIndicator.label}</span>
        </div>
        <p className="mt-2 text-xs text-slate-500">{liveFeedIndicator.detail}</p>
        {staleCount > 0 ? (
          <p className="mt-1 text-xs text-slate-400">
            {staleCount} vises som sidst set, indtil næste ping kommer ind.
          </p>
        ) : null}
        {!hasParticipantsTable ? (
          <p className="mt-1 text-xs text-slate-400">`participants` mangler - bruger fallback.</p>
        ) : null}
        <button
          type="button"
          onClick={() => void onEndRun()}
          disabled={isEndingRun}
          className="mt-4 rounded-xl border border-teal-400/50 bg-teal-600 px-4 py-2 text-xs font-bold tracking-widest text-white uppercase shadow-lg transition-colors hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isEndingRun ? "Afslutter løb..." : "Afslut Løb 🛑"}
        </button>
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
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
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
                icon={createStudentIcon(student.name, isStudentRecentlyActive(student))}
              />
            )
        )}
      </MapContainer>
    </div>
  );
}
