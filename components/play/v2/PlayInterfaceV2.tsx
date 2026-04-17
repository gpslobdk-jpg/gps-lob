/**
 * PlayInterfaceV2 – The clean, dumb UI shell.
 *
 * 3 screens only:
 *  1. Gateway  (join)     – session ID input + QR scan
 *  2. Name Gate           – team name input + Wi-Fi tip
 *  3. Game     (active)   – map + HUD + post overlay driven by PostPhase
 *
 * Zero business logic. State comes entirely from the three hooks.
 */

"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ChangeEvent } from "react";
import {
  Camera,
  CheckCircle2,
  ChevronRight,
  CloudOff,
  Loader2,
  MapPin,
  Navigation,
  Trophy,
  Wifi,
  WifiOff,
  XCircle,
} from "lucide-react";

import { usePlayAuth, type AuthPhase } from "./usePlayAuth";
import { usePlayGps, type PlayGpsState } from "./usePlayGPS";
import { usePlayEngine, type SessionPhase, type PostPhase, type PlayEngineState, type PlayEngineActions } from "./usePlayEngine";
import NavigatorMarker from "./NavigatorMarker";
import QrScannerOverlay from "./QrScannerOverlay";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PlayInterfaceV2Props {
  sessionId?: string;
  initialStudentName?: string;
}

// ---------------------------------------------------------------------------
// Screen resolution (pure)
// ---------------------------------------------------------------------------

export type PlayScreen =
  | "join"
  | "loading"
  | "error"
  | "name_gate"
  | "waiting"
  | "kicked"
  | "active"
  | "finished";

export function resolveScreen(
  hasSessionId: boolean,
  authPhase: AuthPhase,
  sessionPhase: SessionPhase,
  postPhase: PostPhase,
): PlayScreen {
  if (!hasSessionId) return "join";
  if (authPhase === "initializing" || authPhase === "provisioning" || authPhase === "restoring")
    return "loading";
  if (authPhase === "error" || authPhase === "expired") return "error";
  if (authPhase === "kicked") return "kicked";
  if (authPhase === "name_gate") return "name_gate";
  if (sessionPhase === "loading") return "loading";
  if (sessionPhase === "error") return "error";
  if (sessionPhase === "waiting") return "waiting";
  if (sessionPhase === "finished") return "finished";
  return "active";
}

// ============================================================================
// SCREEN 1 — Gateway (join)
// ============================================================================

function GatewayScreen({
  onJoin,
  onScanQR,
}: {
  onJoin: (pin: string) => void;
  onScanQR: () => void;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cleaned = pin.replace(/\D/g, "").slice(0, 6);
    if (cleaned.length < 4) {
      setError("Indtast en gyldig pinkode (4–6 cifre).");
      return;
    }
    setError(null);
    onJoin(cleaned);
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-950 px-5">
      {/* Logo / Title */}
      <div className="mb-10 text-center">
        <div className="mb-2 text-4xl font-black tracking-tight text-white">
          GPS<span className="text-emerald-400">løb</span>
        </div>
        <p className="text-sm text-white/50">Indtast pinkode eller scan QR</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-4">
        {/* PIN input */}
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          value={pin}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            setPin(e.target.value.replace(/\D/g, "").slice(0, 6));
            setError(null);
          }}
          className="w-full rounded-2xl border border-emerald-400/20 bg-slate-900/80 px-5 py-4 text-center text-2xl font-bold tracking-[0.35em] text-white outline-none backdrop-blur-xl transition placeholder:text-white/20 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30"
        />

        {error && (
          <p className="text-center text-xs font-medium text-red-400">{error}</p>
        )}

        {/* Join button */}
        <button
          type="submit"
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-emerald-500 to-sky-500 px-5 py-4 text-sm font-black uppercase tracking-[0.2em] text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:brightness-110 active:scale-[0.98]"
        >
          <Navigation className="h-4 w-4" />
          Start mission
        </button>

        {/* QR button */}
        <button
          type="button"
          onClick={onScanQR}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-500/25 bg-slate-900/60 px-5 py-3.5 text-xs font-bold uppercase tracking-[0.2em] text-emerald-300 backdrop-blur-xl transition hover:border-emerald-400/50 hover:bg-emerald-500/10"
        >
          <Camera className="h-4 w-4" />
          Scan QR-kode
        </button>
      </form>

      {/* Footer */}
      <p className="mt-12 text-center text-[11px] text-white/30">
        Er du lærer? Opret løb på en computer.
      </p>
    </div>
  );
}

