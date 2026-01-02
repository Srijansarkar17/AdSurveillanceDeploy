"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.crawlLinkedInAds = crawlLinkedInAds;
const playwright_1 = require("playwright");
const linkedin_parser_1 = require("./linkedin.parser");
async function crawlLinkedInAds(keyword) {
    const context = await playwright_1.chromium.launchPersistentContext('./linkedin-session', {
        headless: true,
        viewport: { width: 1280, height: 800 }
    });
    const page = await context.newPage();
    const url = `https://www.linkedin.com/ad-library/search?keywords=${encodeURIComponent(keyword)}`;
    try {
        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        // Allow ads to render
        await page.waitForTimeout(8000);
        // Scroll to load ads
        for (let i = 0; i < 6; i++) {
            await page.mouse.wheel(0, 3000);
            await page.waitForTimeout(2000);
        }
        const ads = await (0, linkedin_parser_1.parseLinkedInAds)(page);
        return ads;
    }
    catch (err) {
        console.error('❌ LinkedIn crawler failed', err);
        return [];
    }
    finally {
        await context.close();
    }
}
