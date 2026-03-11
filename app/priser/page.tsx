"use client";

import Link from "next/link";
import { Poppins, Rubik } from "next/font/google";
import { useState, type ReactNode } from "react";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

type PriceCard = {
  title: string;
  price: string;
  priceMeta: string;
  audience: string;
  features: string[];
  ctaLabel: string;
  ctaHref?: string;
  priceId?: string;
  featured?: boolean;
  badge?: string;
  accent: string;
  cardTone: string;
  buttonTone: string;
};

const WEEKEND_PASS_PRICE_ID = "price_1T9B9BFezSVmwrOXmJX9Qw1L";
const EVENT_PASS_PRICE_ID = "price_1T9BJsFezSVmwrOXlaklvAzQ";
const BETA_PRICE_COPY = "Gratis under Beta";
const BETA_META_COPY = "Soft opening frem til 1. august 2026";
const CHECKOUT_DISABLED = true;

const priceCards: PriceCard[] = [
  {
    title: "Prøv det gratis",
    price: BETA_PRICE_COPY,
    priceMeta: BETA_META_COPY,
    audience: "Perfekt til at teste konceptet med en enkelt klasse eller et hurtigt pilotløb.",
    features: ["1 aktivt løb", "Klassisk Quiz", "Max 15 deltagere"],
    ctaLabel: "Opret gratis konto",
    ctaHref: "/login",
    accent: "from-emerald-500/20 via-transparent to-transparent",
    cardTone: "border-white/10 bg-white/6",
    buttonTone:
      "border border-white/20 bg-white/8 text-white hover:border-white/35 hover:bg-white/12",
  },
  {
    title: "Børnefødselsdagen",
    price: BETA_PRICE_COPY,
    priceMeta: BETA_META_COPY,
    audience: "Til forældre, der vil lave et hurtigt, sjovt og fleksibelt løb hjemme eller i parken.",
    features: [
      "Adgang til alle løbstyper",
      "AI-Foto & Tidsmaskinen",
      "Ubegrænset deltagere i 48 timer",
    ],
    ctaLabel: "Køb adgang",
    priceId: WEEKEND_PASS_PRICE_ID,
    accent: "from-sky-500/18 via-transparent to-transparent",
    cardTone: "border-white/10 bg-white/6",
    buttonTone:
      "border border-white/20 bg-white/8 text-white hover:border-white/35 hover:bg-white/12",
  },
  {
    title: "Skolelicensen",
    price: BETA_PRICE_COPY,
    priceMeta: BETA_META_COPY,
    audience: "Til skoler og institutioner, der vil gøre GPSLØB til et fast værktøj i undervisningen.",
    features: [
      "Ubegrænset for alle lærere",
      "Fuld adgang til AI Bog-Scanner og Rollespil",
      "EAN-fakturering",
      "Prioriteret support",
    ],
    ctaLabel: "Bestil med EAN",
    ctaHref: "mailto:gpslobdk@gmail.com?subject=Bestilling%20af%20Skolelicens",
    featured: true,
    badge: "Mest populær",
    accent: "from-emerald-400/28 via-emerald-300/10 to-transparent",
    cardTone:
      "border-emerald-300/40 bg-emerald-400/10 shadow-[0_24px_80px_rgba(16,185,129,0.18)]",
    buttonTone:
      "bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-[0_16px_34px_rgba(16,185,129,0.32)]",
  },
  {
    title: "Teambuilding",
    price: BETA_PRICE_COPY,
    priceMeta: BETA_META_COPY,
    audience: "Til firmaer, polterabends og events, hvor oplevelsen skal føles skræddersyet og skarp.",
    features: [
      "Adgang i 7 dage",
      "Escape Room features",
      "Firmalogo på løbet",
      "Download resultater",
    ],
    ctaLabel: "Køb Event-pakke",
    priceId: EVENT_PASS_PRICE_ID,
    accent: "from-amber-500/18 via-transparent to-transparent",
    cardTone: "border-white/10 bg-white/6",
    buttonTone:
      "border border-white/20 bg-white/8 text-white hover:border-white/35 hover:bg-white/12",
  },
];

