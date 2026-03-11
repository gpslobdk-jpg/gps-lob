import Link from "next/link";
import { MapPin, Camera, Key, UserCheck, QrCode, Smile, ArrowUpRight } from "lucide-react";

const gameModes = [
  {
    id: "manuel",
    title: "Manuel Quiz",
    description: "Det klassiske løb med poster, tekst og spørgsmål på ruten.",
    icon: MapPin,
    href: "/dashboard/opret/manuel",
    color: "text-sky-600",
    bg: "bg-sky-100",
    border: "border-sky-200",
  },
  {
    id: "foto",
    title: "Fotomission",
    description: "Eleverne skal uploade billeder som svar på rutens poster.",
    icon: Camera,
    href: "/dashboard/opret/foto",
    color: "text-emerald-600",
    bg: "bg-emerald-100",
    border: "border-emerald-200",
  },
  {
    id: "escape",
    title: "Escape Room",
    description: "Tidsbegrænset løb med koder, der skal knækkes undervejs.",
    icon: Key,
    href: "/dashboard/opret/escape",
    color: "text-red-600",
    bg: "bg-red-100",
    border: "border-red-200",
  },
  {
    id: "rollespil",
    title: "Rollespil",
    description: "Eleverne tager roller og træffer valg, der ændrer historien.",
    icon: UserCheck,
    href: "/dashboard/opret/rollespil",
    color: "text-purple-600",
    bg: "bg-purple-100",
    border: "border-purple-200",
  },
  {
    id: "scanner",
    title: "QR Scanner",
    description: "Fysiske poster hvor eleverne skal scanne QR-koder i naturen.",
    icon: QrCode,
    href: "/dashboard/opret/scanner",
    color: "text-amber-600",
    bg: "bg-amber-100",
    border: "border-amber-200",
  },
  {
    id: "selfie",
    title: "Selfie Løb",
    description: "Kreative opgaver hvor holdet skal tage billeder af sig selv.",
    icon: Smile,
    href: "/dashboard/opret/selfie",
    color: "text-pink-600",
    bg: "bg-pink-100",
    border: "border-pink-200",
  },
];

export default function OpretPage() {
  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-gradient-to-b from-sky-300 via-emerald-50 to-emerald-200 lg:bg-none lg:bg-transparent">
      {/* LYS Baggrundsvideo (Samme som forsiden) */}
      <div className="absolute inset-0 z-0 hidden lg:block">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="h-full w-full object-cover"
          src="/promo.mp4"
        />
        {/* Lyst overlay - fjerner mørket! */}
        <div className="absolute inset-0 bg-white/10 backdrop-blur-[1px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-20">
        <div className="mb-12 text-center lg:mb-16">
          <h1 className="text-4xl font-extrabold tracking-tight text-emerald-950 sm:text-5xl lg:text-white lg:drop-shadow-lg">
            Vælg Løbstype
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-xl text-emerald-800 lg:font-medium lg:text-white lg:drop-shadow-md">
            Hvad skal dine elever opleve i dag?
          </p>
        </div>

        {/* Grid med de 6 kasser (Udsigtsposten look) */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {gameModes.map((mode) => (
            <Link key={mode.id} href={mode.href} className="group block h-full">
              <div className="relative h-full rounded-[2.5rem] border border-white/50 bg-white/80 p-7 shadow-xl backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:bg-white/95 hover:shadow-2xl">
                {/* Hjørnepilen fra din reference */}
                <div className="absolute right-6 top-6 text-gray-400 opacity-50 transition-opacity group-hover:text-emerald-500 group-hover:opacity-100">
                  <ArrowUpRight className="h-6 w-6" />
                </div>

                {/* Farvet Ikon-cirkel */}
                <div
                  className={`mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl border ${mode.border} ${mode.bg} shadow-inner transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}
                >
                  <mode.icon className={`h-8 w-8 ${mode.color}`} />
                </div>

                <h3 className="mb-3 text-2xl font-bold text-gray-900">{mode.title}</h3>

                <p className="text-base font-medium leading-relaxed text-gray-700">{mode.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
