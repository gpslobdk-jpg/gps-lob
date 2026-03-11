export default function BetaBanner() {
  return (
    <div className="sticky top-0 z-40 border-b border-emerald-500/20 bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-3 px-4 py-3 text-center">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400" />
        <p className="text-xs font-bold tracking-[0.22em] text-emerald-300 uppercase">
          Gratis beta er åben frem til 1. august 2026
        </p>
      </div>
    </div>
  );
}
