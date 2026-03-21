import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const DEFAULT_BASE_URL = "http://localhost:3000";
const DEFAULT_PARTICIPANT_COUNT = 50;
const DEFAULT_ANDERS_COUNT = 5;
const DEFAULT_LAT = 55.6761;
const DEFAULT_LNG = 12.5683;

function usage() {
  return `
Brug:
  node scripts/stress-test.mjs --session-id <SESSION_ID> [valg]

Valg:
  --base-url <url>         Next-appens base-URL. Standard: ${DEFAULT_BASE_URL}
  --post-index <tal>       0-baseret post-index. Hvis udeladt vælges første understøttede post.
  --post-number <tal>      1-baseret postnummer. Alternativ til --post-index.
  --count <tal>            Antal samtidige deltagere. Standard: ${DEFAULT_PARTICIPANT_COUNT}
  --anders-count <tal>     Antal deltagere med navnet "Anders". Standard: ${DEFAULT_ANDERS_COUNT}
  --lat <tal>              Start-latitude for seed-position. Standard: ${DEFAULT_LAT}
  --lng <tal>              Start-longitude for seed-position. Standard: ${DEFAULT_LNG}
  --answer <tekst>         Tving et tekstsvar i stedet for auto-opslag.
  --selected-index <tal>   Tving et valgt quiz-svar (0-3) i stedet for auto-opslag.
  --skip-finish            Spring målgangs-opdatering over.
  --help                   Vis denne hjælp.

Eksempel:
  node scripts/stress-test.mjs --session-id abc123 --post-number 1
`.trim();
}

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith("--")) continue;

    const [rawKey, inlineValue] = token.slice(2).split("=", 2);
    if (!rawKey) continue;

    if (inlineValue !== undefined) {
      args[rawKey] = inlineValue;
      continue;
    }

    const nextToken = argv[index + 1];
    if (!nextToken || nextToken.startsWith("--")) {
      args[rawKey] = true;
      continue;
    }

    args[rawKey] = nextToken;
    index += 1;
  }

  return args;
}

function parseInteger(value, label, { min = null } = {}) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || (min !== null && parsed < min)) {
    throw new Error(`${label} skal være et helt tal${min !== null ? ` på mindst ${min}` : ""}.`);
  }
  return parsed;
}

function parseFloatNumber(value, label) {
  const parsed = Number.parseFloat(String(value));
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} skal være et gyldigt tal.`);
  }
  return parsed;
}

function parseDotEnv(content) {
  const result = {};

  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const normalized = line.startsWith("export ") ? line.slice(7) : line;
    const separatorIndex = normalized.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = normalized.slice(0, separatorIndex).trim();
    let value = normalized.slice(separatorIndex + 1).trim();
    if (!key) continue;

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value.replace(/\\n/g, "\n");
  }

  return result;
}

function loadEnvFromRepoRoot(repoRoot) {
  const candidates = [".env.local", ".env.development.local", ".env"];

  for (const candidate of candidates) {
    const candidatePath = path.join(repoRoot, candidate);
    if (!existsSync(candidatePath)) continue;

    const parsed = parseDotEnv(readFileSync(candidatePath, "utf8"));
    for (const [key, value] of Object.entries(parsed)) {
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  }
}

function asTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getRequiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Miljøvariablen ${name} mangler. Sørg for at den findes i .env.local.`);
  }
  return value;
}

function createSupabaseContext() {
  const url = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/u, "");
  const anonKey = getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return { url, anonKey };
}

async function readBody(response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (response.status === 204) {
    return null;
  }

  if (contentType.includes("application/json")) {
    return response.json().catch(() => null);
  }

  return response.text().catch(() => null);
}

async function fetchJson(url, init = {}) {
  const startedAt = performance.now();

  try {
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
    });
    const body = await readBody(response);

    return {
      ok: response.ok,
      status: response.status,
      body,
      ms: performance.now() - startedAt,
    };
  } catch (error) {
    return {
      ok: false,
      status: "NETWORK",
      body: { error: error instanceof Error ? error.message : String(error) },
      ms: performance.now() - startedAt,
    };
  }
}

