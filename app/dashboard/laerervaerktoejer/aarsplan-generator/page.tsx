"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  Plus,
  Printer,
  School,
  Settings,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Poppins, Rubik } from "next/font/google";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  buildTeachingWeeks,
  courseCountOptions,
  createAnnualPlanDraft,
  createStructuralCoursesForAi,
  getCommonGoalsIntro,
  getHolidayWeeks,
  gradeLevels,
  lessonsPerWeekOptions,
  schoolYears,
  subjects,
  type AnnualPlanDraft,
} from "./annualPlanEngine";
import { getGradeBand } from "./annualPlanEngine";
import { GENERIC_HOLIDAY_PLAN_LABEL, municipalityOptions } from "./municipalities";
import {
  createMockAiAnnualPlanEnhancement,
  type AnnualPlanAiInput,
  type AnnualPlanAiOutput,
} from "./annualPlanAiMock";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

type AnnualPlanInput = {
  subject: string;
  gradeLevel: string;
  schoolYear: string;
  schoolName: string;
  teacherName: string;
  municipality: string;
  lessonsPerWeek: string;
  courseCount: string;
  fixedWeeks: string;
  specialThemes: string;
  aiNotes: string;
};

type EditableAnnualPlanRow = {
  id: string;
  weeks: string;
  title: string;
  goals: string;
  content: string;
  evaluation: string;
  isLocked?: boolean;
  source?: "course" | "fixed-week" | "holiday" | "manual";
};

type EditableAnnualPlanRowField = Exclude<
  keyof EditableAnnualPlanRow,
  "id" | "isLocked" | "source"
>;

type StepIndex = 0 | 1 | 2 | 3 | 4;

const initialInput: AnnualPlanInput = {
  subject: "",
  gradeLevel: "",
  schoolYear: "",
  schoolName: "",
  teacherName: "",
  municipality: "",
  lessonsPerWeek: "2",
  courseCount: "6",
  fixedWeeks: "",
  specialThemes: "",
  aiNotes: "",
};

const wizardSteps = [
  {
    title: "Vælg fag og klassetrin",
    label: "Trin 1",
    icon: BookOpen,
  },
  {
    title: "Vælg skoleår og skole",
    label: "Trin 2",
    icon: Calendar,
  },
  {
    title: "Vælg rammer og ønsker",
    label: "Trin 3",
    icon: Settings,
  },
  {
    title: "Generér årsplan",
    label: "Trin 4",
    icon: Sparkles,
  },
  {
    title: "Redigér årsplan",
    label: "Trin 5",
    icon: FileText,
  },
] as const;

const selectClassName =
  "mt-3 min-h-12 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100";

const textInputClassName =
  "mt-3 min-h-12 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100";

const textareaClassName =
  "mt-3 min-h-28 w-full resize-none overflow-hidden rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold leading-6 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100";

const buttonBaseClassName =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-black transition focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-45";

const documentTextareaClassName =
  "block w-full resize-none overflow-hidden rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold leading-7 text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100";

const documentTableCellClassName =
  "border border-slate-300 align-top print:border-slate-400";

const documentHeaderCellClassName =
  `${documentTableCellClassName} bg-slate-200 px-3 py-3 text-slate-800 print:bg-slate-100`;

const generationSteps = [
  "Læser dine valg",
  "Fordeler skoleår, ferieuger og perioder",
  "Bygger årsplanens forløb",
  "Forbedrer mål, aktiviteter og evaluering",
  "Samler årsplanen i et dokument",
  "Gør printvisningen klar",
] as const;

