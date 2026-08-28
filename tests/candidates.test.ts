import { describe, expect, it } from "vitest";
import { candidatesFromSubdomains } from "../lib/candidates";

describe("candidatesFromSubdomains", () => {
  it("returns each candidate once when CT data repeats a subdomain", () => {
    const candidates = candidatesFromSubdomains(["assets.example.com", "assets.example.com"]);

    expect(candidates).toContain("assets");
    expect(new Set(candidates).size).toBe(candidates.length);
  });

  it("caps the bounded candidate list at 60 entries", () => {
    const candidates = candidatesFromSubdomains([
      "alpha.example.com",
      "bravo.example.com",
      "charlie.example.com",
      "delta.example.com",
      "echo.example.com",
      "foxtrot.example.com",
    ]);

    expect(candidates).toHaveLength(60);
  });
});
