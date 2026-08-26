export type WeightedToken = { token: string; cost: number };

type Node = { name: string; cost: number; depth: number };

/**
 * Best-first (A* with a zero admissible heuristic) walk over names formed by
 * appending caller-supplied tokens. No vocabulary is embedded here.
 */
export function astarGenerateCandidates(
  base: string,
  tokens: WeightedToken[],
  maxDepth: number,
  maxCandidates: number,
): string[] {
  const normalizedBase = base.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "");
  if (!normalizedBase) return [];
  const queue: Node[] = [{ name: normalizedBase, cost: 0, depth: 0 }];
  const seen = new Set<string>([normalizedBase]);
  const output: string[] = [];

  while (queue.length && output.length < maxCandidates) {
    const current = queue.shift()!;
    // The observed base is also a valid zero-cost candidate; later nodes are
    // ordered after it by their accumulated token cost.
    output.push(current.name);
    if (current.depth === maxDepth) continue;

    for (const { token, cost } of tokens) {
      const name = `${current.name}-${token}`.replace(/-+/g, "-");
      if (name.length < 3 || name.length > 63 || seen.has(name)) continue;
      seen.add(name);
      const next: Node = { name, cost: current.cost + cost, depth: current.depth + 1 };
      const index = queue.findIndex((node) => node.cost > next.cost);
      if (index === -1) queue.push(next);
      else queue.splice(index, 0, next);
    }
  }
  return output;
}
