import { expect, test } from "@playwright/test";

import { buildOAuthCallbackUrl } from "../app/login/LoginPageClient";

test.describe("OAuth callback origin allowlist", () => {
  test("production origins keep their own callback", () => {
    expect(buildOAuthCallbackUrl("https://skolegps.dk", "/dashboard")).toBe(
      "https://skolegps.dk/api/auth/callback?next=%2Fdashboard"
    );
    expect(buildOAuthCallbackUrl("https://www.skolegps.dk", "/dashboard")).toBe(
      "https://www.skolegps.dk/api/auth/callback?next=%2Fdashboard"
    );
    expect(buildOAuthCallbackUrl("https://gpslob.dk", "/dashboard")).toBe(
      "https://gpslob.dk/api/auth/callback?next=%2Fdashboard"
    );
  });

  test("trusted team preview keeps the exact preview origin", () => {
    const previewOrigin =
      "https://gps-lobdkkk-git-feature-skolegps-c3484c-gpslobdk-jpgs-projects.vercel.app";
    expect(buildOAuthCallbackUrl(previewOrigin, "/dashboard")).toBe(
      `${previewOrigin}/api/auth/callback?next=%2Fdashboard`
    );
  });

  test("the isolated PrintMit SSO preview keeps its exact callback origin", () => {
    const previewOrigin = "https://skolegps-printmit-preview.vercel.app";
    expect(buildOAuthCallbackUrl(previewOrigin, "/api/family-sso/start?request=test"))
      .toBe(
        `${previewOrigin}/api/auth/callback?next=%2Fapi%2Ffamily-sso%2Fstart%3Frequest%3Dtest`
      );
  });

  test("a different team's vercel.app preview falls back to production", () => {
    expect(
      buildOAuthCallbackUrl("https://example-other-team.vercel.app", "/dashboard")
    ).toBe("https://gpslob.dk/api/auth/callback?next=%2Fdashboard");
  });

  test("lookalike domains built on top of the team suffix are rejected", () => {
    expect(
      buildOAuthCallbackUrl(
        "https://abc-gpslobdk-jpgs-projects.vercel.app.attacker.com",
        "/dashboard"
      )
    ).toBe("https://gpslob.dk/api/auth/callback?next=%2Fdashboard");
  });

  test("an attacker origin carrying the team name in path or query is rejected", () => {
    expect(
      buildOAuthCallbackUrl(
        "https://attacker.example/gpslobdk-jpgs-projects.vercel.app",
        "/dashboard"
      )
    ).toBe("https://gpslob.dk/api/auth/callback?next=%2Fdashboard");
    expect(
      buildOAuthCallbackUrl(
        "https://attacker.example?x=gpslobdk-jpgs-projects.vercel.app",
        "/dashboard"
      )
    ).toBe("https://gpslob.dk/api/auth/callback?next=%2Fdashboard");
  });

  test("localhost development origins are unchanged", () => {
    expect(buildOAuthCallbackUrl("http://localhost:3000", "/dashboard")).toBe(
      "http://localhost:3000/api/auth/callback?next=%2Fdashboard"
    );
    expect(buildOAuthCallbackUrl("http://127.0.0.1:3000", "/dashboard")).toBe(
      "http://127.0.0.1:3000/api/auth/callback?next=%2Fdashboard"
    );
  });
});
