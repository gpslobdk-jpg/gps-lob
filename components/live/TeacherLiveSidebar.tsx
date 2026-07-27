"use client";

import { Poppins, Rubik } from "next/font/google";
import { QrCode } from "lucide-react";
import { type FormEvent } from "react";

import LiveRouteOverview from "@/components/live/LiveRouteOverview";
import type {
  LiveModuleId,
  LiveStudentLocation,
  TeacherLiveRouteParticipant,
} from "@/components/live/types";
import type { ActivePostOrderMode } from "@/lib/routes/postOrderPolicy";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const MODULE_BUTTONS: Array<{ id: LiveModuleId; label: string }> = [
  { id: "leaderboard", label: "Leaderboard" },
  { id: "feed", label: "Live Feed" },
  { id: "photos", label: "Foto-strøm" },
];

type TeacherLiveSidebarProps = {
  activeStudents: LiveStudentLocation[];
  joinPin: string;
  hasParticipantsTable: boolean;
  gpsOverride: boolean;
  isUpdatingGpsOverride: boolean;
  liveRouteParticipants: TeacherLiveRouteParticipant[] | null;
  liveRouteMode: ActivePostOrderMode;
  liveRouteIssueCount: number;
  newMessage: string;
  onNewMessageChange: (value: string) => void;
  onOpenAccessOverlay: () => void;
  onSendMessage: () => Promise<void>;
  onToggleGpsOverride: () => Promise<void>;
  onModuleSelect: (module: LiveModuleId) => void;
};

export default function TeacherLiveSidebar({
  activeStudents,
  joinPin,
  hasParticipantsTable,
  gpsOverride,
  isUpdatingGpsOverride,
  liveRouteParticipants,
  liveRouteMode,
  liveRouteIssueCount,
  newMessage,
  onNewMessageChange,
  onOpenAccessOverlay,
  onSendMessage,
  onToggleGpsOverride,
  onModuleSelect,
}: TeacherLiveSidebarProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void onSendMessage();
  };

  return (
    <aside
      className={`flex h-[calc(50%-0.5rem)] w-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-900/50 shadow-[0_24px_64px_rgba(0,0,0,0.35)] backdrop-blur-2xl lg:h-full lg:w-1/3 ${poppins.className}`}
    >
      <div className="flex-1 overflow-y-auto border-b border-white/10 px-6 pb-5 pt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-emerald-300/70">
              Control Center
            </p>
            <h3
              className={`mt-2 text-2xl font-black tracking-[0.18em] text-white uppercase ${rubik.className}`}
            >
              Live Pulse
            </h3>
            <p className="mt-2 text-sm text-slate-300">
              Overblik over elever, fremdrift, billeder og beskeder i realtid.
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-right shadow-[0_0_30px_rgba(16,185,129,0.16)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-200/75">
              Aktive løbere
            </p>
            <p className="mt-1 text-2xl font-black text-white">{activeStudents.length}</p>
          </div>
        </div>

        <div className="mt-4 rounded-3xl border border-amber-300/25 bg-amber-300/10 px-4 py-4 shadow-[0_16px_40px_rgba(251,191,36,0.12)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-100/75">
            Live PIN
          </p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="font-mono text-3xl font-black tracking-[0.38em] text-amber-50">
              {joinPin}
            </p>
            <button
              type="button"
              onClick={onOpenAccessOverlay}
              disabled={joinPin === "----"}
              className="inline-flex shrink-0 items-center gap-2 rounded-full border border-amber-100/25 bg-slate-950/30 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-50 transition hover:bg-slate-950/45 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <QrCode className="h-3.5 w-3.5" />
              Vis QR-kode
            </button>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-4 rounded-3xl border border-slate-500/30 bg-slate-950/55 px-5 py-5"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <label
              htmlFor="broadcast-message"
              className="block text-xs font-semibold uppercase tracking-[0.26em] text-emerald-200/75"
            >
              Broadcast
            </label>
            <button
              type="button"
              onClick={() => void onToggleGpsOverride()}
              disabled={isUpdatingGpsOverride}
              aria-pressed={gpsOverride}
              title="Slå GPS-krav fra eller til for hele sessionen"
              className={`inline-flex shrink-0 items-center justify-center rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] transition ${
                gpsOverride
                  ? "border-cyan-200/40 bg-cyan-300 text-slate-950 shadow-[0_10px_24px_rgba(34,211,238,0.22)]"
                  : "border-white/12 bg-white/6 text-slate-200 hover:bg-white/10"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {isUpdatingGpsOverride ? "Gemmer..." : gpsOverride ? "GPS fri" : "GPS lås"}
            </button>
          </div>
          <div className="flex gap-3">
            <input
              id="broadcast-message"
              type="text"
              value={newMessage}
              onChange={(event) => onNewMessageChange(event.target.value)}
              placeholder="Send en besked til alle elever..."
              className="flex-1 rounded-2xl border border-emerald-500/25 bg-slate-900/90 px-4 py-3 text-sm text-white shadow-[0_0_24px_rgba(16,185,129,0.12)] placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
            <button
              type="submit"
              className="rounded-2xl border border-emerald-400/30 bg-emerald-500 px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-slate-950 shadow-[0_16px_30px_rgba(16,185,129,0.35)] transition hover:bg-emerald-400"
            >
              Send
            </button>
          </div>
        </form>

        {!hasParticipantsTable ? (
          <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-xs font-medium text-amber-100">
            `participants` mangler, så kick-funktionen er i fallback-mode.
          </div>
        ) : null}

        {liveRouteParticipants ? (
          <LiveRouteOverview
            participants={liveRouteParticipants}
            mode={liveRouteMode}
            issueCount={liveRouteIssueCount}
          />
        ) : null}

        <div className="mt-5 mb-4 flex items-center gap-2 text-sm text-gray-500">
          Tip: Tryk på et modul for at åbne det i fuld skærm
        </div>

        <div className="grid grid-cols-3 rounded-2xl border border-slate-500/30 bg-slate-950/55 p-1.5">
          {MODULE_BUTTONS.map((module) => (
            <button
              key={module.id}
              type="button"
              onClick={() => onModuleSelect(module.id)}
              className="rounded-xl px-3 py-3 text-sm font-semibold text-slate-300 transition hover:bg-emerald-500 hover:text-slate-950 hover:shadow-[0_12px_30px_rgba(16,185,129,0.35)]"
            >
              {module.label}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
