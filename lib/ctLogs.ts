type CtEntry = { name_value?: string };

function validDomain(domain: string): boolean {
  return /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(domain);
}

export async function fetchSubdomains(domain: string): Promise<string[]> {
  const normalized = domain.toLowerCase().replace(/\.$/, "");
  if (!validDomain(normalized)) throw new Error("Invalid domain");
  const response = await fetch(`https://crt.sh/?q=%25.${encodeURIComponent(normalized)}&output=json`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`CT log lookup failed (${response.status})`);
  const entries = (await response.json()) as CtEntry[];
  const subdomains = new Set<string>();
  for (const entry of entries) {
    for (const value of (entry.name_value ?? "").split("\n")) {
      const name = value.toLowerCase().replace(/^\*\./, "").replace(/\.$/, "");
      if (name.endsWith(`.${normalized}`) && name !== normalized) subdomains.add(name);
    }
  }
  return [...subdomains].sort();
}
