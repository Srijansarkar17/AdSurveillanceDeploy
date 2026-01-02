"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ingestAds = ingestAds;
exports.validateAdData = validateAdData;
exports.ingestAdsFromMultiplePlatforms = ingestAdsFromMultiplePlatforms;
exports.hasTodaysAds = hasTodaysAds;
exports.getIngestionStats = getIngestionStats;
const platforms_1 = require("../config/platforms");
const competitors_repo_1 = require("../db/competitors.repo");
const dailyMetrics_repo_1 = require("../db/dailyMetrics.repo");
const supabase_1 = require("../config/supabase");
const adsCreatives_repo_1 = require("../db/adsCreatives.repo"); // FIXED IMPORT
function estimateImpressions() {
    return Math.floor(8000 + Math.random() * 12000);
}
/**
 * Clean and sanitize creative text to prevent JSON errors
 */
function cleanCreativeText(text) {
    if (!text)
        return null;
    try {
        // 1. Remove null bytes and control characters
        let cleaned = text
            .replace(/\x00/g, '') // Remove null bytes
            .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control chars
            .replace(/\r\n/g, '\n') // Normalize line endings
            .replace(/\r/g, '\n');
        // 2. Remove invalid Unicode surrogates (main cause of your error)
        cleaned = cleaned.replace(/[\uD800-\uDFFF]/g, '');
        // 3. Escape JSON special characters
        cleaned = cleaned
            .replace(/\\/g, '\\\\') // Escape backslashes first
            .replace(/"/g, '\\"') // Escape double quotes
            .replace(/\n/g, '\\n') // Escape newlines
            .replace(/\t/g, '\\t') // Escape tabs
            .replace(/\f/g, '\\f') // Escape form feeds
            .replace(/\b/g, '\\b') // Escape backspace
            .replace(/\r/g, '\\r'); // Escape carriage returns
        // 4. Remove any remaining non-printable characters
        cleaned = cleaned.replace(/[^\x20-\x7E\x0A\x0D\x09]/g, '');
        // 5. Trim and check length
        cleaned = cleaned.trim();
        if (cleaned.length < 40) {
            console.log(`⚠️ Creative too short after cleaning: ${cleaned.length} chars`);
            return null;
        }
        // 6. Test JSON serialization
        try {
            JSON.stringify(cleaned);
            return cleaned;
        }
        catch (jsonError) {
            console.log(`⚠️ JSON validation failed after cleaning`);
            return null;
        }
    }
    catch (error) {
        console.log(`⚠️ Error cleaning creative: ${error}`);
        return null;
    }
}
/**
 * Check if we already have today's data for this competitor and platform
 */
async function hasTodaysData(competitorId, platform, userId) {
    const today = new Date().toISOString().split('T')[0];
    const { count, error } = await supabase_1.supabase
        .from('daily_metrics')
        .select('*', { count: 'exact', head: true })
        .eq('competitor_id', competitorId)
        .eq('platform', platform)
        .eq('user_id', userId) // CRITICAL: Add user filter
        .eq('date', today);
    if (error) {
        console.error('❌ ERROR CHECKING TODAYS DATA:', error);
        return false;
    }
    return (count || 0) > 0;
}
/**
 * Save ad creative to advertisements table
 */
async function saveAdCreative(adData, competitorId, competitorName, platform, userId) {
    try {
        const cleanedCreative = cleanCreativeText(adData.creative);
        if (!cleanedCreative)
            return null;
        // Prepare ad creative input
        const adCreativeInput = {
            competitor_id: competitorId,
            competitor_name: competitorName,
            user_id: userId,
            platform: platform,
            creative: cleanedCreative,
            headline: adData.headline || '',
            description: adData.description || '',
            image_url: adData.imageUrl || '',
            video_url: adData.videoUrl || '',
            landing_page: adData.landingPage || '',
            call_to_action: adData.callToAction || '',
            ad_type: adData.ad_type || 'text',
            advertiser: adData.advertiser || '',
            seen_on: adData.seen_on || '',
            first_seen: adData.first_seen || new Date().toISOString(),
            estimated_impressions: adData.estimatedSpend ? Math.round(adData.estimatedSpend * 1000 / 8) : 0,
            estimated_spend: adData.estimatedSpend || 0
        };
        // Insert ad creative using the correct function
        const adCreative = await (0, adsCreatives_repo_1.insertAdCreative)(adCreativeInput);
        return adCreative.id;
    }
    catch (error) {
        console.error('❌ Error in saveAdCreative:', error);
        return null;
    }
}
async function ingestAds(platform, ads, competitorName, userId) {
    console.log(`🔥 INGESTING ADS for ${competitorName} on ${platform} (${ads.length} ads) for user ${userId}`);
    // Use ISO date format for consistency
    const today = new Date().toISOString().split('T')[0];
    // Get or create competitor - MAKE SURE THIS FUNCTION ACCEPTS userId
    const competitor = await (0, competitors_repo_1.upsertCompetitor)(competitorName, userId);
    // Check if we already have data for today
    const alreadyProcessed = await hasTodaysData(competitor.id, platform, userId);
    if (alreadyProcessed) {
        console.log(`⏭️ Skipping ${competitorName} on ${platform} - already processed today for user ${userId}`);
        return 0;
    }
    const metricsToInsert = [];
    let successfulInserts = 0;
    let skippedCount = 0;
    let jsonErrorCount = 0;
    // Process each ad
    for (const [index, ad] of ads.entries()) {
        const originalCreative = ad.creative?.trim();
        // Skip if creative is too short or invalid
        if (!originalCreative || originalCreative.length < 40) {
            skippedCount++;
            continue;
        }
        // Clean the creative text to prevent JSON errors
        const cleanedCreative = cleanCreativeText(originalCreative);
        if (!cleanedCreative) {
            jsonErrorCount++;
            if (jsonErrorCount <= 3) { // Log first 3 errors
                console.log(`⚠️ Skipping ad ${index + 1} - creative cleaning failed`);
                console.log(`   Original (first 100 chars): ${originalCreative.substring(0, 100)}...`);
            }
            skippedCount++;
            continue;
        }
        // Save ad creative and get ad_id
        const adId = await saveAdCreative(ad, competitor.id, competitorName, platform, userId);
        // Estimate metrics
        const impressions = estimateImpressions();
        const { cpm, ctr } = platforms_1.PLATFORM_CONFIG[platform];
        const spend = (impressions / 1000) * cpm;
        const clicks = Math.round(impressions * ctr);
        // Prepare metric data with user_id
        const metricData = {
            date: today,
            competitor_id: competitor.id,
            user_id: userId, // CRITICAL: Add user_id
            competitor_name: competitorName,
            ad_id: adId,
            daily_spend: Number(spend.toFixed(2)),
            daily_impressions: impressions,
            daily_clicks: clicks,
            daily_ctr: Number(ctr.toFixed(4)),
            spend_lower_bound: Number((spend * 0.8).toFixed(2)),
            spend_upper_bound: Number((spend * 1.2).toFixed(2)),
            impressions_lower_bound: Math.round(impressions * 0.85),
            impressions_upper_bound: Math.round(impressions * 1.15),
            creative: cleanedCreative,
            platform: platform
        };
        metricsToInsert.push(metricData);
        successfulInserts++;
        // Log progress for large batches
        if (ads.length > 10 && (index + 1) % 10 === 0) {
            console.log(`📊 Processed ${index + 1}/${ads.length} ads for ${competitorName}`);
        }
    }
    // Log skipped ads
    if (skippedCount > 0) {
        console.log(`⏭️ Skipped ${skippedCount} ads (${jsonErrorCount} had JSON issues) for user ${userId}`);
    }
    // Insert all metrics
    if (metricsToInsert.length > 0) {
        try {
            // Use batch insert for efficiency
            await (0, dailyMetrics_repo_1.insertDailyMetricsBatch)(metricsToInsert);
            console.log(`✅ SUCCESS: Inserted ${successfulInserts} ads for ${competitorName} on ${platform} for user ${userId}`);
        }
        catch (batchError) {
            console.error(`❌ BATCH INSERT FAILED for ${competitorName} (user ${userId}):`, batchError);
            // Fallback strategy: Insert one by one with retries
            console.log('🔄 Falling back to single inserts...');
            let singleSuccess = 0;
            let singleFailures = 0;
            for (const metric of metricsToInsert) {
                try {
                    await (0, dailyMetrics_repo_1.insertDailyMetric)(metric);
                    singleSuccess++;
                    // Small delay to avoid rate limiting
                    if (singleSuccess % 10 === 0) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                }
                catch (singleError) {
                    singleFailures++;
                    // Log only first few errors
                    if (singleFailures <= 3) {
                        console.error(`❌ Failed to insert single metric (${singleFailures}) for user ${userId}:`, singleError instanceof Error ? singleError.message : 'Unknown error');
                    }
                    // Stop if too many failures
                    if (singleFailures > 10) {
                        console.error('🛑 Too many single insert failures, stopping for user', userId);
                        break;
                    }
                }
            }
            console.log(`🔄 Single inserts completed for user ${userId}: ${singleSuccess}/${metricsToInsert.length} successful, ${singleFailures} failed`);
        }
    }
    else {
        console.log(`⚠️ No valid ads to insert for ${competitorName} (user ${userId}). Input had ${ads.length} ads, skipped ${skippedCount}.`);
    }
    return successfulInserts;
}
// Helper function to validate ad data before ingestion
function validateAdData(ads) {
    const valid = [];
    const invalid = [];
    for (const ad of ads) {
        const creative = ad.creative?.trim();
        if (!creative || creative.length < 40) {
            invalid.push(ad);
        }
        else {
            // Test if it can be cleaned
            const cleaned = cleanCreativeText(creative);
            if (cleaned) {
                valid.push({ ...ad, creative: cleaned });
            }
            else {
                invalid.push(ad);
            }
        }
    }
    console.log(`📊 Validation: ${valid.length} valid, ${invalid.length} invalid ads`);
    return { valid, invalid };
}
// Function to ingest ads from multiple platforms
async function ingestAdsFromMultiplePlatforms(platformAds, competitorName, userId) {
    const results = [];
    for (const { platform, ads } of platformAds) {
        try {
            const count = await ingestAds(platform, ads, competitorName, userId);
            results.push({ platform, count });
            // Small delay between platforms to avoid overwhelming the system
            if (platformAds.length > 1) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        catch (error) {
            console.error(`❌ Failed to ingest ads from ${platform} for ${competitorName} (user ${userId}):`, error);
            results.push({ platform, count: 0 });
        }
    }
    // Log summary
    const total = results.reduce((sum, r) => sum + r.count, 0);
    console.log(`📊 Summary for ${competitorName} (user ${userId}): ${total} ads ingested across ${results.length} platforms`);
    return results;
}
// Function to check if ads already exist for today (keep this at bottom)
async function hasTodaysAds(competitorId, platform, userId) {
    return hasTodaysData(competitorId, platform, userId);
}
// New function for Python integration reporting
function getIngestionStats(ads, successfulInserts) {
    return {
        totalAds: ads.length,
        successful: successfulInserts,
        failed: ads.length - successfulInserts,
        successRate: ads.length > 0 ? (successfulInserts / ads.length) * 100 : 0
    };
}
