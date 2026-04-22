import Link from "next/link";

const cardBaseClass =
  "group relative z-0 mx-auto flex h-[12rem] w-full max-w-[20.5rem] flex-col overflow-visible rounded-[2rem] border bg-white/10 p-0 text-left shadow-[0_22px_52px_rgba(15,23,42,0.16),0_8px_18px_rgba(15,23,42,0.07),inset_0_1px_0_rgba(255,255,255,0.16)] backdrop-blur-lg transition-all duration-300 hover:z-20 focus-within:z-20";

const cardBackgroundShellClass =
  "pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[2rem]";

const cardPanelClass =
  "relative flex h-full flex-col items-center justify-center rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.05))] px-4 py-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-16px_24px_rgba(15,23,42,0.07)]";

const categories = [
  {
    key: "indskoling",
    title: "Indskoling",
    description: "Materialer og skabeloner til 0.–3. klasse.",
    accentClass:
      "border-lime-500/75 bg-lime-950/30 shadow-[0_24px_56px_rgba(15,23,42,0.18),0_16px_32px_rgba(132,204,22,0.24),inset_0_1px_0_rgba(255,255,255,0.18)]",
    accentGlowClass:
      "bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.24),transparent_32%),radial-gradient(circle_at_bottom,rgba(132,204,22,0.30),transparent_62%)] shadow-[inset_0_0_54px_rgba(132,204,22,0.24)]",
    badgeClass: "border-lime-300/40 bg-lime-400/20 text-white",
  },
  {
    key: "mellemtrin",
    title: "Mellemtrin",
    description: "Materialer og skabeloner til 4.–6. klasse.",
    accentClass:
      "border-indigo-500/75 bg-indigo-950/30 shadow-[0_24px_56px_rgba(15,23,42,0.18),0_16px_32px_rgba(99,102,241,0.24),inset_0_1px_0_rgba(255,255,255,0.18)]",
    accentGlowClass:
      "bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.24),transparent_32%),radial-gradient(circle_at_bottom,rgba(99,102,241,0.30),transparent_62%)] shadow-[inset_0_0_54px_rgba(99,102,241,0.24)]",
    badgeClass: "border-indigo-300/40 bg-indigo-400/20 text-white",
  },
  {
    key: "udskoling",
    title: "Udskoling",
    description: "Materialer og skabeloner til 7.–10. klasse.",
    accentClass:
      "border-purple-500/75 bg-purple-950/30 shadow-[0_24px_56px_rgba(15,23,42,0.18),0_16px_32px_rgba(147,51,234,0.24),inset_0_1px_0_rgba(255,255,255,0.18)]",
    accentGlowClass:
      "bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.24),transparent_32%),radial-gradient(circle_at_bottom,rgba(147,51,234,0.30),transparent_62%)] shadow-[inset_0_0_54px_rgba(147,51,234,0.24)]",
    badgeClass: "border-purple-300/40 bg-purple-400/20 text-white",
  },
];

function CategoryCard({ cat }: { cat: (typeof categories)[0] }) {
  return (
    <Link href={`/dashboard/opret/stjerneloeb/bibliotek/${cat.key}`} className="block w-full text-left">
      <article className={`${cardBaseClass} ${cat.accentClass} cursor-pointer`}>
        <div className={cardBackgroundShellClass}>
          <div className={`absolute inset-0 rounded-[2rem] ${cat.accentGlowClass}`} />
          <div className="absolute inset-[1px] rounded-[1.95rem]" />
        </div>

        <div className={`${cardPanelClass} text-slate-950`}>
          <div className="relative z-10 flex h-full w-full flex-col items-center justify-center text-center">
            <div className="space-y-1">
              <h2 className={`text-[1.4rem] font-black tracking-tight text-white drop-shadow-[0_10px_24px_rgba(15,23,42,0.28)]`}>
                {cat.title}
              </h2>
              <p className="mx-auto max-w-[15rem] text-xs leading-tight text-white/84">{cat.description}</p>
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}

export default function BibliotekPage() {
  return (
    <main className="relative flex min-h-screen flex-col px-6 py-6 text-white md:px-10">
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 hidden h-full w-full object-cover lg:block"
        src="/bg-loop.mp4"
      />
      <div className="absolute inset-0 z-10 bg-slate-950/70 lg:block" />

      <header className="relative z-20 mx-auto flex w-full max-w-6xl items-center justify-between py-4">
        <h1 className="text-2xl font-black tracking-tight">Stjerneløb — Bibliotek</h1>
      </header>

      <section className="relative z-20 mx-auto mt-8 w-full max-w-6xl">
        <p className="mb-6 text-sm text-white/80">Vælg et klassetrin for at se bibliotekets materialer.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 justify-items-center gap-8">
          {categories.map((cat) => (
            <CategoryCard key={cat.key} cat={cat as any} />
          ))}
        </div>
      </section>
    </main>
  );
}
