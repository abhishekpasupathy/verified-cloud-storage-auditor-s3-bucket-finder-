import type { WeightedToken } from "./bestFirst";

export type Provider = "AWS_S3" | "GCS" | "AZURE_BLOB";
export type Target = { provider: Provider; url: string };
export type CheckResult = Target & { name: string; status: "PUBLIC" | "EXISTS_PRIVATE" | "NOT_FOUND" | "UNKNOWN" | "ERROR"; httpStatus?: number };

export function buildTargets(name: string): Target[] {
  const safe = encodeURIComponent(name);
  return [
    { provider: "AWS_S3", url: `https://${safe}.s3.amazonaws.com/` },
    { provider: "GCS", url: `https://storage.googleapis.com/${safe}/` },
    { provider: "AZURE_BLOB", url: `https://${safe}.blob.core.windows.net/` },
  ];
}

export async function checkTarget(target: Target, name: string): Promise<CheckResult> {
  try {
    const response = await fetch(target.url, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(5_000), cache: "no-store" });
    const status = response.status === 200 ? "PUBLIC" : response.status === 403 ? "EXISTS_PRIVATE" : response.status === 404 ? "NOT_FOUND" : "UNKNOWN";
    return { ...target, name, status, httpStatus: response.status };
  } catch {
    return { ...target, name, status: "ERROR" };
  }
}

const FALLBACK_TOKENS = ["prod", "dev", "staging", "backup", "assets", "static", "media", "data"];

export function deriveTokensFromSubdomains(subdomains: string[]): WeightedToken[] {
  const counts = new Map<string, number>();
  for (const subdomain of subdomains) {
    const labels = subdomain.split(".").slice(0, -2);
    for (const label of labels) {
      for (const token of label.toLowerCase().split(/[^a-z0-9]+/)) {
        if (token.length >= 2 && token.length <= 30) counts.set(token, (counts.get(token) ?? 0) + 1);
      }
    }
  }
  const observed = [...counts.entries()].map(([token, frequency]) => ({ token, cost: Math.max(1, 10 - frequency) }));
  const known = new Set(observed.map(({ token }) => token));
  return [...observed, ...FALLBACK_TOKENS.filter((token) => !known.has(token)).map((token) => ({ token, cost: 12 }))]
    .sort((a, b) => a.cost - b.cost || a.token.localeCompare(b.token));
}
