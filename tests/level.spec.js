const { test, expect } = require('@playwright/test');

test.describe('Level Generation Tests', () => {

    test('Level generates with significant branches', async ({ page }) => {
        await page.goto('/');
        await page.locator('#gameCanvas').waitFor();
        await page.keyboard.press('Space');
        await page.waitForTimeout(500);

        // Get level data
        const roomCount = await page.evaluate(() => Object.keys(window.visitedRooms).length + Object.keys(window.levelMap).length);
        // Wait, levelMap has all rooms. visitedRooms is just visited.
        const levelMapKeys = await page.evaluate(() => Object.keys(window.levelMap).length);
        const goldenPathLength = await page.evaluate(() => window.goldenPath.length);

        console.log(`Rooms: ${levelMapKeys}, Golden Path: ${goldenPathLength}`);

        // With deep branches, total rooms should be significantly higher than golden path
        // e.g., if path is 5, and we have 50% chance of 1-3 branches, we expect ~2-4 extra rooms minimum
        // Let's just assert it's strictly greater than path + 1 (generous buffer)
        expect(levelMapKeys).toBeGreaterThan(goldenPathLength + 1);
    });
});
