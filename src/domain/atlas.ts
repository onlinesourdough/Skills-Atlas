import type { AtlasSkill, RepositoryHealthSignal } from "../types.js";

export function categoriesForSkills(skills: readonly AtlasSkill[]): string[] {
  return [
    "All skills",
    ...[...new Set(skills.map((skill) => skill.category))].sort((left, right) =>
      left.localeCompare(right),
    ),
  ];
}

export function filterSkills(
  skills: readonly AtlasSkill[],
  query: string,
  category: string,
): AtlasSkill[] {
  const normalized = query.trim().toLocaleLowerCase();
  return skills.filter((skill) => {
    if (category !== "All skills" && skill.category !== category) return false;
    if (!normalized) return true;
    return [
      skill.name,
      skill.description,
      skill.category,
      skill.slug,
      skill.sourcePath,
      skill.markdown,
    ]
      .join(" ")
      .toLocaleLowerCase()
      .includes(normalized);
  });
}

export function findSkill(skills: readonly AtlasSkill[], slug: string): AtlasSkill | undefined {
  return skills.find((skill) => skill.slug === slug);
}

export interface RelationEdge {
  startSlug: string;
  endSlug: string;
}

export interface GraphCategoryState {
  slug: string;
  emphasized: boolean;
}

export function graphCategoryEmphasis(
  skills: readonly AtlasSkill[],
  category: string,
): GraphCategoryState[] {
  const selectedCategoryExists = skills.some((skill) => skill.category === category);
  const emphasizeAll = category === "All skills" || !selectedCategoryExists;
  return skills.map((skill) => ({
    slug: skill.slug,
    emphasized: emphasizeAll || skill.category === category,
  }));
}

export function relationEdges(skills: readonly AtlasSkill[]): RelationEdge[] {
  const loaded = new Set(skills.map((skill) => skill.slug));
  const edges = new Map<string, RelationEdge>();
  for (const skill of skills) {
    for (const relation of skill.relations) {
      if (!loaded.has(relation) || relation === skill.slug) continue;
      const ascending = skill.slug.localeCompare(relation) <= 0;
      const startSlug = ascending ? skill.slug : relation;
      const endSlug = ascending ? relation : skill.slug;
      const key = `${startSlug}::${endSlug}`;
      edges.set(key, { startSlug, endSlug });
    }
  }
  return [...edges.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, edge]) => edge);
}

export function relationCount(skills: readonly AtlasSkill[]): number {
  return relationEdges(skills).length;
}

export function repositoryHealth(skills: readonly AtlasSkill[]): RepositoryHealthSignal[] {
  const inbound = new Set(skills.flatMap((skill) => skill.relations));
  const missingMetadata = skills.filter((skill) => skill.category === "Uncategorised").length;
  const isolated = skills.filter(
    (skill) => skill.relations.length === 0 && !inbound.has(skill.slug),
  ).length;
  return [
    {
      id: "loaded",
      label: "Readable skill files",
      detail: "Every skill in the active plugin passed the bounded Markdown contract.",
      count: skills.length,
      severity: "good",
    },
    {
      id: "metadata",
      label: "Missing category metadata",
      detail: "Skills stay visible as Uncategorised; the Atlas does not invent departments.",
      count: missingMetadata,
      severity: missingMetadata > 0 ? "attention" : "good",
    },
    {
      id: "relations",
      label: "Isolated skills",
      detail: "No explicit relation points to or from these skills in the loaded source.",
      count: isolated,
      severity: isolated > 0 ? "attention" : "good",
    },
  ];
}
