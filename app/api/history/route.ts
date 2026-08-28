import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getAuthenticatedUser();
  if (!auth.user || !auth.supabase) return NextResponse.json({ error: auth.error }, { status: auth.error === "Authentication is not configured." ? 503 : 401 });
  const { data, error } = await auth.supabase.from("scan_history").select("id, domain, mode, started_at, completed_at, checks, public_findings, results").order("started_at", { ascending: false }).limit(25);
  if (error) return NextResponse.json({ error: "Could not load history. Run the database SQL setup in README." }, { status: 500 });
  return NextResponse.json({ scans: data });
}
