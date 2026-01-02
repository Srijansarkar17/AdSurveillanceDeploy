import { supabase } from '../config/supabase';

export interface User {
  user_id: string;
  email: string;
  name?: string;
  industry?: string | null;
  is_active: boolean;
  last_login?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserInput {
  user_id: string;
  email: string;
  name?: string;
  industry?: string;
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<User | null> {
  try {
    const { data, error } = await supabase
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
  } catch (error) {
    console.error(`❌ EXCEPTION FETCHING USER ${userId}:`, error);
    return null;
  }
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  try {
    const { data, error } = await supabase
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
  } catch (error) {
    console.error(`❌ EXCEPTION FETCHING USER BY EMAIL ${email}:`, error);
    return null;
  }
}

/**
 * Create or update user
 */
export async function upsertUser(user: UserInput): Promise<User> {
  const { user_id, email, name, industry } = user;
  
  const userData = {
    user_id,
    email: email.toLowerCase().trim(),
    name: name?.trim(),
    industry: industry?.trim(),
    is_active: true,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
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
export async function updateUserLastLogin(userId: string): Promise<void> {
  try {
    const { error } = await supabase
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
  } catch (error) {
    console.error(`❌ EXCEPTION UPDATING LAST LOGIN ${userId}:`, error);
    throw error;
  }
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  userId: string, 
  updates: Partial<Pick<User, 'name' | 'industry'>>
): Promise<User> {
  const { data, error } = await supabase
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
export async function deactivateUser(userId: string): Promise<void> {
  const { error } = await supabase
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
export async function getActiveUsers(limit: number = 100): Promise<User[]> {
  const { data, error } = await supabase
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
export async function getUserCount(): Promise<number> {
  const { count, error } = await supabase
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
export async function searchUsers(
  searchTerm: string, 
  limit: number = 20
): Promise<User[]> {
  const { data, error } = await supabase
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
export async function userExists(userId: string): Promise<boolean> {
  const { data, error } = await supabase
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
export async function getUserStatistics(userId: string): Promise<{
  days_since_creation: number;
  competitor_count: number;
  total_ads_fetched: number;
  last_login_date: string | null;
}> {
  try {
    // Get user info
    const user = await getUserById(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    // Get competitor count
    const { count: competitorCount } = await supabase
      .from('competitors')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_active', true);

    // Get total ads count (from daily_metrics)
    const { count: adsCount } = await supabase
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
  } catch (error) {
    console.error(`❌ ERROR GETTING USER STATISTICS ${userId}:`, error);
    throw error;
  }
}