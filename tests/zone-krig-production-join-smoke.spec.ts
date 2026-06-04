import { expect, test, type Page } from "@playwright/test";

const BASE_URL = process.env.ZONE_KRIG_SMOKE_BASE_URL ?? "https://www.gpslob.dk";
const PIN = process.env.ZONE_KRIG_SMOKE_PIN ?? "";
const SESSION_ID = process.env.ZONE_KRIG_SMOKE_SESSION_ID ?? "";

async function waitForHydratedJoinForm(page: Page) {
  const pinInput = page.locator('input[inputmode="numeric"]');
  const nameInput = page.locator('input[placeholder="Dit navn"]');
  const submitButton = page.locator("form").locator('button[type="submit"]');

  await page.waitForLoadState("load");
  await expect(pinInput).toBeVisible({ timeout: 15_000 });
  await expect(nameInput).toBeVisible({ timeout: 15_000 });
  await expect(submitButton).toBeVisible({ timeout: 15_000 });

  await page.waitForFunction(
    () => {
      const input = document.querySelector('input[placeholder="Dit navn"]');
      return input ? Object.keys(input).some((key) => key.startsWith("__reactProps$")) : false;
    },
    null,
    { timeout: 15_000 }
  );

  return { pinInput, nameInput, submitButton };
}

async function fillJoinForm(page: Page, pin: string, name: string) {
  const { pinInput, nameInput, submitButton } = await waitForHydratedJoinForm(page);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await pinInput.fill("");
    await pinInput.fill(pin);
    await nameInput.fill("");
    await nameInput.fill(name);

    try {
      await expect(pinInput).toHaveValue(pin, { timeout: 3_000 });
      await expect(nameInput).toHaveValue(name, { timeout: 3_000 });
      await expect(submitButton).toBeEnabled({ timeout: 3_000 });
      return submitButton;
    } catch {
      await expect(nameInput).toBeVisible({ timeout: 15_000 });
    }
  }

  await expect(submitButton).toBeEnabled({ timeout: 3_000 });
  return submitButton;
}

test("Zone Krig production join waits for React hydration", async ({ page }) => {
  test.skip(!PIN || !SESSION_ID, "Set ZONE_KRIG_SMOKE_PIN and ZONE_KRIG_SMOKE_SESSION_ID.");

  const studentName = `P1-smoke-${String(Date.now()).slice(-6)}`;
  await page.goto(`${BASE_URL}/join?pin=${encodeURIComponent(PIN)}`, { waitUntil: "domcontentloaded" });

  const submitButton = await fillJoinForm(page, PIN, studentName);
  await Promise.all([
    page.waitForURL(new RegExp(`/play/${SESSION_ID}(?:[/?#]|$)`), { timeout: 30_000 }),
    submitButton.click(),
  ]);

  await expect(page).toHaveURL(new RegExp(`/play/${SESSION_ID}(?:[/?#]|$)`));
});
