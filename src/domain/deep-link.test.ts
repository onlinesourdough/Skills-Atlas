import { describe, expect, it } from "vitest";
import { internalDestination, skillDestination } from "./deep-link.js";

describe("token-free account/source/skill destinations", () => {
  const path =
    "/?account=11&source=00000000-0000-4000-8000-000000000001&skill=github%3A101%3Askills%2Fone%2FSKILL.md#library";
  it("preserves exact stable identity across login", () => {
    expect(internalDestination(path, "https://atlas.example")).toBe(path);
    const graph = path.replace("#library", "#graph");
    expect(internalDestination(graph, "https://atlas.example")).toBe(graph);
    expect(skillDestination(new URL(path, "https://atlas.example").search)).toEqual({
      account: 11,
      source: "00000000-0000-4000-8000-000000000001",
      skill: "github:101:skills/one/SKILL.md",
    });
  });
  it.each([
    "https://evil.example/",
    "//evil.example/",
    "/\\evil.example/",
    "/auth/github/callback?code=x",
    `${path}&token=secret`,
    "/?account=11&account=22&source=x&skill=x#library",
    "/?account=9007199254740992&source=x&skill=x#library",
  ])("rejects foreign or ambiguous destination %s", (value) => {
    expect(internalDestination(value, "https://atlas.example")).toBeNull();
  });
});
