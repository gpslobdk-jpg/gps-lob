"use client";

import { ArrowLeft, Check, Loader2, MapPin, Minus, Plus, Sparkles, Wand2 } from "lucide-react";
import Link from "next/link";
import { poppins, rubik } from "@/lib/fonts";
import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { RACE_TYPES } from "@/utils/gpsRuns";
import { markDraftForAutoload, writeRunDraft } from "@/utils/runDrafts";
import type { GradeLevel } from "@/utils/gradeLevels";

const MANUEL_DRAFT_STORAGE_KEY = "draft_run_manuel";
const DEFAULT_CENTER = { lat: 55.6761, lng: 12.5683 } as const;
const DEFAULT_RUN_RADIUS = 15;
const MIN_POST_COUNT = 3;
const MAX_POST_COUNT = 15;
const DEFAULT_POST_COUNT = 6;
const DEFAULT_POINTS = 10;
const AUTOLOAD_DRAFT_FLAG_KEY = "autoLoadDraft";
const AUTOLOAD_DRAFT_TARGET_KEY = "autoLoadDraftTarget";

type Center = {
  lat: number;
  lng: number;
};

type GradeChoiceId = "3-4" | "5-6" | "7-8" | "9" | "other";
type QuestionStyle = "quiz" | "mixed" | "movement";

type GradeOption = {
  id: GradeChoiceId;
  label: string;
  gradeLevels: GradeLevel[];
  helper: string;
};

type QuestionStyleOption = {
  id: QuestionStyle;
  label: string;
  helper: string;
};

type ManualDraftQuestion = {
  id: string;
  type: "multiple_choice";
  text: string;
  aiPrompt: "";
  mediaUrl: "";
  answers: [string, string, string, string];
  correctIndex: number;
  points: number;
  lat: number;
  lng: number;
};

type LynbyggerDraft = {
  title: string;
  description: string;
  subject: string;
  gradeLevels: GradeLevel[];
  radius: number;
  showTeacherField: boolean;
  showAiInterviewModal: false;
  mapCenter: Center;
  overrideRaceType: typeof RACE_TYPES.MANUEL;
  questions: ManualDraftQuestion[];
};

const GRADE_OPTIONS: GradeOption[] = [
  {
    id: "3-4",
    label: "3.-4. klasse",
    gradeLevels: ["3. klasse", "4. klasse"],
    helper: "Korte spørgsmål med konkrete eksempler.",
  },
  {
    id: "5-6",
    label: "5.-6. klasse",
    gradeLevels: ["5. klasse", "6. klasse"],
    helper: "Lidt mere fagligt sprog og tydelige begreber.",
  },
  {
    id: "7-8",
    label: "7.-8. klasse",
    gradeLevels: ["7. klasse", "8. klasse"],
    helper: "Mere refleksion og stærkere distraktorer.",
  },
  {
    id: "9",
    label: "9. klasse",
    gradeLevels: ["9. klasse"],
    helper: "Kort, præcist og med højere faglig forventning.",
  },
  {
    id: "other",
    label: "Valgfrit/andet",
    gradeLevels: [],
    helper: "Neutral sværhedsgrad, som kan rettes bagefter.",
  },
];

const QUESTION_STYLE_OPTIONS: QuestionStyleOption[] = [
  {
    id: "quiz",
    label: "Quiz med 4 svarmuligheder",
    helper: "Klassiske multiple-choice poster.",
  },
  {
    id: "mixed",
    label: "Blandede korte spørgsmål",
    helper: "Variation i vinkel og formulering.",
  },
  {
    id: "movement",
    label: "Bevægelse + fag",
    helper: "Spørgsmål med små aktive observationer.",
  },
];

const inputClass =
  "w-full rounded-2xl border border-cyan-200/20 bg-slate-950/42 px-4 py-3 text-white placeholder:text-white/35 outline-none transition focus:border-cyan-200/55 focus:ring-2 focus:ring-cyan-300/20";

function getGradeOption(id: GradeChoiceId) {
  return GRADE_OPTIONS.find((option) => option.id === id) ?? GRADE_OPTIONS[1]!;
}

function getQuestionStyleOption(id: QuestionStyle) {
  return QUESTION_STYLE_OPTIONS.find((option) => option.id === id) ?? QUESTION_STYLE_OPTIONS[0]!;
}

