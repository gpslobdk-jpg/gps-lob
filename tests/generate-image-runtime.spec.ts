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
