import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { ArrowLeft, Scale } from "lucide-react";
import { poppins, rubik } from "@/lib/fonts";

import { getLegalCopy } from "@/lib/legalCopy";
import { resolveSiteVariantFromHeaders } from "@/lib/siteVariant";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const siteVariant = resolveSiteVariantFromHeaders(requestHeaders);
  const copy = getLegalCopy(siteVariant.key).ophavsretPodcast;

  return {
    title: copy.metadata.title,
    description: copy.metadata.description,
  };
}

export default async function OphavsretPodcastPage() {
  const requestHeaders = await headers();
  const siteVariant = resolveSiteVariantFromHeaders(requestHeaders);
  const copy = getLegalCopy(siteVariant.key).ophavsretPodcast;

  return (
    <main
      className={`relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#04110f_0%,#071d1a_35%,#0d1f2e_100%)] p-10 text-white md:p-20 ${poppins.className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(147,51,234,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.14),transparent_30%),radial-gradient(circle_at_50%_12%,rgba(255,255,255,0.05),transparent_24%)]" />

      <div className="relative mx-auto max-w-5xl">
        <div className="flex justify-start">
          <Link
            href="/dashboard/opret/podcast"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            {copy.backToPodcastLabel}
          </Link>
        </div>

        <section className="mt-10 rounded-[2.5rem] border border-white/10 bg-white/6 p-8 shadow-[0_30px_90px_rgba(0,0,0,0.28)] backdrop-blur-md md:p-12">
          <article className="mx-auto max-w-3xl space-y-8">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-purple-400/30 bg-purple-500/10 shadow-[0_0_24px_rgba(147,51,234,0.18)]">
                  <Scale className="h-7 w-7 text-purple-300" />
                </div>
                <h1 className={`text-3xl font-black tracking-tight text-white md:text-5xl ${rubik.className}`}>
                  {copy.title}
                </h1>
              </div>
              <p className="text-lg font-semibold text-purple-200">{copy.heroEyebrow}</p>
              <p className="leading-relaxed text-slate-200 md:text-lg">{copy.intro}</p>
            </div>

            <section className="space-y-4">
              <h2 className={`text-xl font-bold text-white ${rubik.className}`}>{copy.rulesTitle}</h2>

              {copy.rules.map((rule) => (
                <div
                  key={rule.title}
                  className={`rounded-[1.9rem] border p-6 shadow-[0_20px_50px_rgba(147,51,234,0.08)] ${getToneClasses(rule.tone)}`}
                >
                  <p className="text-sm font-semibold uppercase tracking-[0.28em]">{rule.eyebrow}</p>
                  <h3 className={`mt-3 text-xl font-bold text-white ${rubik.className}`}>{rule.title}</h3>
                  {rule.paragraphs.map((paragraph) => (
                    <p key={paragraph} className="mt-3 leading-relaxed text-slate-200 md:text-base">
                      {paragraph}
                    </p>
                  ))}
                </div>
              ))}
            </section>

            <section className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
              <p className="leading-relaxed text-slate-100 md:text-lg">{copy.summary}</p>
            </section>

            <div className="flex justify-center pt-2">
              <Link
                href="/dashboard/opret/podcast"
                className="inline-flex items-center gap-2 rounded-full border border-purple-400/30 bg-purple-500/10 px-6 py-3 text-sm font-semibold text-purple-200 shadow-[0_0_20px_rgba(147,51,234,0.14)] transition hover:bg-purple-500/20"
              >
                <ArrowLeft className="h-4 w-4" />
                {copy.backToPodcastLabel}
              </Link>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}

function getToneClasses(tone: "emerald" | "sky" | "amber" | "violet" | "purple") {
  switch (tone) {
    case "sky":
      return "border-sky-400/20 bg-sky-400/8 text-sky-300";
    case "amber":
      return "border-amber-400/20 bg-amber-400/8 text-amber-300";
    case "emerald":
      return "border-emerald-400/20 bg-emerald-400/8 text-emerald-300";
    case "violet":
      return "border-violet-400/20 bg-violet-400/8 text-violet-300";
    default:
      return "border-purple-400/20 bg-purple-400/8 text-purple-300";
  }
}