function parsePostCount(value: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return { count: null, error: "Vælg et helt antal poster mellem 3 og 15." };
  }

  if (parsed < MIN_POST_COUNT) {
    return { count: null, error: "Lynbyggeren skal bruge mindst 3 poster." };
  }

  if (parsed > MAX_POST_COUNT) {
    return { count: null, error: "Lynbyggeren kan højst lave 15 poster i denne MVP." };
  }

  return { count: parsed, error: null };
}

function clampPostCount(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return String(DEFAULT_POST_COUNT);
  return String(Math.min(MAX_POST_COUNT, Math.max(MIN_POST_COUNT, Math.round(parsed))));
}

function parseCoordinate(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCenter(latInput: string, lngInput: string): Center | null {
  const lat = parseCoordinate(latInput);
  const lng = parseCoordinate(lngInput);

  if (lat === null || lng === null || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }

  return { lat, lng };
}

function formatCoordinate(value: number) {
  return value.toFixed(6);
}

function getPlacementRadiusMeters(postCount: number, index: number) {
  if (postCount <= 5) {
    return 44 + (index % 2) * 8;
  }

  if (postCount <= 8) {
    return 62 + (index % 2) * 10;
  }

  return index % 2 === 0 ? 92 : 68;
}

function placePointsAroundCenter(center: Center, postCount: number): Center[] {
  const safeCos = Math.max(0.01, Math.abs(Math.cos((center.lat * Math.PI) / 180)));
  const outerCount = Math.ceil(postCount / 2);

  return Array.from({ length: postCount }, (_, index) => {
    const radiusMeters = getPlacementRadiusMeters(postCount, index);
    const angleIndex = postCount > 8 ? Math.floor(index / 2) : index;
    const angleCount = postCount > 8 ? outerCount : postCount;
    const ringOffset = postCount > 8 && index % 2 === 1 ? Math.PI / Math.max(3, outerCount) : 0;
    const angle = -Math.PI / 2 + (2 * Math.PI * angleIndex) / angleCount + ringOffset;
    const lat = center.lat + (Math.sin(angle) * radiusMeters) / 111_320;
    const lng = center.lng + (Math.cos(angle) * radiusMeters) / (111_320 * safeCos);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return center;
    }

    return { lat, lng };
  });
}

function getLevelPhrase(gradeChoiceId: GradeChoiceId) {
  switch (gradeChoiceId) {
    case "3-4":
      return "med en enkel forklaring";
    case "5-6":
      return "med et tydeligt fagligt begreb";
    case "7-8":
      return "med en forklaring, der viser sammenhæng";
    case "9":
      return "med en præcis faglig begrundelse";
    default:
      return "med en kort og brugbar forklaring";
  }
}

function buildQuestionText(topic: string, index: number, style: QuestionStyle, gradeChoiceId: GradeChoiceId) {
  const levelPhrase = getLevelPhrase(gradeChoiceId);
  const templatesByStyle: Record<QuestionStyle, string[]> = {
    quiz: [
      `Hvad passer bedst om ${topic}?`,
      `Hvilket udsagn er korrekt om ${topic}?`,
      `Hvad er en vigtig ting at huske om ${topic}?`,
      `Hvilket eksempel passer bedst til ${topic}?`,
      `Hvad viser god forståelse af ${topic}?`,
    ],
    mixed: [
      `Hvilken forklaring om ${topic} er mest brugbar?`,
      `Hvad ville være et godt nøgleord til ${topic}?`,
      `Hvilket udsagn hjælper bedst med at forstå ${topic}?`,
      `Hvad bør man undersøge først, når emnet er ${topic}?`,
      `Hvilken sætning passer bedst til ${topic}?`,
    ],
    movement: [
      `Når I står ved posten, hvad skal I især huske om ${topic}?`,
      `Hvilken observation passer bedst til ${topic}?`,
      `Hvilken handling viser, at I forstår ${topic}?`,
      `Hvad kan gruppen bruge ved denne post til at tænke over ${topic}?`,
      `Hvilket svar kobler bedst bevægelse og ${topic}?`,
    ],
  };
  const templates = templatesByStyle[style];
  const template = templates[index % templates.length]!;

  return `${template} Svar ${levelPhrase}.`;
}

