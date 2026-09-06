import Image from "next/image";

type AuthLoadingScreenProps = {
  title?: string;
  description?: string;
};

export default function AuthLoadingScreen({
  title = "Et øjeblik",
  description = "Vi gør din session klar og sender dig videre.",
}: AuthLoadingScreenProps) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-6 py-12 text-white">
      <div className="fixed inset-0 -z-20" aria-hidden="true">
        <Image
          src="/brand/heroes/adventure-banner.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
      </div>
      <div className="fixed inset-0 -z-10 bg-slate-950/72 backdrop-blur-[2px]" />

      <div className="relative w-full max-w-md overflow-hidden rounded-[2.5rem] border border-emerald-500/30 bg-slate-950/80 px-8 py-10 text-center shadow-[0_0_50px_rgba(16,185,129,0.2)] backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.12),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.12),transparent_34%)]" />

        <div className="relative">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-emerald-500/30 bg-slate-900/90 shadow-[0_0_30px_rgba(16,185,129,0.18)]">
            <Image
              src="/brand/logo/skolegps-arrow-mark.svg"
              alt="SkoleGPS"
              width={72}
              height={72}
              priority
              className="h-auto w-14 object-contain"
            />
          </div>

          <div className="mx-auto mt-6 flex h-10 items-center justify-center">
            <span className="inline-flex h-10 w-10 rounded-full border-4 border-emerald-500/20 border-t-emerald-400 animate-spin shadow-[0_0_24px_rgba(16,185,129,0.35)]" />
          </div>

          <h1 className="mt-6 text-2xl font-black tracking-tight text-white">
            {title}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}
