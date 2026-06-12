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
  const label = phase === "reveal" ? "Fordel roller igen" : "Start spil";

  async function handleStart() {
    setError("");

    if (playerCount < 3) {
      setError("Der skal være mindst 3 spillere, før spillet kan starte.");
      return;
    }

    if (impostorCount >= playerCount) {
      setError("Antallet af bedragere skal være lavere end antallet af spillere.");
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
        throw new Error(body.error || "Kunne ikke starte spillet.");
      }

      router.refresh();
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Kunne ikke starte spillet.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <button
        type="button"
        onClick={() => void handleStart()}
        disabled={!canAssignRoles || isSubmitting}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-4 text-base font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
        {isSubmitting ? "Starter..." : label}
      </button>

      {phase === "reveal" ? (
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
          Roller er fordelt. Brug knappen igen, hvis nye elever skal med.
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
