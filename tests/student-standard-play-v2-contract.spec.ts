import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

function source(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const playPageSource = source("app/play/[sessionId]/page.tsx");
const playInterfaceSource = source("components/play/PlayInterface.tsx");
const standardExperienceSource = source(
  "components/play/standard/StandardStudentPlayExperience.tsx",
);
const gameStateSource = source("components/play/GameState.tsx");
const gpsManagerSource = source("components/play/GPSManager.tsx");

test("standardpresentation kræver både standardflag, quiz raceMode og quiz-post", () => {
  expect(playInterfaceSource).toMatch(
    /usesStandardStudentLocationExperience\s*&&\s*raceMode === "quiz"\s*&&\s*activePostVariant === "quiz"/,
  );
});

test("standard location presentation bruger samme eksplicitte scope", () => {
  expect(playPageSource).toMatch(
    /usesStandardLocation\s*&&\s*game\.progress\.raceMode === "quiz"\s*&&\s*game\.progress\.currentPost\.activePostVariant === "quiz"/,
  );
});

test("Zone Krig og Stratego vælger fortsat deres egne interfaces før PlayInterface", () => {
  expect(playPageSource).toMatch(/isZoneKrig[\s\S]*?<ZoneKrigElevInterface/);
  expect(playPageSource).toMatch(/isStratego[\s\S]*?<StrategoElevInterface/);
  expect(playPageSource.indexOf("<ZoneKrigElevInterface")).toBeLessThan(
    playPageSource.indexOf("<PlayInterface"),
  );
  expect(playPageSource.indexOf("<StrategoElevInterface")).toBeLessThan(
    playPageSource.indexOf("<PlayInterface"),
  );
});

test("den nye presentation indeholder ingen fetch, auth, storage eller GPS-watch", () => {
  expect(standardExperienceSource).not.toMatch(/\bfetch\s*\(/);
  expect(standardExperienceSource).not.toMatch(/supabase|localStorage|sessionStorage/i);
  expect(standardExperienceSource).not.toMatch(/watchPosition|getCurrentPosition/);
});

test("den nye presentation tilføjer ingen haptik, lydmotor eller animation library", () => {
  expect(standardExperienceSource).not.toMatch(/navigator\.vibrate|safeVibrate/);
  expect(standardExperienceSource).not.toMatch(/lottie|framer-motion|AudioContext/i);
});

test("den lokale quizfejring kræver korrekt nøgle og serverbekræftet svar", () => {
  expect(standardExperienceSource).toMatch(
    /activeQuizAnswerFeedback !== null[\s\S]*activeQuizAnswerFeedback\.tone === "success"[\s\S]*activeQuizAnswerFeedback\.key === activeTypedAnswerKey[\s\S]*studentSubmission\.status === "confirmed"[\s\S]*studentSubmission\.serverConfirmed/,
  );
  expect(standardExperienceSource).toContain(
    'data-testid="standard-play-confirmed-quiz-celebration"',
  );
  expect(standardExperienceSource).toContain("pointer-events-none");
  expect(standardExperienceSource).toContain("motion-reduce:animate-none");
});

test("korrekt-ordlyd og fortsættelse kræver samme autoritative quizsucces", () => {
  expect(standardExperienceSource).toMatch(
    /const hasAuthoritativeQuizSuccess =[\s\S]*activeQuizAnswerFeedback\.key === activeTypedAnswerKey[\s\S]*studentSubmission\.status === "confirmed"[\s\S]*studentSubmission\.serverConfirmed/,
  );
  expect(standardExperienceSource).toMatch(
    /\{hasAuthoritativeQuizSuccess \?[\s\S]*data-testid="standard-play-answer-success"[\s\S]*Korrekt! Du får point\./,
  );
  expect(standardExperienceSource).toMatch(
    /hasQuizAwaitingAuthoritativeConfirmation[\s\S]*data-testid="standard-play-answer-awaiting-confirmation"[\s\S]*Svaret venter på bekræftelse/,
  );
});

test("neutral afventer-besked er kun til reelt ventende svar og skjuler ikke fejlstatus", () => {
  expect(standardExperienceSource).toMatch(
    /hasQuizAwaitingAuthoritativeConfirmation =[\s\S]*studentSubmission\.status === "queued_offline"[\s\S]*studentSubmission\.status === "awaiting_confirmation"/,
  );
  expect(standardExperienceSource).toMatch(
    /hasUnconfirmedQuizSubmissionStatus =[\s\S]*"retryable_error"[\s\S]*"rejected"[\s\S]*"session_closed"/,
  );
  expect(standardExperienceSource).toMatch(
    /hasUnconfirmedQuizSubmissionStatus \? null : isCurrentPostAnswered \|\| activeQuizPostBurned/,
  );
});

test("quiz handlinger går fortsat gennem eksisterende PlayActions", () => {
  expect(standardExperienceSource).toContain("actions.submitQuizAnswer(index)");
  expect(standardExperienceSource).toContain("actions.continueFromSolvedPost()");
  expect(standardExperienceSource).toContain("actions.unlockCurrentPost");
  expect(standardExperienceSource).toContain("actions.skipCurrentPostAsEmergency()");
});

test("kortet leveres fortsat af det eksisterende MapDisplay", () => {
  expect(playPageSource).toContain("<MapDisplay");
  expect(playPageSource).toContain("playerLocation={game.progress.map.playerLocation}");
  expect(playPageSource).toContain("onTargetClick={game.actions.unlockCurrentPost}");
});

test("GameState og GPSManager indeholder fortsat de eksisterende motorgrænser", () => {
  expect(gameStateSource).toContain("submitQuizAnswer");
  expect(gameStateSource).toContain("pendingLocalAnswersRef");
  expect(gameStateSource).toContain("continueFromSolvedPost");
  expect(gpsManagerSource).toContain("standardStudentLocationFlow");
  expect(gpsManagerSource).toContain("onAutoUnlock");
});

test("reduced motion er eksplicit på nye transitions og spinners", () => {
  expect(standardExperienceSource).toContain("motion-reduce:transition-none");
  expect(standardExperienceSource).toContain("motion-reduce:animate-none");
});