function buildAnswers(topic: string, index: number, style: QuestionStyle): {
  answers: [string, string, string, string];
  correctIndex: number;
} {
  const correctByStyle: Record<QuestionStyle, string[]> = {
    quiz: [
      `At forklare ${topic} med et tydeligt eksempel`,
      `At vælge det udsagn om ${topic}, der kan begrundes`,
      `At kende de vigtigste ord og ideer i ${topic}`,
    ],
    mixed: [
      `At sammenligne flere sider af ${topic}`,
      `At bruge både viden og forklaring om ${topic}`,
      `At finde det eksempel, der passer bedst til ${topic}`,
    ],
    movement: [
      `At tale sammen og koble posten til ${topic}`,
      `At bruge stedet som hjælp til at huske ${topic}`,
      `At bevæge sig videre med en fælles forklaring om ${topic}`,
    ],
  };
  const distractors = [
    `At gætte hurtigt uden at læse spørgsmålet`,
    `At vælge det længste svar hver gang`,
    `At springe forklaringen over`,
    `At bruge et svar, der ikke handler om ${topic}`,
    `At vente på, at en anden gruppe svarer`,
  ];
  const correct = correctByStyle[style][index % correctByStyle[style].length]!;
  const correctIndex = index % 4;
  const wrongAnswers = [
    distractors[index % distractors.length]!,
    distractors[(index + 2) % distractors.length]!,
    distractors[(index + 4) % distractors.length]!,
  ];
  const answers = [...wrongAnswers];

  answers.splice(correctIndex, 0, correct);

  return {
    answers: [answers[0]!, answers[1]!, answers[2]!, answers[3]!],
    correctIndex,
  };
}

function buildLynbyggerDraft({
  topic,
  gradeChoiceId,
  postCount,
  questionStyle,
  center,
}: {
  topic: string;
  gradeChoiceId: GradeChoiceId;
  postCount: number;
  questionStyle: QuestionStyle;
  center: Center;
}): LynbyggerDraft {
  const trimmedTopic = topic.trim();
  const gradeOption = getGradeOption(gradeChoiceId);
  const points = placePointsAroundCenter(center, postCount);
  const timestamp = Date.now();
  const questions = points.map((point, index): ManualDraftQuestion => {
    const { answers, correctIndex } = buildAnswers(trimmedTopic, index, questionStyle);

    return {
      id: String(timestamp + index),
      type: "multiple_choice",
      text: buildQuestionText(trimmedTopic, index, questionStyle, gradeChoiceId),
      aiPrompt: "",
      mediaUrl: "",
      answers,
      correctIndex,
      points: DEFAULT_POINTS,
      lat: point.lat,
      lng: point.lng,
    };
  });

  return {
    title: `Lynløb om ${trimmedTopic}`,
    description:
      "Kladde lavet lokalt med Lynbygger. Løbet gemmes først, når du trykker gem i Generel Quiz-builderen.",
    subject: "Generelt",
    gradeLevels: gradeOption.gradeLevels,
    radius: DEFAULT_RUN_RADIUS,
    showTeacherField: true,
    showAiInterviewModal: false,
    mapCenter: center,
    overrideRaceType: RACE_TYPES.MANUEL,
    questions,
  };
}

function assertDraftWasStored(expectedDraft: LynbyggerDraft) {
  const rawDraft = window.localStorage.getItem(MANUEL_DRAFT_STORAGE_KEY);
  if (!rawDraft) {
    throw new Error("Kladde kunne ikke gemmes i browseren. Tjek at localStorage er slået til.");
  }

  const parsed = JSON.parse(rawDraft) as {
    data?: {
      title?: unknown;
      questions?: unknown;
    };
  };

  if (
    parsed.data?.title !== expectedDraft.title ||
    !Array.isArray(parsed.data.questions) ||
    parsed.data.questions.length !== expectedDraft.questions.length
  ) {
    throw new Error("Kladde blev ikke gemt korrekt i browseren. Prøv igen.");
  }
}

function assertDraftAutoloadWasMarked() {
  const shouldAutoload = window.sessionStorage.getItem(AUTOLOAD_DRAFT_FLAG_KEY) === "true";
  const target = window.sessionStorage.getItem(AUTOLOAD_DRAFT_TARGET_KEY);

  if (!shouldAutoload || target !== MANUEL_DRAFT_STORAGE_KEY) {
    throw new Error("Kladde-autoload kunne ikke klargøres. Tjek at sessionStorage er slået til.");
  }
}

