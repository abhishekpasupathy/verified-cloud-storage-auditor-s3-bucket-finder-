export type WeightedToken = { token: string; cost: number };

type Node = { name: string; cost: number; depth: number };

/**
 * Generates candidate names in ascending accumulated token cost.
 *
 * With no heuristic or goal state, this is a uniform-cost / best-first walk
 * over the implicit candidate graph.
 */
export function bestFirstGenerateCandidates(
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