async function supabaseRequest(supabase, restPath, init = {}, prefer = "return=representation") {
  const headers = new Headers(init.headers ?? {});
  headers.set("apikey", supabase.anonKey);
  headers.set("Authorization", `Bearer ${supabase.anonKey}`);
  headers.set("Content-Type", "application/json");
  headers.set("Prefer", prefer);

  return fetchJson(`${supabase.url}/rest/v1/${restPath}`, {
    ...init,
    headers,
  });
}

function isMissingColumnError(body) {
  if (!body || typeof body !== "object") return false;
  const code = typeof body.code === "string" ? body.code : "";
  const message = typeof body.message === "string" ? body.message : "";

  if (code === "42703" || code === "PGRST204") return true;
  return /column/i.test(message);
}

function normalizeRaceMode(value) {
  if (typeof value !== "string") return "unknown";

  switch (value.trim().toLowerCase()) {
    case "quiz":
    case "manuel":
    case "manual":
      return "quiz";
    case "foto":
    case "photo":
      return "photo";
    case "escape":
    case "escape_room":
    case "escaperoom":
      return "escape";
    case "rollespil":
    case "roleplay":
    case "role_play":
    case "tidsmaskinen":
      return "roleplay";
    default:
      return "unknown";
  }
}

function getNormalizedAnswers(rawQuestion) {
  if (!rawQuestion || typeof rawQuestion !== "object" || !Array.isArray(rawQuestion.answers)) {
    return ["", "", "", ""];
  }

  const answers = rawQuestion.answers.map((item) => (typeof item === "string" ? item.trim() : ""));
  while (answers.length < 4) answers.push("");
  return answers.slice(0, 4);
}

function inferEscapeQuestion(rawQuestion) {
  if (!rawQuestion || typeof rawQuestion !== "object") return false;

  const answers = getNormalizedAnswers(rawQuestion);
  const [answer0 = "", answer1 = "", answer2 = "", answer3 = ""] = answers;
  const aiPrompt =
    typeof rawQuestion.aiPrompt === "string"
      ? rawQuestion.aiPrompt.trim()
      : typeof rawQuestion.ai_prompt === "string"
        ? rawQuestion.ai_prompt.trim()
        : "";

  const hasRoleplayMeta = Boolean(answer2);
  const hasPrimaryAndReward = Boolean(answer0) && Boolean(answer1) && !answer2 && !answer3;
  const hasOnlyPrimaryAnswer = Boolean(answer0) && !answer1 && !answer2 && !answer3;

  return !hasRoleplayMeta && (hasPrimaryAndReward || (hasOnlyPrimaryAnswer && Boolean(aiPrompt)));
}

function resolveQuestionVariant(raceMode, rawQuestion) {
  const normalizedRaceMode = normalizeRaceMode(raceMode);
  if (normalizedRaceMode !== "unknown") {
    return normalizedRaceMode;
  }

  if (!rawQuestion || typeof rawQuestion !== "object") return "unknown";

  const rawType = asTrimmedString(rawQuestion.type);
  if (rawType === "ai_image") return "photo";

  const [answer0 = "", answer1 = "", answer2 = "", answer3 = ""] = getNormalizedAnswers(rawQuestion);
  if (Boolean(answer2) && !answer3) return "roleplay";
  if (inferEscapeQuestion(rawQuestion)) return "escape";
  if (rawType === "multiple_choice" || Boolean(answer0) || Boolean(answer1) || Boolean(answer3)) {
    return "quiz";
  }

  return "unknown";
}

function getCorrectIndex(rawQuestion) {
  if (!rawQuestion || typeof rawQuestion !== "object") return null;
  if (typeof rawQuestion.correctIndex !== "number" || !Number.isInteger(rawQuestion.correctIndex)) {
    return null;
  }

  const answers = getNormalizedAnswers(rawQuestion);
  if (rawQuestion.correctIndex < 0 || rawQuestion.correctIndex >= answers.length) {
    return null;
  }

  return rawQuestion.correctIndex;
}

