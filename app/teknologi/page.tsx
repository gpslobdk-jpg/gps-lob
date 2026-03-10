import Link from "next/link";

export default function TeknikSide() {
  return (
    <main className="min-h-screen bg-linear-to-b from-slate-50 to-white px-6 py-16 text-slate-900 sm:px-12">
      <div className="mx-auto max-w-3xl">
        <header className="mb-16 border-b border-slate-200 pb-8">
          <Link
            href="/"
            className="mb-4 inline-block text-sm font-medium text-emerald-600 transition-colors hover:text-emerald-700"
          >
            ← Tilbage til forsiden
          </Link>
          <h1 className="mb-4 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            Engineering the Future of Outdoor Learning
          </h1>
          <p className="text-xl leading-relaxed text-slate-600">
            Bag kulissen på GPSløb.dk: Fra monolit til modulær High-End platform.
          </p>
        </header>

        <section className="prose prose-lg prose-slate max-w-none">
          <p className="lead">
            Hos GPSløb.dk nøjes vi ikke med at flytte undervisningen ud i det fri; vi
            flytter grænserne for, hvad moderne web-teknologi kan præstere i 2026. Her
            er et indblik i vores arkitektur og de massive forbedringer, vi har
            implementeret for at skabe markedets mest skalerbare løsning.
          </p>

          <hr className="my-12 border-slate-200" />

          <div className="space-y-16">
            <div>
              <h2 className="mb-4 flex items-center text-2xl font-bold">
                <span className="mr-3">🧠</span> Headless Intelligence: Arkitekturen
              </h2>
              <p>
                Vi har forladt den traditionelle, tunge kode-struktur til fordel for en{" "}
                <strong>&quot;Headless Hook Architecture&quot;</strong>.
              </p>
              <ul className="mt-4 list-disc space-y-2 pl-6">
                <li>
                  <strong>Separation of Concerns:</strong> Al spil-logik,
                  GPS-beregninger og real-tids-synkronisering er isoleret i vores{" "}
                  <code>usePlayGameState</code> motor.
                </li>
                <li>
                  <strong>AI-Ready:</strong> Denne opdeling betyder, at vores AI-modeller
                  kan interagere direkte med spillets data uden at skulle kæmpe med det
                  visuelle interface. Det gør os 10x hurtigere til at implementere nye,
                  intelligente funktioner.
                </li>
              </ul>
            </div>

            <div>
              <h2 className="mb-4 flex items-center text-2xl font-bold">
                <span className="mr-3">⚡</span> Tech Stack 2026: Bleeding Edge
              </h2>
              <p>
                Vi bygger udelukkende med de nyeste og mest kraftfulde værktøjer på
                markedet:
              </p>
              <ul className="mt-4 list-disc space-y-2 pl-6">
                <li>
                  <strong>Next.js 16 &amp; React 19:</strong> Udnyttelse af Server
                  Components og de nyeste rendering-mønstre for lynhurtig load-tid.
                </li>
                <li>
                  <strong>Tailwind CSS 4:</strong> Ultra-let styling-motor, der sikrer en
                  flydende oplevelse på alt fra iPhones til tablets.
                </li>
                <li>
                  <strong>Supabase Realtime:</strong> Millisekund-præcis dataoverførsel
                  mellem elev og lærer, så feedback sker øjeblikkeligt.
                </li>
                <li>
                  <strong>Vercel AI SDK:</strong> Indbygget intelligens der kan analysere
                  billeder, generere spørgsmål og personliggøre læringen.
                </li>
              </ul>
            </div>

            <div>
              <h2 className="mb-4 flex items-center text-2xl font-bold">
                <span className="mr-3">🛰️</span> Optimeret GPS &amp; Performance
              </h2>
              <p>
                For at sikre, at batteriet holder til en hel skoledag, har vi udviklet en{" "}
                <strong>Smart-Throttling GPS logik</strong>. Ved at analysere
                bevægelsesmønstre minimerer vi strømforbruget, uden at miste præcisionen
                på kortet.
              </p>
            </div>

            <div>
              <h2 className="mb-4 flex items-center text-2xl font-bold">
                <span className="mr-3">📈</span> Skalerbarhed i højsædet
              </h2>
              <p>
                Hele platformen er bygget til at skalere. Vores modulære komponenter
                betyder, at vi kan udrulle nye funktioner til tusindvis af brugere
                samtidigt, uden at gå på kompromis med stabiliteten.
              </p>
              <blockquote className="mt-6 rounded-r-lg border-l-4 border-emerald-500 bg-emerald-50 py-2 pl-6 italic text-slate-700">
                &quot;Vi bygger ikke bare til i dag. Vi bygger arkitekturen til næste
                generation af digital undervisning.&quot;
              </blockquote>
            </div>
          </div>

          <hr className="my-16 border-slate-200" />

          <footer className="rounded-2xl bg-slate-100 p-8 text-center">
            <h3 className="mb-2 text-xl font-bold">Vil du vide mere?</h3>
            <p className="mb-6 text-slate-600">
              Er du udvikler, partner eller interesseret i den tekniske køreplan? Vi
              deler gerne vores vision for, hvordan AI og lokationsbaseret læring
              smelter sammen.
            </p>
            <a
              href="mailto:Gpslobdk@gmail.com"
              className="inline-block rounded-full bg-slate-900 px-8 py-3 font-semibold text-white transition-all hover:bg-slate-800"
            >
              👉 Kontakt vores tekniske team
            </a>
          </footer>
        </section>
      </div>
    </main>
  );
}
