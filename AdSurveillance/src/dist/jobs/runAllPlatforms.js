"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAllPlatforms = runAllPlatforms;
exports.runAllPlatformsLegacy = runAllPlatformsLegacy;
const runMetaJob_1 = require("./runMetaJob");
const logs_repo_1 = require("../db/logs.repo");
async function runAllPlatforms(userId, platformFilter = 'all') {
    const startTime = Date.now();
    console.log(`\n========== RUN ALL PLATFORMS START ==========`);
    console.log(`👤 User: ${userId}`);
    console.log(`📱 Platform filter: ${platformFilter}`);
    // Determine which platforms to run
    const platformsToRun = getPlatformsToRun(platformFilter);
    console.log(`🎯 Running platforms: ${platformsToRun.join(', ')}`);
    let totalAdsFetched = 0;
    const results = {};
    // Run each platform sequentially
    for (const platform of platformsToRun) {
        console.log(`\n🔄 Starting ${platform.toUpperCase()} crawler...`);
        try {
            let adsCount = 0;
            switch (platform) {
                case 'meta':
                    adsCount = await (0, runMetaJob_1.runMetaJob)(userId);
                    break;
                default:
                    console.log(`⚠️ Unknown platform: ${platform}`);
                    continue;
            }
            totalAdsFetched += adsCount;
            results[platform] = { ads: adsCount, success: true };
            console.log(`✅ ${platform.toUpperCase()}: Fetched ${adsCount} ads`);
        }
        catch (platformError) {
            console.error(`❌ ${platform.toUpperCase()} failed:`, platformError.message);
            results[platform] = {
                ads: 0,
                success: false,
                error: platformError.message
            };
        }
    }
    // Log overall execution
    const durationSeconds = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n📈 ========== RUN ALL PLATFORMS SUMMARY ==========`);
    console.log(`👤 User: ${userId}`);
    console.log(`⏱️ Total duration: ${durationSeconds} seconds`);
    console.log(`📊 Total ads fetched: ${totalAdsFetched}`);
    for (const [platform, result] of Object.entries(results)) {
        const status = result.success ? '✅' : '❌';
        console.log(`${status} ${platform.toUpperCase()}: ${result.ads} ads ${result.error ? `(Error: ${result.error})` : ''}`);
    }
    // Log to database
    await (0, logs_repo_1.logExecution)({
        script_run_id: `ALL_PLATFORMS_${Date.now()}`,
        execution_timestamp: new Date().toISOString(),
        script_version: 'v1.0',
        competitors_analyzed: platformsToRun.length,
        total_ads_processed: totalAdsFetched,
        execution_duration_seconds: durationSeconds,
        status: totalAdsFetched > 0 ? 'COMPLETED' : 'PARTIAL_SUCCESS',
        calculated_fields: Object.keys(results),
        critical_limitations: Object.entries(results)
            .filter(([_, r]) => !r.success)
            .map(([p, _]) => `${p.toUpperCase()} failed or returned no data`),
        user_id: userId
    });
    console.log(`\n========== RUN ALL PLATFORMS END ==========\n`);
    return totalAdsFetched;
}
function getPlatformsToRun(platformFilter) {
    const allPlatforms = ['meta', 'google', 'linkedin', 'tiktok'];
    if (platformFilter === 'all') {
        return allPlatforms;
    }
    // Single platform
    if (allPlatforms.includes(platformFilter)) {
        return [platformFilter];
    }
    // Multiple platforms comma-separated
    const platforms = platformFilter.split(',').map(p => p.trim().toLowerCase());
    return platforms.filter(p => allPlatforms.includes(p));
}
// Backward compatibility function
async function runAllPlatformsLegacy(userId) {
    console.log(`⚠️ Using legacy runAllPlatforms for user: ${userId}`);
    return await runAllPlatforms(userId, 'all');
}
