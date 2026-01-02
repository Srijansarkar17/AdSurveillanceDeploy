import { runMetaJob } from './runMetaJob';
import { logExecution } from '../db/logs.repo';
import { getCompetitorsByUser } from '../db/competitors.repo';

// Platform configuration from environment or defaults
const PLATFORM_CONFIG = {
  meta: process.env.ENABLE_META !== 'false',
  google: process.env.ENABLE_GOOGLE === 'true',
  linkedin: process.env.ENABLE_LINKEDIN === 'true',
  tiktok: process.env.ENABLE_TIKTOK === 'true',
};

export async function runAllPlatforms(userId: string, platformFilter: string = 'all'): Promise<number> {
  const startTime = Date.now();
  
  // ========== VALIDATION ==========
  if (!userId || userId === 'undefined' || userId === 'null') {
    console.error('❌ ERROR: Invalid user ID provided:', userId);
    
    await logExecution({
      script_run_id: `ALL_PLATFORMS_${Date.now()}`,
      execution_timestamp: new Date().toISOString(),
      script_version: 'v1.0',
      competitors_analyzed: 0,
      total_ads_processed: 0,
      execution_duration_seconds: 0,
      status: 'INVALID_USER_ID',
      calculated_fields: [],
      critical_limitations: [`Invalid user ID: ${userId}`],
      user_id: userId || 'invalid'
    });

    return 0;
  }

  console.log(`\n========== RUN ALL PLATFORMS START ==========`);
  console.log(`👤 User: ${userId}`);
  console.log(`📱 Platform filter: ${platformFilter}`);

  // ========== GET USER'S COMPETITORS ==========
  let competitors: any[] = [];
  try {
    competitors = await getCompetitorsByUser(userId);
    
    if (!competitors || competitors.length === 0) {
      console.log(`📭 No competitors found for user: ${userId}`);
      
      await logExecution({
        script_run_id: `ALL_PLATFORMS_${Date.now()}`,
        execution_timestamp: new Date().toISOString(),
        script_version: 'v1.0',
        competitors_analyzed: 0,
        total_ads_processed: 0,
        execution_duration_seconds: Math.round((Date.now() - startTime) / 1000),
        status: 'NO_COMPETITORS',
        calculated_fields: [],
        critical_limitations: ['No competitors found for this user'],
        user_id: userId
      });

      console.log(`========== RUN ALL PLATFORMS END ==========\n`);
      return 0;
    }

    console.log(`📊 Found ${competitors.length} competitors for user ${userId}`);
    
  } catch (error: any) {
    console.error(`❌ Error fetching competitors for user ${userId}:`, error.message);
    
    await logExecution({
      script_run_id: `ALL_PLATFORMS_${Date.now()}`,
      execution_timestamp: new Date().toISOString(),
      script_version: 'v1.0',
      competitors_analyzed: 0,
      total_ads_processed: 0,
      execution_duration_seconds: Math.round((Date.now() - startTime) / 1000),
      status: 'FAILED',
      error_message: `Failed to fetch competitors: ${error.message}`,
      critical_limitations: ['Database connection failed'],
      user_id: userId
    });

    console.log(`========== RUN ALL PLATFORMS END ==========\n`);
    return 0;
  }

  // ========== DETERMINE PLATFORMS TO RUN ==========
  const platformsToRun = getPlatformsToRun(platformFilter);
  console.log(`🎯 Running platforms: ${platformsToRun.join(', ')}`);

  if (platformsToRun.length === 0) {
    console.log(`⚠️  No platforms enabled or valid for filter: ${platformFilter}`);
    
    await logExecution({
      script_run_id: `ALL_PLATFORMS_${Date.now()}`,
      execution_timestamp: new Date().toISOString(),
      script_version: 'v1.0',
      competitors_analyzed: competitors.length,
      total_ads_processed: 0,
      execution_duration_seconds: Math.round((Date.now() - startTime) / 1000),
      status: 'NO_PLATFORMS',
      calculated_fields: [],
      critical_limitations: [`No platforms enabled for filter: ${platformFilter}`],
      user_id: userId
    });

    console.log(`========== RUN ALL PLATFORMS END ==========\n`);
    return 0;
  }

  // ========== RUN PLATFORM JOBS ==========
  let totalAdsFetched = 0;
  const results: { 
    [platform: string]: { 
      ads: number; 
      success: boolean; 
      duration: number;
      error?: string;
    } 
  } = {};

  // Run each platform sequentially
  for (const platform of platformsToRun) {
    const platformStartTime = Date.now();
    
    console.log(`\n🔄 Starting ${platform.toUpperCase()} crawler...`);
    
    try {
      let adsCount = 0;
      
      switch (platform) {
        case 'meta':
          adsCount = await runMetaJob(userId);
          break;
        case 'google':
          console.log(`⚠️ Google crawler not implemented yet`);
          adsCount = 0;
          break;
        case 'linkedin':
          console.log(`⚠️ LinkedIn crawler not implemented yet`);
          adsCount = 0;
          break;
        case 'tiktok':
          console.log(`⚠️ TikTok crawler not implemented yet`);
          adsCount = 0;
          break;
        default:
          console.log(`⚠️ Unknown platform: ${platform}`);
          continue;
      }
      
      const platformDuration = Math.round((Date.now() - platformStartTime) / 1000);
      totalAdsFetched += adsCount;
      
      results[platform] = { 
        ads: adsCount, 
        success: true, 
        duration: platformDuration
      };
      
      console.log(`✅ ${platform.toUpperCase()}: Fetched ${adsCount} ads in ${platformDuration}s`);
      
    } catch (platformError: any) {
      const platformDuration = Math.round((Date.now() - platformStartTime) / 1000);
      console.error(`❌ ${platform.toUpperCase()} failed after ${platformDuration}s:`, platformError.message);
      
      results[platform] = { 
        ads: 0, 
        success: false, 
        duration: platformDuration,
        error: platformError.message 
      };
    }
  }

  // ========== CALCULATE OVERALL RESULTS ==========
  const durationSeconds = Math.round((Date.now() - startTime) / 1000);
  const successfulPlatforms = Object.values(results).filter(r => r.success);
  const failedPlatforms = Object.values(results).filter(r => !r.success);
  
  console.log(`\n📈 ========== RUN ALL PLATFORMS SUMMARY ==========`);
  console.log(`👤 User: ${userId}`);
  console.log(`⏱️  Total duration: ${durationSeconds} seconds`);
  console.log(`📊 Total ads fetched: ${totalAdsFetched}`);
  console.log(`✅ Successful platforms: ${successfulPlatforms.length}`);
  console.log(`❌ Failed platforms: ${failedPlatforms.length}`);
  
  for (const [platform, result] of Object.entries(results)) {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${platform.toUpperCase()}: ${result.ads} ads in ${result.duration}s ${result.error ? `(Error: ${result.error})` : ''}`);
  }

  // ========== LOG EXECUTION ==========
  try {
    const executionStatus = totalAdsFetched > 0 ? 'COMPLETED' : 
                          successfulPlatforms.length > 0 ? 'PARTIAL_SUCCESS' : 
                          'FAILED';
    
    const criticalLimitations = [
      ...failedPlatforms.map(r => r.error || 'Unknown error'),
      ...(totalAdsFetched === 0 ? ['No ads fetched from any platform'] : [])
    ].filter(Boolean);

    await logExecution({
      script_run_id: `ALL_PLATFORMS_${Date.now()}`,
      execution_timestamp: new Date().toISOString(),
      script_version: 'v1.0',
      competitors_analyzed: competitors.length,
      total_ads_processed: totalAdsFetched,
      execution_duration_seconds: durationSeconds,
      status: executionStatus,
      calculated_fields: Object.keys(results),
      critical_limitations: criticalLimitations.length > 0 ? criticalLimitations : ['All platforms completed'],
      user_id: userId,
      platform_results: results
    });

    console.log(`\n✅ Execution logged to database`);
    
  } catch (logError: any) {
    console.error(`❌ Failed to log execution:`, logError.message);
  }

  console.log(`\n========== RUN ALL PLATFORMS END ==========\n`);
  
  return totalAdsFetched;
}

function getPlatformsToRun(platformFilter: string): string[] {
  const allPlatforms = ['meta', 'google', 'linkedin', 'tiktok'];
  
  // Filter based on configuration
  const availablePlatforms = allPlatforms.filter(platform => {
    const configKey = platform as keyof typeof PLATFORM_CONFIG;
    return PLATFORM_CONFIG[configKey] !== false;
  });

  if (platformFilter === 'all') {
    return availablePlatforms;
  }
  
  // Single platform
  if (allPlatforms.includes(platformFilter)) {
    const configKey = platformFilter as keyof typeof PLATFORM_CONFIG;
    return PLATFORM_CONFIG[configKey] !== false ? [platformFilter] : [];
  }
  
  // Multiple platforms comma-separated
  const requestedPlatforms = platformFilter.split(',').map(p => p.trim().toLowerCase());
  return requestedPlatforms.filter(p => {
    if (!allPlatforms.includes(p)) return false;
    const configKey = p as keyof typeof PLATFORM_CONFIG;
    return PLATFORM_CONFIG[configKey] !== false;
  });
}

// Helper function to check platform availability
export function getAvailablePlatforms(): string[] {
  return ['meta', 'google', 'linkedin', 'tiktok'].filter(platform => {
    const configKey = platform as keyof typeof PLATFORM_CONFIG;
    return PLATFORM_CONFIG[configKey] !== false;
  });
}

// Backward compatibility function
export async function runAllPlatformsLegacy(userId: string) {
  console.log(`⚠️ Using legacy runAllPlatforms for user: ${userId}`);
  return await runAllPlatforms(userId, 'all');
}