import { runAllPlatforms } from './jobs/runAllPlatforms';
import { runDailySummary } from './jobs/runDailySummary';
import { generateTargetingIntel } from './jobs/generateTargetingIntel';

async function validateUserId(userId: string): Promise<boolean> {
  console.log(`🔍 Validating user ID: ${userId}`);
  
  // Basic UUID validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  if (!uuidRegex.test(userId)) {
    console.error(`❌ Invalid user ID format: ${userId}`);
    console.error('   User ID should be a valid UUID');
    return false;
  }
  
  return true;
}

async function main() {
  console.log('🚀 Starting Ads Intelligence Engine...');

  // Get user ID from environment - REQUIRED
  const targetUserId = process.env.USER_ID;
  
  if (!targetUserId) {
    console.error('❌ ERROR: USER_ID environment variable is REQUIRED');
    console.error('   The ads fetcher must be called with a specific user ID');
    console.error('   Example: USER_ID=<uuid> npm start');
    console.error('\n💡 This should only be called from the Python API, not directly');
    process.exit(1);
  }
  
  // Validate the user ID format
  const isValid = await validateUserId(targetUserId);
  if (!isValid) {
    process.exit(1);
  }
  
  console.log(`🎯 Processing ads for user ID: ${targetUserId}`);
  
  // Get platform from environment (optional)
  const platform = process.env.PLATFORM || 'all';
  console.log(`📱 Platform filter: ${platform}`);

  try {
    // Step 1: Fetch and ingest ads
    console.log('\n🚀 Step 1: Fetching competitor ads...');
    const adsCount = await runAllPlatforms(targetUserId, platform);
    console.log(`✅ Ads fetch completed: ${adsCount} ads found`);

    // Only proceed if ads were found
    if (adsCount > 0) {
      // Step 2: Generate daily summary
      console.log('\n📊 Step 2: Generating daily summary...');
      await runDailySummary(targetUserId);
      console.log('✅ Daily summary generated');

      // Step 3: Generate targeting intelligence
      console.log('\n🧠 Step 3: Generating AI targeting intelligence...');
      await generateTargetingIntel(targetUserId);
      console.log('✅ AI insights generated');
      
      console.log('\n🎉 Pipeline execution completed successfully!');
    } else {
      console.log('\n📭 No ads found for the specified competitors');
      console.log('💡 The system will show "no data available" on the dashboard');
    }
    
    // IMPORTANT: Exit with success code
    process.exit(0);
    
  } catch (error: any) {
    console.error('❌ Fatal error in main process:', error.message);
    console.error('Stack trace:', error.stack);
    console.log('\n💡 The frontend will show "no data available" for this fetch');
    process.exit(1);
  }
}

// Run the engine
if (require.main === module) {
  main();
}

export { main };