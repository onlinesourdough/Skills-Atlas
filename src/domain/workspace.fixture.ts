import type { AtlasPack, AtlasSkill } from "../types.js";
import { parseSkillMarkdown } from "./skill-parser.js";
import { relationEvidence } from "./relations.js";

// Fictional sources only. Reusable by domain tests and lead browser fixtures.
export function sixRepositoryFixture(count = 44): AtlasPack[] {
  const names = ["authoring", "reviewing", "operations", "quality", "automations", "knowledge"];
  const packs: AtlasPack[] = names.slice(0, Math.min(count, 6)).map((name, index) => ({
    kind: "atlas-pack",
    id: `github:${9100 + index}`,
    repositoryId: 9100 + index,
    repository: `synthetic-organization/${name}`,
    repositoryUrl: `https://github.com/synthetic-organization/${name}`,
    revision: String(index + 1).repeat(40),
    defaultBranch: "main",
    access: "read",
    source: "github",
    snapshotLabel: "Synthetic repository graph fixture",
    components: ["skills"],
    skills: [],
  }));
  for (let i = 0; i < count; i++) {
    const repository = i % packs.length;
    const ordinal = Math.floor(i / packs.length);
    const pack = packs[repository]!;
    const slug =
      ordinal === 0 || (repository === 4 && ordinal === 1)
        ? "shared"
        : repository === 1 && ordinal === 1
          ? "foreign-only"
          : `item-${ordinal}`;
    const path = `${repository === 4 && ordinal === 1 ? ".agents/skills" : "skills"}/${slug}/SKILL.md`;
    const identical = ordinal === 0 && (repository === 2 || repository === 3);
    const description =
      ordinal === 0
        ? "Review shared instructions."
        : `Synthetic description ${repository}/${ordinal}.`;
    const links =
      repository === 0 && ordinal === 0 && packs.length === 6
        ? [
            `[Exact](https://github.com/${packs[1]!.repository}/blob/${packs[1]!.revision}/skills/shared/SKILL.md)`,
            `[Repeated exact](https://github.com/${packs[1]!.repository}/blob/${packs[1]!.revision}/skills/shared/SKILL.md#details)`,
            "[Internal](../item-1/SKILL.md)",
            `[Other revision](https://github.com/${packs[1]!.repository}/blob/${"f".repeat(40)}/skills/shared/SKILL.md)`,
            `[Mutable branch](https://github.com/${packs[1]!.repository}/blob/main/skills/shared/SKILL.md)`,
            `[Missing file](https://github.com/${packs[1]!.repository}/blob/${packs[1]!.revision}/skills/missing/SKILL.md)`,
            `[Optional loaded source](https://github.com/${packs[5]!.repository}/blob/${packs[5]!.revision}/skills/shared/SKILL.md)`,
          ].join("\n\n")
        : "";
    const metadata =
      repository === 4 && ordinal === 0
        ? "relations: [shared]\n"
        : repository === 0 && ordinal === 0
          ? "relations: [foreign-only]\n"
          : "";
    const markdown = `---\nname: ${slug}\ndescription: ${description}\n${metadata}---\n\n# ${ordinal === 0 ? "Shared check" : `Synthetic item ${ordinal}`}\n\n${identical ? "Identical synthetic full content." : `Distinct synthetic body ${repository}/${ordinal}.`}\n\n${links}\n`;
    const parsed = parseSkillMarkdown(markdown, slug);
    pack.skills.push({
      id: `${pack.id}:${path}`,
      slug,
      sourcePath: path,
      name: parsed.name,
      description: parsed.description,
      markdown,
      category: "Uncategorized",
      tone: "clay",
      relations: [],
    });
  }
  for (const pack of packs) {
    pack.skills = pack.skills.map((skill): AtlasSkill => {
      const parsed = {
        ...parseSkillMarkdown(skill.markdown, skill.slug),
        sourcePath: skill.sourcePath,
      };
      const evidence = relationEvidence(parsed, pack.skills);
      return {
        ...skill,
        evidence,
        relations: [...new Set(evidence.flatMap((item) => (item.targetId ? [item.targetId] : [])))],
      };
    });
  }
  return packs;
}

export function unevenSixRepositoryFixture(): AtlasPack[] {
  const counts = [3, 21, 4, 8, 2, 6];
  return sixRepositoryFixture(126).map((pack, index) => ({
    ...pack,
    skills: pack.skills.slice(0, counts[index]),
  }));
}