function getExpectedAnswer(rawQuestion) {
  const correctIndex = getCorrectIndex(rawQuestion);
  if (correctIndex === null) return "";

  const answers = getNormalizedAnswers(rawQuestion);
  return asTrimmedString(answers[correctIndex]);
}

function getRoleplayMessage(rawQuestion) {
  return asTrimmedString(rawQuestion?.aiPrompt) || asTrimmedString(rawQuestion?.text);
}

async function fetchRunForSession(supabase, sessionId) {
  const sessionResponse = await supabaseRequest(
    supabase,
    `live_sessions?id=eq.${encodeURIComponent(sessionId)}&select=run_id&limit=1`,
    { method: "GET" }
  );

  if (!sessionResponse.ok) {
    throw new Error(`Kunne ikke hente live session: ${JSON.stringify(sessionResponse.body)}`);
  }

  const runId = asTrimmedString(Array.isArray(sessionResponse.body) ? sessionResponse.body[0]?.run_id : "");
  if (!runId) {
    throw new Error("Sessionen har intet run_id.");
  }

  const runResponse = await supabaseRequest(
    supabase,
    `gps_runs?id=eq.${encodeURIComponent(runId)}&select=id,questions,raceType,race_type&limit=1`,
    { method: "GET" }
  );

  if (!runResponse.ok) {
    throw new Error(`Kunne ikke hente run-data: ${JSON.stringify(runResponse.body)}`);
  }

  const run = Array.isArray(runResponse.body) ? runResponse.body[0] : null;
  if (!run || !Array.isArray(run.questions)) {
    throw new Error("Run-data mangler spørgsmål.");
  }

  return {
    runId,
    raceMode: normalizeRaceMode(run.raceType ?? run.race_type),
    questions: run.questions,
  };
}

function resolveTargetPostIndex(run, explicitPostIndex) {
  if (explicitPostIndex !== null) {
    if (explicitPostIndex < 0 || explicitPostIndex >= run.questions.length) {
      throw new Error(`post-index ${explicitPostIndex} findes ikke i løbet.`);
    }
    return explicitPostIndex;
  }

  const supportedIndex = run.questions.findIndex((question) => {
    const variant = resolveQuestionVariant(run.raceMode, question);
    return variant === "quiz" || variant === "escape" || variant === "roleplay";
  });

  if (supportedIndex === -1) {
    throw new Error("Løbet har ingen quiz-, escape- eller rollespilspost, som validate-answer kan teste.");
  }

  return supportedIndex;
}

function buildValidationContext({ question, variant, sessionId, postIndex, explicitAnswer, explicitSelectedIndex }) {
  if (explicitAnswer && explicitSelectedIndex !== null) {
    throw new Error("Brug enten --answer eller --selected-index, ikke begge dele.");
  }

  if (variant === "quiz") {
    const correctIndex = explicitSelectedIndex ?? getCorrectIndex(question);
    if (correctIndex === null || correctIndex < 0 || correctIndex > 3) {
      throw new Error("Kunne ikke afgøre correctIndex for quiz-posten.");
    }

    return {
      variant,
      questionText: asTrimmedString(question.text),
      validateBody: { sessionId, postIndex, selectedIndex: correctIndex },
      selectedIndexForPersistence: correctIndex,
    };
  }

  if (variant === "escape" || variant === "roleplay") {
    const answer = explicitAnswer ?? getExpectedAnswer(question);
    if (!answer) {
      throw new Error("Kunne ikke afgøre det korrekte tekstsvar for posten.");
    }

    return {
      variant,
      questionText: variant === "roleplay" ? getRoleplayMessage(question) : asTrimmedString(question.text),
      validateBody: { sessionId, postIndex, answer },
      selectedIndexForPersistence: 0,
    };
  }

  throw new Error(`Post-typen ${variant} kan ikke stresstestes via /api/play/validate-answer.`);
}

