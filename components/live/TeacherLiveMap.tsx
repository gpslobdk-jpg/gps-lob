"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { Poppins, Rubik } from "next/font/google";

import { toFiniteNumber } from "@/components/live/liveUtils";
import type { LiveStudentLocation, RunQuestion } from "@/components/live/types";

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
  hasParticipantsTable: boolean;
  isEndingRun: boolean;
  onEndRun: () => Promise<void>;
};

function createPostIcon(index: number) {
  return L.divIcon({
    className: "bg-transparent border-none",
    html: `<div class="w-8 h-8 rounded-full bg-cyan-950 border-2 border-cyan-400 flex items-center justify-center text-cyan-400 font-bold shadow-[0_0_15px_rgba(34,211,238,0.6)] backdrop-blur-md">${index + 1}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function createStudentIcon(name: string) {
  return L.divIcon({
    className: "bg-transparent border-none w-auto",
    html: `<div class="px-3 py-1.5 rounded-full bg-purple-600 border-2 border-purple-400 text-white text-xs font-bold shadow-[0_0_15px_rgba(168,85,247,0.8)] whitespace-nowrap drop-shadow-lg">${name}</div>`,
    iconSize: [0, 0],
    iconAnchor: [-10, 10],
  });
}

export default function TeacherLiveMap({
  mapCenter,
  mapKey,
  runQuestions,
  studentLocations,
  hasParticipantsTable,
  isEndingRun,
  onEndRun,
}: TeacherLiveMapProps) {
  return (
    <div
      className={`relative z-0 h-full w-2/3 overflow-hidden rounded-[2rem] border-4 border-white/20 shadow-2xl ${poppins.className}`}
    >
      <div className="absolute left-6 top-6 z-[1000] rounded-3xl border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-md">
        <h2
          className={`text-xl font-black tracking-widest text-white drop-shadow-md uppercase ${rubik.className}`}
        >
          Live Overvågning
        </h2>
        <p className="text-sm text-blue-100">{studentLocations.length} deltagere online</p>
        {!hasParticipantsTable ? (
          <p className="mt-1 text-xs text-blue-100">`participants` mangler - bruger fallback.</p>
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
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />

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
                <strong className="text-cyan-400">Post {index + 1}</strong>
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
                icon={createStudentIcon(student.name)}
              />
            )
        )}
      </MapContainer>
    </div>
  );
}
