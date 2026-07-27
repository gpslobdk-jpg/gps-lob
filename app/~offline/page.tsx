/* eslint-disable @next/next/no-html-link-for-pages -- Offline recovery must force a full network navigation. */

export default function OfflinePage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-slate-950 px-5 py-10 text-white">
      <section className="w-full max-w-md rounded-[2rem] border border-white/10 bg-slate-900 p-7 text-center shadow-2xl sm:p-9">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">
          SkoleGPS
        </p>
        <h1 className="mt-4 text-3xl font-black">Du er offline</h1>
        <p className="mt-4 text-base leading-7 text-slate-200">
          Der kunne ikke oprettes forbindelse. Kontrollér nettet, og prøv igen.
        </p>

        <div className="mt-7 grid gap-3">
          <a
            href="/join"
            className="inline-flex min-h-14 items-center justify-center rounded-2xl bg-emerald-400 px-5 py-3 text-base font-black text-slate-950 transition hover:bg-emerald-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-200"
          >
            Prøv igen
          </a>
          <a
            href="/"
            className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            Gå til forsiden
          </a>
        </div>
      </section>
    </main>
  );
}
