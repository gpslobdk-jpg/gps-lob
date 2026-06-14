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
  Download,
  FileText,
  GraduationCap,
  Image as ImageIcon,
  School,
  Settings,
  Sparkles,
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
  municipalities,
  schoolYears,
  subjects,
  type AnnualPlanDraft,
} from "./annualPlanEngine";
import { getGradeBand } from "./annualPlanEngine";
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
  municipality: string;
  lessonsPerWeek: string;
  courseCount: string;
  fixedWeeks: string;
  specialThemes: string;
  aiNotes: string;
};

type StepIndex = 0 | 1 | 2 | 3 | 4;

const initialInput: AnnualPlanInput = {
  subject: "",
  gradeLevel: "",
  schoolYear: "",
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
    title: "Vælg skoleår og kommune",
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
    title: "Se flot årsplan-preview",
    label: "Trin 5",
    icon: FileText,
  },
] as const;

const periodAccentClasses = [
  {
    visual: "from-emerald-300 via-teal-200 to-sky-200",
    badge: "bg-emerald-50 text-emerald-800 border-emerald-200",
    line: "bg-emerald-500",
  },
  {
    visual: "from-amber-300 via-orange-200 to-rose-200",
    badge: "bg-amber-50 text-amber-900 border-amber-200",
    line: "bg-amber-500",
  },
  {
    visual: "from-sky-300 via-cyan-200 to-lime-200",
    badge: "bg-sky-50 text-sky-900 border-sky-200",
    line: "bg-sky-500",
  },
  {
    visual: "from-rose-300 via-pink-200 to-orange-200",
    badge: "bg-rose-50 text-rose-900 border-rose-200",
    line: "bg-rose-500",
  },
  {
    visual: "from-lime-300 via-emerald-200 to-yellow-200",
    badge: "bg-lime-50 text-lime-900 border-lime-200",
    line: "bg-lime-500",
  },
  {
    visual: "from-cyan-300 via-blue-200 to-emerald-200",
    badge: "bg-cyan-50 text-cyan-900 border-cyan-200",
    line: "bg-cyan-500",
  },
  {
    visual: "from-fuchsia-200 via-rose-200 to-amber-200",
    badge: "bg-fuchsia-50 text-fuchsia-900 border-fuchsia-200",
    line: "bg-fuchsia-500",
  },
  {
    visual: "from-yellow-300 via-lime-200 to-teal-200",
    badge: "bg-yellow-50 text-yellow-900 border-yellow-200",
    line: "bg-yellow-500",
  },
] as const;

const selectClassName =
  "mt-3 min-h-12 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100";

const textareaClassName =
  "mt-3 min-h-28 w-full resize-y rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold leading-6 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100";

const buttonBaseClassName =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-black transition focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-45";

const generationSteps = [
  "Læser dine valg",
  "Låser skoleår, ferieuger og perioder",
  "Sender den faste årsplanstruktur til AI",
  "Forbedrer mål, aktiviteter og evaluering",
  "Bygger årsplanen i 4 kolonner",
  "Klargør billedidéer til senere",
] as const;

