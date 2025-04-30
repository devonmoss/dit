import { createClient } from '@supabase/supabase-js';

// These should only be used server-side
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

// Create a single supabase client for interacting with your database
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export default supabaseAdmin;