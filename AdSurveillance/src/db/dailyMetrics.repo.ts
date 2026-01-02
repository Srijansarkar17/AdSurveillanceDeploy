import { supabase } from '../config/supabase';

export interface DailyMetric {
  id?: string;
  date: string;
  competitor_id: string;
  competitor_name: string;
  user_id: string;
  ad_id: string | null;
  daily_spend: number;
  daily_impressions: number;
  daily_clicks: number;
  daily_ctr: number;
  spend_lower_bound: number;
  spend_upper_bound: number;
  impressions_lower_bound: number;
  impressions_upper_bound: number;
  creative: string;
  platform: string;
  created_at?: string;
  updated_at?: string;
}

export interface DailyMetricInput {
  date: string;
  competitor_id: string;
  competitor_name: string;
  user_id: string;
  ad_id: string | null;
  daily_spend: number;
  daily_impressions: number;
  daily_clicks: number;
  daily_ctr: number;
  spend_lower_bound: number;
  spend_upper_bound: number;
  impressions_lower_bound: number;
  impressions_upper_bound: number;
  creative: string;
  platform: string;
}

export interface PlatformStats {
  platform: string;
  total_spend: number;
  total_impressions: number;
  avg_ctr: number;
}

export interface UserMetricsSummary {
  total_spend: number;
  total_impressions: number;
  total_clicks: number;
  avg_ctr: number;
  competitor_count: number;
  platform_count: number;
}

export interface GetMetricsOptions {
  startDate?: string;
  endDate?: string;
  platform?: string;
  competitorId?: string;
  limit?: number;
}

/**
 * Clean creative text for new inserts only
 */
