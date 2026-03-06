"use client";

import { useEffect, useState, Suspense, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Gamepad2, User, KeyRound, Loader2 } from "lucide-react";

import { createClient } from "@/utils/supabase/client";

function JoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [pin, setPin] = useState(() =>
    (searchParams.get("pin") || "").replace(/\D/g, "").slice(0, 6)
  );
  const [name, setName] = useState("");
  const [isWaiting, setIsWaiting] = useState(false);
  const [error, setError] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const isPinEmpty = pin.trim().length === 0;

  useEffect(() => {
    if (!isWaiting || !sessionId) return;

    const channel = supabase
      .channel(`session-status-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "live_sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          if ((payload.new as { status?: string }).status === "running") {
            router.push(`/play/${sessionId}?name=${encodeURIComponent(name)}`);
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isWaiting, sessionId, name, router, supabase]);

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmedPin = pin.trim();
    const trimmedName = name.trim();

    if (!trimmedPin || !trimmedName) {
      setError("Udfyld venligst både kode og navn.");
      return;
    }

    try {
      const { data: sessionData, error: sessionError } = await supabase
        .from("live_sessions")
        .select("id")
        .eq("pin", trimmedPin)
        .eq("status", "waiting")
        .single();

      if (sessionError || !sessionData) {
        setError("Ugyldig kode eller løbet er allerede i gang!");
        return;
      }

      const { error: insertError } = await supabase.from("session_students").insert({
        session_id: sessionData.id,
        student_name: trimmedName,
      });

      if (insertError) throw insertError;

      setSessionId(sessionData.id as string);
      setName(trimmedName);
      setIsWaiting(true);
    } catch (err) {
      console.error(err);
      setError("Der skete en fejl. Prøv igen.");
    }
  };

  if (isWaiting) {
    return (
      <div className="animate-in fade-in flex h-full flex-col items-center justify-center space-y-8 duration-700">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-cyan-500 opacity-20 blur-[50px] animate-pulse" />
          <Gamepad2 size={80} className="relative z-10 text-cyan-400 animate-bounce" />
        </div>
        <div className="space-y-2 text-center">
          <h2 className="bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-2xl font-black tracking-widest text-transparent uppercase">
            Klar til start!
          </h2>
          <p className="text-sm text-white/50">Venter på at læreren starter løbet...</p>
        </div>
        <Loader2 size={32} className="text-purple-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-md flex-col items-center justify-center px-6">
      <div className="w-full rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_0_30px_rgba(168,85,247,0.15)] backdrop-blur-xl">
        <div className="mb-8 flex justify-center">
          <div className="rounded-2xl border border-purple-500/30 bg-purple-500/20 p-4 shadow-[0_0_15px_rgba(168,85,247,0.4)]">
            <Gamepad2 size={40} className="text-purple-400" />
          </div>
        </div>

        <h1 className="mb-8 text-center text-3xl font-black tracking-widest text-white uppercase drop-shadow-md">
          Join Løbet
        </h1>

        <form onSubmit={handleJoin} className="space-y-5">
          {error ? (
            <div className="animate-pulse rounded-xl border border-red-500/50 bg-red-500/20 p-3 text-center text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <div className="relative">
            <div className="absolute inset-y-0 left-4 flex items-center text-cyan-400">
              <KeyRound size={20} />
            </div>
            <input
              type="text"
              placeholder="Pinkode (f.eks. 4921)"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="w-full rounded-xl border border-white/10 bg-[#050816]/50 py-4 pr-4 pl-12 font-mono text-lg text-white placeholder-white/30 transition-all focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 focus:outline-none"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoComplete="one-time-code"
            />
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-4 flex items-center text-purple-400">
              <User size={20} />
            </div>
            <input
              type="text"
              placeholder="Dit Gamer Tag (Navn)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#050816]/50 py-4 pr-4 pl-12 text-lg text-white placeholder-white/30 transition-all focus:border-purple-400 focus:ring-1 focus:ring-purple-400 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={isPinEmpty}
            className="mt-4 w-full rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 py-4 text-xl font-black tracking-widest text-white uppercase shadow-[0_0_20px_rgba(34,211,238,0.4)] transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:scale-100"
          >
            Gør Klar! 🚀
          </button>
        </form>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050816]">
      <div className="pointer-events-none absolute top-0 left-0 h-96 w-full -translate-y-1/2 transform rounded-full bg-purple-600/10 blur-[100px]" />

      <Suspense
        fallback={
          <div className="text-cyan-400 animate-pulse">
            <Loader2 size={32} className="animate-spin" />
          </div>
        }
      >
        <JoinForm />
      </Suspense>
    </div>
  );
}
