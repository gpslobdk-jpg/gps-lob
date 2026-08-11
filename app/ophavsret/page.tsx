import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { poppins, rubik } from "@/lib/fonts";

import { getLegalCopy } from "@/lib/legalCopy";
import { resolveSiteVariantFromHeaders } from "@/lib/siteVariant";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const siteVariant = resolveSiteVariantFromHeaders(requestHeaders);
  const copy = getLegalCopy(siteVariant.key).ophavsret;

  return {
    title: copy.metadata.title,
    description: copy.metadata.description,
  };
}

export default async function OphavsretPage() {
  const requestHeaders = await headers();
  const siteVariant = resolveSiteVariantFromHeaders(requestHeaders);
  const copy = getLegalCopy(siteVariant.key).ophavsret;

  return (
    <main
      className={`relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#04110f_0%,#071d1a_35%,#0d1f2e_100%)] p-10 text-white md:p-20 ${poppins.className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.14),transparent_30%),radial-gradient(circle_at_50%_12%,rgba(255,255,255,0.05),transparent_24%)]" />

      <div className="relative mx-auto max-w-5xl">
        <div className="flex justify-start">
          <Link
            href="/"
            className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-white/10"
          >
            {copy.backToHomeLabel}
          </Link>
        </div>

        <section className="mt-10 rounded-[2.5rem] border border-white/10 bg-white/6 p-8 shadow-[0_30px_90px_rgba(0,0,0,0.28)] backdrop-blur-md md:p-12">
          <article className="mx-auto max-w-3xl space-y-8">
            <div className="space-y-4">
              <h1 className={`text-4xl font-black tracking-tight text-white md:text-6xl ${rubik.className}`}>
                {copy.heroTitle}
              </h1>
              <p className="text-xl font-semibold text-emerald-100">{copy.heroEyebrow}</p>
              <p className="text-slate-200 leading-relaxed md:text-lg">{copy.intro}</p>
            </div>

            <section className="grid gap-5">
              {copy.principles.map((principle) => (
                <div
                  key={principle.title}
                  className={`rounded-[1.9rem] border p-6 shadow-[0_20px_50px_rgba(16,185,129,0.08)] ${getToneClasses(principle.tone)}`}
                >
                  <p className="text-sm font-semibold uppercase tracking-[0.28em]">{principle.eyebrow}</p>
                  <h2 className={`mt-3 text-2xl font-bold text-white ${rubik.className}`}>
                    {principle.title}
                  </h2>
                  {principle.paragraphs.map((paragraph) => (
                    <p key={paragraph} className="mt-4 text-slate-200 leading-relaxed md:text-lg">
                      {paragraph}
                    </p>
                  ))}
                </div>
              ))}
            </section>

            <section className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
              <p className="text-slate-100 leading-relaxed md:text-xl">{copy.summary}</p>
            </section>

            <section className="rounded-[1.75rem] border border-amber-400/15 bg-amber-400/5 p-6 text-center">
              <Link href="/ophavsret/jura" className="font-semibold text-amber-300 hover:underline">
                {copy.ctaLabel}
              </Link>
            </section>
          </article>
        </section>
      </div>
    </main>
  );
}

function getToneClasses(tone: "emerald" | "sky" | "amber" | "violet" | "purple") {
  switch (tone) {
    case "sky":
      return "border-sky-400/20 bg-sky-400/8 text-sky-200";
    case "amber":
      return "border-amber-400/20 bg-amber-400/8 text-amber-200";
    case "violet":
      return "border-violet-400/20 bg-violet-400/8 text-violet-200";
    case "purple":
      return "border-purple-400/20 bg-purple-400/8 text-purple-300";
    default:
      return "border-emerald-400/20 bg-emerald-400/8 text-emerald-200";
  }
}
