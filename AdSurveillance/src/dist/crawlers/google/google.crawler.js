"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.crawlGoogleAds = crawlGoogleAds;
const playwright_1 = require("playwright");
const google_parser_1 = require("./google.parser");
async function crawlGoogleAds(keyword, region = 'IN') {
    const browser = await playwright_1.chromium.launch({
        headless: true
    });
    const page = await browser.newPage({
        locale: 'en-US',
        timezoneId: 'Asia/Kolkata'
    });
    const url = `https://adstransparency.google.com/?region=${region}&q=${encodeURIComponent(keyword)}`;
    try {
        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        // Google ads load lazily
        await page.waitForTimeout(8000);
        // Scroll multiple times to trigger rendering
        for (let i = 0; i < 5; i++) {
            await page.mouse.wheel(0, 2500);
            await page.waitForTimeout(2000);
        }
        // Safety wait
        await page.waitForTimeout(3000);
        const ads = await (0, google_parser_1.parseGoogleAds)(page);
        return ads || [];
    }
    catch (error) {
        console.error('❌ Google crawler failed', error);
        return [];
    }
    finally {
        await browser.close();
    }
}
