/**
 * play-session-sanitizing.spec.ts — Direkte contract-test af sanitizeQuestionForPlay().
 *
 * Importerer funktionen direkte fra server-koden (app/api/play/_shared.ts) for at
 * teste præcis den funktion der tidligere fjernede correctIndex og skabte
 * production-fejlen (alle quiz-svar blev "forkerte").
 *
 * Playwright-mocks kan ikke opfange fejl i denne funktion — denne test kan.
 * Testen kræver ingen browser og ingen database.
 *
 * sanitizeQuestionForPlay() er allerede exported fra _shared.ts (ingen runtime-ændringer).
 *
 * Dækker:
 *   A) Quiz bevarer correctIndex, answers, points og text
 *   B) Musikquiz (quiz-variant) bevarer previewUrl og correctIndex
 *   C) Escape skjuler correctIndex og rydder svar
 *   D) Roleplay skjuler correctIndex og rydder primært svar (answers[0])
 *   E) Foto rydder aiPrompt/correctIndex men bevarer uploadfelter
 */

import { test, expect } from "@playwright/test";

// Direkte import af server-funktionen — ingen browser, ingen mock-lag.
// _shared.ts importerer @/utils/supabase/admin (kun factory-funktion, ingen side-effects).
import { sanitizeQuestionForPlay } from "../app/api/play/_shared";

// ---------------------------------------------------------------------------
// Kontrakt A: Quiz bevarer correctIndex
// ---------------------------------------------------------------------------

test("A) quiz: correctIndex bevares — ikke null, ikke 0-by-default", () => {
  const input = {
    type: "multiple_choice",
    text: "Hvad er korrekt?",
    answers: ["Rød", "Blå", "Grøn", "Gul"],
    correctIndex: 2,
    points: 10,
    lat: 55.6761,
    lng: 12.5683,
  };

  const result = sanitizeQuestionForPlay(input, "quiz") as Record<string, unknown>;

  // Kernekontrakt: correctIndex SKAL bevares som 2.
  // Regression guard: null ville give Number(null)=0 → svar A altid "korrekt".
  expect(result.correctIndex).toBe(2);

  // Alle fire svarmuligheder bevares.
  const answers = result.answers as string[];
  expect(answers).toHaveLength(4);
  expect(answers.filter(Boolean)).toHaveLength(4);

  // Metadata bevares.
  expect(result.points).toBe(10);
  expect(result.text).toBe("Hvad er korrekt?");
});

// ---------------------------------------------------------------------------
// Kontrakt B: Musikquiz (quiz-variant) bevarer previewUrl og correctIndex
// ---------------------------------------------------------------------------

test("B) musikquiz (quiz-variant): previewUrl og correctIndex bevares", () => {
  // Musikquiz-spørgsmål normaliseres til quiz-variant (har 4 svar → quiz).
  // Server-siden må gerne se musikmetadata; client-UI-testen sikrer at
  // trackName/musicArtist ikke vises for eleven.
  const input = {
    type: "multiple_choice",
    text: "Hvilken sang er det?",
    answers: ["Svar A", "Svar B", "Svar C", "Svar D"],
    correctIndex: 1,
    points: 10,
    lat: 55.6761,
    lng: 12.5683,
    previewUrl: "https://example.com/audio.m4a",
    musicArtist: "Secret Artist",
    trackName: "Secret Title",
    artworkUrl: "https://example.com/cover.jpg",
  };

  const result = sanitizeQuestionForPlay(input, "quiz") as Record<string, unknown>;

  // Kernekontrakt: correctIndex bevares (regression guard).
  expect(result.correctIndex).toBe(1);

  // Audio-preview bevares — klienten skal bruge den til afspilning.
  expect(result.previewUrl).toBe("https://example.com/audio.m4a");

  // Musikmetadata bevares på server-niveau.
  expect(result.musicArtist).toBe("Secret Artist");
  expect(result.trackName).toBe("Secret Title");

  // Svar og point bevares.
  const answers = result.answers as string[];
  expect(answers).toHaveLength(4);
  expect(result.points).toBe(10);
});

