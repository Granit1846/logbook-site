import { createClient } from '@supabase/supabase-js';

const DEFAULT_URL = 'https://zjagjauwmpuzcwzidhkn.supabase.co';
const DEFAULT_KEY = 'sb_publishable_6IaiQHYrjD2auxTmnfjqzQ_ev_Ec55B';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string)?.trim() || DEFAULT_URL;
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string)?.trim() || DEFAULT_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
