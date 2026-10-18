import { createClient, processLock } from '@supabase/supabase-js';

const DEFAULT_URL = 'https://zjagjauwmpuzcwzidhkn.supabase.co';
const DEFAULT_KEY = 'sb_publishable_6IaiQHYrjD2auxTmnfjqzQ_ev_Ec55B';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string)?.trim() || DEFAULT_URL;
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string)?.trim() || DEFAULT_KEY;

// The default navigator.locks lock never resolves in some messenger WebViews (MAX), which hangs every
// session-using request. The site and Mini App run in one tab, so an in-page lock is enough.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { lock: processLock } });
