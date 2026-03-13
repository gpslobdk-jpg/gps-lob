type MobileBuilderWarningProps = {
  className?: string;
};

export function MobileBuilderWarning({ className = "" }: MobileBuilderWarningProps) {
  const rootClassName = ["lg:hidden", className].filter(Boolean).join(" ");

  return (
    <div className={rootClassName}>
      <div className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6 sm:py-6">
        <div className="overflow-hidden rounded-[2rem] border border-sky-400/20 bg-slate-950/75 p-5 shadow-[0_30px_80px_rgba(15,23,42,0.55)] backdrop-blur-2xl sm:p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-sky-400/30 bg-sky-400/10 text-3xl shadow-[0_0_30px_rgba(56,189,248,0.18)]">
              <span aria-hidden>💻</span>
            </div>

            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-[0.28em] text-sky-100/55 uppercase">
                Mobile Warning
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
                Brug en computer til builderen
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-200/80">
                For at oprette og redigere løb skal du åbne gpslob.dk på en computer.
                Builderen har brug for ekstra skærmplads til kort, AI-værktøjer og præcis
                redigering.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
