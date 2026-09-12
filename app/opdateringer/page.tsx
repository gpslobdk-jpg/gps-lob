import type { Metadata } from "next";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { poppins, rubik } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "Opdateringer | SkoleGPS",
  description: "Korte, praktiske opdateringer om SkoleGPS.",
};

const updates = [
  {
    title: "SkoleGPS",
    body:
      "SkoleGPS samler GPSLøb og lærerflader på dette site. De kendte indgange til løb, login og arkiv er bevaret.",
  },
  {
    title: "SkemaPilot",
    body:
      "SkemaPilot er et selvstændigt værktøj. Åbn det på den angivne hjemmeside, hvis det er det værktøj, du leder efter.",
    link: {
      href: "https://www.skemapilot.dk",
      label: "Åbn SkemaPilot",
    },
  },
] as const;

export default function OpdateringerPage() {
  return (
    <main
      className={`min-h-screen bg-[linear-gradient(180deg,#f4f9ff_0%,#e2efff_42%,#ffffff_100%)] px-5 py-6 text-slate-900 sm:px-8 sm:py-10 ${poppins.className}`}
    >
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:border-sky-300 hover:text-sky-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Til forsiden
        </Link>

        <article className="mt-7 rounded-[2rem] border border-sky-200 bg-white p-6 shadow-[0_18px_45px_rgba(7,26,58,0.08)] sm:p-10">
          <p className="text-xs font-black tracking-[0.18em] text-sky-800 uppercase">SkoleGPS</p>
          <h1
            className={`mt-4 text-4xl font-black tracking-tight text-[var(--skolegps-deep-navy)] sm:text-5xl ${rubik.className}`}
          >
            Opdateringer
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-700 sm:text-lg">
            Korte, praktiske beskeder om SkoleGPS og de relevante indgange.
          </p>

          <div className="mt-8 space-y-4">
            {updates.map((update) => (
              <section key={update.title} className="rounded-2xl border border-sky-100 bg-sky-50/55 p-5 sm:p-6">
                <h2 className={`text-xl font-black text-[var(--skolegps-deep-navy)] ${rubik.className}`}>
                  {update.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-700">{update.body}</p>

                {"link" in update ? (
                  <a
                    href={update.link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-black text-sky-800 transition hover:border-sky-300 hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-800"
                  >
                    {update.link.label}
                    <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  </a>
                ) : null}
              </section>
            ))}
          </div>
        </article>
      </div>
    </main>
  );
}
