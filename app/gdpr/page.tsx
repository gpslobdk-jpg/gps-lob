import type { Metadata } from "next";
import Link from "next/link";
import { Poppins, Rubik } from "next/font/google";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "GDPR & Datasikkerhed | GPSLØB",
  description:
    "GPSLØB er fuldt GDPR-kompatibelt og bygget til folkeskolen. Eleverne behøver ikke oprette konto – de deltager direkte via browser med en pinkode.",
};

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const gdprPoints = [
  {
    title: "Ingen elev-logins",
    body: "Eleverne skal ikke oprette en konto, afgive mailadresser eller downloade en app.",
  },
  {
    title: "Intet UNI-login",
    body: "Eleverne har direkte adgang via browseren.",
  },
  {
    title: "Fuld anonymitet",
    body: "De indtaster udelukkende løbets pinkode og et valgfrit holdnavn (f.eks. \"Hold 3\").",
  },
  {
    title: "Tryg datahåndtering",
    body: "Vi sporer ingen personfølsomme oplysninger. Data bruges udelukkende til at afvikle det aktive stjerneløb og vises kun på lærerens skærm.",
  },
];

export default function GdprPage() {
  return (
    <main
      className={`relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#04110f_0%,#071d1a_35%,#0d1f2e_100%)] px-4 py-8 text-white sm:px-6 md:px-10 md:py-12 ${poppins.className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.14),transparent_30%),radial-gradient(circle_at_50%_12%,rgba(255,255,255,0.05),transparent_24%)]" />

      <div className="relative mx-auto max-w-5xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-4 py-2 text-sm font-semibold text-emerald-50 transition hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Tilbage
        </Link>

        <section className="mt-6 overflow-hidden rounded-4xl border border-emerald-500/70 bg-emerald-600 text-white shadow-[0_24px_60px_rgba(5,150,105,0.35)]">
          <div className="grid gap-8 px-6 py-7 sm:px-8 sm:py-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:px-10 lg:py-10">
            <div>
              <div className="inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.24em] text-white/90">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                GDPR &amp; Datasikkerhed
              </div>
              <h1 className={`mt-5 max-w-xl text-3xl font-black tracking-tight text-white sm:text-4xl md:text-5xl ${rubik.className}`}>
                Bygget til folkeskolen. 100 % styr på GDPR.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/90 sm:text-base md:text-lg">
                Vi ved, at datasikkerhed er afgørende ude på skolerne. Derfor er systemet bygget med &quot;Privacy by Design&quot;:
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {gdprPoints.map((point) => (
                <div
                  key={point.title}
                  className="rounded-3xl border border-white/18 bg-white/10 p-4 backdrop-blur-sm"
                >
                  <p className="text-sm font-black text-white">{point.title}</p>
                  <p className="mt-2 text-sm leading-6 text-white/88">{point.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}