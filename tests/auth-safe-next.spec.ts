import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

import { getSafeNextPath } from "../lib/auth/safeNextPath";

const root = process.cwd();

function source(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test.describe("safe login return paths", () => {
  test("accepts only existing teacher routes and the exact share landing page", () => {
    expect(getSafeNextPath("/dashboard")).toBe("/dashboard");
    expect(getSafeNextPath("/dashboard/arkiv?filter=foto")).toBe(
      "/dashboard/arkiv?filter=foto"
    );
    expect(getSafeNextPath("/opret/test")).toBe("/opret/test");
    expect(getSafeNextPath("/del/afvikling")).toBe("/del/afvikling");
    expect(getSafeNextPath("/del/afvikling#secret-fragment")).toBe(
      "/del/afvikling"
    );
    expect(getSafeNextPath("/dashboard/arkiv#lokalt-afsnit")).toBe(
      "/dashboard/arkiv"
    );
    expect(getSafeNextPath("/del/afvikling?fra=login")).toBe(
      "/del/afvikling?fra=login"
    );
    expect(
      getSafeNextPath(
        "/api/family-sso/start?request=rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr&audience=printmitarbejdsark"
      )
    ).toBe(
      "/api/family-sso/start?request=rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr&audience=printmitarbejdsark"
    );
  });

  test("rejects open redirects and path-confusion inputs", () => {
    for (const value of [
      "https://evil.example/dashboard",
      "//evil.example/path",
      "/%2f%2fevil.example/path",
      "/%252f%252fevil.example/path",
      "/dashboard/%255cevil.example",
      "/dashboard/%2500evil",
      "/%2F%2Fevil.example/path",
      "/dashboard.evil.example",
      "/dashboard\\evil.example",
      "/del/afvikling/not-a-valid-route",
      "/api/family-sso/start/anything",
      "/join",
      "javascript:alert(1)",
      "/dashboard/%00evil",
      null,
      undefined,
    ]) {
      expect(getSafeNextPath(value)).toBe("/dashboard");
    }
  });

  test("all login surfaces use the shared validator without broad callback changes", () => {
    const proxy = source("proxy.ts");
    const login = source("app/login/LoginPageClient.tsx");
    const callback = source("app/api/auth/callback/route.ts");

    for (const file of [proxy, login, callback]) {
      expect(file).toContain("getSafeNextPath");
    }

    expect(callback).toContain('nextPath === "/dashboard"');
    expect(callback).not.toContain("requestUrl.href");
    expect(callback).toContain("requestUrl.pathname");
  });

  test("keeps OAuth codes, provider payloads and user objects out of auth logs", () => {
    const callback = source("app/api/auth/callback/route.ts");

    expect(callback).not.toContain("error_description");
    expect(callback).not.toContain("providerErrorDescription");
    expect(callback).not.toContain("console.log(");
    expect(callback).not.toContain("{ userError, user }");
    expect(callback).not.toContain("exchangeError);");
    expect(callback).toContain('redirectToLogin(safeOrigin, "oauth_provider_error")');
  });
});
