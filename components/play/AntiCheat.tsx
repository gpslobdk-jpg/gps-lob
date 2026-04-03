"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/utils/supabase/client";

type AntiCheatProps = {
  sessionId: string;
  zoneId: string | null;
  participantId?: string | null;
  onCheatDetected?: () => void;
  onDismiss?: () => void;
};

export default function AntiCheat({
  sessionId,
  zoneId,
  participantId = null,
  onCheatDetected,
  onDismiss,
}: AntiCheatProps) {
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) return;
      setShowWarning(true);
      onCheatDetected?.();
      if (zoneId && participantId) {
        void lockZone(sessionId, zoneId, participantId);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [participantId, sessionId, zoneId, onCheatDetected]);

  if (!showWarning) return null;

  const handleDismiss = () => {
    setShowWarning(false);
    onDismiss?.();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-red-950/90 px-6 backdrop-blur-md">
      <div className="w-full max-w-sm rounded-[2rem] border border-red-300/30 bg-slate-900/90 p-8 text-center shadow-[0_30px_80px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
        <div className="text-5xl" aria-hidden="true">
          ⚠️
        </div>
        <h2 className="mt-4 text-2xl font-black text-red-100">
          Du forlod kampzonen!
        </h2>
        <p className="mt-3 text-sm leading-6 text-red-200/80">
          Dit svar er annulleret. Zonen er låst i 60 sekunder — ingen kan erobre
          den i mellemtiden.
        </p>
        <button
          type="button"
          onClick={handleDismiss}
          className="mt-6 w-full rounded-2xl border border-red-300/30 bg-red-500/20 px-5 py-3 text-sm font-bold text-red-100 transition hover:bg-red-500/30"
        >
          OK, jeg forstår
        </button>
      </div>
    </div>
  );
}

async function lockZone(sessionId: string, zoneId: string, participantId: string): Promise<void> {
  const supabase = createClient({ participantId, sessionId });
  const shieldUntil = new Date(Date.now() + 60_000).toISOString();

  await supabase.rpc("lock_zone_krig_zone", {
    p_session_id: sessionId,
    p_zone_id: zoneId,
    p_participant_id: participantId,
    p_shield_until: shieldUntil,
  });
}
