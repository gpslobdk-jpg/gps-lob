import { expect, test } from "@playwright/test";

test("generate-image loads without a key and performs no OpenAI request", async ({ request }) => {
  const response = await request.post("/api/generate-image", {
    data: {
      questionText: "Hvad er fotosyntese?",
      subject: "Naturfag",
      topic: "Planter",
    },
  });

  expect(response.status()).toBe(503);
  await expect(response.json()).resolves.toEqual({
    error: "Billedgenerering er ikke tilgængelig lige nu",
  });
});

test("generate-image keeps request validation ahead of optional key handling", async ({ request }) => {
  const response = await request.post("/api/generate-image", { data: {} });

  expect(response.status()).toBe(400);
  await expect(response.json()).resolves.toEqual({ error: "Data mangler" });
});

for (const route of ["/api/roleplay-response", "/api/stjerneloeb-generate"]) {
  test(`${route} loads without a key and performs no OpenAI request`, async ({ request }) => {
    const response = await request.post(route, { data: {} });

    expect(response.status()).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "OPENAI_API_KEY mangler i miljøet.",
    });
  });
}
