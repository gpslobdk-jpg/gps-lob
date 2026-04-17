# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: phase42-photo-builder.spec.ts >> Premium Photo Builder >> Teacher can create a Photo Race and see it in the archive
- Location: tests\phase42-photo-builder.spec.ts:6:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
Call log:
  - navigating to "http://localhost:3000/dashboard/opret/foto", waiting until "load"

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | // Phase 42: E2E test for the upgraded Photo Builder
  4  | 
  5  | test.describe('Premium Photo Builder', () => {
  6  |   test('Teacher can create a Photo Race and see it in the archive', async ({ page }) => {
  7  |     // Go to the Photo Builder
> 8  |     await page.goto('/dashboard/opret/foto');
     |                ^ Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
  9  | 
  10 |     // Fill in the Race Title
  11 |     await page.getByPlaceholder('Titel på løbet').fill('Phase 42 - E2E Test Race');
  12 | 
  13 |     // Add a new Photo Mission
  14 |     await page.getByRole('button', { name: /Tilføj mission/i }).click();
  15 | 
  16 |     // Fill in the student instruction
  17 |     await page.getByPlaceholder("Missionsbeskrivelse til eleverne").first().fill('Find et træ og tag et billede');
  18 | 
  19 |     // Fill in the AI prompt
  20 |     await page.getByPlaceholder("Hvad skal AI'en validere?").first().fill('træ');
  21 | 
  22 |     // Fill in the points (optional, default is 10)
  23 |     await page.getByPlaceholder('Point').first().fill('15');
  24 | 
  25 |     // Click 'Sæt på kort' and simulate a map click
  26 |     await page.getByRole('button', { name: /Sæt på kort/i }).first().click();
  27 |     // Simulate a map click (center of the map)
  28 |     const map = await page.locator('.leaflet-container');
  29 |     const box = await map.boundingBox();
  30 |     if (box) {
  31 |       await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  32 |     }
  33 | 
  34 |     // Click 'Gem Løb'
  35 |     await page.getByRole('button', { name: /Gem Løb/i }).click();
  36 | 
  37 |     // Wait for save feedback
  38 |     await expect(page.getByText(/Løbet blev gemt/i)).toBeVisible({ timeout: 5000 });
  39 | 
  40 |     // Go to the archive
  41 |     await page.goto('/dashboard/arkiv');
  42 | 
  43 |     // Assert the new race is visible
  44 |     await expect(page.getByText('Phase 42 - E2E Test Race')).toBeVisible();
  45 |   });
  46 | });
  47 | 
```