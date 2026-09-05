"use client";

import { Component, useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Smartphone } from "lucide-react";
import FocusModeSetting from "@/components/focus/FocusModeSetting";
import { parseTeacherFocusState, requestTeacherFocus, type TeacherFocusState } from "@/lib/teacherFocusMode";

type TeacherFocusPanelProps = { sessionId: string | null; finished?: boolean };

class TeacherFocusBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

export default function TeacherFocusPanel(props: TeacherFocusPanelProps) {
  return <TeacherFocusBoundary key={props.sessionId ?? "no-session"}><TeacherFocusContent {...props} /></TeacherFocusBoundary>;
}

function TeacherFocusContent({ sessionId, finished = false }: TeacherFocusPanelProps) {
  const [state, setState] = useState<TeacherFocusState | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef(false);
  const sequenceRef = useRef(0);
  const panelId = useId();

  const refresh = useCallback(async () => {
    if (!sessionId || pendingRef.current) return;
    const sequence = ++sequenceRef.current;
    const next = parseTeacherFocusState(await requestTeacherFocus("session", { sessionId }));
    if (sequence !== sequenceRef.current) return;
    if (next) {
      setState(next);
      setError(null);
    } else {
      setError("Fokusstatus kan ikke hentes lige nu. Løbet fortsætter normalt.");
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || finished) return;
    const initial = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 5000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      sequenceRef.current += 1;
    };
  }, [finished, refresh, sessionId]);

  const update = async (change: { enabled: boolean } | { participantId: string; excluded: boolean }) => {
    if (!sessionId || pendingRef.current) return;
    pendingRef.current = true;
    const sequence = ++sequenceRef.current;
    setPending(true);
    setError(null);
    try {
      const next = parseTeacherFocusState(await requestTeacherFocus("session", { sessionId, ...change }, "PATCH"));
      if (sequence !== sequenceRef.current) return;
      if (next) setState(next);
      else setError("Fokusmode kunne ikke ændres. Prøv igen. Løbet fortsætter normalt.");
    } finally {
      pendingRef.current = false;
      if (sequence === sequenceRef.current) setPending(false);
    }
  };

  if (!sessionId || finished) return null;
  const eventCount = state?.participants.reduce((total, participant) => total + participant.eventCount, 0) ?? 0;
  return (
    <aside aria-label="Fokusmode i livevisningen" aria-busy={pending} className="fixed bottom-24 left-4 z-[1060] flex w-[min(22rem,calc(100vw-2rem))] flex-col-reverse items-start gap-2 text-slate-100 md:bottom-4">
      <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((value) => !value)} className="flex min-h-11 items-center gap-2 rounded-2xl border border-slate-500/40 bg-slate-950/95 px-4 py-3 text-sm font-semibold shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200">
        <Smartphone aria-hidden="true" className="h-4 w-4" />Fokusmode: {error ? "Ukendt" : !state ? "Henter…" : state.enabled ? `Til · ${eventCount}` : "Fra"}<ChevronDown aria-hidden="true" className={`h-4 w-4 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div id={panelId} className="max-h-[60svh] w-full overflow-y-auto rounded-2xl border border-slate-500/40 bg-slate-950/95 p-4 shadow-xl backdrop-blur-xl">
          <FocusModeSetting enabled={state?.enabled ?? false} status={error ? "unavailable" : state ? "ready" : "loading"} disabled={pending} onChange={(enabled) => void update({ enabled })} compact />
          {error && <p role="status" className="mb-3 text-xs leading-5 text-slate-300">{error}</p>}
          {!state && !error && <p role="status" className="text-xs text-slate-300">Henter fokusstatus…</p>}
          {error && <button type="button" className="mb-3 min-h-11 rounded-xl border border-white/20 px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200" onClick={() => void refresh()}>Hent fokusstatus igen</button>}
          {state?.enabled && <p className="mb-3 text-xs leading-5 text-slate-300">Tallene viser kun, at SkoleGPS blev forladt. Læreren vurderer selv årsagen.</p>}
          {state && state.participants.length > 0 && (
            <ul className="space-y-3">
              {state.participants.map((participant) => (
                <li key={participant.participantId} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="break-words text-sm font-semibold">{participant.displayName}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-300">{participant.excluded ? "Fokusregistrering er undtaget" : !state.enabled ? "Fokusregistrering er slået fra" : `Forlod SkoleGPS ${participant.eventCount} ${participant.eventCount === 1 ? "gang" : "gange"}`}</p>
                  {participant.eventCount > 0 && participant.latestDurationMs !== null && <p className="text-xs leading-5 text-slate-400">Senest: {Math.round(participant.latestDurationMs / 1000)} sek.</p>}
                  <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-2 text-xs leading-5 text-slate-200">
                    <input type="checkbox" checked={participant.excluded} disabled={pending || Boolean(error)} onChange={(event) => void update({ participantId: participant.participantId, excluded: event.target.checked })} className="h-4 w-4 shrink-0 accent-cyan-200" />
                    <span>Ignorér fokusregistrering<span className="sr-only"> for {participant.displayName}</span></span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {state?.enabled && state.participants.length === 0 && <p className="text-xs text-slate-300">Deltagerne vises, når de har tilsluttet sig.</p>}
        </div>
      )}
    </aside>
  );
}
