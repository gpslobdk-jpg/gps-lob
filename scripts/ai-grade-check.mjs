import { performance } from "node:perf_hooks";

const DEFAULT_BASE_URL = "http://localhost:3000";
const DEFAULT_COUNT = 5;

const TEST_MATRIX = [
  {
    builderType: "dansk",
    gradeLevel: "2. klasse",
    danishTopic: "læseforståelse",
    label: "Dansk 2. klasse - læseforståelse",
  },
  {
    builderType: "dansk",
    gradeLevel: "4. klasse",
    danishTopic: "nutids-r",
    label: "Dansk 4. klasse - nutids-r",
  },
  {
    builderType: "dansk",
    gradeLevel: "6. klasse",
    danishTopic: "H.C. Andersen",
    label: "Dansk 6. klasse - H.C. Andersen",
  },
  {
    builderType: "matematik",
    gradeLevel: "2. klasse",
    mathTopic: "plus og minus",
    label: "Matematik 2. klasse - plus og minus",
  },
  {
    builderType: "matematik",
    gradeLevel: "4. klasse",
    mathTopic: "tabeller og division",
    label: "Matematik 4. klasse - tabeller og division",
  },
  {
    builderType: "matematik",
    gradeLevel: "7. klasse",
    mathTopic: "brøker og procent",
    label: "Matematik 7. klasse - brøker og procent",
  },
];

function usage() {
  return `
Brug:
  node scripts/ai-grade-check.mjs [valg]

Valg:
  --base-url <url>      Base-URL til appen. Standard: ${DEFAULT_BASE_URL}
  --cookie <værdi>      Session-cookie fra en logget ind browser. Kan også sættes via AI_TEST_COOKIE.
  --count <tal>         Antal spørgsmål per test-case. Standard: ${DEFAULT_COUNT}
  --only <tekst>        Kør kun cases hvor label indeholder teksten.
  --help                Vis hjælpen.

Eksempel:
  node scripts/ai-grade-check.mjs --base-url http://localhost:3000 --only "2. klasse"
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

async function readBody(response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json().catch(() => null);
  }

  return response.text().catch(() => null);
}

function summarizeQuestion(question) {
  if (!question || typeof question !== "object") return "Ingen spørgsmål returneret";

  const prompt = typeof question.question === "string" ? question.question.trim() : "";
  const options = Array.isArray(question.options)
    ? question.options.map((option) => (typeof option === "string" ? option.trim() : "")).slice(0, 4)
    : [];

  return `${prompt} | ${options.join(" / ")}`;
}

async function runCase(baseUrl, cookie, count, testCase) {
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl.replace(/\/$/u, "")}/api/manual-builder/interview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({
      ...testCase,
      count,
    }),
  });

  const body = await readBody(response);

  return {
    ok: response.ok,
    status: response.status,
    ms: Math.round(performance.now() - startedAt),
    body,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(usage());
    process.exit(0);
  }

  const baseUrl = typeof args["base-url"] === "string" ? args["base-url"] : DEFAULT_BASE_URL;
  const cookie = typeof args.cookie === "string" ? args.cookie : process.env.AI_TEST_COOKIE;
  const count = Number.parseInt(String(args.count ?? DEFAULT_COUNT), 10);
  const onlyFilter = typeof args.only === "string" ? args.only.toLocaleLowerCase("da-DK") : "";

  if (!cookie) {
    console.error("Mangler session-cookie. Angiv --cookie eller miljøvariablen AI_TEST_COOKIE fra en logget ind browser-session.");
    process.exit(1);
  }

  const selectedCases = TEST_MATRIX.filter((testCase) =>
    onlyFilter ? testCase.label.toLocaleLowerCase("da-DK").includes(onlyFilter) : true
  );

  if (selectedCases.length === 0) {
    console.error("Ingen test-cases matchede filteret.");
    process.exit(1);
  }

  console.log(`Kører ${selectedCases.length} AI-niveautests mod ${baseUrl}`);

  for (const testCase of selectedCases) {
    console.log(`\n=== ${testCase.label} ===`);
    const result = await runCase(baseUrl, cookie, count, testCase);

    console.log(`Status: ${result.status} (${result.ms} ms)`);

    if (!result.ok) {
      console.log("Fejl:", result.body?.error ?? result.body ?? "Ukendt fejl");
      continue;
    }

    const title = typeof result.body?.title === "string" ? result.body.title.trim() : "(ingen titel)";
    const questions = Array.isArray(result.body?.questions) ? result.body.questions : [];

    console.log(`Titel: ${title}`);
    console.log(`Antal spørgsmål: ${questions.length}`);
    console.log(`Første spørgsmål: ${summarizeQuestion(questions[0])}`);
  }
}

main().catch((error) => {
  console.error("AI-grade-check fejlede:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});