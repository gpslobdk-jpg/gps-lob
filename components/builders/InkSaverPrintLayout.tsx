/**
 * InkSaverPrintLayout — Minimalist 3-page print layout for school printers.
 *
 * Renders three distinct sections separated by page breaks:
 *  1. Elev-ark (Student worksheet) — Questions + A/B/C/D options, NO correct answers.
 *  2. Svar-ark (Bubble sheet)      — Compact grid where students write their name and cross off answers.
 *  3. Facitliste (Teacher cheat sheet) — Questions with correct answers highlighted + session PIN.
 *
 * This component is hidden on screen (`hidden print:block`) and only visible when printing.
 * All styling is black-and-white, typography-focused, and ink-efficient.
 */

import type { CharacterPostConfig } from "@/lib/characterPosts";

const ANSWER_LABELS = ["A", "B", "C", "D"] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PrintableQuestion = {
  id: number | string;
  type: "multiple_choice" | "ai_image";
  postType?: "quiz" | "character";
  text: string;
  aiPrompt?: string;
  answers: string[];
  correctIndex: number;
  characterConfig?: CharacterPostConfig;
};

type InkSaverPrintLayoutProps = {
  title: string;
  subject: string;
  classLevel: string;
  questions: PrintableQuestion[];
  /** Optional session PIN shown on the cheat sheet header. */
  sessionPin?: string | null;
  fontClassName?: string;
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Compact page header used on each printout page. */
function PageHeader({
  title,
  subtitle,
  fontClassName,
}: {
  title: string;
  subtitle: string;
  fontClassName?: string;
}) {
  return (
    <div className="mb-6 border-b-2 border-black pb-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-500">
        {subtitle}
      </p>
      <h1
        className={`mt-1 text-2xl font-black tracking-tight text-black ${fontClassName ?? ""}`}
      >
        {title}
      </h1>
    </div>
  );
}

/** Meta row: subject, class level, post count. */
function MetaRow({
  subject,
  classLevel,
  questionCount,
  extra,
}: {
  subject: string;
  classLevel: string;
  questionCount: number;
  extra?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap gap-6 text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
      <span>Fag: <span className="text-black">{subject}</span></span>
      <span>Klassetrin: <span className="text-black">{classLevel}</span></span>
      <span>Poster: <span className="text-black">{questionCount}</span></span>
      {extra}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 1 — Elev-ark (Student Worksheet)
// ---------------------------------------------------------------------------

function ElevArkSection({
  title,
  subject,
  classLevel,
  questions,
  fontClassName,
}: Omit<InkSaverPrintLayoutProps, "sessionPin">) {
  return (
    <div className="print:break-after-page print:[page-break-after:always]">
      <PageHeader title={title} subtitle="Elev-ark · Spørgsmål" fontClassName={fontClassName} />
      <MetaRow subject={subject} classLevel={classLevel} questionCount={questions.length} />

      <div className="space-y-5">
        {questions.map((q, i) => {
          const isPhoto = q.type === "ai_image";
          const isPilenPost = q.postType === "character";
          const questionText = q.text.trim() || "Ikke udfyldt";

          return (
            <article
              key={`elev-${q.id}`}
              className="border border-gray-300 p-4 print:break-inside-avoid print:[page-break-inside:avoid]"
            >
              <h2 className={`text-lg font-black uppercase tracking-wide text-black ${fontClassName ?? ""}`}>
                Post {i + 1}
              </h2>

              {isPilenPost ? (
                <div className="mt-2 border border-dashed border-gray-400 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
                    Pilen fortæller · Engelsk samtale
                  </p>
                  <p className="mt-1 text-sm leading-6 text-black">
                    {q.characterConfig?.topic || "Samtaleemne ikke angivet"} · {q.characterConfig?.placeDescription || "Sted ikke angivet"}
                  </p>
                </div>
              ) : isPhoto ? (
                <div className="mt-2 border border-dashed border-gray-400 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
                    Foto-opgave
                  </p>
                  <p className="mt-1 text-sm leading-6 text-black">
                    {q.aiPrompt?.trim() || questionText}
                  </p>
                </div>
              ) : (
                <>
                  <p className="mt-2 text-sm leading-7 text-black">{questionText}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {q.answers.map((answer, ai) => (
                      <div
                        key={`elev-${q.id}-${ai}`}
                        className="flex items-center gap-2 border border-gray-300 px-3 py-2"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gray-500 text-xs font-bold">
                          {ANSWER_LABELS[ai]}
                        </span>
                        <span className="text-sm text-black">
                          {answer.trim() || "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 2 — Svar-ark (Bubble Sheet)
// ---------------------------------------------------------------------------

function SvarArkSection({
  title,
  subject,
  classLevel,
  questions,
  fontClassName,
}: Omit<InkSaverPrintLayoutProps, "sessionPin">) {
  // Only include MC questions in the bubble grid
  const mcQuestions = questions.filter(
    (q) => q.type !== "ai_image" && q.postType !== "character",
  );
  const photoQuestions = questions.filter((q) => q.type === "ai_image");
  const characterQuestions = questions.filter((q) => q.postType === "character");

  return (
    <div className="print:break-after-page print:[page-break-after:always]">
      <PageHeader title={title} subtitle="Svar-ark · Sæt kryds" fontClassName={fontClassName} />
      <MetaRow subject={subject} classLevel={classLevel} questionCount={questions.length} />

      {/* Name field */}
      <div className="mb-5 flex items-end gap-4 border-b border-gray-300 pb-3">
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500">
          Holdnavn:
        </span>
        <span className="flex-1 border-b-2 border-dotted border-gray-400" />
      </div>

      {/* Bubble grid table */}
      {mcQuestions.length > 0 && (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-gray-400 bg-gray-100 px-3 py-2 text-left text-xs font-bold uppercase tracking-[0.2em] text-gray-600">
                Post
              </th>
              {ANSWER_LABELS.map((label) => (
                <th
                  key={label}
                  className="border border-gray-400 bg-gray-100 px-3 py-2 text-center text-xs font-bold uppercase tracking-[0.2em] text-gray-600"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mcQuestions.map((q, qi) => {
              const originalIndex = questions.indexOf(q);
              return (
                <tr key={`bubble-${q.id}`}>
                  <td className="border border-gray-400 px-3 py-2 font-bold text-black">
                    Post {originalIndex + 1}
                  </td>
                  {ANSWER_LABELS.map((label) => (
                    <td
                      key={`bubble-${q.id}-${label}`}
                      className="border border-gray-400 px-3 py-2 text-center"
                    >
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border-2 border-gray-400" />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Photo question reminders */}
      {photoQuestions.length > 0 && (
        <div className="mt-5 border border-dashed border-gray-400 p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
            Foto-poster (tag billede med telefonen)
          </p>
          {photoQuestions.map((q) => {
            const originalIndex = questions.indexOf(q);
            return (
              <p key={`photo-note-${q.id}`} className="mt-1 text-sm text-black">
                Post {originalIndex + 1}: {q.aiPrompt?.trim() || q.text.trim() || "Foto-opgave"}
              </p>
            );
          })}
        </div>
      )}
      {characterQuestions.length > 0 && (
        <p className="mt-4 text-xs text-gray-600">
          Pilen-poster har ingen svarfelter: {characterQuestions.map((q) => `Post ${questions.indexOf(q) + 1}`).join(", ")}.
        </p>
      )}

      {/* Extra space for notes */}
      <div className="mt-6 border-t border-gray-300 pt-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
          Noter
        </p>
        <div className="mt-2 h-20 border border-dashed border-gray-300" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 3 — Facitliste (Teacher Cheat Sheet)
// ---------------------------------------------------------------------------

function FacitlisteSection({
  title,
  subject,
  classLevel,
  questions,
  sessionPin,
  fontClassName,
}: InkSaverPrintLayoutProps) {
  return (
    <div>
      <PageHeader
        title={title}
        subtitle="Lærerens facitliste · Fortroligt"
        fontClassName={fontClassName}
      />
      <MetaRow
        subject={subject}
        classLevel={classLevel}
        questionCount={questions.length}
        extra={
          sessionPin ? (
            <span>
              PIN: <span className="font-mono text-black">{sessionPin}</span>
            </span>
          ) : null
        }
      />

      {/* Quick-reference answer key */}
      <div className="mb-5 border border-gray-300 p-3">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
          Facit-oversigt
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {questions.map((q, i) => {
            if (q.postType === "character") {
              return (
                <span key={`key-${q.id}`} className="text-gray-500">
                  Post {i + 1}: <span className="italic">Pilen</span>
                </span>
              );
            }
            if (q.type === "ai_image") {
              return (
                <span key={`key-${q.id}`} className="text-gray-500">
                  Post {i + 1}: <span className="italic">Foto</span>
                </span>
              );
            }
            return (
              <span key={`key-${q.id}`} className="text-black">
                Post {i + 1}: <span className="font-black">{ANSWER_LABELS[q.correctIndex]}</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* Full questions with correct answers highlighted */}
      <div className="space-y-4">
        {questions.map((q, i) => {
          const isPhoto = q.type === "ai_image";
          const isPilenPost = q.postType === "character";
          const questionText = q.text.trim() || "Ikke udfyldt";

          return (
            <article
              key={`facit-${q.id}`}
              className="border border-gray-300 p-4 print:break-inside-avoid print:[page-break-inside:avoid]"
            >
              <div className="flex items-baseline justify-between">
                <h2 className={`text-base font-black uppercase tracking-wide text-black ${fontClassName ?? ""}`}>
                  Post {i + 1}
                </h2>
                {!isPhoto && !isPilenPost && (
                  <span className="text-xs font-bold text-gray-500">
                    Svar: {ANSWER_LABELS[q.correctIndex]}
                  </span>
                )}
              </div>

              {isPilenPost ? (
                <div className="mt-2 border border-dashed border-gray-400 p-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
                    Pilen fortæller
                  </p>
                  <p className="mt-1 text-sm text-black">
                    {q.characterConfig?.topic || "Samtaleemne ikke angivet"} · {q.characterConfig?.placeDescription || "Sted ikke angivet"}
                  </p>
                </div>
              ) : isPhoto ? (
                <div className="mt-2 border border-dashed border-gray-400 p-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
                    Foto-opgave
                  </p>
                  <p className="mt-1 text-sm text-black">{q.aiPrompt?.trim() || questionText}</p>
                </div>
              ) : (
                <>
                  <p className="mt-1 text-sm leading-6 text-black">{questionText}</p>
                  <div className="mt-2 grid grid-cols-2 gap-1">
                    {q.answers.map((answer, ai) => {
                      const isCorrect = q.correctIndex === ai;
                      return (
                        <div
                          key={`facit-${q.id}-${ai}`}
                          className={`flex items-center gap-2 px-2 py-1 text-sm ${
                            isCorrect
                              ? "border-2 border-black bg-gray-100 font-black"
                              : "border border-gray-200 text-gray-600"
                          }`}
                        >
                          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                            isCorrect
                              ? "border-2 border-black bg-black text-white"
                              : "border border-gray-400"
                          }`}>
                            {ANSWER_LABELS[ai]}
                          </span>
                          <span>{answer.trim() || "—"}</span>
                          {isCorrect && (
                            <span className="ml-auto text-[10px] font-bold uppercase tracking-[0.1em] text-gray-600">
                              ✓
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export default function InkSaverPrintLayout(props: InkSaverPrintLayoutProps) {
  return (
    <section
      className="hidden print:block print:bg-white print:px-0 print:py-0 print:text-black"
      aria-label="Printvenlig layout"
    >
      <div className="mx-auto w-full max-w-none font-sans text-black">
        {/* Page 1: Elev-ark */}
        <ElevArkSection
          title={props.title}
          subject={props.subject}
          classLevel={props.classLevel}
          questions={props.questions}
          fontClassName={props.fontClassName}
        />

        {/* Page 2: Svar-ark */}
        <SvarArkSection
          title={props.title}
          subject={props.subject}
          classLevel={props.classLevel}
          questions={props.questions}
          fontClassName={props.fontClassName}
        />

        {/* Page 3: Facitliste */}
        <FacitlisteSection {...props} />
      </div>
    </section>
  );
}
