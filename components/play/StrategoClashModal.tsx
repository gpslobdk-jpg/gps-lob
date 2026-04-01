"use client";

import { Crown, Shield, Swords, Target, Trophy, XCircle } from "lucide-react";

import type { StrategoDuelEvent } from "./types";

type StrategoClashModalProps = {
  event: StrategoDuelEvent | null;
  playerParticipantId: string | null;
  roleNamesByKey: Map<string, string>;
  onClose: () => void;
};

const FALLBACK_ROLE_NAMES: Record<string, string> = {
  flag: "Fane",
  bomb: "Bombe",
  spy: "Spion",
  scout: "Spejder",
  miner: "Minør",
  sergeant: "Sergent",
  lieutenant: "Løjtnant",
  captain: "Kaptajn",
  major: "Major",
  colonel: "Oberst",
  general: "General",
  marshal: "Feltmarskal",
};

function getRoleName(rankKey: string, roleNamesByKey: Map<string, string>) {
  return roleNamesByKey.get(rankKey) ?? FALLBACK_ROLE_NAMES[rankKey] ?? rankKey;
}

function getRoleGlyph(rankKey: string) {
  switch (rankKey) {
    case "flag":
      return "⚑";
    case "bomb":
      return "✹";
    case "spy":
      return "◉";
    case "scout":
      return "➤";
    case "miner":
      return "⛏";
    case "sergeant":
      return "S";
    case "lieutenant":
      return "L";
    case "captain":
      return "K";
    case "major":
      return "M";
    case "colonel":
      return "O";
    case "general":
      return "G";
    case "marshal":
      return "FM";
    default:
      return "?";
  }
}

function getRoleAccent(rankKey: string) {
  switch (rankKey) {
    case "flag":
      return "from-amber-300/35 via-amber-500/15 to-amber-900/40 border-amber-200/30 text-amber-50";
    case "bomb":
      return "from-rose-300/30 via-rose-500/12 to-rose-950/40 border-rose-200/25 text-rose-50";
    case "spy":
      return "from-fuchsia-300/30 via-fuchsia-500/12 to-fuchsia-950/40 border-fuchsia-200/25 text-fuchsia-50";
    case "marshal":
      return "from-cyan-300/30 via-cyan-500/14 to-cyan-950/40 border-cyan-200/25 text-cyan-50";
    default:
      return "from-white/16 via-white/8 to-slate-950/60 border-white/12 text-white";
  }
}

function getPerspectiveTitle(event: StrategoDuelEvent, playerParticipantId: string | null) {
  const flagCaptured = event.attackerRoleKey === "flag" || event.defenderRoleKey === "flag";
  const isWinner = Boolean(playerParticipantId) && event.winnerId === playerParticipantId;
  const isLoser = Boolean(playerParticipantId) && event.loserId === playerParticipantId;

  if (flagCaptured && isWinner) {
    return "FANEN ER EROBRET! DIT HOLD HAR VUNDET!";
  }

  if (flagCaptured && isLoser) {
    return "FANEN ER EROBRET! MODSTANDEREN HAR VUNDET!";
  }

  if (event.isDraw) {
    return "UAFGJORT";
  }

  if (isWinner) {
    return "DU VANDT DUELLEN";
  }

  if (isLoser) {
    return "DU TABTE DUELLEN";
  }

  return "DUEL AFSLUTTET";
}

function getPerspectiveBody(event: StrategoDuelEvent, playerParticipantId: string | null) {
  const isAttacker = Boolean(playerParticipantId) && event.attackerId === playerParticipantId;
  const isWinner = Boolean(playerParticipantId) && event.winnerId === playerParticipantId;
  const isLoser = Boolean(playerParticipantId) && event.loserId === playerParticipantId;

  if (event.isDraw) {
    return "Begge kort blev elimineret. Løbet fortsætter fra basen.";
  }

  if (isWinner) {
    return isAttacker
      ? "Dit angreb lykkedes. Hold formationen og pres videre."
      : "Du holdt linjen. Fjenden blev sendt tilbage til basen.";
  }

  if (isLoser) {
    return isAttacker
      ? "Dit fremstød blev stoppet. Vend tilbage til basen og genopliv."
      : "Du blev overmandet i forsvaret. Vend tilbage til basen og genopliv.";
  }

  return "Kampen er registreret på slagmarken.";
}

