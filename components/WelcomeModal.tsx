"use client";

import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";
import { useState } from "react";

import delAnimation from "@/public/del.json";
import folgAnimation from "@/public/folg.json";
import opretAnimation from "@/public/opret.json";

const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

const STORAGE_KEY = "hasSeenWelcomeModal";

type WelcomeModalProps = {
  forceOpenToken?: number;
};

const steps = [
  {
    title: "Trin 1 · Opret",
    text: "Design dit løb på 60 sekunder. Placer poster, vælg opgaver og gem. Det er lettere end at snøre skoene.",
    animationData: opretAnimation,
  },
  {
    title: "Trin 2 · Del",
    text: "Scan og start! Deltagerne scanner en QR-kode eller taster en kode. Ingen login, ingen app – bare ren leg og spænding.",
    animationData: delAnimation,
  },
  {
    title: "Trin 3 · Følg",
    text: "Vær med hele vejen. Se alle hold bevæge sig live på kortet. Giv hints og følg med i realtid fra Kontroltårnet.",
    animationData: folgAnimation,
  },
] as const;

export default function WelcomeModal({ forceOpenToken = 0 }: WelcomeModalProps) {
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY) !== "true";
  });
  const [dismissedForcedToken, setDismissedForcedToken] = useState(0);
  const isForcedOpen = forceOpenToken > 0 && forceOpenToken !== dismissedForcedToken;

  const handleClose = () => {
    window.localStorage.setItem(STORAGE_KEY, "true");
    if (isForcedOpen) {
      setDismissedForcedToken(forceOpenToken);
    }
    setIsOpen(false);
  };

  return (
    <AnimatePresence>
      {isOpen || isForcedOpen ? (
        <motion.div
          className="fixed inset-0 z-50 bg-slate-950/45 p-3 backdrop-blur-[2px] sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="welcome-title"
            className="mx-auto flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-emerald-100/80 bg-stone-50 text-slate-800 shadow-2xl"
            initial={{ y: 28, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 14, opacity: 0.6, scale: 0.99 }}
            transition={{ type: "spring", stiffness: 220, damping: 24 }}
          >
            <div className="border-b border-emerald-100/80 bg-emerald-50/50 px-5 py-5 sm:px-7 sm:py-6">
              <p className="text-xs font-bold tracking-[0.18em] text-emerald-600 uppercase">
                Velkommen
              </p>
              <h2 id="welcome-title" className="mt-1 text-2xl font-black text-emerald-700 sm:text-3xl">
                Sådan fungerer GPSLØB.DK
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">
                Byg en oplevelse, del den med deltagerne og følg energien live.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
              <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:gap-5 md:overflow-visible md:pb-0">
                {steps.map((step) => (
                  <article
                    key={step.title}
                    className="min-w-[84%] snap-center rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 shadow-sm shadow-emerald-100/80 md:min-w-0"
                  >
                    <div className="mb-3 rounded-xl bg-white p-2 shadow-inner shadow-emerald-100/70">
                      <Lottie animationData={step.animationData} loop className="h-36 w-full sm:h-40" />
                    </div>
                    <h3 className="text-base font-black text-amber-700">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-700">{step.text}</p>
                  </article>
                ))}
              </div>
            </div>

            <div className="border-t border-emerald-100 bg-emerald-50/45 px-5 py-4 sm:px-7 sm:py-5">
              <button
                type="button"
                onClick={handleClose}
                className="w-full rounded-2xl bg-emerald-600 px-5 py-3 text-base font-bold text-white transition hover:bg-emerald-700"
              >
                Jeg er klar!
              </button>
            </div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
