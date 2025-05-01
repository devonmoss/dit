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

// Add debug logging to inspect the Supabase Realtime status
console.log('📡 Supabase Realtime client created with config:', {
  url: supabaseUrl ? `${supabaseUrl.substring(0, 8)}...` : 'missing',
  hasKey: !!supabaseAnonKey,
  eventsPerSecond: 10
});

// Log when in browser to help debug
if (typeof window !== 'undefined') {
  console.log('💻 Running in browser environment - Supabase Realtime should connect automatically');
}

export default supabaseClient; 