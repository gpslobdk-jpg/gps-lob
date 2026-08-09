import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..", "..");
const supabaseDir = join(repoRoot, "supabase");
const bootstrapPath = join(
  supabaseDir,
  "test-fixtures",
  "bootstrap",
  "202603010001_core_schema.sql",
);
const migrationsDir = join(supabaseDir, "migrations");

if (!existsSync(bootstrapPath)) {
  throw new Error("Den lokale Supabase-bootstrapfil mangler.");
}

const allProductionMigrations = readdirSync(migrationsDir)
  .filter((name) => /^\d+_.+\.sql$/.test(name))
  .sort();

const throughIndex = process.argv.indexOf("--through");
const throughVersion = throughIndex >= 0 ? process.argv[throughIndex + 1] : null;
if (throughIndex >= 0 && (!throughVersion || !/^\d{12}$/.test(throughVersion))) {
  throw new Error("--through kræver et 12-cifret migrationsversionsnummer.");
}
if (
  throughVersion &&
  !allProductionMigrations.some((name) => name.startsWith(`${throughVersion}_`))
) {
  throw new Error("Den ønskede slutmigration findes ikke i produktionsmappen.");
}

const productionMigrations = throughVersion
  ? allProductionMigrations.filter((name) => name.slice(0, 12) <= throughVersion)
  : allProductionMigrations;

if (allProductionMigrations.some((name) => name.startsWith("202603010001_"))) {
  throw new Error("Den lokale bootstrap må ikke ligge i produktionsmigrationernes mappe.");
}

const tempRoot = mkdtempSync(join(tmpdir(), "gpslob-local-db-"));
const tempSupabaseDir = join(tempRoot, "supabase");
const tempMigrationsDir = join(tempSupabaseDir, "migrations");

try {
  mkdirSync(tempMigrationsDir, { recursive: true });

  const config = readFileSync(join(supabaseDir, "config.toml"), "utf8")
    .replace(/(\[db\.seed\][\s\S]*?\benabled\s*=\s*)true/, "$1false");
  writeFileSync(join(tempSupabaseDir, "config.toml"), config, "utf8");
  cpSync(bootstrapPath, join(tempMigrationsDir, "202603010001_core_schema.sql"));

  for (const migration of productionMigrations) {
    cpSync(join(migrationsDir, migration), join(tempMigrationsDir, migration));
  }

  const supabaseArgs = [
    "--workdir",
    tempRoot,
    "db",
    "reset",
    "--local",
  ];
  const npmExecPath = process.env.npm_execpath;
  const executable = process.platform === "win32" && npmExecPath ? process.execPath : "npx";
  const executableArgs =
    process.platform === "win32" && npmExecPath
      ? [
          npmExecPath,
          "exec",
          "--yes",
          "--package=supabase@2.112.0",
          "--",
          "supabase",
          ...supabaseArgs,
        ]
      : ["--yes", "supabase@2.112.0", ...supabaseArgs];
  const result = spawnSync(
    executable,
    executableArgs,
    { cwd: repoRoot, stdio: "inherit" },
  );

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Lokal Supabase-reset fejlede med exitkode ${result.status ?? "ukendt"}.`);
  }
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
