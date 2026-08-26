import { describe, expect, it } from "vitest";
import { astarGenerateCandidates } from "../lib/astar";

describe("astarGenerateCandidates", () => {
  it("returns cheapest candidates first without duplicates", () => {
    expect(astarGenerateCandidates("assets", [{ token: "prod", cost: 1 }, { token: "archive", cost: 5 }], 1, 3))
      .toEqual(["assets", "assets-prod", "assets-archive"]);
  });
});
