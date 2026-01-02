import { supabase } from '../config/supabase';

export interface Competitor {
  id: string;
  name: string;
  domain?: string;
  industry?: string;
  user_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompetitorInput {
  name: string;
  domain?: string;
  industry?: string;
  user_id: string;
  is_active?: boolean;
}

/**
 * Upsert competitor with duplicate prevention for the same user
 */
export async function upsertCompetitor(name: string, userId: string): Promise<Competitor> {
  if (!userId) {
    throw new Error('User ID is required to create/update a competitor');
  }

  const cleanName = name.trim();
  
  console.log(`🔍 Checking competitor: "${cleanName}" for user: ${userId}`);

  // First, check if competitor already exists for this user
  const { data: existing, error: findError } = await supabase
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
  const { data, error } = await supabase
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
      const { data: existingComp } = await supabase
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
export async function getCompetitorsByUser(userId: string): Promise<Competitor[]> {
  const { data, error } = await supabase
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
export async function getCompetitorById(id: string, userId: string): Promise<Competitor | null> {
  const { data, error } = await supabase
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
function removeDuplicates(competitors: Competitor[]): Competitor[] {
  const seen = new Set<string>();
  const unique: Competitor[] = [];

  for (const comp of competitors) {
    const key = comp.name.toLowerCase().trim();
    
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(comp);
    } else {
      console.log(`⚠️ Removing duplicate competitor: ${comp.name}`);
    }
  }

  return unique;
}

/**
 * Check if competitor already exists for user
 */
export async function competitorExists(name: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
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
export async function deactivateCompetitor(id: string, userId: string): Promise<void> {
  const { error } = await supabase
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
export async function batchCreateCompetitors(
  competitorNames: string[], 
  userId: string
): Promise<Competitor[]> {
  const competitors: CompetitorInput[] = competitorNames.map(name => ({
    name: name.trim(),
    user_id: userId,
    is_active: true
  }));

  const { data, error } = await supabase
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
export async function searchCompetitors(
  userId: string, 
  searchTerm: string, 
  limit: number = 10
): Promise<Competitor[]> {
  const { data, error } = await supabase
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
export async function getCompetitorCount(userId: string): Promise<number> {
  const { count, error } = await supabase
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
export async function updateCompetitor(
  id: string, 
  userId: string, 
  updates: Partial<Omit<Competitor, 'id' | 'user_id' | 'created_at'>>
): Promise<Competitor> {
  const { data, error } = await supabase
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