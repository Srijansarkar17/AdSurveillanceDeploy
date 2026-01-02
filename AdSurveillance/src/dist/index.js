"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const runAllPlatforms_1 = require("./jobs/runAllPlatforms");
const runDailySummary_1 = require("./jobs/runDailySummary");
const generateTargetingIntel_1 = require("./jobs/generateTargetingIntel");
async function main() {
    console.log('🚀 Starting Ads Intelligence Engine...');
    // Get user ID from environment variable (passed by Python)
    const targetUserId = process.env.USER_ID;
    if (!targetUserId) {
        console.error('❌ ERROR: USER_ID environment variable is required');
        console.log('💡 Usage: USER_ID=<user-uuid> npm start');
        console.log('💡 Or click "Refresh Ads" in the web interface');
        process.exit(1);
    }
    console.log(`🎯 Processing user ID: ${targetUserId}`);
    // Get platform from environment (optional)
    const platform = process.env.PLATFORM || 'all';
    console.log(`📱 Platform filter: ${platform}`);
    try {
        // Step 1: Fetch and ingest ads
        console.log('\n🚀 Step 1: Fetching competitor ads...');
        await (0, runAllPlatforms_1.runAllPlatforms)(targetUserId, platform);
        console.log('✅ Ads fetch completed');
        // Step 2: Generate daily summary
        console.log('\n📊 Step 2: Generating daily summary...');
        await (0, runDailySummary_1.runDailySummary)(targetUserId);
        console.log('✅ Daily summary generated');
        // Step 3: Generate targeting intelligence
        console.log('\n🧠 Step 3: Generating AI targeting intelligence...');
        await (0, generateTargetingIntel_1.generateTargetingIntel)(targetUserId);
        console.log('✅ AI insights generated');
        console.log('\n🎉 Pipeline execution completed successfully!');
        // IMPORTANT: Exit with success code
        process.exit(0);
    }
    catch (error) {
        console.error('❌ Fatal error in main process:', error);
        process.exit(1);
    }
}
// Run the engine
if (require.main === module) {
    main();
}
