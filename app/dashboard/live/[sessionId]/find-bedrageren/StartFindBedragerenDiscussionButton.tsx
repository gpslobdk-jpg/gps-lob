"use client";

import { Loader2, MessageCircle, Vote } from "lucide-react";
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

export default function StartFindBedragerenDiscussionButton({
  sessionId,
  phase,
  rolesAssigned,
}: StartFindBedragerenDiscussionButtonProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handlePhaseChange(nextPhase: "discussion" | "voting") {
    setError("");

    if (nextPhase === "discussion" && !rolesAssigned) {
      setError("Roller skal fordeles, før diskussionen kan starte.");
      return;
    }

    setIsSubmitting(true);

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
      setIsSubmitting(false);
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
      <section className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white">
            <Vote className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-black uppercase tracking-[0.16em] text-emerald-700">Afstemning</p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">Afstemningen er i gang</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-700">
              Eleverne stemmer nu på den, de mistænker.
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
