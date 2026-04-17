import type { Metadata } from "next";
import Link from "next/link";
import { Poppins, Rubik } from "next/font/google";

export const metadata: Metadata = {
  title: "Juridisk Ansvarsfraskrivelse | GPSLØB",
  description:
    "Fuld juridisk uddybning og ansvarsfraskrivelse for GPS Løb. Ophavsretsloven, E-handelsloven og Safe Harbor.",
};

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export default function JuraPage() {
  return (
    <main
      className={`relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#04110f_0%,#071d1a_35%,#0d1f2e_100%)] p-10 text-white md:p-20 ${poppins.className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.14),transparent_30%),radial-gradient(circle_at_50%_12%,rgba(255,255,255,0.05),transparent_24%)]" />

      <div className="relative mx-auto max-w-5xl">
        <div className="flex gap-3">
          <Link
            href="/ophavsret"
            className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-white/10"
          >
            &larr; Ophavsret
          </Link>
          <Link
            href="/"
            className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-white/10"
          >
            Forsiden
          </Link>
        </div>

        <section className="mt-10 rounded-[2.5rem] border border-white/10 bg-white/6 p-8 shadow-[0_30px_90px_rgba(0,0,0,0.28)] backdrop-blur-md md:p-12">
          <article className="mx-auto max-w-3xl space-y-8">
            <div className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-amber-200">
                Disclaimer
              </p>
              <h1 className={`text-3xl font-black tracking-tight text-white md:text-5xl ${rubik.className}`}>
                Juridisk Uddybning og Ansvarsfraskrivelse
              </h1>
              <p className="text-lg text-slate-300">
                Denne side indeholder den fulde juridiske ramme for brug af GPS L&oslash;bs
                AI-v&aelig;rkt&oslash;jer. For den p&aelig;dagogiske introduktion, se{" "}
                <Link href="/ophavsret" className="text-emerald-400 hover:underline">
                  ophavsretssiden
                </Link>
                .
              </p>
            </div>

            <section className="grid gap-5">
              {/* § 1 */}
              <div className="rounded-[1.9rem] border border-emerald-400/20 bg-emerald-400/8 p-6 shadow-[0_20px_50px_rgba(16,185,129,0.08)]">
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-200">
                  &sect; 1
                </p>
                <h2 className={`mt-3 text-2xl font-bold text-white ${rubik.className}`}>
                  Brugerens rettigheder og ansvar (Ophavsretsloven)
                </h2>
                <p className="mt-4 text-slate-200 leading-relaxed md:text-lg">
                  I henhold til den danske Ophavsretslov tilh&oslash;rer eneretten til
                  eksemplarfremstilling og tilg&aelig;ngeligg&oslash;relse ophavsmanden. Ved upload af
                  billeder, tekster eller links til bearbejdning i GPS L&oslash;bs AI-tjenester
                  indest&aring;r brugeren (underviseren) fuldt ud for, at materialet anvendes
                  lovligt. Dette indeb&aelig;rer, at brugeren enten har indhentet forn&oslash;dent
                  samtykke fra rettighedshaveren, agerer inden for rammerne af citatretten
                  (Ophavsretslovens &sect;&nbsp;22), eller at anvendelsen er d&aelig;kket af skolens
                  g&aelig;ldende aftale med Copydan Tekst &amp; Node.
                </p>
              </div>

              {/* § 2 */}
              <div className="rounded-[1.9rem] border border-sky-400/20 bg-sky-400/8 p-6 shadow-[0_20px_50px_rgba(56,189,248,0.08)]">
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-200">
                  &sect; 2
                </p>
                <h2 className={`mt-3 text-2xl font-bold text-white ${rubik.className}`}>
                  Platformens status som teknisk formidler (Safe Harbor)
                </h2>
                <p className="mt-4 text-slate-200 leading-relaxed md:text-lg">
                  GPS L&oslash;b fungerer udelukkende som en teknisk it-infrastruktur og
                  databehandler for brugeren. I overensstemmelse med E-handelslovens regler om
                  ansvarsfrihed for formidlere (E-handelslovens &sect;&nbsp;16) samt principperne i
                  EU&apos;s Forordning om Digitale Tjenester (DSA), b&aelig;rer GPS L&oslash;b intet
                  redaktionelt eller juridisk ansvar for det specifikke indhold, brugerne uploader,
                  scanner eller transmitterer via tjenesten. Platformen udf&oslash;rer ingen
                  forudg&aring;ende manuel eller automatiseret kontrol af rettighederne til det
                  brugergenererede indhold.
                </p>
              </div>

              {/* § 3 */}
              <div className="rounded-[1.9rem] border border-amber-400/20 bg-amber-400/8 p-6 shadow-[0_20px_50px_rgba(245,158,11,0.08)]">
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-amber-200">
                  &sect; 3
                </p>
                <h2 className={`mt-3 text-2xl font-bold text-white ${rubik.className}`}>
                  Procedure for kr&aelig;nkelse (Notice and Takedown)
                </h2>
                <p className="mt-4 text-slate-200 leading-relaxed md:text-lg">
                  S&aring;fremt GPS L&oslash;b g&oslash;res opm&aelig;rksom p&aring;, at specifikt indhold lagret
                  p&aring; platformen bekr&aelig;ftes at kr&aelig;nke tredjeparts immaterielle rettigheder,
                  forbeholder vi os retten til omg&aring;ende at fjerne eller blokere adgangen til det
                  p&aring;g&aelig;ldende l&oslash;b eller materiale uden forudg&aring;ende varsel for at opretholde
                  vores ansvarsfrihed som formidler.
                </p>
              </div>

              {/* § 4 */}
              <div className="rounded-[1.9rem] border border-violet-400/20 bg-violet-400/8 p-6 shadow-[0_20px_50px_rgba(139,92,246,0.08)]">
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-violet-200">
                  &sect; 4
                </p>
                <h2 className={`mt-3 text-2xl font-bold text-white ${rubik.className}`}>
                  Databehandling og tredjeparts AI-modeller
                </h2>
                <p className="mt-4 text-slate-200 leading-relaxed md:text-lg">
                  GPS L&oslash;b benytter lukkede API-forbindelser til anerkendte
                  underdatabehandlere. Disse enterprise-aftaler er underlagt strenge{" "}
                  <span className="font-semibold text-white">&ldquo;Zero Data Retention&rdquo;</span>-politikker.
                  Dette garanterer juridisk, at det ophavsretsbesk&oslash;ttede materiale,
                  der midlertidigt behandles for at generere l&oslash;bssp&oslash;rgsm&aring;l,
                  &oslash;jeblikkeligt slettes efter endt session og p&aring; intet tidspunkt indg&aring;r i
                  tr&aelig;ningsdata for offentlige AI-grundmodeller.
                </p>
              </div>
            </section>
          </article>
        </section>
      </div>
    </main>
  );
}
