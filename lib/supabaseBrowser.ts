import { createBrowserClient } from "@supabase/ssr";

// Public browser configuration. Environment variables take precedence so these
// values can still be managed through Vercel/Supabase in production.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://qfmakzkqirswnourwugx.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmbWFremtxaXJzd25vdXJ3dWd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NDU4MTgsImV4cCI6MjEwMzMyMTgxOH0.56mJJnYQr0AYHA_ayDfHyLp7cjO8WWTlS1hobokbLAM";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export function createBrowserSupabaseClient() {
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured");
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
