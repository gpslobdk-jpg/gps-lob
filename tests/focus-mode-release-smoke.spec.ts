import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";

// Explicitly opt in. Every database write belongs to a newly created synthetic
// teacher; no existing accounts, runs, participants or answers are modified.
const enabled = process.env.FOCUS_RELEASE_SMOKE === "true";
test.use({ trace: "off", video: "off", screenshot: "only-on-failure", serviceWorkers: "block" });
test.describe.configure({ retries: 0, timeout: 360_000 });

async function leaveAndReturn(page: Page, duration = 3500) {
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(duration);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

test("controlled real teacher/student Fokusmode release smoke", async ({ browser, baseURL }, testInfo) => {
  test.skip(!enabled, "Set FOCUS_RELEASE_SMOKE=true for the authorized isolated release fixture.");
  expect(baseURL).toMatch(/^https:\/\/(www\.skolegps\.dk|[a-z0-9-]+-gpslobdk-jpgs-projects\.vercel\.app)$/);
  const env = parseEnv(readFileSync(process.env.FOCUS_SMOKE_ENV_FILE ?? ".env.focus-production", "utf8"));
  const databaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!databaseUrl || !serviceKey) throw new Error("Synthetic smoke environment is incomplete");
  const admin = createClient(databaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const marker = randomUUID();
  const email = `focus-release-${marker}@example.invalid`;
  const password = `${randomUUID()}A7!`;
  const title = `Releasekontrol Fokusmode ${marker.slice(0, 8)}`;
  const studentName = `Fokus hold ${marker.slice(0, 8)}`;
  expect(studentName.length).toBeLessThanOrEqual(20);
  const ledgerPath = ".env.focus-smoke-ledger";
  if (existsSync(ledgerPath)) {
    const previous = JSON.parse(readFileSync(ledgerPath, "utf8")) as { cleaned?: boolean };
    expect(previous.cleaned, "Previous synthetic smoke requires its scoped cleanup first").toBe(true);
  }
  const ledger = {
    marker, teacherId: "", runId: "", sessionId: "", participantAuthIds: [] as string[],
    joinAttempted: false, anonymousAuthCleanupUncertain: false,
    knownFixtureDataCleaned: false, cleaned: false,
  };
  const persistLedger = () => writeFileSync(".env.focus-smoke-ledger", JSON.stringify(ledger));
  const rememberParticipantAuth = (authId: string) => {
    if (!ledger.participantAuthIds.includes(authId)) ledger.participantAuthIds.push(authId);
    ledger.anonymousAuthCleanupUncertain = ledger.joinAttempted && ledger.participantAuthIds.length === 0;
    persistLedger();
  };
  const expectNoResidualRows = async (table: string, column: string, value: string) => {
    const residual = await admin.from(table).select("*", { count: "exact", head: true }).eq(column, value);
    expect(residual.error?.code ?? null, `${table}: scoped residual count succeeds`).toBeNull();
    expect(residual.count, `${table}: no synthetic residual rows`).toBe(0);
  };
  const teacherContext = await browser.newContext({ serviceWorkers: "block" });
  const studentContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    permissions: ["geolocation"],
    geolocation: { latitude: 55.6761, longitude: 12.5683, accuracy: 5 },
    serviceWorkers: "block",
  });
  const teacher = await teacherContext.newPage();
  const student = await studentContext.newPage();
  teacher.setDefaultTimeout(30_000);
  student.setDefaultTimeout(30_000);
  // Join creates anonymous auth before inserting the participant. A failed
  // insert can leave an auth ID unavailable to this scoped fixture;
  // retain that uncertainty in the ledger instead of listing or guessing IDs.
  student.on("request", request => {
    if (request.method() === "POST" && new URL(request.url()).pathname === "/api/join") {
      ledger.joinAttempted = true;
      ledger.anonymousAuthCleanupUncertain = ledger.participantAuthIds.length === 0;
      persistLedger();
    }
  });
  const pageErrors: string[] = [];
  teacher.on("pageerror", error => pageErrors.push(error.name));
  student.on("pageerror", error => pageErrors.push(error.name));
  let primaryFailure: unknown = null;
  try {
    // Bootstrap only this protected Preview origin. Disable redirects on the
    // one request carrying the secret so it cannot be forwarded elsewhere.
    const bypassFile = process.env.FOCUS_SMOKE_BYPASS_FILE;
    if (bypassFile) {
      expect(baseURL).toMatch(/^https:\/\/[a-z0-9-]+-gpslobdk-jpgs-projects\.vercel\.app$/);
      const bypass = parseEnv(readFileSync(bypassFile, "utf8")).VERCEL_AUTOMATION_BYPASS_SECRET;
      if (!bypass?.trim()) throw new Error("Preview smoke bypass is missing");
      for (const context of [teacherContext, studentContext]) {
        const response = await context.request.get(`${baseURL}/`, {
          maxRedirects: 0,
          headers: {
            "x-vercel-protection-bypass": bypass,
            "x-vercel-set-bypass-cookie": "true",
          },
        });
        expect(response.status(), "Preview bypass bootstrap succeeds without following redirects").toBeLessThan(400);
        const login = await context.request.get(`${baseURL}/login`, { maxRedirects: 0 });
        expect(login.status(), "Preview cookie permits ordinary requests without a bypass header").toBe(200);
      }
    }
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    expect(created.error?.code ?? null).toBeNull();
    ledger.teacherId = created.data.user!.id;
    persistLedger();
    await teacher.addInitScript(() => localStorage.setItem("gpslob_tour_finished", "true"));
    await teacher.goto(`${baseURL}/login`);
    await teacher.locator('input[type="email"]').fill(email);
    await teacher.locator('input[type="password"]').fill(password);
    await teacher.locator('form button[type="submit"]').click();
    await expect(teacher).toHaveURL(/\/dashboard/, { timeout: 30_000 });
    // This is the current first-visit guide, separate from the older tour key.
    // Dismiss it through the real UI before continuing into the builder.
    const welcomeGuide = teacher.getByRole("heading", { name: "Velkommen til SkoleGPS", exact: true });
    await expect(welcomeGuide).toBeVisible({ timeout: 20_000 });
    await teacher.getByRole("button", { name: "Jeg finder selv", exact: true }).click();
    await expect(welcomeGuide).toBeHidden();
    const questions = [0, 1].map((index) => ({
      id: index + 1, type: "multiple_choice", text: `Syntetisk kontrolpost ${index + 1}`,
      answers: ["Korrekt", "Svar B", "Svar C", "Svar D"], correctIndex: 0,
      points: 10, lat: 55.6761 + index * 0.001, lng: 12.5683 + index * 0.001,
      aiPrompt: "", mediaUrl: "",
    }));
    await teacher.evaluate(({ title, questions }) => {
      localStorage.setItem("draft_run_manuel", JSON.stringify({
        version: 1, editRunId: null, savedAt: new Date().toISOString(),
        data: { title, questions, radius: 20, gradeLevels: [5], mapCenter: { lat: 55.6761, lng: 12.5683 } },
      }));
      sessionStorage.setItem("autoLoadDraft", "true");
      sessionStorage.setItem("autoLoadDraftTarget", "draft_run_manuel");
    }, { title, questions });
    await teacher.goto(`${baseURL}/dashboard/opret/manuel`);
    const setting = teacher.getByRole("switch", { name: "Fokusmode", exact: true });
    await expect(setting).toHaveAttribute("aria-checked", "false");
    await setting.click();
    await teacher.getByRole("button", { name: "Gem løb i arkivet", exact: true }).click();
    await expect(teacher).toHaveURL(/\/dashboard\/arkiv/, { timeout: 30_000 });
    const run = await admin.from("gps_runs").select("id").eq("user_id", ledger.teacherId).eq("title", title).single();
    expect(run.error?.code ?? null).toBeNull();
    ledger.runId = run.data!.id;
    persistLedger();
    const saved = await teacherContext.request.get(`${baseURL}/api/focus-mode/run?runId=${ledger.runId}`);
    expect(saved.ok()).toBeTruthy();
    expect((await saved.json()).enabled).toBe(true);
    // The same archive API used by the visible start button creates the lobby.
    const lobby = await teacherContext.request.post(`${baseURL}/api/archive/live-session`, {
      data: { action: "ensure", runId: ledger.runId },
    });
    expect(lobby.ok()).toBeTruthy();
    const lobbyBody = await lobby.json();
    ledger.sessionId = lobbyBody.session.id;
    persistLedger();
    await teacher.goto(`${baseURL}/dashboard/live/${ledger.sessionId}`);
    await teacher.getByRole("button", { name: "START LØBET", exact: true }).click();
    await expect.poll(async () => {
      const result = await admin.from("live_sessions").select("status").eq("id", ledger.sessionId).single();
      return result.data?.status;
    }).toBe("running");
    await teacher.getByRole("button", { name: "Luk QR-kode", exact: true }).click();
    console.log("FOCUS_RELEASE_TEACHER_FLOW_PASSED");
    // Exercise the actual code -> name flow instead of bypassing registration.
    await student.goto(`${baseURL}/join`);
    const enter = student.getByRole("button", { name: "Deltag i et løb", exact: true });
    await enter.click();
    const pinInput = student.locator("#join-code");
    await expect(pinInput).toBeVisible();
    await pinInput.fill(lobbyBody.session.pin);
    await pinInput.press("Enter");
    const nameInput = student.locator("#join-name");
    await expect(nameInput).toBeVisible();
    await nameInput.fill(studentName);
    const joinResponse = student.waitForResponse(response =>
      new URL(response.url()).pathname === "/api/join" && response.request().method() === "POST");
    await nameInput.press("Enter");
    expect((await joinResponse).status(), "Synthetic student joins through the real API").toBe(200);
    await expect(student).toHaveURL(new RegExp(`/play/${ledger.sessionId}`), { timeout: 30_000 });
    // Current join hands over the registered name; avatar gate is disabled in
    // GameState. No synthetic local participant identity is seeded here.
    const participant = await admin.from("participants").select("id,auth_user_id")
      .eq("session_id", ledger.sessionId).eq("student_name", studentName).single();
    expect(participant.error?.code ?? null).toBeNull();
    const participantId = participant.data!.id;
    if (participant.data!.auth_user_id) rememberParticipantAuth(participant.data!.auth_user_id);
    persistLedger();
    console.log("FOCUS_RELEASE_STUDENT_JOIN_PASSED");
    await expect(student.getByText("Fokusmode er aktiv", { exact: false }).first()).toBeVisible({ timeout: 30_000 });
    await expect(student.locator(".leaflet-container")).toBeVisible();
    await expect.poll(async () => {
      const response = await studentContext.request.get(`${baseURL}/api/focus-mode/participant?sessionId=${ledger.sessionId}&participantId=${participantId}`);
      return response.ok() ? (await response.json()).tracking : false;
    }).toBe(true);
    await leaveAndReturn(student, 300);
    const countAfterShortLeave = await teacherContext.request.get(`${baseURL}/api/focus-mode/session?sessionId=${ledger.sessionId}`);
    expect((await countAfterShortLeave.json()).participants[0].eventCount).toBe(0);
    await leaveAndReturn(student);
    await teacher.getByRole("button", { name: /^Fokusmode:/ }).click();
    await expect(teacher.getByText("Forlod SkoleGPS 1 gang", { exact: true })).toBeVisible({ timeout: 20_000 });
    const exemption = teacher.getByRole("checkbox", { name: /Ignorér fokusregistrering.*Fokus hold/ });
    await exemption.click();
    await expect(exemption).toBeChecked();
    await expect(student.getByText("Fokusmode er aktiv", { exact: false })).toHaveCount(0, { timeout: 20_000 });
    await leaveAndReturn(student);
    const excludedState = await teacherContext.request.get(`${baseURL}/api/focus-mode/session?sessionId=${ledger.sessionId}`);
    expect((await excludedState.json()).participants[0].eventCount).toBe(1);
    const liveSetting = teacher.getByRole("switch", { name: "Fokusmode", exact: true });
    await liveSetting.click();
    await expect(liveSetting).toHaveAttribute("aria-checked", "false");
    await exemption.click();
    await expect(exemption).not.toBeChecked();
    await expect(liveSetting).toBeEnabled();
    await liveSetting.click();
    await expect(liveSetting).toHaveAttribute("aria-checked", "true");
    await expect(student.getByText("Fokusmode er aktiv", { exact: false }).first()).toBeVisible({ timeout: 20_000 });
    await student.getByRole("button", { name: /skjul.*fokus/i }).click();
    // Break only the optional API in this synthetic browser while the real GPS
    // and answer endpoints continue. This must not affect either post.
    await student.route("**/api/focus-mode/participant**", route => route.fulfill({
      status: 503, contentType: "application/json", body: JSON.stringify({ available: false }),
    }));
    await expect(student.getByTestId("student-focus-mode")).toHaveCount(0, { timeout: 20_000 });
    for (let index = 0; index < questions.length; index++) {
      const openPost = student.getByRole("button", { name: "Åbn post", exact: true });
      await expect(async () => {
        const locationAction = student.getByRole("button", { name: /tillad placering|find min placering igen/i }).first();
        if (await locationAction.isVisible()) await locationAction.click();
        const jitter = Date.now() % 2 === 0 ? 0 : 0.000001;
        await studentContext.setGeolocation({ latitude: questions[index].lat + jitter, longitude: questions[index].lng + jitter, accuracy: 5 });
        await expect(openPost).toBeVisible({ timeout: 1200 });
        await expect(openPost).toBeEnabled();
      }).toPass({ timeout: 30_000, intervals: [500, 1000] });
      await expect.poll(async () => {
        const position = await admin.from("participants").select("lat,lng").eq("id", participantId).eq("session_id", ledger.sessionId).single();
        return typeof position.data?.lat === "number" && typeof position.data?.lng === "number" &&
          Math.abs(position.data.lat - questions[index].lat) < 0.00002 && Math.abs(position.data.lng - questions[index].lng) < 0.00002;
      }, { timeout: 20_000 }).toBe(true);
      await openPost.click();
      await expect(student.getByText(questions[index].text, { exact: true })).toBeVisible();
      await student.getByRole("button", { name: /^(A\s+)?Korrekt$/ }).click();
      const next = student.getByRole("button", { name: index === questions.length - 1 ? /se resultat/i : /gå til næste post/i });
      if (index === questions.length - 1) {
        const finished = student.getByText(/Løbet er slut\./i);
        await expect(next.or(finished).first()).toBeVisible({ timeout: 30_000 });
        if (await next.isVisible()) {
          // The authoritative finish snapshot can replace the result button
          // while Playwright waits for its animation. The final view is required.
          await next.click({ timeout: 1500 }).catch(async () => {
            await expect(finished).toBeVisible({ timeout: 30_000 });
          });
        }
      } else {
        const nextPost = student.getByText(`Post ${index + 2} af ${questions.length}`, { exact: true }).first();
        await expect(next.or(nextPost).first()).toBeVisible({ timeout: 30_000 });
        if (await next.isVisible()) {
          // A concurrent authoritative snapshot can already move to post 2
          // while the success panel is animating. Only verified progression
          // permits a missing next button; the next question is checked below.
          await next.click({ timeout: 1500 }).catch(async () => {
            await expect(nextPost).toBeVisible({ timeout: 30_000 });
          });
        }
        await expect(nextPost).toBeVisible({ timeout: 30_000 });
      }
    }
    await expect(student.getByText(/Løbet er slut\./i)).toBeVisible({ timeout: 30_000 });
    await student.reload();
    await expect(student.getByText(/Løbet er slut\./i)).toBeVisible({ timeout: 30_000 });
    const answered = await admin.from("answers").select("id").eq("session_id", ledger.sessionId).eq("participant_id", participantId);
    expect(answered.error?.code ?? null).toBeNull();
    expect(answered.data).toHaveLength(2);
    expect(pageErrors, "No uncaught page errors during real core flow").toEqual([]);
    await teacher.screenshot({ path: testInfo.outputPath("teacher-focus.png") });
    await student.screenshot({ path: testInfo.outputPath("student-finished.png") });
    console.log("FOCUS_RELEASE_SMOKE_PASSED: teacher login, builder save, session start, code/name join, GPS writes, grace, focus event, live toggle/exemption, API-failure gameplay, two answers, progression, finish/reload");
  } catch (error) {
    primaryFailure = error;
    throw error;
  } finally {
    // Context closure must not prevent database cleanup after a test failure.
    await Promise.allSettled([teacherContext.close(), studentContext.close()]);
    if (ledger.teacherId) {
    try {
    // Scope cleanup by the freshly created teacher, then exact run/session IDs.
    const runs = await admin.from("gps_runs").select("id,title").eq("user_id", ledger.teacherId);
    expect(runs.error?.code ?? null).toBeNull();
    expect((runs.data ?? []).every((run) => run.title === title), "Synthetic owner must contain only the expected run").toBe(true);
    for (const run of runs.data ?? []) {
      const sessions = await admin.from("live_sessions").select("id,teacher_id").eq("run_id", run.id);
      expect(sessions.error?.code ?? null).toBeNull();
      for (const session of sessions.data ?? []) {
        expect(session.teacher_id === ledger.teacherId, "Session must belong to the synthetic teacher").toBe(true);
        const participants = await admin.from("participants").select("id,auth_user_id,student_name").eq("session_id", session.id);
        expect(participants.error?.code ?? null).toBeNull();
        expect((participants.data ?? []).length <= 1 && (participants.data ?? []).every(participant => participant.student_name === studentName), "Cleanup requires only the uniquely named synthetic participant").toBe(true);
        for (const participant of participants.data ?? []) {
          if (participant.auth_user_id && !ledger.participantAuthIds.includes(participant.auth_user_id)) {
            rememberParticipantAuth(participant.auth_user_id);
          }
          const answers = await admin.from("answers").delete().eq("participant_id", participant.id).eq("session_id", session.id);
          expect(answers.error?.code ?? null).toBeNull();
          const removed = await admin.from("participants").delete().eq("id", participant.id).eq("session_id", session.id);
          expect(removed.error?.code ?? null).toBeNull();
        }
        const sessionStudents = await admin.from("session_students").select("student_name").eq("session_id", session.id);
        expect(sessionStudents.error?.code ?? null).toBeNull();
        expect((sessionStudents.data ?? []).every(row => row.student_name === studentName), "Session students must contain only the uniquely named synthetic participant").toBe(true);
        const removedSessionStudents = await admin.from("session_students").delete().eq("session_id", session.id).eq("student_name", studentName);
        expect(removedSessionStudents.error?.code ?? null).toBeNull();
        const removedSession = await admin.from("live_sessions").delete().eq("id", session.id).eq("teacher_id", ledger.teacherId);
        expect(removedSession.error?.code ?? null).toBeNull();
        for (const table of ["answers", "participants", "session_students", "focus_session_settings", "focus_participant_state"]) {
          await expectNoResidualRows(table, "session_id", session.id);
        }
        await expectNoResidualRows("live_sessions", "id", session.id);
      }
      const removedRun = await admin.from("gps_runs").delete().eq("id", run.id).eq("user_id", ledger.teacherId);
      expect(removedRun.error?.code ?? null).toBeNull();
      await expectNoResidualRows("gps_runs", "id", run.id);
      await expectNoResidualRows("focus_run_settings", "run_id", run.id);
      await expectNoResidualRows("live_sessions", "run_id", run.id);
    }
    await expectNoResidualRows("gps_runs", "user_id", ledger.teacherId);
    await expectNoResidualRows("live_sessions", "teacher_id", ledger.teacherId);
    for (const authId of [...ledger.participantAuthIds]) {
      const auth = await admin.auth.admin.getUserById(authId);
      expect(auth.error?.code ?? null).toBeNull();
      expect(auth.data.user?.is_anonymous, "Only synthetic anonymous student auth is removed").toBe(true);
      const removedAuth = await admin.auth.admin.deleteUser(authId);
      expect(removedAuth.error?.code ?? null).toBeNull();
      ledger.participantAuthIds = ledger.participantAuthIds.filter(id => id !== authId);
      persistLedger();
    }
    const teacherAuth = await admin.auth.admin.getUserById(ledger.teacherId);
    expect(teacherAuth.error?.code ?? null).toBeNull();
    expect(teacherAuth.data.user?.email === email, "Only this newly generated synthetic teacher is removed").toBe(true);
    const removedTeacher = await admin.auth.admin.deleteUser(ledger.teacherId);
    expect(removedTeacher.error?.code ?? null).toBeNull();
    ledger.knownFixtureDataCleaned = true;
    ledger.cleaned = !ledger.anonymousAuthCleanupUncertain;
    persistLedger();
    expect(ledger.cleaned, "Anonymous auth cleanup remains unverified after a join without a known participant auth ID; retain the private ledger").toBe(true);
    console.log("FOCUS_RELEASE_SYNTHETIC_CLEANUP_PASSED");
    } catch (cleanupError) {
      // Preserve the primary test failure; retain the private ledger so root
      // can retry exact synthetic cleanup without discovering any real users.
      await testInfo.attach("synthetic-cleanup-status", { body: "Synthetic cleanup incomplete; use private .env.focus-smoke-ledger. No identifiers or credentials are included here.", contentType: "text/plain" });
      if (!primaryFailure) throw cleanupError;
      console.error("FOCUS_RELEASE_SYNTHETIC_CLEANUP_INCOMPLETE");
    }
    }
  }
});
