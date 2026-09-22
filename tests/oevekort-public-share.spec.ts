import { expect, test } from "@playwright/test";

const shareToken = "a".repeat(43);

test.describe("Øvekort public share", () => {
  test("loads a shared set from a hash token, then removes the token from the URL", async ({
    page,
  }) => {
    let requestedToken: unknown = null;

    await page.route("**/api/oevekort/public", async (route) => {
      requestedToken = route.request().postDataJSON()?.token;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          set: {
            title: "Tyske gloser",
            cards: [
              { id: "1", front: "Hund", back: "der Hund", acceptedAnswers: [] },
              { id: "2", front: "Kat", back: "die Katze", acceptedAnswers: [] },
              { id: "3", front: "Fugl", back: "der Vogel", acceptedAnswers: [] },
            ],
          },
        }),
      });
    });

    await page.goto(`/oevekort/del#${shareToken}`);

    await expect(page.getByRole("heading", { name: "Tyske gloser" })).toBeVisible();
    expect(requestedToken).toBe(shareToken);
    expect(new URL(page.url()).hash).toBe("");
    await expect(page.getByRole("button", { name: "Åbn SkoleGPS-assistent" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Start øvelsen" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Hund.*Tryk for at vende kortet/i })).toHaveCount(0);

    const persistedTokens = await page.evaluate(() => {
      const values = [
        ...Object.values(localStorage),
        ...Object.values(sessionStorage),
      ];
      return values.filter((value) => value.includes("a".repeat(43)));
    });
    expect(persistedTokens).toEqual([]);

    await page.getByRole("button", { name: "Start øvelsen" }).click();
    await page.getByRole("button", { name: /Hund.*Tryk for at vende kortet/i }).click();
    await expect(page.getByRole("button", { name: /Bagside der Hund/i })).toBeVisible();

    await page.getByRole("button", { name: "Skriv" }).click();
    await page.getByLabel("Dit svar").fill("der Hund");
    await page.getByRole("button", { name: "Tjek svar" }).click();
    await expect(page.getByText("Det er rigtigt.")).toBeVisible();

    await page.getByRole("button", { name: "Match" }).click();
    await expect(page.getByText("Find parrene")).toBeVisible();
  });
});