function getPanelOutcomeClass(isWinner: boolean, isLoser: boolean, isDraw: boolean) {
  if (isDraw) {
    return "border-amber-200/25 bg-white/7";
  }

  if (isWinner) {
    return "border-emerald-300/35 bg-emerald-500/10 shadow-[0_0_50px_rgba(16,185,129,0.18)]";
  }

  if (isLoser) {
    return "border-rose-300/30 bg-rose-500/10 shadow-[0_0_50px_rgba(244,63,94,0.16)]";
  }

  return "border-white/12 bg-white/6";
}

export default function StrategoClashModal({
  event,
  playerParticipantId,
  roleNamesByKey,
  onClose,
}: StrategoClashModalProps) {
  if (!event) {
    return null;
  }

  const attackerIsWinner = !event.isDraw && event.winnerId === event.attackerId;
  const defenderIsWinner = !event.isDraw && event.winnerId === event.defenderId;
  const attackerIsYou = Boolean(playerParticipantId) && event.attackerId === playerParticipantId;
  const defenderIsYou = Boolean(playerParticipantId) && event.defenderId === playerParticipantId;
  const title = getPerspectiveTitle(event, playerParticipantId);
  const body = getPerspectiveBody(event, playerParticipantId);

  return (
    <>
      <div className="fixed inset-0 z-[1300] overflow-hidden bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.22),transparent_24%),radial-gradient(circle_at_bottom,rgba(239,68,68,0.22),transparent_26%),linear-gradient(180deg,rgba(2,6,23,0.92)_0%,rgba(2,6,23,0.96)_100%)] backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-0 opacity-60">
          <div className="stratego-clash-grid absolute inset-0" />
          <div className="stratego-clash-energy absolute left-1/2 top-[16%] h-64 w-64 -translate-x-1/2 rounded-full bg-white/8 blur-3xl" />
          <div className="stratego-clash-energy absolute bottom-[10%] left-[18%] h-44 w-44 rounded-full bg-rose-500/14 blur-3xl" />
          <div className="stratego-clash-energy absolute right-[14%] top-[28%] h-52 w-52 rounded-full bg-sky-400/12 blur-3xl" />
        </div>

        <div className="relative flex min-h-screen items-center justify-center px-4 py-6 sm:px-6">
          <div className="w-full max-w-6xl">
            <div className="mx-auto max-w-3xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/6 px-4 py-2 text-[11px] font-black uppercase tracking-[0.36em] text-white/70">
                <Swords className="h-4 w-4 text-rose-200" />
                Clash Registreret
              </div>
              <h1 className="mt-5 text-3xl font-black tracking-[0.06em] text-white sm:text-5xl">{title}</h1>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/70 sm:text-base">{body}</p>
            </div>

            <div className="mt-10 grid gap-5 lg:grid-cols-[minmax(0,1fr)_10rem_minmax(0,1fr)] lg:items-center">
              <div
                className={`stratego-card-left relative overflow-hidden rounded-[2rem] border p-6 backdrop-blur-2xl ${getPanelOutcomeClass(
                  attackerIsWinner,
                  !event.isDraw && !attackerIsWinner,
                  event.isDraw
                )}`}
              >
                <div
                  className={`pointer-events-none absolute inset-0 bg-gradient-to-br opacity-90 ${getRoleAccent(
                    event.attackerRoleKey
                  )}`}
                />
                <div className="relative">
                  <div className="flex items-center justify-between gap-3">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/8 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.28em] text-white/70">
                      <Target className="h-4 w-4 text-rose-200" />
                      Angriber
                    </div>
                    {attackerIsYou ? (
                      <span className="rounded-full border border-white/12 bg-white/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/75">
                        Dig
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-8 flex items-center gap-5">
                    <div className="flex h-24 w-24 items-center justify-center rounded-[1.7rem] border border-white/12 bg-slate-950/70 text-4xl font-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                      {getRoleGlyph(event.attackerRoleKey)}
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.28em] text-white/55">Kort</p>
                      <h2 className="mt-2 text-3xl font-black text-white">
                        {getRoleName(event.attackerRoleKey, roleNamesByKey)}
                      </h2>
                      <p className="mt-2 text-sm text-white/68">
                        {attackerIsWinner ? "Brød igennem fronten" : event.isDraw ? "Mødte lige modstand" : "Blev stoppet i sammenstødet"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative flex items-center justify-center">
                <div className="stratego-vs-core absolute h-28 w-28 rounded-full bg-white/7 blur-2xl" />
                <div className="relative flex h-28 w-28 items-center justify-center rounded-full border border-white/12 bg-slate-950/70 text-center shadow-[0_0_60px_rgba(255,255,255,0.08)] backdrop-blur-xl">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.4em] text-white/45">Duel</div>
                    <div className="mt-2 text-3xl font-black tracking-[0.3em] text-white">VS</div>
                  </div>
                </div>
              </div>

              <div
                className={`stratego-card-right relative overflow-hidden rounded-[2rem] border p-6 backdrop-blur-2xl ${getPanelOutcomeClass(
                  defenderIsWinner,
                  !event.isDraw && !defenderIsWinner,
                  event.isDraw
                )}`}
              >
                <div
                  className={`pointer-events-none absolute inset-0 bg-gradient-to-br opacity-90 ${getRoleAccent(
                    event.defenderRoleKey
                  )}`}
                />
                <div className="relative">
                  <div className="flex items-center justify-between gap-3">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/8 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.28em] text-white/70">
                      <Shield className="h-4 w-4 text-sky-200" />
                      Forsvarer
                    </div>
                    {defenderIsYou ? (
                      <span className="rounded-full border border-white/12 bg-white/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/75">
                        Dig
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-8 flex items-center gap-5">
                    <div className="flex h-24 w-24 items-center justify-center rounded-[1.7rem] border border-white/12 bg-slate-950/70 text-4xl font-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                      {getRoleGlyph(event.defenderRoleKey)}
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.28em] text-white/55">Kort</p>
                      <h2 className="mt-2 text-3xl font-black text-white">
                        {getRoleName(event.defenderRoleKey, roleNamesByKey)}
                      </h2>
                      <p className="mt-2 text-sm text-white/68">
                        {defenderIsWinner ? "Holdt positionen" : event.isDraw ? "Mødte lige modstand" : "Blev presset tilbage"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              {event.isDraw ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-500/12 px-4 py-2 text-sm font-semibold text-amber-100">
                  <XCircle className="h-4 w-4" />
                  Begge kort er sendt tilbage til basen
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-500/12 px-4 py-2 text-sm font-semibold text-emerald-100">
                  <Trophy className="h-4 w-4" />
                  {event.winnerId === playerParticipantId ? "Sejren er registreret på din telefon" : "Resultatet er synkroniseret live"}
                </div>
              )}

              {(event.attackerRoleKey === "flag" || event.defenderRoleKey === "flag") && !event.isDraw ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-500/12 px-4 py-2 text-sm font-semibold text-amber-100">
                  <Crown className="h-4 w-4" />
                  Fanen afgjorde slaget
                </div>
              ) : null}
            </div>

            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-2xl border border-white/14 bg-white/8 px-6 py-3 text-sm font-black uppercase tracking-[0.24em] text-white transition hover:bg-white/12"
              >
                <Shield className="h-4 w-4" />
                Luk
              </button>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .stratego-clash-grid {
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.045) 1px, transparent 1px);
          background-size: 44px 44px;
          mask-image: radial-gradient(circle at center, black 38%, transparent 85%);
        }

        .stratego-clash-energy {
          animation: stratego-clash-energy 2.6s ease-in-out infinite;
        }

        .stratego-vs-core {
          animation: stratego-vs-pulse 1.6s ease-in-out infinite;
        }

        .stratego-card-left {
          animation: stratego-card-left 480ms cubic-bezier(0.2, 0.9, 0.2, 1) both;
        }

        .stratego-card-right {
          animation: stratego-card-right 480ms cubic-bezier(0.2, 0.9, 0.2, 1) both;
        }

        @keyframes stratego-card-left {
          from {
            opacity: 0;
            transform: translateX(-46px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }

        @keyframes stratego-card-right {
          from {
            opacity: 0;
            transform: translateX(46px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }

        @keyframes stratego-clash-energy {
          0%,
          100% {
            transform: scale(0.94);
            opacity: 0.42;
          }
          50% {
            transform: scale(1.08);
            opacity: 0.82;
          }
        }

        @keyframes stratego-vs-pulse {
          0%,
          100% {
            transform: scale(0.94);
            opacity: 0.52;
          }
          50% {
            transform: scale(1.1);
            opacity: 0.92;
          }
        }
      `}</style>
    </>
  );
}
