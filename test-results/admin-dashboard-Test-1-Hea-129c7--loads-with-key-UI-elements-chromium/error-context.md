# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: admin-dashboard.spec.ts >> Test 1: Health Dashboard renders >> Health Dashboard loads with key UI elements
- Location: tests\admin-dashboard.spec.ts:122:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=1 time')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('text=1 time')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - button "Open Next.js Dev Tools" [ref=e7] [cursor=pointer]:
    - generic [ref=e10]:
      - text: Compiling
      - generic [ref=e11]:
        - generic [ref=e12]: .
        - generic [ref=e13]: .
        - generic [ref=e14]: .
  - alert [ref=e15]
  - generic [ref=e16]:
    - paragraph [ref=e19]: GPS-løb er i 'Fri Beta' og er 100% gratis frem til juli 2026. Vi håber, I bliver så glade for systemet, at I vil støtte med et abonnement til næste skoleår, så vi sammen kan sikre driften og videreudviklingen.
    - banner [ref=e21]:
      - generic [ref=e22]:
        - link "GPS Løb" [ref=e24] [cursor=pointer]:
          - /url: /dashboard
        - generic [ref=e25]:
          - navigation [ref=e26]:
            - link "Hjem" [ref=e27] [cursor=pointer]:
              - /url: /dashboard
              - img [ref=e28]
              - text: Hjem
            - link "Indstillinger" [ref=e31] [cursor=pointer]:
              - /url: /dashboard/indstillinger
              - img [ref=e32]
              - text: Indstillinger
          - generic [ref=e35]:
            - button "Taend baggrundslyd" [ref=e36]:
              - img [ref=e37]
              - generic [ref=e41]: Taend baggrundslyd
            - button "Log ud" [ref=e42]:
              - img [ref=e43]
              - text: Log ud
    - generic [ref=e47]:
      - banner [ref=e48]:
        - link "Dashboard" [ref=e49] [cursor=pointer]:
          - /url: /dashboard
          - img [ref=e50]
          - text: Dashboard
        - generic [ref=e52]:
          - generic [ref=e53]:
            - img [ref=e55]
            - generic [ref=e57]:
              - heading "Systemets Sundhed" [level=1] [ref=e58]
              - paragraph [ref=e59]: Overblik over aktivitet og sundhed
          - generic [ref=e60]:
            - generic [ref=e65]: Indlæser …
            - button "Opdater nu" [ref=e66]:
              - img [ref=e67]
      - generic [ref=e72]:
        - paragraph [ref=e73]: Kunne ikke hente sundhedsdata
        - paragraph [ref=e74]: Du skal være logget ind.
        - button "Prøv igen" [ref=e75]
    - button "Åbn Assistent" [ref=e77]:
      - img "GPSLØB logo" [ref=e78]
      - generic [ref=e80]: GPS-Assistent
