import type { Metadata } from "next";
import Link from "next/link";
import { Poppins, Rubik } from "next/font/google";

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

export default function GdprPage() {
  return (
    <main
      className={`relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#04110f_0%,#071d1a_35%,#0d1f2e_100%)] p-10 text-white md:p-20 ${poppins.className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.14),transparent_30%),radial-gradient(circle_at_50%_12%,rgba(255,255,255,0.05),transparent_24%)]" />

      <div className="relative mx-auto max-w-5xl">
        <div className="flex justify-start">
          <Link
            href="/"
            className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-white/10"
          >
            Tilbage til forsiden
          </Link>
        </div>

        <section className="mt-10 rounded-[2.5rem] border border-white/10 bg-white/6 p-8 shadow-[0_30px_90px_rgba(0,0,0,0.28)] backdrop-blur-md md:p-12">
          <article className="mx-auto max-w-3xl space-y-6">
            <div className="space-y-4">
              <h1 className={`text-4xl font-black tracking-tight text-white md:text-6xl ${rubik.className}`}>
                Bygget til folkeskolen. 100 % styr på GDPR.
              </h1>
              <p className="text-xl font-semibold text-emerald-100">
                Privacy by Design fra dag ét
              </p>
              <p className="leading-relaxed text-slate-200 md:text-lg">
                Vi ved, at datasikkerhed er afgørende ude på skolerne. Derfor er systemet bygget med
                &quot;Privacy by Design&quot; – vi indsamler kun det absolut nødvendige, og vi sletter det igen,
                så snart løbet er slut.
              </p>
            </div>

            <section className="space-y-4">
              <h2 className={`text-2xl font-bold text-white ${rubik.className}`}>
                Ingen elev-logins
              </h2>
              <p className="leading-relaxed text-slate-200 md:text-lg">
                Eleverne skal ikke oprette en konto, afgive mailadresser eller downloade en app.
                De deltager direkte via browseren – uden UNI-login eller anden registrering.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className={`text-2xl font-bold text-white ${rubik.className}`}>
                Fuld anonymitet
              </h2>
              <p className="leading-relaxed text-slate-200 md:text-lg">
                Eleverne indtaster udelukkende løbets pinkode og et valgfrit holdnavn (f.eks.
                &quot;Hold 3&quot;). Vi sporer ingen personfølsomme oplysninger. Data bruges udelukkende til at
                afvikle det aktive løb og vises kun på lærerens skærm.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className={`text-2xl font-bold text-white ${rubik.className}`}>
                Tryg datahåndtering
              </h2>
              <p className="leading-relaxed text-slate-200 md:text-lg">
                GPS-lokation registreres kun lokalt i elevens egen browser, mens løbet er aktivt.
                Svar og eventuelle billeder gemmes kortvarigt, men læreren kan med ét klik slette
                alt på Resultatsiden. Vi kalder det vores &quot;Digitale Skraldemand&quot;.
              </p>
              <p className="leading-relaxed text-slate-200 md:text-lg">
                Billeder af elever slettes automatisk efter 30 dage – uanset om læreren husker det.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className={`text-2xl font-bold text-white ${rubik.className}`}>
                Ingen reklamer, ingen videresalg
              </h2>
              <p className="leading-relaxed text-slate-200 md:text-lg">
                Vi sælger aldrig data til tredjepart, og der er absolut ingen reklamer i platformen.
                GPSLØB er et lukket, trygt undervisningsrum.
              </p>
            </section>

            <section className="space-y-4 rounded-[1.75rem] border border-emerald-400/20 bg-emerald-400/8 p-6 shadow-[0_20px_50px_rgba(16,185,129,0.08)]">
              <h2 className={`text-2xl font-bold text-white ${rubik.className}`}>
                🔒 For skoler og kommuner
              </h2>
              <p className="leading-relaxed text-slate-200 md:text-lg">
                Vi ved, at I har brug for papirerne i orden. Vi indgår hellere end gerne en standard
                databehandleraftale (DPA) med jeres skole eller kommune, inden I tager platformen i
                brug. Skriv til os på:
              </p>
              <p className="leading-relaxed text-slate-200 md:text-lg">
                gpslobdk@gmail.com
              </p>
            </section>
          </article>
        </section>
      </div>
    </main>
  );
}