import { NextRequest, NextResponse } from "next/server";
import { astarGenerateCandidates } from "@/lib/astar";
import { BloomFilter } from "@/lib/bloomFilter";
import { buildTargets, checkTarget, deriveTokensFromSubdomains } from "@/lib/cloudProviders";
import { fetchSubdomains } from "@/lib/ctLogs";
import { isVerified, normalizeDomain } from "@/lib/domainVerification";

export const runtime = "nodejs";
export const maxDuration = 60;

const encoder = new TextEncoder();
const sse = (data: unknown) => encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
// Leaves time for stream completion before Vercel's 60-second function limit.
const SCAN_BUDGET_MS = 50_000;

export async function GET(request: NextRequest) {
  const domain = normalizeDomain(request.nextUrl.searchParams.get("domain") ?? "");
  const verifiedToken = request.nextUrl.searchParams.get("verifiedToken") ?? "";
  if (!domain || !(await isVerified(domain, verifiedToken))) {
    return NextResponse.json({ error: "A current DNS verification token for this exact domain is required." }, { status: 403 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) => controller.enqueue(sse(event));
      const deadline = Date.now() + SCAN_BUDGET_MS;
      try {
        send({ type: "status", message: "Reading certificate-transparency logs…" });
        const subdomains = await fetchSubdomains(domain);
        send({ type: "status", message: `Found ${subdomains.length} certificate-log subdomains; deriving names from them.` });
        const tokens = deriveTokensFromSubdomains(subdomains).slice(0, 20);
        const bases = [...new Set(subdomains.flatMap((name) => name.split(".").slice(0, -2).flatMap((label) => label.split(/[^a-z0-9]+/))))]
          .filter((label) => label.length >= 2 && label.length <= 40)
          .slice(0, 20);
        const dedupe = new BloomFilter();
        const candidates: string[] = [];
        for (const base of bases) {
          for (const candidate of astarGenerateCandidates(base, tokens, 2, 12)) {
            if (!dedupe.has(candidate)) { dedupe.add(candidate); candidates.push(candidate); }
            if (candidates.length >= 60) break;
          }
          if (candidates.length >= 60) break;
        }
        send({ type: "status", message: `Checking ${candidates.length} CT-derived candidates across three providers (8 concurrent requests)…` });
        const jobs = candidates.flatMap((name) => buildTargets(name).map((target) => ({ name, target })));
        let next = 0;
        const worker = async () => {
          while (next < jobs.length && Date.now() < deadline) {
            const job = jobs[next++];
            send({ type: "result", ...(await checkTarget(job.target, job.name)) });
          }
        };
        await Promise.all(Array.from({ length: Math.min(8, jobs.length) }, worker));
        const completedChecks = next;
        send({ type: "done", candidates: candidates.length, checks: completedChecks, timedOut: completedChecks < jobs.length });
      } catch (error) {
        send({ type: "status", level: "error", message: error instanceof Error ? error.message : "Scan failed" });
        send({ type: "done" });
      } finally { controller.close(); }
    },
  });
  return new NextResponse(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}
