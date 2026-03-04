"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Brain, Key, Radio } from "lucide-react";
import { Poppins, Rubik } from "next/font/google";
import Image from "next/image";
import { useState } from "react";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const STORAGE_KEY = "hasSeenOnboarding";

const steps = [
  {
    icon: Brain,
    lead: "OPRET",
    headline: "PÅ 60 SEKUNDER",
    text: "Placer dine poster, tilføj spørgsmål og gem. Intuitivt og lynhurtigt.",
  },
  {
    icon: Key,
    lead: "DEL",
    headline: "KODEN DE ER I GANG",
    text: "Eleverne scanner en QR-kode eller indtaster en 5-cifret kode. Ingen login, ingen app - bare ren læring.",
  },
  {
    icon: Radio,
    lead: "FØLG",
    headline: "MED FRA KONTROLTÅRNET",
    text: "Se eleverne bevæge sig live på kortet. Modtag deres svar i realtid og vær klar med hjælp, hvis de sender en besked direkte fra ruten.",
  },
];

const contentVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.13,
      delayChildren: 0.18,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: "easeOut" as const },
  },
};

type OnboardingModalProps = {
  forceOpenToken?: number;
};

export default function OnboardingModal({ forceOpenToken = 0 }: OnboardingModalProps) {
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
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
          className={`fixed inset-0 z-50 overflow-y-auto bg-[#0a1128] bg-[radial-gradient(circle_at_center,_#0f1c42_0%,_#0a1128_100%)] text-slate-100 ${poppins.className}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="onboarding-title"
            className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-4 py-8 sm:px-6 sm:py-10"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
          >
            <motion.div
              className="w-full rounded-3xl border border-white/5 bg-black/10 p-6 shadow-[0_0_24px_rgba(34,211,238,0.18),0_0_34px_rgba(59,130,246,0.14)] backdrop-blur-md sm:p-10"
              variants={contentVariants}
              initial="hidden"
              animate="show"
            >
              <motion.div variants={itemVariants} className="mb-5 flex w-full justify-center">
                <Image
                  src="/gpslogo.png"
                  alt="GPSLOB.DK Logo"
                  width={350}
                  height={150}
                  priority
                  className="object-contain drop-shadow-[0_0_20px_rgba(34,211,238,0.5)]"
                />
              </motion.div>

              <motion.h2
                id="onboarding-title"
                variants={itemVariants}
                className={`text-center text-2xl font-extrabold text-cyan-50 sm:text-4xl ${rubik.className}`}
              >
                GPSLOB.DK: Skattejagt på den smarte måde
              </motion.h2>

              <motion.p
                variants={itemVariants}
                className="mx-auto mt-4 max-w-3xl text-center text-sm leading-relaxed text-slate-200 sm:text-base"
              >
                Byg, del og følg med live. Det tager længere tid at snøre skoene
                end at oprette et løb.
              </motion.p>

              <div className="mt-7 space-y-3">
                {steps.map(({ icon: Icon, lead, headline, text }, index) => (
                  <motion.article
                    key={lead}
                    variants={itemVariants}
                    transition={{ delay: index * 0.03 }}
                    whileHover={{
                      scale: 1.02,
                      boxShadow:
                        "0 0 28px rgba(34,211,238,0.42), 0 0 36px rgba(99,102,241,0.28)",
                    }}
                    className="rounded-2xl border border-white/5 bg-black/10 p-4 shadow-[0_0_16px_rgba(34,211,238,0.15)] backdrop-blur-md sm:p-5"
                  >
                    <div className="flex items-start gap-3">
                      <motion.span
                        className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-300/35 bg-cyan-400/10 text-cyan-200"
                        animate={{
                          color: [
                            "rgba(165,243,252,1)",
                            "rgba(196,181,253,1)",
                            "rgba(165,243,252,1)",
                          ],
                          borderColor: [
                            "rgba(103,232,249,0.45)",
                            "rgba(167,139,250,0.45)",
                            "rgba(103,232,249,0.45)",
                          ],
                          boxShadow: [
                            "0 0 12px rgba(34,211,238,0.35)",
                            "0 0 16px rgba(139,92,246,0.35)",
                            "0 0 12px rgba(34,211,238,0.35)",
                          ],
                        }}
                        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                      >
                        <Icon className="h-5 w-5" />
                      </motion.span>

                      <p className="text-left text-sm leading-relaxed text-slate-100 sm:text-base">
                        <span className="font-extrabold text-cyan-200">{lead}</span>{" "}
                        - <span className="font-bold">{headline}</span>: {text}
                      </p>
                    </div>
                  </motion.article>
                ))}
              </div>

              <motion.button
                variants={itemVariants}
                type="button"
                onClick={handleClose}
                animate={{
                  boxShadow: [
                    "0 0 20px rgba(34,211,238,0.72), 0 0 34px rgba(34,211,238,0.45)",
                    "0 0 30px rgba(34,211,238,1), 0 0 44px rgba(34,211,238,0.7)",
                    "0 0 20px rgba(34,211,238,0.72), 0 0 34px rgba(34,211,238,0.45)",
                  ],
                }}
                transition={{ duration: 2.1, repeat: Infinity, ease: "easeInOut" }}
                className="mt-8 w-full rounded-2xl border border-cyan-300/65 bg-gradient-to-r from-cyan-400/40 to-cyan-300/25 px-6 py-4 text-base font-black tracking-wide text-cyan-50 drop-shadow-[0_0_20px_rgba(34,211,238,1)] transition hover:brightness-110 sm:text-lg"
              >
                Kom i gang – Opret dit første løb nu
              </motion.button>

              <motion.p
                variants={itemVariants}
                className="mt-5 text-center text-xs italic text-slate-300 sm:text-sm"
              >
                Den mest brugervenlige løsning til bevægelse i undervisningen,
                jeg nogensinde har prøvet. – En travl lærer (snart dig!)
              </motion.p>
            </motion.div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
