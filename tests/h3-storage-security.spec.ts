import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import { hasAdminAppMetadata } from "../lib/auth/adminClaim";

const uploadRouteSource = readFileSync(
  join(
    process.cwd(),
    "app",
    "api",
    "stjerneloeb-library",
    "upload",
    "route.ts"
  ),
  "utf8"
);
const uploadWorkspaceSource = readFileSync(
  join(
    process.cwd(),
    "components",
    "admin",
    "StjerneloebUploadWorkspace.tsx"
  ),
  "utf8"
);
const resultsPageSource = readFileSync(
  join(
    process.cwd(),
    "app",
    "dashboard",
    "resultater",
    "[runId]",
    "page.tsx"
  ),
  "utf8"
);
const storageMigrationSource = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "202607250001_reconcile_storage_access_policies.sql"
  ),
  "utf8"
);

test.describe("H3 Stjerneløb Storage security", () => {
  test("accepts only the literal boolean admin claim", () => {
    expect(hasAdminAppMetadata({ app_metadata: { is_admin: true } })).toBe(
      true
    );
    expect(hasAdminAppMetadata({ app_metadata: { is_admin: false } })).toBe(
      false
    );
    expect(hasAdminAppMetadata({ app_metadata: { is_admin: "true" } })).toBe(
      false
    );
    expect(hasAdminAppMetadata({ app_metadata: {} })).toBe(false);
    expect(hasAdminAppMetadata(null)).toBe(false);
  });

  test("validates admin before service-role, OpenAI, or request processing", () => {
    const adminGateIndex = uploadRouteSource.indexOf(
      "await getValidatedAdminAccess()"
    );
    const openAiKeyIndex = uploadRouteSource.indexOf(
      "if (!process.env.OPENAI_API_KEY)"
    );
    const serviceRoleIndex = uploadRouteSource.indexOf(
      "adminSupabase = createAdminClient()"
    );
    const formDataIndex = uploadRouteSource.indexOf(
      "formData = await req.formData()"
    );
    const openAiIndex = uploadRouteSource.indexOf(
      "const openai = createOpenAI("
    );

    expect(adminGateIndex).toBeGreaterThan(-1);
    expect(openAiKeyIndex).toBeGreaterThan(adminGateIndex);
    expect(serviceRoleIndex).toBeGreaterThan(adminGateIndex);
    expect(formDataIndex).toBeGreaterThan(adminGateIndex);
    expect(openAiIndex).toBeGreaterThan(adminGateIndex);
  });

  test("uses only admin-gated multipart with a server-generated UID path", () => {
    expect(uploadRouteSource).toContain('"multipart/form-data"');
    expect(uploadRouteSource).toContain('formData.get("file")');
    expect(uploadRouteSource).not.toContain("application/json");
    expect(uploadRouteSource).not.toContain('formData.get("filePath")');
    expect(uploadRouteSource).not.toContain('formData.get("fileUrl")');
    expect(uploadRouteSource).toContain(
      "makeStoragePath(adminAccess.user.id, fileName)"
    );
    expect(uploadRouteSource).toContain("crypto.randomUUID()");
    expect(uploadRouteSource).toContain(
      '.upload(storagePath, buffer, {'
    );
    expect(uploadRouteSource).toContain(
      '.from("stjerneloeb_library")'
    );
  });

  test("does not write or remove Storage objects from the browser workspace", () => {
    expect(uploadWorkspaceSource).not.toContain(
      '@/utils/supabase/client'
    );
    expect(uploadWorkspaceSource).not.toMatch(/\.storage\b/);
    expect(uploadWorkspaceSource).toContain("const formData = new FormData()");
    expect(uploadWorkspaceSource).toContain(
      'formData.append("file", nextItem.file)'
    );
    expect(uploadWorkspaceSource).toContain(
      'fetch("/api/stjerneloeb-library/upload"'
    );
  });

  test("fails participant cleanup closed without a service-role client", () => {
    const actionStart = resultsPageSource.indexOf(
      "async function clearRunDataAction"
    );
    const actionEnd = resultsPageSource.indexOf(
      "function SessionSection",
      actionStart
    );
    const actionSource = resultsPageSource.slice(actionStart, actionEnd);
    const missingAdminIndex = actionSource.indexOf("if (!adminSupabase)");
    const firstDeleteIndex = actionSource.indexOf(".delete()");

    expect(missingAdminIndex).toBeGreaterThan(-1);
    expect(firstDeleteIndex).toBeGreaterThan(missingAdminIndex);
    expect(actionSource).not.toContain("adminSupabase ?? supabase");
    expect(actionSource).toContain(
      "const { data: answerImageRows, error: answerImagesError } = await adminSupabase"
    );
    expect(actionSource).toContain("await adminSupabase.storage");
  });

  test("replaces the four global VIP policies with explicit bucket compatibility", () => {
    for (let suffix = 0; suffix < 4; suffix += 1) {
      expect(storageMigrationSource).toContain(
        `drop policy if exists "VIP Adgang for lærere nglj8q_${suffix}" on storage.objects;`
      );
    }

    for (const bucket of ["afleveringer", "arbejdsark"]) {
      for (const action of ["select", "insert", "update", "delete"]) {
        expect(storageMigrationSource).toContain(
          `create policy temporary_legacy_compat_${bucket}_${action}`
        );
      }

      expect(storageMigrationSource).toMatch(
        new RegExp(
          `temporary_legacy_compat_${bucket}_select[\\s\\S]*?for select[\\s\\S]*?to authenticated[\\s\\S]*?using \\(bucket_id = '${bucket}'\\);`
        )
      );
      expect(storageMigrationSource).toMatch(
        new RegExp(
          `temporary_legacy_compat_${bucket}_insert[\\s\\S]*?for insert[\\s\\S]*?to authenticated[\\s\\S]*?with check \\(bucket_id = '${bucket}'\\);`
        )
      );
      expect(storageMigrationSource).toMatch(
        new RegExp(
          `temporary_legacy_compat_${bucket}_update[\\s\\S]*?for update[\\s\\S]*?to authenticated[\\s\\S]*?using \\(bucket_id = '${bucket}'\\)[\\s\\S]*?with check \\(bucket_id = '${bucket}'\\);`
        )
      );
      expect(storageMigrationSource).toMatch(
        new RegExp(
          `temporary_legacy_compat_${bucket}_delete[\\s\\S]*?for delete[\\s\\S]*?to authenticated[\\s\\S]*?using \\(bucket_id = '${bucket}'\\);`
        )
      );
    }

    expect(storageMigrationSource).not.toMatch(
      /on storage\.objects[\s\S]*?to anon/i
    );
    expect(storageMigrationSource).not.toMatch(/using\s*\(true\)/i);
    expect(storageMigrationSource).not.toMatch(/with check\s*\(true\)/i);
  });

  test("removes teacher writes from Stjerneløb and keeps metadata service-owned", () => {
    expect(storageMigrationSource).toContain(
      'drop policy if exists "stjerneloeb library authenticated uploads" on storage.objects;'
    );
    expect(storageMigrationSource).toContain(
      'drop policy if exists "stjerneloeb library authenticated deletes" on storage.objects;'
    );
    expect(storageMigrationSource).toMatch(
      /create policy stjerneloeb_library_authenticated_select[\s\S]*?for select[\s\S]*?to authenticated[\s\S]*?using \(auth\.uid\(\) is not null\);/
    );
    expect(storageMigrationSource).toContain(
      "revoke all privileges on table public.stjerneloeb_library"
    );
    expect(storageMigrationSource).toContain(
      "grant select on table public.stjerneloeb_library to authenticated;"
    );
    expect(storageMigrationSource).toContain(
      "grant all privileges on table public.stjerneloeb_library to service_role;"
    );
    expect(storageMigrationSource).not.toMatch(
      /grant (?:insert|update|delete|all privileges) on table public\.stjerneloeb_library to authenticated;/i
    );
  });
});
