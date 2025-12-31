import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Track if Supabase is properly configured
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

// Log warning but don't crash the app if missing
if (!isSupabaseConfigured) {
  console.error(
    '[Bad Bingo] Supabase not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env file.\n' +
    'The app will show a configuration error screen.'
  );
}

// Create client with fallback values to prevent crash (will fail gracefully at runtime)
export const supabase: SupabaseClient<Database> = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

// Untyped client for operations where TypeScript inference fails
// The Database types are correct but Supabase's TypeScript bindings don't infer them
// This is a pragmatic workaround until proper type generation is set up
export const db = supabase as any;

// Helper to get current user ID
export const getCurrentUserId = async (): Promise<string | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
};

// Check if user is authenticated
export const isAuthenticated = async (): Promise<boolean> => {
  const { data: { session } } = await supabase.auth.getSession();
  return !!session;
};
