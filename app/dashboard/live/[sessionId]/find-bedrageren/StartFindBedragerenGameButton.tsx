"use client";

import { Loader2, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type StartFindBedragerenGameButtonProps = {
  sessionId: string;
  phase: string;
  playerCount: number;
  impostorCount: number;
};

type AssignRolesResponse = {
  error?: string;
};

export default function StartFindBedragerenGameButton({
  sessionId,
  phase,
  playerCount,
  impostorCount,
}: StartFindBedragerenGameButtonProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canAssignRoles = phase === "lobby" || phase === "reveal";

  async function handleStart() {
    setError("");

    if (playerCount < 3) {
      setError("Der skal mindst være 3 elever, før rollerne kan fordeles.");
      return;
    }

    if (impostorCount >= playerCount) {
      setError("Antallet af bedragere skal være lavere end antallet af elever.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/find-bedrageren/assign-roles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sessionId }),
      });
      const body = (await response.json()) as AssignRolesResponse;

      if (!response.ok) {
        throw new Error(body.error || "Kunne ikke fordele roller.");
      }

      router.refresh();
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Kunne ikke fordele roller.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <p className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Lærerhandling</p>
        <h2 className="mt-2 text-2xl font-black text-slate-950">Fordel roller</h2>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
          Når alle elever er klar, fordeler systemet rollerne og sender eleverne videre til rollevisning.
        </p>
      </div>

      <button
        type="button"
        onClick={() => void handleStart()}
        disabled={!canAssignRoles || isSubmitting}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-4 text-base font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
        {isSubmitting ? "Fordeler roller..." : "Fordel roller"}
      </button>

      {phase === "reveal" ? (
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
          Roller er fordelt. Du kan fordele igen, hvis en elev er kommet for sent med.
        </p>
      ) : playerCount < 3 ? (
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
          Der skal mindst være 3 elever, før rollerne kan fordeles.
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-900">
          {error}
        </p>
      ) : null}
    </div>
  );
}
