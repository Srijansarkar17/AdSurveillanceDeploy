import { supabase } from '../config/supabase';

export async function runSummaryJob() {
  const { error } = await supabase.rpc('run_summary_metrics');

  if (error) {
    console.error('❌ Summary job failed', error);
    throw error;
  }

  console.log('✅ Summary metrics generated');
}
