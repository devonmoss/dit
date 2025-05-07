import { createClient } from '@supabase/supabase-js';

// Use environment variables instead of hardcoded values
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Basic validation to ensure we have required config
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL or Anonymous Key is missing! Add to .env.local', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey
  });
}

// Create a debug version of the client to help troubleshoot realtime issues
const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10 // Increase from default 1, helps with race channels
    }
  },
  auth: {
    persistSession: true, 
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

export default supabaseClient; 