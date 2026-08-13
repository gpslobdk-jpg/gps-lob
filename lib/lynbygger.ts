import { RACE_TYPES } from "@/utils/gpsRuns";
import { isGradeLevel, type GradeLevel } from "@/utils/gradeLevels";

export const LYNBYGGER_QUESTION_COUNT = 5;
export const LYNBYGGER_DEFAULT_POINTS = 10;
export const LYNBYGGER_DEFAULT_RADIUS = 15;

export type LynbyggerCenter = {
  lat: number;
  lng: number;
};

export type LynbyggerApiQuestion = {
  question: string;
  options: [string, string, string, string];
  correctAnswer: string;
};

export type LynbyggerApiResponse = {
  title: string;
  questions: LynbyggerApiQuestion[];
};

export type LynbyggerRequest = {
  builderType: "manual";
  qualityMode: "strict";
  manualTopic: string;
  gradeLevels: [GradeLevel];
  count: typeof LYNBYGGER_QUESTION_COUNT;
};

export type LynbyggerManualQuestion = {
  id: number;
  type: "multiple_choice";
  text: string;
  aiPrompt: "";
  mediaUrl: "";
  answers: [string, string, string, string];
  correctIndex: number;
  points: typeof LYNBYGGER_DEFAULT_POINTS;
  lat: number | null;
  lng: number | null;
};

export type LynbyggerManualDraft = {
  title: string;
  description: "";
  subject: "";
  gradeLevels: [GradeLevel];
  radius: typeof LYNBYGGER_DEFAULT_RADIUS;
  showTeacherField: false;
  showAiInterviewModal: false;
  mapCenter?: LynbyggerCenter;
  overrideRaceType: typeof RACE_TYPES.MANUEL;
  lynbyggerPlacementStatus: "placed" | "missing";
  questions: LynbyggerManualQuestion[];
};

type InputValidationResult =
  | { ok: true; request: LynbyggerRequest }
  | { ok: false; field: "topic" | "gradeLevel"; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeNonEmptyString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function validateLynbyggerInput(topic: string, gradeLevel: string): InputValidationResult {
  const normalizedTopic = topic.trim();

  if (!normalizedTopic) {
    return {
      ok: false,
      field: "topic",
      message: "Skriv først, hvad eleverne skal arbejde med.",
    };
  }

  if (normalizedTopic.length > 180) {
    return {
      ok: false,
      field: "topic",
      message: "Skriv emnet lidt kortere, så det højst fylder 180 tegn.",
    };
  }

  if (!isGradeLevel(gradeLevel)) {
    return {
      ok: false,
      field: "gradeLevel",
      message: "Vælg klassetrin, før du laver løbet.",
    };
  }

  return {
    ok: true,
    request: {
      builderType: "manual",
      qualityMode: "strict",
      manualTopic: normalizedTopic,
      gradeLevels: [gradeLevel],
      count: LYNBYGGER_QUESTION_COUNT,
    },
  };
}

export function parseLynbyggerApiResponse(value: unknown): LynbyggerApiResponse | null {
  if (!isRecord(value)) return null;

  const title = normalizeNonEmptyString(value.title);
  const questionCandidates = Array.isArray(value.questions) ? value.questions : [];
  if (!title || questionCandidates.length !== LYNBYGGER_QUESTION_COUNT) return null;

  const questions = questionCandidates.map((candidate): LynbyggerApiQuestion | null => {
    if (!isRecord(candidate)) return null;

    const question = normalizeNonEmptyString(candidate.question);
    const correctAnswer = normalizeNonEmptyString(candidate.correctAnswer);
    if (!Array.isArray(candidate.options) || candidate.options.length !== 4) return null;

    const normalizedOptions = candidate.options.map(normalizeNonEmptyString);
    if (!question || !correctAnswer || normalizedOptions.some((option) => !option)) return null;

    const correctMatches = normalizedOptions.filter((option) => option === correctAnswer).length;
    if (correctMatches !== 1) return null;

    return {
      question,
      options: [
        normalizedOptions[0]!,
        normalizedOptions[1]!,
        normalizedOptions[2]!,
        normalizedOptions[3]!,
      ],
      correctAnswer,
    };
  });

  if (questions.some((question) => question === null)) return null;

  return {
    title,
    questions: questions as LynbyggerApiQuestion[],
  };
}

function placeQuestionsAroundCenter(center: LynbyggerCenter, count: number): LynbyggerCenter[] {
  const safeCos = Math.max(0.01, Math.abs(Math.cos((center.lat * Math.PI) / 180)));

  return Array.from({ length: count }, (_, index) => {
    const radiusMeters = 44 + (index % 2) * 8;
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / count;

    return {
      lat: center.lat + (Math.sin(angle) * radiusMeters) / 111_320,
      lng: center.lng + (Math.cos(angle) * radiusMeters) / (111_320 * safeCos),
    };
  });
}

export function buildLynbyggerManualDraft(
  generatedRun: LynbyggerApiResponse,
  gradeLevel: GradeLevel,
  center: LynbyggerCenter | null,
): LynbyggerManualDraft {
  const positions = center
    ? placeQuestionsAroundCenter(center, generatedRun.questions.length)
    : generatedRun.questions.map(() => null);
  const timestamp = Date.now();

  return {
    title: generatedRun.title,
    description: "",
    subject: "",
    gradeLevels: [gradeLevel],
    radius: LYNBYGGER_DEFAULT_RADIUS,
    showTeacherField: false,
    showAiInterviewModal: false,
    ...(center ? { mapCenter: center } : {}),
    overrideRaceType: RACE_TYPES.MANUEL,
    lynbyggerPlacementStatus: center ? "placed" : "missing",
    questions: generatedRun.questions.map((question, index) => {
      const correctIndex = question.options.indexOf(question.correctAnswer);
      const position = positions[index];

      return {
        id: timestamp + index,
        type: "multiple_choice",
        text: question.question,
        aiPrompt: "",
        mediaUrl: "",
        answers: question.options,
        correctIndex,
        points: LYNBYGGER_DEFAULT_POINTS,
        lat: position?.lat ?? null,
        lng: position?.lng ?? null,
      };
    }),
  };
}
