import { supabase } from '../config/supabase';
import { logExecution } from '../db/logs.repo';

export async function runDailySummary(userId: string): Promise<boolean> {
  const startTime = Date.now();
  
  console.log(`📊 Generating daily summary for user: ${userId}`);

  try {
    // Get today's date in YYYY-MM-DD format
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    console.log(`📅 Processing date: ${todayStr}`);

    // Call the PostgreSQL function with user_id
    const { data, error } = await supabase.rpc(
      'run_summary_metrics',
      { 
        user_id_input: userId,
        summary_date: todayStr
      }
    );

    if (error) {
      console.error('❌ SQL Function Error:', error);
      
      // Try alternative approach if function doesn't exist
      return await generateSummaryManually(userId, todayStr);
    }

    if (data && data.length > 0) {
      const summaryData = data[0];
      
      console.log('📈 Summary Data Generated:', {
        total_spend: summaryData.total_competitor_spend,
        total_impressions: summaryData.total_impressions,
        active_campaigns: summaryData.active_campaigns_count,
        average_ctr: summaryData.average_ctr
      });

      // Save to summary_metrics table
      const saveResult = await saveSummaryMetrics(userId, summaryData);
      
      if (saveResult.success) {
        console.log(`✅ Daily summary saved for user: ${userId}`);
        
        const durationSeconds = Math.round((Date.now() - startTime) / 1000);
        
        await logExecution({
          script_run_id: `SUMMARY_${Date.now()}`,
          execution_timestamp: new Date().toISOString(),
          script_version: 'v1.0',
          competitors_analyzed: 1, // Summary counts as 1
          total_ads_processed: 0,
          execution_duration_seconds: durationSeconds,
          status: 'COMPLETED',
          calculated_fields: ['summary_metrics'],
          user_id: userId
        });
        
        return true;
      } else {
        console.error('❌ Error saving summary:', saveResult.error);
        return false;
      }
      
    } else {
      console.log(`📭 No data found for user ${userId} on ${todayStr}`);
      
      // Create empty summary to track that we tried
      const emptySummary = {
        user_id: userId,
        period_start_date: todayStr,
        period_end_date: todayStr,
        total_competitor_spend: 0,
        active_campaigns_count: 0,
        total_impressions: 0,
        average_ctr: 0,
        platform_distribution: '{}',
        top_performers: '[]',
        spend_by_industry: '{}'
      };
      
      await saveSummaryMetrics(userId, emptySummary);
      console.log(`✅ Empty summary saved for tracking`);
      
      return true;
    }
  } catch (error) {
    console.error(`❌ Error in runDailySummary for user ${userId}:`, error);
    
    await logExecution({
      script_run_id: `SUMMARY_${Date.now()}`,
      execution_timestamp: new Date().toISOString(),
      script_version: 'v1.0',
      competitors_analyzed: 0,
      total_ads_processed: 0,
      execution_duration_seconds: Math.round((Date.now() - startTime) / 1000),
      status: 'FAILED',
      error_message: error instanceof Error ? error.message : 'Unknown error',
      user_id: userId
    });
    
    return false;
  }
}

