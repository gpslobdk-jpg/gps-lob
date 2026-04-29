import type { Metadata } from "next";
import Link from "next/link";
import { Poppins, Rubik } from "next/font/google";

export const metadata: Metadata = {
  title: "Privatlivspolitik & GDPR | GPSLØB",
  description:
    "GPSLØB er fuldt GDPR-kompatibelt og bygget til folkeskolen. Læs vores privatlivspolitik og se hvordan vi håndterer data.",
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
                1. Dataansvarlig
              </h2>
              <p className="leading-relaxed text-slate-200 md:text-lg">
                <strong className="text-white">GPSLØB</strong><br />
                Kontakt: <a href="mailto:gpslobdk@gmail.com" className="text-emerald-300 underline hover:text-emerald-200">gpslobdk@gmail.com</a>
              </p>
            </section>

            <section className="space-y-4">
              <h2 className={`text-2xl font-bold text-white ${rubik.className}`}>
                2. Ingen elev-logins
              </h2>
              <p className="leading-relaxed text-slate-200 md:text-lg">
                Eleverne skal ikke oprette en konto, afgive mailadresser eller downloade en app.
                De deltager direkte via browseren – uden UNI-login eller anden registrering.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className={`text-2xl font-bold text-white ${rubik.className}`}>
                3. Hvilke data indsamles
              </h2>
              <p className="leading-relaxed text-slate-200 md:text-lg">
                Eleverne indtaster udelukkende løbets pinkode og et valgfrit holdnavn (f.eks.
                &quot;Hold 3&quot;). Vi sporer ingen personfølsomme oplysninger. Data bruges udelukkende til at
                afvikle det aktive løb og vises kun på lærerens skærm.
              </p>
              <ul className="list-disc pl-6 space-y-1 text-slate-200 md:text-lg">
                <li><strong className="text-white">Holdnavn</strong> – valgfrit, indtastet af eleven</li>
                <li><strong className="text-white">GPS-lokation</strong> – kun aktivt under løbet</li>
                <li><strong className="text-white">Svar på opgaver</strong> – tekst eller valg</li>
                <li><strong className="text-white">Billeder</strong> – kun hvis opgaven kræver det</li>
                <li><strong className="text-white">Teknisk info</strong> – browser og enhedstype (til fejlfinding)</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className={`text-2xl font-bold text-white ${rubik.className}`}>
                4. Brug af kamera
              </h2>
              <p className="leading-relaxed text-slate-200 md:text-lg">
                Appen kan anmode om adgang til kameraet, men <strong className="text-white">kun</strong> hvis en opgave kræver, at eleven tager et billede som en del af løbet. Der sker ingen optagelse i baggrunden, og kameraet aktiveres aldrig uden elevens udtrykkelige handling. Adgang til kameraet kræver samtykke fra operativsystemet.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className={`text-2xl font-bold text-white ${rubik.className}`}>
                5. Brug af GPS-lokation
              </h2>
              <p className="leading-relaxed text-slate-200 md:text-lg">
                Appen bruger GPS til at registrere elevens position under løbet. Lokationen bruges <strong className="text-white">udelukkende</strong> til at afgøre, om eleven er nær en opgavepost. GPS-data lagres ikke permanent, deles ikke med tredjepart og bruges ikke til sporing uden for løbet. Lokationsadgang deaktiveres automatisk, når løbet er slut.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className={`text-2xl font-bold text-white ${rubik.className}`}>
                6. Tryg datahåndtering
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
                7. Opbevaring og sletning
              </h2>
              <ul className="list-disc pl-6 space-y-1 text-slate-200 md:text-lg">
                <li>Løbsdata (svar, positioner) slettes automatisk, når løbet afsluttes</li>
                <li>Billeder slettes automatisk efter 30 dage</li>
                <li>Læreren kan til enhver tid slette alt manuelt via Resultatsiden</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className={`text-2xl font-bold text-white ${rubik.className}`}>
                8. Ingen reklamer, ingen videresalg
              </h2>
              <p className="leading-relaxed text-slate-200 md:text-lg">
                Vi sælger aldrig data til tredjepart, og der er absolut ingen reklamer i platformen.
                GPSLØB er et lukket, trygt undervisningsrum.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className={`text-2xl font-bold text-white ${rubik.className}`}>
                9. Tredjeparter
              </h2>
              <p className="leading-relaxed text-slate-200 md:text-lg">
                GPSLØB anvender følgende underleverandører til drift af platformen:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-slate-200 md:text-lg">
                <li><strong className="text-white">Supabase</strong> – database og backend (EU-hosting)</li>
                <li><strong className="text-white">Vercel</strong> – webhosting</li>
                <li><strong className="text-white">Stripe</strong> – betalingsbehandling (kun for lærere/skoler)</li>
                <li><strong className="text-white">Sentry</strong> – teknisk fejlovervågning (ingen elevdata)</li>
              </ul>
              <p className="leading-relaxed text-slate-200 md:text-lg">
                Ingen af disse modtager personfølsomme oplysninger om elever. Data videresælges aldrig.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className={`text-2xl font-bold text-white ${rubik.className}`}>
                10. Dine rettigheder
              </h2>
              <p className="leading-relaxed text-slate-200 md:text-lg">
                Du har ret til indsigt i, hvilke data vi har registreret, ret til at få dem slettet og ret til at gøre indsigelse mod behandlingen. Kontakt os på{" "}
                <a href="mailto:gpslobdk@gmail.com" className="text-emerald-300 underline hover:text-emerald-200">gpslobdk@gmail.com</a>.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className={`text-2xl font-bold text-white ${rubik.className}`}>
                11. Målgruppe – designet til skoler
              </h2>
              <p className="leading-relaxed text-slate-200 md:text-lg">
                GPSLØB er udelukkende designet til undervisningsbrug i folkeskolen og lignende institutioner. Systemet indsamler ikke personfølsomme data om elever. Eleverne er altid anonyme i systemet.
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
                <a href="mailto:gpslobdk@gmail.com" className="text-emerald-300 underline hover:text-emerald-200">gpslobdk@gmail.com</a>
              </p>
            </section>

            <section className="space-y-2">
              <p className="text-sm text-slate-400">
                Denne privatlivspolitik kan opdateres ved væsentlige ændringer i platformen. <strong className="text-slate-300">Senest opdateret: 29. april 2026.</strong>
              </p>
            </section>
          </article>
        </section>
      </div>
    </main>
  );
}