import Link from "next/link";
import { Poppins, Rubik } from "next/font/google";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export default function PrivacyPage() {
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
                Privatliv, Sikkerhed & Udvikler Info
              </h1>
              <p className="text-xl font-semibold text-emerald-100">
                Vi passer på elevernes data (og rydder op efter os)
              </p>
              <p className="text-slate-200 leading-relaxed md:text-lg">
                Når I løber GPS-løb hos os, skal fokus være på leg, læring og frisk luft – ikke på
                bekymringer om data. Vi har bygget platformen med &quot;Privacy by Design&quot;, hvilket betyder,
                at vi kun indsamler det absolut nødvendige, og vi sletter det igen, så snart løbet er
                slut.
              </p>
            </div>

            <section className="space-y-4">
              <h2 className={`text-2xl font-bold text-white ${rubik.className}`}>
                1. Hvilke data indsamler vi?
              </h2>
              <p className="text-slate-200 leading-relaxed md:text-lg">
                Når en elev (eller et hold) deltager i et løb, beder vi kun om:
              </p>
              <ul className="list-disc space-y-2 pl-6 text-slate-200 leading-relaxed md:text-lg">
                <li>Et holdnavn (eller fornavn).</li>
                <li>
                  Deres GPS-lokation (kun mens løbet er aktivt, og kun lokalt i deres egen browser –
                  vi overvåger dem ikke centralt).
                </li>
                <li>
                  Deres svar på posterne (tekst) og eventuelle billeder/selfies, hvis læreren har valgt
                  en foto-post.
                </li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className={`text-2xl font-bold text-white ${rubik.className}`}>
                2. Hvad bruges dataen til?
              </h2>
              <p className="text-slate-200 leading-relaxed md:text-lg">
                Dataen bruges udelukkende til at drive spillet fremad og til at vise læreren et
                Leaderboard og en resultatliste, når løbet er færdigt, så I kan kåre en vinder.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className={`text-2xl font-bold text-white ${rubik.className}`}>
                3. Vores &quot;Digitale Skraldemand&quot; (Automatisk sletning)
              </h2>
              <p className="text-slate-200 leading-relaxed md:text-lg">
                Vi ønsker ikke at gemme billeder af børn og unge. Derfor har vi indbygget en funktion,
                vi kalder den &quot;Digitale Skraldemand&quot;.
              </p>
              <p className="text-slate-200 leading-relaxed md:text-lg">
                Læreren kan med ét klik slette alle billeder og svar på Resultatsiden.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className={`text-2xl font-bold text-white ${rubik.className}`}>
                4. Ingen reklamer, ingen videresalg
              </h2>
              <p className="text-slate-200 leading-relaxed md:text-lg">
                Vi sælger aldrig data til tredjepart, og der er absolut ingen reklamer i appen.
                Platformen er et lukket, trygt undervisningsrum.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className={`text-2xl font-bold text-white ${rubik.className}`}>
                5. For skoler og kommuner (Databehandleraftale)
              </h2>
              <p className="text-slate-200 leading-relaxed md:text-lg">
                Vi ved, at I har brug for papirerne i orden. Vi indgår hellere end gerne en standard
                databehandleraftale (DPA) med jeres skole eller kommune, før I tager platformen i brug.
              </p>
            </section>

            <div className="border-t border-white/10 pt-2" />

            <section className="space-y-4">
              <h2 className={`text-2xl font-bold text-white ${rubik.className}`}>
                Udvikler Info & Support
              </h2>
              <p className="text-slate-200 leading-relaxed md:text-lg">
                Har du tekniske spørgsmål, ønsker du at købe adgang til din skole, eller vil du kontakte
                udvikleren direkte?
              </p>
              <p className="text-slate-200 leading-relaxed md:text-lg">
                Skriv en mail til: gpslobdk@gmail.com
              </p>
            </section>
          </article>
        </section>
      </div>
    </main>
  );
}