function getFixedWeekLines(fixedWeeks: string) {
  return fixedWeeks
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function getWeekOrder(label: string) {
  const match = label.match(/uge\s*(\d{1,2})/i);
  const week = match ? Number(match[1]) : Number.NaN;

  if (!Number.isFinite(week)) {
    return 1_000;
  }

  return week >= 33 ? week - 33 : week + 20;
}

function splitFixedWeekLine(line: string) {
  const [firstPart, ...restParts] = line.split(":");
  const title = restParts.join(":").trim();

  if (!title) {
    return {
      weeks: line,
      title: "Fast uge",
    };
  }

  return {
    weeks: firstPart.trim(),
    title,
  };
}

function buildEditableAnnualPlanRows(plan: AnnualPlanDraft, fixedWeekLines: string[]): EditableAnnualPlanRow[] {
  const courseRows = plan.courses.map((course, index) => ({
    row: {
      id: `course-${index + 1}`,
      weeks: `${course.period}\n${course.teachingWeeks} undervisningsuger\n${course.estimatedLessons} lektioner`,
      title: course.title,
      goals: `${course.description}\n\nFokus: ${course.focus}`,
      content: course.activities,
      evaluation: course.product,
      source: "course" as const,
    },
    order: getWeekOrder(course.period),
    originalIndex: index,
  }));

  const holidayRows = plan.holidayWeeks.map((holiday, index) => ({
    row: {
      id: `holiday-${index + 1}`,
      weeks: holiday.label.replace(/^uge/i, "Uge"),
      title: holiday.name,
      goals: holiday.type === "holiday" ? "Ferie / undervisningsfri periode." : "Fridag / kalendernote.",
      content: holiday.note ?? "Ingen planlagt undervisning.",
      evaluation: "",
      isLocked: true,
      source: "holiday" as const,
    },
    order: getWeekOrder(holiday.label),
    originalIndex: plan.courses.length + index,
  }));

  const fixedRows = fixedWeekLines.map((line, index) => {
    const fixedWeek = splitFixedWeekLine(line);

    return {
      row: {
        id: `fixed-week-${index + 1}`,
        weeks: fixedWeek.weeks,
        title: fixedWeek.title,
        goals: "Særlig uge i årsplanen.",
        content: "Indhold aftales lokalt.",
        evaluation: "",
        isLocked: true,
        source: "fixed-week" as const,
      },
      order: getWeekOrder(line),
      originalIndex: plan.courses.length + holidayRows.length + index,
    };
  });

  return [...courseRows, ...holidayRows, ...fixedRows]
    .sort((a, b) => a.order - b.order || a.originalIndex - b.originalIndex)
    .map(({ row }) => row);
}

function getAnnualPlanRowClassName(row: EditableAnnualPlanRow) {
  if (row.source === "holiday") {
    return "break-inside-avoid bg-emerald-50/70 print:bg-emerald-50";
  }

  if (row.source === "fixed-week") {
    return "break-inside-avoid bg-amber-50/55 print:bg-amber-50";
  }

  return "break-inside-avoid bg-white [&>td:nth-child(1)]:bg-slate-50/70 [&>td:nth-child(3)]:bg-slate-50/45";
}

function getTextareaRows(value: string, minimumRows: number) {
  const lineCount = value.split(/\r?\n/).reduce((total, line) => total + Math.max(1, Math.ceil(line.length / 42)), 0);
  return Math.max(minimumRows, lineCount);
}

function resizeTextareaToContent(textarea: HTMLTextAreaElement) {
  textarea.style.height = "auto";
  textarea.style.overflowY = "hidden";

  const borderHeight = textarea.offsetHeight - textarea.clientHeight;

  textarea.style.height = `${textarea.scrollHeight + borderHeight}px`;
}

export default function AarsplanGeneratorPage() {
  const [input, setInput] = useState<AnnualPlanInput>(initialInput);
  const [currentStep, setCurrentStep] = useState<StepIndex>(0);
  const [generatedPlan, setGeneratedPlan] = useState<AnnualPlanDraft | null>(null);
  const [editableRows, setEditableRows] = useState<EditableAnnualPlanRow[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStepIndex, setGenerationStepIndex] = useState(0);
  const [, setAiSource] = useState<"local" | "api">("local");
  const generationTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    document.title = "Årsplan-generator – SkoleGPS";
  }, []);

  useEffect(
    () => () => {
      generationTimersRef.current.forEach((timer) => clearTimeout(timer));
    },
    [],
  );

  const selectedSchoolYear = input.schoolYear || "2026/2027";
  const selectedMunicipality = input.municipality || GENERIC_HOLIDAY_PLAN_LABEL;
  const previewTeachingWeekCount = useMemo(
    () => buildTeachingWeeks(selectedSchoolYear, selectedMunicipality).length,
    [selectedMunicipality, selectedSchoolYear],
  );
  const previewTotalLessons = previewTeachingWeekCount * Number(input.lessonsPerWeek);
  const fixedWeekLines = useMemo(() => getFixedWeekLines(input.fixedWeeks), [input.fixedWeeks]);

  useEffect(() => {
    if (!generatedPlan) {
      setEditableRows([]);
      return;
    }

    setEditableRows(buildEditableAnnualPlanRows(generatedPlan, fixedWeekLines));
  }, [fixedWeekLines, generatedPlan]);

  const stepValidity = useMemo(
    () =>
      [
        Boolean(input.subject && input.gradeLevel),
        Boolean(input.schoolYear && input.municipality),
        Boolean(input.lessonsPerWeek && input.courseCount),
        Boolean(
          input.subject &&
            input.gradeLevel &&
            input.schoolYear &&
            input.municipality &&
            input.lessonsPerWeek &&
            input.courseCount,
        ),
        Boolean(generatedPlan),
      ] as const,
    [generatedPlan, input],
  );

  const maxAccessibleStep: StepIndex = generatedPlan
    ? 4
    : !stepValidity[0]
      ? 0
      : !stepValidity[1]
        ? 1
        : !stepValidity[2]
          ? 2
          : 3;

  const isDocumentStep = currentStep === 4;

  function updateInput<Key extends keyof AnnualPlanInput>(key: Key, value: AnnualPlanInput[Key]) {
    setInput((previousInput) => ({
      ...previousInput,
      [key]: value,
    }));
    setGeneratedPlan(null);
    setEditableRows([]);
  }

  function goToStep(step: StepIndex) {
    if (step <= maxAccessibleStep) {
      setCurrentStep(step);
    }
  }

  function goBack() {
    setCurrentStep((step) => Math.max(0, step - 1) as StepIndex);
  }

  function goNext() {
    if (currentStep < 3 && stepValidity[currentStep]) {
      setCurrentStep((step) => Math.min(4, step + 1) as StepIndex);
    }
  }

  function generatePlan() {
    if (!stepValidity[3]) {
      return;
    }

    generationTimersRef.current.forEach((timer) => clearTimeout(timer));
    generationTimersRef.current = [];

    const draft = createAnnualPlanDraft({
      subject: input.subject,
      grade: input.gradeLevel,
      schoolYear: input.schoolYear,
      municipality: input.municipality,
      lessonsPerWeek: Number(input.lessonsPerWeek),
      courseCount: Number(input.courseCount),
      wishes: input.specialThemes,
      notes: input.aiNotes,
    });

    setIsGenerating(true);
    setGenerationStepIndex(0);

    generationSteps.forEach((_, index) => {
      const timer = setTimeout(() => setGenerationStepIndex(index), index * 560);
      generationTimersRef.current.push(timer);
    });

    const finishTimer = setTimeout(() => {
      (async () => {
        try {
          const structural = createStructuralCoursesForAi({
            subject: input.subject,
            grade: input.gradeLevel,
            schoolYear: input.schoolYear,
            municipality: input.municipality,
            lessonsPerWeek: Number(input.lessonsPerWeek),
            courseCount: Number(input.courseCount),
            wishes: input.specialThemes,
            notes: input.aiNotes,
          });

          const aiInput: AnnualPlanAiInput = {
            subject: input.subject,
            grade: input.gradeLevel,
            gradeBand: getGradeBand(input.gradeLevel),
            schoolYear: input.schoolYear,
            municipality: input.municipality,
            lessonsPerWeek: Number(input.lessonsPerWeek),
            courseCount: Number(input.courseCount),
            wishes: input.specialThemes,
            commonGoalsIntro: getCommonGoalsIntro(input.subject),
            holidaySummary: getHolidayWeeks(input.schoolYear, input.municipality).map((h) => h.label),
            structuralCourses: structural,
          };

          let aiOutput: AnnualPlanAiOutput | null = null;
          let usedApi = false;

          try {
            const resp = await fetch("/api/laerervaerktoejer/aarsplan-generator", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(aiInput),
            });

            if (resp.ok) {
              const json = await resp.json();
              // Basic validation: must have courses array same length and matching ids
              if (json && Array.isArray(json.courses) && json.courses.length === structural.length) {
                const idsMatch = structural.every((c, idx) => String(c.id) === String(json.courses[idx].id));
                if (idsMatch) {
                  aiOutput = json as AnnualPlanAiOutput;
                  usedApi = true;
                }
              }
            }
          } catch {
            // network or other error -> fallback
            aiOutput = null;
          }

          if (!aiOutput) {
            aiOutput = createMockAiAnnualPlanEnhancement(aiInput);
            usedApi = false;
          }

          const enhanced = {
            ...draft,
            courses: draft.courses.map((course, idx) => {
              const aiCourse = aiOutput!.courses.find((c) => String(c.id) === `${idx + 1}`);
              if (!aiCourse) return course;

              return {
                ...course,
                title: aiCourse.improvedTitle ?? course.title,
                description: aiCourse.commonGoalsFocus ?? course.description,
                activities: aiCourse.contentAndActivities ?? course.activities,
                product: aiCourse.evaluation ?? course.product,
              };
            }),
            summary: {
              ...draft.summary,
              teacherNote: aiOutput.teacherNote,
            },
          };

          setAiSource(usedApi ? "api" : "local");
          setGeneratedPlan(enhanced);
          setCurrentStep(4);
        } finally {
          setIsGenerating(false);
          generationTimersRef.current = [];
        }
      })();
    }, generationSteps.length * 560 + 420);

    generationTimersRef.current.push(finishTimer);
  }

  function updateEditableRow(rowId: string, field: EditableAnnualPlanRowField, value: string) {
    setEditableRows((rows) => rows.map((row) => (row.id === rowId ? { ...row, [field]: value } : row)));
  }

  function addEditableRow() {
    setEditableRows((rows) => [
      ...rows,
      {
        id: `manual-${Date.now()}`,
        weeks: "",
        title: "Nyt forløb",
        goals: "",
        content: "",
        evaluation: "",
        source: "manual",
      },
    ]);
  }

  function deleteEditableRow(rowId: string) {
    setEditableRows((rows) => rows.filter((row) => row.id !== rowId));
  }

  function printAnnualPlan() {
    requestAnimationFrame(() => window.print());
  }

  return (
    <main
      className={`min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.22),transparent_34%),linear-gradient(135deg,#0f172a_0%,#13332d_44%,#1f2937_100%)] text-slate-950 print:bg-white print:text-black ${poppins.className}`}
    >
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 12mm;
          }

          .annual-plan-print-document {
            overflow: visible !important;
          }

          .annual-plan-print-document textarea {
            border: 0 !important;
            background: transparent !important;
            box-shadow: none !important;
            outline: 0 !important;
            padding: 0 !important;
            resize: none !important;
            overflow: visible !important;
          }

          .annual-plan-print-document table,
          .annual-plan-print-document tr,
          .annual-plan-print-document th,
          .annual-plan-print-document td {
            overflow: visible !important;
          }

          .annual-plan-print-document th,
          .annual-plan-print-document td {
            vertical-align: top !important;
          }
        }
      `}</style>
      <div
        className={`mx-auto flex min-h-screen w-full flex-col print:min-h-0 print:max-w-none print:px-0 print:py-0 ${
          isDocumentStep
            ? "max-w-[1680px] px-3 py-6 md:px-6 lg:px-8 xl:px-10"
            : "max-w-7xl px-6 py-8 md:px-10 lg:px-12"
        }`}
      >
        <header className="flex items-center justify-between gap-4 print:hidden">
          <Link
            href="/dashboard/laerervaerktoejer"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/15 bg-slate-950/55 px-4 py-2 text-sm font-bold text-white shadow-sm backdrop-blur transition hover:border-emerald-300/60 hover:text-emerald-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300/20"
          >
            <ArrowLeft className="h-4 w-4" />
            Lærerværktøjer
          </Link>
          <div className="hidden min-h-11 items-center gap-2 rounded-lg border border-emerald-300/25 bg-emerald-300/10 px-4 py-2 text-sm font-bold text-emerald-50 shadow-sm backdrop-blur sm:inline-flex">
            <School className="h-4 w-4" />
            PDF-årsplan
          </div>
        </header>

        <section className={`${isDocumentStep ? "hidden" : "pt-10 lg:pt-12"} print:hidden`}>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="inline-flex rounded-lg border border-emerald-300/25 bg-emerald-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-50 shadow-sm backdrop-blur">
                Lærerværktøj
              </p>
              <h1 className={`mt-5 text-4xl font-black tracking-tight text-white md:text-6xl ${rubik.className}`}>
                Årsplan-generator
              </h1>
              <p className="mt-4 max-w-2xl text-base font-semibold leading-8 text-slate-100 md:text-lg">
                Lav en årsplan på få trin.
                <br />
                Ret den på siden, og print eller gem som PDF.
              </p>
            </div>
          </div>

          <nav className="mt-8 grid gap-3 lg:grid-cols-5" aria-label="Årsplan-generator trin">
            {wizardSteps.map((step, index) => {
              const Icon = step.icon;
              const stepIndex = index as StepIndex;
              const isCurrent = currentStep === stepIndex;
              const isComplete = stepValidity[stepIndex] && stepIndex < currentStep;
              const isAccessible = stepIndex <= maxAccessibleStep;

              return (
                <button
                  key={step.title}
                  type="button"
                  disabled={!isAccessible}
                  onClick={() => goToStep(stepIndex)}
                  className={`group flex min-h-24 items-start gap-3 rounded-lg border p-4 text-left shadow-sm transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-55 ${
                    isCurrent
                      ? "border-emerald-300 bg-white text-slate-950 shadow-[0_18px_45px_rgba(16,185,129,0.16)]"
                      : "border-white/70 bg-white/70 text-slate-700 hover:border-emerald-200 hover:bg-white"
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
                      isCurrent
                        ? "border-emerald-200 bg-emerald-600 text-white"
                        : isComplete
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border-slate-200 bg-slate-50 text-slate-600"
                    }`}
                  >
                    {isComplete ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                      {step.label}
                    </span>
                    <span className="mt-1 block text-sm font-black leading-5">{step.title}</span>
                  </span>
                </button>
              );
            })}
          </nav>
        </section>

        <section
          className={`flex-1 gap-6 print:block print:py-0 ${
            isDocumentStep ? "py-5" : "grid py-8 lg:grid-cols-[minmax(0,1fr)_340px]"
          }`}
        >
          <div
            className={`rounded-lg border border-white/75 bg-white/80 shadow-[0_28px_80px_rgba(15,23,42,0.10)] backdrop-blur print:border-0 print:bg-white print:p-0 print:shadow-none ${
              isDocumentStep ? "p-3 md:p-5 xl:p-6" : "p-5 md:p-7"
            }`}
          >
            {currentStep === 0 ? (
              <section aria-labelledby="step-one-title">
                <StepHeader
                  colorClassName="bg-emerald-600"
                  eyebrow="Trin 1"
                  icon={<BookOpen className="h-6 w-6" />}
                  title="Fag og klassetrin"
                  description="Vælg fag og klassetrin."
                  titleId="step-one-title"
                />

                <div className="mt-8 grid gap-5 md:grid-cols-2">
                  <Field label="Fag">
                    <select
                      className={selectClassName}
                      value={input.subject}
                      onChange={(event) => updateInput("subject", event.target.value)}
                    >
                      <option value="">Vælg fag</option>
                      {subjects.map((subject) => (
                        <option key={subject} value={subject}>
                          {subject}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Klassetrin">
                    <select
                      className={selectClassName}
                      value={input.gradeLevel}
                      onChange={(event) => updateInput("gradeLevel", event.target.value)}
                    >
                      <option value="">Vælg klassetrin</option>
                      {gradeLevels.map((gradeLevel) => (
                        <option key={gradeLevel} value={gradeLevel}>
                          {gradeLevel}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </section>
            ) : null}

            {currentStep === 1 ? (
              <section aria-labelledby="step-two-title">
                <StepHeader
                  colorClassName="bg-sky-600"
                  eyebrow="Trin 2"
                  icon={<Calendar className="h-6 w-6" />}
                  title="Skoleår, skole og ferieplan"
                  description="Skriv skole og underviser, og vælg kommune til ferieuger."
                  titleId="step-two-title"
                />

                <div className="mt-8 grid gap-5 md:grid-cols-2">
                  <Field label="Skoleår">
                    <select
                      className={selectClassName}
                      value={input.schoolYear}
                      onChange={(event) => updateInput("schoolYear", event.target.value)}
                    >
                      <option value="">Vælg skoleår</option>
                      {schoolYears.map((schoolYear) => (
                        <option key={schoolYear} value={schoolYear}>
                          {schoolYear}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Skole">
                    <input
                      className={textInputClassName}
                      value={input.schoolName}
                      placeholder="Fx Spjellerup Friskole"
                      onChange={(event) => updateInput("schoolName", event.target.value)}
                    />
                  </Field>

                  <Field label="Underviser">
                    <input
                      className={textInputClassName}
                      value={input.teacherName}
                      placeholder="Fx Jeppe Laursen"
                      onChange={(event) => updateInput("teacherName", event.target.value)}
                    />
                  </Field>

                  <Field label="Kommune til ferieplan" description="Bruges kun til ferieuger og kalenderlogik.">
                    <select
                      className={selectClassName}
                      value={input.municipality}
                      onChange={(event) => updateInput("municipality", event.target.value)}
                    >
                      <option value="">Vælg kommune</option>
                      {municipalityOptions.map((municipality) => (
                        <option key={municipality} value={municipality}>
                          {municipality}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </section>
            ) : null}

            {currentStep === 2 ? (
              <section aria-labelledby="step-three-title">
                <StepHeader
                  colorClassName="bg-amber-500"
                  eyebrow="Trin 3"
                  icon={<Settings className="h-6 w-6" />}
                  title="Rammer og faste uger"
                  description="Angiv lokalt timetal, antal forløb og særlige uger."
                  titleId="step-three-title"
                />

                <div className="mt-8 grid gap-5 md:grid-cols-2">
                  <Field
                    label="Lektioner pr. uge / lokalt timetal"
                    description="Vælg det timetal, skolen har lagt for faget. Årsplanen fordeler indholdet efter dette."
                  >
                    <select
                      className={selectClassName}
                      value={input.lessonsPerWeek}
                      onChange={(event) => updateInput("lessonsPerWeek", event.target.value)}
                    >
                      {lessonsPerWeekOptions.map((lessonCount) => (
                        <option key={lessonCount} value={lessonCount}>
                          {lessonCount}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Antal forløb">
                    <select
                      className={selectClassName}
                      value={input.courseCount}
                      onChange={(event) => updateInput("courseCount", event.target.value)}
                    >
                      {courseCountOptions.map((courseCount) => (
                        <option key={courseCount} value={courseCount}>
                          {courseCount}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <div className="mt-6">
                  <Field
                    label="Faste uger / særlige uger"
                    description="Én pr. linje, fx Uge 41: Emneuge."
                  >
                    <AutoGrowingTextarea
                      className={textareaClassName}
                      value={input.fixedWeeks}
                      placeholder={"Uge 41: Emneuge\nUge 50: Juleværksted"}
                      onValueChange={(value) => updateInput("fixedWeeks", value)}
                    />
                  </Field>
                </div>

                <div className="mt-6">
                  <Field label="Eventuelle ekstra ønsker" description="Kort note til stil eller særlige hensyn.">
                    <AutoGrowingTextarea
                      className={textareaClassName}
                      value={input.specialThemes}
                      placeholder="Fx mere bevægelse eller fokus på mundtlighed."
                      onValueChange={(value) => updateInput("specialThemes", value)}
                    />
                  </Field>
                </div>
              </section>
            ) : null}

            {currentStep === 3 ? (
              <section aria-labelledby="step-four-title">
                <StepHeader
                  colorClassName="bg-rose-500"
                  eyebrow="Trin 4"
                  icon={<Sparkles className="h-6 w-6" />}
                  title="Generér årsplan"
                  description="Klik for at bygge årsplanen."
                  titleId="step-four-title"
                />

                <div className="mt-8 grid gap-4 md:grid-cols-2">
                  {[
                    ["Fag", input.subject],
                    ["Klassetrin", input.gradeLevel],
                    ["Skole", input.schoolName],
                    ["Underviser", input.teacherName],
                    ["Skoleår", input.schoolYear],
                    ["Ferieplan", input.municipality],
                    ["Undervisningsuger", `${previewTeachingWeekCount}`],
                    ["Lokalt timetal i alt", `${previewTotalLessons} lektioner`],
                    ["Faste uger", fixedWeekLines.length ? `${fixedWeekLines.length} angivet` : "Ingen"],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-slate-200 bg-slate-50/80 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
                      <p className="mt-2 text-base font-black text-slate-950">{value || <EmptyValue />}</p>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={!stepValidity[3] || isGenerating}
                  onClick={generatePlan}
                  className={`${buttonBaseClassName} mt-8 w-full border border-emerald-700 bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 focus-visible:ring-emerald-100 md:w-fit`}
                >
                  <Sparkles className="h-5 w-5" />
                  Lav årsplan
                  <ArrowRight className="h-4 w-4" />
                </button>
              </section>
            ) : null}

            {currentStep === 4 ? (
              <section aria-labelledby="step-five-title">
                <div className="flex flex-col gap-4 print:hidden md:flex-row md:items-center md:justify-between">
                  <div className="flex items-start gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white">
                      <FileText className="h-6 w-6" />
                    </span>
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Trin 5</p>
                      <h2
                        id="step-five-title"
                        className={`mt-2 text-3xl font-black tracking-tight text-slate-950 ${rubik.className}`}
                      >
                        Redigér årsplan
                      </h2>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      disabled={!stepValidity[3] || isGenerating}
                      onClick={generatePlan}
                      className={`${buttonBaseClassName} border border-emerald-700 bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 focus-visible:ring-emerald-100`}
                    >
                      <Sparkles className="h-4 w-4" />
                      Generér igen
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(0)}
                      className={`${buttonBaseClassName} border border-slate-200 bg-white text-slate-800 shadow-sm hover:border-emerald-200 hover:text-emerald-800 focus-visible:ring-emerald-100`}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Tilpas valg
                    </button>
                  </div>
                </div>

                {generatedPlan ? (
                  <AnnualPlanDocumentEditor
                    plan={generatedPlan}
                    rows={editableRows}
                    schoolName={input.schoolName}
                    teacherName={input.teacherName}
                    lessonsPerWeek={`${input.lessonsPerWeek} lektioner/uge`}
                    onAddRow={addEditableRow}
                    onDeleteRow={deleteEditableRow}
                    onPrint={printAnnualPlan}
                    onUpdateRow={updateEditableRow}
                  />
                ) : (
                  <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm font-bold leading-7 text-amber-950">
                    Lav en årsplan i trin 4 for at se previewet.
                  </div>
                )}
              </section>
            ) : null}

            {currentStep !== 4 ? (
              <div className="mt-10 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  disabled={currentStep === 0}
                  onClick={goBack}
                  className={`${buttonBaseClassName} border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-950 focus-visible:ring-slate-100`}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Tilbage
                </button>

                {currentStep < 3 ? (
                  <button
                    type="button"
                    disabled={!stepValidity[currentStep]}
                    onClick={goNext}
                    className={`${buttonBaseClassName} border border-slate-950 bg-slate-950 text-white shadow-sm hover:bg-slate-800 focus-visible:ring-slate-200`}
                  >
                    Næste
                    <ChevronRight className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          {!isDocumentStep ? (
            <aside className="h-fit rounded-lg border border-white/15 bg-slate-950/60 p-5 text-white shadow-sm backdrop-blur print:hidden">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">Dine valg</p>
              <div className="mt-4 grid gap-3">
                <SummaryRow label="Fag" value={input.subject} />
                <SummaryRow label="Klassetrin" value={input.gradeLevel} />
                <SummaryRow label="Skole" value={input.schoolName} />
                <SummaryRow label="Underviser" value={input.teacherName} />
                <SummaryRow label="Skoleår" value={input.schoolYear} />
                <SummaryRow label="Ferieplan" value={input.municipality} />
                <SummaryRow label="Lokalt timetal" value={`${input.lessonsPerWeek} lektioner pr. uge`} />
                <SummaryRow label="Forløb" value={`${input.courseCount} større forløb`} />
                <SummaryRow label="Undervisningsuger" value={`${previewTeachingWeekCount}`} />
                <SummaryRow label="Lokalt timetal i alt" value={`${previewTotalLessons} lektioner`} />
                <SummaryRow
                  label="Faste uger"
                  value={fixedWeekLines.length ? `${fixedWeekLines.length} angivet` : ""}
                />
              </div>
            </aside>
          ) : null}
        </section>
      </div>
      {isGenerating ? (
        <GenerationOverlay
          currentStepIndex={generationStepIndex}
          steps={generationSteps}
          subject={input.subject}
          gradeLevel={input.gradeLevel}
        />
      ) : null}
    </main>
  );
}
function StepHeader({
  colorClassName,
  eyebrow,
  icon,
  title,
  description,
  titleId,
}: {
  colorClassName: string;
  eyebrow: string;
  icon: ReactNode;
  title: string;
  description: string;
  titleId: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-white ${colorClassName}`}>
        {icon}
      </span>
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p>
        <h2 id={titleId} className={`mt-2 text-3xl font-black tracking-tight text-slate-950 ${rubik.className}`}>
          {title}
        </h2>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-slate-600">{description}</p>
      </div>
    </div>
  );
}