async function saveSummaryMetrics(userId: string, summaryData: any): Promise<{ success: boolean; error?: any }> {
  try {
    // First, delete any existing summary for today
    const todayStr = new Date().toISOString().split('T')[0];
    
    const { error: deleteError } = await supabase
      .from('summary_metrics')
      .delete()
      .eq('user_id', userId)
      .eq('period_start_date', todayStr)
      .eq('period_end_date', todayStr);

    if (deleteError && !deleteError.message.includes('No rows found')) {
      console.log(`⚠️ Delete warning: ${deleteError.message}`);
    }

    // Insert new summary
    const { error: insertError } = await supabase
      .from('summary_metrics')
      .insert({
        user_id: userId,
        period_start_date: summaryData.period_start_date || todayStr,
        period_end_date: summaryData.period_end_date || todayStr,
        total_competitor_spend: summaryData.total_competitor_spend || 0,
        active_campaigns_count: summaryData.active_campaigns_count || 0,
        total_impressions: summaryData.total_impressions || 0,
        average_ctr: summaryData.average_ctr || 0,
        platform_distribution: summaryData.platform_distribution || '{}',
        top_performers: summaryData.top_performers || '[]',
        spend_by_industry: summaryData.spend_by_industry || '{}',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (insertError) {
      return { success: false, error: insertError };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error };
  }
}

async function generateSummaryManually(userId: string, dateStr: string): Promise<boolean> {
  console.log(`🔄 Generating summary manually for user ${userId}`);
  
  try {
    // Get metrics for this user from the last 24 hours
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const { data: metrics, error } = await supabase
      .from('daily_metrics')
      .select('*')
      .eq('user_id', userId)
      .gte('date', yesterday.toISOString())
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching metrics:', error);
      return false;
    }

    if (!metrics || metrics.length === 0) {
      console.log('No metrics found for manual summary');
      return false;
    }

    // Calculate summary manually - FIXED: Add type annotations
    const totalSpend = metrics.reduce((sum: number, m: any) => sum + (m.daily_spend || 0), 0);
    const totalImpressions = metrics.reduce((sum: number, m: any) => sum + (m.daily_impressions || 0), 0);
    const avgCTR = metrics.reduce((sum: number, m: any) => sum + (m.daily_ctr || 0), 0) / metrics.length;
    
    // Get unique competitors
    const competitorIds = [...new Set(metrics.map((m: any) => m.competitor_id))];
    
    // Create manual summary
    const manualSummary = {
      user_id: userId,
      period_start_date: dateStr,
      period_end_date: dateStr,
      total_competitor_spend: totalSpend,
      active_campaigns_count: competitorIds.length,
      total_impressions: totalImpressions,
      average_ctr: avgCTR,
      platform_distribution: '{"meta": 1}', // Simplified
      top_performers: '[]',
      spend_by_industry: '{}'
    };
    
    return (await saveSummaryMetrics(userId, manualSummary)).success;
    
  } catch (error) {
    console.error('Error in manual summary:', error);
    return false;
  }
}

// TypeScript interface for better type safety
interface DailyMetric {
  id?: string;
  user_id: string;
  competitor_id: string;
  date: string;
  daily_impressions: number;
  daily_spend: number;
  daily_clicks: number;
  daily_ctr: number;
  spend_lower_bound?: number;
  spend_upper_bound?: number;
  impressions_lower_bound?: number;
  impressions_upper_bound?: number;
  created_at?: string;
  updated_at?: string;
}

// Alternative fixed version with explicit types
export async function runDailySummaryAlternative(userId: string): Promise<boolean> {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Get metrics for today
    const { data: metrics, error } = await supabase
      .from('daily_metrics')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today);

    if (error) throw error;

    if (!metrics || metrics.length === 0) {
      console.log(`No metrics found for user ${userId} on ${today}`);
      return false;
    }

    // Calculate with explicit types
    const initialValue = {
      totalSpend: 0,
      totalImpressions: 0,
      totalClicks: 0,
      totalCTR: 0,
      competitorCount: new Set<string>()
    };

    const result = metrics.reduce((acc: {
      totalSpend: number;
      totalImpressions: number;
      totalClicks: number;
      totalCTR: number;
      competitorCount: Set<string>;
    }, metric: DailyMetric) => {
      acc.totalSpend += metric.daily_spend || 0;
      acc.totalImpressions += metric.daily_impressions || 0;
      acc.totalClicks += metric.daily_clicks || 0;
      acc.totalCTR += metric.daily_ctr || 0;
      if (metric.competitor_id) {
        acc.competitorCount.add(metric.competitor_id);
      }
      return acc;
    }, initialValue);

    const avgCTR = result.totalCTR / metrics.length;
    
    // Save the summary
    const { error: saveError } = await supabase
      .from('summary_metrics')
      .upsert({
        user_id: userId,
        period_start_date: today,
        period_end_date: today,
        total_competitor_spend: result.totalSpend,
        active_campaigns_count: result.competitorCount.size,
        total_impressions: result.totalImpressions,
        average_ctr: avgCTR,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (saveError) throw saveError;

    console.log(`✅ Summary saved for user ${userId}`);
    return true;

  } catch (error) {
    console.error(`❌ Error in daily summary:`, error);
    return false;
  }
}