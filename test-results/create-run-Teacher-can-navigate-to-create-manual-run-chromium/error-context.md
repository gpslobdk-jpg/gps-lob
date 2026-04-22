# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: create-run.spec.ts >> Teacher can navigate to create manual run
- Location: tests\create-run.spec.ts:100:5

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: expect(locator).toBeVisible() failed

Locator: getByPlaceholder('F.eks. 6.A\'s store videnløb')
Expected: visible
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByPlaceholder('F.eks. 6.A\'s store videnløb')

```

# Page snapshot

```yaml
- generic [ref=e6]:
  - img "GPSLØB logo" [ref=e8]
  - heading "Åbner dit dashboard" [level=1] [ref=e11]
  - paragraph [ref=e12]: Vi læser din session færdig, så du lander det rigtige sted uden auth-flicker.
```

# Test source

```ts
  22  | 
  23  |   return (
  24  |     "base64-" +
  25  |     Buffer.from(JSON.stringify(session))
  26  |       .toString("base64")
  27  |       .replace(/\+/g, "-")
  28  |       .replace(/\//g, "_")
  29  |       .replace(/=+$/, "")
  30  |   );
  31  | }
  32  | 
  33  | async function setupAuthMocks(page: Page) {
  34  |   const ctx = page.context();
  35  | 
  36  |   await ctx.route("**/auth/v1/**", async (route: Route) => {
  37  |     const url = route.request().url();
  38  |     if (url.includes("/token") || url.includes("/session")) {
  39  |       await route.fulfill({
  40  |         status: 200,
  41  |         contentType: "application/json",
  42  |         body: JSON.stringify({
  43  |           access_token: "mock-access-token",
  44  |           token_type: "bearer",
  45  |           expires_in: 36000,
  46  |           refresh_token: "mock-refresh-token",
  47  |           user: {
  48  |             id: TEACHER_USER_ID,
  49  |             email: "teacher@test.dk",
  50  |             role: "authenticated",
  51  |             aud: "authenticated",
  52  |             app_metadata: { provider: "email" },
  53  |             user_metadata: { full_name: "Teacher Test" },
  54  |             created_at: "2024-01-01T00:00:00Z",
  55  |           },
  56  |         }),
  57  |       });
  58  |       return;
  59  |     }
  60  | 
  61  |     if (url.includes("/user")) {
  62  |       await route.fulfill({
  63  |         status: 200,
  64  |         contentType: "application/json",
  65  |         body: JSON.stringify({
  66  |           id: TEACHER_USER_ID,
  67  |           email: "teacher@test.dk",
  68  |           role: "authenticated",
  69  |           aud: "authenticated",
  70  |           app_metadata: { provider: "email" },
  71  |           user_metadata: { full_name: "Teacher Test" },
  72  |           created_at: "2024-01-01T00:00:00Z",
  73  |         }),
  74  |       });
  75  |       return;
  76  |     }
  77  | 
  78  |     await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  79  |   });
  80  | 
  81  |   await ctx.route("**/realtime/**", async (route: Route) => {
  82  |     await route.abort("connectionrefused");
  83  |   });
  84  | }
  85  | 
  86  | async function injectAuthCookie(page: Page) {
  87  |   await page.context().addCookies([
  88  |     {
  89  |       name: "sb-xodrzahqdgbsssntupjt-auth-token.0",
  90  |       value: makeAuthCookieValue(),
  91  |       domain: "localhost",
  92  |       path: "/",
  93  |       httpOnly: false,
  94  |       secure: false,
  95  |       sameSite: "Lax",
  96  |     },
  97  |   ]);
  98  | }
  99  | 
  100 | test("Teacher can navigate to create manual run", async ({ page }) => {
  101 |   await setupAuthMocks(page);
  102 | 
  103 |   // Minimal REST mock to avoid external failures while loading the builder
  104 |   await page.context().route("**/rest/v1/**", async (route: Route) => {
  105 |     const url = route.request().url();
  106 |     if (url.includes("profiles")) {
  107 |       await route.fulfill({
  108 |         status: 200,
  109 |         contentType: "application/json",
  110 |         body: JSON.stringify({ id: TEACHER_USER_ID, plan_type: "free", beta_access: false }),
  111 |       });
  112 |       return;
  113 |     }
  114 |     await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
  115 |   });
  116 | 
  117 |   await injectAuthCookie(page);
  118 | 
  119 |   await page.goto("/dashboard/opret/manuel", { waitUntil: "domcontentloaded", timeout: 30_000 });
  120 | 
  121 |   // Verify main form's title input is visible
> 122 |   await expect(page.getByPlaceholder("F.eks. 6.A's store videnløb")).toBeVisible({ timeout: 10_000 });
      |                                                                      ^ Error: expect(locator).toBeVisible() failed
  123 | });
  124 | 
```