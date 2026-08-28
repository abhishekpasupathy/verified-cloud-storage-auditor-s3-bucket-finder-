import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://qfmakzkqirswnourwugx.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmbWFremtxaXJzd25vdXJ3dWd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NDU4MTgsImV4cCI6MjEwMzMyMTgxOH0.56mJJnYQr0AYHA_ayDfHyLp7cjO8WWTlS1hobokbLAM";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export function createServerSupabaseClient() {
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured");
  const store = cookies();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: { getAll: () => store.getAll(), setAll: () => {} },
  });
}