function Field({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-black text-slate-950">{label}</span>
      {description ? <span className="mt-1 block text-sm leading-6 text-slate-600">{description}</span> : null}
      {children}
    </label>
  );
}

function AutoGrowingTextarea({
  className,
  placeholder,
  value,
  onValueChange,
}: {
  className: string;
  placeholder?: string;
  value: string;
  onValueChange: (value: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    resizeTextareaToContent(textarea);
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      className={className}
      value={value}
      placeholder={placeholder}
      onChange={(event) => {
        resizeTextareaToContent(event.currentTarget);
        onValueChange(event.target.value);
      }}
    />
  );
}

function EmptyValue({ children = "Ikke valgt endnu" }: { children?: ReactNode }) {
  return <span className="text-slate-400">{children}</span>;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/10 p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-300">{label}</p>
      <p className="mt-1 text-sm font-black text-white">{value || <EmptyValue />}</p>
    </div>
  );
}

function DocumentMetaLine({ label, value }: { label: string; value: string | number }) {
  const displayValue = String(value).trim();

  return (
    <p>
      <span className="font-black text-slate-900">{label}:</span>{" "}
      {displayValue || <span aria-hidden="true">{"\u00a0"}</span>}
    </p>
  );
}

function AnnualPlanDocumentEditor({
  plan,
  rows,
  schoolName,
  teacherName,
  lessonsPerWeek,
  onAddRow,
  onDeleteRow,
  onPrint,
  onUpdateRow,
}: {
  plan: AnnualPlanDraft;
  rows: EditableAnnualPlanRow[];
  schoolName: string;
  teacherName: string;
  lessonsPerWeek: string;
  onAddRow: () => void;
  onDeleteRow: (rowId: string) => void;
  onPrint: () => void;
  onUpdateRow: (rowId: string, field: EditableAnnualPlanRowField, value: string) => void;
}) {
  return (
    <div className="mt-6 print:mt-0">
      <div className="mb-4 flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-black text-slate-600">
          Ret årsplanen her på siden, før du printer eller gemmer som PDF.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onAddRow}
            className={`${buttonBaseClassName} border border-slate-300 bg-white text-slate-900 shadow-sm hover:border-emerald-300 hover:text-emerald-800 focus-visible:ring-emerald-100`}
          >
            <Plus className="h-4 w-4" />
            Tilføj række
          </button>
          <button
            type="button"
            onClick={onPrint}
            className={`${buttonBaseClassName} border border-slate-950 bg-slate-950 text-white shadow-sm hover:bg-slate-800 focus-visible:ring-slate-200`}
          >
            <Printer className="h-4 w-4" />
            Print / gem som PDF
          </button>
        </div>
      </div>

      <article className="annual-plan-print-document w-full overflow-hidden rounded-md bg-[#fffdf8] text-slate-950 shadow-[0_24px_70px_rgba(15,23,42,0.16)] print:overflow-visible print:rounded-none print:bg-white print:shadow-none">
        <header className="border-b border-slate-300 px-7 py-7 print:px-0 print:py-0 print:pb-4 md:px-9">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500 print:text-[9pt]">
            Årsplan
          </p>
          <h3 className={`mt-3 text-3xl font-black tracking-tight text-slate-950 print:text-[20pt] md:text-5xl ${rubik.className}`}>
            {plan.title}
          </h3>
          <div className="mt-5 grid gap-2 text-sm font-bold leading-6 text-slate-700 print:grid-cols-2 print:text-[10pt] sm:grid-cols-2 lg:grid-cols-4">
            <DocumentMetaLine label="Skole" value={schoolName} />
            <DocumentMetaLine label="Underviser" value={teacherName} />
            <DocumentMetaLine label="Fag" value={plan.subject} />
            <DocumentMetaLine label="Klassetrin" value={plan.grade} />
            <DocumentMetaLine label="Skoleår" value={plan.schoolYear} />
            <DocumentMetaLine label="Lokalt timetal" value={lessonsPerWeek} />
            <DocumentMetaLine label="Forløb" value={plan.summary.courseCount} />
            <DocumentMetaLine label="Undervisningsuger" value={plan.teachingWeeks} />
          </div>
          <p className="mt-5 text-sm font-semibold leading-7 text-slate-700 print:text-[10pt] print:leading-snug">
            {plan.commonGoalsIntro}
          </p>
        </header>

        <section className="px-3 py-5 print:hidden md:px-5 xl:px-7">
          <div className="overflow-x-auto [scrollbar-width:none] print:overflow-visible [&::-webkit-scrollbar]:hidden">
            <table className="w-full min-w-[1180px] border-collapse text-left print:min-w-0">
              <thead>
                <tr className="text-xs font-black uppercase tracking-[0.1em] text-slate-800 print:text-[8pt]">
                  <th className={`${documentHeaderCellClassName} w-[13%]`}>Uge / periode</th>
                  <th className={`${documentHeaderCellClassName} w-[24%]`}>Emne / forløb</th>
                  <th className={`${documentHeaderCellClassName} w-[28%]`}>Mål / Fælles Mål-fokus</th>
                  <th className={`${documentHeaderCellClassName} w-[35%]`}>
                    Indhold / aktiviteter / evaluering
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <EditableAnnualPlanTableRow
                    key={row.id}
                    row={row}
                    onDeleteRow={onDeleteRow}
                    onUpdateRow={onUpdateRow}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="hidden print:block print:py-4">
          <table className="w-full table-fixed border-collapse text-left">
            <thead>
              <tr className="text-[8pt] font-black uppercase tracking-[0.08em] text-slate-800">
                <th className={`${documentHeaderCellClassName} w-[15%] px-2 py-2`}>Uge / periode</th>
                <th className={`${documentHeaderCellClassName} w-[22%] px-2 py-2`}>Emne / forløb</th>
                <th className={`${documentHeaderCellClassName} w-[27%] px-2 py-2`}>Mål</th>
                <th className={`${documentHeaderCellClassName} w-[36%] px-2 py-2`}>
                  Indhold / aktiviteter / evaluering
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <PrintableAnnualPlanTableRow key={row.id} row={row} />
              ))}
            </tbody>
          </table>
        </section>

        {plan.summary.teacherNote ? (
          <footer className="border-t border-slate-200 px-7 py-5 print:px-0 print:py-3 md:px-9">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500 print:text-[8pt]">Lærer-note</p>
            <p className="mt-2 text-sm font-semibold leading-7 text-slate-700 print:text-[10pt] print:leading-snug">
              {plan.summary.teacherNote}
            </p>
          </footer>
        ) : null}
      </article>
    </div>
  );
}