function buildParticipants(count, andersCount, baseLat, baseLng) {
  const stamp = Date.now();
  const participants = [];

  for (let index = 0; index < count; index += 1) {
    const isAnders = index < andersCount;
    participants.push({
      logicalId: index + 1,
      name: isAnders ? "Anders" : `Stress-${stamp}-${String(index + 1).padStart(2, "0")}`,
      lat: baseLat + index * 0.00001,
      lng: baseLng + index * 0.00001,
    });
  }

  return participants;
}

async function seedParticipant(baseUrl, actor, sessionId) {
  const response = await fetchJson(`${baseUrl}/api/play/location`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sessionId,
      studentName: actor.name,
      lat: actor.lat,
      lng: actor.lng,
    }),
  });

  return {
    ...actor,
    ok: response.ok,
    status: response.status,
    ms: response.ms,
    participantId:
      response.ok && response.body && typeof response.body === "object" && response.body.participantId
        ? String(response.body.participantId)
        : null,
    error:
      !response.ok && response.body && typeof response.body === "object" && response.body.error
        ? String(response.body.error)
        : null,
  };
}

async function insertAnswerRecord(supabase, { sessionId, studentName, postNumber, selectedIndex, questionText, lat, lng }) {
  const timestamp = new Date().toISOString();
  const payloads = [
    {
      session_id: sessionId,
      student_name: studentName,
      post_index: postNumber,
      question_index: postNumber - 1,
      selected_index: selectedIndex,
      answer_index: selectedIndex,
      is_correct: true,
      question_text: questionText,
      lat,
      lng,
      answered_at: timestamp,
    },
    {
      session_id: sessionId,
      student_name: studentName,
      post_index: postNumber,
      selected_index: selectedIndex,
      is_correct: true,
      answered_at: timestamp,
    },
    {
      session_id: sessionId,
      student_name: studentName,
      question_index: postNumber - 1,
      answer_index: selectedIndex,
      is_correct: true,
      created_at: timestamp,
    },
    {
      session_id: sessionId,
      student_name: studentName,
      selected_index: selectedIndex,
      is_correct: true,
    },
  ];

  const attemptStatuses = [];
  let totalMs = 0;

  for (const payload of payloads) {
    const response = await supabaseRequest(
      supabase,
      "answers",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      "return=minimal"
    );

    totalMs += response.ms;
    attemptStatuses.push(response.status);

    if (response.ok) {
      return {
        ok: true,
        status: response.status,
        ms: totalMs,
        attemptStatuses,
        error: null,
      };
    }

    if (response.body?.code === "PGRST205") {
      return {
        ok: false,
        status: response.status,
        ms: totalMs,
        attemptStatuses,
        error: "answers-tabellen er ikke tilgængelig.",
      };
    }

    if (isMissingColumnError(response.body)) {
      continue;
    }

    return {
      ok: false,
      status: response.status,
      ms: totalMs,
      attemptStatuses,
      error:
        response.body && typeof response.body === "object" && typeof response.body.message === "string"
          ? response.body.message
          : "Kunne ikke gemme svar i answers.",
    };
  }

  return {
    ok: false,
    status: "NO_MATCH",
    ms: totalMs,
    attemptStatuses,
    error: "Ingen af payload-varianterne kunne gemmes i answers.",
  };
}

