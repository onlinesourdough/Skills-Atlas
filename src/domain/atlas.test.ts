import { describe, expect, it } from "vitest";
import { BUNDLED_SKILLS } from "../data/bundled-skills.js";
import { answerQuestion, categoriesForSkills, filterSkills } from "./atlas.js";

describe("atlas index behavior", () => {
  it("filters by text and category without mutating the source", () => {
    const result = filterSkills(BUNDLED_SKILLS, "source", "Govern the shelf");
    expect(result.map((skill) => skill.slug)).toEqual(["source-audit"]);
    expect(BUNDLED_SKILLS).toHaveLength(8);
  });

  it("answers deterministically from the bundled index", () => {
    const answer = answerQuestion("where is the canonical git source?", BUNDLED_SKILLS);
    expect(answer.title).toBe("Start with the source path");
    expect(answer.related).toContain("source-audit");
    expect(answer.matched).toBe(true);
  });

  it("returns a useful bounded fallback for unknown questions", () => {
    const answer = answerQuestion("what should I bake today?", BUNDLED_SKILLS);
    expect(answer.matched).toBe(false);
    expect(answer.body).toContain("runtime AI is off");
    expect(answer.related).toHaveLength(3);
  });

  it("keeps mounted source categories available to every atlas view", () => {
    const custom = { ...BUNDLED_SKILLS[0]!, category: "Team practice" };
    expect(categoriesForSkills([custom])).toContain("Team practice");
  });
});