function cleanCreativeText(creative: string): string {
  if (!creative || typeof creative !== 'string') return '';
  
  try {
    // Remove \b markers (this is your specific issue)
    let cleaned = creative.replace(/\\b/g, '');
    
    // Remove other problematic characters
    cleaned = cleaned
      .replace(/\x00/g, '') // Remove null bytes
      .replace(/[\uD800-\uDFFF]/g, '') // Remove invalid Unicode surrogates
      .replace(/\\/g, '\\\\') // Escape backslashes
      .replace(/"/g, '\\"')   // Escape double quotes
      .replace(/\n/g, '\\n')  // Escape newlines
      .replace(/\t/g, '\\t')  // Escape tabs
      .replace(/\f/g, '\\f')  // Escape form feeds
      .replace(/\r/g, '\\r')  // Escape carriage returns
      .replace(/\s+/g, ' ')   // Normalize multiple spaces
      .trim();
    
    // Truncate if too long
    if (cleaned.length > 10000) {
      cleaned = cleaned.substring(0, 10000) + '... [TRUNCATED]';
    }
    
    return cleaned;
  } catch (error) {
    console.error('❌ Error cleaning creative text:', error);
    return '[ERROR CLEANING TEXT]';
  }
}

/**
 * Validate metric input data
 */
function validateMetricInput(input: DailyMetricInput): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input.date) errors.push('Date is required');
  if (!input.competitor_id) errors.push('Competitor ID is required');
  if (!input.user_id) errors.push('User ID is required');
  if (input.daily_spend < 0) errors.push('Daily spend cannot be negative');
  if (input.daily_impressions < 0) errors.push('Daily impressions cannot be negative');
  if (input.daily_ctr < 0 || input.daily_ctr > 1) errors.push('CTR must be between 0 and 1');
  if (!input.platform) errors.push('Platform is required');
  
  // Validate creative length
  if (!input.creative || input.creative.trim().length < 10) {
    errors.push('Creative text is too short or missing');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// ==================== CRUD OPERATIONS ====================

/**
 * Insert a single daily metric
 */
export async function insertDailyMetric(input: DailyMetricInput): Promise<DailyMetric> {
  // Validate input
  const validation = validateMetricInput(input);
  if (!validation.isValid) {
    throw new Error(`Invalid metric input: ${validation.errors.join(', ')}`);
  }

  // Clean the creative text
  const cleanedCreative = cleanCreativeText(input.creative);
  
  const { data, error } = await supabase
    .from('daily_metrics')
    .insert({
      date: input.date,
      competitor_id: input.competitor_id,
      competitor_name: input.competitor_name,
      user_id: input.user_id,
      ad_id: input.ad_id,
      daily_spend: input.daily_spend,
      daily_impressions: input.daily_impressions,
      daily_clicks: input.daily_clicks,
      daily_ctr: input.daily_ctr,
      spend_lower_bound: input.spend_lower_bound,
      spend_upper_bound: input.spend_upper_bound,
      impressions_lower_bound: input.impressions_lower_bound,
      impressions_upper_bound: input.impressions_upper_bound,
      creative: cleanedCreative,
      platform: input.platform,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error('❌ METRIC INSERT FAILED', error);
    throw error;
  }

  console.log(`✅ METRIC SAVED for ${input.competitor_name} on ${input.platform} (User: ${input.user_id})`);
  return data;
}

/**
 * Batch insert metrics with validation
 */
export async function insertDailyMetricsBatch(metrics: DailyMetricInput[]): Promise<DailyMetric[]> {
  if (metrics.length === 0) {
    console.log('⚠️ No metrics to insert');
    return [];
  }

  console.log(`📦 Starting batch insert of ${metrics.length} metrics...`);

  // Validate and clean all metrics
  const validMetrics: DailyMetricInput[] = [];
  const invalidMetrics: DailyMetricInput[] = [];

  for (const metric of metrics) {
    const validation = validateMetricInput(metric);
    if (validation.isValid) {
      validMetrics.push({
        ...metric,
        creative: cleanCreativeText(metric.creative)
      });
    } else {
      invalidMetrics.push(metric);
      console.warn(`⚠️ Invalid metric skipped: ${validation.errors.join(', ')}`);
    }
  }

  if (validMetrics.length === 0) {
    console.log(`⚠️ No valid metrics to insert (${invalidMetrics.length} invalid)`);
    return [];
  }

  console.log(`📊 Valid: ${validMetrics.length}, Invalid: ${invalidMetrics.length}`);

  try {
    const { data, error } = await supabase
      .from('daily_metrics')
      .insert(validMetrics.map(metric => ({
        ...metric,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })))
      .select();

    if (error) {
      console.error('❌ BATCH METRICS INSERT FAILED', error);
      
      // Try inserting one by one as fallback
      return await insertMetricsOneByOne(validMetrics);
    }

    console.log(`✅ BATCH INSERT: Saved ${data?.length || 0} metrics`);
    return data || [];
    
  } catch (error) {
    console.error('❌ BATCH INSERT ERROR:', error);
    throw error;
  }
}

/**
 * Fallback: Insert metrics one by one
 */
async function insertMetricsOneByOne(metrics: DailyMetricInput[]): Promise<DailyMetric[]> {
  console.log('🔄 Falling back to one-by-one insertion...');
  
  const insertedMetrics: DailyMetric[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const metric of metrics) {
    try {
      const inserted = await insertDailyMetric(metric);
      insertedMetrics.push(inserted);
      successCount++;
      
      // Small delay to avoid rate limiting
      if (successCount % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      failureCount++;
      console.error(`❌ Failed to insert metric ${successCount + failureCount}:`, error);
      
      if (failureCount > 5) {
        console.warn('🛑 Too many failures, stopping insertion');
        break;
      }
    }
  }

  console.log(`🔄 One-by-one completed: ${successCount} successful, ${failureCount} failed`);
  return insertedMetrics;
}

/**
 * Get daily metrics for a specific user
 */
export async function getDailyMetricsForUser(
  userId: string, 
  options: GetMetricsOptions = {}
): Promise<DailyMetric[]> {
  const { startDate, endDate, platform, competitorId, limit = 100 } = options;
  
  let query = supabase
    .from('daily_metrics')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (startDate) {
    query = query.gte('date', startDate);
  }
  if (endDate) {
    query = query.lte('date', endDate);
  }
  if (platform) {
    query = query.eq('platform', platform);
  }
  if (competitorId) {
    query = query.eq('competitor_id', competitorId);
  }
  
  query = query.limit(limit);

  const { data, error } = await query;

  if (error) {
    console.error('❌ ERROR FETCHING USER METRICS', error);
    throw error;
  }

  console.log(`📊 Found ${data?.length || 0} metrics for user ${userId}`);
  return data || [];
}

/**
 * Get metrics with creatives for user
 */
export async function getDailyMetricsWithCreatives(
  userId: string, 
  date?: string, 
  limit: number = 100
): Promise<DailyMetric[]> {
  let query = supabase
    .from('daily_metrics')
    .select(`
      *,
      competitors!inner(name, domain, industry, user_id)
    `)
    .eq('competitors.user_id', userId);

  if (date) {
    query = query.eq('date', date);
  }

  const { data, error } = await query
    .order('date', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('❌ ERROR FETCHING METRICS WITH CREATIVES', error);
    throw error;
  }

  return data || [];
}

/**
 * Get today's metrics for a user
 */
export async function getTodaysMetrics(userId: string): Promise<DailyMetric[]> {
  const today = new Date().toISOString().split('T')[0];
  
  const { data, error } = await supabase
    .from('daily_metrics')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ ERROR FETCHING TODAYS METRICS', error);
    throw error;
  }

  return data || [];
}

/**
 * Get metrics by competitor
 */
export async function getMetricsByCompetitor(
  competitorId: string, 
  userId: string, 
  limit: number = 50
): Promise<DailyMetric[]> {
  const { data, error } = await supabase
    .from('daily_metrics')
    .select('*')
    .eq('competitor_id', competitorId)
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('❌ ERROR FETCHING COMPETITOR METRICS', error);
    throw error;
  }

  return data || [];
}

/**
 * Get platform distribution for a user
 */
export async function getPlatformDistribution(
  userId: string, 
  options: {
    startDate?: string;
    endDate?: string;
  } = {}
): Promise<PlatformStats[]> {
  const { startDate, endDate } = options;
  
  let query = supabase
    .from('daily_metrics')
    .select('platform, daily_spend, daily_impressions, daily_ctr')
    .eq('user_id', userId);

  if (startDate) {
    query = query.gte('date', startDate);
  }
  if (endDate) {
    query = query.lte('date', endDate);
  }

  const { data, error } = await query;

  if (error) {
    console.error('❌ ERROR FETCHING PLATFORM DISTRIBUTION', error);
    throw error;
  }

  // Aggregate data
  const platformMap = new Map<string, { 
    total_spend: number; 
    total_impressions: number; 
    total_ctr: number; 
    count: number 
  }>();
  
  (data || []).forEach((metric: DailyMetric) => {
    const existing = platformMap.get(metric.platform) || { 
      total_spend: 0, 
      total_impressions: 0, 
      total_ctr: 0, 
      count: 0 
    };
    
    existing.total_spend += metric.daily_spend || 0;
    existing.total_impressions += metric.daily_impressions || 0;
    existing.total_ctr += metric.daily_ctr || 0;
    existing.count += 1;
    
    platformMap.set(metric.platform, existing);
  });

  const result: PlatformStats[] = Array.from(platformMap.entries()).map(([platform, stats]) => ({
    platform,
    total_spend: stats.total_spend,
    total_impressions: stats.total_impressions,
    avg_ctr: stats.count > 0 ? stats.total_ctr / stats.count : 0
  }));

  return result;
}

/**
 * Delete metrics for a specific date (useful for testing/cleanup)
 */
export async function deleteMetricsByDate(date: string, userId?: string): Promise<void> {
  let query = supabase
    .from('daily_metrics')
    .delete()
    .eq('date', date);

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { error } = await query;

  if (error) {
    console.error('❌ ERROR DELETING METRICS', error);
    throw error;
  }

  console.log(`✅ Deleted metrics for date: ${date}`);
}

/**
 * Get summary stats for a user
 */
export async function getUserMetricsSummary(userId: string): Promise<UserMetricsSummary> {
  const { data, error } = await supabase
    .from('daily_metrics')
    .select('daily_spend, daily_impressions, daily_clicks, daily_ctr, competitor_id, platform')
    .eq('user_id', userId);

  if (error) {
    console.error('❌ ERROR FETCHING USER METRICS SUMMARY', error);
    throw error;
  }

  const metrics = data || [];
  
  // FIXED: Added explicit type annotations to reduce functions
  const summary: UserMetricsSummary = {
    total_spend: metrics.reduce((sum: number, m: DailyMetric) => sum + (m.daily_spend || 0), 0),
    total_impressions: metrics.reduce((sum: number, m: DailyMetric) => sum + (m.daily_impressions || 0), 0),
    total_clicks: metrics.reduce((sum: number, m: DailyMetric) => sum + (m.daily_clicks || 0), 0),
    avg_ctr: metrics.length > 0 
      ? metrics.reduce((sum: number, m: DailyMetric) => sum + (m.daily_ctr || 0), 0) / metrics.length 
      : 0,
    competitor_count: new Set(metrics.map((m: DailyMetric) => m.competitor_id)).size,
    platform_count: new Set(metrics.map((m: DailyMetric) => m.platform)).size
  };

  return summary;
}

/**
 * Get summary stats for a specific time period
 */
export async function getMetricsSummaryForPeriod(
  userId: string,
  startDate: string,
  endDate: string
): Promise<UserMetricsSummary> {
  const { data, error } = await supabase
    .from('daily_metrics')
    .select('daily_spend, daily_impressions, daily_clicks, daily_ctr, competitor_id, platform')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate);

  if (error) {
    console.error('❌ ERROR FETCHING PERIOD METRICS SUMMARY', error);
    throw error;
  }

  const metrics = data || [];
  
  const summary: UserMetricsSummary = {
    total_spend: metrics.reduce((sum: number, m: DailyMetric) => sum + (m.daily_spend || 0), 0),
    total_impressions: metrics.reduce((sum: number, m: DailyMetric) => sum + (m.daily_impressions || 0), 0),
    total_clicks: metrics.reduce((sum: number, m: DailyMetric) => sum + (m.daily_clicks || 0), 0),
    avg_ctr: metrics.length > 0 
      ? metrics.reduce((sum: number, m: DailyMetric) => sum + (m.daily_ctr || 0), 0) / metrics.length 
      : 0,
    competitor_count: new Set(metrics.map((m: DailyMetric) => m.competitor_id)).size,
    platform_count: new Set(metrics.map((m: DailyMetric) => m.platform)).size
  };

  return summary;
}

