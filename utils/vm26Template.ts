import { RACE_TYPES } from "@/utils/gpsRuns";

export const VM26_TEMPLATE_ID = "jagten-pa-pokalen";
export const VM26_TEMPLATE_VERSION = 1;

const DEFAULT_RUN_RADIUS = 15;
const DEFAULT_MAP_CENTER = {
  lat: 55.6761,
  lng: 12.5683,
} as const;

type Vm26QuestionSeed = {
  text: string;
  answers: [string, string, string, string];
};

export type Vm26GameConfig = Record<string, unknown> & {
  vm26: {
    enabled: true;
    templateId: typeof VM26_TEMPLATE_ID;
    version: typeof VM26_TEMPLATE_VERSION;
  };
};

export type Vm26TemplateQuestion = {
  id: number;
  type: "multiple_choice";
  text: string;
  aiPrompt: "";
  mediaUrl: "";
  answers: [string, string, string, string];
  correctIndex: 0;
  points: 10;
  lat: null;
  lng: null;
};

export type Vm26Template = {
  title: string;
  description: string;
  subject: string;
  topic: string;
  radius: number;
  showTeacherField: boolean;
  showAiInterviewModal: boolean;
  questions: Vm26TemplateQuestion[];
  mapCenter: typeof DEFAULT_MAP_CENTER;
  overrideRaceType: typeof RACE_TYPES.MANUEL;
  game_config: Vm26GameConfig;
};

const VM26_QUESTION_SEEDS: Vm26QuestionSeed[] = [
  {
    text: "Kickoff: Hvad er fairplay?",
    answers: [
      "At spille ærligt og respektfuldt",
      "At snyde uden at blive opdaget",
      "At diskutere med dommeren",
      "At gemme bolden",
    ],
  },
  {
    text: "Flagduel: Hvilket land forbindes ofte med gul og grøn fodboldtrøje?",
    answers: ["Brasilien", "Danmark", "Japan", "Canada"],
  },
  {
    text: "Taktikmøde: Hvad gør en anfører især?",
    answers: [
      "Samler holdet og hjælper med beslutninger",
      "Bestemmer alle karakterer",
      "Tager alle skud selv",
      "Afbryder kampen",
    ],
  },
  {
    text: "Stadionbrøl: Hvad kaldes tre mål af samme spiller i én kamp?",
    answers: ["Hattrick", "Offside", "Frispark", "Indkast"],
  },
  {
    text: "Dommerens fløjte: Hvad betyder offside kort fortalt?",
    answers: [
      "En angriber står ulovligt placeret i spiløjeblikket",
      "Bolden er punkteret",
      "Målmanden må ikke røre bolden",
      "Kampen er slut",
    ],
  },
  {
    text: "Landsholdsånd: Hvorfor løfter holdet pokalen sammen?",
    answers: [
      "Fordi sejren er fælles",
      "Fordi pokalen er for tung",
      "Fordi kun publikum må se den",
      "Fordi dommeren kræver det",
    ],
  },
  {
    text: "VAR-rummet: Hvad hjælper VAR med?",
    answers: [
      "At tjekke vigtige dommerkendelser på video",
      "At vælge holdets trøjer",
      "At tælle tilskuere",
      "At sælge billetter",
    ],
  },
  {
    text: "Finalen: Hvad er klogt før et straffespark?",
    answers: [
      "Fokuser, vælg placering og spark kontrolleret",
      "Luk øjnene og håb",
      "Løb væk fra bolden",
      "Skift mål med modstanderen",
    ],
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRecord(value: unknown) {
  if (isRecord(value)) return value;
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed.startsWith("{")) return null;

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readGameConfigObject(value: unknown) {
  const record = parseRecord(value);
  const wrappedValue = record?.game_config ?? record?.gameConfig;

  return parseRecord(wrappedValue) ?? record ?? {};
}

export function buildVm26GameConfig(existingConfig?: unknown): Vm26GameConfig {
  const baseConfig = readGameConfigObject(existingConfig);

  return {
    ...baseConfig,
    vm26: {
      enabled: true,
      templateId: VM26_TEMPLATE_ID,
      version: VM26_TEMPLATE_VERSION,
    },
  };
}

export function isVm26GameConfig(value: unknown) {
  const gameConfig = readGameConfigObject(value);
  const vm26 = isRecord(gameConfig.vm26) ? gameConfig.vm26 : null;

  return (
    vm26?.enabled === true &&
    vm26.templateId === VM26_TEMPLATE_ID &&
    vm26.version === VM26_TEMPLATE_VERSION
  );
}

export function buildVm26Template(): Vm26Template {
  const timestamp = Date.now();

  return {
    title: "VM26 – Jagten på pokalen",
    description:
      "I er klassens landshold. Ved hver post vinder I en lille del af kampplanen. Svar rigtigt, saml point, og spil jer hele vejen frem til finalens straffespark.",
    subject: "Idræt",
    topic: "VM26 – Jagten på pokalen",
    radius: DEFAULT_RUN_RADIUS,
    showTeacherField: true,
    showAiInterviewModal: false,
    questions: VM26_QUESTION_SEEDS.map((question, index) => ({
      id: timestamp + index,
      type: "multiple_choice",
      text: question.text,
      aiPrompt: "",
      mediaUrl: "",
      answers: question.answers,
      correctIndex: 0,
      points: 10,
      lat: null,
      lng: null,
    })),
    mapCenter: DEFAULT_MAP_CENTER,
    overrideRaceType: RACE_TYPES.MANUEL,
    game_config: buildVm26GameConfig(),
  };
}