// ---------------------------------------------------------------------------
// Kontrakt C: Escape skjuler correctIndex og rydder svar
// ---------------------------------------------------------------------------

test("C) escape: correctIndex er null og answers ryddes", () => {
  const input = {
    type: "text",
    text: "Hvad er koden?",
    answers: ["hemmelig-kode", "Belønnings-hint"],
    correctIndex: 0,
    points: 10,
    lat: 55.0,
    lng: 12.0,
  };

  const result = sanitizeQuestionForPlay(input, "escape") as Record<string, unknown>;

  // Kernekontrakt: correctIndex er null — klienten gætter ikke svaret fra index.
  expect(result.correctIndex).toBeNull();

  // Alle fire svar ryddes — klienten må ikke se dem direkte.
  const answers = result.answers as string[];
  expect(answers).toHaveLength(4);
  expect(answers.every((a) => a === "")).toBe(true);

  // Nødvendige elevfelter bevares (klienten skal vise opgavetekst og navigere).
  expect(result.text).toBe("Hvad er koden?");
  expect(result.points).toBe(10);
  expect(result.lat).toBe(55.0);
  expect(result.lng).toBe(12.0);
});

// ---------------------------------------------------------------------------
// Kontrakt D: Roleplay skjuler correctIndex og rydder primært svar (answers[0])
// ---------------------------------------------------------------------------

test("D) roleplay: correctIndex er null og answers[0] ryddes", () => {
  // Roleplay-format: answers[0]=primærsvar, answers[1]=belønning, answers[2]=persona-navn
  const input = {
    type: "roleplay",
    text: "Tal med karakteren og find sandheden",
    answers: ["hemmelig-svar", "Belønnings-tekst", "Persona-Navn", ""],
    correctIndex: 0,
    points: 10,
    lat: 55.0,
    lng: 12.0,
  };

  const result = sanitizeQuestionForPlay(input, "roleplay") as Record<string, unknown>;

  // Kernekontrakt: correctIndex er null.
  expect(result.correctIndex).toBeNull();

  const answers = result.answers as string[];

  // Primærsvar (index 0) ryddes — eleven må ikke se det.
  expect(answers[0]).toBe("");

  // Roleplay-metafelter bevares (persona-navn og belønning bruges af UI).
  expect(answers[1]).toBe("Belønnings-tekst");
  expect(answers[2]).toBe("Persona-Navn");

  // Basale elevfelter bevares.
  expect(result.text).toBe("Tal med karakteren og find sandheden");
  expect(result.points).toBe(10);
});

// ---------------------------------------------------------------------------
// Kontrakt E: Foto bevarer uploadfelter, rydder aiPrompt og correctIndex
// ---------------------------------------------------------------------------

test("E) photo: uploadfelter bevares, aiPrompt og correctIndex ryddes", () => {
  const input = {
    type: "photo",
    text: "Tag et billede",
    aiPrompt: "Tag et billede af noget grønt",
    ai_prompt: "Tag et billede af noget grønt",
    mediaUrl: "https://example.com/reference.jpg",
    isSelfie: false,
    points: 10,
    lat: 55.0,
    lng: 12.0,
    correctIndex: 0,
  };

  const result = sanitizeQuestionForPlay(input, "photo") as Record<string, unknown>;

  // Kernekontrakt: correctIndex er null for foto (foto-flow bruger ikke quiz-index).
  expect(result.correctIndex).toBeNull();

  // AI-prompt ryddes server-side — bruges kun til AI-bedømmelse, ikke af klienten.
  expect(result.aiPrompt).toBe("");
  expect(result.ai_prompt).toBe("");

  // Nødvendige uploadfelter bevares.
  expect(result.text).toBe("Tag et billede");
  expect(result.mediaUrl).toBe("https://example.com/reference.jpg");
  expect(result.isSelfie).toBe(false);
  expect(result.points).toBe(10);
  expect(result.lat).toBe(55.0);
  expect(result.lng).toBe(12.0);

  // Answers ryddes (foto bruger ikke quiz-svar-format).
  const answers = result.answers as string[];
  expect(answers).toHaveLength(4);
  expect(answers.every((a) => a === "")).toBe(true);
});
