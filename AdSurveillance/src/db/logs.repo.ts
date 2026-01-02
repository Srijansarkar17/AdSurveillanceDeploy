import { supabase } from '../config/supabase';


export async function logExecution(log: any) {
  await supabase.from('data_source_logs').insert(log);
}
