import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { poppins, rubik } from "@/lib/fonts";

import { getLegalCopy, type LegalBullet } from "@/lib/legalCopy";
import { resolveSiteVariantFromHeaders } from "@/lib/siteVariant";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const siteVariant = resolveSiteVariantFromHeaders(requestHeaders);
  const copy = getLegalCopy(siteVariant.key).gdpr;

  return {
    title: copy.metadata.title,
    description: copy.metadata.description,
  };
}

export default async function GdprPage() {
  const requestHeaders = await headers();
  const siteVariant = resolveSiteVariantFromHeaders(requestHeaders);
  const copy = getLegalCopy(siteVariant.key).gdpr;

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
          <article className="mx-auto max-w-3xl space-y-6">
            <div className="space-y-4">
              <h1 className={`text-4xl font-black tracking-tight text-white md:text-6xl ${rubik.className}`}>
                {copy.heroTitle}
              </h1>
              <p className="text-xl font-semibold text-emerald-100">{copy.heroEyebrow}</p>
              <p className="leading-relaxed text-slate-200 md:text-lg">{copy.intro}</p>
            </div>

            {copy.sections.map((section) => (
              <section key={section.title} className="space-y-4">
                <h2 className={`text-2xl font-bold text-white ${rubik.className}`}>{section.title}</h2>
                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph} className="leading-relaxed text-slate-200 md:text-lg">
                    {paragraph}
                  </p>
                ))}
                {section.bullets ? <LegalBulletList bullets={section.bullets} /> : null}
                {section.email ? (
                  <p className="leading-relaxed text-slate-200 md:text-lg">
                    {section.emailLabel ? <strong className="text-white">{section.emailLabel}: </strong> : null}
                    <a href={`mailto:${section.email}`} className="text-emerald-300 underline hover:text-emerald-200">
                      {section.email}
                    </a>
                  </p>
                ) : null}
              </section>
            ))}

            <section className="space-y-4 rounded-[1.75rem] border border-emerald-400/20 bg-emerald-400/8 p-6 shadow-[0_20px_50px_rgba(16,185,129,0.08)]">
              <h2 className={`text-2xl font-bold text-white ${rubik.className}`}>
                🔒 {copy.schoolCallout.title}
              </h2>
              {copy.schoolCallout.paragraphs?.map((paragraph) => (
                <p key={paragraph} className="leading-relaxed text-slate-200 md:text-lg">
                  {paragraph}
                </p>
              ))}
              {copy.schoolCallout.email ? (
                <p className="leading-relaxed text-slate-200 md:text-lg">
                  {copy.schoolCallout.emailLabel ? (
                    <strong className="text-white">{copy.schoolCallout.emailLabel}: </strong>
                  ) : null}
                  <a
                    href={`mailto:${copy.schoolCallout.email}`}
                    className="text-emerald-300 underline hover:text-emerald-200"
                  >
                    {copy.schoolCallout.email}
                  </a>
                </p>
              ) : null}
            </section>

            <section className="space-y-2">
              <p className="text-sm text-slate-400">
                Denne side kan opdateres ved væsentlige ændringer i platformen. <strong className="text-slate-300">{copy.updatedAt}</strong>
              </p>
            </section>
          </article>
        </section>
      </div>
    </main>
  );
}

function LegalBulletList({ bullets }: { bullets: LegalBullet[] }) {
  return (
    <ul className="list-disc space-y-1 pl-6 text-slate-200 md:text-lg">
      {bullets.map((bullet) => (
        <li key={`${bullet.label ?? "item"}-${bullet.text}`}>
          {bullet.label ? <strong className="text-white">{bullet.label}</strong> : null}
          {bullet.label ? " – " : ""}
          {bullet.text}
        </li>
      ))}
    </ul>
  );
}