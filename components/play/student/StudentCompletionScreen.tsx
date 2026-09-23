import Link from "next/link";

import Mascot from "@/components/brand/Mascot";
import StudentSubmissionStatus from "../StudentSubmissionStatus";
import StudentTeamBadge from "./StudentTeamBadge";
import type { StudentSubmissionState } from "@/lib/submissions/studentSubmissionState";

type StudentCompletionScreenProps = {
  answeredPosts: number;
  isAuthoritativelyCompleted: boolean;
  playerName: string;
  score: number;
  teamColor?: string | null;
  teamId?: string | null;
  totalPosts: number;
  pendingSubmission?: StudentSubmissionState;
  onRetrySubmission?: () => void;
};

export default function StudentCompletionScreen({
  answeredPosts,
  isAuthoritativelyCompleted,
  playerName,
  score,
  teamColor,
  teamId,
  totalPosts,
  pendingSubmission,
  onRetrySubmission,
}: StudentCompletionScreenProps) {
  const hasTerminalSubmission =
    pendingSubmission?.status === "rejected" ||
    pendingSubmission?.status === "session_closed";
  const isSettlingLastSubmission =
    Boolean(pendingSubmission) && !hasTerminalSubmission;
  const heading = isSettlingLastSubmission
    ? "Vi gør dit svar færdigt"
    : isAuthoritativelyCompleted
      ? "Løbet er slut."
      : "Løbet er afsluttet.";
  const description = isSettlingLastSubmission
    ? "Bliv her, mens vi sikrer, at dit sidste svar bliver registreret korrekt."
    : isAuthoritativelyCompleted
      ? `Godt gået${playerName ? `, ${playerName}` : ""}. Jeres registrerede resultat er klar hos læreren.`
      : hasTerminalSubmission
        ? "Læreren har afsluttet løbet, før dit sidste svar kunne blive registreret."
        : "Læreren har afsluttet løbet. Her er kun det resultat, som allerede er registreret.";

  return (
    <main
      data-testid="student-adventure-finish"
      className="relative flex min-h-svh w-full items-center justify-center overflow-hidden bg-[#04112d] px-4 py-8 text-white sm:px-6"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.32),transparent_34%),radial-gradient(circle_at_bottom,rgba(37,99,235,0.18),transparent_42%),linear-gradient(180deg,#071f5b_0%,#04112d_74%)]" />
      <div className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-sky-100/20 bg-slate-950/72 p-6 text-center shadow-[0_30px_90px_rgba(2,6,23,0.58)] backdrop-blur-2xl sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(186,230,253,0.13),transparent_30%),linear-gradient(145deg,rgba(255,255,255,0.05),transparent_50%)]" />
        <div className="relative">
          <Mascot
            size="lg"
            variant={isSettlingLastSubmission ? "thinking" : isAuthoritativelyCompleted ? "celebrate" : "guide"}
            priority
            className="mx-auto"
          />
          <p className="mt-2 text-xs font-bold uppercase tracking-[0.28em] text-sky-200">Pilen siger</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">{heading}</h1>
          <p className="mx-auto mt-3 max-w-sm text-base leading-7 text-sky-50/86">
            {description}
          </p>

          {pendingSubmission ? (
            <div className="mt-5 text-left">
              <StudentSubmissionStatus
                state={pendingSubmission}
                onRetry={onRetrySubmission}
                retryDisabled={pendingSubmission.status === "submitting"}
              />
              {pendingSubmission.status === "idle" ||
              pendingSubmission.status === "editing" ? (
                <p
                  role="status"
                  className="rounded-2xl border border-sky-300/35 bg-sky-500/12 px-4 py-4 text-sm font-semibold leading-6 text-sky-50"
                >
                  Et svar afventer stadig. Bliv her, mens vi henter den
                  seneste status fra løbet.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <StudentTeamBadge
              color={teamColor}
              teamId={teamId}
              label={
                isAuthoritativelyCompleted
                  ? teamId
                    ? "Holdets resultat"
                    : "Dit resultat"
                  : teamId
                    ? "Holdstatus"
                    : "Din status"
              }
            />
          </div>

          {!pendingSubmission ? (
            <div className="mt-5 grid grid-cols-2 gap-3 text-left">
              <div className="rounded-2xl border border-white/12 bg-white/[0.06] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-100/65">Point</p>
                <p className="mt-1 text-2xl font-black text-white">{score}</p>
              </div>
              <div className="rounded-2xl border border-white/12 bg-white/[0.06] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-100/65">Besvaret</p>
                <p className="mt-1 text-2xl font-black text-white">{answeredPosts}/{totalPosts}</p>
              </div>
            </div>
          ) : null}

          {!pendingSubmission || hasTerminalSubmission ? (
            <>
              <p className="mt-5 text-sm leading-6 text-slate-300">
                Kig gerne op hos læreren, hvis klassen samler resultatet der.
              </p>

              <Link
                href="/join"
                className="mt-6 inline-flex min-h-14 w-full items-center justify-center rounded-2xl bg-sky-400 px-5 py-3 text-base font-black text-slate-950 shadow-[0_16px_36px_rgba(14,165,233,0.28)] transition hover:bg-sky-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200/80 motion-reduce:transition-none"
              >
                Tilbage til start
              </Link>
            </>
          ) : null}
        </div>
      </div>
    </main>
  );
}
