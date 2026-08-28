import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";
import { candidatesFromSubdomains } from "@/lib/candidates";
import { buildTargets, checkTarget } from "@/lib/cloudProviders";
import { fetchSubdomains } from "@/lib/ctLogs";
import { isVerified, normalizeDomain } from "@/lib/domainVerification";
import { getAuthenticatedUser } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_ITERATIONS = 12;
const MAX_BUCKET_CHECKS = 80;
const SCAN_BUDGET_MS = 50_000;
const encoder = new TextEncoder();
const sse = (data: unknown) => encoder.encode(`data: ${JSON.stringify(data)}\n\n`);

const tools = [
  { type: "function", function: { name: "fetch_ct_subdomains", description: "Fetch certificate-transparency subdomains for the already authorized domain. Call this first.", parameters: { type: "object", properties: { domain: { type: "string" } }, required: ["domain"] } } },
  { type: "function", function: { name: "check_bucket_name", description: "Check one permitted CT-derived storage name on one provider. This only checks reachability; it never lists objects.", parameters: { type: "object", properties: { name: { type: "string" }, provider: { type: "string", enum: ["AWS_S3", "GCS", "AZURE_BLOB"] } }, required: ["name", "provider"] } } },
];

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedUser();
  if (!auth.user || !auth.supabase) return NextResponse.json({ error: auth.error }, { status: auth.error === "Authentication is not configured." ? 503 : 401 });
  const domain = normalizeDomain(request.nextUrl.searchParams.get("domain") ?? "");
  const verifiedToken = request.nextUrl.searchParams.get("verifiedToken") ?? "";
  if (!domain || !(await isVerified(domain, verifiedToken))) return NextResponse.json({ error: "A current DNS verification token for this exact domain is required." }, { status: 403 });
  if (!process.env.GROQ_API_KEY) return NextResponse.json({ error: "GROQ_API_KEY is not configured on the server." }, { status: 503 });
  const { data: scan } = await auth.supabase.from("scan_history").insert({ user_id: auth.user.id, domain, mode: "agentic" }).select("id").single();

  const stream = new ReadableStream({ async start(controller) {
    const send = (event: unknown) => controller.enqueue(sse(event));
    const deadline = Date.now() + SCAN_BUDGET_MS;
    const messages: any[] = [
      { role: "system", content: "You are an authorized cloud-storage exposure audit agent. First call fetch_ct_subdomains. Use only the permitted candidates returned by that tool, prioritize evidence-supported names, and stop a pattern after repeated NOT_FOUND results. Never request object listing or retrieval. End with a concise summary." },
      { role: "user", content: `Audit only the DNS-verified domain ${domain}.` },
    ];
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    let checks = 0;
    const results: any[] = [];
    let permitted = new Set<string>();
    let ctFetched = false;
    try {
      send({ type: "status", message: "Agent started. It will inspect certificate data before choosing targets." });
      for (let round = 0; round < MAX_ITERATIONS && Date.now() < deadline; round += 1) {
        const completion = await groq.chat.completions.create({ model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile", messages, tools, tool_choice: "auto", parallel_tool_calls: false, temperature: 0.1, max_tokens: 700 });
        const message = completion.choices[0]?.message;
        if (!message) throw new Error("Groq returned no completion");
        messages.push(message);
        if (!message.tool_calls?.length) { send({ type: "summary", message: message.content ?? "Agent completed without a written summary." }); break; }
        for (const call of message.tool_calls) {
          let args: Record<string, unknown> = {};
          try { args = JSON.parse(call.function.arguments || "{}"); } catch { /* validation below */ }
          let result: unknown;
          if (call.function.name === "fetch_ct_subdomains") {
            if (ctFetched || String(args.domain ?? "").toLowerCase().replace(/\.$/, "") !== domain) result = { error: "Only one CT lookup for the authorized domain is permitted." };
            else {
              ctFetched = true;
              const subdomains = await fetchSubdomains(domain);
              permitted = new Set(candidatesFromSubdomains(subdomains));
              result = { subdomains: subdomains.slice(0, 100), permitted_candidates: [...permitted], note: "Choose only from permitted_candidates." };
              send({ type: "status", message: `Agent received ${subdomains.length} CT-log subdomains and ${permitted.size} permitted candidates.` });
            }
          } else if (call.function.name === "check_bucket_name") {
            const name = String(args.name ?? "").toLowerCase();
            const provider = String(args.provider ?? "");
            if (!ctFetched || !permitted.has(name)) result = { error: "Name is not a permitted CT-derived candidate." };
            else if (checks >= MAX_BUCKET_CHECKS) result = { error: `Hard cap of ${MAX_BUCKET_CHECKS} bucket checks reached.` };
            else if (!["AWS_S3", "GCS", "AZURE_BLOB"].includes(provider)) result = { error: "Invalid provider." };
            else {
              checks += 1;
              const target = buildTargets(name).find((item) => item.provider === provider)!;
              result = await checkTarget(target, name);
              results.push(result);
              send({ type: "result", ...(result as object) });
            }
          } else result = { error: "Unknown tool." };
          messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
        }
      }
      if (Date.now() >= deadline) send({ type: "status", level: "warning", message: "Agent work budget reached; ending before the function timeout." });
      if (scan) await auth.supabase.from("scan_history").update({ completed_at: new Date().toISOString(), checks, public_findings: results.filter((item) => item.status === "PUBLIC").length, results }).eq("id", scan.id);
      send({ type: "done", checks, maxChecks: MAX_BUCKET_CHECKS });
    } catch (error) {
      send({ type: "status", level: "error", message: error instanceof Error ? error.message : "Agent scan failed" });
      send({ type: "done", checks, maxChecks: MAX_BUCKET_CHECKS });
    } finally { controller.close(); }
  }});
  return new NextResponse(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}
