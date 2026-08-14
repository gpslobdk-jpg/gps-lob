import type { LynbyggerApiResponse } from "../../lib/lynbygger";

type LynbyggerQuestion = LynbyggerApiResponse["questions"][number];

export const LYNBYGGER_V31_AMBIGUITY_REGRESSIONS: ReadonlyArray<{
  id: "eu_main_purpose" | "eventyr_common_moral";
  question: LynbyggerQuestion;
  expectedReasonCode: string;
}> = [
  {
    id: "eu_main_purpose",
    question: {
      question: "Hvad er hovedformålet med Den Europæiske Union (EU)?",
      options: [
        "At fremme handel mellem medlemslandene",
        "At skabe en fælles hær",
        "At indføre en fælles valuta for alle lande",
        "At bestemme skolesystemer i medlemslandene",
      ],
      correctAnswer: "At fremme handel mellem medlemslandene",
    },
    expectedReasonCode: "wording_primary_purpose_ambiguous",
  },
  {
    id: "eventyr_common_moral",
    question: {
      question: "Hvad er en fælles moral i mange eventyr?",
      options: [
        "At man altid skal være venlig",
        "At hårdt arbejde belønnes",
        "At man skal følge sine drømme",
        "At gode gerninger bliver belønnet",
      ],
      correctAnswer: "At gode gerninger bliver belønnet",
    },
    expectedReasonCode: "wording_literary_interpretation_without_text_ambiguous",
  },
];
