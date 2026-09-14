import { describe, expect, it } from "vitest";
import { EXAMPLE_PACK } from "../data/bundled-skills.js";
import {
  categoriesForSkills,
  reconcileCategory,
  filterSkills,
  graphCategoryEmphasis,
  relationCount,
  relationEdges,
  repositoryHealth,
} from "./atlas.js";

describe("atlas index behavior", () => {
  it("reconciles an absent visible category without changing a still-valid category", () => {
    const delivery = EXAMPLE_PACK.skills.filter((skill) => skill.category === "Delivery");
    const operations = EXAMPLE_PACK.skills.filter((skill) => skill.category === "Operations");
    let category = reconcileCategory([...delivery, ...operations], "Delivery");
    expect(category).toBe("Delivery");
    expect(reconcileCategory(delivery, category)).toBe("Delivery");
    category = reconcileCategory(operations, category);
    expect(category).toBe("All skills");
    expect(filterSkills(operations, "", category)).toEqual(operations);
    expect(reconcileCategory([...delivery, ...operations], category)).toBe("All skills");
    expect(reconcileCategory([], "Operations")).toBe("All skills");
  });
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
      category: "Uncategorized",
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
      id: "z-skill",
      relations: ["a-skill"],
    };
    const target = {
      ...EXAMPLE_PACK.skills[1]!,
      slug: "a-skill",
      id: "a-skill",
      relations: [],
    };

    expect(relationEdges([source, target])).toEqual([{ sourceId: "z-skill", targetId: "a-skill" }]);
    expect(relationCount([source, target])).toBe(1);
  });

  it("uses category selection as emphasis without removing graph skills", () => {
    const emphasis = graphCategoryEmphasis(EXAMPLE_PACK.skills, "Delivery");
    expect(emphasis.map((item) => item.id)).toEqual(EXAMPLE_PACK.skills.map((skill) => skill.id));
    expect(emphasis.filter((item) => item.emphasized).map((item) => item.id)).toEqual(
      EXAMPLE_PACK.skills.filter((skill) => skill.category === "Delivery").map((skill) => skill.id),
    );
    expect(
      graphCategoryEmphasis(EXAMPLE_PACK.skills, "All skills").every((item) => item.emphasized),
    ).toBe(true);
  });
});
