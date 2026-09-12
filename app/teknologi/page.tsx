import type { Metadata } from "next";
import { ArrowLeft, MapPin, Server, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { poppins, rubik } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "Teknologi bag SkoleGPS",
  description:
    "Kort information om teknologien bag SkoleGPS, placeringstilladelser og drift.",
};

const sections = [
  {
    title: "En webtjeneste til løb",
    body:
      "SkoleGPS er bygget som en webapplikation. Lærere opretter og administrerer løb i browseren, og elever deltager fra den enhed, læreren vælger.",
    icon: Server,
  },
  {
    title: "Placering i et løb",
    body:
      "Når et løb kræver placering, afhænger det af enhedens og browserens tilladelse. Hvis placeringen mangler, kan læreren bruge den konkrete GPS-hjælp uden at nulstille elevens hold eller fremdrift.",
    icon: MapPin,
  },
  {
    title: "Drift og sikkerhed",
    body:
      "Vi vedligeholder tjenesten løbende. Spørgsmål om data, teknik eller skolens egne rammer skal altid vurderes i den konkrete sammenhæng.",
    icon: ShieldCheck,
  },
] as const;

export default function TeknikSide() {
  return (
    <main
      className={`min-h-screen bg-[linear-gradient(180deg,#f4f9ff_0%,#e2efff_38%,#ffffff_100%)] px-5 py-6 text-slate-900 sm:px-8 sm:py-10 ${poppins.className}`}
    >
      <div className="mx-auto max-w-4xl">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:border-sky-300 hover:text-sky-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Til forsiden
        </Link>

        <article className="mt-7 rounded-[2rem] border border-sky-200 bg-white p-6 shadow-[0_18px_45px_rgba(7,26,58,0.08)] sm:p-10">
          <p className="text-xs font-black tracking-[0.18em] text-sky-800 uppercase">Bag SkoleGPS</p>
          <h1
            className={`mt-4 text-4xl font-black tracking-tight text-[var(--skolegps-deep-navy)] sm:text-5xl ${rubik.className}`}
          >
            Teknologi bag SkoleGPS
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-700 sm:text-lg">
            Her er den korte version af, hvordan SkoleGPS fungerer teknisk.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {sections.map(({ title, body, icon: Icon }) => (
              <section key={title} className="rounded-2xl border border-sky-100 bg-sky-50/55 p-5">
                <Icon className="h-5 w-5 text-sky-700" aria-hidden="true" />
                <h2 className="mt-3 text-lg font-black text-[var(--skolegps-deep-navy)]">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
              </section>
            ))}
          </div>

          <section className="mt-8 rounded-2xl border border-sky-100 bg-sky-50/70 p-5 sm:p-6">
            <h2 className={`text-xl font-black text-[var(--skolegps-deep-navy)] ${rubik.className}`}>
              Spørgsmål til teknik eller data
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">
              Skriv til os, hvis du har brug for at afklare en teknisk eller databeskyttelsesmæssig
              ramme på din skole.
            </p>
            <a
              href="mailto:skolegpsdk@gmail.com"
              className="mt-5 inline-flex min-h-11 items-center rounded-full bg-[var(--skolegps-blue-strong)] px-5 py-2 text-sm font-black text-white shadow-[0_12px_24px_rgba(3,119,216,0.18)] transition hover:bg-sky-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-800"
            >
              Kontakt SkoleGPS
            </a>
          </section>
        </article>
      </div>
    </main>
  );
}
