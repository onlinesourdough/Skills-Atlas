import { describe, expect, it } from "vitest";
import { MAX_SKILL_BYTES, parseSkillMarkdown, SkillParseError } from "./skill-parser.js";

const valid = `---
name: clarify
description: Bound an uncertain request before implementation.
metadata:
  category: Planning
  relations:
    - review-work
---

# Clarify the work

Use a small decision record before work starts.
`;

describe("parseSkillMarkdown", () => {
  it("preserves complete Markdown and reads bounded optional metadata", () => {
    const skill = parseSkillMarkdown(valid, "clarify");
    expect(skill).toMatchObject({
      slug: "clarify",
      name: "Clarify the work",
      category: "Planning",
      explicitRelations: ["review-work"],
      sourcePath: "skills/clarify/SKILL.md",
      markdown: valid,
    });
  });

  it("accepts unrelated safe frontmatter without treating it as Atlas truth", () => {
    const source = valid.replace("metadata:", "license: MIT\nmetadata:");
    expect(parseSkillMarkdown(source, "clarify").category).toBe("Planning");
  });

  it("denies missing, malformed, mismatched, duplicated, or aliased frontmatter", () => {
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
    expect(() =>
      parseSkillMarkdown(
        valid.replace("description:", "description: first\ndescription:"),
        "clarify",
      ),
    ).toThrowError(new SkillParseError("invalid-frontmatter"));
    expect(() =>
      parseSkillMarkdown(
        valid.replace("category: Planning", "category: &group Planning\n  owner: *group"),
        "clarify",
      ),
    ).toThrowError();
  });

  it("denies empty, oversized, or invalid metadata", () => {
    expect(() =>
      parseSkillMarkdown(
        valid.replace("# Clarify the work\n\nUse a small decision record before work starts.", ""),
        "clarify",
      ),
    ).toThrowError(new SkillParseError("empty-body"));
    expect(() =>
      parseSkillMarkdown(`${valid}\n${"x".repeat(MAX_SKILL_BYTES)}`, "clarify"),
    ).toThrowError(new SkillParseError("file-too-large"));
    expect(() =>
      parseSkillMarkdown(valid.replace("- review-work", "- ../review-work"), "clarify"),
    ).toThrowError(new SkillParseError("invalid-metadata"));
  });
});
