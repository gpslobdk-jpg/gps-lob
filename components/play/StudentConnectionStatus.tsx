"use client";

import { useEffect, useRef, useState } from "react";

const RESTORED_NOTICE_DURATION_MS = 3000;

type StudentConnectionStatusProps = {
  reconnectConfirmationNonce: number;
};

export default function StudentConnectionStatus({
  reconnectConfirmationNonce,
}: StudentConnectionStatusProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [showRestoredNotice, setShowRestoredNotice] = useState(false);
  const wasOfflineRef = useRef(false);
  const restoredNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    const clearRestoredNoticeTimer = () => {
      if (restoredNoticeTimerRef.current !== null) {
        clearTimeout(restoredNoticeTimerRef.current);
        restoredNoticeTimerRef.current = null;
      }
    };

    const handleOffline = () => {
      wasOfflineRef.current = true;
      clearRestoredNoticeTimer();
      setShowRestoredNotice(false);
      setIsOnline(false);
    };

    const handleOnline = () => {
      setIsOnline(true);
      clearRestoredNoticeTimer();
      setShowRestoredNotice(false);
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    if (navigator.onLine) {
      handleOnline();
    } else {
      handleOffline();
    }

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      clearRestoredNoticeTimer();
    };
  }, []);

  useEffect(() => {
    if (
      reconnectConfirmationNonce <= 0 ||
      !isOnline ||
      !wasOfflineRef.current
    ) {
      return;
    }

    const activationTimer = setTimeout(() => {
      wasOfflineRef.current = false;
      if (restoredNoticeTimerRef.current !== null) {
        clearTimeout(restoredNoticeTimerRef.current);
      }
      setShowRestoredNotice(true);
      restoredNoticeTimerRef.current = setTimeout(() => {
        setShowRestoredNotice(false);
        restoredNoticeTimerRef.current = null;
      }, RESTORED_NOTICE_DURATION_MS);
    }, 0);

    return () => {
      clearTimeout(activationTimer);
    };
  }, [isOnline, reconnectConfirmationNonce]);

  if (isOnline && !showRestoredNotice) {
    return null;
  }

  return (
    <section
      aria-atomic="true"
      aria-live="polite"
      className={`fixed inset-x-4 top-[max(1rem,env(safe-area-inset-top))] z-[2100] mx-auto max-w-md rounded-2xl border px-4 py-3 shadow-lg ${
        isOnline
          ? "border-emerald-200 bg-emerald-50 text-emerald-950"
          : "border-amber-200 bg-amber-50 text-amber-950"
      }`}
      role="status"
    >
      <h2 className="text-sm font-semibold">
        {isOnline ? "Forbindelsen er tilbage" : "Ingen forbindelse"}
      </h2>
      {!isOnline ? (
        <p className="mt-1 text-sm leading-5">
          Du kan blive på siden. SkoleGPS forsøger igen, når nettet er tilbage.
        </p>
      ) : null}
    </section>
  );
}
