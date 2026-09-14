import { unified } from "unified";
import remarkParse from "remark-parse";
import type { AtlasSkill, RelationEvidence } from "../types.js";
import type { ParsedSkill } from "./skill-parser.js";
import { SkillParseError } from "./skill-parser.js";

export const MAX_RELATION_EVIDENCE = 512;

// Resolve within the observed repository only. No fetch, URL traversal, or inference.
export function relativeRepositoryPath(sourcePath: string, href: string): string | null {
  if (!href || /^(?:[a-z][a-z0-9+.-]*:|\/|#)/iu.test(href) || href.includes("\\")) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(href.split(/[?#]/u)[0] ?? "");
  } catch {
    return null;
  }
  if (
    !decoded ||
    [...decoded].some((character) => character.charCodeAt(0) < 32) ||
    decoded.includes("\\") ||
    decoded.startsWith("/")
  )
    return null;
  const parts = sourcePath.split("/").slice(0, -1);
  for (const part of decoded.split("/")) {
    if (part === "." || part === "") continue;
    if (part === "..") {
      if (!parts.length) return null;
      parts.pop();
    } else parts.push(part);
  }
  return parts.join("/");
}

export function relationEvidence(
  source: ParsedSkill,
  skills: readonly AtlasSkill[],
): RelationEvidence[] {
  const evidence: RelationEvidence[] = [];
  for (const target of source.explicitRelations) {
    const matches = skills.filter((skill) => skill.slug === target);
    evidence.push({
      kind: "declared-relation",
      sourcePath: source.sourcePath,
      line: source.relationLine,
      target,
      status: matches.length === 1 ? "resolved" : matches.length ? "ambiguous" : "unresolved",
      ...(matches.length === 1 ? { targetId: matches[0]!.id } : {}),
    });
  }
  // Replace frontmatter with blank lines to preserve source positions in the Markdown AST.
  const markdown = source.markdown.replace(
    /^\uFEFF?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/u,
    (match) => match.replace(/[^\n]/gu, ""),
  );
  const tree = unified().use(remarkParse).parse(markdown);
  const definitions = new Map<string, string>();
  function definitionsIn(node: typeof tree | (typeof tree.children)[number]): void {
    if (node.type === "definition" && !definitions.has(node.identifier))
      definitions.set(node.identifier, node.url);
    if ("children" in node)
      for (const child of node.children) definitionsIn(child as (typeof tree.children)[number]);
  }
  definitionsIn(tree);
  function visit(node: typeof tree | (typeof tree.children)[number]): void {
    const target =
      node.type === "link"
        ? node.url
        : node.type === "linkReference"
          ? definitions.get(node.identifier)
          : undefined;
    if (target) {
      if (evidence.length >= MAX_RELATION_EVIDENCE) throw new SkillParseError("invalid-metadata");
      const path = relativeRepositoryPath(source.sourcePath, target);
      const match = skills.find((skill) => skill.sourcePath === path);
      evidence.push({
        kind: "reference",
        sourcePath: source.sourcePath,
        line: node.position?.start.line ?? 1,
        target,
        status: match ? "resolved" : "unresolved",
        ...(match ? { targetId: match.id } : {}),
      });
    }
    if ("children" in node)
      for (const child of node.children) visit(child as (typeof tree.children)[number]);
  }
  visit(tree);
  return evidence;
}