function PrintableAnnualPlanTableRow({ row }: { row: EditableAnnualPlanRow }) {
  const combinedContent = [row.content, row.evaluation].filter((value) => value.trim()).join("\n\nEvaluering: ");

  return (
    <tr className={getAnnualPlanRowClassName(row)}>
      <td className={`${documentTableCellClassName} px-2 py-2`}>
        <PrintableText value={row.weeks} />
      </td>
      <td className={`${documentTableCellClassName} px-2 py-2`}>
        <PrintableText value={row.title} strong />
      </td>
      <td className={`${documentTableCellClassName} px-2 py-2`}>
        <PrintableText value={row.goals} />
      </td>
      <td className={`${documentTableCellClassName} px-2 py-2`}>
        <PrintableText value={combinedContent} />
      </td>
    </tr>
  );
}

function PrintableText({ value, strong = false }: { value: string; strong?: boolean }) {
  return (
    <p
      className={`whitespace-pre-wrap break-words text-[9pt] leading-[1.45] text-slate-900 ${
        strong ? "font-bold" : "font-medium"
      }`}
    >
      {value.trim() || " "}
    </p>
  );
}

function EditableAnnualPlanTableRow({
  row,
  onDeleteRow,
  onUpdateRow,
}: {
  row: EditableAnnualPlanRow;
  onDeleteRow: (rowId: string) => void;
  onUpdateRow: (rowId: string, field: EditableAnnualPlanRowField, value: string) => void;
}) {
  return (
    <tr className={getAnnualPlanRowClassName(row)}>
      <td className={`${documentTableCellClassName} px-3 py-3`}>
        <EditableDocumentTextarea
          field="weeks"
          label="Uge / periode"
          minimumRows={row.source === "fixed-week" || row.source === "holiday" ? 2 : 3}
          row={row}
          value={row.weeks}
          onUpdateRow={onUpdateRow}
        />
      </td>
      <td className={`${documentTableCellClassName} px-3 py-3`}>
        <EditableDocumentTextarea
          field="title"
          label="Emne / forløb"
          minimumRows={row.source === "holiday" ? 2 : 3}
          row={row}
          value={row.title}
          onUpdateRow={onUpdateRow}
        />
        <button
          type="button"
          onClick={() => onDeleteRow(row.id)}
          className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-500 transition hover:border-rose-200 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-100 print:hidden"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Slet
        </button>
      </td>
      <td className={`${documentTableCellClassName} px-3 py-3`}>
        <EditableDocumentTextarea
          field="goals"
          label="Mål / Fælles Mål-fokus"
          minimumRows={row.source === "holiday" ? 2 : 5}
          row={row}
          value={row.goals}
          onUpdateRow={onUpdateRow}
        />
      </td>
      <td className={`${documentTableCellClassName} px-3 py-3`}>
        <div className="grid gap-3">
          <EditableDocumentTextarea
            field="content"
            label="Indhold / aktiviteter"
            minimumRows={row.source === "holiday" ? 2 : 4}
            row={row}
            value={row.content}
            onUpdateRow={onUpdateRow}
          />
          <EditableDocumentTextarea
            field="evaluation"
            label="Evaluering"
            minimumRows={2}
            row={row}
            value={row.evaluation}
            onUpdateRow={onUpdateRow}
          />
        </div>
      </td>
    </tr>
  );
}