/**
 * Check if metrics exist for today
 */
export async function hasTodaysMetrics(
  competitorId: string, 
  platform: string, 
  userId: string
): Promise<boolean> {
  const today = new Date().toISOString().split('T')[0];
  
  const { count, error } = await supabase
    .from('daily_metrics')
    .select('*', { count: 'exact', head: true })
    .eq('competitor_id', competitorId)
    .eq('platform', platform)
    .eq('user_id', userId)
    .eq('date', today);

  if (error) {
    console.error('❌ ERROR CHECKING TODAYS METRICS', error);
    return false;
  }

  return (count || 0) > 0;
}

/**
 * Get competitor performance summary
 */
export async function getCompetitorPerformanceSummary(
  competitorId: string, 
  userId: string
): Promise<{
  total_spend: number;
  total_impressions: number;
  avg_ctr: number;
  days_active: number;
  platforms: string[];
}> {
  const metrics = await getMetricsByCompetitor(competitorId, userId, 365); // Last year

  if (metrics.length === 0) {
    return {
      total_spend: 0,
      total_impressions: 0,
      avg_ctr: 0,
      days_active: 0,
      platforms: []
    };
  }

  const platforms = Array.from(new Set(metrics.map((m: DailyMetric) => m.platform)));
  const uniqueDays = new Set(metrics.map((m: DailyMetric) => m.date)).size;

  const summary = {
    total_spend: metrics.reduce((sum: number, m: DailyMetric) => sum + (m.daily_spend || 0), 0),
    total_impressions: metrics.reduce((sum: number, m: DailyMetric) => sum + (m.daily_impressions || 0), 0),
    avg_ctr: metrics.reduce((sum: number, m: DailyMetric) => sum + (m.daily_ctr || 0), 0) / metrics.length,
    days_active: uniqueDays,
    platforms: platforms
  };

  return summary;
}