// ============================================================================
// SCREEN 2 — Name Gate
// ============================================================================

function NameGateScreen({
  pendingName,
  onChangeName,
  onConfirm,
  nameError,
  isProvisioning,
}: {
  pendingName: string;
  onChangeName: (name: string) => void;
  onConfirm: () => void;
  nameError: string | null;
  isProvisioning: boolean;
}) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!isProvisioning) onConfirm();
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-950 px-5">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15">
            <MapPin className="h-7 w-7 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-black text-white">Hvad hedder jeres hold?</h1>
          <p className="mt-1 text-sm text-white/50">Skriv et holdnavn som læreren kan se.</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            maxLength={20}
            placeholder="Holdnavn"
            value={pendingName}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onChangeName(e.target.value)}
            autoFocus
            className="w-full rounded-2xl border border-emerald-300/20 bg-slate-900/80 px-5 py-4 text-base text-white outline-none backdrop-blur-xl transition placeholder:text-white/30 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/25"
          />

          {nameError && (
            <p className="text-center text-xs font-medium text-red-400">{nameError}</p>
          )}

          <button
            type="submit"
            disabled={isProvisioning || !pendingName.trim()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-emerald-500 to-sky-500 px-5 py-4 text-sm font-black uppercase tracking-[0.2em] text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isProvisioning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Opretter…
              </>
            ) : (
              <>
                <ChevronRight className="h-4 w-4" />
                Klar til start
              </>
            )}
          </button>
        </form>

        {/* Wi-Fi tip */}
        <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <WifiOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div>
              <p className="text-sm font-semibold text-amber-200">
                Tip: Slå Wi-Fi fra
              </p>
              <p className="mt-0.5 text-xs text-amber-200/70">
                Mobilen bruger GPS + Wi-Fi til at finde din placering. Slå Wi-Fi fra for en mere præcis GPS-oplevelse!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SCREEN 3 — Active Game
// ============================================================================

// -- Nature-Glass HUD --