async function markParticipantFinished(supabase, { sessionId, studentName }) {
  const finishedAt = new Date().toISOString();

  const participantResponse = await supabaseRequest(
    supabase,
    `participants?session_id=eq.${encodeURIComponent(sessionId)}&student_name=eq.${encodeURIComponent(studentName)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ finished_at: finishedAt }),
    },
    "return=minimal"
  );

  if (participantResponse.ok) {
    return {
      ok: true,
      status: participantResponse.status,
      ms: participantResponse.ms,
      target: "participants",
      error: null,
    };
  }

  if (participantResponse.body?.code !== "PGRST205") {
    return {
      ok: false,
      status: participantResponse.status,
      ms: participantResponse.ms,
      target: "participants",
      error:
        participantResponse.body &&
        typeof participantResponse.body === "object" &&
        typeof participantResponse.body.message === "string"
          ? participantResponse.body.message
          : "Kunne ikke gemme målgang i participants.",
    };
  }

  const fallbackResponse = await supabaseRequest(
    supabase,
    `session_students?session_id=eq.${encodeURIComponent(sessionId)}&student_name=eq.${encodeURIComponent(studentName)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ finished_at: finishedAt }),
    },
    "return=minimal"
  );

  return {
    ok: fallbackResponse.ok,
    status: fallbackResponse.status,
    ms: participantResponse.ms + fallbackResponse.ms,
    target: "session_students",
    error:
      !fallbackResponse.ok &&
      fallbackResponse.body &&
      typeof fallbackResponse.body === "object" &&
      typeof fallbackResponse.body.message === "string"
        ? fallbackResponse.body.message
        : null,
  };
}

async function fetchAnswersForSessionPost(supabase, sessionId, postNumber) {
  const response = await supabaseRequest(
    supabase,
    `answers?session_id=eq.${encodeURIComponent(sessionId)}&post_index=eq.${postNumber}&select=student_name,post_index,question_index,is_correct,answered_at,created_at`,
    { method: "GET" }
  );

  if (!response.ok) {
    throw new Error(`Kunne ikke hente answers: ${JSON.stringify(response.body)}`);
  }

  return Array.isArray(response.body) ? response.body : [];
}

async function fetchParticipantsForSession(supabase, sessionId) {
  const response = await supabaseRequest(
    supabase,
    `participants?session_id=eq.${encodeURIComponent(sessionId)}&select=id,student_name,finished_at,last_updated`,
    { method: "GET" }
  );

  if (!response.ok) {
    throw new Error(`Kunne ikke hente participants: ${JSON.stringify(response.body)}`);
  }

  return Array.isArray(response.body) ? response.body : [];
}

