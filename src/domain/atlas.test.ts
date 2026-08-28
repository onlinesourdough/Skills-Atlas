import { describe, expect, it } from "vitest";
import { EXAMPLE_PACK } from "../data/bundled-skills.js";
import {
  categoriesForSkills,
  filterSkills,
  graphCategoryEmphasis,
  relationCount,
  relationEdges,
  repositoryHealth,
} from "./atlas.js";

describe("atlas index behavior", () => {
  it("searches complete active-pack truth and filters by real category", () => {
    const result = filterSkills(EXAMPLE_PACK.skills, "acceptance evidence", "Delivery");
    expect(result.map((skill) => skill.slug)).toEqual(["launch-checklist"]);
    expect(categoriesForSkills(EXAMPLE_PACK.skills)).toEqual([
      "All skills",
      "Delivery",
      "Governance",
      "Operations",
      "Sales",
    ]);
  });

  it("counts only declared relations and computes data-supported health", () => {
    expect(relationCount(EXAMPLE_PACK.skills)).toBeGreaterThan(0);
    expect(repositoryHealth(EXAMPLE_PACK.skills)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "loaded", count: EXAMPLE_PACK.skills.length }),
        expect.objectContaining({ id: "metadata", count: 0 }),
        expect.objectContaining({ id: "relations", count: 0 }),
      ]),
    );
  });

  it("does not invent metadata or relations for an isolated imported skill", () => {
    const isolated = {
      ...EXAMPLE_PACK.skills[0]!,
      category: "Uncategorised",
      relations: [],
    };
    expect(repositoryHealth([isolated])).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "metadata", count: 1, severity: "attention" }),
        expect.objectContaining({ id: "relations", count: 1, severity: "attention" }),
      ]),
    );
  });

  it("keeps a one-way relation whose declaration is lexically descending", () => {
    const source = {
      ...EXAMPLE_PACK.skills[0]!,
      slug: "z-skill",
      relations: ["a-skill"],
    };
    const target = {
      ...EXAMPLE_PACK.skills[1]!,
      slug: "a-skill",
      relations: [],
    };

    expect(relationEdges([source, target])).toEqual([{ startSlug: "a-skill", endSlug: "z-skill" }]);
    expect(relationCount([source, target])).toBe(1);
  });

  it("uses category selection as emphasis without removing graph skills", () => {
    const emphasis = graphCategoryEmphasis(EXAMPLE_PACK.skills, "Delivery");
    expect(emphasis.map((item) => item.slug)).toEqual(
      EXAMPLE_PACK.skills.map((skill) => skill.slug),
    );
    expect(emphasis.filter((item) => item.emphasized).map((item) => item.slug)).toEqual(
      EXAMPLE_PACK.skills
        .filter((skill) => skill.category === "Delivery")
        .map((skill) => skill.slug),
    );
    expect(
      graphCategoryEmphasis(EXAMPLE_PACK.skills, "All skills").every((item) => item.emphasized),
    ).toBe(true);
  });
});