function GameHud({
  teamName,
  score,
  distance,
  progressPercent,
  displayPostNumber,
  totalQuestions,
  heading,
  pendingOfflineCount,
}: {
  teamName: string;
  score: number;
  distance: number | null;
  progressPercent: number;
  displayPostNumber: number;
  totalQuestions: number;
  heading: number | null;
  pendingOfflineCount: number;
}) {
  const distanceLabel =
    distance !== null
      ? distance >= 1000
        ? `${(distance / 1000).toFixed(1)} km`
        : `${distance} m`
      : "–";

  return (
    <div className="pointer-events-auto absolute left-3 right-3 top-[env(safe-area-inset-top,0px)] z-30 mt-3">
      <div className="rounded-[1.25rem] border border-white/10 bg-slate-950/70 p-3 shadow-2xl shadow-black/40 backdrop-blur-2xl">
        {/* Top row: team + score */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {/* Team badge */}
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 ring-1 ring-emerald-400/30">
              <span className="text-sm font-black text-emerald-400">
                {teamName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">{teamName}</p>
              <p className="text-[11px] text-white/50">
                Post {displayPostNumber}/{totalQuestions}
              </p>
            </div>
          </div>

          {/* Score pill */}
          <div className="flex items-center gap-2">
            {pendingOfflineCount > 0 && (
              <div
                className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1.5 ring-1 ring-amber-400/25"
                title={`${pendingOfflineCount} svar venter på sync`}
                data-testid="offline-indicator"
              >
                <CloudOff className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-xs font-bold tabular-nums text-amber-300">{pendingOfflineCount}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1.5 ring-1 ring-emerald-400/20">
              <Trophy className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-sm font-black tabular-nums text-emerald-300">{score}</span>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-linear-to-r from-emerald-500 to-sky-400 transition-all duration-500 ease-out"
            style={{ width: `${Math.min(100, progressPercent)}%` }}
          />
        </div>

        {/* Bottom row: distance + compass */}
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-white/40" />
            <span className="text-xs font-semibold tabular-nums text-white/60">{distanceLabel}</span>
          </div>
          {heading !== null && (
            <div
              className="flex items-center gap-1 text-white/40 transition-transform duration-200"
              style={{ transform: `rotate(${heading}deg)` }}
            >
              <Navigation className="h-3.5 w-3.5" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// -- Map stub (placeholder for the Leaflet map) --

function MapStub() {
  return (
    <div className="absolute inset-0 bg-slate-900">
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-center">
          <MapPin className="mx-auto mb-2 h-10 w-10 text-emerald-500/30" />
          <p className="text-sm text-white/30">Kortet indlæser…</p>
        </div>
      </div>
    </div>
  );
}

// -- Post Overlay: OPEN --

function PostOverlayOpen({
  question,
  postVariant,
  displayPostNumber,
  onSelectAnswer,
  onDismiss,
}: {
  question: { text: string; answers: string[]; hint?: string; mediaUrl?: string };
  postVariant: string;
  displayPostNumber: number;
  onSelectAnswer: (index: number) => void;
  onDismiss: () => void;
}) {
  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-40 max-h-[85dvh] overflow-y-auto">
      <div className="rounded-t-3xl border-t border-white/10 bg-slate-950/90 px-5 pb-[env(safe-area-inset-bottom,16px)] pt-5 shadow-2xl shadow-black/60 backdrop-blur-2xl">
        {/* Handle bar */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15" />

        {/* Question badge */}
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 ring-1 ring-emerald-400/20">
          <span className="text-xs font-bold text-emerald-300">Post {displayPostNumber}</span>
        </div>

        {/* Question text */}
        <h2 className="mb-5 text-lg font-bold leading-snug text-white">{question.text}</h2>

        {/* Hint */}
        {question.hint && (
          <p className="mb-4 text-xs italic text-white/40">{question.hint}</p>
        )}

        {/* Answer buttons — quiz variant */}
        {postVariant === "quiz" && (
          <div className="space-y-2.5">
            {question.answers.map((answer, i) => (
              <button
                key={i}
                onClick={() => onSelectAnswer(i)}
                className="group w-full rounded-2xl border border-white/8 bg-slate-800/60 px-4 py-3.5 text-left text-sm font-medium text-white/90 backdrop-blur-sm transition hover:border-emerald-400/30 hover:bg-emerald-500/10 active:scale-[0.98]"
              >
                <span className="mr-2.5 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-white/8 text-xs font-bold text-white/50 transition group-hover:bg-emerald-500/20 group-hover:text-emerald-300">
                  {String.fromCharCode(65 + i)}
                </span>
                {answer}
              </button>
            ))}
          </div>
        )}

        {/* Dismiss */}
        <button
          onClick={onDismiss}
          className="mt-4 w-full py-2 text-center text-xs font-semibold text-white/30 transition hover:text-white/60"
        >
          Tilbage til kort
        </button>
      </div>
    </div>
  );
}

// -- Post Overlay: SUBMITTING --

function PostOverlaySubmitting() {
  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-40">
      <div className="rounded-t-3xl border-t border-white/10 bg-slate-950/90 px-5 pb-[env(safe-area-inset-bottom,16px)] pt-8 shadow-2xl shadow-black/60 backdrop-blur-2xl">
        <div className="flex flex-col items-center gap-3 py-6">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
          <p className="text-sm font-semibold text-white/70">Sender svar…</p>
        </div>
      </div>
    </div>
  );
}

// -- Post Overlay: RESOLVED --

function PostOverlayResolved({
  isCorrect,
  wrongMessage,
  offlineMessage,
  onContinue,
}: {
  isCorrect: boolean;
  wrongMessage: string | null;
  offlineMessage: string | null;
  onContinue: () => void;
}) {
  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-40">
      <div className="rounded-t-3xl border-t border-white/10 bg-slate-950/90 px-5 pb-[env(safe-area-inset-bottom,16px)] pt-6 shadow-2xl shadow-black/60 backdrop-blur-2xl">
        <div className="flex flex-col items-center gap-3 py-4">
          {offlineMessage ? (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/20 ring-2 ring-amber-400/40">
                <CloudOff className="h-7 w-7 text-amber-400" />
              </div>
              <p className="text-sm font-semibold text-amber-300" data-testid="offline-sync-message">
                {offlineMessage}
              </p>
            </>
          ) : isCorrect ? (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 ring-2 ring-emerald-400/40">
                <CheckCircle2 className="h-7 w-7 text-emerald-400" />
              </div>
              <p className="text-lg font-black text-emerald-300">Korrekt!</p>
            </>
          ) : (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/20 ring-2 ring-red-400/40">
                <XCircle className="h-7 w-7 text-red-400" />
              </div>
              <p className="text-lg font-black text-red-300">
                {wrongMessage ?? "Desværre, forkert svar!"}
              </p>
            </>
          )}

          <button
            onClick={onContinue}
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-emerald-500 to-sky-500 px-5 py-3.5 text-sm font-black uppercase tracking-[0.2em] text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:brightness-110 active:scale-[0.98]"
          >
            <ChevronRight className="h-4 w-4" />
            Videre
          </button>
        </div>
      </div>
    </div>
  );
}

// -- Active Game Screen Compositor --

function ActiveGameScreen({
  engine,
  engineActions,
  gps,
  teamName,
}: {
  engine: PlayEngineState;
  engineActions: PlayEngineActions;
  gps: PlayGpsState;
  teamName: string;
}) {
  return (
    <div className="relative h-dvh w-full overflow-hidden bg-slate-950">
      {/* Full-screen map layer */}
      <MapStub />

      {/* Navigator marker overlay */}
      {gps.location && (
        <div className="pointer-events-none absolute inset-0 z-20" data-testid="navigator-marker">
          <NavigatorMarker
            lat={gps.location.lat}
            lng={gps.location.lng}
            heading={gps.heading}
            accuracy={gps.accuracy}
            isInRange={gps.isInRange}
            containerWidth={0}
            containerHeight={0}
          />
        </div>
      )}

      {/* HUD overlay */}
      <GameHud
        teamName={teamName}
        score={engine.score}
        distance={gps.distanceToTarget}
        progressPercent={engine.progressPercent}
        displayPostNumber={engine.displayPostNumber}
        totalQuestions={engine.totalQuestions}
        heading={gps.heading}
        pendingOfflineCount={engine.pendingOfflineCount}
      />

      {/* Post overlays based on PostPhase */}
      {engine.postPhase === "OPEN" && engine.activeQuestion && (
        <PostOverlayOpen
          question={engine.activeQuestion}
          postVariant={engine.activePostVariant}
          displayPostNumber={engine.displayPostNumber}
          onSelectAnswer={engineActions.submitQuizAnswer}
          onDismiss={engineActions.dismissQuestion}
        />
      )}

      {engine.postPhase === "SUBMITTING" && <PostOverlaySubmitting />}

      {engine.postPhase === "RESOLVED" && (
        <PostOverlayResolved
          isCorrect={engine.feedback.quiz?.tone === "success"}
          wrongMessage={engine.feedback.wrongAnswer}
          offlineMessage={engine.feedback.actionError?.message ?? null}
          onContinue={engineActions.advanceToNextPost}
        />
      )}

      {/* Resume message toast */}
      {engine.resumeMessage && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-50 flex justify-center">
          <div className="rounded-full bg-emerald-500/20 px-4 py-2 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-400/30 backdrop-blur-xl">
            {engine.resumeMessage}
          </div>
        </div>
      )}

      {/* GPS error banner */}
      {gps.gpsError && (
        <div className="pointer-events-none absolute inset-x-3 top-28 z-50">
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-center text-xs font-medium text-red-300 backdrop-blur-xl">
            {gps.gpsError}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Shared utility screens
// ============================================================================

function LoadingScreen() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-950">
      <Loader2 className="mb-3 h-8 w-8 animate-spin text-emerald-400" />
      <p className="text-sm font-medium text-white/50">Indlæser mission…</p>
    </div>
  );
}

function ErrorScreen({ message, onRetry, buttonLabel }: { message: string | null; onRetry?: () => void; buttonLabel?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-950 px-5">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15 ring-1 ring-red-400/30">
        <XCircle className="h-7 w-7 text-red-400" />
      </div>
      <p className="mt-4 text-center text-sm font-medium text-white/60">
        {message ?? "Noget gik galt. Prøv igen."}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-5 rounded-2xl bg-emerald-500/15 px-6 py-3 text-sm font-bold text-emerald-300 ring-1 ring-emerald-400/25 transition hover:bg-emerald-500/25"
        >
          {buttonLabel ?? "Prøv igen"}
        </button>
      )}
    </div>
  );
}

function WaitingScreen() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-950 px-5">
      <Loader2 className="mb-3 h-8 w-8 animate-spin text-emerald-400/60" />
      <h2 className="text-lg font-black text-white">Klar!</h2>
      <p className="mt-1 text-center text-sm text-white/50">
        Vent på at læreren starter løbet…
      </p>
    </div>
  );
}

function KickedScreen() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-950 px-5">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15 ring-1 ring-red-400/30">
        <XCircle className="h-7 w-7 text-red-400" />
      </div>
      <h2 className="mt-4 text-lg font-black text-white">Du er fjernet</h2>
      <p className="mt-1 text-center text-sm text-white/50">
        Læreren har fjernet dig fra dette løb.
      </p>
    </div>
  );
}

function FinishedScreen({ score, teamName }: { score: number; teamName: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-950 px-5">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15 ring-2 ring-emerald-400/30">
        <Trophy className="h-10 w-10 text-emerald-400" />
      </div>
      <h2 className="mt-5 text-2xl font-black text-white">Mission fuldført!</h2>
      <p className="mt-2 text-lg font-bold text-emerald-300">{teamName}</p>
      <div className="mt-4 rounded-2xl bg-emerald-500/10 px-8 py-4 ring-1 ring-emerald-400/20">
        <p className="text-center text-3xl font-black tabular-nums text-emerald-300">{score}</p>
        <p className="text-center text-xs font-semibold uppercase tracking-wider text-emerald-400/60">
          Point
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * PlayInterfaceV2 — wires the three hooks together and maps their state to
 * the appropriate screen. All business logic lives in the hooks; this
 * component is a pure render function.
 */

export default function PlayInterfaceV2(props: PlayInterfaceV2Props) {
  // -----------------------------------------------------------------------
  // Local "join" state — manages session ID before hooks take over
  // -----------------------------------------------------------------------
  const [joinedSessionId, setJoinedSessionId] = useState<string | undefined>(props.sessionId);
  const activeSessionId = joinedSessionId;

  // -----------------------------------------------------------------------
  // Hook 1: Auth — identity, joining, session validation
  // -----------------------------------------------------------------------
  const auth = usePlayAuth({
    sessionId: activeSessionId,
    initialStudentName: props.initialStudentName,
  });

  // Extract sessionStatus + gpsOverride from the auth return
  // (exposed as extra fields beyond the public type).
  const authExtended = auth as typeof auth & {
    sessionStatus: string | null;
    gpsOverride: boolean;
  };

  // -----------------------------------------------------------------------
  // Hook 2: GPS — geolocation + compass
  // -----------------------------------------------------------------------
  const gpsEnabled = auth.phase === "authenticated";
  const gpsHook = usePlayGps({
    participantId: auth.identity?.participantId ?? null,
    sessionId: activeSessionId,
    enabled: gpsEnabled,
  });

  // -----------------------------------------------------------------------
  // Hook 3: Engine — game loop state machine
  // -----------------------------------------------------------------------
  const { state: engine, actions: engineActions } = usePlayEngine({
    sessionId: activeSessionId,
    identity: auth.identity,
    gps: gpsHook.state,
  });

  // -----------------------------------------------------------------------
  // Bridge: push GPS target from engine's active question
  // -----------------------------------------------------------------------
  const prevTargetRef = useRef<string | null>(null);
  useEffect(() => {
    const q = engine.activeQuestion;
    const key = q ? `${q.lat},${q.lng}` : null;
    if (key === prevTargetRef.current) return;
    prevTargetRef.current = key;

    if (q && typeof q.lat === "number" && typeof q.lng === "number") {
      gpsHook.actions.setTarget({ lat: q.lat, lng: q.lng });
    } else {
      gpsHook.actions.setTarget(null);
    }
  }, [engine.activeQuestion, gpsHook.actions]);

  // Bridge: push gpsOverride from auth to GPS
  useEffect(() => {
    gpsHook.actions.setGpsOverride(authExtended.gpsOverride);
  }, [authExtended.gpsOverride, gpsHook.actions]);

  // -----------------------------------------------------------------------
  // Join handler (before session ID is set)
  // -----------------------------------------------------------------------
  const handleJoin = useCallback((pin: string) => {
    setJoinedSessionId(pin);
  }, []);

  const [scannerOpen, setScannerOpen] = useState(false);

  const handleScanQR = useCallback(() => {
    setScannerOpen(true);
  }, []);

  const handleScannerClose = useCallback(() => {
    setScannerOpen(false);
  }, []);

  /** QR decoded → feed the pin straight into the join flow. */
  const handleQrCodeDetected = useCallback((pin: string) => {
    setScannerOpen(false);
    setJoinedSessionId(pin);
  }, []);

  // -----------------------------------------------------------------------
  // Name gate handler → delegates to auth hook
  // -----------------------------------------------------------------------
  const [nameError, setNameError] = useState<string | null>(null);

  const handleConfirmName = useCallback(async () => {
    const trimmed = auth.pendingName.trim();
    if (!trimmed) {
      setNameError("Skriv et holdnavn først.");
      return;
    }
    if (trimmed.length < 2) {
      setNameError("Holdnavnet skal være mindst 2 tegn.");
      return;
    }
    setNameError(null);
    try {
      await auth.actions.confirmName(trimmed);
    } catch {
      setNameError("Noget gik galt. Prøv igen.");
    }
  }, [auth.pendingName, auth.actions]);

  // -----------------------------------------------------------------------
  // Combine error messages from auth + engine
  // -----------------------------------------------------------------------
  const displayError = auth.errorMessage ?? engine.errorMessage;
  const handleRetry = auth.errorMessage ? auth.actions.retry : engineActions.retryLoad;

  // -----------------------------------------------------------------------
  // Team name for display
  // -----------------------------------------------------------------------
  const teamName = auth.identity?.studentName ?? auth.pendingName ?? "";

  // -----------------------------------------------------------------------
  // Screen resolution
  // -----------------------------------------------------------------------
  const hasSession = Boolean(activeSessionId);
  const screen = resolveScreen(
    hasSession,
    auth.phase,
    engine.sessionPhase,
    engine.postPhase,
  );

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  switch (screen) {
    case "join":
      return (
        <>
          <GatewayScreen onJoin={handleJoin} onScanQR={handleScanQR} />
          <QrScannerOverlay
            isOpen={scannerOpen}
            onClose={handleScannerClose}
            onCodeDetected={handleQrCodeDetected}
          />
        </>
      );

    case "name_gate":
      return (
        <NameGateScreen
          pendingName={auth.pendingName}
          onChangeName={(v) => { auth.setPendingName(v); setNameError(null); }}
          onConfirm={handleConfirmName}
          nameError={nameError ?? auth.errorMessage}
          isProvisioning={auth.phase === "provisioning"}
        />
      );

    case "loading":
      return <LoadingScreen />;

    case "error":
      return (
        <ErrorScreen
          message={displayError}
          onRetry={handleRetry}
          buttonLabel={auth.errorVariant === "participant_auth_expired" ? "Fortsæt spillet" : undefined}
        />
      );

    case "waiting":
      return <WaitingScreen />;

    case "kicked":
      return <KickedScreen />;

    case "finished":
      return <FinishedScreen score={engine.score} teamName={teamName} />;

    case "active":
      return (
        <ActiveGameScreen
          engine={engine}
          engineActions={engineActions}
          gps={gpsHook.state}
          teamName={teamName}
        />
      );

    default:
      return <LoadingScreen />;
  }
}
