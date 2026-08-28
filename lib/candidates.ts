import { bestFirstGenerateCandidates } from "./bestFirst";
import { deriveTokensFromSubdomains } from "./cloudProviders";

const MAX_TOKENS = 20;
const MAX_BASES = 20;
const MAX_DEPTH = 2;
const MAX_PER_BASE = 12;
const MAX_TOTAL = 60;

/** Turns CT-derived subdomains into a bounded, exactly de-duplicated list. */
export function candidatesFromSubdomains(subdomains: string[]): string[] {
  const tokens = deriveTokensFromSubdomains(subdomains).slice(0, MAX_TOKENS);
  const bases = [...new Set(
    subdomains.flatMap((name) => name.split(".").slice(0, -2).flatMap((label) => label.split(/[^a-z0-9]+/))),
  )]
    .filter((label) => label.length >= 2 && label.length <= 40)
    .slice(0, MAX_BASES);

  const seen = new Set<string>();
  const candidates: string[] = [];
  for (const base of bases) {
    for (const candidate of bestFirstGenerateCandidates(base, tokens, MAX_DEPTH, MAX_PER_BASE)) {
      if (seen.has(candidate)) continue;
      seen.add(candidate);
      candidates.push(candidate);
      if (candidates.length >= MAX_TOTAL) return candidates;
    }
  }
  return candidates;
}
