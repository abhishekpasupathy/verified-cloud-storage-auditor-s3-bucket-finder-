import { NextRequest, NextResponse } from "next/server";
import { createChallenge, isVerified, normalizeDomain } from "@/lib/domainVerification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: { domain?: unknown; token?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Expected JSON body" }, { status: 400 }); }
  const domain = typeof body.domain === "string" ? normalizeDomain(body.domain) : null;
  if (!domain) return NextResponse.json({ error: "Enter a valid registrable domain" }, { status: 400 });

  if (typeof body.token !== "string") {
    const token = createChallenge(domain);
    return NextResponse.json({ domain, token, record: `bucket-finder-verify=${token}`, instructions: `Add this TXT value to ${domain}, then wait for DNS propagation and click Verify.` });
  }

  const found = await isVerified(domain, body.token);
  return NextResponse.json(found ? { verified: true } : { verified: false, error: "TXT record was not found yet. DNS changes can take time to propagate." });
}
