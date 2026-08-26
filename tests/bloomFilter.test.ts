import { describe, expect, it } from "vitest";
import { BloomFilter } from "../lib/bloomFilter";

describe("BloomFilter", () => {
  it("finds a previously added item", () => {
    const filter = new BloomFilter();
    filter.add("ct-derived-candidate");
    expect(filter.has("ct-derived-candidate")).toBe(true);
  });
});
