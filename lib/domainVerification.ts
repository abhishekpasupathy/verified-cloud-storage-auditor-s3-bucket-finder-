import { randomBytes } from "crypto";
import { resolveTxt } from "dns/promises";

export function normalizeDomain(value: string): string | null {
  const domain = value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\.$/, "");
  return /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain) ? domain : null;
}

export function createChallenge(domain: string): string {
  // The TXT value itself is the durable proof. This remains valid across
  // separate Vercel function instances without requiring a database or secret.
  void domain;
  return randomBytes(24).toString("base64url");
}

export async function isVerified(domain: string, token: string): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{20,}$/.test(token)) return false;
  const expected = `bucket-finder-verify=${token}`;

  // 1. Try Cloudflare DNS-over-HTTPS API (works reliably in Vercel serverless without socket restrictions)
  try {
    const cfRes = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=TXT`, {
      headers: { Accept: "application/dns-json" },
      signal: AbortSignal.timeout(4_000),
      cache: "no-store",
    });
    if (cfRes.ok) {
      const data = await cfRes.json();
      if (Array.isArray(data.Answer)) {
        for (const ans of data.Answer) {
          const txtVal = String(ans.data ?? "").replace(/^"|"$/g, "").replace(/\\"/g, '"');
          if (txtVal === expected || txtVal.includes(expected)) return true;
        }
      }
    }
  } catch {
    /* Fall back to Google DoH / Node DNS */
  }

  // 2. Try Google DNS-over-HTTPS API
  try {
    const gRes = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=TXT`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(4_000),
      cache: "no-store",
    });
    if (gRes.ok) {
      const data = await gRes.json();
      if (Array.isArray(data.Answer)) {
        for (const ans of data.Answer) {
          const txtVal = String(ans.data ?? "").replace(/^"|"$/g, "").replace(/\\"/g, '"');
          if (txtVal === expected || txtVal.includes(expected)) return true;
        }
      }
    }
  } catch {
    /* Fall back to Node DNS */
  }

  // 3. Fallback to Node.js native dns/promises
  try {
    const records = await resolveTxt(domain);
    return records.some((parts) => parts.join("") === expected);
  } catch {
    return false;
  }
}
