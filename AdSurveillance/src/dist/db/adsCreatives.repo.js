"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertAdCreative = insertAdCreative;
exports.insertAdCreativesBatch = insertAdCreativesBatch;
exports.getAdCreativesForUser = getAdCreativesForUser;
exports.searchAdCreatives = searchAdCreatives;
exports.getAdCreativeById = getAdCreativeById;
exports.getRecentAdCreativesForCompetitor = getRecentAdCreativesForCompetitor;
exports.getAdCreativesByPlatform = getAdCreativesByPlatform;
exports.updateAdCreative = updateAdCreative;
exports.deactivateAdCreative = deactivateAdCreative;
exports.getAdCreativeStatistics = getAdCreativeStatistics;
exports.hasTodaysAdCreative = hasTodaysAdCreative;
exports.getTrendingAds = getTrendingAds;
const supabase_1 = require("../config/supabase");
/**
 * Insert a single ad creative
 */
async function insertAdCreative(input) {
    // Clean the creative text
    const cleanedCreative = cleanAdCreativeText(input.creative);
    const { data, error } = await supabase_1.supabase
        .from('ads_creatives')
        .insert({
        competitor_id: input.competitor_id,
        competitor_name: input.competitor_name,
        user_id: input.user_id,
        platform: input.platform,
        creative: cleanedCreative,
        headline: input.headline || null,
        description: input.description || null,
        image_url: input.image_url || null,
        video_url: input.video_url || null,
        landing_page: input.landing_page || null,
        call_to_action: input.call_to_action || null,
        ad_type: input.ad_type || 'text',
        advertiser: input.advertiser || null,
        seen_on: input.seen_on || null,
        first_seen: input.first_seen || new Date().toISOString(),
        estimated_impressions: input.estimated_impressions || null,
        estimated_spend: input.estimated_spend || null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    })
        .select()
        .single();
    if (error) {
        console.error('❌ AD CREATIVE INSERT FAILED', error);
        throw error;
    }
    console.log(`✅ AD CREATIVE SAVED for ${input.competitor_name} on ${input.platform}`);
    return data;
}
/**
 * Batch insert ad creatives
 */
async function insertAdCreativesBatch(creatives) {
    if (creatives.length === 0) {
        console.log('⚠️ No ad creatives to insert');
        return [];
    }
    console.log(`📦 Starting batch insert of ${creatives.length} ad creatives...`);
    // Clean all creatives
    const cleanedCreatives = creatives.map(creative => ({
        ...creative,
        creative: cleanAdCreativeText(creative.creative)
    }));
    try {
        const { data, error } = await supabase_1.supabase
            .from('ads_creatives')
            .insert(cleanedCreatives.map(creative => ({
            ...creative,
            ad_type: creative.ad_type || 'text',
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })))
            .select();
        if (error) {
            console.error('❌ BATCH AD CREATIVES INSERT FAILED', error);
            // Fallback: Insert one by one
            return await insertAdCreativesOneByOne(cleanedCreatives);
        }
        console.log(`✅ BATCH INSERT: Saved ${data?.length || 0} ad creatives`);
        return data || [];
    }
    catch (error) {
        console.error('❌ BATCH INSERT ERROR:', error);
        throw error;
    }
}
/**
 * Fallback: Insert ad creatives one by one
 */
