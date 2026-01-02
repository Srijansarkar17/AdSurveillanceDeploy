"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseYouTubeAds = parseYouTubeAds;
async function parseYouTubeAds(page) {
    const ads = [];
    // Grab elements that usually contain ad metadata
    const cards = await page.locator('[aria-label]').all();
    for (const card of cards.slice(0, 5)) {
        const label = await card.getAttribute('aria-label');
        const text = await card.textContent();
        // Filter noise
        if ((!label && !text) ||
            (text && text.length < 40)) {
            continue;
        }
        ads.push({
            advertiser: 'YouTube Advertiser',
            creative: (label || text || '').slice(0, 300)
        });
    }
    return ads;
}
