"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  BrainCircuit,
  Building2,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  ListChecks,
  Plus,
  School,
  Trash2,
  UserCheck,
} from "lucide-react";
import { useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";

import { SkemaPilotPreview } from "./SkemaPilotPreview";
import {
  SkemaPilotSubjectAssignment,
  buildSubjectAssignmentRows,
  formatLessonCount,
  getAvailableSubjectTeachers,
  getSubjectAssignmentStatus,
  getTeacherLoadStats,
  type SubjectAssignmentMap,
} from "./SkemaPilotSubjectAssignment";

type SchoolSettings = {
  schoolName: string;
  schoolYear: string;
  schoolType: string;
  schoolStructure: string;
  gradeFrom: string;
  gradeTo: string;
  lessonsPerDay: string;
  lessonMinutes: string;
  startTime: string;
  endTime: string;
};

type Teacher = {
  id: string;
  name: string;
  subjects: string;
  wishes: string;
};

type PriorityLevel = "Lav" | "Middel" | "Høj";

type WizardStep = {
  title: string;
  shortTitle: string;
  description: string;
  icon: ReactNode;
};

type SkemaPilotWizardProps = {
  poppinsClassName: string;
  rubikClassName: string;
};

const schoolYearOptions = ["2026/2027", "2027/2028", "2028/2029"] as const;
const schoolTypeOptions = ["Friskole", "Privatskole", "Lilleskole", "Anden fri grundskole"] as const;
const schoolStructureOptions = ["Et-sporet skole", "Andet / tilpasses senere"] as const;
const gradeOptions = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

const subjects = [
  "Dansk",
  "Matematik",
  "Engelsk",
  "Idræt",
  "Musik",
  "Billedkunst/krea",
  "Natur/teknologi",
] as const;

const specialRooms = ["Idrætshal", "Musik", "Billedkunst/krea", "Naturfag", "Madkundskab"] as const;
const fixedBlocks = [
  "Morgensamling",
  "Læsebånd",
  "Fællessamling",
  "Emneuge",
  "Svømning",
  "Konfirmationsforberedelse",
] as const;

const priorityLevels = ["Lav", "Middel", "Høj"] as const;
const priorityWishes = [
  "Dansk/matematik helst tidligt på dagen",
  "Idræt gerne som dobbeltlektion",
  "Kreative fag gerne som længere blokke",
  "Ikke for mange skift på én dag",
  "Lærere skal helst ikke have mange huller",
  "Yngre elever skal helst ikke have tunge fag sent",
  "Udskoling kan bedre tåle senere fag",
  "Klasselærer gerne tidligt på dagen",
  "Færre fag pr. dag i indskolingen",
] as const;

const wizardSteps: WizardStep[] = [
  {
    title: "Skolens rammer",
    shortTitle: "Rammer",
    description: "Sæt de grundlæggende rammer for skoleår, klassetrin og dagens struktur.",
    icon: <School className="h-5 w-5" />,
  },
  {
    title: "Klasser",
    shortTitle: "Klasser",
    description: "Vælg hvilke klassetrin der skal med i det første lokale skemaudkast.",
    icon: <ListChecks className="h-5 w-5" />,
  },
  {
    title: "Fag og lokalt timetal",
    shortTitle: "Timetal",
    description: "Angiv foreløbige lokale lektionstal pr. uge for fag og klasser.",
    icon: <BookOpen className="h-5 w-5" />,
  },
  {
    title: "Lærere",
    shortTitle: "Lærere",
    description: "Notér lærere, fagområder og enkle ønsker eller utilgængeligheder.",
    icon: <FileText className="h-5 w-5" />,
  },
  {
    title: "Fagfordeling",
    shortTitle: "Fagfordeling",
    description: "Fordel fag og klassers lektioner til lærere som et lokalt estimat.",
    icon: <UserCheck className="h-5 w-5" />,
  },
  {
    title: "Lokaler og faste blokke",
    shortTitle: "Lokaler",
    description: "Vælg speciallokaler og faste blokke, der senere skal respekteres.",
    icon: <Building2 className="h-5 w-5" />,
  },
  {
    title: "Skema-prioriteter",
    shortTitle: "Prioriteter",
    description: "Vægt de bløde pædagogiske ønsker, der senere skal løfte skemaets kvalitet.",
    icon: <BrainCircuit className="h-5 w-5" />,
  },
  {
    title: "Opsummering",
    shortTitle: "Opsummering",
    description: "Se setup, visuel kladde, lokale tjek og dialog-eksempler samlet.",
    icon: <Check className="h-5 w-5" />,
  },
];

const initialSettings: SchoolSettings = {
  schoolName: "",
  schoolYear: "2026/2027",
  schoolType: "Friskole",
  schoolStructure: "Et-sporet skole",
  gradeFrom: "0",
  gradeTo: "9",
  lessonsPerDay: "7",
  lessonMinutes: "45",
  startTime: "08:15",
  endTime: "14:00",
};

const initialTeachers: Teacher[] = [
  {
    id: "teacher-1",
    name: "",
    subjects: "",
    wishes: "",
  },
];

const inputClassName =
  "mt-2 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100";

const textareaClassName =
  "mt-2 min-h-24 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold leading-6 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100";

const buttonBaseClassName =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-black transition focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-50";

export function SkemaPilotWizard({ poppinsClassName, rubikClassName }: SkemaPilotWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [setupFinished, setSetupFinished] = useState(false);
  const [settings, setSettings] = useState<SchoolSettings>(initialSettings);
  const [classSelection, setClassSelection] = useState<Record<string, boolean>>({});
  const [lessonMatrix, setLessonMatrix] = useState<Record<string, Record<string, string>>>({});
  const [teachers, setTeachers] = useState<Teacher[]>(initialTeachers);
  const [subjectAssignments, setSubjectAssignments] = useState<SubjectAssignmentMap>({});
  const [roomSelection, setRoomSelection] = useState<Record<string, boolean>>({
    Idrætshal: true,
    Musik: true,
    "Billedkunst/krea": true,
    Naturfag: false,
    Madkundskab: false,
  });
  const [blockSelection, setBlockSelection] = useState<Record<string, boolean>>({
    Morgensamling: true,
    Læsebånd: true,
    Fællessamling: false,
    Emneuge: false,
    Svømning: false,
    Konfirmationsforberedelse: false,
  });
  const [extraBlockInput, setExtraBlockInput] = useState("");
  const [extraBlocks, setExtraBlocks] = useState<string[]>([]);
  const [priorities, setPriorities] = useState<Record<string, PriorityLevel>>(
    Object.fromEntries(priorityWishes.map((wish) => [wish, "Middel"])) as Record<string, PriorityLevel>,
  );

  const suggestedClasses = useMemo(() => {
    const from = Number(settings.gradeFrom);
    const to = Number(settings.gradeTo);
    const start = Math.min(from, to);
    const end = Math.max(from, to);

    return gradeOptions
      .map((grade) => Number(grade))
      .filter((grade) => grade >= start && grade <= end)
      .map((grade) => getClassLabel(String(grade)));
  }, [settings.gradeFrom, settings.gradeTo]);

  const activeClasses = suggestedClasses.filter((className) => classSelection[className] !== false);
  const activeRooms = specialRooms.filter((room) => roomSelection[room]);
  const activeBlocks = [...fixedBlocks.filter((block) => blockSelection[block]), ...extraBlocks];
  const activeStep = wizardSteps[currentStep];
  const subjectAssignmentRows = buildSubjectAssignmentRows(activeClasses, subjects, getLessonValue, subjectAssignments);
  const subjectAssignmentStatus = getSubjectAssignmentStatus(subjectAssignmentRows, teachers);

  function updateSettings<Key extends keyof SchoolSettings>(key: Key, value: SchoolSettings[Key]) {
    setSettings((previous) => ({
      ...previous,
      [key]: value,
    }));
  }

  function getLessonValue(className: string, subject: string) {
    return lessonMatrix[className]?.[subject] ?? getDefaultLessonCount(className, subject);
  }

  function updateLessonValue(className: string, subject: string, value: string) {
    setLessonMatrix((previous) => ({
      ...previous,
      [className]: {
        ...previous[className],
        [subject]: value,
      },
    }));
  }

  function updateSubjectAssignment(assignmentKey: string, teacherId: string) {
    setSubjectAssignments((previous) => {
      const nextAssignments = { ...previous };

      if (teacherId) {
        nextAssignments[assignmentKey] = teacherId;
      } else {
        delete nextAssignments[assignmentKey];
      }

      return nextAssignments;
    });
  }

  function updateTeacher(teacherId: string, key: keyof Omit<Teacher, "id">, value: string) {
    setTeachers((previous) =>
      previous.map((teacher) => (teacher.id === teacherId ? { ...teacher, [key]: value } : teacher)),
    );
  }

  function addTeacher() {
    setTeachers((previous) => [
      ...previous,
      {
        id: `teacher-${Date.now()}`,
        name: "",
        subjects: "",
        wishes: "",
      },
    ]);
  }

  function removeTeacher(teacherId: string) {
    setTeachers((previous) => (previous.length === 1 ? previous : previous.filter((teacher) => teacher.id !== teacherId)));
  }

  function addExtraBlock() {
    const trimmed = extraBlockInput.trim();

    if (!trimmed) {
      return;
    }

    setExtraBlocks((previous) => (previous.includes(trimmed) ? previous : [...previous, trimmed]));
    setExtraBlockInput("");
  }

  function goToStep(stepIndex: number) {
    setCurrentStep(stepIndex);
    setSetupFinished(false);
  }

  function goNext() {
    setCurrentStep((step) => Math.min(wizardSteps.length - 1, step + 1));
    setSetupFinished(false);
  }

  function goBack() {
    setCurrentStep((step) => Math.max(0, step - 1));
    setSetupFinished(false);
  }

  return (
    <main
      className={`min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.2),transparent_34%),linear-gradient(135deg,#0f172a_0%,#12332d_44%,#1f2937_100%)] text-slate-950 ${poppinsClassName}`}
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
          <div className="hidden min-h-11 items-center gap-2 rounded-lg border border-amber-200/35 bg-amber-200/10 px-4 py-2 text-sm font-bold text-amber-50 shadow-sm backdrop-blur sm:inline-flex">
            <CalendarClock className="h-4 w-4" />
            Prototype
          </div>
        </header>

        <section className="pt-10 text-white lg:pt-12">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="inline-flex rounded-lg border border-amber-200/35 bg-amber-200/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-amber-50 shadow-sm backdrop-blur">
                Under opbygning
              </p>
              <h1 className={`mt-5 text-5xl font-black tracking-tight md:text-7xl ${rubikClassName}`}>
                SkemaPilot
              </h1>
              <p className="mt-5 max-w-2xl text-xl font-semibold leading-8 text-slate-100">
                SkemaPilot hjælper små skoler med at lave skemaer, der både går op og giver pædagogisk mening.
              </p>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                Denne lokale prototype samler skolens rammer, fagfordeling, en visuel kladde, lokale tjek,
                kvalitetsscore og dialog-eksempler. Data bliver i browseren, og der er ingen skemagenerator
                eller AI-forbindelse.
              </p>
            </div>

            <div className="rounded-lg border border-white/15 bg-slate-950/60 p-4 shadow-sm backdrop-blur">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">Aktivt trin</p>
              <p className={`mt-2 text-2xl font-black tracking-tight text-white ${rubikClassName}`}>
                {currentStep + 1}. {activeStep.title}
              </p>
              <p className="mt-2 max-w-sm text-sm font-semibold leading-6 text-slate-300">{activeStep.description}</p>
            </div>
          </div>

          <nav className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8" aria-label="SkemaPilot trin">
            {wizardSteps.map((step, index) => {
              const isCurrent = index === currentStep;
              const isComplete = index < currentStep;

              return (
                <button
                  key={step.title}
                  type="button"
                  onClick={() => goToStep(index)}
                  className={`min-h-20 rounded-lg border px-4 py-3 text-left shadow-sm transition focus-visible:outline-none focus-visible:ring-4 ${
                    isCurrent
                      ? "border-emerald-200 bg-white text-slate-950 focus-visible:ring-emerald-100"
                      : isComplete
                        ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-50 focus-visible:ring-emerald-300/20"
                        : "border-white/15 bg-slate-950/45 text-slate-200 hover:border-white/30 focus-visible:ring-white/10"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        isCurrent
                          ? "bg-emerald-600 text-white"
                          : isComplete
                            ? "bg-emerald-300/20 text-emerald-50"
                            : "bg-white/10 text-slate-200"
                      }`}
                    >
                      {isComplete ? <Check className="h-4 w-4" /> : step.icon}
                    </span>
                    <span className="text-xs font-black uppercase tracking-[0.12em]">Trin {index + 1}</span>
                  </span>
                  <span className={`mt-3 block text-base font-black tracking-tight ${rubikClassName}`}>
                    {step.shortTitle}
                  </span>
                </button>
              );
            })}
          </nav>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
          <article className="rounded-lg border border-white/70 bg-white p-5 shadow-[0_24px_70px_rgba(15,23,42,0.18)] md:p-7">
            <StepHeader
              description={activeStep.description}
              icon={activeStep.icon}
              label={`Trin ${currentStep + 1} af ${wizardSteps.length}`}
              rubikClassName={rubikClassName}
              title={activeStep.title}
            />

            <div className="mt-8">
              {currentStep === 0 ? (
                <SchoolSettingsStep
                  rubikClassName={rubikClassName}
                  settings={settings}
                  onUpdateSettings={updateSettings}
                />
              ) : null}
              {currentStep === 1 ? (
                <ClassesStep
                  activeClasses={activeClasses}
                  classSelection={classSelection}
                  suggestedClasses={suggestedClasses}
                  onToggleClass={(className) =>
                    setClassSelection((previous) => ({
                      ...previous,
                      [className]: previous[className] === false,
                    }))
                  }
                />
              ) : null}
              {currentStep === 2 ? (
                <LessonMatrixStep
                  activeClasses={activeClasses}
                  getLessonValue={getLessonValue}
                  onUpdateLessonValue={updateLessonValue}
                />
              ) : null}
              {currentStep === 3 ? (
                <TeachersStep
                  teachers={teachers}
                  onAddTeacher={addTeacher}
                  onRemoveTeacher={removeTeacher}
                  onUpdateTeacher={updateTeacher}
                />
              ) : null}
              {currentStep === 4 ? (
                <SkemaPilotSubjectAssignment
                  activeClasses={activeClasses}
                  getLessonValue={getLessonValue}
                  rubikClassName={rubikClassName}
                  subjectAssignments={subjectAssignments}
                  subjects={subjects}
                  teachers={teachers}
                  onUpdateAssignment={updateSubjectAssignment}
                />
              ) : null}
              {currentStep === 5 ? (
                <RoomsAndBlocksStep
                  activeBlocks={activeBlocks}
                  activeRooms={activeRooms}
                  blockSelection={blockSelection}
                  extraBlockInput={extraBlockInput}
                  extraBlocks={extraBlocks}
                  roomSelection={roomSelection}
                  onAddExtraBlock={addExtraBlock}
                  onExtraBlockInputChange={setExtraBlockInput}
                  onRemoveExtraBlock={(block) =>
                    setExtraBlocks((previous) => previous.filter((existingBlock) => existingBlock !== block))
                  }
                  onToggleBlock={(block) =>
                    setBlockSelection((previous) => ({
                      ...previous,
                      [block]: !previous[block],
                    }))
                  }
                  onToggleRoom={(room) =>
                    setRoomSelection((previous) => ({
                      ...previous,
                      [room]: !previous[room],
                    }))
                  }
                />
              ) : null}
              {currentStep === 6 ? (
                <PrioritiesStep priorities={priorities} onUpdatePriority={setPriorities} />
              ) : null}
              {currentStep === 7 ? (
                <SummaryStep
                  activeBlocks={activeBlocks}
                  activeClasses={activeClasses}
                  activeRooms={activeRooms}
                  getLessonValue={getLessonValue}
                  priorities={priorities}
                  rubikClassName={rubikClassName}
                  settings={settings}
                  setupFinished={setupFinished}
                  subjectAssignments={subjectAssignments}
                  teachers={teachers}
                />
              ) : null}
            </div>

            <div className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                disabled={currentStep === 0}
                onClick={goBack}
                className={`${buttonBaseClassName} border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-950 focus-visible:ring-slate-100`}
              >
                <ChevronLeft className="h-4 w-4" />
                Tilbage
              </button>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  disabled
                  className={`${buttonBaseClassName} border border-slate-200 bg-slate-50 text-slate-500 focus-visible:ring-slate-100`}
                >
                  Gem lokalt som kladde
                  <span className="text-xs font-black uppercase tracking-[0.12em]">Prototype</span>
                </button>
                {currentStep < wizardSteps.length - 1 ? (
                  <button
                    type="button"
                    onClick={goNext}
                    className={`${buttonBaseClassName} border border-slate-950 bg-slate-950 text-white shadow-sm hover:bg-slate-800 focus-visible:ring-slate-200`}
                  >
                    Næste
                    <ChevronRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSetupFinished(true)}
                    className={`${buttonBaseClassName} border border-emerald-700 bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 focus-visible:ring-emerald-100`}
                  >
                    Afslut opsætning
                    <Check className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </article>

          <aside className="h-fit rounded-lg border border-white/15 bg-slate-950/60 p-5 text-white shadow-sm backdrop-blur">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">Lokalt overblik</p>
            <div className="mt-4 grid gap-3">
              <SummaryMiniRow label="Skole" value={settings.schoolName || "Ikke navngivet endnu"} />
              <SummaryMiniRow label="Skoleår" value={settings.schoolYear} />
              <SummaryMiniRow label="Klasser" value={`${activeClasses.length} aktive`} />
              <SummaryMiniRow label="Lærere" value={`${teachers.length} lokale input`} />
              <SummaryMiniRow
                label="Fagfordeling"
                value={`${subjectAssignmentStatus.assignedItems}/${subjectAssignmentStatus.totalItems} fordelt`}
              />
              <SummaryMiniRow label="Lokaler" value={`${activeRooms.length} valgt`} />
              <SummaryMiniRow label="Faste blokke" value={`${activeBlocks.length} valgt`} />
            </div>
            <div className="mt-5 rounded-lg border border-amber-200/30 bg-amber-200/10 p-4 text-sm font-bold leading-6 text-amber-50">
              Prototypen viser arbejdsflowet lokalt. Den gemmer ikke data på en server og bygger ikke et
              færdigt skema.
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function SchoolSettingsStep({
  rubikClassName,
  settings,
  onUpdateSettings,
}: {
  rubikClassName: string;
  settings: SchoolSettings;
  onUpdateSettings: <Key extends keyof SchoolSettings>(key: Key, value: SchoolSettings[Key]) => void;
}) {
  return (
    <div className="grid gap-6">
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Skolens navn">
          <input
            className={inputClassName}
            value={settings.schoolName}
            placeholder="Fx Bakkely Friskole"
            onChange={(event) => onUpdateSettings("schoolName", event.target.value)}
          />
        </Field>
        <Field label="Skoleår">
          <select
            className={inputClassName}
            value={settings.schoolYear}
            onChange={(event) => onUpdateSettings("schoolYear", event.target.value)}
          >
            {schoolYearOptions.map((schoolYear) => (
              <option key={schoolYear} value={schoolYear}>
                {schoolYear}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <SegmentedField
        label="Skoleform"
        options={schoolTypeOptions}
        value={settings.schoolType}
        onChange={(value) => onUpdateSettings("schoolType", value)}
      />
      <SegmentedField
        label="Skolestruktur"
        options={schoolStructureOptions}
        value={settings.schoolStructure}
        onChange={(value) => onUpdateSettings("schoolStructure", value)}
      />

      <section className="rounded-lg border border-slate-200 bg-slate-50 p-5">
        <h3 className={`text-2xl font-black tracking-tight text-slate-950 ${rubikClassName}`}>Klassetrin og dag</h3>
        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Klassetrin fra">
            <select
              className={inputClassName}
              value={settings.gradeFrom}
              onChange={(event) => onUpdateSettings("gradeFrom", event.target.value)}
            >
              {gradeOptions.map((grade) => (
                <option key={grade} value={grade}>
                  {getClassLabel(grade)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Klassetrin til">
            <select
              className={inputClassName}
              value={settings.gradeTo}
              onChange={(event) => onUpdateSettings("gradeTo", event.target.value)}
            >
              {gradeOptions.map((grade) => (
                <option key={grade} value={grade}>
                  {getClassLabel(grade)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Antal lektioner pr. dag">
            <input
              className={inputClassName}
              min="1"
              type="number"
              value={settings.lessonsPerDay}
              onChange={(event) => onUpdateSettings("lessonsPerDay", event.target.value)}
            />
          </Field>
          <Field label="Lektionens længde i minutter">
            <input
              className={inputClassName}
              min="15"
              step="5"
              type="number"
              value={settings.lessonMinutes}
              onChange={(event) => onUpdateSettings("lessonMinutes", event.target.value)}
            />
          </Field>
          <Field label="Starttidspunkt">
            <input
              className={inputClassName}
              type="time"
              value={settings.startTime}
              onChange={(event) => onUpdateSettings("startTime", event.target.value)}
            />
          </Field>
          <Field label="Sluttidspunkt">
            <input
              className={inputClassName}
              type="time"
              value={settings.endTime}
              onChange={(event) => onUpdateSettings("endTime", event.target.value)}
            />
          </Field>
        </div>
      </section>
    </div>
  );
}

function ClassesStep({
  activeClasses,
  classSelection,
  suggestedClasses,
  onToggleClass,
}: {
  activeClasses: string[];
  classSelection: Record<string, boolean>;
  suggestedClasses: string[];
  onToggleClass: (className: string) => void;
}) {
  return (
    <div>
      <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold leading-6 text-emerald-950">
        Forslagene kommer direkte fra de valgte klassetrin. Slå klasser fra, hvis de ikke skal med i dette
        lokale setup.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {suggestedClasses.map((className) => {
          const isActive = classSelection[className] !== false;

          return (
            <button
              key={className}
              type="button"
              onClick={() => onToggleClass(className)}
              className={`flex min-h-16 items-center justify-between rounded-lg border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-4 ${
                isActive
                  ? "border-emerald-200 bg-emerald-50 text-emerald-950 focus-visible:ring-emerald-100"
                  : "border-slate-200 bg-white text-slate-500 focus-visible:ring-slate-100"
              }`}
            >
              <span className="text-lg font-black">{className}</span>
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-md border ${
                  isActive ? "border-emerald-300 bg-emerald-600 text-white" : "border-slate-200 bg-slate-50"
                }`}
              >
                {isActive ? <Check className="h-4 w-4" /> : null}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-5 text-sm font-bold text-slate-600">{activeClasses.length} klasser er aktive i opsætningen.</p>
    </div>
  );
}

function LessonMatrixStep({
  activeClasses,
  getLessonValue,
  onUpdateLessonValue,
}: {
  activeClasses: string[];
  getLessonValue: (className: string, subject: string) => string;
  onUpdateLessonValue: (className: string, subject: string, value: string) => void;
}) {
  return (
    <div>
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-950">
        Lokalt timetal – kan senere sammenholdes med ministeriets timetalsoversigt.
        <span className="mt-2 block font-semibold">
          SkemaPilot kan senere hjælpe med at sammenholde skolens lokale timetal med ministeriets
          timetalsoversigter. Frie skoler har egne rammer og skal altid vurdere skemaet lokalt.
        </span>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[860px] border-collapse text-left">
          <thead>
            <tr className="bg-slate-100 text-xs font-black uppercase tracking-[0.12em] text-slate-600">
              <th className="w-40 border-b border-slate-200 px-4 py-3">Fag</th>
              {activeClasses.map((className) => (
                <th key={className} className="border-b border-slate-200 px-3 py-3">
                  {className}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {subjects.map((subject) => (
              <tr key={subject} className="border-b border-slate-100 last:border-b-0">
                <th className="bg-slate-50 px-4 py-3 text-sm font-black text-slate-800">{subject}</th>
                {activeClasses.map((className) => (
                  <td key={`${className}-${subject}`} className="px-3 py-3">
                    <input
                      aria-label={`${subject} lektioner pr. uge i ${className}`}
                      className="min-h-10 w-20 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                      min="0"
                      step="0.5"
                      type="number"
                      value={getLessonValue(className, subject)}
                      onChange={(event) => onUpdateLessonValue(className, subject, event.target.value)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TeachersStep({
  teachers,
  onAddTeacher,
  onRemoveTeacher,
  onUpdateTeacher,
}: {
  teachers: Teacher[];
  onAddTeacher: () => void;
  onRemoveTeacher: (teacherId: string) => void;
  onUpdateTeacher: (teacherId: string, key: keyof Omit<Teacher, "id">, value: string) => void;
}) {
  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm font-semibold leading-7 text-slate-600">
          Tilføj lærere lokalt med fagområder og enkle ønsker. Næste trin bruger listen til fagfordeling.
        </p>
        <button
          type="button"
          onClick={onAddTeacher}
          className={`${buttonBaseClassName} border border-emerald-200 bg-emerald-50 text-emerald-900 hover:border-emerald-300 focus-visible:ring-emerald-100`}
        >
          <Plus className="h-4 w-4" />
          Tilføj lærer
        </button>
      </div>

      <div className="mt-6 grid gap-4">
        {teachers.map((teacher, index) => (
          <section key={teacher.id} className="rounded-lg border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-lg font-black text-slate-950">Lærer {index + 1}</h3>
              <button
                type="button"
                disabled={teachers.length === 1}
                onClick={() => onRemoveTeacher(teacher.id)}
                className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-500 transition hover:border-rose-200 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Fjern
              </button>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Navn">
                <input
                  className={inputClassName}
                  value={teacher.name}
                  placeholder="Fx Jeppe"
                  onChange={(event) => onUpdateTeacher(teacher.id, "name", event.target.value)}
                />
              </Field>
              <Field label="Fagområder">
                <input
                  className={inputClassName}
                  value={teacher.subjects}
                  placeholder="Fx dansk, historie, idræt"
                  onChange={(event) => onUpdateTeacher(teacher.id, "subjects", event.target.value)}
                />
              </Field>
            </div>
            <Field label="Utilgængelighed/ønsker">
              <textarea
                className={textareaClassName}
                value={teacher.wishes}
                placeholder="Fx kan ikke onsdag eftermiddag"
                onChange={(event) => onUpdateTeacher(teacher.id, "wishes", event.target.value)}
              />
            </Field>
          </section>
        ))}
      </div>
    </div>
  );
}

function RoomsAndBlocksStep({
  activeBlocks,
  activeRooms,
  blockSelection,
  extraBlockInput,
  extraBlocks,
  roomSelection,
  onAddExtraBlock,
  onExtraBlockInputChange,
  onRemoveExtraBlock,
  onToggleBlock,
  onToggleRoom,
}: {
  activeBlocks: string[];
  activeRooms: readonly string[];
  blockSelection: Record<string, boolean>;
  extraBlockInput: string;
  extraBlocks: string[];
  roomSelection: Record<string, boolean>;
  onAddExtraBlock: () => void;
  onExtraBlockInputChange: (value: string) => void;
  onRemoveExtraBlock: (block: string) => void;
  onToggleBlock: (block: string) => void;
  onToggleRoom: (room: string) => void;
}) {
  return (
    <div className="grid gap-8">
      <ToggleGroup
        description="Speciallokalerne bliver senere brugt som hårde ressourcer, der ikke må dobbeltbookes."
        items={specialRooms}
        selection={roomSelection}
        title="Speciallokaler"
        onToggle={onToggleRoom}
      />
      <ToggleGroup
        description="Faste blokke er lokale aftaler, som en senere skemabygger skal respektere."
        items={fixedBlocks}
        selection={blockSelection}
        title="Faste blokke"
        onToggle={onToggleBlock}
      />

      <section className="rounded-lg border border-slate-200 bg-slate-50 p-5">
        <h3 className="text-lg font-black text-slate-950">Ekstra fast blok</h3>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            className={`${inputClassName} mt-0`}
            value={extraBlockInput}
            placeholder="Fx personalemøde hver tirsdag"
            onChange={(event) => onExtraBlockInputChange(event.target.value)}
          />
          <button
            type="button"
            onClick={onAddExtraBlock}
            className={`${buttonBaseClassName} border border-slate-950 bg-slate-950 text-white hover:bg-slate-800 focus-visible:ring-slate-200`}
          >
            <Plus className="h-4 w-4" />
            Tilføj
          </button>
        </div>

        {extraBlocks.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {extraBlocks.map((block) => (
              <button
                key={block}
                type="button"
                onClick={() => onRemoveExtraBlock(block)}
                className="inline-flex min-h-10 max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm font-bold text-slate-700 transition hover:border-rose-200 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-100"
              >
                <span className="min-w-0 break-words">{block}</span>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <div className="grid gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-950 sm:grid-cols-2">
        <p>{activeRooms.length} speciallokaler valgt.</p>
        <p>{activeBlocks.length} faste blokke valgt.</p>
      </div>
    </div>
  );
}

function PrioritiesStep({
  priorities,
  onUpdatePriority,
}: {
  priorities: Record<string, PriorityLevel>;
  onUpdatePriority: Dispatch<SetStateAction<Record<string, PriorityLevel>>>;
}) {
  return (
    <div>
      <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold leading-6 text-emerald-950">
        Disse valg bliver senere brugt til at give skemaet en pædagogisk kvalitetsscore.
      </p>
      <div className="mt-6 grid gap-4">
        {priorityWishes.map((wish) => (
          <section key={wish} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-sm font-black leading-6 text-slate-900">{wish}</p>
              <div className="grid grid-cols-3 gap-2 sm:w-[320px]">
                {priorityLevels.map((level) => {
                  const isSelected = priorities[wish] === level;

                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() =>
                        onUpdatePriority((previous) => ({
                          ...previous,
                          [wish]: level,
                        }))
                      }
                      className={`min-h-10 rounded-lg border px-3 py-2 text-sm font-black transition focus-visible:outline-none focus-visible:ring-4 ${
                        isSelected
                          ? "border-emerald-300 bg-emerald-600 text-white focus-visible:ring-emerald-100"
                          : "border-slate-200 bg-white text-slate-600 hover:border-emerald-200 focus-visible:ring-slate-100"
                      }`}
                    >
                      {level}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function SummaryStep({
  activeBlocks,
  activeClasses,
  activeRooms,
  getLessonValue,
  priorities,
  rubikClassName,
  settings,
  setupFinished,
  subjectAssignments,
  teachers,
}: {
  activeBlocks: string[];
  activeClasses: string[];
  activeRooms: readonly string[];
  getLessonValue: (className: string, subject: string) => string;
  priorities: Record<string, PriorityLevel>;
  rubikClassName: string;
  settings: SchoolSettings;
  setupFinished: boolean;
  subjectAssignments: SubjectAssignmentMap;
  teachers: Teacher[];
}) {
  const filledTeachers = teachers.filter((teacher) => teacher.name.trim() || teacher.subjects.trim() || teacher.wishes.trim());
  const subjectAssignmentRows = buildSubjectAssignmentRows(activeClasses, subjects, getLessonValue, subjectAssignments);
  const subjectAssignmentStatus = getSubjectAssignmentStatus(subjectAssignmentRows, teachers);
  const availableTeacherIds = new Set(getAvailableSubjectTeachers(teachers).map((teacher) => teacher.id));
  const missingSubjectAssignments = subjectAssignmentRows.filter(
    (row) => !row.teacherId || !availableTeacherIds.has(row.teacherId),
  );
  const teacherLoads = getTeacherLoadStats(subjectAssignmentRows, teachers);

  return (
    <div className="grid gap-6">
      {setupFinished ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold leading-6 text-emerald-950">
          Opsætningen er afsluttet lokalt i prototypen. Der er stadig ikke gemt data på en server.
        </div>
      ) : null}

      <div>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Lokalt setup</p>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
          De vigtigste rammer vises først, så preview og lokale tjek kan læses i sammenhæng.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SummaryCard title="Skole">
          <SummaryLine label="Navn" value={settings.schoolName || "Ikke angivet"} />
          <SummaryLine label="Skoleår" value={settings.schoolYear} />
          <SummaryLine label="Skoleform" value={settings.schoolType} />
          <SummaryLine label="Struktur" value={settings.schoolStructure} />
          <SummaryLine
            label="Dag"
            value={`${settings.startTime}-${settings.endTime}, ${settings.lessonsPerDay} lektioner a ${settings.lessonMinutes} min.`}
          />
        </SummaryCard>

        <SummaryCard title="Aktive klasser">
          <TagList items={activeClasses} emptyText="Ingen klasser valgt" />
        </SummaryCard>

        <SummaryCard title="Lokaler">
          <TagList items={activeRooms} emptyText="Ingen speciallokaler valgt" />
        </SummaryCard>

        <SummaryCard title="Faste blokke">
          <TagList items={activeBlocks} emptyText="Ingen faste blokke valgt" />
        </SummaryCard>
      </div>

      <SummaryCard title="Fag og lokalt timetal">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
          Bred tabel - scroll vandret på små skærme
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                <th className="border-b border-slate-200 px-3 py-2">Fag</th>
                {activeClasses.map((className) => (
                  <th key={className} className="border-b border-slate-200 px-3 py-2">
                    {className}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {subjects.map((subject) => (
                <tr key={subject} className="border-b border-slate-100 last:border-b-0">
                  <th className="px-3 py-2 text-sm font-black text-slate-800">{subject}</th>
                  {activeClasses.map((className) => (
                    <td key={`${className}-${subject}`} className="px-3 py-2 text-sm font-bold text-slate-600">
                      {getLessonValue(className, subject)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SummaryCard>

      <SummaryCard title="Lærere">
        {filledTeachers.length ? (
          <div className="grid gap-3">
            {filledTeachers.map((teacher) => (
              <div key={teacher.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="font-black text-slate-950">{teacher.name || "Unavngiven lærer"}</p>
                <p className="mt-1 text-sm font-semibold text-slate-600">{teacher.subjects || "Fagområder ikke angivet"}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {teacher.wishes || "Ingen utilgængelighed eller ønsker angivet."}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm font-semibold text-slate-500">Ingen læreroplysninger angivet endnu.</p>
        )}
      </SummaryCard>

      <SummaryCard title="Fagfordeling">
        <div className="grid gap-3 md:grid-cols-4">
          <SummaryMetric label="Fagposter" value={String(subjectAssignmentStatus.totalItems)} />
          <SummaryMetric label="Fordelt" value={String(subjectAssignmentStatus.assignedItems)} />
          <SummaryMetric label="Mangler" value={String(subjectAssignmentStatus.missingItems)} />
          <SummaryMetric label="Klar" value={`${subjectAssignmentStatus.completionPercentage} %`} />
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950">
            <p className="text-xs font-black uppercase tracking-[0.14em]">Mangler lærer</p>
            {missingSubjectAssignments.length ? (
              <div className="mt-3 grid gap-2">
                {missingSubjectAssignments.slice(0, 8).map((row) => (
                  <p key={row.assignmentKey} className="text-sm font-bold leading-6">
                    {row.className}: {row.subject} ({formatLessonCount(row.lessons)} lektioner/uge)
                  </p>
                ))}
                {missingSubjectAssignments.length > 8 ? (
                  <p className="text-xs font-black uppercase tracking-[0.12em] opacity-75">
                    +{missingSubjectAssignments.length - 8} flere fagposter
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-sm font-bold leading-6">Alle relevante fagposter er fordelt til lærere.</p>
            )}
          </section>

          <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
            <p className="text-xs font-black uppercase tracking-[0.14em]">Lærerbelastning</p>
            {teacherLoads.length ? (
              <div className="mt-3 grid gap-2">
                {teacherLoads.map((load) => (
                  <p key={load.teacherId} className="flex justify-between gap-3 text-sm font-bold leading-6">
                    <span className="min-w-0 break-words">{load.teacherName}</span>
                    <span className="shrink-0">{formatLessonCount(load.lessons)} lektioner/uge</span>
                  </p>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm font-bold leading-6">
                Lærerbelastning vises, når der er navngivne lærere.
              </p>
            )}
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] opacity-75">Lokalt estimat</p>
          </section>
        </div>
      </SummaryCard>

      <SummaryCard title="Skema-prioriteter">
        <div className="grid gap-2 md:grid-cols-2">
          {priorityWishes.map((wish) => (
            <p key={wish} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <span className="font-black text-slate-950">{priorities[wish]}:</span>{" "}
              <span className="font-semibold">{wish}</span>
            </p>
          ))}
        </div>
      </SummaryCard>

      <div>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Visuel kladde og lokale tjek</p>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
          Herunder vises skema-preview, konflikttjek, kvalitetsscore og dialogprototype som samlede
          prototypeelementer.
        </p>
      </div>

      <SkemaPilotPreview
        activeBlocks={activeBlocks}
        activeClasses={activeClasses}
        activeRooms={activeRooms}
        getLessonValue={getLessonValue}
        priorities={priorities}
        rubikClassName={rubikClassName}
        settings={settings}
        subjectAssignments={subjectAssignments}
        subjectAssignmentStatus={subjectAssignmentStatus}
        subjects={subjects}
        teachers={teachers}
        teacherLoads={teacherLoads}
      />

      <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Status</p>
        <h3 className={`mt-2 text-2xl font-black tracking-tight text-emerald-950 ${rubikClassName}`}>
          Klar som lokal prototype
        </h3>
        <p className="mt-3 text-sm font-bold leading-7 text-emerald-950">
          SkemaPilot viser nu et samlet lokalt forløb fra setup til fagfordeling, visuel kladde, konflikttjek,
          kvalitetsscore og dialog-eksempler. Der er stadig ingen skemagenerator, AI-forbindelse eller
          automatisk flytning af lektioner.
        </p>
      </section>
    </div>
  );
}

function StepHeader({
  description,
  icon,
  label,
  rubikClassName,
  title,
}: {
  description: string;
  icon: ReactNode;
  label: string;
  rubikClassName: string;
  title: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
        {icon}
      </span>
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">{label}</p>
        <h2 className={`mt-2 text-3xl font-black tracking-tight text-slate-950 md:text-4xl ${rubikClassName}`}>
          {title}
        </h2>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-slate-600">{description}</p>
      </div>
    </div>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="block">
      <span className="text-sm font-black text-slate-950">{label}</span>
      {children}
    </label>
  );
}

function SegmentedField({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <section>
      <p className="text-sm font-black text-slate-950">{label}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {options.map((option) => {
          const isSelected = value === option;

          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={`min-h-11 rounded-lg border px-3 py-2 text-sm font-black transition focus-visible:outline-none focus-visible:ring-4 ${
                isSelected
                  ? "border-emerald-300 bg-emerald-600 text-white focus-visible:ring-emerald-100"
                  : "border-slate-200 bg-white text-slate-700 hover:border-emerald-200 focus-visible:ring-slate-100"
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ToggleGroup({
  description,
  items,
  selection,
  title,
  onToggle,
}: {
  description: string;
  items: readonly string[];
  selection: Record<string, boolean>;
  title: string;
  onToggle: (item: string) => void;
}) {
  return (
    <section>
      <h3 className="text-lg font-black text-slate-950">{title}</h3>
      <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{description}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const isSelected = Boolean(selection[item]);

          return (
            <button
              key={item}
              type="button"
              onClick={() => onToggle(item)}
              className={`flex min-h-12 items-center justify-between rounded-lg border px-3 py-2 text-sm font-black transition focus-visible:outline-none focus-visible:ring-4 ${
                isSelected
                  ? "border-emerald-200 bg-emerald-50 text-emerald-950 focus-visible:ring-emerald-100"
                  : "border-slate-200 bg-white text-slate-600 focus-visible:ring-slate-100"
              }`}
            >
              {item}
              <span
                className={`ml-3 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
                  isSelected ? "border-emerald-300 bg-emerald-600 text-white" : "border-slate-200 bg-slate-50"
                }`}
              >
                {isSelected ? <Check className="h-4 w-4" /> : null}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function SummaryMiniRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/10 p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-300">{label}</p>
      <p className="mt-1 break-words text-sm font-black text-white">{value}</p>
    </div>
  );
}

function SummaryCard({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-black text-slate-950">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <p className="break-words border-t border-slate-100 py-2 text-sm leading-6 first:border-t-0 first:pt-0">
      <span className="font-black text-slate-950">{label}:</span>{" "}
      <span className="font-semibold text-slate-600">{value}</span>
    </p>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function TagList({ emptyText, items }: { emptyText: string; items: readonly string[] }) {
  if (!items.length) {
    return <p className="text-sm font-semibold text-slate-500">{emptyText}</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className="max-w-full break-words rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function getClassLabel(grade: string) {
  return `${grade}. klasse`;
}

function getDefaultLessonCount(className: string, subject: string) {
  const grade = Number.parseInt(className, 10);

  if (subject === "Dansk") {
    return grade <= 3 ? "7" : "5";
  }

  if (subject === "Matematik") {
    return grade <= 3 ? "5" : "4";
  }

  if (subject === "Engelsk") {
    return grade <= 2 ? "1" : "3";
  }

  if (subject === "Idræt") {
    return "2";
  }

  if (subject === "Natur/teknologi") {
    return grade >= 1 && grade <= 6 ? "2" : "0";
  }

  return grade <= 3 ? "1" : "2";
}
