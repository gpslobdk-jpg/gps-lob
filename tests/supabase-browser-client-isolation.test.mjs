import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import path from "node:path";

// Each scenario gets a fresh copy of the installed SDK's module-level cache.
// No browser, Supabase auth calls or external network are needed to reproduce
// the SDK returning its first singleton before considering a new storageKey.
const scenarioScript = String.raw`
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const [root, scenario] = process.argv.slice(1);
let networkRequests = 0;
globalThis.fetch = async () => {
  networkRequests++;
  throw new Error("This isolated SDK test must not use the network");
};
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://synthetic-project.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "synthetic-anon-key";

if (scenario !== "server") {
  const storage = new Map();
  globalThis.window = {
    location: { href: "https://example.invalid/play", hash: "", search: "" },
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key),
    },
    addEventListener() {},
    removeEventListener() {},
  };
  globalThis.document = {
    cookie: "",
    visibilityState: "visible",
    addEventListener() {},
    removeEventListener() {},
  };
  globalThis.window.document = globalThis.document;
}

function loadTypeScript(filename) {
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  const localRequire = specifier => specifier.startsWith("@/")
    ? loadTypeScript(path.join(root, specifier.slice(2) + ".ts"))
    : require(specifier);
  new Function("require", "module", "exports", compiled)(localRequire, loaded, loaded.exports);
  return loaded.exports;
}

const { createClient } = loadTypeScript(path.join(root, "utils/supabase/client.ts"));
const { PARTICIPANT_AUTH_STORAGE_KEY } = loadTypeScript(path.join(root, "utils/supabase/participantAuth.ts"));
const clients = new Set();
const make = options => {
  const client = createClient(options);
  clients.add(client);
  return client;
};

async function main() {
  if (scenario === "server") {
    assert.ok(make({ authScope: "participant" }) !== make({ authScope: "participant" }), "server requests must never share the participant client");
    assert.ok(make() !== make(), "the SDK default must remain uncached on the server");
  } else if (scenario === "headers") {
    const teacher = make();
    const participant = make({ authScope: "participant" });
    const first = make({ authScope: "participant", headers: { "x-test-context": "first" } });
    const second = make({ authScope: "participant", headers: { "x-test-context": "second" } });
    assert.ok(first !== participant && second !== participant && first !== second, "header-specific participant clients must not reuse any cached client");
    assert.equal(first.headers["x-test-context"], "first");
    assert.equal(second.headers["x-test-context"], "second");
    assert.equal(participant.headers["x-test-context"], undefined);
    assert.ok(make({ authScope: "participant", headers: {} }) === participant, "empty headers must still reuse the participant client");
    assert.ok(make() === teacher, "participant headers must not replace the default singleton");
  } else {
    const first = scenario === "participant-first" ? make({ authScope: "participant" }) : make();
    const second = scenario === "participant-first" ? make() : make({ authScope: "participant" });
    const participant = scenario === "participant-first" ? first : second;
    const teacher = scenario === "participant-first" ? second : first;
    assert.ok(participant !== teacher, "default and participant auth must use distinct SDK clients");
    assert.equal(participant.auth.storageKey, PARTICIPANT_AUTH_STORAGE_KEY);
    assert.equal(teacher.auth.storageKey, "sb-synthetic-project-auth-token");
    assert.ok(make({ authScope: "participant" }) === participant, "participant calls must reuse their own browser client");
    assert.ok(make() === teacher, "default calls must preserve the SDK singleton");
    assert.ok(make({ authScope: "default" }) === teacher, "explicit default scope must preserve the same singleton");
  }
  await Promise.all([...clients].map(client => client.auth.initializePromise));
  assert.equal(networkRequests, 0, "constructing isolated clients must not call auth or the network");
}
main().then(() => process.exit(0), error => {
  console.error(error.message);
  process.exit(1);
});
`;

for (const scenario of ["default-first", "participant-first", "headers", "server"]) {
  test(`Supabase auth client isolation: ${scenario}`, () => {
    const result = spawnSync(process.execPath, ["-e", scenarioScript, path.resolve(process.cwd()), scenario], {
      cwd: process.cwd(),
      encoding: "utf8",
      timeout: 15_000,
    });
    assert.equal(result.error, undefined, result.error?.message);
    assert.equal(result.status, 0, result.stderr || result.stdout);
  });
}
