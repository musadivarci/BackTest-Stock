import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rnnpfiwzhbimslduanlo.supabase.co';
const supabaseKey = 'sb_publishable_RQ2xGy5kIhoyl4dBTwI8UQ_6kOcLqlT';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
