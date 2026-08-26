import { describe, expect, it } from "vitest";
import { MAX_SKILL_BYTES, parseSkillMarkdown, SkillParseError } from "./skill-parser.js";

const valid = `---
name: clarify
description: Bound an uncertain request before implementation.
---

# Clarify

Use a small decision record before work starts.
`;

describe("parseSkillMarkdown", () => {
  it("parses the canonical name/description frontmatter and a safe excerpt", () => {
    const skill = parseSkillMarkdown(valid, "clarify");
    expect(skill).toMatchObject({
      slug: "clarify",
      name: "clarify",
      sourcePath: "skills/clarify/SKILL.md",
    });
    expect(skill.excerpt).toContain("Clarify");
  });

  it("denies missing, malformed, or mismatched frontmatter", () => {
    expect(() => parseSkillMarkdown("# no frontmatter", "clarify")).toThrowError(
      new SkillParseError("missing-frontmatter"),
    );
    expect(() => parseSkillMarkdown("---\nname: clarify\n---\nbody", "clarify")).toThrowError(
      new SkillParseError("missing-required-field"),
    );
    expect(() => parseSkillMarkdown(valid, "../clarify")).toThrowError(
      new SkillParseError("invalid-slug"),
    );
    expect(() =>
      parseSkillMarkdown(valid.replace("name: clarify", "name: other"), "clarify"),
    ).toThrowError(new SkillParseError("invalid-name"));
  });

  it("denies unsupported fields, duplicate fields, and empty content", () => {
    expect(() =>
      parseSkillMarkdown(valid.replace("description:", "version: 1\ndescription:"), "clarify"),
    ).toThrowError(new SkillParseError("invalid-frontmatter"));
    expect(() =>
      parseSkillMarkdown(
        valid.replace("description:", "description: first\ndescription:"),
        "clarify",
      ),
    ).toThrowError(new SkillParseError("invalid-frontmatter"));
    expect(() =>
      parseSkillMarkdown(
        valid.replace("# Clarify\n\nUse a small decision record before work starts.", ""),
        "clarify",
      ),
    ).toThrowError(new SkillParseError("empty-body"));
  });

  it("denies oversized content before parsing", () => {
    const oversized = `${valid}\n${"x".repeat(MAX_SKILL_BYTES)}`;
    expect(() => parseSkillMarkdown(oversized, "clarify")).toThrowError(
      new SkillParseError("file-too-large"),
    );
  });

  it("keeps mounted frontmatter within the browser contract", () => {
    expect(() => parseSkillMarkdown(valid, "a".repeat(81))).toThrowError(
      new SkillParseError("invalid-slug"),
    );
    expect(() =>
      parseSkillMarkdown(
        valid.replace("Bound an uncertain request before implementation.", "x".repeat(321)),
        "clarify",
      ),
    ).toThrowError(new SkillParseError("invalid-description"));
  });
});
