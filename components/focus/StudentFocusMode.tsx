"use client";

import { Component, useEffect, useState, type ReactNode } from "react";
import { Smartphone, X } from "lucide-react";

import { FOCUS_MODE_POLL_MS } from "@/lib/focusMode";
import {
  createFocusLifecycle,
  INACTIVE_FOCUS_POLICY,
  readFocusPolicy,
  type FocusPolicy,
  type FocusReturn,
} from "@/lib/focusModeLifecycle";

type Props = {
  sessionId: string;
  participantId: string;
  canTrack: boolean;
};

const FOCUS_MODE_REQUEST_TIMEOUT_MS = 8_000;

/** An unexpected rendering error in this optional layer cannot unmount play. */
class FocusModeBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

function FocusModeStudentLayer({ sessionId, participantId, canTrack }: Props) {
  const [policy, setPolicy] = useState<FocusPolicy>(INACTIVE_FOCUS_POLICY);
  const [collapsedRevision, setCollapsedRevision] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let pendingRead: Promise<FocusPolicy> | null = null;
    const requests = new Set<AbortController>();
    const lifecycle = createFocusLifecycle();
    const endpoint = "/api/focus-mode/participant";
    const query = new URLSearchParams({ sessionId, participantId });

    const request = async (url: string, init?: RequestInit) => {
      const controller = new AbortController();
      requests.add(controller);
      const timeout = window.setTimeout(() => controller.abort(), FOCUS_MODE_REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(url, {
          ...init,
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });
        return { ok: response.ok, data: response.ok ? await response.json() : null };
      } finally {
        clearTimeout(timeout);
        requests.delete(controller);
      }
    };

    const refreshPolicy = (): Promise<FocusPolicy> => {
      if (pendingRead) return pendingRead;
      pendingRead = (async () => {
        let next = INACTIVE_FOCUS_POLICY;
        try {
          const response = await request(`${endpoint}?${query}`);
          if (response.ok) next = readFocusPolicy(response.data);
        } catch {
          // No retries/queues tied to the run: polling may recover this layer.
        }
        if (!disposed) {
          lifecycle.setPolicy({ ...next, tracking: next.tracking && canTrack });
          setPolicy(next);
        }
        return next;
      })().finally(() => { pendingRead = null; });
      return pendingRead;
    };

    const reportReturn = async (event: FocusReturn) => {
      try {
        const current = await refreshPolicy();
        if (
          disposed || !canTrack || !current.tracking ||
          current.policyRevision !== event.policyRevision
        ) return;
        await request(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            participantId,
            eventId: crypto.randomUUID(),
            ...event,
          }),
        });
      } catch {
        // Losing focus metadata must never block GPS, answers or progression.
      }
    };

    const visibilityChanged = () => {
      if (document.visibilityState === "hidden") {
        lifecycle.hidden(Date.now());
      } else if (document.visibilityState === "visible") {
        const event = lifecycle.visible(Date.now());
        if (event) void reportReturn(event);
        else void refreshPolicy();
      }
    };
    const pageHidden = () => lifecycle.pageHide();
    const pageShown = () => {
      lifecycle.pageShow();
      if (document.visibilityState === "visible") void refreshPolicy();
    };
    const documentClicked = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target instanceof HTMLInputElement && target.type === "file") {
        lifecycle.ownFilePicker(Date.now());
      }
      const anchor = target.closest("a[href]");
      if (anchor instanceof HTMLAnchorElement && anchor.origin === location.origin &&
          anchor.target !== "_blank" && !event.ctrlKey && !event.metaKey &&
          (anchor.pathname !== location.pathname || anchor.search !== location.search)) {
        lifecycle.pageHide();
      }
    };

    document.addEventListener("visibilitychange", visibilityChanged);
    document.addEventListener("click", documentClicked, true);
    window.addEventListener("pagehide", pageHidden);
    window.addEventListener("pageshow", pageShown);
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshPolicy();
    }, FOCUS_MODE_POLL_MS);
    if (document.visibilityState === "visible") void refreshPolicy();

    return () => {
      disposed = true;
      lifecycle.cancel();
      clearInterval(poll);
      requests.forEach((controller) => controller.abort());
      document.removeEventListener("visibilitychange", visibilityChanged);
      document.removeEventListener("click", documentClicked, true);
      window.removeEventListener("pagehide", pageHidden);
      window.removeEventListener("pageshow", pageShown);
    };
  }, [sessionId, participantId, canTrack]);

  if (!policy.available || !policy.enabled || policy.exempt) return null;
  const expanded = collapsedRevision !== policy.policyRevision;

  return (
    <aside
      aria-label="Fokusmode"
      data-testid="student-focus-mode"
      className="pointer-events-none fixed inset-x-3 top-[max(6.5rem,calc(env(safe-area-inset-top)+6rem))] z-[2100] mx-auto flex max-w-xl justify-end sm:inset-x-4"
    >
      {expanded ? (
        <div className="pointer-events-auto max-w-sm rounded-2xl border border-sky-200/25 bg-slate-950 p-4 text-sm text-sky-50 shadow-xl">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 font-bold" role="status">
              <Smartphone aria-hidden="true" className="h-4 w-4" /> Fokusmode er aktiv
            </p>
            <button
              type="button"
              aria-label="Skjul information om Fokusmode"
              onClick={() => setCollapsedRevision(policy.policyRevision)}
              className="-m-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 leading-5">Hvis du forlader SkoleGPS under løbet, kan læreren se det.</p>
          <p className="mt-2 leading-5 text-sky-100/80">SkoleGPS kan ikke se, hvilke apps eller hjemmesider du åbner.</p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCollapsedRevision(null)}
          aria-label="Vis information om Fokusmode"
          className="pointer-events-auto inline-flex min-h-11 items-center gap-2 rounded-xl border border-sky-200/25 bg-slate-950 px-3 text-xs font-semibold text-sky-100 shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
        >
          <Smartphone aria-hidden="true" className="h-4 w-4" /> Fokusmode aktiv
        </button>
      )}
    </aside>
  );
}

export default function StudentFocusMode(props: Props) {
  return <FocusModeBoundary><FocusModeStudentLayer {...props} /></FocusModeBoundary>;
}
