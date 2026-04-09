import { notFound } from "next/navigation";
import { Playfair_Display, Lora } from "next/font/google";

import { createClient } from "@/utils/supabase/server";
import { PrintButton } from "./PrintButton";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  style: ["normal", "italic"],
});

const lora = Lora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

type Post = {
  number: number;
  title: string;
  body_text: string;
  image_url: string;
  image_prompt: string;
  question: string;
  options: [string, string, string, string];
  correct_index: number;
};

type Stjerneloeb = {
  id: string;
  title: string;
  subject: string;
  grade_level: string;
  posts: Post[];
};

const LETTER_LABELS = ["A", "B", "C", "D"] as const;

function getPostImageUrl(post: Post, cacheKey?: string): string {
  const rawUrl = typeof post.image_url === "string" ? post.image_url.trim() : "";
  const prompt = typeof post.image_prompt === "string" ? post.image_prompt.trim() : "";
  const versionSuffix = cacheKey ? `&v=${encodeURIComponent(cacheKey)}` : "";
  const proxyUrl = prompt
    ? `/api/pollinations-image?prompt=${encodeURIComponent(prompt)}${versionSuffix}`
    : "";

  if (proxyUrl) {
    return proxyUrl;
  }

  if (!rawUrl) {
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="#f5f0e1"/><rect x="40" y="40" width="1120" height="720" fill="none" stroke="#292524" stroke-width="8"/><text x="600" y="400" text-anchor="middle" font-family="Georgia, serif" font-size="42" fill="#292524">Illustration mangler</text></svg>`
    );
  }

  return rawUrl;
}

export default async function PrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("stjerneloeb")
    .select("id, title, subject, grade_level, posts")
    .eq("id", id)
    .single();

  if (error || !data) {
    notFound();
  }

  const run = data as Stjerneloeb;
  const posts: Post[] = Array.isArray(run.posts) ? run.posts : [];

  return (
    <>
      {/* Force background-color printing in all browsers */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              @page { size: A4; margin: 0; }
            }
          `,
        }}
      />

      <div className={`bg-stone-200 text-stone-900 ${lora.className}`}>
        {/* ── Screen toolbar (hidden on print) ───────────────────────── */}
        <div className="print:hidden sticky top-0 z-50 flex items-center justify-between gap-4 border-b border-stone-300 bg-stone-100 px-6 py-3 shadow-md">
          <div>
            <p className={`text-xs font-semibold uppercase tracking-[0.2em] text-stone-500 ${playfair.className}`}>
              {run.subject} · {run.grade_level}
            </p>
            <h1 className={`text-xl font-bold text-stone-900 ${playfair.className}`}>
              {run.title}
            </h1>
          </div>
          <div className="flex gap-3">
            <a
              href="/dashboard/opret/stjerneloeb"
              className="rounded border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-600 shadow-sm hover:bg-stone-50 transition"
            >
              ← Ny version
            </a>
            <PrintButton />
          </div>
        </div>

        {/* ── A4 poster cards ──────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-10 px-4 py-10 print:gap-0 print:p-0">
          {posts.map((post) => (
            <PostCard
              key={post.number}
              post={post}
              runId={run.id}
              runTitle={run.title}
              totalPosts={posts.length}
              subject={run.subject}
              playfairClass={playfair.className}
            />
          ))}
          <StudentAnswerSheet
            posts={posts}
            runTitle={run.title}
            playfairClass={playfair.className}
          />
          <TeacherAnswerKey
            posts={posts}
            runTitle={run.title}
            playfairClass={playfair.className}
          />
        </div>
      </div>
    </>
  );
}

/* ── Theme Map ─────────────────────────────────────────────────────── */
type PostTheme = {
  pageBg: string;
  headerBg: string;
  headerFiligree: string;
  headerSubtitle: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  titleText: string;
  bodyText: string;
  dividerBorder: string;
  dividerGlyph: string;
  questionText: string;
  optionBorder: string;
  optionBg: string;
  optionLetterBg: string;
  optionLetterText: string;
  optionText: string;
  footerBg: string;
  footerBorder: string;
  footerText: string;
  outerBorder: string;
};

const THEME_MAP: Record<string, PostTheme> = {
  historie: {
    pageBg: "bg-amber-50 print:bg-amber-50",
    headerBg: "bg-stone-900 print:bg-stone-900",
    headerFiligree: "border-stone-500",
    headerSubtitle: "text-stone-400",
    badgeBg: "bg-amber-600 print:bg-amber-600",
    badgeText: "text-white",
    badgeBorder: "border-amber-800",
    titleText: "text-amber-50",
    bodyText: "text-stone-700",
    dividerBorder: "border-stone-400",
    dividerGlyph: "text-stone-400",
    questionText: "text-stone-900",
    optionBorder: "border-stone-700",
    optionBg: "bg-stone-100 print:bg-stone-100",
    optionLetterBg: "bg-stone-800 print:bg-stone-800",
    optionLetterText: "text-amber-300",
    optionText: "text-stone-800",
    footerBg: "bg-stone-900 print:bg-stone-900",
    footerBorder: "border-stone-800",
    footerText: "text-stone-400",
    outerBorder: "border-stone-800",
  },
  matematik: {
    pageBg: "bg-blue-50 print:bg-blue-50",
    headerBg: "bg-indigo-900 print:bg-indigo-900",
    headerFiligree: "border-indigo-400",
    headerSubtitle: "text-indigo-300",
    badgeBg: "bg-blue-600 print:bg-blue-600",
    badgeText: "text-white",
    badgeBorder: "border-blue-800",
    titleText: "text-blue-50",
    bodyText: "text-slate-700",
    dividerBorder: "border-indigo-300",
    dividerGlyph: "text-indigo-400",
    questionText: "text-slate-900",
    optionBorder: "border-indigo-600",
    optionBg: "bg-blue-50 print:bg-blue-50",
    optionLetterBg: "bg-indigo-800 print:bg-indigo-800",
    optionLetterText: "text-blue-200",
    optionText: "text-slate-800",
    footerBg: "bg-indigo-900 print:bg-indigo-900",
    footerBorder: "border-indigo-800",
    footerText: "text-indigo-300",
    outerBorder: "border-indigo-800",
  },
  "natur/teknik": {
    pageBg: "bg-emerald-50 print:bg-emerald-50",
    headerBg: "bg-emerald-900 print:bg-emerald-900",
    headerFiligree: "border-emerald-500",
    headerSubtitle: "text-emerald-300",
    badgeBg: "bg-emerald-600 print:bg-emerald-600",
    badgeText: "text-white",
    badgeBorder: "border-emerald-800",
    titleText: "text-emerald-50",
    bodyText: "text-stone-700",
    dividerBorder: "border-emerald-300",
    dividerGlyph: "text-emerald-400",
    questionText: "text-stone-900",
    optionBorder: "border-emerald-600",
    optionBg: "bg-emerald-50 print:bg-emerald-50",
    optionLetterBg: "bg-emerald-800 print:bg-emerald-800",
    optionLetterText: "text-emerald-200",
    optionText: "text-stone-800",
    footerBg: "bg-emerald-900 print:bg-emerald-900",
    footerBorder: "border-emerald-800",
    footerText: "text-emerald-300",
    outerBorder: "border-emerald-800",
  },
};

const DEFAULT_THEME: PostTheme = {
  pageBg: "bg-slate-50 print:bg-slate-50",
  headerBg: "bg-slate-800 print:bg-slate-800",
  headerFiligree: "border-slate-500",
  headerSubtitle: "text-slate-400",
  badgeBg: "bg-slate-700 print:bg-slate-700",
  badgeText: "text-white",
  badgeBorder: "border-slate-600",
  titleText: "text-slate-50",
  bodyText: "text-slate-700",
  dividerBorder: "border-slate-300",
  dividerGlyph: "text-slate-400",
  questionText: "text-slate-900",
  optionBorder: "border-slate-600",
  optionBg: "bg-slate-100 print:bg-slate-100",
  optionLetterBg: "bg-slate-700 print:bg-slate-700",
  optionLetterText: "text-slate-200",
  optionText: "text-slate-800",
  footerBg: "bg-slate-800 print:bg-slate-800",
  footerBorder: "border-slate-700",
  footerText: "text-slate-400",
  outerBorder: "border-slate-700",
};

function resolveTheme(subject: string): PostTheme {
  const key = subject.trim().toLowerCase();
  if (THEME_MAP[key]) return THEME_MAP[key];
  for (const [mapKey, theme] of Object.entries(THEME_MAP)) {
    if (key.includes(mapKey) || mapKey.includes(key)) return theme;
  }
  return DEFAULT_THEME;
}

/* ── Post Card ─────────────────────────────────────────────────────── */
function PostCard({
  post,
  runId,
  runTitle,
  totalPosts,
  subject,
  playfairClass,
}: {
  post: Post;
  runId: string;
  runTitle: string;
  totalPosts: number;
  subject: string;
  playfairClass: string;
}) {
  const t = resolveTheme(subject);

  return (
    <article
      className={`
        relative box-border w-[210mm] min-h-[297mm]
        ${t.pageBg}
        border-double border-10 ${t.outerBorder}
        shadow-[0_20px_60px_rgba(0,0,0,0.4)]
        print:shadow-none
        overflow-hidden
        break-after-page
      `}
      style={{ pageBreakAfter: "always" }}
    >
      {/* ── Top header ─────────────────────────────────────────────── */}
      <header className={`${t.headerBg} px-10 pt-7 pb-6 text-center`}>
        {/* Filigree line */}
        <div className="mb-3 flex items-center gap-3">
          <div className={`flex-1 border-t ${t.headerFiligree}`} />
          <OrnamentSvg />
          <div className={`flex-1 border-t ${t.headerFiligree}`} />
        </div>

        {/* Run name */}
        <p
          className={`text-[0.6rem] font-semibold uppercase tracking-[0.35em] ${t.headerSubtitle} ${playfairClass}`}
        >
          {runTitle}
        </p>

        {/* ── Post number — bold banner ────────────────────────────── */}
        <div className="my-4 flex justify-center">
          <span
            className={`inline-block rounded-sm border-4 ${t.badgeBorder} ${t.badgeBg} px-8 py-2 text-4xl font-black uppercase tracking-wider ${t.badgeText} ${playfairClass}`}
          >
            Post {post.number}
          </span>
        </div>

        {/* Post title */}
        <h2
          className={`text-3xl font-black italic leading-tight tracking-wide ${t.titleText} ${playfairClass}`}
        >
          {post.title}
        </h2>

        {/* Filigree line */}
        <div className="mt-4 flex items-center gap-3">
          <div className={`flex-1 border-t ${t.headerFiligree}`} />
          <OrnamentSvg flip />
          <div className={`flex-1 border-t ${t.headerFiligree}`} />
        </div>
      </header>

      {/* ── Image ─────────────────────────────────────────────────── */}
      <div className="flex justify-center px-10 pt-7">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={getPostImageUrl(post, `${runId}-${post.number}`)}
          alt={post.title}
          className={`
            w-full object-cover
            border-4 ${t.outerBorder}
            shadow-[6px_6px_0px_0px_rgba(28,25,23,0.55)]
          `}
          style={{ maxHeight: "185px", objectFit: "cover" }}
          loading="eager"
          decoding="sync"
        />
      </div>

      {/* ── Body text ─────────────────────────────────────────────── */}
      <div className="px-10 pt-5">
        <p className={`text-[0.9rem] leading-[1.75] ${t.bodyText}`}>{post.body_text}</p>
      </div>

      {/* ── Ornamental divider ────────────────────────────────────── */}
      <div className="mx-10 my-5 flex items-center gap-4">
        <div className={`flex-1 border-t-2 ${t.dividerBorder}`} />
        <span className={`${t.dividerGlyph} text-lg`}>✦</span>
        <div className={`flex-1 border-t-2 ${t.dividerBorder}`} />
      </div>

      {/* ── Question ──────────────────────────────────────────────── */}
      <div className="px-10">
        <p
          className={`mb-5 text-xl font-bold leading-snug ${t.questionText} ${playfairClass}`}
        >
          {post.question}
        </p>

        {/* Options — 2-column grid */}
        <div className="grid grid-cols-2 gap-3">
          {post.options.map((option, i) => (
            <div
              key={i}
              className={`flex items-stretch border-2 ${t.optionBorder} ${t.optionBg}`}
            >
              {/* Fat letter column */}
              <div
                className={`flex w-12 shrink-0 items-center justify-center ${t.optionLetterBg} text-lg font-black ${t.optionLetterText} ${playfairClass}`}
              >
                {LETTER_LABELS[i]}
              </div>
              {/* Answer text */}
              <div className="flex items-center px-3 py-3">
                <span className={`text-sm font-medium leading-snug ${t.optionText}`}>
                  {option}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <div className={`absolute bottom-0 left-0 right-0 flex items-center justify-between border-t-2 ${t.footerBorder} ${t.footerBg} px-10 py-2`}>
        <span className={`text-[0.6rem] uppercase tracking-[0.25em] ${t.footerText} ${playfairClass}`}>
          Post {post.number} / {totalPosts}
        </span>
        <span className={`text-[0.6rem] uppercase tracking-[0.25em] ${t.footerText} ${playfairClass}`}>
          gpsloeb.dk
        </span>
      </div>
    </article>
  );
}

/* ── Student Answer Sheet ─────────────────────────────────────────── */
function StudentAnswerSheet({
  posts,
  runTitle,
  playfairClass,
}: {
  posts: Post[];
  runTitle: string;
  playfairClass: string;
}) {
  return (
    <article
      className="
        relative box-border w-[210mm] min-h-[297mm]
        bg-amber-50 print:bg-amber-50
        border-double border-10 border-stone-800
        shadow-[0_20px_60px_rgba(0,0,0,0.4)]
        print:shadow-none
        overflow-hidden
        break-after-page
      "
      style={{ pageBreakBefore: "always", pageBreakAfter: "always" }}
    >
      {/* Header */}
      <header className="bg-stone-900 print:bg-stone-900 px-10 pt-7 pb-6 text-center">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex-1 border-t border-stone-500" />
          <OrnamentSvg />
          <div className="flex-1 border-t border-stone-500" />
        </div>
        <p className={`text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-stone-400 ${playfairClass}`}>
          {runTitle}
        </p>
        <h2 className={`mt-2 text-3xl font-black italic text-amber-50 ${playfairClass}`}>
          Svarark
        </h2>
        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 border-t border-stone-500" />
          <OrnamentSvg flip />
          <div className="flex-1 border-t border-stone-500" />
        </div>
      </header>

      <div className="px-10 pt-8">
        {/* Holdnavn field */}
        <div className="mb-8 flex items-end gap-3">
          <span className={`shrink-0 text-base font-bold text-stone-900 ${playfairClass}`}>
            Holdnavn:
          </span>
          <div className="flex-1 border-b-2 border-stone-700" style={{ minHeight: "28px" }} />
        </div>

        {/* Instructions */}
        <p className="mb-6 text-sm italic text-stone-600">
          Skriv A, B, C eller D i boksen ud for hver post, når I har besøgt den.
        </p>

        {/* Answer grid — 2 columns */}
        <div className="grid grid-cols-2 gap-4">
          {posts.map((post) => (
            <div
              key={post.number}
              className="flex items-stretch border-2 border-stone-700"
            >
              {/* Post number column */}
              <div
                className={`flex w-14 shrink-0 flex-col items-center justify-center bg-stone-800 print:bg-stone-800 px-1 py-3 text-center ${playfairClass}`}
              >
                <span className="text-[0.5rem] uppercase tracking-widest text-stone-400">
                  Post
                </span>
                <span className="text-xl font-black text-amber-300">{post.number}</span>
              </div>
              {/* Empty answer box */}
              <div className="flex flex-1 items-center justify-center px-4 py-3">
                <div className="flex h-12 w-12 items-center justify-center border-2 border-stone-500 bg-white print:bg-white" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between border-t-2 border-stone-800 bg-stone-900 print:bg-stone-900 px-10 py-2">
        <span className={`text-[0.6rem] uppercase tracking-[0.25em] text-stone-400 ${playfairClass}`}>
          Elev-svarark
        </span>
        <span className={`text-[0.6rem] uppercase tracking-[0.25em] text-stone-400 ${playfairClass}`}>
          gpsloeb.dk
        </span>
      </div>
    </article>
  );
}

/* ── Teacher Answer Key ────────────────────────────────────────────── */
function TeacherAnswerKey({
  posts,
  runTitle,
  playfairClass,
}: {
  posts: Post[];
  runTitle: string;
  playfairClass: string;
}) {
  return (
    <article
      className="
        relative box-border w-[210mm] min-h-[297mm]
        bg-stone-100 print:bg-stone-100
        border-double border-10 border-stone-800
        shadow-[0_20px_60px_rgba(0,0,0,0.4)]
        print:shadow-none
        overflow-hidden
      "
      style={{ pageBreakBefore: "always" }}
    >
      {/* Header */}
      <header className="bg-stone-900 print:bg-stone-900 px-10 pt-7 pb-6 text-center">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex-1 border-t border-stone-500" />
          <OrnamentSvg />
          <div className="flex-1 border-t border-stone-500" />
        </div>
        <p
          className={`text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-stone-400 ${playfairClass}`}
        >
          {runTitle}
        </p>
        <h2
          className={`mt-2 text-3xl font-black italic text-amber-50 ${playfairClass}`}
        >
          Facitliste
        </h2>
        <p className={`mt-1 text-xs text-stone-500 ${playfairClass}`}>
          Kun til lærerens brug — hæng ikke op
        </p>
        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 border-t border-stone-500" />
          <OrnamentSvg flip />
          <div className="flex-1 border-t border-stone-500" />
        </div>
      </header>

      <div className="px-10 pt-7 pb-16 space-y-3">
        {posts.map((post) => (
          <div
            key={post.number}
            className="flex items-stretch border-2 border-stone-700 bg-white print:bg-white"
          >
            {/* Number column */}
            <div
              className={`flex w-12 shrink-0 items-center justify-center bg-stone-800 print:bg-stone-800 text-base font-black text-amber-300 ${playfairClass}`}
            >
              {post.number}
            </div>
            {/* Content */}
            <div className="flex-1 px-4 py-3">
              <p className={`font-bold text-stone-900 ${playfairClass}`}>{post.title}</p>
              <p className="mt-0.5 text-sm text-stone-600">{post.question}</p>
              <p className={`mt-1.5 text-sm font-bold text-amber-700 ${playfairClass}`}>
                {LETTER_LABELS[post.correct_index]} — {post.options[post.correct_index]}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between border-t-2 border-stone-800 bg-stone-900 print:bg-stone-900 px-10 py-2">
        <span
          className={`text-[0.6rem] uppercase tracking-[0.25em] text-stone-400 ${playfairClass}`}
        >
          Facitliste
        </span>
        <span
          className={`text-[0.6rem] uppercase tracking-[0.25em] text-stone-400 ${playfairClass}`}
        >
          gpsloeb.dk
        </span>
      </div>
    </article>
  );
}

/* ── Ornament SVG ──────────────────────────────────────────────────── */
function OrnamentSvg({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 40 16"
      className="h-3 w-8 shrink-0 text-stone-400"
      fill="currentColor"
      style={flip ? { transform: "scaleX(-1)" } : undefined}
    >
      <path d="M20 0 C14 6, 6 8, 0 8 C6 8, 14 10, 20 16 C26 10, 34 8, 40 8 C34 8, 26 6, 20 0Z" />
    </svg>
  );
}
