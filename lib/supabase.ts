import { createClient } from '@supabase/supabase-js';

// IMPORTANT: Move these to secure env vars in production. For Expo, use app.config.js or eas secrets.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://dciatqwbjhfsiquazfwc.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjaWF0cXdiamhmc2lxdWF6ZndjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1NDI4NDIsImV4cCI6MjA3ODExODg0Mn0.IJGuCf4-8BC-YBbMt2z_VNoRNMJ6tYr8keq6q4zchnU';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export async function getPublicUrl(bucket: string, path: string) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
