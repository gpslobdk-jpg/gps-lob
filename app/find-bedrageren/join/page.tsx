"use client";

import { KeyRound, Loader2, LogIn, UserRound } from "lucide-react";
import Link from "next/link";
import { poppins, rubik } from "@/lib/fonts";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

type JoinResponse = {
  sessionId?: string;
  participantId?: string;
  studentName?: string;
  redirectUrl?: string;
  error?: string;
};

const inputClass =
  "w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-lg font-bold text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500";

function storageKey(sessionId: string) {
  return `find_bedrageren_participant_${sessionId}`;
}

export default function FindBedragerenJoinPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [studentName, setStudentName] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState("");

  const normalizedPin = useMemo(() => pin.replace(/\D/g, "").slice(0, 6), [pin]);
  const canSubmit = normalizedPin.length === 6 && studentName.trim().length > 0;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit) {
      setError("Skriv navn og den 6-cifrede kode.");
      return;
    }

    setIsJoining(true);
    setError("");

    try {
      const response = await fetch("/api/find-bedrageren/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pin: normalizedPin,
          studentName: studentName.trim(),
        }),
      });

      const body = (await response.json()) as JoinResponse;

      if (!response.ok || !body.sessionId || !body.participantId || !body.redirectUrl) {
        throw new Error(body.error || "Kunne ikke joine spillet.");
      }

      try {
        window.localStorage.setItem(
          storageKey(body.sessionId),
          JSON.stringify({
            participantId: body.participantId,
            studentName: body.studentName ?? studentName.trim(),
            savedAt: new Date().toISOString(),
          })
        );
      } catch {
        // API'en har også sat en separat Find Bedrageren-cookie.
      }

      router.push(body.redirectUrl);
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : "Kunne ikke joine spillet.");
      setIsJoining(false);
    }
  };

  return (
    <main className={`min-h-screen bg-[#f5f3ef] px-5 py-7 text-slate-950 sm:px-6 sm:py-8 ${poppins.className}`}>
      <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-4xl items-center justify-center">
        <section className="grid w-full overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl lg:grid-cols-[0.9fr_1.1fr]">
          <div className="bg-slate-950 px-6 py-8 text-white sm:px-8 sm:py-10">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-300/15 text-amber-200">
              <KeyRound className="h-7 w-7" />
            </div>
            <p className="mt-6 text-sm font-black uppercase tracking-[0.18em] text-amber-100">
              Find Bedrageren
            </p>
            <h1 className={`mt-3 text-4xl font-black leading-tight sm:text-5xl ${rubik.className}`}>
              Gå ind i spillet
            </h1>
            <p className="mt-4 max-w-md text-base font-semibold leading-7 text-slate-200">
              Skriv dit navn og koden fra læreren. Når du er inde, venter du på, at spillet starter.
            </p>
            <div className="mt-7 rounded-2xl border border-white/15 bg-white/10 p-4">
              <p className="text-sm font-black text-white">Din rolle er privat</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-200">
                Kig kun på din egen skærm, når læreren starter rollevisningen.
              </p>
            </div>
          </div>

          <div className="px-6 py-7 sm:px-8 sm:py-10">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">
                Elev-login
              </p>
              <h2 className={`mt-2 text-3xl font-black text-slate-950 ${rubik.className}`}>
                Navn og kode
              </h2>
              <p className="mt-3 text-base font-semibold leading-7 text-slate-600">
                Brug den kode, læreren viser på skærmen.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-7 space-y-5">
              <div>
                <label htmlFor="find-bedrageren-name" className="text-sm font-black text-slate-800">
                  Navn
                </label>
                <div className="relative mt-2">
                  <UserRound className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    id="find-bedrageren-name"
                    value={studentName}
                    onChange={(event) => setStudentName(event.target.value)}
                    disabled={isJoining}
                    maxLength={40}
                    className={`${inputClass} pl-12`}
                    placeholder="Skriv dit navn"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="find-bedrageren-pin" className="text-sm font-black text-slate-800">
                  Kode
                </label>
                <input
                  id="find-bedrageren-pin"
                  value={pin}
                  onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  disabled={isJoining}
                  inputMode="numeric"
                  maxLength={6}
                  className={`${inputClass} mt-2 text-center font-mono text-3xl tracking-[0.22em] sm:text-4xl`}
                  placeholder="000000"
                />
              </div>

              {error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold leading-6 text-red-800">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isJoining || !canSubmit}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-4 text-base font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
              >
                {isJoining ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
                {isJoining ? "Går ind..." : "Gå ind"}
              </button>
            </form>

            <div className="mt-6 text-center">
              <Link href="/" className="text-sm font-bold text-slate-500 transition hover:text-slate-800">
                Til forsiden
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
