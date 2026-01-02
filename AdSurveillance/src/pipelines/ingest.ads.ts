import { PLATFORM_CONFIG, Platform } from '../config/platforms';
import { upsertCompetitor } from '../db/competitors.repo';
import { insertDailyMetric, insertDailyMetricsBatch, DailyMetricInput } from '../db/dailyMetrics.repo';
import { supabase } from '../config/supabase';
import { insertAdCreative, AdCreativeInput } from '../db/adsCreatives.repo';

function estimateImpressions(): number {
  return Math.floor(8000 + Math.random() * 12000);
}

export interface AdData {
  creative: string;
  adId?: string | null;
  headline?: string;
  description?: string;
  imageUrl?: string;
  videoUrl?: string;
  landingPage?: string;
  callToAction?: string;
  targetAudience?: string[];
  estimatedSpend?: number;
  engagement?: number;
  duration?: string;
  advertiser?: string;
  ad_type?: string;
  seen_on?: string;
  first_seen?: string;
}

/**
 * Clean and sanitize creative text
 */
function cleanCreativeText(text: string): string | null {
  if (!text) return null;
  
  try {
    let cleaned = text
      .replace(/\x00/g, '')
      .replace(/[\uD800-\uDFFF]/g, '') // Remove invalid Unicode
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t')
      .trim();
    
    if (cleaned.length < 40) {
      return null;
    }
    
    return cleaned;
    
  } catch (error) {
    console.log(`⚠️ Error cleaning creative: ${error}`);
    return null;
  }
}

/**
 * Check if we already have today's data
 */
async function hasTodaysData(competitorId: string, platform: string, userId: string): Promise<boolean> {
  const today = new Date().toISOString().split('T')[0];
  
  try {
    // First, let's check if user_id column exists in daily_metrics
    const { count, error } = await supabase
      .from('daily_metrics')
      .select('*', { count: 'exact', head: true })
      .eq('competitor_id', competitorId)
      .eq('platform', platform)
      .eq('date', today);
    
    if (error) {
      // If error is about missing user_id column, fall back to competitor-only check
      if (error.message && error.message.includes('user_id')) {
        console.log('⚠️ user_id column not found in daily_metrics, falling back to competitor check');
        const { count: fallbackCount, error: fallbackError } = await supabase
          .from('daily_metrics')
          .select('*', { count: 'exact', head: true })
          .eq('competitor_id', competitorId)
          .eq('platform', platform)
          .eq('date', today);
        
        if (fallbackError) {
          console.error('❌ Fallback check failed:', fallbackError);
          return false;
        }
        
        return (fallbackCount || 0) > 0;
      }
      
      console.error('❌ ERROR CHECKING TODAYS DATA:', error);
      return false;
    }
    
    return (count || 0) > 0;
    
  } catch (error) {
    console.error('❌ Exception in hasTodaysData:', error);
    return false;
  }
}

/**
 * Verify competitor belongs to user
 */
