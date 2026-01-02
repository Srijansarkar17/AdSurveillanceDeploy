"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseGoogleAds = parseGoogleAds;
/**
 * Parse Google ads from page content
 */
async function parseGoogleAds(page) {
    try {
        const texts = await page.$$eval('div, span, a', (nodes) => nodes
            .map((n) => {
            const text = n.textContent || '';
            return text
                .replace(/\s+/g, ' ')
                .trim();
        })
            .filter((t) => t.length > 30 && t.length < 500));
        // Filter for ad-like text
        const adTexts = texts.filter((text) => text.toLowerCase().includes('ad') ||
            text.toLowerCase().includes('sponsored') ||
            text.includes('$') ||
            text.includes('buy') ||
            text.includes('sale') ||
            text.includes('discount'));
        return Array.from(new Set(adTexts)); // Remove duplicates
    }
    catch (error) {
        console.error('❌ Error parsing Google ads:', error);
        return [];
    }
}
