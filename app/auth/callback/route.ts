import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = request.nextUrl.searchParams.get("next") ?? "/";
  const response = NextResponse.redirect(new URL(next, request.url));
  if (code && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const store = cookies();
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      cookies: { getAll: () => store.getAll(), setAll: (items) => items.forEach(({ name, value, options }) => response.cookies.set(name, value, options)) },
    });
    await supabase.auth.exchangeCodeForSession(code);
  }
  return response;
}
