"use client";

import { Loader2, UserSearch } from "lucide-react";
import Link from "next/link";
import { Poppins, Rubik } from "next/font/google";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

type JoinResponse = {
  sessionId?: string;
  participantId?: string;
  studentName?: string;
  redirectUrl?: string;
  error?: string;
};

const inputClass =
  "w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-lg font-bold text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-4 focus:ring-amber-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500";

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
    <main className={`min-h-screen bg-slate-100 px-6 py-8 text-slate-950 ${poppins.className}`}>
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl items-center justify-center">
        <section className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
              <UserSearch className="h-7 w-7" />
            </div>
            <p className="mt-5 text-sm font-black uppercase tracking-[0.18em] text-amber-700">
              Find Bedrageren
            </p>
            <h1 className={`mt-3 text-4xl font-black text-slate-950 ${rubik.className}`}>
              Gå ind i spillet
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-600">
              Skriv dit navn og koden fra læreren.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="find-bedrageren-name" className="text-sm font-black text-slate-800">
                Navn
              </label>
              <input
                id="find-bedrageren-name"
                value={studentName}
                onChange={(event) => setStudentName(event.target.value)}
                disabled={isJoining}
                maxLength={40}
                className={`${inputClass} mt-2`}
                placeholder="Skriv dit navn"
              />
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
                className={`${inputClass} mt-2 text-center font-mono text-3xl tracking-[0.22em]`}
                placeholder="000000"
              />
            </div>

            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isJoining || !canSubmit}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-4 text-base font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
            >
              {isJoining ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserSearch className="h-5 w-5" />}
              {isJoining ? "Går ind..." : "Gå ind"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link href="/" className="text-sm font-bold text-slate-500 transition hover:text-slate-800">
              Til forsiden
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