function getFixedWeekLines(fixedWeeks: string) {
  return fixedWeeks
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function AarsplanGeneratorPage() {
  const [input, setInput] = useState<AnnualPlanInput>(initialInput);
  const [currentStep, setCurrentStep] = useState<StepIndex>(0);
  const [generatedPlan, setGeneratedPlan] = useState<AnnualPlanDraft | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStepIndex, setGenerationStepIndex] = useState(0);
  const [aiSource, setAiSource] = useState<"local" | "api">("local");
  const generationTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    document.title = "Årsplan-generator – GPSLØB";
  }, []);

  useEffect(
    () => () => {
      generationTimersRef.current.forEach((timer) => clearTimeout(timer));
    },
    [],
  );

  const selectedSchoolYear = input.schoolYear || "2026/2027";
  const selectedMunicipality = input.municipality || "Generisk ferieplan";
  const previewHolidayWeeks = useMemo(
    () => getHolidayWeeks(selectedSchoolYear, selectedMunicipality),
    [selectedMunicipality, selectedSchoolYear],
  );
  const previewTeachingWeekCount = useMemo(
    () => buildTeachingWeeks(selectedSchoolYear, selectedMunicipality).length,
    [selectedMunicipality, selectedSchoolYear],
  );
  const previewTotalLessons = previewTeachingWeekCount * Number(input.lessonsPerWeek);
  const fixedWeekLines = useMemo(() => getFixedWeekLines(input.fixedWeeks), [input.fixedWeeks]);

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

  const selectedSubjectIntro = input.subject ? getCommonGoalsIntro(input.subject) : getCommonGoalsIntro("");

  function updateInput<Key extends keyof AnnualPlanInput>(key: Key, value: AnnualPlanInput[Key]) {
    setInput((previousInput) => ({
      ...previousInput,
      [key]: value,
    }));
    setGeneratedPlan(null);
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
                imagePrompt: aiCourse.imageIdea ?? course.imagePrompt,
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

  return (
    <main
      className={`min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.22),transparent_34%),linear-gradient(135deg,#0f172a_0%,#13332d_44%,#1f2937_100%)] text-slate-950 ${poppins.className}`}
    >
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-8 md:px-10 lg:px-12">
        <header className="flex items-center justify-between gap-4">
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

        <section className="pt-10 lg:pt-12">
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
                Du vælger rammerne. Assistenten laver et forslag.
                <br />
                Til sidst kan du downloade en flot PDF.
              </p>
            </div>
            <div className="rounded-lg border border-amber-200/35 bg-amber-100/10 px-5 py-4 text-sm font-bold leading-6 text-amber-50 shadow-sm backdrop-blur">
              Tjek altid ugerne, før du bruger planen.
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

        <section className="grid flex-1 gap-6 py-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="rounded-lg border border-white/75 bg-white/80 p-5 shadow-[0_28px_80px_rgba(15,23,42,0.10)] backdrop-blur md:p-7">
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
                  <Field label="Fag" description="Vælg det fag, årsplanen skal bygges til.">
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

                  <Field label="Klassetrin" description="Klassetrinnet bruges i forløbsbeskrivelserne.">
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

                <div className="mt-8 rounded-lg border border-emerald-100 bg-emerald-50/80 p-5">
                  <div className="flex items-center gap-3">
                    <GraduationCap className="h-5 w-5 text-emerald-800" />
                    <p className="text-sm font-black text-emerald-950">Fælles Mål-preview</p>
                  </div>
                  <p className="mt-3 text-sm font-semibold leading-7 text-emerald-950/80">{selectedSubjectIntro}</p>
                </div>
              </section>
            ) : null}

            {currentStep === 1 ? (
              <section aria-labelledby="step-two-title">
                <StepHeader
                  colorClassName="bg-sky-600"
                  eyebrow="Trin 2"
                  icon={<Calendar className="h-6 w-6" />}
                  title="Skoleår og ferieplan"
                  description="Vælg skoleår og kommune."
                  titleId="step-two-title"
                />

                <div className="mt-8 grid gap-5 md:grid-cols-2">
                  <Field label="Skoleår" description="Vælg det skoleår, planen skal dække.">
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

                  <Field label="Kommune eller ferieplan" description="Ferieuger er foreløbige og kan justeres.">
                    <select
                      className={selectClassName}
                      value={input.municipality}
                      onChange={(event) => updateInput("municipality", event.target.value)}
                    >
                      <option value="">Vælg kommune</option>
                      {municipalities.map((municipality) => (
                        <option key={municipality} value={municipality}>
                          {municipality}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-950">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">Ferieuger</p>
                      <p className="mt-2 text-sm font-bold">
                        Foreløbigt beregnet til {previewTeachingWeekCount} undervisningsuger og {previewTotalLessons}{" "}
                        lektioner med dine nuværende rammer.
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {previewHolidayWeeks.map((holiday) => (
                      <div key={holiday.name} className="rounded-lg border border-amber-200 bg-white/70 p-4">
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-700">
                          {holiday.type === "holiday" ? "Springes over" : "Note"}
                        </p>
                        <p className="mt-2 text-sm font-black">{holiday.name}</p>
                        <p className="mt-1 text-sm font-semibold text-amber-900/75">{holiday.label}</p>
                      </div>
                    ))}
                  </div>
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
                  description="Angiv lektioner, antal forløb og særlige uger."
                  titleId="step-three-title"
                />

                <div className="mt-8 grid gap-5 md:grid-cols-2">
                  <Field label="Antal lektioner pr. uge" description="Bruges til anslået lektionstal i hvert forløb.">
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

                  <Field label="Antal større forløb" description="Motoren fordeler forløbene over undervisningsugerne.">
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
                    label="Faste uger eller særlige dage"
                    description="Skriv én pr. linje. Eksempel: Uge 41: Emneuge"
                  >
                    <textarea
                      className={textareaClassName}
                      value={input.fixedWeeks}
                      placeholder={"Uge 41: Emneuge\nUge 50: Juleværksted"}
                      onChange={(event) => updateInput("fixedWeeks", event.target.value)}
                    />
                  </Field>
                </div>

                <div className="mt-6">
                  <Field label="Andre ønsker" description="Kort note til stil, arbejdsformer eller særlige hensyn.">
                    <textarea
                      className={textareaClassName}
                      value={input.specialThemes}
                      placeholder="Fx mere bevægelse eller fokus på mundtlighed."
                      onChange={(event) => updateInput("specialThemes", event.target.value)}
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
                  description="Klik for at bygge et forslag."
                  titleId="step-four-title"
                />

                <div className="mt-8 grid gap-4 md:grid-cols-2">
                  {[
                    ["Fag", input.subject],
                    ["Klassetrin", input.gradeLevel],
                    ["Skoleår", input.schoolYear],
                    ["Ferieplan", input.municipality],
                    ["Undervisningsuger", `${previewTeachingWeekCount}`],
                    ["Lektioner i alt", `${previewTotalLessons}`],
                    ["Faste uger", fixedWeekLines.length ? `${fixedWeekLines.length} angivet` : "Ingen"],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-slate-200 bg-slate-50/80 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
                      <p className="mt-2 text-base font-black text-slate-950">{value || <EmptyValue />}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-8 rounded-lg border border-rose-100 bg-rose-50 p-5">
                  <p className="text-sm font-black text-rose-950">PDF-retning</p>
                  <p className="mt-2 text-sm font-semibold leading-7 text-rose-950/75">
                    Forslaget vises som et dokument-preview. Rigtig PDF-download kommer senere.
                  </p>
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
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
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
                        Årsplan-preview
                      </h2>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      disabled
                      className={`${buttonBaseClassName} border border-slate-200 bg-slate-100 text-slate-500 shadow-sm disabled:opacity-100`}
                    >
                      <Download className="h-4 w-4" />
                      Download PDF
                      <span className="rounded-md bg-white px-2 py-1 text-[11px] font-black text-slate-500">
                        Kommer snart
                      </span>
                    </button>
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
                  <AnnualPlanPreview plan={generatedPlan} fixedWeekLines={fixedWeekLines} aiSource={aiSource} />
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

          <aside className="h-fit rounded-lg border border-white/15 bg-slate-950/60 p-5 text-white shadow-sm backdrop-blur">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">Dine valg</p>
            <div className="mt-4 grid gap-3">
              <SummaryRow label="Fag" value={input.subject} />
              <SummaryRow label="Klassetrin" value={input.gradeLevel} />
              <SummaryRow label="Skoleår" value={input.schoolYear} />
              <SummaryRow label="Ferieplan" value={input.municipality} />
              <SummaryRow label="Lektioner" value={`${input.lessonsPerWeek} pr. uge`} />
              <SummaryRow label="Forløb" value={`${input.courseCount} større forløb`} />
              <SummaryRow label="Undervisningsuger" value={`${previewTeachingWeekCount}`} />
              <SummaryRow label="Lektioner i alt" value={`${previewTotalLessons}`} />
              <SummaryRow label="Faste uger" value={fixedWeekLines.length ? `${fixedWeekLines.length} angivet` : ""} />
            </div>
            <div className="mt-5 rounded-lg border border-amber-200/30 bg-amber-100/10 p-4">
              <p className="text-sm font-black text-amber-50">Ferieuger</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-amber-50/75">
                Ferieuger er foreløbige og kan justeres.
              </p>
            </div>
            <div className="mt-4 rounded-lg border border-emerald-200/25 bg-emerald-300/10 p-4">
              <p className="text-sm font-black text-emerald-50">Assistent</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-emerald-50/75">
                AI hjælper med formuleringer. Uger, ferier og perioder fastholdes af årsplanmotoren.
              </p>
            </div>
          </aside>
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

function AnnualPlanPreview({
  plan,
  fixedWeekLines,
  aiSource,
}: {
  plan: AnnualPlanDraft;
  fixedWeekLines: string[];
  aiSource?: "local" | "api";
}) {
  return (
    <div className="mt-8 rounded-lg border border-slate-300 bg-slate-200/70 p-3 shadow-[0_24px_70px_rgba(15,23,42,0.16)]">
      <article className="overflow-hidden rounded-md bg-[#fffdf8] text-slate-950 shadow-sm">
        <header className="border-b border-slate-200 px-7 py-7 md:px-9">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="max-w-4xl">
              <p className="inline-flex rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-emerald-800">
                PDF-preview
              </p>
              <h3 className={`mt-5 text-4xl font-black tracking-tight md:text-5xl ${rubik.className}`}>
                {plan.title}
              </h3>
              <p className="mt-4 text-sm font-bold leading-7 text-slate-600">
                {plan.subject} · {plan.grade} · {plan.schoolYear} · {plan.municipality}
              </p>
            </div>
            <button
              type="button"
              disabled
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-black text-slate-500"
            >
              <Download className="h-4 w-4" />
              Download PDF
              <span className="rounded-md bg-white px-2 py-1 text-[11px] font-black text-slate-500">Kommer snart</span>
            </button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <DocumentMeta label="Forløb" value={`${plan.summary.courseCount}`} />
            <DocumentMeta label="Undervisningsuger" value={`${plan.teachingWeeks}`} />
            <DocumentMeta label="Lektioner i alt" value={`${plan.summary.totalLessons}`} />
            <DocumentMeta label="Forslag" value={aiSource === "api" ? "AI-genereret" : "Lokalt forbedret"} />
          </div>
        </header>

        <section className="px-7 py-6 md:px-9">
          <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <GraduationCap className="h-5 w-5 text-emerald-800" />
                <h4 className="text-base font-black text-slate-950">Fælles Mål</h4>
              </div>
              <p className="mt-4 text-sm font-semibold leading-7 text-slate-700">{plan.commonGoalsIntro}</p>
            </section>

            <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-amber-800" />
                <h4 className="text-base font-black text-slate-950">Ferieuger</h4>
              </div>
              <p className="mt-3 text-sm font-semibold leading-6 text-amber-950/80">
                Tjek altid ugerne, før du bruger planen.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {plan.holidayWeeks.map((holiday) => (
                  <span
                    key={holiday.name}
                    className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs font-black text-amber-950"
                  >
                    {holiday.name}: {holiday.label}
                  </span>
                ))}
              </div>
            </section>
          </div>

          <section className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-slate-700" />
              <h4 className="text-base font-black text-slate-950">Lærerens faste uger</h4>
            </div>
            {fixedWeekLines.length > 0 ? (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {fixedWeekLines.map((line, index) => (
                  <p
                    key={`${line}-${index}`}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold"
                  >
                    {line}
                  </p>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">Ingen faste uger angivet.</p>
            )}
          </section>

          {plan.summary.teacherNote ? (
            <section className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-5">
              <p className="text-base font-black text-slate-950">Lærer-note</p>
              <p className="mt-3 text-sm font-semibold leading-7 text-slate-700">{plan.summary.teacherNote}</p>
            </section>
          ) : null}

          <AnnualPlanTable plan={plan} />
        </section>
      </article>
    </div>
  );
}

function DocumentMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 text-base font-black text-slate-950">{value}</p>
    </div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-6 py-8 backdrop-blur-sm">
      <section className="w-full max-w-xl rounded-lg border border-white/70 bg-white p-6 shadow-[0_30px_90px_rgba(15,23,42,0.28)]">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <Sparkles className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Assistent</p>
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

function AnnualPlanTable({ plan }: { plan: AnnualPlanDraft }) {
  return (
    <section className="mt-7 overflow-hidden rounded-lg border border-slate-300 bg-white">
      <div className="border-b border-slate-200 bg-slate-950 px-5 py-4 text-white">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-white/60">Årsplanskema</p>
            <h4 className={`mt-1 text-2xl font-black tracking-tight ${rubik.className}`}>4-kolonne årsplan</h4>
          </div>
          <p className="text-sm font-bold text-white/75">
            {plan.summary.courseCount} forløb · {plan.teachingWeeks} undervisningsuger
          </p>
        </div>
      </div>

      <div className="hidden border-b border-slate-200 bg-slate-100 px-5 py-3 lg:grid lg:grid-cols-[130px_210px_1fr_1.2fr] lg:gap-4">
        {["Uger", "Forløb", "Mål", "Indhold og evaluering"].map((heading) => (
          <p key={heading} className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            {heading}
          </p>
        ))}
      </div>

      <div className="divide-y divide-slate-200">
        {plan.courses.map((course, index) => {
          const accent = periodAccentClasses[index % periodAccentClasses.length];

          return (
            <article key={`${course.period}-${course.title}`} className="bg-white">
              <div className="grid gap-4 px-5 py-5 lg:grid-cols-[130px_210px_1fr_1.2fr]">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500 lg:hidden">
                    Uger
                  </p>
                  <span className={`mt-2 inline-flex rounded-lg border px-3 py-2 text-xs font-black ${accent.badge}`}>
                    {course.period}
                  </span>
                  <p className="mt-3 text-xs font-bold leading-5 text-slate-500">
                    {course.teachingWeeks} undervisningsuger
                    <br />
                    {course.estimatedLessons} lektioner
                  </p>
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500 lg:hidden">
                    Forløb
                  </p>
                  <div className={`mt-2 h-1.5 w-14 rounded-full ${accent.line}`} />
                  <h5 className={`mt-3 text-xl font-black tracking-tight text-slate-950 ${rubik.className}`}>
                    {course.title}
                  </h5>
                  {course.pauseNote ? (
                    <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-950">
                      {course.pauseNote}
                    </p>
                  ) : null}
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500 lg:hidden">
                    Mål
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-7 text-slate-700">{course.description}</p>
                  <p className="mt-3 text-sm font-bold leading-6 text-slate-800">Fokus: {course.focus}</p>
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500 lg:hidden">
                    Indhold og evaluering
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-7 text-slate-700">{course.activities}</p>
                  <p className="mt-3 text-sm font-bold leading-6 text-slate-800">
                    Produkt/evaluering: {course.product}
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-100 bg-[#faf7ef] px-5 py-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700">
                    <ImageIcon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                      Billede til årsplanen
                    </p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{course.imagePrompt}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      Billeder kan genereres i en senere version.
                    </p>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
