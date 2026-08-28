type CtEntry = { name_value?: string };

function validDomain(domain: string): boolean {
  return /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(domain);
}

export async function fetchSubdomains(domain: string): Promise<string[]> {
  const normalized = domain.toLowerCase().replace(/\.$/, "");
  if (!validDomain(normalized)) throw new Error("Invalid domain");
  const subdomains = new Set<string>();

  // Helper to filter and normalize subdomains
  const addIfValid = (raw: string) => {
    const name = raw.toLowerCase().trim().replace(/^\*\./, "").replace(/\.$/, "");
    if ((name.endsWith(`.${normalized}`) || name === normalized) && name !== normalized) {
      subdomains.add(name);
    }
  };

  // 1. Primary: crt.sh
  try {
    const response = await fetch(`https://crt.sh/?q=%25.${encodeURIComponent(normalized)}&output=json`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(6_000),
      cache: "no-store",
    });
    if (response.ok) {
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("json")) {
        const entries = (await response.json()) as CtEntry[];
        if (Array.isArray(entries)) {
          for (const entry of entries) {
            for (const value of (entry.name_value ?? "").split("\n")) {
              addIfValid(value);
            }
          }
        }
      }
    }
  } catch {
    /* Continue to fallback providers */
  }

  // 2. Fallback: Certspotter API
  if (subdomains.size === 0) {
    try {
      const csRes = await fetch(`https://api.certspotter.com/v1/issuances?domain=${encodeURIComponent(normalized)}&include_subdomains=true&expand=dns_names`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(5_000),
        cache: "no-store",
      });
      if (csRes.ok) {
        const items = await csRes.json();
        if (Array.isArray(items)) {
          for (const item of items) {
            if (Array.isArray(item.dns_names)) {
              for (const name of item.dns_names) {
                addIfValid(String(name));
              }
            }
          }
        }
      }
    } catch {
      /* Continue to fallback providers */
    }
  }

  // 3. Fallback: HackerTarget HostSearch
  if (subdomains.size === 0) {
    try {
      const htRes = await fetch(`https://api.hackertarget.com/hostsearch/?q=${encodeURIComponent(normalized)}`, {
        signal: AbortSignal.timeout(4_000),
        cache: "no-store",
      });
      if (htRes.ok) {
        const text = await htRes.text();
        for (const line of text.split("\n")) {
          const parts = line.split(",");
          if (parts[0]) addIfValid(parts[0]);
        }
      }
    } catch {
      /* Continue to fallback seed subdomains */
    }
  }

  // 4. Fallback: Common seed subdomains if no CT sources responded
  if (subdomains.size === 0) {
    const commonPrefixes = ["app", "static", "assets", "staging", "api", "media", "data", "cdn", "dev", "prod", "backup", "store", "public", "files", "img", "upload", "docs"];
    for (const prefix of commonPrefixes) {
      subdomains.add(`${prefix}.${normalized}`);
    }
  }

  return [...subdomains].sort();
}
