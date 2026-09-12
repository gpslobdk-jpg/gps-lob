import { ArrowLeft, BookOpen, ChevronRight } from "lucide-react";
import Link from "next/link";

const categories = [
  {
    key: "indskoling",
    title: "Indskoling",
    description: "Materialer til 0.–3. klasse.",
  },
  {
    key: "mellemtrin",
    title: "Mellemtrin",
    description: "Materialer til 4.–6. klasse.",
  },
  {
    key: "udskoling",
    title: "Udskoling",
    description: "Materialer til 7.–10. klasse.",
  },
] as const;

export default function BibliotekPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#f4f9ff_0%,#e2efff_100%)] px-6 py-8 text-slate-950 md:px-10">
      <div className="mx-auto w-full max-w-5xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/dashboard/opret/stjerneloeb"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-sky-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:border-sky-400 hover:text-sky-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200/70"
          >
            <ArrowLeft className="h-4 w-4" />
            Stjerneløb
          </Link>
          <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-bold text-sky-800">
            <BookOpen className="h-4 w-4" />
            Bibliotek
          </span>
        </header>

        <section className="mt-12">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-sky-700">Stjerneløb</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950">Find et materiale</h1>
          <p className="mt-3 max-w-xl text-base font-medium leading-7 text-slate-600">
            Vælg klassetrin og åbn et printklart materiale.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {categories.map((category) => (
              <Link
                key={category.key}
                href={`/dashboard/opret/stjerneloeb/bibliotek/${category.key}`}
                className="group rounded-3xl border border-sky-200 bg-white p-6 shadow-sm transition hover:border-sky-400 hover:shadow-[0_16px_36px_rgba(7,68,128,0.10)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200"
              >
                <BookOpen className="h-6 w-6 text-sky-700" />
                <h2 className="mt-5 text-xl font-black text-slate-950">{category.title}</h2>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-600">{category.description}</p>
                <span className="mt-6 inline-flex items-center gap-1 text-sm font-bold text-sky-800">
                  Se materialer
                  <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
