"use client";

import { Check, Copy, Link2, Loader2, ShieldCheck, Unlink, X } from "lucide-react";
import { useEffect, useState } from "react";

import {
  buildRunExecutionShareLink,
  isSupportedRunExecutionShareRaceType,
} from "@/lib/runExecutionShare";

type ShareableRun = {
  id: string;
  title: string;
  raceType: string | null;
};

type ActiveShare = {
  id: string;
  createdAt: string;
};

type ApiResponse = {
  error?: string;
  supported?: boolean;
  activeShare?: ActiveShare | null;
  token?: string;
  share?: ActiveShare;
  revoked?: boolean;
};

type RunExecutionShareModalProps = {
  run: ShareableRun;
  onClose: () => void;
};

async function requestShareAction(payload: Record<string, unknown>) {
  const response = await fetch("/api/run-execution-share", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  let body: ApiResponse = {};
  try {
    body = (await response.json()) as ApiResponse;
  } catch {
    body = {};
  }

  return { response, body };
}

export default function RunExecutionShareModal({
  run,
  onClose,
}: RunExecutionShareModalProps) {
  const supported = isSupportedRunExecutionShareRaceType(run.raceType);
  const [activeShare, setActiveShare] = useState<ActiveShare | null>(null);
  const [rawLink, setRawLink] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(supported);
  const [isCreating, setIsCreating] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [didCopy, setDidCopy] = useState(false);

  useEffect(() => {
    if (!supported) return;

    let isActive = true;

    const loadStatus = async () => {
      try {
        const { response, body } = await requestShareAction({
          action: "status",
          runId: run.id,
        });

        if (!isActive) return;
        if (!response.ok) {
          setError(body.error ?? "Delingsstatus kunne ikke hentes.");
          return;
        }

        setActiveShare(body.activeShare ?? null);
      } catch {
        if (isActive) setError("Delingsstatus kunne ikke hentes.");
      } finally {
        if (isActive) setIsLoading(false);
      }
    };

    void loadStatus();

    return () => {
      isActive = false;
    };
  }, [run.id, supported]);

  const handleCreate = async () => {
    setIsCreating(true);
    setError("");
    setRawLink("");
    setDidCopy(false);

    try {
      const { response, body } = await requestShareAction({
        action: "create",
        runId: run.id,
      });

      const link = body.token
        ? buildRunExecutionShareLink(window.location.origin, body.token)
        : null;

      if (!response.ok || !body.share || !link) {
        setError(body.error ?? "Delingslinket kunne ikke oprettes.");
        return;
      }

      setActiveShare(body.share);
      setRawLink(link);
    } catch {
      setError("Delingslinket kunne ikke oprettes. Prøv igen.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!rawLink) return;

    try {
      await navigator.clipboard.writeText(rawLink);
      setDidCopy(true);
    } catch {
      setError("Linket kunne ikke kopieres automatisk. Markér og kopiér det manuelt.");
    }
  };

  const handleRevoke = async () => {
    if (!activeShare) return;

    setIsRevoking(true);
    setError("");

    try {
      const { response, body } = await requestShareAction({
        action: "revoke",
        shareId: activeShare.id,
      });

      if (!response.ok || !body.revoked) {
        setError(body.error ?? "Delingslinket kunne ikke deaktiveres.");
        return;
      }

      setActiveShare(null);
      setRawLink("");
      setDidCopy(false);
    } catch {
      setError("Delingslinket kunne ikke deaktiveres. Prøv igen.");
    } finally {
      setIsRevoking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Luk deling"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="run-execution-share-title"
        className="relative max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-[2rem] border border-white/12 bg-slate-950 p-6 text-white shadow-[0_32px_90px_rgba(2,8,23,0.6)] sm:p-8"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.18),transparent_38%)]" />

        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-black tracking-[0.26em] text-cyan-300 uppercase">
                Del til afvikling
              </p>
              <h2
                id="run-execution-share-title"
                className="mt-2 break-words text-2xl font-black leading-tight"
              >
                {run.title}
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Luk"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/12 bg-white/8 text-white transition hover:bg-white/14"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {!supported ? (
            <div className="mt-7 rounded-2xl border border-amber-300/25 bg-amber-300/10 p-5 text-sm leading-6 text-amber-100">
              Denne løbstype kan endnu ikke deles til afvikling. Første version understøtter generelle quizzer, dansk, engelsk, matematik og foto.
            </div>
          ) : (
            <>
              <p className="mt-6 text-sm leading-6 text-slate-300">
                Send linket til en lærer. Læreren får sin egen kopi og kan selv starte og styre løbet med sin klasse. Dit originale løb ændres ikke, og du behøver ikke være med.
              </p>

              <div className="mt-4 flex items-start gap-3 rounded-2xl border border-emerald-300/15 bg-emerald-300/8 px-4 py-3 text-sm text-emerald-100/90">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                <span>Linket kan bruges af flere lærere. Hver lærer får sin egen uafhængige kopi.</span>
              </div>

              {isLoading ? (
                <div className="mt-6 flex items-center gap-3 text-sm text-slate-300">
                  <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" />
                  Henter delingsstatus...
                </div>
              ) : (
                <>
                  {activeShare && !rawLink ? (
                    <div className="mt-6 rounded-2xl border border-cyan-300/18 bg-cyan-300/8 p-4 text-sm leading-6 text-cyan-50/90">
                      Der er allerede et aktivt link. Af sikkerhedsgrunde kan den rå nøgle kun vises én gang. Opret et nyt link for at erstatte det gamle, eller deaktivér delingen.
                    </div>
                  ) : null}

                  {rawLink ? (
                    <div className="mt-6 space-y-3 rounded-[1.5rem] border border-emerald-300/20 bg-emerald-300/8 p-4">
                      <div className="flex items-center gap-2 text-sm font-bold text-emerald-200">
                        <Link2 className="h-4 w-4" />
                        Dit sikre link er klar
                      </div>
                      <input
                        aria-label="Delingslink"
                        readOnly
                        value={rawLink}
                        onFocus={(event) => event.currentTarget.select()}
                        className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-xs text-white outline-none focus:border-emerald-300/35"
                      />
                      <p className="text-xs leading-5 text-slate-300">
                        Kopiér linket nu. Den hemmelige del gemmes ikke og kan derfor ikke vises igen.
                      </p>
                      <button
                        type="button"
                        onClick={() => void handleCopy()}
                        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
                      >
                        {didCopy ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {didCopy ? "KOPIERET" : "KOPIÉR LINK"}
                      </button>
                    </div>
                  ) : null}

                  {error ? (
                    <div className="mt-5 rounded-2xl border border-rose-300/25 bg-rose-400/10 px-4 py-3 text-sm leading-6 text-rose-100">
                      {error}
                    </div>
                  ) : null}

                  <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-end">
                    {activeShare ? (
                      <button
                        type="button"
                        onClick={() => void handleRevoke()}
                        disabled={isRevoking || isCreating}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-rose-300/25 bg-rose-400/10 px-4 py-3 text-sm font-bold text-rose-100 transition hover:bg-rose-400/16 disabled:cursor-wait disabled:opacity-60"
                      >
                        {isRevoking ? (
                          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                        ) : (
                          <Unlink className="h-4 w-4" />
                        )}
                        DEAKTIVÉR LINK
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => void handleCreate()}
                      disabled={isCreating || isRevoking}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60"
                    >
                      {isCreating ? (
                        <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                      ) : (
                        <Link2 className="h-4 w-4" />
                      )}
                      {activeShare ? "OPRET NYT LINK" : "OPRET DELINGSLINK"}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
