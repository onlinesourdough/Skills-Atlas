import type { AtlasPack, AtlasSkill, RelationEvidence } from "../types.js";

export function repositoryKey(pack: AtlasPack): string {
  return pack.repositoryId === undefined ? pack.id : `github:${pack.repositoryId}`;
}
export function skillRepositoryKey(skill: AtlasSkill): string {
  return skill.sourceKey ?? skill.sourceRepository ?? skill.id.split(":").slice(0, 2).join(":");
}
// Dark, separated hues on the paper canvas. Identity labels remain the primary
// cue for color-blind users and libraries larger than the finite palette.
export const REPOSITORY_COLORS = [
  "#2864a0",
  "#a34427",
  "#16755a",
  "#84459c",
  "#886211",
  "#b03966",
  "#3d747c",
  "#655c99",
  "#626e2b",
  "#825449",
  "#555d68",
  "#7a493d",
] as const;

export function repositoryColors(
  keys: readonly string[],
  previous = new Map<string, string>(),
): Map<string, string> {
  const result = new Map<string, string>();
  const current = [...new Set(keys)].sort();
  for (const key of current) {
    const color = previous.get(key);
    if (color) result.set(key, color);
  }
  for (const key of current) {
    if (result.has(key)) continue;
    result.set(
      key,
      REPOSITORY_COLORS.find((color) => ![...result.values()].includes(color)) ??
        REPOSITORY_COLORS[result.size % REPOSITORY_COLORS.length]!,
    );
  }
  return result;
}

// This is a view over already authorized visible snapshots. Never fetch a link.
export function visibleWorkspace(
  packs: readonly AtlasPack[],
  colors = repositoryColors(packs.map(repositoryKey)),
): AtlasSkill[] {
  const skills = packs.flatMap((pack) =>
    pack.skills.map((skill) => ({
      ...skill,
      sourceKey: repositoryKey(pack),
      sourceRepository: pack.repository,
      sourceRevision: pack.revision,
      sourceColor: colors.get(repositoryKey(pack)) ?? REPOSITORY_COLORS[0],
    })),
  );
  const loaded = new Map(skills.map((skill) => [skill.id, skill]));
  const files = new Map<string, AtlasSkill[]>();
  for (const pack of packs) {
    if (pack.source !== "github") continue;
    for (const skill of pack.skills) {
      const url = `https://github.com/${pack.repository}/blob/${pack.revision}/${skill.sourcePath.split("/").map(encodeURIComponent).join("/")}`;
      const matches = files.get(url) ?? [];
      matches.push(skill);
      files.set(url, matches);
    }
  }
  return skills
    .map((skill) => {
      const evidence = skill.evidence?.map((item): RelationEvidence => {
        const { targetId: previous, explanation: _explanation, ...base } = item;
        if (previous && loaded.get(previous)?.sourceKey === skill.sourceKey)
          return { ...base, status: "resolved", targetId: previous };
        if (item.kind !== "reference" || !item.target.startsWith("https://github.com/"))
          return {
            ...base,
            status: item.status === "ambiguous" ? "ambiguous" : "unresolved",
            explanation: "No unique target in the visible loaded source.",
          };
        // Compare canonical encoded full file paths. Branch names, redirects, URL
        // credentials, query strings and a different revision cannot resolve.
        const matches = files.get(item.target.split("#", 1)[0]!) ?? [];
        return {
          ...base,
          status: matches.length === 1 ? "resolved" : matches.length ? "ambiguous" : "unresolved",
          ...(matches.length === 1
            ? { targetId: matches[0]!.id }
            : {
                explanation: matches.length
                  ? "Multiple loaded targets match this exact file and revision."
                  : "No unique visible loaded file at this exact repository, revision and path.",
              }),
        };
      });
      return {
        ...skill,
        ...(evidence ? { evidence } : {}),
        relations: evidence
          ? [...new Set(evidence.flatMap((item) => (item.targetId ? [item.targetId] : [])))]
          : skill.relations.filter((id) => loaded.get(id)?.sourceKey === skill.sourceKey),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

export interface OverlapGroup {
  kind: "identical-content" | "same-name" | "same-description";
  evidenceKinds: OverlapGroup["kind"][];
  skills: AtlasSkill[];
}
export function overlapGroups(skills: readonly AtlasSkill[]): OverlapGroup[] {
  const result: OverlapGroup[] = [];
  const members = new Map<string, OverlapGroup>();
  for (const kind of ["identical-content", "same-name", "same-description"] as const) {
    const groups = new Map<string, AtlasSkill[]>();
    for (const skill of skills) {
      const key =
        kind === "identical-content"
          ? skill.markdown
          : (kind === "same-name" ? skill.name : skill.description)
              .trim()
              .replace(/\s+/gu, " ")
              .toLowerCase();
      if (!key) continue;
      const group = groups.get(key) ?? [];
      group.push(skill);
      groups.set(key, group);
    }
    for (const group of groups.values()) {
      if (new Set(group.map(skillRepositoryKey)).size < 2) continue;
      const key = JSON.stringify(group.map((skill) => skill.id).sort());
      const existing = members.get(key);
      if (existing) existing.evidenceKinds.push(kind);
      else {
        const candidate = { kind, evidenceKinds: [kind], skills: group };
        members.set(key, candidate);
        result.push(candidate);
      }
    }
  }
  return result;
}