```

# Test source

```ts
  81  |         body: JSON.stringify({
  82  |           id: TEACHER_USER_ID,
  83  |           email: "admin@test.dk",
  84  |           role: "authenticated",
  85  |           aud: "authenticated",
  86  |           app_metadata: { provider: "email" },
  87  |           user_metadata: { full_name: "Admin Test" },
  88  |           created_at: "2024-01-01T00:00:00Z",
  89  |         }),
  90  |       });
  91  |       return;
  92  |     }
  93  |     await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  94  |   });
  95  | 
  96  |   await ctx.route("**/realtime/**", async (route: Route) => {
  97  |     await route.abort("connectionrefused");
  98  |   });
  99  | }
  100 | 
  101 | async function injectAuthCookie(page: Page) {
  102 |   await page.context().addCookies([
  103 |     {
  104 |       name: "sb-xodrzahqdgbsssntupjt-auth-token.0",
  105 |       value: makeAuthCookieValue(),
  106 |       domain: "localhost",
  107 |       path: "/",
  108 |       httpOnly: false,
  109 |       secure: false,
  110 |       sameSite: "Lax",
  111 |     },
  112 |   ]);
  113 | }
  114 | 
  115 | // ---------------------------------------------------------------------------
  116 | // Test 1: Health Dashboard renders
  117 | // ---------------------------------------------------------------------------
  118 | 
  119 | test.describe("Test 1: Health Dashboard renders", () => {
  120 |   test.use({ actionTimeout: 15_000 });
  121 | 
  122 |   test("Health Dashboard loads with key UI elements", async ({ page }) => {
  123 |     await setupAuthMocks(page);
  124 | 
  125 |     // Mock REST (profiles)
  126 |     await page.context().route("**/rest/v1/**", async (route: Route) => {
  127 |       const url = route.request().url();
  128 |       if (url.includes("profiles")) {
  129 |         await route.fulfill({
  130 |           status: 200,
  131 |           contentType: "application/json",
  132 |           body: JSON.stringify({
  133 |             id: TEACHER_USER_ID,
  134 |             plan_type: "premium",
  135 |             beta_access: true,
  136 |           }),
  137 |         });
  138 |         return;
  139 |       }
  140 |       await route.fulfill({
  141 |         status: 200,
  142 |         contentType: "application/json",
  143 |         body: JSON.stringify([]),
  144 |       });
  145 |     });
  146 | 
  147 |     // Mock the health API to return valid data
  148 |     await page.route("**/api/admin/health**", async (route: Route) => {
  149 |       await route.fulfill({
  150 |         status: 200,
  151 |         contentType: "application/json",
  152 |         body: JSON.stringify({
  153 |           activeSessions: 3,
  154 |           liveStudents: 42,
  155 |           runsCreated: 17,
  156 |           stjerneloebCreated: 2,
  157 |           correctAnswerRate: 73,
  158 |           totalAnswersToday: 512,
  159 |           raceTypes: [
  160 |             { race_type: "manuel", count: 8 },
  161 |             { race_type: "matematik", count: 5 },
  162 |             { race_type: "foto", count: 4 },
  163 |           ],
  164 |           generatedAt: new Date().toISOString(),
  165 |           hours: 24,
  166 |         }),
  167 |       });
  168 |     });
  169 | 
  170 |     await injectAuthCookie(page);
  171 | 
  172 |     await page.goto("/dashboard/admin", { waitUntil: "domcontentloaded", timeout: 30_000 });
  173 | 
  174 |     // Wait for data to load
  175 |     await page.waitForTimeout(2000);
  176 | 
  177 |     // Verify the title is present
  178 |     await expect(page.locator("text=Systemets Sundhed")).toBeVisible({ timeout: 10_000 });
  179 | 
  180 |     // Verify time filter buttons exist
> 181 |     await expect(page.locator("text=1 time")).toBeVisible();
      |                                               ^ Error: expect(locator).toBeVisible() failed
  182 |     await expect(page.locator("text=12 timer")).toBeVisible();
  183 | 
  184 |     // Verify metric values appear
  185 |     await expect(page.locator("text=42")).toBeVisible(); // liveStudents
  186 |     await expect(page.locator("text=73%")).toBeVisible(); // correctAnswerRate
  187 | 
  188 |     // Verify the developer logs link exists with the correct text
  189 |     await expect(
  190 |       page.locator("text=Se teknisk log (Kun for udviklere) →")
  191 |     ).toBeVisible();
  192 |   });
  193 | });
  194 | 
  195 | // ---------------------------------------------------------------------------
  196 | // Test 2: Health API returns valid JSON
  197 | // ---------------------------------------------------------------------------
  198 | 
  199 | test.describe("Test 2: Health API endpoint alive", () => {
  200 |   test("GET /api/admin/health returns structured JSON or 401", async ({
  201 |     request,
  202 |   }) => {
  203 |     const response = await request.get("/api/admin/health?hours=1");
  204 |     const status = response.status();
  205 | 
  206 |     // Without auth we expect 401, which proves the endpoint is alive
  207 |     expect([200, 401, 503]).toContain(status);
  208 |   });
  209 | });
  210 | 
  211 | // ---------------------------------------------------------------------------
  212 | // Test 3: Logs page renders with Kopiér til AI button
  213 | // ---------------------------------------------------------------------------
  214 | 
  215 | test.describe("Test 3: Logs page with Copy-to-AI button", () => {
  216 |   test.use({ actionTimeout: 15_000 });
  217 | 
  218 |   test("Logs page loads and contains Kopiér til AI button in source", async () => {
  219 |     // Structural verification that the copy button exists in the logs page
  220 |     const fs = await import("fs");
  221 |     const path = await import("path");
  222 |     const logsPagePath = path.resolve(
  223 |       __dirname,
  224 |       "..",
  225 |       "app",
  226 |       "dashboard",
  227 |       "admin",
  228 |       "logs",
  229 |       "page.tsx"
  230 |     );
  231 |     const source = fs.readFileSync(logsPagePath, "utf-8");
  232 | 
  233 |     // Verify the copy button exists
  234 |     expect(source).toContain("Kopiér til AI");
  235 | 
  236 |     // Verify clipboard usage
  237 |     expect(source).toContain("navigator.clipboard.writeText");
  238 | 
  239 |     // Verify toast state exists
  240 |     expect(source).toContain("copyToast");
  241 | 
  242 |     // Verify the ClipboardCopy icon is imported
  243 |     expect(source).toContain("ClipboardCopy");
  244 |   });
  245 | });
  246 | 
  247 | // ---------------------------------------------------------------------------
  248 | // Test 4: Health Dashboard links to logs page
  249 | // ---------------------------------------------------------------------------
  250 | 
  251 | test.describe("Test 4: Dashboard-to-logs navigation", () => {
  252 |   test("Health Dashboard source contains link to /dashboard/admin/logs", async () => {
  253 |     const fs = await import("fs");
  254 |     const path = await import("path");
  255 |     const dashboardPath = path.resolve(
  256 |       __dirname,
  257 |       "..",
  258 |       "app",
  259 |       "dashboard",
  260 |       "admin",
  261 |       "page.tsx"
  262 |     );
  263 |     const source = fs.readFileSync(dashboardPath, "utf-8");
  264 | 
  265 |     // Verify the link to logs
  266 |     expect(source).toContain("/dashboard/admin/logs");
  267 |     expect(source).toContain("Kun for udviklere");
  268 |   });
  269 | });
  270 | 
```