function EditableDocumentTextarea({
  field,
  label,
  minimumRows,
  row,
  value,
  onUpdateRow,
}: {
  field: EditableAnnualPlanRowField;
  label: string;
  minimumRows: number;
  row: EditableAnnualPlanRow;
  value: string;
  onUpdateRow: (rowId: string, field: EditableAnnualPlanRowField, value: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    resizeTextareaToContent(textarea);
  }, [value]);

  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <textarea
        ref={textareaRef}
        aria-label={`${label}: ${row.title || row.weeks || "række"}`}
        className={documentTextareaClassName}
        rows={getTextareaRows(value, minimumRows)}
        value={value}
        onChange={(event) => {
          resizeTextareaToContent(event.currentTarget);
          onUpdateRow(row.id, field, event.target.value);
        }}
      />
    </label>
  );
}

function GenerationOverlay({
  currentStepIndex,
  steps,
  subject,
  gradeLevel,
}: {
  currentStepIndex: number;
  steps: readonly string[];
  subject: string;
  gradeLevel: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-6 py-8 backdrop-blur-sm print:hidden">
      <section className="w-full max-w-xl rounded-lg border border-white/70 bg-white p-6 shadow-[0_30px_90px_rgba(15,23,42,0.28)]">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <Sparkles className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Årsplan</p>
            <h2 className={`mt-2 text-3xl font-black tracking-tight text-slate-950 ${rubik.className}`}>
              Bygger din årsplan
            </h2>
            <p className="mt-3 text-sm font-semibold leading-7 text-slate-600">
              Vi samler {subject || "fag"} og {gradeLevel || "klassetrin"} til et første udkast med Fælles Mål,
              skoleår og foreløbige ferieuger.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3">
          {steps.map((step, index) => {
            const isDone = index < currentStepIndex;
            const isActive = index === currentStepIndex;

            return (
              <div
                key={step}
                className={`flex min-h-12 items-center gap-3 rounded-lg border px-4 py-3 transition ${
                  isActive
                    ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                    : isDone
                      ? "border-slate-200 bg-slate-50 text-slate-700"
                      : "border-slate-100 bg-white text-slate-400"
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-xs font-black ${
                    isDone
                      ? "border-emerald-200 bg-emerald-600 text-white"
                      : isActive
                        ? "border-emerald-300 bg-white text-emerald-800"
                        : "border-slate-200 bg-slate-50 text-slate-400"
                  }`}
                >
                  {isDone ? <Check className="h-4 w-4" /> : index + 1}
                </span>
                <span className="text-sm font-black">{step}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-emerald-600 transition-all duration-500"
            style={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }}
          />
        </div>
      </section>
    </div>
  );
}
