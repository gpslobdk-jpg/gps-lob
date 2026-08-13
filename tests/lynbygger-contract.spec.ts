import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildLynbyggerManualDraft,
  LYNBYGGER_DEFAULT_POINTS,
  LYNBYGGER_DEFAULT_RADIUS,
  LYNBYGGER_QUESTION_COUNT,
  parseLynbyggerApiResponse,
  validateLynbyggerInput,
} from "../lib/lynbygger";
import { GRADE_LEVEL_OPTIONS } from "../utils/gradeLevels";

function makeSpecificResponse(topic: string, concepts: string[]) {
  return {
    title: `Lynløb om ${topic}`,
    questions: Array.from({ length: 5 }, (_, index) => ({
      question: `Hvad er vigtigt at vide om ${concepts[index]} i emnet ${topic}?`,
      options: [`Fagligt svar om ${concepts[index]}`, "Mulighed B", "Mulighed C", "Mulighed D"],
      correctAnswer: `Fagligt svar om ${concepts[index]}`,
    })),
  };
}

test.describe("Lynbygger-kontrakt", () => {
  test("accepterer alle fælles klassetrin 1-9 og sender kun minimumsrequest", () => {
    for (const gradeLevel of GRADE_LEVEL_OPTIONS) {
      const result = validateLynbyggerInput("  Vulkaner  ", gradeLevel);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;

      expect(result.request).toEqual({
        builderType: "manual",
        qualityMode: "strict",
        manualTopic: "Vulkaner",
        gradeLevels: [gradeLevel],
        count: LYNBYGGER_QUESTION_COUNT,
      });
      expect(result.request).not.toHaveProperty("subject");
      expect(result.request).not.toHaveProperty("tone");
      expect(result.request).not.toHaveProperty("coordinates");
    }
  });

  test("afviser tomt emne, for langt emne og ugyldigt klassetrin", () => {
    expect(validateLynbyggerInput("  ", "8. klasse")).toMatchObject({ ok: false, field: "topic" });
    expect(validateLynbyggerInput("a".repeat(181), "8. klasse")).toMatchObject({ ok: false, field: "topic" });
    expect(validateLynbyggerInput("Vulkaner", "10. klasse")).toMatchObject({ ok: false, field: "gradeLevel" });
  });

  test("validerer fem spørgsmål, fire unikke korrekte svarplaceringer og meningsfuld titel", () => {
    const valid = makeSpecificResponse("Den Kolde Krig", ["Berlinmuren", "NATO", "Cubakrisen", "jerntæppet", "Sovjetunionens opløsning"]);
    expect(parseLynbyggerApiResponse(valid)).not.toBeNull();
    expect(parseLynbyggerApiResponse({ ...valid, title: "" })).toBeNull();
    expect(parseLynbyggerApiResponse({ ...valid, questions: valid.questions.slice(0, 4) })).toBeNull();
    expect(
      parseLynbyggerApiResponse({
        ...valid,
        questions: valid.questions.map((question, index) =>
          index === 0 ? { ...question, options: [question.correctAnswer, question.correctAnswer, "C", "D"] } : question,
        ),
      }),
    ).toBeNull();
  });

  test("mapper til eksisterende manual-builder-format med sikre defaults", () => {
    const parsed = parseLynbyggerApiResponse(
      makeSpecificResponse("Brøker", ["tæller", "nævner", "halvdele", "fjerdedele", "lige store brøker"]),
    );
    expect(parsed).not.toBeNull();
    if (!parsed) return;

    const withoutLocation = buildLynbyggerManualDraft(parsed, "5. klasse", null);
    expect(withoutLocation.questions).toHaveLength(5);
    expect(withoutLocation.radius).toBe(LYNBYGGER_DEFAULT_RADIUS);
    expect(withoutLocation.overrideRaceType).toBe("manuel");
    expect(withoutLocation.lynbyggerPlacementStatus).toBe("missing");
    expect(withoutLocation).not.toHaveProperty("mapCenter");
    for (const question of withoutLocation.questions) {
      expect(question.points).toBe(LYNBYGGER_DEFAULT_POINTS);
      expect(question.answers).toHaveLength(4);
      expect(question.correctIndex).toBeGreaterThanOrEqual(0);
      expect(question.correctIndex).toBeLessThan(4);
      expect(question.lat).toBeNull();
      expect(question.lng).toBeNull();
    }

    const center = { lat: 55.4012, lng: 11.3547 };
    const withLocation = buildLynbyggerManualDraft(parsed, "5. klasse", center);
    expect(withLocation.lynbyggerPlacementStatus).toBe("placed");
    expect(withLocation.mapCenter).toEqual(center);
    for (const question of withLocation.questions) {
      expect(Math.abs(Number(question.lat) - center.lat)).toBeLessThan(0.002);
      expect(Math.abs(Number(question.lng) - center.lng)).toBeLessThan(0.002);
    }
  });

  test("sanity-fixtures er emnespecifikke for de fem aftalte fagområder", () => {
    const cases = [
      ["Den Kolde Krig", ["Berlinmuren", "NATO", "Cubakrisen", "jerntæppet", "Sovjetunionens opløsning"]],
      ["Vulkaner", ["magma", "pladegrænser", "lava", "vulkansk aske", "skjoldvulkan"]],
      ["Brøker", ["tæller", "nævner", "halvdele", "fjerdedele", "lige store brøker"]],
      ["Eventyr", ["eventyrtræk", "modsætninger", "magiske tal", "hjem-ude-hjem", "folkeeventyr"]],
      ["Demokrati", ["folkestyre", "valg", "magtens tredeling", "ytringsfrihed", "mindretalsbeskyttelse"]],
    ] as const;

    for (const [topic, concepts] of cases) {
      const parsed = parseLynbyggerApiResponse(makeSpecificResponse(topic, [...concepts]));
      expect(parsed?.questions).toHaveLength(5);
      concepts.forEach((concept, index) => {
        expect(parsed?.questions[index]?.question).toContain(concept);
      });
    }
  });

  test("den eksisterende AI-motor kræver faglig specificitet og gemmer ikke provider-input", () => {
    const routeSource = readFileSync(resolve(process.cwd(), "app/api/manual-builder/interview/route.ts"), "utf8");
    const pageSource = readFileSync(resolve(process.cwd(), "app/dashboard/opret/lynbygger/page.tsx"), "utf8");

    expect(routeSource).toContain("faktuelt korrekte");
    expect(routeSource).toContain("intelligente og plausible distractors");
    expect(routeSource).toContain("store: false");
    expect(routeSource).not.toContain('console.error("Fejl i manual-builder/interview:", error)');
    expect(pageSource).not.toContain("Hvad passer bedst om");
    expect(pageSource).not.toContain("Hvad viser god forståelse af");
  });
});
