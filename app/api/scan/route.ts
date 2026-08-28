import { NextRequest, NextResponse } from "next/server";
import { candidatesFromSubdomains } from "@/lib/candidates";
import { buildTargets, checkTarget } from "@/lib/cloudProviders";
import { fetchSubdomains } from "@/lib/ctLogs";
import { isVerified, normalizeDomain } from "@/lib/domainVerification";
import { getAuthenticatedUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const encoder = new TextEncoder();
const sse = (data: unknown) => encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
// Leaves time for stream completion before Vercel's 60-second function limit.
const SCAN_BUDGET_MS = 50_000;

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedUser();
  if (!auth.user || !auth.supabase) return NextResponse.json({ error: auth.error }, { status: auth.error === "Authentication is not configured." ? 503 : 401 });
  const domain = normalizeDomain(request.nextUrl.searchParams.get("domain") ?? "");
  const verifiedToken = request.nextUrl.searchParams.get("verifiedToken") ?? "";
  if (!domain || !(await isVerified(domain, verifiedToken))) {
    return NextResponse.json({ error: "A current DNS verification token for this exact domain is required." }, { status: 403 });
  }
  const { data: scan } = await auth.supabase.from("scan_history").insert({ user_id: auth.user.id, domain, mode: "standard" }).select("id").single();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) => controller.enqueue(sse(event));
      const deadline = Date.now() + SCAN_BUDGET_MS;
      const results: unknown[] = [];
      try {
        send({ type: "status", message: "Reading certificate-transparency logs…" });
        const subdomains = await fetchSubdomains(domain);
        send({ type: "status", message: `Found ${subdomains.length} certificate-log subdomains; deriving names from them.` });
        const candidates = candidatesFromSubdomains(subdomains);
        send({ type: "status", message: `Checking ${candidates.length} CT-derived candidates across three providers (8 concurrent requests)…` });
        const jobs = candidates.flatMap((name) => buildTargets(name).map((target) => ({ name, target })));
        let next = 0;
        const worker = async () => {
          while (next < jobs.length && Date.now() < deadline) {
            const job = jobs[next++];
            const result = await checkTarget(job.target, job.name);
            results.push(result); send({ type: "result", ...result });
          }
        };
        await Promise.all(Array.from({ length: Math.min(8, jobs.length) }, worker));
        const completedChecks = next;
        if (scan) await auth.supabase.from("scan_history").update({ completed_at: new Date().toISOString(), checks: completedChecks, public_findings: results.filter((item: any) => item.status === "PUBLIC").length, results }).eq("id", scan.id);
        send({ type: "done", candidates: candidates.length, checks: completedChecks, timedOut: completedChecks < jobs.length });
      } catch (error) {
        send({ type: "status", level: "error", message: error instanceof Error ? error.message : "Scan failed" });
        send({ type: "done" });
      } finally { controller.close(); }
    },
  });
  return new NextResponse(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}
