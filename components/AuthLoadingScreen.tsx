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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-sky-300 via-emerald-50 to-emerald-200 px-6 py-12 text-emerald-950 lg:bg-transparent">
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        className="fixed top-0 left-0 hidden h-full w-full object-cover -z-20 lg:block"
        src="/promo.mp4"
      />
      <div className="fixed inset-0 hidden -z-10 bg-gradient-to-b from-sky-900/15 to-emerald-900/45 backdrop-blur-[3px] lg:block" />

      <div className="relative w-full max-w-md overflow-hidden rounded-[2.5rem] border border-white/50 bg-white/80 px-8 py-10 text-center shadow-2xl backdrop-blur-md">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.12),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.12),transparent_34%)]" />

        <div className="relative">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-emerald-200 bg-white/80 shadow-lg">
            <Image
              src="/gpslogo.png"
              alt="GPSLØB logo"
              width={72}
              height={72}
              priority
              className="h-auto w-14 object-contain"
            />
          </div>

          <div className="mx-auto mt-6 flex h-10 items-center justify-center">
            <span className="inline-flex h-10 w-10 rounded-full border-4 border-emerald-200 border-t-emerald-500 animate-spin" />
          </div>

          <h1 className="mt-6 text-2xl font-black tracking-tight text-emerald-950">
            {title}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-emerald-800">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}
