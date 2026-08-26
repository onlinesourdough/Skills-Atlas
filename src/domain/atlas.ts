import type { AskAnswer, AtlasSkill } from "../types.js";

export const CATEGORIES = [
  "All skills",
  "Shape the work",
  "Govern the shelf",
  "Route responsibly",
  "Prove the result",
  "Distribute the work",
] as const;

export function categoriesForSkills(skills: readonly AtlasSkill[]): string[] {
  const known = new Set<string>(CATEGORIES);
  const additional = [...new Set(skills.map((skill) => skill.category))]
    .filter((category) => !known.has(category))
    .sort((left, right) => left.localeCompare(right));
  return [...CATEGORIES, ...additional];
}

export function filterSkills(
  skills: readonly AtlasSkill[],
  query: string,
  category: string,
): AtlasSkill[] {
  const normalized = query.trim().toLocaleLowerCase();
  return skills.filter((skill) => {
    const categoryMatch = category === "All skills" || skill.category === category;
    if (!categoryMatch) return false;
    if (!normalized) return true;
    return [skill.name, skill.description, skill.category, skill.slug, skill.sourcePath]
      .join(" ")
      .toLocaleLowerCase()
      .includes(normalized);
  });
}

export function findSkill(skills: readonly AtlasSkill[], slug: string): AtlasSkill | undefined {
  return skills.find((skill) => skill.slug === slug);
}

export function answerQuestion(question: string, skills: readonly AtlasSkill[]): AskAnswer {
  const normalized = question.trim().toLocaleLowerCase();
  const stopWords = new Set([
    "the",
    "and",
    "for",
    "where",
    "does",
    "what",
    "how",
    "is",
    "are",
    "do",
    "i",
  ]);
  const terms = normalized
    .split(/[^a-z0-9-]+/u)
    .filter((term) => term.length > 2 && !stopWords.has(term));

  if (terms.some((term) => ["source", "git", "canonical", "repository"].includes(term))) {
    return {
      title: "Start with the source path",
      body: "The repository remains canonical. The Atlas reads skills/<slug>/SKILL.md and adds a searchable, human-readable map around it.",
      related: ["source-audit", "handoff-map"],
      matched: true,
    };
  }

  const matched = skills.find((skill) =>
    terms.some(
      (term) => skill.slug.includes(term) || skill.name.toLocaleLowerCase().includes(term),
    ),
  );

  if (matched) {
    return {
      title: `${matched.name} is a good first stop`,
      body: `${matched.description} Read the safe preview, then follow its source path in the canonical Git checkout.`,
      related: matched.relations,
      matched: true,
    };
  }

  if (terms.some((term) => ["share", "team", "latest", "distribute"].includes(term))) {
    return {
      title: "Follow the distribution trail",
      body: "Use the shared library to find a reviewed skill, then trace its Git source and release note before connecting a team checkout.",
      related: ["manage-skills", "release-notes"],
      matched: true,
    };
  }

  return {
    title: "Try a narrower Atlas question",
    body: "Ask about a skill, the canonical Git source, or how a reviewed version reaches a team. This answer comes from the bundled index; runtime AI is off.",
    related: skills.slice(0, 3).map((skill) => skill.slug),
    matched: false,
  };
}
