"use client";

import { motion } from "framer-motion";
import { FolderOpen, MapPin, Radio } from "lucide-react";
import { Poppins, Rubik } from "next/font/google";
import Image from "next/image";
import Link from "next/link";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const cardBaseClass =
  "relative bg-[#131b35] rounded-[2rem] p-8 overflow-hidden border border-white/5 hover:bg-[#1a2442] transition-colors duration-300 flex flex-col h-[300px] cursor-pointer";

export default function DashboardPage() {
  return (
    <div className={`min-h-screen bg-[#0a1128] text-white p-6 md:p-12 ${poppins.className}`}>
      <header className="flex items-center justify-between">
        <Image src="/gpslogo.png" width={150} height={50} alt="Logo" priority />
        <button
          type="button"
          className="text-white/50 hover:text-white transition-colors"
        >
          Log ud
        </button>
      </header>

      <section className="text-center">
        <h1
          className={`text-4xl md:text-6xl font-black tracking-widest uppercase mb-2 mt-12 ${rubik.className}`}
        >
          KONTROLTÅRNET
        </h1>
        <p className="text-white/65">Vælg din næste handling og kom i gang</p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto mt-12">
        <Link href="/dashboard/opret" className="block">
          <motion.article whileHover={{ scale: 1.03 }} className={cardBaseClass}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center mb-6 bg-cyan-400/10 border border-cyan-300/30 text-cyan-300">
              <MapPin className="h-7 w-7" />
            </div>
            <h2 className={`text-2xl font-bold uppercase tracking-wide mb-2 ${rubik.className}`}>
              OPRET NYT LØB
            </h2>
            <p className="text-sm font-semibold uppercase text-white/50 mb-4">
              BYG PÅ ET RIGTIGT KORT.
            </p>
            <p className="text-white/70 text-sm leading-relaxed">
              Sæt poster ind på et interaktivt kort, skriv spørgsmål og gem
              lynhurtigt.
            </p>
            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gradient-to-r from-cyan-400 to-blue-500 shadow-[0_-5px_20px_rgba(34,211,238,0.5)]" />
          </motion.article>
        </Link>

        <Link href="/dashboard" className="block">
          <article className={cardBaseClass}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center mb-6 bg-emerald-400/10 border border-emerald-300/30 text-emerald-300">
              <Radio className="h-7 w-7" />
            </div>
            <h2 className={`text-2xl font-bold uppercase tracking-wide mb-2 ${rubik.className}`}>
              LIVE OVERVÅGNING
            </h2>
            <p className="text-sm font-semibold uppercase text-white/50 mb-4">
              FØLG KLASSEN I REALTID.
            </p>
            <p className="text-white/70 text-sm leading-relaxed">
              Se elevernes positioner bevæge sig på kortet og modtag deres svar
              live.
            </p>
            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-400 to-green-500 shadow-[0_-5px_20px_rgba(52,211,153,0.5)]" />
          </article>
        </Link>

        <Link href="/dashboard/arkiv" className="block">
          <article className={cardBaseClass}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center mb-6 bg-purple-400/10 border border-purple-300/30 text-purple-300">
              <FolderOpen className="h-7 w-7" />
            </div>
            <h2 className={`text-2xl font-bold uppercase tracking-wide mb-2 ${rubik.className}`}>
              MIT LØBSARKIV
            </h2>
            <p className="text-sm font-semibold uppercase text-white/50 mb-4">
              GENBRUG OG DEL.
            </p>
            <p className="text-white/70 text-sm leading-relaxed">
              Find alle dine tidligere løb, rediger dem, eller del koden med en
              ny klasse.
            </p>
            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gradient-to-r from-purple-400 to-pink-500 shadow-[0_-5px_20px_rgba(192,132,252,0.5)]" />
          </article>
        </Link>
      </section>
    </div>
  );
}