/**
 * Get trending competitors (highest spend)
 */
export async function getTrendingCompetitors(
  userId: string,
  days: number = 7,
  limit: number = 10
): Promise<Array<{
  competitor_id: string;
  competitor_name: string;
  total_spend: number;
  total_impressions: number;
  avg_ctr: number;
}>> {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  const { data, error } = await supabase
    .from('daily_metrics')
    .select('competitor_id, competitor_name, daily_spend, daily_impressions, daily_ctr')
    .eq('user_id', userId)
    .gte('date', startDate)
    .order('daily_spend', { ascending: false });

  if (error) {
    console.error('❌ ERROR FETCHING TRENDING COMPETITORS', error);
    throw error;
  }

  const metrics = data || [];
  
  // Group by competitor
  const competitorMap = new Map<string, {
    competitor_name: string;
    total_spend: number;
    total_impressions: number;
    total_ctr: number;
    count: number;
  }>();

  metrics.forEach((metric: any) => {
    const existing = competitorMap.get(metric.competitor_id) || {
      competitor_name: metric.competitor_name,
      total_spend: 0,
      total_impressions: 0,
      total_ctr: 0,
      count: 0
    };

    existing.total_spend += metric.daily_spend || 0;
    existing.total_impressions += metric.daily_impressions || 0;
    existing.total_ctr += metric.daily_ctr || 0;
    existing.count += 1;

    competitorMap.set(metric.competitor_id, existing);
  });

  // Convert to array and sort by total spend
  const result = Array.from(competitorMap.entries())
    .map(([competitor_id, stats]) => ({
      competitor_id,
      competitor_name: stats.competitor_name,
      total_spend: stats.total_spend,
      total_impressions: stats.total_impressions,
      avg_ctr: stats.count > 0 ? stats.total_ctr / stats.count : 0
    }))
    .sort((a, b) => b.total_spend - a.total_spend)
    .slice(0, limit);

  return result;
}