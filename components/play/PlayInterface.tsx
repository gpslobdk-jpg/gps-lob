"use client";

import dynamic from "next/dynamic";
import { AlertCircle, Camera, CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import Image from "next/image";
import { Poppins, Rubik } from "next/font/google";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";

import type { PlayActions, PlayUiState } from "./types";
import {
  AUTO_UNLOCK_RADIUS,
  FIREWORKS_LOTTIE_URL,
  formatFinishedAt,
  formatPlacement,
  getRoleplayMessage,
  looksLikeImageSource,
  wrapTextClass,
} from "./playUtils";
import trophyAnimation from "@/public/trophy.json";

const Lottie = dynamic(() => import("lottie-react"), { ssr: false });
const LottiePlayer = dynamic(
  () => import("@lottiefiles/react-lottie-player").then((mod) => mod.Player),
  { ssr: false }
);

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

type PlayInterfaceProps = {
  ui: PlayUiState;
  actions: PlayActions;
  children?: ReactNode;
};

export default function PlayInterface({ ui, actions, children }: PlayInterfaceProps) {
  const typedAnswerInputRef = useRef<HTMLInputElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [mobileHudOpen, setMobileHudOpen] = useState(false);

  const { player, gps, progress, flags } = ui;
  const {
    pendingPlayerName,
    playerName,
    nameError,
    activeDisplayName,
    celebrationName,
  } = player;
  const {
    distance,
    gpsErrorContent = { title: "", message: "", helper: "" },
    gpsWarningContent,
  } = gps;
  const {
    questions,
    currentPostIndex,
    progressPercent,
    correctAnswersCount,
    dismissedPostIndex,
    showQuestion,
    currentPost,
    escape,
    feedback,
    screen,
  } = progress;
  const {
    activeQuestion,
    activePostVariant,
    activeTypedAnswerKey,
    activeTypedAnswerError,
    activePostActionError,
    activePhotoFeedback,
    activeQuizAnswerFeedback,
    activeEscapeReward,
    activeEscapeHint,
    activeRoleplayReply,
    activeRoleplayReplyMessage,
    roleplayCharacterName,
    roleplayAvatar,
  } = currentPost;
  const {
    collectedRewardsCount: collectedEscapeRewardsCount,
    escapeCodeOverviewText,
    escapeResults,
    escapeResultsError,
    isLoadingEscapeResults,
    masterLockInput,
    masterLockError,
    masterLockStatus,
    masterLockShakeNonce,
    isFinalizingEscape,
    showMasterVictory,
    myEscapePlacement,
  } = escape;
  const { latestMessage, resumeMessage } = feedback;
  const {
    canManualUnlock,
    hasActivePhotoSuccess,
    hasActiveQuizSuccess,
    hasAllEscapeBricks,
    hasRoleplayInputErrorTone,
    isProvisioningParticipant,
    isEscapeRace,
    isRoleplayImmersed,
    isSelfiePhotoTask,
    isSubmitting,
    isSubmittingAnswer,
    isAnalyzingPhoto,
    isCheckingEscapeAnswer,
  } = flags;
  const normalizedActiveDisplayName = activeDisplayName.trim().toLocaleLowerCase("da-DK");
  const blockingGpsErrorContent = gpsErrorContent ?? { title: "", message: "", helper: "" };
  const tacticalHudShellClass =
    "overflow-hidden rounded-[2rem] border border-white/20 bg-white/10 p-4 shadow-lg backdrop-blur-2xl md:p-5";
  const tacticalHudCardClass =
    "overflow-hidden rounded-[1.6rem] border border-white/20 bg-white/10 p-4 shadow-lg backdrop-blur-2xl";
  const tacticalMetaLabelClass =
    "font-mono text-[11px] uppercase tracking-[0.32em] text-white/70";
  const tacticalPillClass =
    "rounded-full border border-white/20 bg-white/10 px-3 py-1 font-mono text-xs uppercase tracking-widest text-white/90";
  const tacticalOverlayCardClass =
    "w-full max-w-md overflow-hidden rounded-[2rem] border border-emerald-500/50 bg-slate-950 p-5 shadow-2xl backdrop-blur-2xl sm:p-8";
  const tacticalPrimaryButtonClass =
    `inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[1.35rem] border border-emerald-500 bg-emerald-600 px-5 py-4 text-sm font-black uppercase tracking-[0.2em] text-white shadow-md transition-all hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 ${rubik.className}`;
  const tacticalSecondaryButtonClass =
    `inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[1.35rem] border border-slate-600 bg-slate-800 px-5 py-4 text-sm font-black uppercase tracking-[0.2em] text-white transition-all hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 ${rubik.className}`;
  const tacticalInputClass =
    "w-full rounded-[1.35rem] border border-emerald-500/50 bg-slate-950 px-4 py-4 text-base text-emerald-50 outline-none transition placeholder:text-white/40 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-70";
  const tacticalSuccessPanelClass =
    "overflow-hidden rounded-[1.9rem] border border-emerald-300/35 bg-emerald-500 p-6 text-center text-slate-950 shadow-[0_0_36px_rgba(16,185,129,0.22)] animate-pulse";

  function MobileHud() {
    return (
      <div className="w-full max-w-xl">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setMobileHudOpen((s) => !s)}
            className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/8 px-3 py-2 text-sm font-semibold text-white backdrop-blur-md"
          >
            {mobileHudOpen ? "Skjul info" : "Vis info"}
          </button>
        </div>

        {mobileHudOpen ? (
          <div className="mt-3 rounded-2xl border border-white/10 bg-black/40 p-3 text-white">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">{activeDisplayName}</div>
              <div className="text-sm font-mono">{distance !== null ? `${distance}m` : "GPS..."}</div>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-white/80">
              <div>Progress: {progressPercent}%</div>
              <div>
                {correctAnswersCount}/{questions.length}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  const handleNameSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    actions.confirmName(pendingPlayerName);
  };

  const handleMasterLockSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void actions.submitMasterCode(masterLockInput);
  };

  const handleTypedAnswerSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void actions.submitTypedAnswer(typedAnswerInputRef.current?.value ?? "");
  };

  const handlePhotoCapture = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    void actions.submitPhoto(file);
  };

  useEffect(() => {
    if (!hasRoleplayInputErrorTone) return;

    typedAnswerInputRef.current?.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-8px)" },
        { transform: "translateX(7px)" },
        { transform: "translateX(-5px)" },
        { transform: "translateX(3px)" },
        { transform: "translateX(0)" },
      ],
      {
        duration: 360,
        easing: "ease-in-out",
      }
    );
  }, [activeTypedAnswerKey, hasRoleplayInputErrorTone]);

  useEffect(() => {
    if (!isRoleplayImmersed || activeRoleplayReply) return;

    const timeoutId = window.setTimeout(() => {
      typedAnswerInputRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 120);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeRoleplayReply, activeTypedAnswerKey, isRoleplayImmersed]);

  let content: ReactNode;

  switch (screen.mode) {
    case "loading":
      content = (
        <div className="flex h-screen items-center justify-center bg-slate-950 text-emerald-200">
          <div className="text-center">
            <div className="mx-auto mb-3 h-8 w-8 animate-pulse text-current">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M12 3v18M3 12h18M5 5l14 14M19 5 5 19" />
              </svg>
            </div>
            <p className="text-sm uppercase tracking-widest">Indlæser mission...</p>
          </div>
        </div>
      );
      break;

    case "load_error":
      content = (
        <div className="flex h-screen items-center justify-center bg-slate-950 px-6 text-center text-white">
          <div className="max-w-md rounded-2xl border border-rose-400/30 bg-rose-500/10 p-6 backdrop-blur-xl">
            <AlertCircle className="mx-auto mb-3 h-8 w-8 text-red-300" />
            <p className={`font-semibold ${wrapTextClass}`}>{screen.loadError}</p>
            <button
              type="button"
              onClick={actions.reloadPage}
              className="mt-6 rounded-xl border border-rose-200/40 bg-white/10 px-5 py-3 font-bold text-white transition-colors hover:bg-white/20"
            >
              Prøv igen
            </button>
          </div>
        </div>
      );
      break;

    case "kicked":
      content = (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-red-950 via-[#2a0606] to-[#130303] px-6 text-white">
          <div className="w-full max-w-2xl rounded-3xl border border-red-400/40 bg-red-900/20 p-8 text-center shadow-[0_0_40px_rgba(239,68,68,0.25)] backdrop-blur-md">
            <h1 className="text-3xl font-black md:text-4xl">
              🚫 Du er blevet fjernet fra løbet af arrangøren.
            </h1>
          </div>
        </div>
      );
      break;

    case "name_gate":
      content = (
        <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
          <form
            onSubmit={handleNameSubmit}
            className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_0_28px_rgba(16,185,129,0.18)] backdrop-blur-xl"
          >
            <h1 className="mb-5 text-2xl font-black tracking-wide uppercase">Klar til at starte?</h1>
            <label htmlFor="player-name" className="mb-2 block text-sm font-semibold text-emerald-100">
              Dit navn
            </label>
            <input
              id="player-name"
              type="text"
              value={pendingPlayerName}
              onChange={(event) => actions.setPendingPlayerName(event.target.value)}
              placeholder="Dit navn"
              className="w-full rounded-xl border border-white/20 bg-black/40 px-4 py-3 text-base text-white placeholder:text-white/45 focus:border-emerald-400/60 focus:outline-none"
            />
            <p className={`mt-3 text-sm text-white/80 ${wrapTextClass}`}>
              Skriv dit rigtige navn. Brug ikke et opdigtet navn.
            </p>
            {nameError ? (
              <div
                className={`mt-4 rounded-xl border border-red-400/50 bg-red-500/15 px-4 py-3 text-sm font-semibold text-red-100 ${wrapTextClass}`}
              >
                {nameError}
              </div>
            ) : null}
            <button
              type="submit"
              disabled={isProvisioningParticipant}
              className="mt-6 w-full rounded-xl bg-gradient-to-r from-emerald-400 to-sky-400 px-4 py-3 text-base font-black tracking-wide text-[#03110d] uppercase transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100"
            >
              {isProvisioningParticipant ? "Klargør hold..." : "Start Løb"}
            </button>
          </form>
        </div>
      );
      break;

    case "gps_blocked":
      content = (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-red-950 via-[#2a0606] to-[#130303] px-6 text-white">
          <div className="w-full max-w-2xl rounded-3xl border border-red-400/40 bg-red-900/20 p-8 shadow-[0_0_40px_rgba(239,68,68,0.25)] backdrop-blur-md">
            <div className="mb-4 flex items-center gap-3 text-red-200">
              <AlertCircle className="h-7 w-7" />
              <h1 className={`text-2xl font-black md:text-3xl ${wrapTextClass}`}>
                {blockingGpsErrorContent.title}
              </h1>
            </div>
            <p className={`mb-5 text-red-50 ${wrapTextClass}`}>{blockingGpsErrorContent.message}</p>
            <p className={`text-sm text-red-100/90 ${wrapTextClass}`}>{blockingGpsErrorContent.helper}</p>
            <button
              type="button"
              onClick={actions.reloadPage}
              className="mt-7 rounded-xl border border-red-200/60 bg-red-100 px-5 py-3 font-bold text-red-900 transition-colors hover:bg-white"
            >
              Prøv igen
            </button>
          </div>
        </div>
      );
      break;

    case "escape_master_lock":
      content = (
        <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-slate-950 px-6 py-10 text-white">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.24),transparent_30%),radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.12),transparent_26%),linear-gradient(180deg,rgba(2,6,23,0.72)_0%,rgba(2,6,23,0.94)_52%,rgba(2,6,23,1)_100%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(120,53,15,0.42),transparent_38%)] blur-2xl" />

          {masterLockStatus === "unlocked" ? (
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {Array.from({ length: 16 }).map((_, index) => (
                <span
                  key={`master-lock-spark-${index}`}
                  className="absolute h-3 w-3 rounded-full bg-gradient-to-br from-amber-200 via-yellow-300 to-orange-400 opacity-0 animate-[master-lock-spark_1.2s_ease-out_forwards]"
                  style={{
                    top: `${18 + (index % 5) * 12}%`,
                    left: `${10 + ((index * 6) % 80)}%`,
                    animationDelay: `${(index % 8) * 0.08}s`,
                  }}
                />
              ))}
            </div>
          ) : null}

          <div
            key={`master-lock-${masterLockStatus}-${masterLockShakeNonce}`}
            className={`relative z-10 w-full max-w-xl overflow-hidden rounded-[2rem] border p-8 shadow-[0_30px_90px_rgba(2,6,23,0.55)] backdrop-blur-xl ${
              masterLockStatus === "unlocked"
                ? "border-amber-300/40 bg-amber-900/30"
                : `${masterLockError ? "animate-[master-lock-shake_0.45s_ease-in-out]" : ""} border-white/10 bg-slate-900/80`
            }`}
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.14),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.12),transparent_32%)]" />

            {showMasterVictory ? (
              <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.16),transparent_42%)]" />
                <div className="absolute inset-0 opacity-90">
                  <LottiePlayer autoplay loop src={FIREWORKS_LOTTIE_URL} style={{ width: "100%", height: "100%" }} />
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
                  <div className="h-36 w-36 drop-shadow-[0_0_35px_rgba(251,191,36,0.45)]">
                    <Lottie animationData={trophyAnimation} loop={true} />
                  </div>
                  <p className="mt-4 text-xs font-semibold tracking-[0.32em] text-amber-200/80 uppercase">
                    Vinder-fejring
                  </p>
                  <h2 className="mt-3 text-3xl font-black text-amber-50">Master-låsen er brudt op!</h2>
                  <p className="mt-3 text-sm font-semibold text-amber-100/90">Resultatet gøres klar...</p>
                </div>
              </div>
            ) : null}

            <div className="relative text-center">
              <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border border-amber-300/35 bg-amber-300/10 text-6xl shadow-[0_0_35px_rgba(245,158,11,0.18)]">
                🔒
              </div>

              <p className="mt-6 text-xs font-semibold tracking-[0.32em] text-amber-200/80 uppercase">
                Master-lås
              </p>
              <h1 className="mt-3 break-words text-3xl font-black text-white md:text-4xl">
                Du er næsten i mål!
              </h1>
              <p className="mt-4 break-words text-base leading-relaxed text-amber-50/88">
                Indtast den samlede Master-kode fra alle posterne for at vinde løbet.
              </p>
              <p className="mt-3 text-sm text-white/70">
                Kode-brikker samlet: {correctAnswersCount}/{questions.length}
              </p>

              {hasAllEscapeBricks ? (
                <div className="mt-6 rounded-[1.6rem] border border-emerald-300/25 bg-emerald-500/10 px-5 py-4 text-left shadow-[0_18px_40px_rgba(16,185,129,0.12)]">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-full border border-emerald-300/20 bg-emerald-400/10 p-2 text-emerald-200">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold tracking-[0.28em] text-white/80 uppercase">
                        Klar til at vinde
                      </p>
                      <p className={`mt-2 text-base font-bold text-emerald-50 ${wrapTextClass}`}>
                        Alle kode-brikker er fundet. Indtast master-koden for at vinde løbet.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-8 rounded-[1.75rem] border border-amber-500/25 bg-amber-900/25 p-5 text-left">
                <p className="text-[11px] font-semibold tracking-[0.28em] text-amber-200/70 uppercase">
                  Deltager
                </p>
                <p className={`mt-2 text-xl font-black text-amber-50 ${wrapTextClass}`}>
                  {activeDisplayName}
                </p>
              </div>

              <div className="mt-4 rounded-[1.75rem] border border-amber-500/25 bg-amber-900/20 p-5 text-left">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-amber-100">
                    <KeyRound className="h-4 w-4" />
                    <p className="text-[11px] font-semibold tracking-[0.28em] text-amber-200/70 uppercase">
                      Kode-oversigt
                    </p>
                  </div>
                  <p className="text-xs font-bold text-amber-50">
                    {collectedEscapeRewardsCount}/{questions.length}
                  </p>
                </div>

                <p className="mt-4 text-sm text-amber-100/75">Dine brikker</p>
                <p
                  className={`mt-3 rounded-2xl border border-amber-300/12 bg-black/20 px-4 py-4 text-center text-2xl font-black tracking-[0.34em] text-amber-100 ${wrapTextClass}`}
                >
                  {escapeCodeOverviewText}
                </p>
              </div>

              <form onSubmit={handleMasterLockSubmit} className="mt-6 space-y-4">
                <input
                  type="text"
                  value={masterLockInput}
                  disabled={masterLockStatus === "unlocked" || isFinalizingEscape || isSubmitting}
                  onChange={(event) => actions.setMasterLockInput(event.target.value.toLocaleUpperCase("da-DK"))}
                  placeholder="Indtast hele master-koden"
                  className="w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-center text-2xl font-black tracking-[0.35em] text-amber-50 outline-none transition focus:border-amber-300/50 focus:ring-2 focus:ring-amber-300/20 disabled:cursor-default disabled:opacity-80"
                />

                {masterLockError ? (
                  <div
                    className={`rounded-2xl border border-red-300/25 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100 ${wrapTextClass}`}
                  >
                    {masterLockError}
                  </div>
                ) : null}

                {masterLockStatus === "unlocked" ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-emerald-300/25 bg-emerald-500/10 px-4 py-4 text-sm font-semibold text-emerald-50">
                      Låsen giver efter! Resultatet venter lige foran dig.
                    </div>
                    <button
                      type="button"
                      onClick={() => actions.setShowEscapeResults(true)}
                      disabled={showMasterVictory}
                      className="w-full rounded-2xl bg-amber-400 px-5 py-4 text-base font-black tracking-[0.24em] text-slate-950 uppercase transition hover:bg-amber-300"
                    >
                      Se din placering
                    </button>
                  </div>
                ) : (
                  <button
                    type="submit"
                    disabled={isFinalizingEscape || isSubmitting}
                    className="w-full rounded-2xl border border-amber-400/30 bg-amber-400/90 px-5 py-4 text-base font-black tracking-[0.24em] text-slate-950 uppercase transition hover:bg-amber-300"
                  >
                    {isFinalizingEscape ? "Åbner låsen..." : "Bryd låsen op"}
                  </button>
                )}
              </form>
            </div>
          </div>
        </div>
      );
      break;

    case "escape_results":
      content = (
        <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-slate-950 px-6 py-10 text-white">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.2),transparent_30%),radial-gradient(circle_at_18%_18%,rgba(16,185,129,0.12),transparent_24%),radial-gradient(circle_at_82%_12%,rgba(139,92,246,0.12),transparent_24%),linear-gradient(180deg,rgba(3,7,18,0.78)_0%,rgba(2,6,23,0.92)_55%,rgba(2,6,23,1)_100%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(120,53,15,0.4),transparent_36%)] blur-3xl" />

          <div className="relative z-10 w-full max-w-4xl overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/78 p-8 shadow-[0_32px_90px_rgba(2,6,23,0.56)] backdrop-blur-2xl sm:p-10">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.08),transparent_28%)]" />

            <div className="relative">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold tracking-[0.32em] text-amber-200/70 uppercase">
                    Escape-finale
                  </p>
                  <h1 className={`mt-3 text-3xl font-black text-white sm:text-4xl ${wrapTextClass}`}>
                    Du klarede det!
                  </h1>
                  <p className={`mt-4 text-base leading-7 text-amber-50/85 sm:text-lg ${wrapTextClass}`}>
                    Her er placeringen, nu hvor master-låsen er brudt op og målgangen er registreret.
                  </p>
                </div>

                <div className="rounded-[1.6rem] border border-amber-300/20 bg-amber-500/10 px-5 py-4 text-left shadow-[0_18px_40px_rgba(245,158,11,0.12)]">
                  <p className="text-[11px] font-semibold tracking-[0.28em] text-amber-200/70 uppercase">
                    Deltager
                  </p>
                  <p className={`mt-2 text-xl font-black text-amber-50 ${wrapTextClass}`}>
                    {activeDisplayName}
                  </p>
                </div>
              </div>

              <div className="mt-8 grid gap-4 lg:grid-cols-[1.1fr,1.3fr]">
                <div className="rounded-[1.8rem] border border-emerald-300/18 bg-emerald-950/35 p-6 shadow-[0_20px_45px_rgba(16,185,129,0.12)] backdrop-blur-xl">
                  <p className="text-xs font-semibold tracking-[0.26em] text-white/80 uppercase">
                    Jeres placering
                  </p>

                  {isLoadingEscapeResults ? (
                    <div className="mt-5 flex items-center gap-3 text-emerald-100/80">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span className={wrapTextClass}>Henter ranglisten...</span>
                    </div>
                  ) : myEscapePlacement ? (
                    <>
                      <p className="mt-4 text-5xl font-black text-emerald-200">
                        {formatPlacement(myEscapePlacement.place)}
                      </p>
                      <p className={`mt-3 text-sm text-emerald-50/80 ${wrapTextClass}`}>
                        Registreret kl. {formatFinishedAt(myEscapePlacement.finishedAt)}
                      </p>
                    </>
                  ) : (
                    <p className={`mt-4 text-sm text-emerald-50/80 ${wrapTextClass}`}>
                      Jeres placering bliver opdateret, så snart målgangen er synkroniseret.
                    </p>
                  )}
                </div>

                <div className="rounded-[1.8rem] border border-violet-300/18 bg-violet-950/24 p-6 shadow-[0_20px_45px_rgba(91,33,182,0.14)] backdrop-blur-xl">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold tracking-[0.26em] text-violet-200/70 uppercase">
                      Rangliste
                    </p>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold tracking-[0.22em] text-white/60 uppercase">
                      {escapeResults.length} deltagere
                    </span>
                  </div>

                  {isLoadingEscapeResults ? (
                    <div className="mt-5 flex items-center gap-3 text-violet-100/80">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span className={wrapTextClass}>Henter placeringer...</span>
                    </div>
                  ) : escapeResultsError ? (
                    <div className="mt-5 rounded-[1.35rem] border border-rose-300/20 bg-rose-500/10 px-4 py-4 text-sm text-rose-100">
                      <p className={wrapTextClass}>{escapeResultsError}</p>
                    </div>
                  ) : escapeResults.length > 0 ? (
                    <div className="mt-5 space-y-3">
                      {escapeResults.map((entry) => {
                        const isCurrentTeam =
                          entry.studentName.trim().toLocaleLowerCase("da-DK") ===
                          normalizedActiveDisplayName;

                        return (
                          <div
                            key={`${entry.studentName}-${entry.place}`}
                            className={`rounded-[1.35rem] border px-4 py-3 backdrop-blur-md ${
                              isCurrentTeam
                                ? "border-amber-300/30 bg-amber-500/12 shadow-[0_16px_34px_rgba(245,158,11,0.12)]"
                                : "border-white/10 bg-black/18"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold tracking-[0.22em] text-white/45 uppercase">
                                  {formatPlacement(entry.place)}
                                </p>
                                <p className={`mt-1 text-lg font-black text-white ${wrapTextClass}`}>
                                  {entry.studentName}
                                </p>
                              </div>
                              <p className="shrink-0 text-sm font-semibold text-amber-100/80">
                                {formatFinishedAt(entry.finishedAt)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className={`mt-5 text-sm text-violet-100/80 ${wrapTextClass}`}>
                      Ingen placeringer er registreret endnu.
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-8 rounded-[1.5rem] border border-white/10 bg-black/20 px-5 py-4 text-sm text-amber-50/85 backdrop-blur-xl">
                <p className={wrapTextClass}>
                  Kig op på arrangørens skærm, hvis I også vil se den store fælles finale.
                </p>
              </div>
            </div>
          </div>
        </div>
      );
      break;

    case "finished":
      content = (
        <div className="relative flex min-h-screen w-full flex-col items-center overflow-hidden bg-slate-950 px-6 py-10 text-white">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(16,185,129,0.25),transparent_40%),radial-gradient(circle_at_80%_10%,rgba(251,191,36,0.22),transparent_42%),radial-gradient(circle_at_50%_90%,rgba(139,92,246,0.16),transparent_40%)]" />
          <div className="pointer-events-none absolute inset-0 opacity-80">
            <LottiePlayer autoplay loop src={FIREWORKS_LOTTIE_URL} style={{ width: "100%", height: "100%" }} />
          </div>
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {Array.from({ length: 20 }).map((_, index) => (
              <span
                key={`student-confetti-${index}`}
                className="absolute h-2.5 w-2.5 animate-pulse rounded-full bg-gradient-to-br from-amber-300 via-emerald-300 to-violet-300 shadow-[0_0_10px_rgba(255,255,255,0.35)]"
                style={{
                  top: `${(index * 29) % 100}%`,
                  left: `${(index * 17) % 100}%`,
                  animationDelay: `${(index % 8) * 0.22}s`,
                }}
              />
            ))}
          </div>

          <div className="relative z-10 mt-10 w-full max-w-lg rounded-3xl border border-white/20 bg-white/10 p-8 text-center shadow-[0_0_45px_rgba(251,191,36,0.3)] backdrop-blur-xl">
            <div className="mx-auto mb-6 h-36 w-36 drop-shadow-2xl">
              <Lottie animationData={trophyAnimation} loop={true} />
            </div>
            <h1 className="mb-2 bg-gradient-to-r from-yellow-200 via-amber-300 to-yellow-100 bg-clip-text text-4xl font-black tracking-widest text-transparent uppercase">
              Mission
              <br />
              Fuldført!
            </h1>
            <p className={`mb-3 text-lg font-bold text-emerald-100 ${wrapTextClass}`}>
              Fantastisk gået, {playerName || "mester"}!
            </p>
            <p
              className={`mb-6 text-sm font-semibold tracking-wide text-amber-100 uppercase ${wrapTextClass}`}
            >
              KÆMPE TILLYKKE, {celebrationName}! Du er i mål!
            </p>
            <div className="rounded-xl border border-white/20 bg-black/35 px-4 py-3 text-sm font-medium text-slate-100">
              Løbet er slut. Kig op på arrangørens skærm og se den store podie-fejring!
            </div>
          </div>
        </div>
      );
      break;

    case "active":
      content = (
        <div
          className={`relative flex h-[100svh] min-h-[100svh] w-full flex-col overflow-hidden bg-slate-950 text-white ${poppins.className}`}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.16),transparent_28%),radial-gradient(circle_at_20%_18%,rgba(56,189,248,0.12),transparent_24%),radial-gradient(circle_at_80%_8%,rgba(34,197,94,0.1),transparent_22%),linear-gradient(180deg,rgba(2,6,23,0.78)_0%,rgba(2,6,23,0.92)_52%,rgba(2,6,23,1)_100%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03),transparent_60%)]" />

          <div className="pointer-events-none absolute inset-x-4 top-4 z-[1200] flex justify-center">
            <div className="w-full max-w-3xl rounded-2xl bg-amber-400/95 px-3 py-2 text-center text-sm sm:px-4 sm:py-3 font-black uppercase tracking-wide text-slate-900 drop-shadow-lg">
              Find den ravgule markør på kortet og gå hen til den!
            </div>
          </div>

          {gpsWarningContent ? (
            <div className="pointer-events-none absolute inset-x-4 top-4 z-[1100] flex justify-center">
              <div className="w-full max-w-xl rounded-[1.5rem] border border-amber-300/30 bg-amber-500/14 px-4 py-3 text-amber-50 shadow-[0_18px_40px_rgba(245,158,11,0.16)] backdrop-blur-xl">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-full border border-amber-300/25 bg-amber-300/12 p-2 text-amber-200">
                    <AlertCircle className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="sr-only">
                      Dårligt GPS-signal
                    </p>
                    <p className="text-[11px] font-semibold tracking-[0.24em] text-amber-100/80 uppercase">
                      Dårligt GPS-signal
                    </p>
                    <p className={`mt-1 text-sm font-semibold text-white ${wrapTextClass}`}>
                      {gpsWarningContent.message}
                    </p>
                    <p className={`mt-1 text-xs text-amber-100/80 ${wrapTextClass}`}>
                      {gpsWarningContent.helper}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div
            className={`hidden sm:block absolute inset-x-4 z-[1000] space-y-4 transition-all duration-300 ${
              gpsWarningContent ? "top-28" : "top-4"
            } ${isRoleplayImmersed ? "pointer-events-none opacity-0 blur-md" : "opacity-100"}`}
          >
            <div className={tacticalHudShellClass}>
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.08),transparent_30%)]" />
              <div className="relative flex flex-col gap-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1 space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={tacticalPillClass}>
                        Deltager
                      </span>
                      <span className={`${tacticalPillClass} border-white/20 bg-white/10 text-white/80`}>
                        Nature-Glass
                      </span>
                    </div>

                    {isEscapeRace ? (
                      <div className="overflow-hidden rounded-[1.6rem] border border-white/20 bg-white/10 p-4 shadow-lg backdrop-blur-2xl">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-white">
                            <KeyRound className="h-4 w-4" />
                            <p className={tacticalMetaLabelClass}>
                              Kode-oversigt
                            </p>
                          </div>
                          <span className={`${tacticalPillClass} px-3 py-1`}>
                            {collectedEscapeRewardsCount}/{questions.length}
                          </span>
                        </div>
                        <p className="mt-3 font-mono text-xs uppercase tracking-widest text-white/70">
                          Dine brikker
                        </p>
                        <p className={`mt-2 text-xl font-black tracking-[0.3em] text-white/90 ${wrapTextClass}`}>
                          {escapeCodeOverviewText}
                        </p>
                      </div>
                    ) : null}

                    <div className="grid gap-3 sm:grid-cols-[1.35fr,1fr]">
                      <div className={tacticalHudCardClass}>
                        <p className={tacticalMetaLabelClass}>
                          Deltagernavn
                        </p>
                        <p className={`mt-2 text-2xl font-black text-white ${wrapTextClass}`}>
                          {activeDisplayName}
                        </p>
                        <p className="mt-2 font-mono text-xs uppercase tracking-widest text-white/70">
                          Find post {currentPostIndex + 1} af {questions.length}
                        </p>
                      </div>

                      <div className={tacticalHudCardClass}>
                        <p className={tacticalMetaLabelClass}>
                          Afstand
                        </p>
                        <p
                          className={`mt-2 text-3xl font-black ${
                            distance !== null && distance <= AUTO_UNLOCK_RADIUS
                              ? "text-white"
                              : "text-white/90"
                          }`}
                        >
                          {distance !== null ? `${distance}m` : "Søger GPS..."}
                        </p>
                        <p className="mt-2 font-mono text-xs uppercase tracking-widest text-white/70">
                          GPS låser automatisk op tæt på posten.
                        </p>
                      </div>
                    </div>

                    <div className={tacticalHudCardClass}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className={tacticalMetaLabelClass}>
                            Fremskridt
                          </p>
                          <p className="mt-1 font-mono text-xs uppercase tracking-widest text-white/70">
                            Du er {progressPercent}% gennem ruten.
                          </p>
                        </div>
                        <p className="font-mono text-xs font-black uppercase tracking-widest text-white/90">
                          {correctAnswersCount}/{questions.length}
                        </p>
                      </div>
                      <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-emerald-500 shadow-[0_0_18px_rgba(16,185,129,0.35)] transition-all duration-500"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 md:items-end">
                    {!isEscapeRace ? (
                      <div className="inline-flex items-center gap-3 self-start rounded-[1.75rem] border border-white/20 bg-white/10 px-3 py-3 shadow-lg backdrop-blur-2xl md:self-auto">
                        <div className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full border border-white/20 bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl">
                          <div className="text-center">
                            <p className="font-mono text-[10px] uppercase tracking-widest text-white/70">
                              Point
                            </p>
                            <p className="text-3xl font-black text-white">{correctAnswersCount}</p>
                          </div>
                        </div>
                        <div>
                          <p className={tacticalMetaLabelClass}>
                            Medalje
                          </p>
                          <p className="mt-1 text-sm font-semibold text-white/85">
                            Din score vokser for hver fundet post.
                          </p>
                        </div>
                      </div>
                    ) : null}

                    {canManualUnlock ? (
                      <button
                        type="button"
                        onClick={actions.unlockCurrentPost}
                        className={tacticalPrimaryButtonClass}
                      >
                        {dismissedPostIndex === currentPostIndex
                          ? "Åbn gåden igen"
                          : "📍 Står du ved posten? Lås op manuelt"}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            {latestMessage ? (
              <div className="animate-in slide-in-from-top fade-in duration-500">
                <div className="flex items-start gap-3 rounded-[1.5rem] border border-white/20 bg-white/10 p-4 shadow-lg backdrop-blur-2xl">
                  <div className="mt-0.5 rounded-full border border-white/20 bg-white/10 p-2 text-white/80">
                    <AlertCircle className="h-4 w-4" />
                  </div>
                  <div>
                    <div className={tacticalMetaLabelClass}>
                      Besked fra arrangøren
                    </div>
                    <div className={`text-sm font-medium text-white ${wrapTextClass}`}>{latestMessage}</div>
                  </div>
                </div>
              </div>
            ) : null}

            {resumeMessage ? (
              <div className="animate-in slide-in-from-top fade-in duration-500">
                <div className="flex items-start gap-3 rounded-[1.5rem] border border-white/20 bg-white/10 p-4 shadow-lg backdrop-blur-2xl">
                  <div className="mt-0.5 rounded-full border border-white/20 bg-white/10 p-2 text-white/80">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div className={`text-sm font-medium text-white ${wrapTextClass}`}>{resumeMessage}</div>
                </div>
              </div>
            ) : null}
          </div>

          <div
            className={`pointer-events-none absolute inset-x-4 bottom-20 z-[950] flex justify-center transition-all duration-300 ${
              isRoleplayImmersed ? "opacity-0 blur-md" : "opacity-100"
            }`}
          >
            <div className="w-full max-w-xl rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-center font-mono text-xs font-semibold uppercase tracking-widest text-white shadow-lg backdrop-blur-2xl">
              <span className="text-white/90">Tip:</span> Hold skærmen tændt mens du går, så arrangøren kan se dig på kortet!
            </div>
          </div>

          {/* Mobile compact HUD: visible only on small screens and keeps map visible */}
          <div className="sm:hidden absolute inset-x-4 bottom-4 z-[1100] flex items-end justify-center">
            <MobileHud />
          </div>

          <div className="absolute inset-0 z-[1] h-full w-full">
            {children}
          </div>

          {showQuestion && activeQuestion ? (
            <div className="animate-in fade-in zoom-in absolute inset-0 z-[2000] overflow-y-auto bg-slate-900/80 p-6 backdrop-blur-md duration-300">
              <div className="flex min-h-full items-center justify-center">
                <div className={tacticalOverlayCardClass}>
                  <div className="mb-6 flex items-center justify-between gap-3">
                    <span className={tacticalPillClass}>Mission Device</span>
                    <span className={tacticalMetaLabelClass}>Post {currentPostIndex + 1}</span>
                  </div>
                {activePostVariant === "escape" ? (
                  <div className="mb-6">
                    <h2 className={`text-2xl font-black text-white ${wrapTextClass} ${rubik.className}`}>
                      Løs gåden for at få en kode-brik
                    </h2>
                  </div>
                ) : null}

                {activeQuestion.mediaUrl &&
                activePostVariant !== "escape" &&
                activePostVariant !== "photo" ? (
                  <div className="mb-5 overflow-hidden rounded-xl border border-emerald-500/20">
                    <Image
                      src={activeQuestion.mediaUrl}
                      alt="Spørgsmålsmedie"
                      width={800}
                      height={450}
                      className="h-auto w-full object-cover"
                      unoptimized
                      loader={({ src }) => src}
                    />
                  </div>
                ) : null}

                {activePostVariant === "quiz" ? (
                  <>
                    <p className={`mb-6 text-2xl font-black text-white ${wrapTextClass} ${rubik.className}`}>
                      {activeQuestion.text}
                    </p>

                    <div className="space-y-3">
                      {activeQuestion.answers.map((answer, idx) => {
                        const isSelectedFeedback = activeQuizAnswerFeedback?.selectedIndex === idx;
                        const isSuccessAnswer =
                          isSelectedFeedback && activeQuizAnswerFeedback?.tone === "success";
                        const isErrorAnswer =
                          isSelectedFeedback && activeQuizAnswerFeedback?.tone === "error";

                        return (
                          <button
                            key={idx}
                            type="button"
                            disabled={Boolean(hasActiveQuizSuccess) || isSubmittingAnswer || isSubmitting}
                            onClick={() => void actions.submitQuizAnswer(idx)}
                            className={`min-h-[56px] w-full overflow-hidden rounded-[1.35rem] border p-4 text-left text-base font-black uppercase tracking-[0.2em] transition-all sm:text-lg ${wrapTextClass} ${rubik.className} ${
                              isSuccessAnswer
                                ? "animate-pulse border-emerald-300 bg-emerald-500 text-slate-950 shadow-[0_18px_38px_rgba(16,185,129,0.3)]"
                              : isErrorAnswer
                                  ? "border-rose-400/60 bg-rose-500/18 text-rose-50 shadow-[0_14px_30px_rgba(244,63,94,0.18)]"
                                  : "border-emerald-500 bg-emerald-600 text-white shadow-md hover:scale-[1.02] hover:bg-emerald-500"
                            } disabled:cursor-default disabled:hover:border-emerald-300 disabled:hover:bg-emerald-500 disabled:hover:scale-100`}
                          >
                            {answer}
                          </button>
                        );
                      })}
                    </div>

                    {hasActiveQuizSuccess ? (
                      <div className="mt-4 space-y-4">
                        <div className={tacticalSuccessPanelClass}>
                          <p className="font-mono text-xs font-black uppercase tracking-[0.32em] text-slate-950/70">
                            Kode accepteret
                          </p>
                          <p className={`mt-3 text-xl font-black text-slate-950 ${wrapTextClass}`}>
                            Missionen er godkendt. Fortsæt.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => void actions.continueFromSolvedPost()}
                          className={tacticalPrimaryButtonClass}
                        >
                          {currentPostIndex + 1 < questions.length ? "Gå til næste post" : "Se resultat"}
                        </button>

                        {activePostActionError ? (
                          <div
                            className={`rounded-2xl border border-red-300/30 bg-red-500/12 px-4 py-3 text-sm font-semibold text-red-50 ${wrapTextClass}`}
                          >
                            {activePostActionError}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {activeTypedAnswerError ? (
                      <div
                        className={`mt-4 rounded-2xl border border-red-300/30 bg-red-500/12 px-4 py-3 text-sm font-semibold text-red-50 ${wrapTextClass}`}
                      >
                        {activeTypedAnswerError}
                      </div>
                    ) : null}
                  </>
                ) : null}

                {activePostVariant === "photo" ? (
                  <div className="space-y-5 overflow-hidden">
                    <p className={`text-2xl font-black text-white sm:text-3xl ${wrapTextClass} ${rubik.className}`}>
                      {activeQuestion.text}
                    </p>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      capture={isSelfiePhotoTask ? "user" : "environment"}
                      onChange={handlePhotoCapture}
                      className="hidden"
                    />

                    {!hasActivePhotoSuccess ? (
                      <button
                        type="button"
                        onClick={() => photoInputRef.current?.click()}
                        disabled={isAnalyzingPhoto || isSubmitting}
                        className={`${tacticalPrimaryButtonClass} break-words hyphens-auto text-base`}
                      >
                        {isAnalyzingPhoto ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            AI analyserer billedet...
                          </>
                        ) : (
                          <>
                            <Camera className="h-5 w-5" />
                            {isSelfiePhotoTask ? "TAG SELFIE" : "ÅBN KAMERA"}
                          </>
                        )}
                      </button>
                    ) : null}

                    {activePhotoFeedback ? (
                      activePhotoFeedback.tone === "success" ? (
                        <div className="space-y-4">
                          <div className={tacticalSuccessPanelClass}>
                            <p className="font-mono text-xs font-black uppercase tracking-[0.32em] text-slate-950/70">
                              Mission godkendt
                            </p>
                            <p className={`mt-3 text-xl font-black text-slate-950 ${wrapTextClass}`}>
                              {activePhotoFeedback.message}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => void actions.continueFromSolvedPost()}
                            className={tacticalPrimaryButtonClass}
                          >
                            Gå videre
                          </button>

                          {activePostActionError ? (
                            <div
                              className={`rounded-2xl border border-red-300/30 bg-red-500/12 px-4 py-3 text-sm font-semibold text-red-50 ${wrapTextClass}`}
                            >
                              {activePostActionError}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div className="overflow-hidden rounded-2xl border border-orange-300/35 bg-orange-500/12 px-4 py-4 text-sm text-orange-50 shadow-[0_18px_40px_rgba(249,115,22,0.16)] backdrop-blur-md">
                          <p className={`font-semibold ${wrapTextClass}`}>{activePhotoFeedback.message}</p>
                        </div>
                      )
                    ) : null}
                  </div>
                ) : null}

                {activePostVariant === "escape" ? (
                  <div className="space-y-6 overflow-hidden">
                    <p className={`text-xl font-bold text-white ${wrapTextClass} ${rubik.className}`}>{activeQuestion.text}</p>

                    {activeEscapeReward ? (
                      <div className="space-y-4">
                        <div className={tacticalSuccessPanelClass}>
                          <p className="font-mono text-xs font-black uppercase tracking-[0.32em] text-slate-950/70">
                            Kode accepteret
                          </p>
                          <p className={`mt-3 text-lg font-black text-slate-950 ${wrapTextClass}`}>
                            Flot! Din kode-brik er:
                          </p>
                          <div className="mt-5 rounded-[1.6rem] border border-slate-950/10 bg-slate-950/85 px-4 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                            <p
                              className={`text-5xl font-black tracking-[0.36em] text-emerald-300 sm:text-6xl ${wrapTextClass}`}
                            >
                              {activeEscapeReward}
                            </p>
                          </div>
                          <p className="mt-4 text-sm text-slate-950/75">
                            Brikken er gemt i din kode-oversigt.
                          </p>
                          {hasAllEscapeBricks ? (
                            <p className="mt-3 text-sm font-semibold text-slate-950/80">
                              Du har alle kode-brikker. Master-låsen er klar.
                            </p>
                          ) : null}
                        </div>

                        <button
                          type="button"
                          onClick={() => void actions.continueFromSolvedPost()}
                          className={tacticalPrimaryButtonClass}
                        >
                          {hasAllEscapeBricks ? "Åbn Master-lås" : "Videre til næste post"}
                        </button>

                        {activePostActionError ? (
                          <div
                            className={`rounded-2xl border border-red-300/30 bg-red-500/12 px-4 py-3 text-sm font-semibold text-red-50 ${wrapTextClass}`}
                          >
                            {activePostActionError}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <form onSubmit={handleTypedAnswerSubmit} className="space-y-5">
                        <div className="space-y-3">
                          <label className={tacticalMetaLabelClass}>
                            Svaret
                          </label>
                          <input
                            key={`escape-input-${activeTypedAnswerKey}`}
                            ref={typedAnswerInputRef}
                            type="text"
                            autoComplete="off"
                            spellCheck={false}
                            disabled={isCheckingEscapeAnswer || isSubmitting}
                            onChange={() => {
                              actions.clearTypedAnswerError();
                              actions.clearPostActionError();
                            }}
                            placeholder="Skriv tallet eller ordet her"
                            className={`${tacticalInputClass} text-lg`}
                          />
                        </div>

                        {activeEscapeHint ? (
                          <div
                            className={`rounded-2xl border border-amber-300/30 bg-amber-500/12 px-4 py-3 text-sm font-semibold text-amber-50 shadow-[0_16px_34px_rgba(245,158,11,0.12)] ${wrapTextClass}`}
                          >
                            {`💡 Brug for hjælp? Hint: ${activeEscapeHint}`}
                          </div>
                        ) : null}

                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={actions.dismissCurrentPost}
                            disabled={isCheckingEscapeAnswer || isSubmitting}
                            className={tacticalSecondaryButtonClass}
                          >
                            Annuller
                          </button>
                          <button
                            type="submit"
                            disabled={isCheckingEscapeAnswer || isSubmitting}
                            className={tacticalPrimaryButtonClass}
                          >
                            {isCheckingEscapeAnswer ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Tjekker...
                              </>
                            ) : (
                              "Tjek svar"
                            )}
                          </button>
                        </div>

                        {activeTypedAnswerError ? (
                          <p className={`text-sm text-amber-200/85 ${wrapTextClass}`}>
                            {activeTypedAnswerError}
                          </p>
                        ) : null}
                      </form>
                    )}
                  </div>
                ) : null}

                {activePostVariant === "roleplay" ? (
                  <div className="space-y-5 overflow-hidden">
                    <div className="overflow-hidden rounded-[1.75rem] border border-emerald-500/20 bg-slate-950/80 p-4 shadow-[0_18px_40px_rgba(16,185,129,0.12)] backdrop-blur-xl">
                      <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-emerald-500/20 bg-slate-950 text-2xl shadow-inner shadow-black/20">
                          {roleplayAvatar && looksLikeImageSource(roleplayAvatar) ? (
                            <Image
                              src={roleplayAvatar}
                              alt={roleplayCharacterName}
                              width={56}
                              height={56}
                              className="h-full w-full object-cover"
                              unoptimized
                              loader={({ src }) => src}
                            />
                          ) : (
                            <span>{roleplayAvatar || "🕰️"}</span>
                          )}
                        </div>

                        <div className="min-w-0">
                          <p
                            className={`${tacticalMetaLabelClass} ${wrapTextClass}`}
                          >
                            Tidsmaskinen
                          </p>
                          <p className={`mt-1 text-lg font-black text-white ${wrapTextClass} ${rubik.className}`}>
                            {roleplayCharacterName}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="relative ml-2 overflow-hidden rounded-[1.75rem] border border-emerald-500/20 bg-slate-950/80 p-5 shadow-[0_18px_40px_rgba(16,185,129,0.12)] backdrop-blur-xl">
                      <span className="absolute -left-2 top-6 h-4 w-4 rotate-45 rounded-[0.45rem] border-l border-t border-emerald-500/20 bg-slate-950/80" />
                      <p className={`pr-1 text-lg leading-relaxed text-white sm:text-xl ${wrapTextClass}`}>
                        {getRoleplayMessage(activeQuestion)}
                      </p>
                    </div>

                    {activeRoleplayReply ? (
                      <div
                        className={`animate-in fade-in zoom-in-95 duration-300 space-y-4 overflow-hidden rounded-[1.85rem] border p-5 backdrop-blur-xl ${
                          activeRoleplayReply.tone === "success"
                            ? "border-emerald-300/30 bg-[linear-gradient(145deg,rgba(5,46,22,0.88),rgba(16,185,129,0.18))] shadow-[0_24px_55px_rgba(16,185,129,0.18)]"
                            : "border-emerald-500/20 bg-slate-950/80 shadow-[0_24px_55px_rgba(16,185,129,0.12)]"
                        }`}
                      >
                        <p
                          className={`text-xs font-semibold tracking-[0.24em] uppercase ${wrapTextClass} ${
                            activeRoleplayReply.tone === "success"
                              ? "text-emerald-100/75"
                              : "text-emerald-200"
                          }`}
                        >
                          {activeRoleplayReply.isLoading
                            ? `${roleplayCharacterName} tænker...`
                            : `Svar fra ${roleplayCharacterName}`}
                        </p>
                        <div
                          className={`rounded-[1.35rem] border p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ${
                            activeRoleplayReply.tone === "success"
                              ? "border-emerald-200/15 bg-white/8"
                              : "border-emerald-500/20 bg-slate-950"
                          }`}
                        >
                          <p
                            className={`text-sm leading-relaxed ${wrapTextClass} ${
                              activeRoleplayReply.tone === "success"
                                ? "text-emerald-50"
                                : "text-emerald-50"
                            }`}
                          >
                            {activeRoleplayReply.isLoading ? (
                              <span className="inline-flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Tænker...
                              </span>
                            ) : (
                              activeRoleplayReplyMessage
                            )}
                          </p>
                        </div>
                        {activeRoleplayReply.canContinue ? (
                          <button
                            type="button"
                            onClick={() => void actions.continueFromSolvedPost()}
                            className={tacticalPrimaryButtonClass}
                          >
                            Fortsæt rejsen -&gt;
                          </button>
                        ) : null}

                        {activePostActionError ? (
                          <div
                            className={`rounded-2xl border border-red-300/30 bg-red-500/12 px-4 py-3 text-sm font-semibold text-red-50 ${wrapTextClass}`}
                          >
                            {activePostActionError}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {!activeRoleplayReply?.canContinue ? (
                      <form
                        onSubmit={handleTypedAnswerSubmit}
                        className={`overflow-hidden rounded-[1.75rem] border bg-slate-950/80 p-4 shadow-[0_18px_38px_rgba(16,185,129,0.14)] backdrop-blur-xl transition-all ${
                          hasRoleplayInputErrorTone
                            ? "border-rose-300/45 shadow-[0_20px_45px_rgba(244,63,94,0.18)]"
                            : "border-emerald-500/20"
                        }`}
                      >
                        <div className="flex items-end gap-3">
                          <input
                            key={`roleplay-input-${activeTypedAnswerKey}`}
                            ref={typedAnswerInputRef}
                            type="text"
                            disabled={isSubmittingAnswer || isSubmitting}
                            onChange={() => {
                              actions.clearRoleplayInputErrorTone();
                              actions.clearTypedAnswerError();
                              actions.clearPostActionError();
                            }}
                            onFocus={(event) => {
                             event.currentTarget.scrollIntoView({
                                behavior: "smooth",
                                block: "center",
                              });
                            }}
                            placeholder={`Skriv dit svar til ${roleplayCharacterName}...`}
                            className={`min-w-0 flex-1 rounded-[1.35rem] border bg-slate-950 px-4 py-3 text-base text-emerald-50 outline-none transition placeholder:text-white/40 focus:ring-2 ${
                              hasRoleplayInputErrorTone
                                ? "border-rose-300/45 focus:border-rose-300/55 focus:ring-rose-300/20"
                                : "border-emerald-500/50 focus:border-emerald-400 focus:ring-emerald-400/20"
                            } disabled:cursor-not-allowed disabled:opacity-70`}
                          />
                          <button
                            type="submit"
                            disabled={isSubmittingAnswer || isSubmitting}
                            className={`${tacticalPrimaryButtonClass} min-w-[11rem] shrink-0`}
                          >
                            Send besked
                          </button>
                        </div>

                        {activeTypedAnswerError ? (
                          <p className={`mt-3 text-sm text-emerald-200/85 ${wrapTextClass}`}>
                            {activeTypedAnswerError}
                          </p>
                        ) : null}
                      </form>
                    ) : null}
                  </div>
                ) : null}

                {activePostVariant === "unknown" ? (
                  <div className="space-y-4 overflow-hidden rounded-3xl border border-emerald-500/20 bg-slate-950 p-5">
                    <p
                      className={`${tacticalMetaLabelClass} ${wrapTextClass}`}
                    >
                      Ukendt post
                    </p>
                    <h3 className={`text-xl font-black text-white ${wrapTextClass} ${rubik.className}`}>⚠️ Ukendt post-type</h3>
                    <p className={`text-sm leading-relaxed text-white/80 ${wrapTextClass}`}>
                      Noget gik galt med dataen for denne post. Kontakt din arrangør.
                    </p>
                  </div>
                ) : null}
              </div>
              </div>
            </div>
          ) : null}
        </div>
      );
      break;

    default:
      content = null;
      break;
  }

  return (
    <>
      {content}
      <style jsx global>{`
        @keyframes master-lock-shake {
          0%,
          100% {
            transform: translateX(0);
          }
          20% {
            transform: translateX(-10px);
          }
          40% {
            transform: translateX(8px);
          }
          60% {
            transform: translateX(-6px);
          }
          80% {
            transform: translateX(4px);
          }
        }

        @keyframes master-lock-spark {
          0% {
            opacity: 0;
            transform: scale(0.2) translateY(20px);
          }
          20% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: scale(1.4) translateY(-80px);
          }
        }
      `}</style>
    </>
  );
}
