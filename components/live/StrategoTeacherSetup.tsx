"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { AlertTriangle, Loader2, MapPinned, Shield, Swords, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";

import { createClient } from "@/utils/supabase/client";

type StrategoTeacherSetupProps = {
  sessionId?: string | null;
  joinPin: string;
  students: string[];
  isLoading: boolean;
  onStartSession: () => Promise<void>;
};

type BaseLocation = {
  lat: number;
  lng: number;
};

type StrategoGameRow = {
  red_base_lat?: number | string | null;
  red_base_lng?: number | string | null;
  blue_base_lat?: number | string | null;
  blue_base_lng?: number | string | null;
};

const DEFAULT_MAP_CENTER: [number, number] = [55.6761, 12.5683];

function toFiniteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function createBaseIcon(teamCode: "red" | "blue") {
  const background = teamCode === "blue" ? "#0ea5e9" : "#f43f5e";
  const label = teamCode === "blue" ? "B" : "R";

  return L.divIcon({
    className: "stratego-base-icon-shell",
    html: `
      <div style="position:relative;width:34px;height:42px;">
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;border-radius:18px 18px 18px 0;transform:rotate(-45deg);background:${background};box-shadow:0 14px 28px ${teamCode === "blue" ? "rgba(14,165,233,0.35)" : "rgba(244,63,94,0.35)"};">
          <span style="transform:rotate(45deg);font-size:14px;font-weight:900;color:white;">${label}</span>
        </div>
      </div>
    `,
    iconSize: [34, 42],
    iconAnchor: [17, 38],
  });
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
      map.setView(DEFAULT_MAP_CENTER, 16, { animate: true });
      return;
    }

    if (points.length === 1) {
      map.setView(points[0] ?? DEFAULT_MAP_CENTER, 17, { animate: true });
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

function formatCoordinate(value: number | null) {
  if (value === null) return "Ikke sat";
  return value.toFixed(5);
}

export default function StrategoTeacherSetup({
  sessionId,
  joinPin,
  students,
  isLoading,
  onStartSession,
}: StrategoTeacherSetupProps) {
  const [redBase, setRedBase] = useState<BaseLocation | null>(null);
  const [blueBase, setBlueBase] = useState<BaseLocation | null>(null);
  const [placementMode, setPlacementMode] = useState<"red" | "blue">("red");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const redBaseIcon = useMemo(() => createBaseIcon("red"), []);
  const blueBaseIcon = useMemo(() => createBaseIcon("blue"), []);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    const supabase = createClient();
    let isActive = true;

    const loadSavedBases = async () => {
      const { data, error } = await supabase
        .from("stratego_games")
        .select("red_base_lat,red_base_lng,blue_base_lat,blue_base_lng")
        .eq("session_id", sessionId)
        .maybeSingle<StrategoGameRow>();

      if (!isActive || error || !data) {
        return;
      }

      const nextRedLat = toFiniteNumber(data.red_base_lat);
      const nextRedLng = toFiniteNumber(data.red_base_lng);
      const nextBlueLat = toFiniteNumber(data.blue_base_lat);
      const nextBlueLng = toFiniteNumber(data.blue_base_lng);

      if (nextRedLat !== null && nextRedLng !== null) {
        setRedBase({ lat: nextRedLat, lng: nextRedLng });
      }

      if (nextBlueLat !== null && nextBlueLng !== null) {
        setBlueBase({ lat: nextBlueLat, lng: nextBlueLng });
      }

      if (nextRedLat !== null && nextRedLng !== null && nextBlueLat === null) {
        setPlacementMode("blue");
      }
    };

    void loadSavedBases();

    return () => {
      isActive = false;
    };
  }, [sessionId]);

  const handleMapPick = (lat: number, lng: number) => {
    setSaveError(null);

    if (placementMode === "red" || !redBase) {
      setRedBase({ lat, lng });
      if (!blueBase) {
        setPlacementMode("blue");
      }
      return;
    }

    setBlueBase({ lat, lng });
  };

  const handleStart = async () => {
    if (!sessionId || !redBase || !blueBase || isSaving) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.from("stratego_games").upsert(
        {
          session_id: sessionId,
          red_base_lat: redBase.lat,
          red_base_lng: redBase.lng,
          blue_base_lat: blueBase.lat,
          blue_base_lng: blueBase.lng,
        },
        {
          onConflict: "session_id",
        }
      );

      if (error) {
        throw error;
      }

      await onStartSession();
    } catch (error) {
      console.error("Kunne ikke gemme Stratego-baser:", error);
      setSaveError("Kunne ikke gemme baserne endnu. Prøv igen.");
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
  };

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-4 text-white sm:px-6">
      <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[minmax(22rem,28rem)_minmax(0,1fr)]">
        <section className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-6 shadow-[0_30px_80px_rgba(2,6,23,0.45)] backdrop-blur-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.3em] text-white/65">
            <Swords className="h-4 w-4 text-rose-200" />
            Live Stratego Setup
          </div>

          <div className="mt-5 rounded-[1.6rem] border border-white/10 bg-[linear-gradient(145deg,rgba(15,23,42,0.92),rgba(15,118,110,0.16))] px-5 py-5">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-emerald-200/70">Join PIN</p>
            <p className="mt-3 text-5xl font-black tracking-[0.24em] text-white">{joinPin}</p>
            <p className="mt-3 text-sm leading-6 text-white/65">
              Lad eleverne joine, placér derefter rød base og blå base på kortet, og start spillet.
            </p>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPlacementMode("red")}
              className={`rounded-[1.3rem] border px-4 py-4 text-left transition ${
                placementMode === "red"
                  ? "border-rose-300/30 bg-rose-500/12 text-rose-100"
                  : "border-white/10 bg-white/6 text-white/70 hover:bg-white/10"
              }`}
            >
              <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Næste klik</p>
              <p className="mt-2 text-lg font-black">Hold Rød Base</p>
            </button>
            <button
              type="button"
              onClick={() => setPlacementMode("blue")}
              className={`rounded-[1.3rem] border px-4 py-4 text-left transition ${
                placementMode === "blue"
                  ? "border-sky-300/30 bg-sky-500/12 text-sky-100"
                  : "border-white/10 bg-white/6 text-white/70 hover:bg-white/10"
              }`}
            >
              <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Næste klik</p>
              <p className="mt-2 text-lg font-black">Hold Blå Base</p>
            </button>
          </div>

          <div className="mt-5 space-y-3">
            <div className="rounded-[1.3rem] border border-white/10 bg-white/6 px-4 py-4">
              <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Rød base</p>
              <p className="mt-2 text-sm font-semibold text-white/88">
                {formatCoordinate(redBase?.lat ?? null)} / {formatCoordinate(redBase?.lng ?? null)}
              </p>
            </div>
            <div className="rounded-[1.3rem] border border-white/10 bg-white/6 px-4 py-4">
              <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Blå base</p>
              <p className="mt-2 text-sm font-semibold text-white/88">
                {formatCoordinate(blueBase?.lat ?? null)} / {formatCoordinate(blueBase?.lng ?? null)}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-[1.3rem] border border-white/10 bg-white/6 px-4 py-4">
            <div className="flex items-center gap-2 text-white">
              <Users className="h-4 w-4 text-cyan-300" />
              <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Deltagere klar</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {students.length > 0 ? (
                students.map((student) => (
                  <span
                    key={student}
                    className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1.5 text-sm font-semibold text-white/82"
                  >
                    {student}
                  </span>
                ))
              ) : (
                <p className="text-sm text-white/55">{isLoading ? "Henter deltagere..." : "Ingen deltagere har joinet endnu."}</p>
              )}
            </div>
          </div>

          {saveError ? (
            <div className="mt-5 rounded-[1.3rem] border border-rose-300/25 bg-rose-500/12 px-4 py-3 text-sm text-rose-100">
              {saveError}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => void handleStart()}
            disabled={!redBase || !blueBase || isSaving}
            className="mt-6 inline-flex min-h-[58px] w-full items-center justify-center gap-2 rounded-[1.5rem] bg-emerald-500 px-5 py-4 text-sm font-black uppercase tracking-[0.24em] text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-white/45"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Gemmer og starter...
              </>
            ) : (
              <>
                <Shield className="h-5 w-5" />
                Start Live Stratego
              </>
            )}
          </button>
        </section>

        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/60 shadow-[0_30px_80px_rgba(2,6,23,0.38)] backdrop-blur-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.26em] text-cyan-300">Baseplacering</p>
              <p className="mt-1 text-sm text-white/55">Klik første gang for rød base og anden gang for blå base. Derefter kan du finjustere ved at vælge farven ovenfor.</p>
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/65">
              {redBase && blueBase ? "Klar til start" : "Afventer 2 klik"}
            </div>
          </div>

          <div className="h-[calc(100svh-2rem)] min-h-[42rem] w-full lg:h-[calc(100svh-2rem)]">
            <MapContainer center={DEFAULT_MAP_CENTER} zoom={16} className="h-full w-full" zoomControl>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; CARTO'
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              />
              <MapViewportSync redBase={redBase} blueBase={blueBase} />
              <SetupMapClicks onPick={handleMapPick} />

              {redBase ? <Marker position={[redBase.lat, redBase.lng]} icon={redBaseIcon} /> : null}
              {blueBase ? <Marker position={[blueBase.lat, blueBase.lng]} icon={blueBaseIcon} /> : null}
            </MapContainer>
          </div>

          {!redBase || !blueBase ? (
            <div className="pointer-events-none absolute bottom-6 left-6 right-6">
              <div className="mx-auto flex max-w-xl items-center gap-3 rounded-[1.4rem] border border-amber-300/20 bg-amber-500/12 px-4 py-3 text-sm text-amber-100 shadow-[0_18px_40px_rgba(245,158,11,0.12)] backdrop-blur-xl">
                <MapPinned className="h-5 w-5 shrink-0" />
                <span>
                  {redBase && !blueBase
                    ? "Rød base er sat. Klik nu for at placere blå base."
                    : "Klik på kortet for at placere rød base først."}
                </span>
              </div>
            </div>
          ) : null}

          {!sessionId ? (
            <div className="pointer-events-none absolute inset-x-6 top-6">
              <div className="flex items-center gap-3 rounded-[1.4rem] border border-rose-300/20 bg-rose-500/12 px-4 py-3 text-sm text-rose-100 shadow-[0_18px_40px_rgba(244,63,94,0.12)] backdrop-blur-xl">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <span>Session-id mangler. Åbn live-sessionen igen fra dashboardet.</span>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
