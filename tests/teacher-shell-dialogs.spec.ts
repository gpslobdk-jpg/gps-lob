import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(...parts: string[]) {
  return readFileSync(resolve(process.cwd(), ...parts), "utf8");
}

test.describe("Fase 9 · lærerchrome og dialogkontrakter", () => {
  test("den delte header beholder sikker logout og afbrydelig afgang", () => {
    const header = source("components", "dashboard", "DashboardHeader.tsx");
    const assistant = source("components", "AIChatButton.tsx");

    expect(header).toContain('data-teacher-chrome="workspace"');
    expect(header).toContain('new CustomEvent("skolegps:before-dashboard-leave"');
    expect(header).toContain("beforeDashboardLeave.defaultPrevented");
    expect(header).toContain('fetch("/api/family-sso/revoke"');
    expect(header).toContain("supabase.auth.signOut()");
    expect(assistant).toContain('pathname.startsWith("/dashboard/live/")');
    expect(assistant).toContain('pathname.startsWith("/dashboard/resultater/")');
    expect(assistant).toContain('pathname.startsWith("/dashboard/print/")');
  });

  test("fælles dialoglivscyklus dækker alle afgrænsede lærer-dialoger", () => {
    const focusTrap = source("components", "ui", "useModalFocusTrap.ts");
    const dialogFiles = [
      ["components", "builders", "AiReviewDraftModal.tsx"],
      ["components", "archive", "RunExecutionShareModal.tsx"],
      ["app", "dashboard", "arkiv", "page.tsx"],
      ["app", "dashboard", "opret", "stjerneloeb", "bibliotek", "LibraryClient.tsx"],
      ["components", "live", "LiveRulesSheet.tsx"],
      ["components", "live", "LivePhotoLightbox.tsx"],
    ] as const;

    expect(focusTrap).toContain('event.key === "Escape"');
    expect(focusTrap).toContain('event.key !== "Tab"');
    expect(focusTrap).toContain("document.body.style.overflow");
    expect(focusTrap).toContain("returnFocusTarget.focus");

    for (const parts of dialogFiles) {
      const file = source(...parts);
      expect(file).toContain("useModalFocusTrap");
    }

    expect(source("components", "builders", "AiReviewDraftModal.tsx")).toContain('role="dialog"');
    expect(source("components", "archive", "RunExecutionShareModal.tsx")).toContain('aria-modal="true"');
    expect(source("components", "live", "LiveRulesSheet.tsx")).toContain('aria-label="Luk spilregler"');
    expect(source("components", "live", "TeacherLiveResults.tsx")).toContain("<LivePhotoLightbox");
  });

  test("Facebook-valgene forbliver lokale, frivillige og kontoafgrænsede", () => {
    const preference = source("lib", "teacherTools", "communityPreference.ts");
    const modal = source("components", "dashboard", "TeacherToolsModal.tsx");

    expect(preference).toContain("COMMUNITY_INVITE_SNOOZE_MS = 30 * 24 * 60 * 60 * 1000");
    expect(preference).toContain("encodeURIComponent(teacherId)");
    expect(preference).toContain('choice: "member"');
    expect(preference).not.toContain("fetch(");
    expect(modal).toContain("Jeg er allerede medlem");
    expect(modal).toContain("Ikke nu");
    expect(modal).toContain("TEACHER_TOOL_FACEBOOK_GROUP_LINK");
  });
});
