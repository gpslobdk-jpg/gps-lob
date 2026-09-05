"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { FOCUS_SAVE_WARNING, FOCUS_SAVE_WARNING_EVENT, FOCUS_SAVE_WARNING_KEY } from "@/lib/teacherFocusMode";

export default function FocusSaveNotice() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const showNotice = () => setVisible(true);
    try {
      if (window.sessionStorage.getItem(FOCUS_SAVE_WARNING_KEY)) queueMicrotask(showNotice);
    } catch { /* The run remains usable when storage is blocked. */ }
    window.addEventListener(FOCUS_SAVE_WARNING_EVENT, showNotice);
    return () => window.removeEventListener(FOCUS_SAVE_WARNING_EVENT, showNotice);
  }, [pathname]);

  if (!visible) return null;
  return (
    <div role="status" className="fixed inset-x-4 top-20 z-[1300] mx-auto flex max-w-xl items-start gap-3 rounded-2xl border border-amber-200/40 bg-slate-950 p-4 text-sm leading-6 text-amber-100 shadow-xl">
      <p>{FOCUS_SAVE_WARNING}</p>
      <button type="button" aria-label="Luk besked om Fokusmode" className="min-h-11 shrink-0 rounded-lg px-2 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" onClick={() => {
        setVisible(false);
        try { window.sessionStorage.removeItem(FOCUS_SAVE_WARNING_KEY); } catch { /* Optional storage. */ }
      }}>Luk</button>
    </div>
  );
}