function createBarrier() {
  let release = null;
  const wait = new Promise((resolve) => {
    release = resolve;
  });

  return {
    wait,
    release: () => release?.(),
  };
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function collectStatusCounts(items) {
  const counts = new Map();

  for (const item of items) {
    const status = String(item?.status ?? "UNKNOWN");
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }

  return Object.fromEntries([...counts.entries()].sort(([a], [b]) => a.localeCompare(b, "da-DK")));
}

function byName(rows, name) {
  return rows.filter((row) => asTrimmedString(row.student_name) === name);
}

function printPhaseSummary(label, items, successPredicate) {
  const successes = items.filter(successPredicate).length;
  const latencies = items.filter((item) => typeof item.ms === "number").map((item) => item.ms);

  console.log(`- ${label}: ${successes}/${items.length} succesfulde`);
  console.log(`  Statuskoder: ${JSON.stringify(collectStatusCounts(items))}`);
  console.log(`  Gennemsnitlig svartid: ${average(latencies).toFixed(1)} ms`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(scriptsDir, "..");
  loadEnvFromRepoRoot(repoRoot);

  const baseUrl = asTrimmedString(args["base-url"] || DEFAULT_BASE_URL).replace(/\/$/u, "");
  const sessionId = asTrimmedString(args["session-id"]);
  if (!sessionId) {
    throw new Error("Du skal angive --session-id.");
  }

  const participantCount =
    args.count !== undefined
      ? parseInteger(args.count, "--count", { min: 1 })
      : DEFAULT_PARTICIPANT_COUNT;
  const andersCount =
    args["anders-count"] !== undefined
      ? parseInteger(args["anders-count"], "--anders-count", { min: 1 })
      : DEFAULT_ANDERS_COUNT;

  if (andersCount > participantCount) {
    throw new Error("--anders-count må ikke være større end --count.");
  }

  const postIndex =
    args["post-index"] !== undefined
      ? parseInteger(args["post-index"], "--post-index", { min: 0 })
      : args["post-number"] !== undefined
        ? parseInteger(args["post-number"], "--post-number", { min: 1 }) - 1
        : null;
  const baseLat = args.lat !== undefined ? parseFloatNumber(args.lat, "--lat") : DEFAULT_LAT;
  const baseLng = args.lng !== undefined ? parseFloatNumber(args.lng, "--lng") : DEFAULT_LNG;
  const explicitAnswer = typeof args.answer === "string" ? args.answer : null;
  const explicitSelectedIndex =
    args["selected-index"] !== undefined
      ? parseInteger(args["selected-index"], "--selected-index", { min: 0 })
      : null;
  const skipFinish = args["skip-finish"] === true;

  const supabase = createSupabaseContext();
  const run = await fetchRunForSession(supabase, sessionId);
  const targetPostIndex = resolveTargetPostIndex(run, postIndex);
  const targetQuestion = run.questions[targetPostIndex];
  const variant = resolveQuestionVariant(run.raceMode, targetQuestion);
  const validationContext = buildValidationContext({
    question: targetQuestion,
    variant,
    sessionId,
    postIndex: targetPostIndex,
    explicitAnswer,
    explicitSelectedIndex,
  });
  const postNumber = targetPostIndex + 1;

  console.log("");
  console.log("Stress-test konfiguration");
  console.log(`- Base URL: ${baseUrl}`);
  console.log(`- Session: ${sessionId}`);
  console.log(`- Post: ${postNumber} (index ${targetPostIndex})`);
  console.log(`- Variant: ${variant}`);
  console.log(`- Deltagere: ${participantCount}`);
  console.log(`- Anders-kollisioner: ${andersCount}`);
  console.log(`- Målgangstest: ${skipFinish ? "sprunget over" : "aktiv"}`);

  const participantsBefore = await fetchParticipantsForSession(supabase, sessionId);
  const answersBefore = await fetchAnswersForSessionPost(supabase, sessionId, postNumber);
  const actors = buildParticipants(participantCount, andersCount, baseLat, baseLng);

  console.log("");
  console.log("Seeder deltagere via /api/play/location ...");
  const seedResults = [];
  for (const actor of actors) {
    seedResults.push(await seedParticipant(baseUrl, actor, sessionId));
  }

  const barrier = createBarrier();
  const startedAt = performance.now();
  const workerPromises = seedResults.map(async (seededActor) => {
    await barrier.wait;

    const workerStart = performance.now();
    const validateResult = await fetchJson(`${baseUrl}/api/play/validate-answer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(validationContext.validateBody),
    });

    const outcome = {
      actor: seededActor,
      validate: validateResult,
      validateCorrect: Boolean(validateResult.ok && validateResult.body?.isCorrect === true),
      save: null,
      finish: null,
      endToEndMs: 0,
    };

    if (outcome.validateCorrect) {
      outcome.save = await insertAnswerRecord(supabase, {
        sessionId,
        studentName: seededActor.name,
        postNumber,
        selectedIndex: validationContext.selectedIndexForPersistence,
        questionText: validationContext.questionText,
        lat: seededActor.lat,
        lng: seededActor.lng,
      });

      if (outcome.save.ok && !skipFinish) {
        outcome.finish = await markParticipantFinished(supabase, {
          sessionId,
          studentName: seededActor.name,
        });
      }
    }

    outcome.endToEndMs = performance.now() - workerStart;
    return outcome;
  });

  barrier.release();
  const workerResults = await Promise.all(workerPromises);
  const totalMs = performance.now() - startedAt;

  const participantsAfter = await fetchParticipantsForSession(supabase, sessionId);
  const answersAfter = await fetchAnswersForSessionPost(supabase, sessionId, postNumber);

  const andersSeeds = seedResults.filter((result) => result.name === "Anders");
  const andersParticipantIds = new Set(
    andersSeeds.map((result) => result.participantId).filter((value) => typeof value === "string" && value)
  );
  const andersParticipantsBefore = byName(participantsBefore, "Anders");
  const andersParticipantsAfter = byName(participantsAfter, "Anders");
  const andersAnswersBefore = byName(answersBefore, "Anders");
  const andersAnswersAfter = byName(answersAfter, "Anders");
  const andersParticipantDelta = andersParticipantsAfter.length - andersParticipantsBefore.length;
  const andersAnswerDelta = andersAnswersAfter.length - andersAnswersBefore.length;
  const andersCollision =
    andersParticipantIds.size < andersCount ||
    andersParticipantDelta < andersCount ||
    andersAnswerDelta < andersCount;

  const validateResults = workerResults.map((result) => result.validate);
  const saveResults = workerResults
    .map((result) => result.save)
    .filter((result) => result !== null);
  const finishResults = workerResults
    .map((result) => result.finish)
    .filter((result) => result !== null);

  console.log("");
  console.log("Stress-test rapport");
  console.log("==================");
  console.log(`- Samlet køretid: ${totalMs.toFixed(1)} ms`);
  console.log(`- End-to-end gennemsnit pr. deltager: ${average(workerResults.map((item) => item.endToEndMs)).toFixed(1)} ms`);
  printPhaseSummary("Seed /api/play/location", seedResults, (item) => item.ok && item.status === 200);
  printPhaseSummary(
    "Validate /api/play/validate-answer",
    validateResults,
    (item) => item.ok && item.status === 200
  );
  printPhaseSummary(
    "Gem svar i answers",
    saveResults,
    (item) => item.ok && (item.status === 200 || item.status === 201 || item.status === 204)
  );
  if (!skipFinish) {
    printPhaseSummary(
      "Gem målgang",
      finishResults,
      (item) => item.ok && (item.status === 200 || item.status === 204)
    );
  }

  const allHttpResults = [
    ...seedResults,
    ...validateResults,
    ...saveResults,
    ...finishResults,
  ];
  const failedResults = allHttpResults.filter((item) => !item.ok);

  console.log("");
  console.log("Fejloversigt");
  console.log(`- Antal fejlende kald: ${failedResults.length}`);
  console.log(`- Fejl pr. statuskode: ${JSON.stringify(collectStatusCounts(failedResults))}`);
  if (failedResults.length > 0) {
    const sampleErrors = failedResults.slice(0, 5).map((item) => ({
      status: item.status,
      error:
        item.error ||
        (item.body && typeof item.body === "object" && typeof item.body.error === "string"
          ? item.body.error
          : item.body && typeof item.body === "object" && typeof item.body.message === "string"
            ? item.body.message
            : "Ukendt fejl"),
    }));
    console.log(`- Eksempel-fejl: ${JSON.stringify(sampleErrors)}`);
  }

  console.log("");
  console.log("Anders-kollision");
  console.log(`- Logiske Anders-deltagere: ${andersCount}`);
  console.log(`- Unikke participantId'er fra seed: ${andersParticipantIds.size}`);
  console.log(`- Nye participant-rækker for Anders: ${andersParticipantDelta}`);
  console.log(`- Nye svarrækker for Anders på testposten: ${andersAnswerDelta}`);
  console.log(
    `- Resulterede kollisionen i tabt/flettet data? ${
      andersCollision ? "JA" : "NEJ"
    }`
  );
  if (andersCollision) {
    console.log(
      "- Forklaring: Anders-deltagerne kunne ikke holdes entydigt adskilt på navn alene. Det peger på reel kollisionsrisiko i persistence-laget."
    );
  } else {
    console.log("- Forklaring: De fem Anders-kald gav ikke synligt tab af rows i denne kørsel.");
  }
}

main().catch((error) => {
  console.error("");
  console.error("Stress-testen kunne ikke gennemføres.");
  console.error(error instanceof Error ? error.message : String(error));
  console.error("");
  console.error(usage());
  process.exitCode = 1;
});
