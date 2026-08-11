"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { poppins, rubik } from "@/lib/fonts";
import { ShieldCheck } from "lucide-react";

const STORAGE_KEY = "admin_unlocked";
const PIN = "265526";

export default function AdminPinGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setUnlocked(sessionStorage.getItem(STORAGE_KEY) === "true");
  }, []);

  const handleSubmit = useCallback(() => {
    if (pin === PIN) {
      sessionStorage.setItem(STORAGE_KEY, "true");
      setUnlocked(true);
      setError(false);
    } else {
      setError(true);
      setPin("");
      inputRef.current?.focus();
    }
  }, [pin]);

  // Still checking sessionStorage
  if (unlocked === null) return null;

  if (unlocked) return <>{children}</>;

  return (
    <div
      className={`${poppins.className} fixed inset-0 z-[9000] flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950`}
    >
      <div className="mx-4 w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-md">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-500/10">
          <ShieldCheck className="h-7 w-7 text-emerald-400" />
        </div>

        <h1 className={`${rubik.className} mb-1 text-xl font-bold text-white`}>
          Admin-adgang
        </h1>
        <p className="mb-6 text-sm text-white/50">Indtast PIN-kode for at fortsætte</p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            maxLength={6}
            autoFocus
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, "").slice(0, 6));
              setError(false);
            }}
            placeholder="••••••"
            className={`w-full rounded-xl border bg-white/5 px-4 py-3 text-center text-2xl tracking-[0.3em] text-white placeholder-white/20 outline-none transition ${
              error
                ? "border-red-400/60 ring-2 ring-red-400/30"
                : "border-white/10 focus:border-emerald-400/40 focus:ring-2 focus:ring-emerald-400/20"
            }`}
            data-testid="admin-pin-input"
          />

          {error && (
            <p className="mt-2 text-sm text-red-400">Forkert PIN-kode</p>
          )}

          <button
            type="submit"
            disabled={pin.length < 6}
            className="mt-4 min-h-[44px] w-full rounded-xl bg-emerald-500/20 px-4 py-3 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/30 disabled:opacity-40 disabled:hover:bg-emerald-500/20"
          >
            Lås op
          </button>
        </form>
      </div>
    </div>
  );
}
