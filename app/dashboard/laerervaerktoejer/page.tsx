import { ArrowLeft, ExternalLink, UsersRound } from "lucide-react";
import Link from "next/link";

import { TeacherToolCard } from "@/components/dashboard/TeacherToolCard";
import { poppins, rubik } from "@/lib/fonts";
import {
  getTeacherToolRegistry,
  TEACHER_TOOL_FACEBOOK_GROUP_LINK,
} from "@/lib/teacherTools/registry";

export const metadata = {
  title: "Lærerværktøjer – SkoleGPS",
  description: "Åbn et verificeret værktøj til din undervisning.",
};

/**
 * The full teacher tool catalogue. The registry resolves the allowed Family
 * SSO destinations on the server and exposes the verified catalogue, including
 * items that are explicitly marked as coming soon.
 */
export default function LaerervaerktoejerPage() {
  const tools = getTeacherToolRegistry();

  return (
    <main className={`skolegps-teacher-portal min-h-screen px-4 py-6 sm:px-6 sm:py-8 lg:px-8 ${poppins.className}`}>
      <div className="mx-auto w-full max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <Link
            className="skolegps-teacher-secondary-action inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-sm font-bold"
            href="/dashboard"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Tilbage til forsiden
          </Link>
          <p className="text-sm font-semibold text-slate-600">Vælg det, du skal bruge nu.</p>
        </header>

        <section className="skolegps-teacher-portal-hero mt-5 overflow-hidden rounded-3xl border border-sky-100 px-5 py-8 shadow-[0_12px_34px_rgba(25,83,129,0.08)] sm:px-8 sm:py-10">
          <p className="text-xs font-black tracking-[0.16em] text-sky-800 uppercase">Lærerværktøjer</p>
          <h1 className={`mt-2 max-w-2xl text-3xl font-black tracking-tight text-[var(--skolegps-deep-navy)] sm:text-4xl ${rubik.className}`}>
            Åbn et værktøj til undervisningen
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-700 sm:text-base">
            Her finder du de værktøjer, der er klar til brug med SkoleGPS.
          </p>
        </section>

        <section aria-label="Lærerværktøjer" className="mt-5 grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {tools.map((tool, index) => (
            <TeacherToolCard key={tool.id} priority={index === 0} tool={tool} />
          ))}
        </section>

        <section
          aria-labelledby="teacher-tools-community-heading"
          className="mt-5 rounded-3xl border border-sky-100 bg-[linear-gradient(120deg,#eff9ff,#f6fbff_58%,#eaf7f1)] px-5 py-5 shadow-[0_12px_32px_rgba(25,83,129,0.07)] sm:flex sm:items-center sm:justify-between sm:gap-6 sm:px-7"
        >
          <div className="flex items-start gap-4">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-sky-700 shadow-sm">
              <UsersRound aria-hidden="true" className="h-6 w-6" />
            </span>
            <div>
              <h2 id="teacher-tools-community-heading" className="text-xl font-black tracking-tight text-[var(--skolegps-deep-navy)]">
                Bliv en del af fællesskabet
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-700">
                Få inspiration, del idéer og opdag nye værktøjer sammen med andre undervisere.
              </p>
            </div>
          </div>
          <a
            className="skolegps-teacher-primary-action mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black transition hover:-translate-y-0.5 sm:mt-0"
            href={TEACHER_TOOL_FACEBOOK_GROUP_LINK.href}
            rel={TEACHER_TOOL_FACEBOOK_GROUP_LINK.rel}
            target={TEACHER_TOOL_FACEBOOK_GROUP_LINK.target}
          >
            {TEACHER_TOOL_FACEBOOK_GROUP_LINK.label}
            <ExternalLink aria-hidden="true" className="h-4 w-4" />
          </a>
        </section>
      </div>
    </main>
  );
}
