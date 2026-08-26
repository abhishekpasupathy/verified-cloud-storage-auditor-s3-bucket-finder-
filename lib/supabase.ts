import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const isSupabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export function createServerSupabaseClient() {
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured");
  const store = cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll: () => store.getAll(), setAll: () => {} },
  });
}
