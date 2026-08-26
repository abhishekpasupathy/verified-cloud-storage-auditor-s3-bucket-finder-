import { describe, expect, it } from "vitest";
import { deriveTokensFromSubdomains } from "../lib/cloudProviders";

describe("deriveTokensFromSubdomains", () => {
  it("prioritizes labels observed in CT subdomains", () => {
    const tokens = deriveTokensFromSubdomains(["assets.example.com", "assets-dev.example.com"]);
    expect(tokens.find((item) => item.token === "assets")?.cost).toBeLessThan(12);
  });
});
