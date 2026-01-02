"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertCompetitor = upsertCompetitor;
exports.getCompetitorsByUser = getCompetitorsByUser;
exports.getCompetitorById = getCompetitorById;
exports.competitorExists = competitorExists;
exports.deactivateCompetitor = deactivateCompetitor;
exports.batchCreateCompetitors = batchCreateCompetitors;
exports.searchCompetitors = searchCompetitors;
exports.getCompetitorCount = getCompetitorCount;
exports.updateCompetitor = updateCompetitor;
const supabase_1 = require("../config/supabase");
/**
 * Upsert competitor with duplicate prevention for the same user
 */
async function upsertCompetitor(name, userId) {
    if (!userId) {
        throw new Error('User ID is required to create/update a competitor');
    }
    const cleanName = name.trim();
    console.log(`🔍 Checking competitor: "${cleanName}" for user: ${userId}`);
    // First, check if competitor already exists for this user
    const { data: existing, error: findError } = await supabase_1.supabase
        .from('competitors')
        .select('*')
        .eq('name', cleanName)
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();
    if (findError && findError.code !== 'PGRST116') {
        console.error('❌ ERROR FINDING EXISTING COMPETITOR', findError);
        throw findError;
    }
    // If competitor already exists, return it
    if (existing) {
        console.log(`✅ COMPETITOR EXISTS: ${existing.name} (ID: ${existing.id})`);
        return existing;
    }
    // If not found, create new competitor
    const { data, error } = await supabase_1.supabase
        .from('competitors')
        .insert({
        name: cleanName,
        user_id: userId,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    })
        .select()
        .single();
    if (error) {
        console.error('❌ COMPETITOR INSERT FAILED', error);
        // Check if it's a duplicate error and try to fetch existing
        if (error.code === '23505') { // Unique violation
            console.log('🔄 Duplicate detected, fetching existing competitor...');
            const { data: existingComp } = await supabase_1.supabase
                .from('competitors')
                .select('*')
                .eq('name', cleanName)
                .eq('user_id', userId)
                .single();
            if (existingComp) {
                return existingComp;
            }
        }
        throw error;
    }
    console.log(`✅ COMPETITOR CREATED: ${data.name} (ID: ${data.id}) for user ${userId}`);
    return data;
}
/**
 * Get competitors for user with duplicate filtering
 */
async function getCompetitorsByUser(userId) {
    const { data, error } = await supabase_1.supabase
        .from('competitors')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('name', { ascending: true });
    if (error) {
        console.error('❌ ERROR FETCHING USER COMPETITORS', error);
        throw error;
    }
    // Remove duplicates (case-insensitive)
    const uniqueCompetitors = removeDuplicates(data || []);
    console.log(`📊 Found ${uniqueCompetitors.length} unique competitors for user ${userId}`);
    return uniqueCompetitors;
}
/**
 * Get competitor by ID
 */
async function getCompetitorById(id, userId) {
    const { data, error } = await supabase_1.supabase
        .from('competitors')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .single();
    if (error) {
        if (error.code === 'PGRST116') {
            return null;
        }
        console.error('❌ ERROR FETCHING COMPETITOR BY ID', error);
        throw error;
    }
    return data;
}
/**
 * Remove duplicate competitors (case-insensitive)
 */
function removeDuplicates(competitors) {
    const seen = new Set();
    const unique = [];
    for (const comp of competitors) {
        const key = comp.name.toLowerCase().trim();
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(comp);
        }
        else {
            console.log(`⚠️ Removing duplicate competitor: ${comp.name}`);
        }
    }
    return unique;
}
/**
 * Check if competitor already exists for user
 */
async function competitorExists(name, userId) {
    const { data, error } = await supabase_1.supabase
        .from('competitors')
        .select('id')
        .eq('name', name.trim())
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('❌ ERROR CHECKING COMPETITOR', error);
        throw error;
    }
    return !!data;
}
/**
 * Deactivate a competitor (soft delete)
 */
async function deactivateCompetitor(id, userId) {
    const { error } = await supabase_1.supabase
        .from('competitors')
        .update({
        is_active: false,
        updated_at: new Date().toISOString()
    })
        .eq('id', id)
        .eq('user_id', userId);
    if (error) {
        console.error('❌ ERROR DEACTIVATING COMPETITOR', error);
        throw error;
    }
    console.log(`✅ Competitor ${id} deactivated for user ${userId}`);
}
/**
 * Batch create competitors
 */
async function batchCreateCompetitors(competitorNames, userId) {
    const competitors = competitorNames.map(name => ({
        name: name.trim(),
        user_id: userId,
        is_active: true
    }));
    const { data, error } = await supabase_1.supabase
        .from('competitors')
        .upsert(competitors, {
        onConflict: 'name,user_id',
        ignoreDuplicates: true
    })
        .select();
    if (error) {
        console.error('❌ BATCH COMPETITOR CREATION FAILED', error);
        throw error;
    }
    console.log(`✅ Created/updated ${data?.length || 0} competitors for user ${userId}`);
    return data || [];
}
/**
 * Search competitors by name
 */
async function searchCompetitors(userId, searchTerm, limit = 10) {
    const { data, error } = await supabase_1.supabase
        .from('competitors')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .ilike('name', `%${searchTerm}%`)
        .limit(limit)
        .order('name', { ascending: true });
    if (error) {
        console.error('❌ ERROR SEARCHING COMPETITORS', error);
        throw error;
    }
    return data || [];
}
/**
 * Get competitor count for user
 */
async function getCompetitorCount(userId) {
    const { count, error } = await supabase_1.supabase
        .from('competitors')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_active', true);
    if (error) {
        console.error('❌ ERROR GETTING COMPETITOR COUNT', error);
        return 0;
    }
    return count || 0;
}
/**
 * Update competitor information
 */
async function updateCompetitor(id, userId, updates) {
    const { data, error } = await supabase_1.supabase
        .from('competitors')
        .update({
        ...updates,
        updated_at: new Date().toISOString()
    })
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();
    if (error) {
        console.error('❌ ERROR UPDATING COMPETITOR', error);
        throw error;
    }
    console.log(`✅ Updated competitor: ${data.name}`);
    return data;
}
