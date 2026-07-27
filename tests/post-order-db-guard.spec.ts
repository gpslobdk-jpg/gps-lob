import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { expect, test } from "@playwright/test";

const scriptPath = join(process.cwd(), "scripts", "test-post-order-db.mjs");

function runGuard(env: Record<string, string | undefined>) {
  return spawnSync(process.execPath, [scriptPath], {
    cwd: process.cwd(),
    env: {
      NODE_ENV: "test",
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      ...env,
    },
    encoding: "utf8",
  });
}

test.describe("post-order DB integration guard", () => {
  test("refuses to run without explicit local credentials", () => {
    const result = runGuard({});

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain(
      "Local DB test not run"
    );
  });

  test("refuses a known remote Supabase host before opening a connection", () => {
    const result = runGuard({
      POST_ORDER_DB_URL: "https://production-project.supabase.co",
      POST_ORDER_DB_ANON_KEY: "test-anon",
      POST_ORDER_DB_SERVICE_ROLE_KEY: "test-service-role",
    });

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain(
      "Refusing post-order DB test against non-local host"
    );
  });
});
