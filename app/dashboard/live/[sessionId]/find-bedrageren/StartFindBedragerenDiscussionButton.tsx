"use client";

import { Loader2, MessageCircle, RefreshCw, Square, Trophy, Vote } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type StartFindBedragerenDiscussionButtonProps = {
  sessionId: string;
  phase: string;
  rolesAssigned: boolean;
};

type UpdatePhaseResponse = {
  error?: string;
};

type PendingAction = "discussion" | "voting" | "results" | "finished" | "replay" | null;

export default function StartFindBedragerenDiscussionButton({
  sessionId,
  phase,
  rolesAssigned,
}: StartFindBedragerenDiscussionButtonProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const isSubmitting = pendingAction !== null;

  async function handlePhaseChange(nextPhase: "discussion" | "voting" | "results" | "finished") {
    setError("");

    if (nextPhase === "discussion" && !rolesAssigned) {
      setError("Roller skal fordeles, før diskussionen kan starte.");
      return;
    }

    setPendingAction(nextPhase);

    try {
      const response = await fetch("/api/find-bedrageren/phase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          phase: nextPhase,
        }),
      });
      const body = (await response.json()) as UpdatePhaseResponse;

      if (!response.ok) {
        throw new Error(body.error || "Kunne ikke skifte fase.");
      }

      router.refresh();
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Kunne ikke skifte fase.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleReplay() {
    setError("");
    setPendingAction("replay");

    try {
      const response = await fetch("/api/find-bedrageren/replay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
        }),
      });
      const body = (await response.json()) as UpdatePhaseResponse;

      if (!response.ok) {
        throw new Error(body.error || "Kunne ikke gøre spillet klar igen.");
      }

      router.refresh();
    } catch (replayError) {
      setError(replayError instanceof Error ? replayError.message : "Kunne ikke gøre spillet klar igen.");
    } finally {
      setPendingAction(null);
    }
  }

  if (phase === "discussion") {
    return (
      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Næste fase</p>
          <h2 className="mt-2 text-2xl font-black text-slate-950">Start afstemning</h2>
          <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
            Når diskussionen er færdig, kan eleverne stemme på den, de tror er bedrageren.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void handlePhaseChange("voting")}
          disabled={isSubmitting}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-4 text-base font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Vote className="h-5 w-5" />}
          {isSubmitting ? "Starter afstemning..." : "Start afstemning"}
        </button>

        {error ? (
          <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-900">
            {error}
          </p>
        ) : null}
      </section>
    );
  }

  if (phase === "voting") {
    return (
      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Næste fase</p>
          <h2 className="mt-2 text-2xl font-black text-slate-950">Vis resultat</h2>
          <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
            Når alle har stemt, kan du vise resultatet for klassen.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void handlePhaseChange("results")}
          disabled={isSubmitting}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-4 text-base font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Trophy className="h-5 w-5" />}
          {isSubmitting ? "Viser resultat..." : "Vis resultat"}
        </button>

        {error ? (
          <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-900">
            {error}
          </p>
        ) : null}
      </section>
    );
  }

  if (phase === "results") {
    return (
      <section className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white">
            <Trophy className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-black uppercase tracking-[0.16em] text-emerald-700">Resultat</p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">Resultatet er vist</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-700">
              Du kan enten spille en ny runde med samme elever eller afslutte spillet her.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => void handleReplay()}
            disabled={isSubmitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-4 text-base font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {pendingAction === "replay" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <RefreshCw className="h-5 w-5" />
            )}
            {pendingAction === "replay" ? "Gør klar..." : "Spil igen"}
          </button>

          <button
            type="button"
            onClick={() => void handlePhaseChange("finished")}
            disabled={isSubmitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 py-4 text-base font-black text-slate-900 shadow-sm transition hover:border-slate-500 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
          >
            {pendingAction === "finished" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Square className="h-5 w-5" />
            )}
            {pendingAction === "finished" ? "Afslutter..." : "Afslut spil"}
          </button>
        </div>

        {error ? (
          <p className="mt-3 rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm font-bold leading-6 text-amber-900">
            {error}
          </p>
        ) : null}
      </section>
    );
  }

  if (phase === "finished") {
    return (
      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
            <Square className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Afsluttet</p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">Spillet er afsluttet</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
              Eleverne kan lukke siden, eller du kan oprette et nyt spil.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (phase !== "reveal") {
    return null;
  }

  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <p className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Næste fase</p>
        <h2 className="mt-2 text-2xl font-black text-slate-950">Start diskussion</h2>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
          Når eleverne har set deres roller, kan du starte klassediskussionen.
        </p>
      </div>

      <button
        type="button"
        onClick={() => void handlePhaseChange("discussion")}
        disabled={!rolesAssigned || isSubmitting}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-4 text-base font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <MessageCircle className="h-5 w-5" />}
        {isSubmitting ? "Starter diskussion..." : "Start diskussion"}
      </button>

      {!rolesAssigned ? (
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
          Roller skal fordeles, før diskussionen kan starte.
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-900">
          {error}
        </p>
      ) : null}
    </section>
  );
}
