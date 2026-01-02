"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserById = getUserById;
exports.getUserByEmail = getUserByEmail;
exports.upsertUser = upsertUser;
exports.updateUserLastLogin = updateUserLastLogin;
exports.updateUserProfile = updateUserProfile;
exports.deactivateUser = deactivateUser;
exports.getActiveUsers = getActiveUsers;
exports.getUserCount = getUserCount;
exports.searchUsers = searchUsers;
exports.userExists = userExists;
exports.getUserStatistics = getUserStatistics;
const supabase_1 = require("../config/supabase");
/**
 * Get user by ID
 */
async function getUserById(userId) {
    try {
        const { data, error } = await supabase_1.supabase
            .from('users')
            .select('*')
            .eq('user_id', userId)
            .single();
        if (error) {
            if (error.code === 'PGRST116') { // No rows found
                return null;
            }
            console.error(`❌ ERROR FETCHING USER ${userId}:`, error);
            return null;
        }
        return data;
    }
    catch (error) {
        console.error(`❌ EXCEPTION FETCHING USER ${userId}:`, error);
        return null;
    }
}
/**
 * Get user by email
 */
async function getUserByEmail(email) {
    try {
        const { data, error } = await supabase_1.supabase
            .from('users')
            .select('*')
            .eq('email', email.toLowerCase().trim())
            .single();
        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }
            console.error(`❌ ERROR FETCHING USER BY EMAIL ${email}:`, error);
            return null;
        }
        return data;
    }
    catch (error) {
        console.error(`❌ EXCEPTION FETCHING USER BY EMAIL ${email}:`, error);
        return null;
    }
}
/**
 * Create or update user
 */
async function upsertUser(user) {
    const { user_id, email, name, industry } = user;
    const userData = {
        user_id,
        email: email.toLowerCase().trim(),
        name: name?.trim(),
        industry: industry?.trim(),
        is_active: true,
        updated_at: new Date().toISOString()
    };
    const { data, error } = await supabase_1.supabase
        .from('users')
        .upsert(userData, {
        onConflict: 'user_id',
        ignoreDuplicates: false
    })
        .select()
        .single();
    if (error) {
        console.error('❌ USER UPSERT FAILED:', error);
        throw error;
    }
    console.log(`✅ User ${data.email} upserted successfully`);
    return data;
}
/**
 * Update user last login time
 */
async function updateUserLastLogin(userId) {
    try {
        const { error } = await supabase_1.supabase
            .from('users')
            .update({
            last_login: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
            .eq('user_id', userId);
        if (error) {
            console.error(`❌ ERROR UPDATING USER LAST LOGIN ${userId}:`, error);
            throw error;
        }
        console.log(`✅ Updated last login for user ${userId}`);
    }
    catch (error) {
        console.error(`❌ EXCEPTION UPDATING LAST LOGIN ${userId}:`, error);
        throw error;
    }
}
/**
 * Update user profile
 */
async function updateUserProfile(userId, updates) {
    const { data, error } = await supabase_1.supabase
        .from('users')
        .update({
        ...updates,
        updated_at: new Date().toISOString()
    })
        .eq('user_id', userId)
        .select()
        .single();
    if (error) {
        console.error(`❌ ERROR UPDATING USER PROFILE ${userId}:`, error);
        throw error;
    }
    console.log(`✅ Updated profile for user ${userId}`);
    return data;
}
/**
 * Deactivate user (soft delete)
 */
async function deactivateUser(userId) {
    const { error } = await supabase_1.supabase
        .from('users')
        .update({
        is_active: false,
        updated_at: new Date().toISOString()
    })
        .eq('user_id', userId);
    if (error) {
        console.error(`❌ ERROR DEACTIVATING USER ${userId}:`, error);
        throw error;
    }
    console.log(`✅ User ${userId} deactivated`);
}
/**
 * Get active users
 */
async function getActiveUsers(limit = 100) {
    const { data, error } = await supabase_1.supabase
        .from('users')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) {
        console.error('❌ ERROR FETCHING ACTIVE USERS:', error);
        throw error;
    }
    return data || [];
}
/**
 * Get user count
 */
async function getUserCount() {
    const { count, error } = await supabase_1.supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);
    if (error) {
        console.error('❌ ERROR GETTING USER COUNT:', error);
        return 0;
    }
    return count || 0;
}
/**
 * Search users by name or email
 */
async function searchUsers(searchTerm, limit = 20) {
    const { data, error } = await supabase_1.supabase
        .from('users')
        .select('*')
        .eq('is_active', true)
        .or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
        .limit(limit)
        .order('created_at', { ascending: false });
    if (error) {
        console.error('❌ ERROR SEARCHING USERS:', error);
        throw error;
    }
    return data || [];
}
/**
 * Check if user exists
 */
async function userExists(userId) {
    const { data, error } = await supabase_1.supabase
        .from('users')
        .select('user_id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_active', true);
    if (error) {
        console.error(`❌ ERROR CHECKING USER EXISTENCE ${userId}:`, error);
        return false;
    }
    return (data?.length || 0) > 0;
}
/**
 * Get user statistics
 */
async function getUserStatistics(userId) {
    try {
        // Get user info
        const user = await getUserById(userId);
        if (!user) {
            throw new Error(`User ${userId} not found`);
        }
        // Get competitor count
        const { count: competitorCount } = await supabase_1.supabase
            .from('competitors')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('is_active', true);
        // Get total ads count (from daily_metrics)
        const { count: adsCount } = await supabase_1.supabase
            .from('daily_metrics')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);
        // Calculate days since creation
        const createdDate = new Date(user.created_at);
        const today = new Date();
        const daysSinceCreation = Math.floor((today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
        return {
            days_since_creation: daysSinceCreation,
            competitor_count: competitorCount || 0,
            total_ads_fetched: adsCount || 0,
            last_login_date: user.last_login || null
        };
    }
    catch (error) {
        console.error(`❌ ERROR GETTING USER STATISTICS ${userId}:`, error);
        throw error;
    }
}
