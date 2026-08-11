import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { poppins, rubik } from "@/lib/fonts";

import { getLegalCopy, type LegalBullet } from "@/lib/legalCopy";
import { resolveSiteVariantFromHeaders } from "@/lib/siteVariant";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const siteVariant = resolveSiteVariantFromHeaders(requestHeaders);
  const copy = getLegalCopy(siteVariant.key).privacy;

  return {
    title: copy.metadata.title,
    description: copy.metadata.description,
  };
}

export default async function PrivacyPage() {
  const requestHeaders = await headers();
  const siteVariant = resolveSiteVariantFromHeaders(requestHeaders);
  const copy = getLegalCopy(siteVariant.key).privacy;

  return (
    <main
      className={`relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#04110f_0%,#071d1a_35%,#0d1f2e_100%)] px-4 py-8 text-white sm:px-8 md:py-20 ${poppins.className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.14),transparent_30%),radial-gradient(circle_at_50%_12%,rgba(255,255,255,0.05),transparent_24%)]" />

      <div className="relative mx-auto max-w-5xl">
        <div className="flex justify-start">
          <Link
            href="/"
            className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
          >
            {copy.backToHomeLabel}
          </Link>
        </div>

        <section className="mt-8 rounded-[1.75rem] border border-white/10 bg-white/6 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.28)] backdrop-blur-md sm:p-8 md:rounded-[2.5rem] md:p-12">
          <article className="mx-auto max-w-3xl space-y-6">
            <div className="space-y-4">
              <h1 className={`break-words text-4xl font-black tracking-tight text-white [overflow-wrap:anywhere] md:text-6xl ${rubik.className}`}>
                {copy.heroTitle}
              </h1>
              <p className="text-xl font-semibold text-emerald-100">{copy.heroEyebrow}</p>
              <p className="text-slate-200 leading-relaxed md:text-lg">{copy.intro}</p>
            </div>

            {copy.sections.map((section) => (
              <section key={section.title} className="space-y-4">
                <h2 className={`text-2xl font-bold text-white ${rubik.className}`}>{section.title}</h2>
                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph} className="text-slate-200 leading-relaxed md:text-lg">
                    {paragraph}
                  </p>
                ))}
                {section.bullets ? <LegalBulletList bullets={section.bullets} /> : null}
              </section>
            ))}

            <section className="space-y-4 rounded-[1.75rem] border border-emerald-400/20 bg-emerald-400/8 p-6 shadow-[0_20px_50px_rgba(16,185,129,0.08)]">
              <h2 className={`text-2xl font-bold text-white ${rubik.className}`}>
                🔒 {copy.securityCallout.title}
              </h2>
              {copy.securityCallout.paragraphs?.map((paragraph) => (
                <p key={paragraph} className="text-slate-200 leading-relaxed md:text-lg">
                  {paragraph}
                </p>
              ))}
              {copy.securityCallout.bullets ? <LegalBulletList bullets={copy.securityCallout.bullets} /> : null}
            </section>

            <div className="border-t border-white/10 pt-2" />

            <section className="space-y-4">
              <h2 className={`text-2xl font-bold text-white ${rubik.className}`}>{copy.support.title}</h2>
              {copy.support.paragraphs?.map((paragraph) => (
                <p key={paragraph} className="text-slate-200 leading-relaxed md:text-lg">
                  {paragraph}
                </p>
              ))}
              {copy.support.email ? (
                <p className="text-slate-200 leading-relaxed md:text-lg">
                  {copy.support.emailLabel ? <strong className="text-white">{copy.support.emailLabel}: </strong> : null}
                  <a href={`mailto:${copy.support.email}`} className="text-emerald-300 underline hover:text-emerald-200">
                    {copy.support.email}
                  </a>
                </p>
              ) : null}
            </section>

            <p className="border-t border-white/10 pt-5 text-sm text-slate-400">{copy.updatedAt}</p>
          </article>
        </section>
      </div>
    </main>
  );
}

function LegalBulletList({ bullets }: { bullets: LegalBullet[] }) {
  return (
    <ul className="list-disc space-y-2 pl-6 text-slate-200 leading-relaxed md:text-lg">
      {bullets.map((bullet) => (
        <li key={`${bullet.label ?? "item"}-${bullet.text}`}>
          {bullet.label ? <span className="font-semibold text-white">{bullet.label}</span> : null}
          {bullet.label ? ": " : ""}
          {bullet.text}
        </li>
      ))}
    </ul>
  );
}
