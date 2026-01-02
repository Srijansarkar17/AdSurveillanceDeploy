import { crawlMetaAds } from '../crawlers/meta/meta.crawler';
import { ingestAds } from '../pipelines/ingest.ads';
import { logExecution } from '../db/logs.repo';
import { getCompetitorsByUser } from '../db/competitors.repo';

export async function runMetaJob(userId: string): Promise<number> {
  const startTime = Date.now();
  let totalAdsFetched = 0;

  try {
    console.log(`🤖 Running Meta Ads Job for user: ${userId}...`);

    // 1️⃣ Get all competitors for this user
    const competitors = await getCompetitorsByUser(userId);
    
    if (!competitors || competitors.length === 0) {
      console.log(`📭 No competitors found for user: ${userId}`);
      
      await logExecution({
        script_run_id: `META_${Date.now()}`,
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

      return 0;
    }

    console.log(`📊 Found ${competitors.length} competitors for user ${userId}`);

    // 2️⃣ Process each competitor
    for (const competitor of competitors) {
      console.log(`🔍 Processing competitor: ${competitor.name}`);
      
      try {
        // Fetch REAL ads from Meta Ad Library
        const ads = await crawlMetaAds(competitor.name);
        const adsCount = ads.length;
        totalAdsFetched += adsCount;

        console.log(`📱 Meta ads fetched for ${competitor.name}: ${adsCount}`);

        // 3️⃣ If ads fetched, ingest them
        if (adsCount > 0) {
          await ingestAds('meta', ads, competitor.name, userId);
          console.log(`✅ Ingested ${adsCount} ads for ${competitor.name}`);
        } else {
          console.log(`📭 No ads found for ${competitor.name}`);
        }

      } catch (competitorError) {
        console.error(`❌ Error processing competitor ${competitor.name}:`, competitorError);
        // Continue with other competitors
      }
    }

    // 4️⃣ Execution duration
    const durationSeconds = Math.round((Date.now() - startTime) / 1000);

    // 5️⃣ Log successful execution
    await logExecution({
      script_run_id: `META_${Date.now()}`,
      execution_timestamp: new Date().toISOString(),
      script_version: 'v1.0',
      competitors_analyzed: competitors.length,
      total_ads_processed: totalAdsFetched,
      execution_duration_seconds: durationSeconds,
      status: 'COMPLETED',
      calculated_fields: [
        'daily_spend',
        'daily_impressions',
        'daily_clicks',
        'daily_ctr'
      ],
      critical_limitations: [
        'Exact impressions and spend not publicly available',
        'Metrics estimated using CPM and CTR models'
      ],
      user_id: userId
    });

    console.log(`✅ Meta Ads Job completed successfully`);
    console.log(`📊 Total ads fetched: ${totalAdsFetched}`);
    console.log(`⏱️ Duration: ${durationSeconds} seconds`);
    
    return totalAdsFetched;

  } catch (error: any) {
    // 6️⃣ HARD FAIL SAFETY LOG
    console.error(`❌ Meta Ads Job failed for user ${userId}:`, error?.message);

    await logExecution({
      script_run_id: `META_${Date.now()}`,
      execution_timestamp: new Date().toISOString(),
      script_version: 'v1.0',
      competitors_analyzed: 0,
      total_ads_processed: 0,
      execution_duration_seconds: Math.round((Date.now() - startTime) / 1000),
      status: 'FAILED',
      error_message: error?.message || 'Unknown error',
      critical_limitations: ['Meta Ad Library access blocked or timed out'],
      user_id: userId
    });

    throw error;
  }
}

// For backward compatibility with existing calls
export async function runMetaJobLegacy(competitorName: string, userId: string) {
  console.log(`⚠️ Using legacy function for ${competitorName} (User: ${userId})`);
  
  try {
    const ads = await crawlMetaAds(competitorName);
    if (ads.length > 0) {
      await ingestAds('meta', ads, competitorName, userId);
    }
    return ads.length;
  } catch (error) {
    console.error(`Legacy Meta job failed:`, error);
    return 0;
  }
}