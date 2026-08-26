import { createServerSupabaseClient, isSupabaseConfigured } from "./supabase";

export async function getAuthenticatedUser() {
  if (!isSupabaseConfigured) return { user: null, supabase: null, error: "Authentication is not configured." };
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { user, supabase, error: user ? null : "Sign in is required to run and save an audit." };
}
