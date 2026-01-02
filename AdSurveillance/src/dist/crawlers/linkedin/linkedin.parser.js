"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseLinkedInAds = parseLinkedInAds;
exports.extractLinkedInAdvertiser = extractLinkedInAdvertiser;
exports.isLikelyLinkedInAd = isLikelyLinkedInAd;
exports.parseLinkedInAdsForCompetitor = parseLinkedInAdsForCompetitor;
exports.extractLinkedInMetadata = extractLinkedInMetadata;
/**
 * Parse LinkedIn ads from page content
 */
async function parseLinkedInAds(page) {
    try {
        // Get text content from div elements
        const texts = await page.$$eval('div', (nodes) => nodes
            .map((n) => {
            const text = n.textContent || '';
            return text
                .replace(/\s+/g, ' ')
                .trim();
        })
            // Keep only meaningful blocks
            .filter((t) => t.length > 120 && t.length < 1000));
        console.log(`🔍 LinkedIn text blocks found: ${texts.length}`);
        // 🔑 Deduplicate using fingerprints
        const uniqueAds = new Map();
        for (const text of texts) {
            // Check if text looks like an ad
            if (!isLikelyLinkedInAd(text)) {
                continue;
            }
            const fingerprint = text.slice(0, 150).toLowerCase();
            if (!uniqueAds.has(fingerprint)) {
                uniqueAds.set(fingerprint, text.slice(0, 300));
            }
        }
        const results = Array.from(uniqueAds.values());
        console.log(`💼 LinkedIn ads after dedupe: ${results.length}`);
        // Format results with extracted advertiser names
        return results.map(creative => ({
            advertiser: extractLinkedInAdvertiser(creative),
            creative
        }));
    }
    catch (error) {
        console.error('❌ Error parsing LinkedIn ads:', error);
        return [];
    }
}
/**
 * Extract advertiser name from LinkedIn ad creative
 */
function extractLinkedInAdvertiser(creative) {
    try {
        // LinkedIn ads often have company name at the beginning
        const lines = creative.split('\n').map(line => line.trim());
        // Look for company name patterns
        for (const line of lines) {
            // Company names are usually short and don't contain common ad text
            if (line && line.length < 50) {
                const lowerLine = line.toLowerCase();
                const isNotAdText = !lowerLine.includes('promoted') &&
                    !lowerLine.includes('sponsored') &&
                    !lowerLine.includes('advertisement') &&
                    !lowerLine.includes('•') &&
                    !lowerLine.includes('|');
                if (isNotAdText) {
                    return line;
                }
            }
        }
        // Look for "Promoted by" pattern
        const promotedMatch = creative.match(/Promoted\s+(?:by\s+)?([^\n•|]+)/i);
        if (promotedMatch) {
            return promotedMatch[1].trim();
        }
        return 'LinkedIn Advertiser';
    }
    catch (error) {
        return 'LinkedIn Advertiser';
    }
}
/**
 * Check if text is likely a LinkedIn ad
 */
function isLikelyLinkedInAd(text) {
    if (!text || text.length < 120 || text.length > 1000) {
        return false;
    }
    const lowerText = text.toLowerCase();
    // LinkedIn ad indicators
    const adIndicators = [
        'promoted',
        'sponsored',
        'advertisement',
        'ad',
        'boosted post',
        'paid promotion',
        'promoted content',
        'sponsored content'
    ];
    // Non-ad indicators (UI elements, navigation, etc.)
    const nonAdIndicators = [
        'home',
        'my network',
        'jobs',
        'messaging',
        'notifications',
        'work',
        'profile',
        'search',
        'sign in',
        'sign up',
        'privacy',
        'terms',
        'cookie'
    ];
    const hasAdIndicator = adIndicators.some(indicator => lowerText.includes(indicator));
    const hasNonAdIndicator = nonAdIndicators.some(indicator => lowerText.includes(indicator));
    // LinkedIn ads often have engagement metrics
    const hasEngagement = lowerText.includes('like') ||
        lowerText.includes('comment') ||
        lowerText.includes('share') ||
        lowerText.includes('repost');
    return hasAdIndicator && !hasNonAdIndicator && hasEngagement;
}
/**
 * Parse LinkedIn ads with competitor filtering
 */
async function parseLinkedInAdsForCompetitor(page, competitorName) {
    try {
        const ads = await parseLinkedInAds(page);
        // Filter for competitor-specific ads
        const competitorAds = ads.filter(ad => {
            const lowerCreative = ad.creative.toLowerCase();
            const lowerCompetitor = competitorName.toLowerCase();
            return lowerCreative.includes(lowerCompetitor);
        });
        console.log(`🎯 LinkedIn ads for ${competitorName}: ${competitorAds.length}`);
        return competitorAds.map(ad => ({
            advertiser: ad.advertiser,
            creative: ad.creative,
            platform: 'linkedin'
        }));
    }
    catch (error) {
        console.error('❌ Error parsing LinkedIn ads for competitor:', error);
        return [];
    }
}
function extractLinkedInMetadata(creative) {
    const metadata = {};
    try {
        const lines = creative.split('\n');
        // Look for engagement metrics
        for (const line of lines) {
            const lowerLine = line.toLowerCase();
            if (lowerLine.includes('like') || lowerLine.includes('comment') || lowerLine.includes('share')) {
                metadata.engagement = line.trim();
            }
            if (lowerLine.includes('ago') || lowerLine.includes('day') || lowerLine.includes('hour') || lowerLine.includes('minute')) {
                metadata.timePosted = line.trim();
            }
            if (lowerLine.includes('targeting') || lowerLine.includes('audience') || lowerLine.includes('demographic')) {
                metadata.audience = line.trim();
            }
            if (lowerLine.includes('apply') || lowerLine.includes('learn more') || lowerLine.includes('sign up') ||
                lowerLine.includes('get started') || lowerLine.includes('contact us')) {
                metadata.callToAction = line.trim();
            }
        }
    }
    catch (error) {
        console.error('Error extracting LinkedIn metadata:', error);
    }
    return metadata;
}
