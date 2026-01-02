import { supabase } from '../config/supabase';
import { logExecution } from '../db/logs.repo';
import { getCompetitorsByUser } from '../db/competitors.repo';

export async function generateTargetingIntel(userId: string) {
  const startTime = Date.now();
  
  console.log(`🧠 Generating targeting intelligence for user: ${userId}`);

  try {
    // Get user's competitors
    const competitors = await getCompetitorsByUser(userId);
    
    if (!competitors || competitors.length === 0) {
      console.log(`📭 No competitors found for user ${userId}`);
      return;
    }

    console.log(`📊 Processing ${competitors.length} competitor(s) for AI insights`);

    let processedCount = 0;
    let failedCount = 0;

    for (const competitor of competitors) {
      try {
        console.log(`🔍 Processing competitor: ${competitor.name}`);
        
        // Get metrics for this competitor
        const { data: metrics, error } = await supabase
          .from('daily_metrics')
          .select('*')
          .eq('competitor_id', competitor.id)
          .order('date', { ascending: false })
          .limit(30); // Last 30 days

        if (error) {
          console.error(`❌ Error fetching metrics for ${competitor.name}:`, error);
          failedCount++;
          continue;
        }

        if (!metrics || metrics.length === 0) {
          console.log(`📭 No metrics found for competitor: ${competitor.name}`);
          continue;
        }

        // Calculate totals for insights
        const totalImpressions = metrics.reduce((sum: number, m: any) => sum + (m.daily_impressions || 0), 0);
        const totalSpend = metrics.reduce((sum: number, m: any) => sum + (m.daily_spend || 0), 0);
        const avgCTR = metrics.reduce((sum: number, m: any) => sum + (m.daily_ctr || 0), 0) / metrics.length;
        
        console.log(`📊 ${competitor.name}: ${metrics.length} days, ${totalImpressions} impressions, $${totalSpend.toFixed(2)} spend, ${(avgCTR * 100).toFixed(2)}% avg CTR`);

        // Generate AI insights
        const targetingIntel = {
          competitor_id: competitor.id,
          competitor_name: competitor.name,
          age_distribution: generateAgeDistribution(metrics),
          gender_distribution: generateGenderDistribution(metrics),
          geographic_spend: generateGeographicSpend(metrics),
          interest_clusters: generateInterestClusters(metrics),
          funnel_stage_prediction: generateFunnelPrediction(metrics),
          bidding_strategy: generateBiddingStrategy(metrics),
          advanced_targeting: generateAdvancedTargeting(metrics),
          data_source: 'AI_MODELED',
          confidence_score: calculateConfidenceScore(metrics.length, totalImpressions)
        };

        // ✅ FIXED: Save to targeting_intel table with proper error handling
        const saveResult = await saveTargetingIntel(competitor.id, targetingIntel);
        
        if (saveResult.success) {
          processedCount++;
          console.log(`✅ Generated intelligence for: ${competitor.name}`);
        } else {
          console.error(`❌ Error saving intelligence for ${competitor.name}:`, saveResult.error);
          failedCount++;
        }

      } catch (competitorError) {
        console.error(`❌ Unexpected error processing ${competitor.name}:`, competitorError);
        failedCount++;
      }
    }

    console.log(`🎯 Targeting intelligence completed: ${processedCount} succeeded, ${failedCount} failed`);

    await logExecution({
      script_run_id: `TARGETING_${Date.now()}`,
      execution_timestamp: new Date().toISOString(),
      script_version: 'v1.0',
      competitors_analyzed: processedCount,
      total_ads_processed: 0,
      execution_duration_seconds: Math.round((Date.now() - startTime) / 1000),
      status: processedCount > 0 ? 'COMPLETED' : 'FAILED',
      user_id: userId
    });

  } catch (error) {
    console.error(`❌ Fatal error in generateTargetingIntel:`, error);
    
    await logExecution({
      script_run_id: `TARGETING_${Date.now()}`,
      execution_timestamp: new Date().toISOString(),
      script_version: 'v1.0',
      competitors_analyzed: 0,
      total_ads_processed: 0,
      execution_duration_seconds: Math.round((Date.now() - startTime) / 1000),
      status: 'FAILED',
      error_message: error instanceof Error ? error.message : 'Unknown error',
      user_id: userId
    });
    
    throw error;
  }
}

// ✅ NEW: Smart save function that handles constraints properly
async function saveTargetingIntel(competitorId: string, targetingIntel: any): Promise<{ success: boolean; error?: any }> {
  try {
    // Try upsert first
    const { error: upsertError } = await supabase
      .from('targeting_intel')
      .upsert(targetingIntel, {
        onConflict: 'competitor_id'
      });

    if (!upsertError) {
      return { success: true };
    }

    // If upsert fails, try delete then insert
    if (upsertError.code === '42P10' || upsertError.message.includes('ON CONFLICT')) {
      console.log(`🔄 Upsert failed, trying delete-then-insert for competitor ${competitorId}`);
      
      // Delete existing record
      const { error: deleteError } = await supabase
        .from('targeting_intel')
        .delete()
        .eq('competitor_id', competitorId);

      if (deleteError) {
        console.error(`❌ Delete failed:`, deleteError);
      }

      // Insert new record
      const { error: insertError } = await supabase
        .from('targeting_intel')
        .insert(targetingIntel);

      if (insertError) {
        return { success: false, error: insertError };
      }

      return { success: true };
    }

    // Some other error
    return { success: false, error: upsertError };

  } catch (error) {
    return { success: false, error };
  }
}

