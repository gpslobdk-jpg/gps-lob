"use client";

import { ArrowRight, BookOpen, CheckCircle2, Loader2, LockKeyhole, MapPinned } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/components/AuthProvider";
import { formatGradeLevelBadge, normalizeGradeLevels } from "@/utils/gradeLevels";
import {
  isRunExecutionSharingEnabled,
  normalizeRunExecutionShareToken,
  RUN_EXECUTION_SHARE_PATH,
  RUN_EXECUTION_SHARE_TOKEN_STORAGE_KEY,
} from "@/lib/runExecutionShare";

type SharedRunPreview = {
  title: string;
  subject: string;
  gradeLevels: string[];
};

type ApiResponse = {
  error?: string;
  terminal?: boolean;
  run?: SharedRunPreview;
  alreadyClaimed?: boolean;
  destination?: string;
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

export default function RunExecutionShareClient() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const tokenRef = useRef<string | null>(null);
  const [preview, setPreview] = useState<SharedRunPreview | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimMessage, setClaimMessage] = useState("");

  useEffect(() => {
    const hadFragment = window.location.hash.length > 0;
    const tokenFromFragment = normalizeRunExecutionShareToken(
      window.location.hash.replace(/^#/, "")
    );

    if (window.location.hash) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }

    if (hadFragment) {
      // Et ugyldigt nyt link må aldrig falde tilbage til en ældre hemmelighed
      // fra samme browserfane.
      window.sessionStorage.removeItem(RUN_EXECUTION_SHARE_TOKEN_STORAGE_KEY);
    }

    const token =
      tokenFromFragment ??
      (hadFragment
        ? null
        : normalizeRunExecutionShareToken(
            window.sessionStorage.getItem(RUN_EXECUTION_SHARE_TOKEN_STORAGE_KEY)
          ));

    const featureEnabled = isRunExecutionSharingEnabled();
    if (!featureEnabled) {
      window.sessionStorage.removeItem(RUN_EXECUTION_SHARE_TOKEN_STORAGE_KEY);
      tokenRef.current = null;
      setError("Del til afvikling er ikke aktiveret endnu.");
      setIsLoading(false);
      return;
    }

    tokenRef.current = token;

    if (!token) {
      window.sessionStorage.removeItem(RUN_EXECUTION_SHARE_TOKEN_STORAGE_KEY);
      setError("Delingslinket er ugyldigt eller mangler sin sikre nøgle.");
      setIsLoading(false);
      return;
    }

    let isActive = true;

    const loadPreview = async () => {
      try {
        const { response, body } = await requestShareAction({
          action: "preview",
          token,
        });

        if (!isActive) return;

        if (!response.ok || !body.run) {
          if (body.terminal) {
            window.sessionStorage.removeItem(
              RUN_EXECUTION_SHARE_TOKEN_STORAGE_KEY
            );
            tokenRef.current = null;
          }
          setError(body.error ?? "Delingslinket er ugyldigt eller deaktiveret.");
          return;
        }

        window.sessionStorage.removeItem(RUN_EXECUTION_SHARE_TOKEN_STORAGE_KEY);
        setPreview(body.run);
      } catch {
        if (isActive) {
          setError("Delingslinket kunne ikke indlæses. Prøv igen.");
        }
      } finally {
        if (isActive) setIsLoading(false);
      }
    };

    void loadPreview();

    return () => {
      isActive = false;
    };
  }, []);

  const handleLogin = () => {
    const token = tokenRef.current;
    if (token) {
      window.sessionStorage.setItem(
        RUN_EXECUTION_SHARE_TOKEN_STORAGE_KEY,
        token
      );
    } else {
      window.sessionStorage.removeItem(RUN_EXECUTION_SHARE_TOKEN_STORAGE_KEY);
    }
    router.push(`/login?next=${encodeURIComponent(RUN_EXECUTION_SHARE_PATH)}`);
  };

  const handleClaim = async () => {
    const token = tokenRef.current;
    if (!token || isClaiming) return;

    setIsClaiming(true);
    setError("");
    setClaimMessage("");

    try {
      const { response, body } = await requestShareAction({ action: "claim", token });

      if (response.status === 401) {
        handleLogin();
        return;
      }

      if (!response.ok || !body.destination) {
        if (body.terminal) {
          window.sessionStorage.removeItem(
            RUN_EXECUTION_SHARE_TOKEN_STORAGE_KEY
          );
          tokenRef.current = null;
        }
        setError(body.error ?? "Din kopi kunne ikke oprettes. Prøv igen.");
        return;
      }

      setClaimMessage(
        body.alreadyClaimed
          ? "Du har allerede hentet dette løb. Vi åbner din kopi."
          : "Din egen kopi er klar. Vi åbner den nu."
      );
      window.sessionStorage.removeItem(RUN_EXECUTION_SHARE_TOKEN_STORAGE_KEY);
      tokenRef.current = null;
      router.replace(body.destination);
    } catch {
      setError("Din kopi kunne ikke oprettes. Prøv igen.");
    } finally {
      setIsClaiming(false);
    }
  };

  const gradeLevels = normalizeGradeLevels(preview?.gradeLevels);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-10 text-white sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.22),transparent_38%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-linear-to-r from-cyan-400 via-emerald-400 to-sky-500" />

      <section className="relative w-full max-w-xl overflow-hidden rounded-[2rem] border border-white/12 bg-slate-900/92 p-6 shadow-[0_32px_90px_rgba(2,8,23,0.55)] backdrop-blur-xl sm:p-9">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-300">
            <MapPinned className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-black tracking-[0.24em] text-cyan-300 uppercase">
              SkoleGPS.dk
            </p>
            <h1 className="mt-1 break-words text-2xl font-black leading-tight sm:text-3xl">
              Et SkoleGPS-løb er delt med dig
            </h1>
          </div>
        </div>

        {isLoading || isAuthLoading ? (
          <div className="mt-8 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-5 text-sm text-slate-200">
            <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" />
            Henter det delte løb sikkert...
          </div>
        ) : error ? (
          <div className="mt-8 rounded-2xl border border-rose-300/25 bg-rose-400/10 px-5 py-4 text-sm leading-6 text-rose-100">
            <p className="font-bold">Linket kan ikke bruges</p>
            <p className="mt-1 break-words text-rose-100/85">{error}</p>
          </div>
        ) : preview ? (
          <>
            <div className="mt-8 rounded-[1.75rem] border border-white/10 bg-white/6 p-5">
              <div className="flex items-start gap-3">
                <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                <div className="min-w-0">
                  <h2 className="break-words text-xl font-black leading-snug text-white">
                    {preview.title}
                  </h2>
                  <p className="mt-2 break-words text-sm font-semibold text-slate-300">
                    {preview.subject}
                  </p>
                  {gradeLevels.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {gradeLevels.map((gradeLevel) => (
                        <span
                          key={gradeLevel}
                          className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-bold text-emerald-200"
                        >
                          {formatGradeLevelBadge(gradeLevel)}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <p className="mt-6 text-sm leading-6 text-slate-300">
              Når du fortsætter, oprettes din egen kopi. Du kan derefter starte løbet som normalt.
            </p>

            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-300/15 bg-emerald-300/8 px-4 py-3 text-xs leading-5 text-emerald-100/85">
              <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
              Originalen ændres ikke. Din kopi og dine kommende afviklinger tilhører kun din lærerprofil.
            </div>

            {claimMessage ? (
              <div className="mt-5 flex items-center gap-2 rounded-2xl border border-emerald-300/25 bg-emerald-300/12 px-4 py-3 text-sm font-semibold text-emerald-100">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                {claimMessage}
              </div>
            ) : null}

            {user ? (
              <button
                type="button"
                onClick={() => void handleClaim()}
                disabled={isClaiming}
                className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 py-3 text-center text-sm font-black text-slate-950 transition hover:bg-emerald-300 disabled:cursor-wait disabled:opacity-70"
              >
                {isClaiming ? (
                  <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" />
                ) : (
                  <ArrowRight className="h-5 w-5" />
                )}
                {isClaiming ? "OPRETTER DIN KOPI..." : "OPRET MIN KOPI"}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleLogin}
                className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-5 py-3 text-center text-sm font-black text-slate-950 transition hover:bg-cyan-200"
              >
                <LockKeyhole className="h-5 w-5" />
                LOG IND FOR AT FORTSÆTTE
              </button>
            )}
          </>
        ) : null}
      </section>
    </main>
  );
}
