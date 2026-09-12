"use client";

import {
  ArrowLeft,
  ArrowRight,
  MessageSquareText,
  Settings2,
  Smartphone,
  UserSearch,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { poppins, rubik } from "@/lib/fonts";

const gameSteps = [
  "Eleverne joiner med en kode på deres mobil.",
  "De fleste får det hemmelige ord. Bedrageren gør ikke.",
  "Klassen diskuterer og stemmer om, hvem der bluffer.",
] as const;

const roleCards = [
  {
    title: "Du styrer",
    text: "Opret spillet, vælg ordet og styr faserne fra live-siden.",
    icon: Settings2,
  },
  {
    title: "Eleverne deltager",
    text: "De får en rolle på mobilen, taler sammen og stemmer til sidst.",
    icon: Smartphone,
  },
] as const;

export default function FindBedragerenIntroPage() {
  return (
    <main
      className={"min-h-screen bg-[linear-gradient(135deg,#f4f9ff_0%,#e2efff_100%)] px-6 py-8 text-slate-950 md:px-10 lg:px-12 " + poppins.className}
    >
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col">
        <header className="flex items-center justify-between gap-4">
          <Link
            href="/dashboard/mobilspil"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-sky-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:border-sky-400 hover:text-sky-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200/70"
          >
            <ArrowLeft className="h-4 w-4" />
            Mobilspil
          </Link>
          <span className="hidden items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-bold text-sky-800 sm:inline-flex">
            <UsersRound className="h-4 w-4" />
            Find Bedrageren
          </span>
        </header>

        <section className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[0.9fr_1.1fr] lg:py-16">
          <div className="max-w-xl">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-sky-700">Mobilspil</p>
            <h1 className={"mt-3 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl " + rubik.className}>
              Find Bedrageren
            </h1>
            <p className="mt-4 text-base font-medium leading-7 text-slate-600">
              Et socialt bluffspil med roller, et hemmeligt ord og en fælles afstemning.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/dashboard/opret/find-bedrageren"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#0377d8] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#075fb2] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200"
              >
                Start opsætning
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/dashboard/mobilspil"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-sky-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:border-sky-400 hover:text-sky-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200/70"
              >
                <ArrowLeft className="h-4 w-4" />
                Tilbage
              </Link>
            </div>
          </div>

          <section
            className="rounded-3xl border border-sky-200 bg-white p-6 shadow-[0_18px_44px_rgba(7,68,128,0.10)] sm:p-8"
            aria-labelledby="find-bedrageren-flow"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                <UserSearch className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">Kort fortalt</p>
                <h2 id="find-bedrageren-flow" className={"mt-1 text-2xl font-black tracking-tight text-slate-950 " + rubik.className}>
                  Roller, samtale og mistanke
                </h2>
              </div>
            </div>

            <ol className="mt-6 space-y-3">
              {gameSteps.map((step, index) => (
                <li key={step} className="flex gap-3 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0377d8] text-sm font-black text-white">
                    {index + 1}
                  </span>
                  <span className="pt-0.5 text-sm font-medium leading-6 text-slate-700">{step}</span>
                </li>
              ))}
            </ol>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {roleCards.map((card) => {
                const Icon = card.icon;

                return (
                  <section key={card.title} className="rounded-2xl border border-sky-100 bg-white p-4">
                    <Icon className="h-5 w-5 text-sky-700" />
                    <h3 className={"mt-3 text-lg font-black text-slate-950 " + rubik.className}>{card.title}</h3>
                    <p className="mt-2 text-sm font-medium leading-6 text-slate-600">{card.text}</p>
                  </section>
                );
              })}
            </div>

            <p className="mt-5 flex items-center gap-2 text-sm font-medium text-slate-600">
              <MessageSquareText className="h-4 w-4 text-sky-700" />
              Du kan starte opsætningen, når klassen er klar.
            </p>
          </section>
        </section>
      </div>
    </main>
  );
}