function PriceCardAction({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className: string;
}) {
  if (href.startsWith("mailto:")) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export default function PricingPage() {
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);

  const handleCheckout = async (priceId: string) => {
    setLoadingPriceId(priceId);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ priceId }),
      });

      let data: { url?: string; error?: string } = {};
      try {
        data = (await res.json()) as { url?: string; error?: string };
      } catch {
        data = {};
      }

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      if (res.status === 401) {
        alert("Du skal være logget ind for at købe et løb.");
        return;
      }

      throw new Error(data.error || "Kunne ikke starte betalingen lige nu.");
    } catch (error) {
      if (error instanceof Error && error.message.includes("logget ind")) {
        alert("Du skal være logget ind for at købe et løb.");
        return;
      }

      alert("Kunne ikke starte betalingen lige nu. Prøv igen.");
    } finally {
      setLoadingPriceId(null);
    }
  };

  return (
    <main
      className={`relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#03110f_0%,#08221d_42%,#0d1726_100%)] text-white ${poppins.className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_28%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.12),transparent_24%),radial-gradient(circle_at_bottom,rgba(251,191,36,0.12),transparent_26%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-10 md:px-10 md:py-14">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-white/10"
          >
            Tilbage til forsiden
          </Link>

          <div className="flex items-center gap-3 text-sm text-slate-300">
            <Link href="/privacy" className="transition hover:text-white">
              Privatlivspolitik
            </Link>
            <span className="text-white/20">•</span>
            <a href="mailto:gpslobdk@gmail.com" className="transition hover:text-white">
              Kontakt os
            </a>
          </div>
        </div>

        <section className="mx-auto mt-14 max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-200/80">
            Priser & pakker
          </p>
          <h1
            className={`mt-4 text-4xl font-black tracking-tight text-white md:text-6xl ${rubik.className}`}
          >
            Vælg den pakke, der passer til dit løb
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-slate-200 md:text-xl">
            Uanset om du planlægger en skoleaktivitet, en privat fejring eller et firma-event,
            findes der en løsning med plads til både leg, læring og tempo.
          </p>
          <div className="mt-6 inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-5 py-2 text-sm font-bold tracking-[0.18em] text-emerald-200 uppercase">
            Alle pakker er gratis under beta frem til 1. august 2026
          </div>
        </section>

        <section className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {priceCards.map((card) => (
            <article
              key={card.title}
              className={`relative flex h-full flex-col overflow-hidden rounded-[2rem] border p-6 backdrop-blur-xl ${card.cardTone} ${
                card.featured ? "xl:-translate-y-2" : ""
              }`}
            >
              <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${card.accent}`} />

              <div className="relative flex h-full flex-col">
                <div className="min-h-[168px]">
                  {card.badge ? (
                    <span className="inline-flex rounded-full border border-emerald-200/35 bg-emerald-300/18 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-emerald-100">
                      {card.badge}
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200">
                      Pakke
                    </span>
                  )}

                  <h2 className={`mt-5 text-3xl font-black text-white ${rubik.className}`}>
                    {card.title}
                  </h2>
                  <p className="mt-4 text-3xl font-black text-white">{card.price}</p>
                  <p className="mt-2 text-sm font-semibold uppercase tracking-[0.16em] text-emerald-100/80">
                    {card.priceMeta}
                  </p>
                  <p className="mt-4 text-sm leading-7 text-slate-200">{card.audience}</p>
                </div>

                <ul className="mt-8 flex-1 space-y-3 text-sm leading-7 text-slate-100/95">
                  {card.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <span className="mt-1 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-emerald-300/18 text-xs text-emerald-100">
                        ✓
                      </span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {card.priceId ? (
                  <button
                    type="button"
                    onClick={() => void handleCheckout(card.priceId!)}
                    disabled={CHECKOUT_DISABLED || loadingPriceId !== null}
                    className={`mt-8 inline-flex min-h-[56px] items-center justify-center rounded-2xl px-5 py-4 text-center text-base font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${card.buttonTone}`}
                  >
                    {CHECKOUT_DISABLED
                      ? "Gratis under Beta"
                      : loadingPriceId === card.priceId
                        ? "⏳ Omdirigerer..."
                        : card.ctaLabel}
                  </button>
                ) : (
                  <PriceCardAction
                    href={card.ctaHref ?? "/login"}
                    className={`mt-8 inline-flex min-h-[56px] items-center justify-center rounded-2xl px-5 py-4 text-center text-base font-bold transition-colors ${card.buttonTone}`}
                  >
                    {card.ctaLabel}
                  </PriceCardAction>
                )}
              </div>
            </article>
          ))}
        </section>

        <section className="mx-auto mt-12 max-w-4xl rounded-[2rem] border border-white/10 bg-white/6 px-6 py-5 text-center text-sm leading-7 text-slate-200 backdrop-blur-xl md:px-8 md:text-base">
          Alle pakker er designet til at være nemme at komme i gang med. Har du brug for en løsning
          til kommune, kæde eller større events, skriver vi gerne et tilbud, der passer til jeres
          setup.
        </section>
      </div>
    </main>
  );
}
