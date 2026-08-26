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
  try {
    const records = await resolveTxt(domain);
    return records.some((parts) => parts.join("") === `bucket-finder-verify=${token}`);
  } catch {
    return false;
  }
}
