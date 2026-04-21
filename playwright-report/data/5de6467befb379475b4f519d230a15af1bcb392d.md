# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: play-load-12-students.spec.ts >> Race condition: offline-svar paa post 1 => post 2 vises ikke >> Gaa til naeste post-knap vises efter offline-svar paa post 1 (quiz race condition)
- Location: tests\play-load-12-students.spec.ts:194:7

# Error details

```
Error: RACE CONDITION BUG DETECTED:
"Gaa til naeste post"-knap: false
snapshot.currentPostIndex: null
submits: 1

ROOT CAUSE: markAnsweredPostIndex() saettes synkront i handleAnswer() INDEN insertAnswerRecord() returnerer.
isCurrentPostAnswered=true trigges useEffect => dismissCurrentPost() => showQuestion=false.
Naar insertAnswerRecord returnerer, er showQuestion=false => "Gaa til naeste post" vises ALDRIG.

FIX: Se GameState.tsx handleAnswer() + PlayInterface.tsx useEffect linje 251.

expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Test source

```ts
  179 |     const bodyText = await page.locator("body").innerText().catch(() => "(failed)");
  180 |     throw new Error(`"Afstand" not visible 30s after name confirm. Page text: ${bodyText.slice(0, 800)}`);
  181 |   }
  182 | }
  183 | 
  184 | async function readPlaySnapshot(page: Page) {
  185 |   return page.evaluate(() => {
  186 |     const raw = localStorage.getItem("gpslob_active_play_snapshot");
  187 |     if (!raw) return null;
  188 |     try { return JSON.parse(raw) as { sessionId?: string; currentPostIndex?: number; solvedPostIndexes?: number[]; answeredPostIndexes?: number[]; score?: number }; }
  189 |     catch { return null; }
  190 |   });
  191 | }
  192 | 
  193 | test.describe("Race condition: offline-svar paa post 1 => post 2 vises ikke", () => {
  194 |   test(
  195 |     "Gaa til naeste post-knap vises efter offline-svar paa post 1 (quiz race condition)",
  196 |     async ({ browser }) => {
  197 |       test.setTimeout(240_000);
  198 |       const ctx = await browser.newContext();
  199 |       const page = await ctx.newPage();
  200 |       const mockState: MockState = { submitCallCount: 0 };
  201 | 
  202 |       try {
  203 |         await ctx.grantPermissions(["geolocation"]);
  204 |         await setGPS(ctx, POST_1_LAT, POST_1_LNG);
  205 |         await mountApiMocks(ctx, mockState);
  206 | 
  207 |         await joinAndWaitForMap(page);
  208 | 
  209 |         // Trigger GPS hits. Med gpsOverride=true vil unlockCurrentPost() lykkes
  210 |         // (den tjekker gpsOverride || distance>radius — gpsOverride bypasser GPS-kravet).
  211 |         // 2 hits kræves af AUTO_UNLOCK_CONFIRMATION_HITS.
  212 |         await setGPS(ctx, POST_1_LAT, POST_1_LNG);
  213 |         await page.waitForTimeout(300);
  214 |         await setGPS(ctx, POST_1_LAT, POST_1_LNG);
  215 | 
  216 |         // Fallback: med gpsOverride=true er "Åbn posten"-knappen synlig.
  217 |         // Klik den hvis GPS auto-unlock ikke trak inden for 3s.
  218 |         const questionAlreadyOpen = await page
  219 |           .waitForSelector('text=/Hvad er 3/', { timeout: 3_000 })
  220 |           .then(() => true).catch(() => false);
  221 |         if (!questionAlreadyOpen) {
  222 |           const openBtn = page.getByRole("button", { name: /åbn posten|åbn opgave|god mode|lås op/i }).first();
  223 |           if (await openBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
  224 |             await openBtn.click();
  225 |           }
  226 |         }
  227 | 
  228 |         // Vent paa GPS auto-unlock / manuelt åbnet spørgsmål
  229 |         await expect(page.getByText(/Hvad er 3\+3/, { exact: false })).toBeVisible({ timeout: 15_000 });
  230 | 
  231 |         // OFFLINE FØR SVAR
  232 |         await ctx.setOffline(true);
  233 | 
  234 |         const correctBtn = page.getByRole("button", { name: /^6$/i });
  235 |         await expect(correctBtn).toBeVisible({ timeout: 5_000 });
  236 |         await correctBtn.click();
  237 | 
  238 |         // 3 sekunder offline – insertAnswerRecord looper
  239 |         await page.waitForTimeout(3_000);
  240 | 
  241 |         // GENOPRET FORBINDELSEN
  242 |         await ctx.setOffline(false);
  243 |         await setGPS(ctx, POST_2_LAT, POST_2_LNG);
  244 | 
  245 |         // Vent paa at API-svar returnerer og UI opdateres
  246 |         await page.waitForTimeout(4_000);
  247 | 
  248 |         const snapshot = await readPlaySnapshot(page);
  249 |         console.log("Snapshot efter offline-svar:", JSON.stringify(snapshot));
  250 |         console.log("Submit-kald i alt:", mockState.submitCallCount);
  251 | 
  252 |         // ASSERTION: "Gaa til naeste post" knap synlig
  253 |         // Brug waitFor({ state: "visible" }) som retrier indtil knappen vises (eller timeout).
  254 |         const nextPostBtn = page.getByRole("button", { name: /gaa til naeste post|gå til næste post|næste post|se resultat/i });
  255 |         const btnVisible = await nextPostBtn.waitFor({ state: "visible", timeout: 20_000 }).then(() => true).catch(() => false);
  256 | 
  257 |         // Diagnostik: hvad er i DOM-en?
  258 |         const allButtons = await page.evaluate(() =>
  259 |           Array.from(document.querySelectorAll("button")).map(b => b.textContent?.trim())
  260 |         );
  261 |         console.log("Knapper i DOM:", JSON.stringify(allButtons));
  262 | 
  263 |         await page.screenshot({ path: `test-results/debug-btn-check-${Date.now()}.png`, fullPage: true });
  264 | 
  265 |         const snapshotAdvanced = typeof snapshot?.currentPostIndex === "number" && snapshot.currentPostIndex >= 1;
  266 | 
  267 |         console.log(`Knap synlig: ${btnVisible} | Snapshot avanceret: ${snapshotAdvanced} | submits: ${mockState.submitCallCount}`);
  268 | 
  269 |         expect(
  270 |           btnVisible || snapshotAdvanced,
  271 |           `RACE CONDITION BUG DETECTED:\n` +
  272 |           `"Gaa til naeste post"-knap: ${btnVisible}\n` +
  273 |           `snapshot.currentPostIndex: ${snapshot?.currentPostIndex ?? "null"}\n` +
  274 |           `submits: ${mockState.submitCallCount}\n\n` +
  275 |           `ROOT CAUSE: markAnsweredPostIndex() saettes synkront i handleAnswer() INDEN insertAnswerRecord() returnerer.\n` +
  276 |           `isCurrentPostAnswered=true trigges useEffect => dismissCurrentPost() => showQuestion=false.\n` +
  277 |           `Naar insertAnswerRecord returnerer, er showQuestion=false => "Gaa til naeste post" vises ALDRIG.\n\n` +
  278 |           `FIX: Se GameState.tsx handleAnswer() + PlayInterface.tsx useEffect linje 251.`
> 279 |         ).toBe(true);
      |           ^ Error: RACE CONDITION BUG DETECTED:
  280 | 
  281 |         expect(mockState.submitCallCount).toBeGreaterThanOrEqual(1);
  282 | 
  283 |         if (btnVisible) {
  284 |           await nextPostBtn.click();
  285 |           await page.waitForTimeout(2_000);
  286 |           const snapshotAfter = await readPlaySnapshot(page);
  287 |           expect(snapshotAfter?.currentPostIndex).toBeGreaterThanOrEqual(1);
  288 |         }
  289 |       } finally {
  290 |         await ctx.close();
  291 |       }
  292 |     }
  293 |   );
  294 | });
  295 | 
```