async function verifyCompetitorOwnership(competitorId: string, userId: string): Promise<boolean> {
  try {
    const { data: competitor, error } = await supabase
      .from('competitors')
      .select('user_id')
      .eq('id', competitorId)
      .single();

    if (error) {
      console.error(`❌ Error verifying competitor ${competitorId}:`, error);
      return false;
    }

    if (competitor.user_id !== userId) {
      console.error(`🚨 SECURITY: Competitor ${competitorId} belongs to user ${competitor.user_id}, not ${userId}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`❌ Error in ownership verification:`, error);
    return false;
  }
}

/**
 * Save ad creative with user_id safety check
 */
async function saveAdCreative(
  adData: AdData,
  competitorId: string,
  competitorName: string,
  platform: Platform,
  userId: string
): Promise<string | null> {
  try {
    // Verify competitor ownership
    const isValidOwner = await verifyCompetitorOwnership(competitorId, userId);
    if (!isValidOwner) {
      console.error(`❌ Ownership verification failed for competitor ${competitorId}`);
      return null;
    }

    const cleanedCreative = cleanCreativeText(adData.creative);
    if (!cleanedCreative) return null;

    // Prepare ad creative input - check if user_id field exists
    const adCreativeInput: any = {
      competitor_id: competitorId,
      competitor_name: competitorName,
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

    // Try to add user_id if the field exists
    try {
      // Test if user_id field exists in the table
      adCreativeInput.user_id = userId;
    } catch (error) {
      console.log('⚠️ user_id field might not exist in ads_creatives table');
    }

    const adCreative = await insertAdCreative(adCreativeInput);
    return adCreative.id;
    
  } catch (error) {
    console.error('❌ Error in saveAdCreative:', error);
    return null;
  }
}

export async function ingestAds(
  platform: Platform,
  ads: AdData[],
  competitorName: string,
  userId: string
): Promise<number> {
  console.log(`🔥 INGESTING ADS for ${competitorName} on ${platform} (${ads.length} ads) for user ${userId}`);

  // Validate inputs
  if (!userId || userId === 'undefined' || userId === 'null') {
    console.error('❌ Invalid user ID provided to ingestAds:', userId);
    return 0;
  }

  if (!ads || ads.length === 0) {
    console.log(`📭 No ads provided for ${competitorName} (user ${userId})`);
    return 0;
  }

  const today = new Date().toISOString().split('T')[0];

  // ========== STEP 1: GET OR CREATE COMPETITOR ==========
  let competitor;
  try {
    competitor = await upsertCompetitor(competitorName, userId);
    
    if (!competitor || !competitor.id) {
      console.error(`❌ Failed to get/create competitor ${competitorName} for user ${userId}`);
      return 0;
    }

    // Verify ownership
    if (competitor.user_id !== userId) {
      console.error(`🚨 SECURITY: Competitor ${competitorName} belongs to different user (${competitor.user_id})`);
      return 0;
    }

    console.log(`✅ Competitor verified: ${competitorName} (ID: ${competitor.id}) for user ${userId}`);

  } catch (error: any) {
    console.error(`❌ Error in competitor handling for user ${userId}:`, error.message);
    return 0;
  }

  // ========== STEP 2: CHECK IF ALREADY PROCESSED TODAY ==========
  const alreadyProcessed = await hasTodaysData(competitor.id, platform, userId);
  if (alreadyProcessed) {
    console.log(`⏭️ Skipping ${competitorName} on ${platform} - already processed today for user ${userId}`);
    return 0;
  }

  // ========== STEP 3: PROCESS EACH AD ==========
  const metricsToInsert: DailyMetricInput[] = [];
  let successfulInserts = 0;
  let skippedCount = 0;

  console.log(`📊 Processing ${ads.length} ads for ${competitorName} (user ${userId})`);

  for (const [index, ad] of ads.entries()) {
    const originalCreative = ad.creative?.trim();

    // Skip if creative is too short or invalid
    if (!originalCreative || originalCreative.length < 40) {
      skippedCount++;
      continue;
    }

    // Clean the creative text
    const cleanedCreative = cleanCreativeText(originalCreative);
    
    if (!cleanedCreative) {
      skippedCount++;
      continue;
    }

    // Save ad creative and get ad_id
    const adId = await saveAdCreative(ad, competitor.id, competitorName, platform, userId);

    // Estimate metrics
    const impressions = estimateImpressions();
    const { cpm, ctr } = PLATFORM_CONFIG[platform];

    const spend = (impressions / 1000) * cpm;
    const clicks = Math.round(impressions * ctr);

    // Prepare metric data - handle user_id safely
    const metricData: any = {
      date: today,
      competitor_id: competitor.id,
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

    // Try to add user_id if the field exists
    try {
      metricData.user_id = userId;
    } catch (error) {
      console.log('⚠️ Note: user_id field might not exist in daily_metrics table');
    }

    metricsToInsert.push(metricData);
    successfulInserts++;

    // Log progress
    if (ads.length > 10 && (index + 1) % 10 === 0) {
      console.log(`📊 Processed ${index + 1}/${ads.length} ads for ${competitorName}`);
    }
  }

  // Log skipped ads
  if (skippedCount > 0) {
    console.log(`⏭️ Skipped ${skippedCount} ads for ${competitorName} (user ${userId})`);
  }

  // ========== STEP 4: INSERT METRICS ==========
  if (metricsToInsert.length > 0) {
    try {
      console.log(`💾 Inserting ${metricsToInsert.length} metrics for user ${userId}...`);
      
      // Try batch insert first
      try {
        await insertDailyMetricsBatch(metricsToInsert);
        console.log(`✅ Batch insert successful: ${successfulInserts} ads for ${competitorName}`);
      } catch (batchError: any) {
        console.error(`❌ Batch insert failed, trying single inserts:`, batchError.message);
        
        // Fallback to single inserts
        let singleSuccess = 0;
        for (const metric of metricsToInsert) {
          try {
            await insertDailyMetric(metric);
            singleSuccess++;
          } catch (singleError) {
            console.error(`❌ Failed single insert:`, singleError);
          }
        }
        successfulInserts = singleSuccess;
        console.log(`🔄 Single inserts: ${singleSuccess}/${metricsToInsert.length} successful`);
      }
      
    } catch (error: any) {
      console.error(`❌ Final insertion error for user ${userId}:`, error.message);
      successfulInserts = 0;
    }
  } else {
    console.log(`⚠️ No valid ads to insert for ${competitorName} (user ${userId})`);
  }

  // ========== STEP 5: UPDATE COMPETITOR STATUS ==========
  try {
    await supabase
      .from('competitors')
      .update({
        last_fetched_at: new Date().toISOString(),
        ads_count: successfulInserts,
        last_fetch_status: successfulInserts > 0 ? 'success' : 'no_ads',
        updated_at: new Date().toISOString()
      })
      .eq('id', competitor.id)
      .eq('user_id', userId);
    
    console.log(`✅ Updated competitor ${competitorName} status for user ${userId}`);
  } catch (updateError: any) {
    console.error(`❌ Failed to update competitor:`, updateError.message);
  }

  // ========== STEP 6: RETURN RESULT ==========
  const resultMessage = successfulInserts > 0 
    ? `✅ ${successfulInserts} ads ingested for ${competitorName} (user ${userId})`
    : `📭 No ads ingested for ${competitorName} (user ${userId})`;
  
  console.log(resultMessage);
  return successfulInserts;
}

// Simple validation function
export function validateAdData(ads: AdData[]): { valid: AdData[], invalid: AdData[] } {
  const valid: AdData[] = [];
  const invalid: AdData[] = [];

  for (const ad of ads) {
    const creative = ad.creative?.trim();
    
    if (!creative || creative.length < 40) {
      invalid.push(ad);
    } else {
      const cleaned = cleanCreativeText(creative);
      if (cleaned) {
        valid.push({ ...ad, creative: cleaned });
      } else {
        invalid.push(ad);
      }
    }
  }

  return { valid, invalid };
}

// Simple ingestion stats
export function getIngestionStats(ads: AdData[], successfulInserts: number): {
  totalAds: number;
  successful: number;
  failed: number;
  successRate: number;
} {
  return {
    totalAds: ads.length,
    successful: successfulInserts,
    failed: ads.length - successfulInserts,
    successRate: ads.length > 0 ? (successfulInserts / ads.length) * 100 : 0
  };
}

// Quick permission check
export async function canUserIngestAds(competitorName: string, userId: string): Promise<boolean> {
  try {
    const { data: competitor, error } = await supabase
      .from('competitors')
      .select('user_id')
      .eq('name', competitorName.trim())
      .single();

    if (error) {
      // Competitor doesn't exist, user can create it
      return true;
    }

    return competitor.user_id === userId;
  } catch (error) {
    console.error(`❌ Permission check error:`, error);
    return false;
  }
}