async function insertAdCreativesOneByOne(creatives) {
    console.log('🔄 Falling back to one-by-one insertion...');
    const insertedCreatives = [];
    let successCount = 0;
    let failureCount = 0;
    for (const creative of creatives) {
        try {
            const inserted = await insertAdCreative(creative);
            insertedCreatives.push(inserted);
            successCount++;
            // Small delay to avoid rate limiting
            if (successCount % 10 === 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        catch (error) {
            failureCount++;
            console.error(`❌ Failed to insert ad creative ${successCount + failureCount}:`, error);
            if (failureCount > 5) {
                console.warn('🛑 Too many failures, stopping insertion');
                break;
            }
        }
    }
    console.log(`🔄 One-by-one completed: ${successCount} successful, ${failureCount} failed`);
    return insertedCreatives;
}
/**
 * Clean ad creative text
 */
function cleanAdCreativeText(text) {
    if (!text || typeof text !== 'string')
        return '';
    try {
        let cleaned = text
            .replace(/\\b/g, '') // Remove \b markers
            .replace(/\x00/g, '') // Remove null bytes
            .replace(/[\uD800-\uDFFF]/g, '') // Remove invalid Unicode surrogates
            .replace(/\\/g, '\\\\') // Escape backslashes
            .replace(/"/g, '\\"') // Escape double quotes
            .replace(/\n/g, '\\n') // Escape newlines
            .replace(/\t/g, '\\t') // Escape tabs
            .replace(/\f/g, '\\f') // Escape form feeds
            .replace(/\r/g, '\\r') // Escape carriage returns
            .replace(/\s+/g, ' ') // Normalize multiple spaces
            .trim();
        // Truncate if too long
        if (cleaned.length > 10000) {
            cleaned = cleaned.substring(0, 10000) + '... [TRUNCATED]';
        }
        return cleaned;
    }
    catch (error) {
        console.error('❌ Error cleaning ad creative text:', error);
        return '[ERROR CLEANING TEXT]';
    }
}
/**
 * Get ad creatives for a user
 */
async function getAdCreativesForUser(userId, options = {}) {
    const { competitorId, platform, limit = 100, offset = 0 } = options;
    let query = supabase_1.supabase
        .from('ads_creatives')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
    if (competitorId) {
        query = query.eq('competitor_id', competitorId);
    }
    if (platform) {
        query = query.eq('platform', platform);
    }
    query = query.range(offset, offset + limit - 1);
    const { data, error } = await query;
    if (error) {
        console.error('❌ ERROR FETCHING AD CREATIVES', error);
        throw error;
    }
    console.log(`📊 Found ${data?.length || 0} ad creatives for user ${userId}`);
    return data || [];
}
/**
 * Search ad creatives
 */
async function searchAdCreatives(options) {
    const { userId, competitorId, platform, searchTerm, startDate, endDate, limit = 50, offset = 0 } = options;
    let query = supabase_1.supabase
        .from('ads_creatives')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .eq('is_active', true);
    if (competitorId) {
        query = query.eq('competitor_id', competitorId);
    }
    if (platform) {
        query = query.eq('platform', platform);
    }
    if (searchTerm) {
        query = query.or(`creative.ilike.%${searchTerm}%,headline.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
    }
    if (startDate) {
        query = query.gte('created_at', startDate);
    }
    if (endDate) {
        query = query.lte('created_at', endDate);
    }
    query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
    const { data, count, error } = await query;
    if (error) {
        console.error('❌ ERROR SEARCHING AD CREATIVES', error);
        throw error;
    }
    console.log(`🔍 Found ${data?.length || 0} ad creatives (total: ${count})`);
    return {
        data: data || [],
        count: count || 0
    };
}
/**
 * Get ad creative by ID
 */
async function getAdCreativeById(id, userId) {
    const { data, error } = await supabase_1.supabase
        .from('ads_creatives')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();
    if (error) {
        if (error.code === 'PGRST116') {
            return null;
        }
        console.error('❌ ERROR FETCHING AD CREATIVE BY ID', error);
        throw error;
    }
    return data;
}
/**
 * Get recent ad creatives for a competitor
 */
async function getRecentAdCreativesForCompetitor(competitorId, userId, limit = 20) {
    const { data, error } = await supabase_1.supabase
        .from('ads_creatives')
        .select('*')
        .eq('competitor_id', competitorId)
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) {
        console.error('❌ ERROR FETCHING RECENT AD CREATIVES', error);
        throw error;
    }
    return data || [];
}
/**
 * Get ad creatives by platform
 */
async function getAdCreativesByPlatform(userId, platform, limit = 50) {
    const { data, error } = await supabase_1.supabase
        .from('ads_creatives')
        .select('*')
        .eq('user_id', userId)
        .eq('platform', platform)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) {
        console.error('❌ ERROR FETCHING PLATFORM AD CREATIVES', error);
        throw error;
    }
    return data || [];
}
/**
 * Update ad creative
 */
async function updateAdCreative(id, userId, updates) {
    const { data, error } = await supabase_1.supabase
        .from('ads_creatives')
        .update({
        ...updates,
        updated_at: new Date().toISOString()
    })
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();
    if (error) {
        console.error('❌ ERROR UPDATING AD CREATIVE', error);
        throw error;
    }
    console.log(`✅ Updated ad creative ${id}`);
    return data;
}
/**
 * Deactivate ad creative (soft delete)
 */
async function deactivateAdCreative(id, userId) {
    const { error } = await supabase_1.supabase
        .from('ads_creatives')
        .update({
        is_active: false,
        updated_at: new Date().toISOString()
    })
        .eq('id', id)
        .eq('user_id', userId);
    if (error) {
        console.error('❌ ERROR DEACTIVATING AD CREATIVE', error);
        throw error;
    }
    console.log(`✅ Ad creative ${id} deactivated`);
}
/**
 * Get ad creative statistics for user
 */
async function getAdCreativeStatistics(userId) {
    // Get total count
    const { count: totalCount } = await supabase_1.supabase
        .from('ads_creatives')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_active', true);
    // Get by platform
    const { data: platformData } = await supabase_1.supabase
        .from('ads_creatives')
        .select('platform')
        .eq('user_id', userId)
        .eq('is_active', true);
    const byPlatform = {};
    (platformData || []).forEach((ad) => {
        byPlatform[ad.platform] = (byPlatform[ad.platform] || 0) + 1;
    });
    // Get by competitor
    const { data: competitorData } = await supabase_1.supabase
        .from('ads_creatives')
        .select('competitor_name')
        .eq('user_id', userId)
        .eq('is_active', true);
    const byCompetitor = {};
    (competitorData || []).forEach((ad) => {
        byCompetitor[ad.competitor_name] = (byCompetitor[ad.competitor_name] || 0) + 1;
    });
    // Get recent count (last 7 days)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await supabase_1.supabase
        .from('ads_creatives')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_active', true)
        .gte('created_at', weekAgo);
    return {
        total_ads: totalCount || 0,
        by_platform: byPlatform,
        by_competitor: byCompetitor,
        recent_count: recentCount || 0
    };
}
/**
 * Check if ad creative already exists for today
 */
async function hasTodaysAdCreative(competitorId, platform, creativeHash, userId) {
    const today = new Date().toISOString().split('T')[0];
    // Simple hash of creative for comparison
    const hash = creativeHash.substring(0, 100).toLowerCase().replace(/\s+/g, ' ');
    const { count, error } = await supabase_1.supabase
        .from('ads_creatives')
        .select('*', { count: 'exact', head: true })
        .eq('competitor_id', competitorId)
        .eq('platform', platform)
        .eq('user_id', userId)
        .eq('is_active', true)
        .gte('created_at', `${today}T00:00:00`)
        .lt('created_at', `${today}T23:59:59`);
    if (error) {
        console.error('❌ ERROR CHECKING TODAYS AD CREATIVE', error);
        return false;
    }
    return (count || 0) > 0;
}
/**
 * Get trending ads (most seen creatives)
 */
async function getTrendingAds(userId, days = 7, limit = 10) {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
    const { data, error } = await supabase_1.supabase
        .from('ads_creatives')
        .select('creative, platform, competitor_name, created_at')
        .eq('user_id', userId)
        .eq('is_active', true)
        .gte('created_at', startDate)
        .order('created_at', { ascending: false });
    if (error) {
        console.error('❌ ERROR FETCHING TRENDING ADS', error);
        throw error;
    }
    // Group similar creatives (simple grouping by first 50 chars)
    const adGroups = new Map();
    (data || []).forEach((ad) => {
        const key = ad.creative.substring(0, 50).toLowerCase().replace(/\s+/g, ' ');
        const existing = adGroups.get(key) || {
            creative_preview: ad.creative.substring(0, 100) + (ad.creative.length > 100 ? '...' : ''),
            platform: ad.platform,
            competitor_name: ad.competitor_name,
            count: 0,
            first_seen: ad.created_at,
            last_seen: ad.created_at
        };
        existing.count += 1;
        if (new Date(ad.created_at) < new Date(existing.first_seen)) {
            existing.first_seen = ad.created_at;
        }
        if (new Date(ad.created_at) > new Date(existing.last_seen)) {
            existing.last_seen = ad.created_at;
        }
        adGroups.set(key, existing);
    });
    // Convert to array and sort by count
    const result = Array.from(adGroups.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
    return result;
}
