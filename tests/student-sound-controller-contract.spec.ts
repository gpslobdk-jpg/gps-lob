import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

function source(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const controllerSource = source(
  "components/play/sound/StudentSoundController.tsx",
);
const standardExperienceSource = source(
  "components/play/standard/StandardStudentPlayExperience.tsx",
);
const playPageSource = source("app/play/[sessionId]/page.tsx");

test("elevlyd er en opt-in læser ved siden af standardquizzen", () => {
  expect(controllerSource).toContain('"use client"');
  expect(controllerSource).toContain('import Mascot from "@/components/brand/Mascot"');
  expect(controllerSource).toContain('<Mascot size="xs" variant="guide"');
  expect(controllerSource).toContain("isActivatedByGesture");
  expect(controllerSource).toContain("ensurePlayers");
  expect(controllerSource).toContain("Tænd spillets lyd");
  expect(controllerSource).toContain("Fortsæt uden lyd");
  expect(controllerSource).toContain("Musik + spillyde");
  expect(controllerSource).toContain("Kun spillyde");
  expect(controllerSource).toContain("Uden spillyd");
  expect(controllerSource).not.toMatch(/\bfetch\s*\(/);
  expect(controllerSource).not.toMatch(/supabase|GPSManager|PlayActions|submitQuizAnswer/i);
  expect(controllerSource).not.toContain("AudioContext");
  expect(standardExperienceSource).not.toMatch(/StudentSoundController|AudioContext|new Audio\s*\(/);
});

test("elevlyd udelukker Musikquiz og forbliver scoped til standardruten", () => {
  expect(playPageSource).toContain("isMusicQuiz");
  expect(playPageSource).toMatch(/questions\.some\(\(question\) => Boolean\(question\.previewUrl\)\)/);
  expect(playPageSource).toMatch(/usesStandardLocation[\s\S]*raceMode === "quiz"[\s\S]*!isMusicQuiz/);
  expect(playPageSource).toContain("<StudentSoundController");
  expect(playPageSource).toContain("isLocationGuidanceVisible={showStandardLocationStatus}");
});

test("korrekt- og målsting kræver autoritative nye signaler", () => {
  expect(controllerSource).toMatch(
    /flags\.hasActiveQuizSuccess[\s\S]*activeQuizAnswerFeedback\?\.tone === "success"[\s\S]*activeQuizAnswerFeedback\.key === currentPost\.activeTypedAnswerKey[\s\S]*studentSubmission\.operationId !== null[\s\S]*studentSubmission\.status === "confirmed"[\s\S]*studentSubmission\.serverConfirmed/,
  );
  expect(controllerSource).toMatch(
    /screen\.mode === "finished" && progress\.hasAuthoritativeCompletion/,
  );
  expect(controllerSource).toContain("signalBaselineSetRef");
  expect(controllerSource).toContain("seenSignalKeysRef");
  expect(controllerSource).toContain("`${sessionId}:finish`");
  expect(controllerSource).not.toContain("screen.playFinishedAtMs");
  expect(controllerSource).toContain("teacherMessageBaselineRef");
  expect(controllerSource).toContain('document.addEventListener("visibilitychange"');
  expect(controllerSource).toContain("document.hidden");
  expect(controllerSource).toContain("isSpeechActive()");
});

test("assetpakken er lokal, kompakt og dokumenteret", () => {
  const assets = [
    "mission-loop.mp3",
    "i-maal-sting.mp3",
    "tap.mp3",
    "post.mp3",
    "correct.mp3",
  ].map((fileName) => path.join(process.cwd(), "public", "audio", "elev", fileName));
  const totalSize = assets.reduce((sum, asset) => {
    expect(fs.existsSync(asset), `${asset} findes`).toBe(true);
    const bytes = fs.readFileSync(asset);
    expect(bytes.length, `${asset} er ikke et tomt placeholder-asset`).toBeGreaterThan(1_000);
    expect(
      bytes.subarray(0, 3).toString("ascii") === "ID3" ||
        (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0),
      `${asset} har en MP3-header`,
    ).toBe(true);
    return sum + bytes.length;
  }, 0);

  expect(totalSize).toBeLessThan(600_000);
  const documentation = source("docs/skolegps/student-sound-assets.md");
  expect(documentation).toMatch(/original|egen|syntetisk/i);
  expect(documentation).toMatch(/licens|brugsgrundlag/i);
  expect(documentation).toMatch(/2026-10-07/);
});
