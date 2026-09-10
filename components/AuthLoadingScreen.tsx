import Mascot from "@/components/brand/Mascot";

type AuthLoadingScreenProps = {
  description?: string;
  title?: string;
};

export default function AuthLoadingScreen({
  title = "Et øjeblik",
  description = "Vi gør din session klar og sender dig videre.",
}: AuthLoadingScreenProps) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--skolegps-muted-bg)] px-6 py-12 text-slate-950">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(14,165,233,0.13),transparent_30%),radial-gradient(circle_at_84%_88%,rgba(34,164,71,0.11),transparent_28%)]" />
      <section className="relative w-full max-w-sm text-center">
        <Mascot variant="guide" size="lg" priority className="mx-auto" />
        <div className="mt-5 rounded-[1.75rem] border border-sky-100 bg-white px-6 py-7 shadow-[0_20px_56px_rgba(7,26,58,0.12)]">
          <p className="text-xs font-black tracking-[0.16em] text-sky-700 uppercase">Pilen gør klar</p>
          <h1 className="mt-3 text-2xl font-black tracking-tight text-[var(--skolegps-deep-navy)]">{title}</h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{description}</p>
          <div className="mx-auto mt-5 flex w-14 justify-between" aria-label="Indlæser">
            <span className="h-2.5 w-2.5 rounded-full bg-sky-500 skolegps-loading-dot" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-500 skolegps-loading-dot [animation-delay:120ms]" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400 skolegps-loading-dot [animation-delay:240ms]" />
          </div>
        </div>
      </section>
    </main>
  );
}
