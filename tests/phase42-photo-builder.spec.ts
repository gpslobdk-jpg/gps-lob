import { test, expect } from '@playwright/test';

// Phase 42: E2E test for the upgraded Photo Builder

test.describe('Premium Photo Builder', () => {
  test('Teacher can create a Photo Race and see it in the archive', async ({ page }) => {
    // Go to the Photo Builder
    await page.goto('/dashboard/opret/foto');

    // Fill in the Race Title
    await page.getByPlaceholder('Titel på løbet').fill('Phase 42 - E2E Test Race');

    // Add a new Photo Mission
    await page.getByRole('button', { name: /Tilføj mission/i }).click();

    // Fill in the student instruction
    await page.getByPlaceholder("Missionsbeskrivelse til eleverne").first().fill('Find et træ og tag et billede');

    // Fill in the AI prompt
    await page.getByPlaceholder("Hvad skal AI'en validere?").first().fill('træ');

    // Fill in the points (optional, default is 10)
    await page.getByPlaceholder('Point').first().fill('15');

    // Click 'Sæt på kort' and simulate a map click
    await page.getByRole('button', { name: /Sæt på kort/i }).first().click();
    // Simulate a map click (center of the map)
    const map = await page.locator('.leaflet-container');
    const box = await map.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    }

    // Click 'Gem Løb'
    await page.getByRole('button', { name: /Gem Løb/i }).click();

    // Wait for save feedback
    await expect(page.getByText(/Løbet blev gemt/i)).toBeVisible({ timeout: 5000 });

    // Go to the archive
    await page.goto('/dashboard/arkiv');

    // Assert the new race is visible
    await expect(page.getByText('Phase 42 - E2E Test Race')).toBeVisible();
  });
});
