"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { requestTeacherFocus, saveRunFocusMode } from "@/lib/teacherFocusMode";

export function useBuilderFocusMode(runId?: string | null) {
  const scope = runId || null;
  const [setting, setSetting] = useState<{ scope: string | null; enabled: boolean }>({ scope, enabled: false });
  const [resolution, setResolution] = useState<{ scope: string | null; status: "ready" | "loading" | "unavailable" }>({ scope, status: scope ? "loading" : "ready" });
  const focusEnabled = setting.scope === scope ? setting.enabled : false;
  const focusStatus = resolution.scope === scope ? resolution.status : scope ? "loading" : "ready";
  const changedRef = useRef<{ scope: string | null; changed: boolean }>({ scope, changed: false });

  const setFocusEnabled = useCallback((enabled: boolean) => {
    changedRef.current = { scope, changed: true };
    setSetting({ scope, enabled });
  }, [scope]);

  useEffect(() => {
    if (!scope) return;
    let cancelled = false;
    void requestTeacherFocus("run", { runId: scope }).then((result) => {
      if (cancelled) return;
      const changed = changedRef.current.scope === scope && changedRef.current.changed;
      if (result && typeof result === "object" && "available" in result && result.available === true && "enabled" in result && typeof result.enabled === "boolean") {
        if (!changed) setSetting({ scope, enabled: result.enabled });
        setResolution({ scope, status: "ready" });
      } else {
        setResolution({ scope, status: "unavailable" });
      }
    });
    return () => { cancelled = true; };
  }, [scope]);

  const persistFocusMode = async (savedRunId: string) => {
    // Old/off runs do not require the focus service or a schema migration to save.
    if (scope && focusStatus !== "ready") return;
    const changed = changedRef.current.scope === scope && changedRef.current.changed;
    if (!focusEnabled && (!scope || !changed)) return;
    await saveRunFocusMode(savedRunId, focusEnabled);
  };

  return { focusEnabled, focusStatus, setFocusEnabled, persistFocusMode };
}