// Helper function to calculate confidence score
function calculateConfidenceScore(daysCount: number, totalImpressions: number): number {
  let score = 0.5; // Base score
  
  // More days = higher confidence
  if (daysCount >= 30) score += 0.3;
  else if (daysCount >= 15) score += 0.2;
  else if (daysCount >= 7) score += 0.1;
  
  // More impressions = higher confidence
  if (totalImpressions >= 1000000) score += 0.2;
  else if (totalImpressions >= 500000) score += 0.15;
  else if (totalImpressions >= 100000) score += 0.1;
  
  return Math.min(score, 0.95); // Cap at 0.95
}

// Mock AI functions (replace with real AI later)
function generateAgeDistribution(metrics: any[]) {
  // Simple logic based on platform and spend
  const platform = metrics[0]?.platform || 'meta';
  const totalSpend = metrics.reduce((sum, m) => sum + (m.daily_spend || 0), 0);
  
  if (platform === 'tiktok') {
    return { '18-24': 0.45, '25-34': 0.35, '35-44': 0.15, '45+': 0.05 };
  } else if (platform === 'linkedin') {
    return { '25-34': 0.35, '35-44': 0.40, '45-54': 0.20, '55+': 0.05 };
  } else {
    // meta/google default
    return { '18-24': 0.25, '25-34': 0.35, '35-44': 0.25, '45+': 0.15 };
  }
}

function generateGenderDistribution(metrics: any[]) {
  const platform = metrics[0]?.platform || 'meta';
  
  if (platform === 'tiktok') {
    return { male: 0.40, female: 0.60 };
  } else if (platform === 'linkedin') {
    return { male: 0.55, female: 0.45 };
  } else {
    return { male: 0.48, female: 0.52 };
  }
}

function generateGeographicSpend(metrics: any[]) {
  // Mock geographic distribution
  return { 
    'US': 0.60, 
    'UK': 0.15, 
    'Canada': 0.08, 
    'Australia': 0.07, 
    'Germany': 0.05, 
    'Other': 0.05 
  };
}

function generateInterestClusters(metrics: any[]) {
  const creatives = metrics.map(m => m.creative?.toLowerCase() || '').join(' ');
  
  const interests = [];
  if (creatives.includes('sale') || creatives.includes('discount')) interests.push('price_sensitive');
  if (creatives.includes('new') || creatives.includes('launch')) interests.push('early_adopters');
  if (creatives.includes('premium') || creatives.includes('luxury')) interests.push('luxury_shoppers');
  if (creatives.includes('sport') || creatives.includes('fitness')) interests.push('fitness_enthusiasts');
  if (creatives.includes('eco') || creatives.includes('sustainable')) interests.push('eco_conscious');
  
  return interests.length > 0 ? interests : ['general_consumers'];
}

function generateFunnelPrediction(metrics: any[]) {
  const avgCTR = metrics.reduce((sum, m) => sum + (m.daily_ctr || 0), 0) / metrics.length;
  
  if (avgCTR > 0.02) {
    return { awareness: 0.2, consideration: 0.4, conversion: 0.3, loyalty: 0.1 };
  } else if (avgCTR > 0.01) {
    return { awareness: 0.3, consideration: 0.4, conversion: 0.2, loyalty: 0.1 };
  } else {
    return { awareness: 0.5, consideration: 0.3, conversion: 0.15, loyalty: 0.05 };
  }
}

function generateBiddingStrategy(metrics: any[]) {
  const platform = metrics[0]?.platform || 'meta';
  const avgCTR = metrics.reduce((sum, m) => sum + (m.daily_ctr || 0), 0) / metrics.length;
  
  if (platform === 'meta') {
    return { 
      strategy: avgCTR > 0.015 ? 'lowest_cost' : 'cost_cap',
      target_cpa: calculateTargetCPA(metrics),
      optimization_goal: 'conversions'
    };
  } else if (platform === 'google') {
    return {
      strategy: 'maximize_conversions',
      target_roas: 3.5,
      optimization_goal: 'conversion_value'
    };
  } else {
    return {
      strategy: 'target_cost',
      target_cpa: 45.00,
      optimization_goal: 'conversions'
    };
  }
}

function generateAdvancedTargeting(metrics: any[]) {
  const interests = generateInterestClusters(metrics);
  
  return {
    lookalike_audiences: interests.length > 2,
    custom_audiences: true,
    interest_expansion: metrics.length > 10,
    retargeting: true,
    exclusion_audiences: ['existing_customers']
  };
}

function calculateTargetCPA(metrics: any[]): number {
  const totalSpend = metrics.reduce((sum, m) => sum + (m.daily_spend || 0), 0);
  const totalClicks = metrics.reduce((sum, m) => sum + (m.daily_clicks || 0), 0);
  
  if (totalClicks > 0) {
    return totalSpend / totalClicks;
  }
  return 45.00; // Default CPA
}

// ✅ Optional: Run this SQL in Supabase to fix the constraint permanently
export async function fixTargetingIntelConstraint(): Promise<void> {
  try {
    console.log('🔧 Attempting to fix targeting_intel constraint...');
    
    // Try to add the constraint
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE targeting_intel 
        ADD CONSTRAINT IF NOT EXISTS targeting_intel_competitor_unique 
        UNIQUE (competitor_id);
      `
    });

    if (error) {
      console.log('⚠️ Could not add constraint via RPC, checking manually...');
      console.log('ℹ️ Please run this SQL in Supabase:');
      console.log(`
        ALTER TABLE targeting_intel 
        ADD CONSTRAINT targeting_intel_competitor_unique 
        UNIQUE (competitor_id);
      `);
    } else {
      console.log('✅ Constraint added successfully');
    }
  } catch (error) {
    console.error('❌ Error fixing constraint:', error);
  }
}