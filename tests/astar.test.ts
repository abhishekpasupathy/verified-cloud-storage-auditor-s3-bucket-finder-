import { describe, expect, it } from "vitest";
import { bestFirstGenerateCandidates } from "../lib/bestFirst";

describe("bestFirstGenerateCandidates", () => {
  it("returns cheapest candidates first without duplicates", () => {
    expect(bestFirstGenerateCandidates("assets", [{ token: "prod", cost: 1 }, { token: "archive", cost: 5 }], 1, 3))
      .toEqual(["assets", "assets-prod", "assets-archive"]);
  });
});