export default function LynbyggerPage() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [gradeChoiceId, setGradeChoiceId] = useState<GradeChoiceId>("5-6");
  const [postCountInput, setPostCountInput] = useState(String(DEFAULT_POST_COUNT));
  const [questionStyle, setQuestionStyle] = useState<QuestionStyle>("quiz");
  const [latInput, setLatInput] = useState(formatCoordinate(DEFAULT_CENTER.lat));
  const [lngInput, setLngInput] = useState(formatCoordinate(DEFAULT_CENTER.lng));
  const [draftPreview, setDraftPreview] = useState<LynbyggerDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isWritingDraft, setIsWritingDraft] = useState(false);

  const selectedGradeOption = useMemo(() => getGradeOption(gradeChoiceId), [gradeChoiceId]);
  const selectedQuestionStyle = useMemo(() => getQuestionStyleOption(questionStyle), [questionStyle]);
  const parsedPostCount = parsePostCount(postCountInput);
  const postCountForSummary = parsedPostCount.count ?? DEFAULT_POST_COUNT;

  const setCenterInputs = (center: Center) => {
    setLatInput(formatCoordinate(center.lat));
    setLngInput(formatCoordinate(center.lng));
  };

  const handleLocate = () => {
    setError(null);
    setLocationNotice(null);

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationNotice("Din browser understøtter ikke placering. Standardpunktet bruges, og posterne kan flyttes bagefter.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCenterInputs({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationNotice("Centrum er sat til din nuværende placering.");
        setIsLocating(false);
        setDraftPreview(null);
      },
      () => {
        setLocationNotice("Placering blev ikke delt. Standardpunktet bruges, og posterne kan flyttes bagefter.");
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      }
    );
  };

  const handleGeneratePreview = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLocationNotice(null);

    const trimmedTopic = topic.trim();
    if (!trimmedTopic) {
      setError("Skriv først, hvad løbet skal handle om.");
      setDraftPreview(null);
      return;
    }

    const countResult = parsePostCount(postCountInput);
    if (countResult.error || countResult.count === null) {
      setError(countResult.error);
      setDraftPreview(null);
      return;
    }

    const center = parseCenter(latInput, lngInput);
    if (!center) {
      setError("Vælg et gyldigt centrum med breddegrad mellem -90 og 90 og længdegrad mellem -180 og 180.");
      setDraftPreview(null);
      return;
    }

    const draft = buildLynbyggerDraft({
      topic: trimmedTopic,
      gradeChoiceId,
      postCount: countResult.count,
      questionStyle,
      center,
    });

    if (
      draft.questions.length !== countResult.count ||
      draft.questions.some(
        (question) =>
          !Number.isFinite(question.lat) ||
          !Number.isFinite(question.lng) ||
          question.answers.length !== 4 ||
          question.answers.some((answer) => !answer.trim()) ||
          question.correctIndex < 0 ||
          question.correctIndex > 3 ||
          !question.text.trim()
      )
    ) {
      setError("Kladde kunne ikke valideres lokalt. Prøv med et andet centrum eller færre poster.");
      setDraftPreview(null);
      return;
    }

    setDraftPreview(draft);
  };

  const handleContinueToBuilder = () => {
    if (!draftPreview) return;

    setError(null);
    setIsWritingDraft(true);

    try {
      writeRunDraft(MANUEL_DRAFT_STORAGE_KEY, null, draftPreview);
      assertDraftWasStored(draftPreview);
      markDraftForAutoload(MANUEL_DRAFT_STORAGE_KEY);
      assertDraftAutoloadWasMarked();
      router.push("/dashboard/opret/manuel");
    } catch (writeError) {
      setError(
        writeError instanceof Error
          ? writeError.message
          : "Kladde kunne ikke klargøres i browseren. Prøv igen."
      );
      setIsWritingDraft(false);
    }
  };

  const adjustPostCount = (direction: -1 | 1) => {
    const current = parsePostCount(postCountInput).count ?? DEFAULT_POST_COUNT;
    const nextCount = Math.min(MAX_POST_COUNT, Math.max(MIN_POST_COUNT, current + direction));
    setPostCountInput(String(nextCount));
    setDraftPreview(null);
    setError(null);
  };

  return (
    <main
      data-testid="lynbygger-page"
      className={`min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.20),transparent_34%),linear-gradient(135deg,#082f49,#0f172a_48%,#083344)] px-6 py-8 text-white md:px-10 ${poppins.className}`}
    >
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between">
        <Link
          href="/dashboard/opret/valg"
          className="inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/8 px-4 py-2 text-sm font-semibold text-white/88 shadow-[0_18px_40px_rgba(0,0,0,0.22)] backdrop-blur-xl transition hover:bg-white/12"
        >
          <ArrowLeft className="h-4 w-4" />
          Tilbage
        </Link>
        <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200/22 bg-cyan-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-cyan-100">
          <Sparkles className="h-4 w-4" />
          Lokal MVP
        </span>
      </header>

      <section className="mx-auto mt-10 grid w-full max-w-6xl gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.26em] text-cyan-100/72">
            Svar på få korte spørgsmål
          </p>
          <h1 className={`mt-4 text-5xl font-black tracking-tight text-white md:text-7xl ${rubik.className}`}>
            Lynbygger
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-cyan-50/82">
            Lav et GPS-løb på få minutter. Svar på få spørgsmål, så laver vi en kladde, du kan rette i Generel Quiz-builderen.
          </p>
          <div className="mt-5 rounded-2xl border border-cyan-200/18 bg-slate-950/30 px-5 py-4 text-sm font-semibold leading-6 text-cyan-50/82 shadow-[0_18px_42px_rgba(0,0,0,0.18)] backdrop-blur-xl">
            Lynbyggeren gemmer ikke løbet direkte. Du får først en kladde, som du kan gennemgå og rette.
          </div>
        </div>

        <aside className="rounded-[1.8rem] border border-white/12 bg-white/8 p-5 shadow-[0_26px_70px_rgba(0,0,0,0.24)] backdrop-blur-xl">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-100/64">Kladde-status</p>
          <div className="mt-4 grid gap-3 text-sm text-white/82">
            <div className="flex items-center justify-between rounded-2xl bg-slate-950/28 px-4 py-3">
              <span>Poster</span>
              <strong className="text-white">{postCountForSummary}</strong>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-slate-950/28 px-4 py-3">
              <span>Klassetrin</span>
              <strong className="text-white">{selectedGradeOption.label}</strong>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-slate-950/28 px-4 py-3">
              <span>Format</span>
              <strong className="text-white">Generel Quiz</strong>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-950/28 px-4 py-3">
              <span>Spørgsmål</span>
              <strong className="text-right text-white">{selectedQuestionStyle.label}</strong>
            </div>
          </div>
        </aside>
      </section>

      <form onSubmit={handleGeneratePreview} className="mx-auto mt-8 grid w-full max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(24rem,0.8fr)]">
        <section className="space-y-6 rounded-[1.8rem] border border-white/12 bg-white/8 p-6 shadow-[0_26px_70px_rgba(0,0,0,0.24)] backdrop-blur-xl md:p-8">
          <div>
            <label htmlFor="lynbygger-topic" className="text-sm font-black uppercase tracking-[0.2em] text-cyan-100/72">
              Hvad skal løbet handle om?
            </label>
            <input
              id="lynbygger-topic"
              data-testid="lynbygger-topic-input"
              value={topic}
              onChange={(event) => {
                setTopic(event.target.value);
                setDraftPreview(null);
              }}
              placeholder="Fx demokrati, brøker, ordklasser, London, Anden Verdenskrig"
              className={`${inputClass} mt-3`}
            />
          </div>

          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-100/72">Hvilket klassetrin?</p>
            <div data-testid="lynbygger-grade-input" className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {GRADE_OPTIONS.map((option) => {
                const isSelected = gradeChoiceId === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setGradeChoiceId(option.id);
                      setDraftPreview(null);
                    }}
                    className={`min-h-30 rounded-2xl border px-4 py-4 text-left transition ${
                      isSelected
                        ? "border-cyan-200/70 bg-cyan-300/18 text-white shadow-[0_16px_34px_rgba(34,211,238,0.16)]"
                        : "border-white/10 bg-slate-950/28 text-white/76 hover:border-cyan-200/32 hover:bg-cyan-300/8"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-3 text-sm font-black">
                      {option.label}
                      {isSelected ? <Check className="h-4 w-4 text-cyan-100" /> : null}
                    </span>
                    <span className="mt-2 block text-xs leading-5 text-white/62">{option.helper}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="lynbygger-post-count" className="text-sm font-black uppercase tracking-[0.2em] text-cyan-100/72">
              Hvor mange poster vil du have?
            </label>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="inline-flex overflow-hidden rounded-2xl border border-cyan-200/20 bg-slate-950/36">
                <button
                  type="button"
                  onClick={() => adjustPostCount(-1)}
                    className="inline-flex h-12 w-12 items-center justify-center text-cyan-50 transition hover:bg-white/8"
                  aria-label="Færre poster"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <input
                  id="lynbygger-post-count"
                  data-testid="lynbygger-post-count"
                  type="number"
                  min={MIN_POST_COUNT}
                  max={MAX_POST_COUNT}
                  step={1}
                  value={postCountInput}
                  onBlur={() => setPostCountInput(clampPostCount(postCountInput))}
                  onChange={(event) => {
                    setPostCountInput(event.target.value);
                    setDraftPreview(null);
                  }}
                  className="h-12 w-24 border-x border-cyan-200/14 bg-transparent text-center text-lg font-black text-white outline-none"
                />
                <button
                  type="button"
                  onClick={() => adjustPostCount(1)}
                    className="inline-flex h-12 w-12 items-center justify-center text-cyan-50 transition hover:bg-white/8"
                  aria-label="Flere poster"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <p className="text-sm leading-6 text-cyan-50/72">
                Du kan altid slette, tilføje eller flytte poster bagefter i builderen.
              </p>
            </div>
          </div>

          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-100/72">Hvordan skal spørgsmålene være?</p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {QUESTION_STYLE_OPTIONS.map((option) => {
                const isSelected = questionStyle === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setQuestionStyle(option.id);
                      setDraftPreview(null);
                    }}
                    className={`rounded-2xl border px-4 py-4 text-left transition ${
                      isSelected
                        ? "border-cyan-200/70 bg-cyan-300/18 text-white shadow-[0_16px_34px_rgba(34,211,238,0.16)]"
                        : "border-white/10 bg-slate-950/28 text-white/76 hover:border-cyan-200/32 hover:bg-cyan-300/8"
                    }`}
                  >
                    <span className="flex items-start justify-between gap-3 text-sm font-black">
                      {option.label}
                      {isSelected ? <Check className="mt-0.5 h-4 w-4 text-cyan-100" /> : null}
                    </span>
                    <span className="mt-2 block text-xs leading-5 text-white/62">{option.helper}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-[1.8rem] border border-white/12 bg-white/8 p-6 shadow-[0_26px_70px_rgba(0,0,0,0.24)] backdrop-blur-xl">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-100/72">Hvor skal løbet placeres?</p>
            <p className="mt-3 text-sm leading-6 text-cyan-50/72">
              Punkterne placeres automatisk omkring centrum, men kan flyttes bagefter i Generel Quiz-builderen.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-100/58">Breddegrad</span>
                <input
                  value={latInput}
                  onChange={(event) => {
                    setLatInput(event.target.value);
                    setDraftPreview(null);
                  }}
                  className={`${inputClass} mt-2`}
                  inputMode="decimal"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-100/58">Længdegrad</span>
                <input
                  value={lngInput}
                  onChange={(event) => {
                    setLngInput(event.target.value);
                    setDraftPreview(null);
                  }}
                  className={`${inputClass} mt-2`}
                  inputMode="decimal"
                />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleLocate}
                disabled={isLocating}
                className="inline-flex items-center gap-2 rounded-2xl border border-cyan-200/22 bg-cyan-300/12 px-4 py-3 text-sm font-bold text-cyan-50 transition hover:bg-cyan-300/18 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLocating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                Brug min placering
              </button>
              <button
                type="button"
                onClick={() => {
                  setCenterInputs(DEFAULT_CENTER);
                  setLocationNotice("Standardpunktet er valgt. Flyt posterne bagefter, hvis løbet skal ligge et andet sted.");
                  setDraftPreview(null);
                }}
                className="rounded-2xl border border-white/12 bg-slate-950/28 px-4 py-3 text-sm font-bold text-white/78 transition hover:bg-white/8"
              >
                Brug standardpunkt
              </button>
            </div>
            {locationNotice ? (
              <p className="mt-4 rounded-2xl border border-cyan-200/16 bg-cyan-300/8 px-4 py-3 text-sm leading-6 text-cyan-50/78">
                {locationNotice}
              </p>
            ) : null}
          </div>

          <div className="rounded-[1.8rem] border border-white/12 bg-white/8 p-6 shadow-[0_26px_70px_rgba(0,0,0,0.24)] backdrop-blur-xl">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-100/72">Klar til kladde</p>
            <p className="mt-3 text-sm leading-6 text-cyan-50/72">
              Løbet gemmes først, når du trykker gem i builderen. Lynbygger skriver kun en lokal kladde.
            </p>
            {error ? (
              <p className="mt-4 rounded-2xl border border-rose-300/28 bg-rose-500/12 px-4 py-3 text-sm font-semibold leading-6 text-rose-50">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              data-testid="lynbygger-generate-preview"
              className="mt-5 inline-flex w-full items-center justify-center gap-3 rounded-2xl border border-cyan-100/38 bg-cyan-300 px-5 py-4 text-base font-black text-slate-950 shadow-[0_18px_42px_rgba(34,211,238,0.2)] transition hover:bg-cyan-200"
            >
              <Wand2 className="h-5 w-5" />
              Lav lynløb
            </button>
          </div>
        </section>
      </form>

      {draftPreview ? (
        <section data-testid="lynbygger-preview" className="mx-auto mt-8 w-full max-w-6xl rounded-[1.8rem] border border-cyan-200/22 bg-cyan-950/38 p-6 shadow-[0_26px_70px_rgba(0,0,0,0.24)] backdrop-blur-xl md:p-8">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-100/68">Preview</p>
              <h2 className={`mt-3 text-3xl font-black tracking-tight text-white md:text-4xl ${rubik.className}`}>
                {draftPreview.title}
              </h2>
              <div className="mt-5 grid gap-3 text-sm text-cyan-50/82 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3">
                  <span className="block text-xs font-bold uppercase tracking-[0.16em] text-cyan-100/54">Antal poster</span>
                  <strong data-testid="lynbygger-preview-count" className="mt-2 block text-lg text-white">{draftPreview.questions.length}</strong>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3">
                  <span className="block text-xs font-bold uppercase tracking-[0.16em] text-cyan-100/54">Emne</span>
                  <strong className="mt-2 block text-lg text-white">{topic.trim()}</strong>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3">
                  <span className="block text-xs font-bold uppercase tracking-[0.16em] text-cyan-100/54">Klassetrin</span>
                  <strong className="mt-2 block text-lg text-white">{selectedGradeOption.label}</strong>
                </div>
              </div>
              <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/20 px-4 py-4">
                <p className="text-sm font-semibold leading-6 text-cyan-50/76">
                  Alle genererede poster vises her. Du kan rette sp&oslash;rgsm&aring;l, svar og placeringer i n&aelig;ste trin.
                </p>
                <div className="mt-4 max-h-[32rem] space-y-3 overflow-y-auto pr-1">
                  {draftPreview.questions.map((question, index) => (
                    <div key={question.id} data-testid="lynbygger-preview-row" className="rounded-2xl border border-white/10 bg-slate-950/26 px-4 py-3">
                      <p className="text-sm font-bold text-white">
                        Post {index + 1}: {question.text}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-50/62">
                        <span className="rounded-full border border-white/10 bg-white/8 px-2.5 py-1">
                          {question.points} point
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/8 px-2.5 py-1">
                          {question.answers.length} svar
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/8 px-2.5 py-1">
                          Rigtigt svar: {String.fromCharCode(65 + question.correctIndex)}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/8 px-2.5 py-1 normal-case tracking-normal">
                          {formatCoordinate(question.lat)}, {formatCoordinate(question.lng)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex min-w-64 flex-col gap-3">
                <button
                  type="button"
                  data-testid="lynbygger-continue-to-editor"
                  onClick={handleContinueToBuilder}
                disabled={isWritingDraft}
                className="inline-flex items-center justify-center gap-3 rounded-2xl border border-cyan-100/38 bg-cyan-300 px-5 py-4 text-sm font-black text-slate-950 shadow-[0_18px_42px_rgba(34,211,238,0.2)] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isWritingDraft ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                Fortsæt til redigering
              </button>
              <button
                type="button"
                onClick={() => setDraftPreview(null)}
                disabled={isWritingDraft}
                className="rounded-2xl border border-white/12 bg-slate-950/28 px-5 py-4 text-sm font-bold text-white/78 transition hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Tilbage og ret
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
