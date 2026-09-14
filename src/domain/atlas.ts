import type { AtlasSkill, RepositoryHealthSignal } from "../types.js";

export function categoriesForSkills(skills: readonly AtlasSkill[]): string[] {
  return [
    "All skills",
    ...[...new Set(skills.map((skill) => skill.category))].sort((left, right) =>
      left.localeCompare(right),
    ),
  ];
}

export function reconcileCategory(skills: readonly AtlasSkill[], category: string): string {
  return categoriesForSkills(skills).includes(category) ? category : "All skills";
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
      skill.sourceRepository ?? "",
      skill.markdown,
    ]
      .join(" ")
      .toLocaleLowerCase()
      .includes(normalized);
  });
}

export function findSkill(skills: readonly AtlasSkill[], id: string): AtlasSkill | undefined {
  return skills.find((skill) => skill.id === id);
}

export interface RelationEdge {
  sourceId: string;
  targetId: string;
}

export interface GraphCategoryState {
  id: string;
  emphasized: boolean;
}

export function graphCategoryEmphasis(
  skills: readonly AtlasSkill[],
  category: string,
): GraphCategoryState[] {
  const selectedCategoryExists = skills.some((skill) => skill.category === category);
  const emphasizeAll = category === "All skills" || !selectedCategoryExists;
  return skills.map((skill) => ({
    id: skill.id,
    emphasized: emphasizeAll || skill.category === category,
  }));
}

export function relationEdges(skills: readonly AtlasSkill[]): RelationEdge[] {
  const loaded = new Set(skills.map((skill) => skill.id));
  const edges = new Map<string, RelationEdge>();
  for (const skill of skills) {
    for (const relation of skill.relations) {
      if (!loaded.has(relation) || relation === skill.id) continue;
      const sourceId = skill.id;
      const targetId = relation;
      const key = `${sourceId}::${targetId}`;
      edges.set(key, { sourceId, targetId });
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
  const missingMetadata = skills.filter((skill) => skill.category === "Uncategorized").length;
  const isolated = skills.filter(
    (skill) => skill.relations.length === 0 && !inbound.has(skill.id),
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
      detail: "Skills stay visible as Uncategorized; the Atlas does not invent departments.",
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
