import { parseSkillMarkdown } from "../domain/skill-parser.js";
import type { AtlasPack, AtlasSkill, GraphTone } from "../types.js";

interface ExampleSource {
  slug: string;
  category: string;
  tone: GraphTone;
  markdown: string;
}

const EXAMPLE_SOURCES: ExampleSource[] = [
  {
    slug: "customer-handoff",
    category: "Operations",
    tone: "mint",
    markdown: [
      "---",
      "name: customer-handoff",
      "description: Prepare a concise handoff so a teammate can continue customer work with context and a clear next action.",
      "category: Operations",
      "relations: [meeting-brief, knowledge-audit]",
      "---",
      "",
      "# Customer handoff",
      "",
      "Use this fictional example when ownership moves from one teammate to another.",
      "",
      "## Include",
      "",
      "- The customer’s current goal",
      "- Decisions already made",
      "- Open risks and the next named action",
      "",
      "> Keep sensitive customer data in the system that already owns it.",
    ].join("\n"),
  },
  {
    slug: "meeting-brief",
    category: "Operations",
    tone: "mint",
    markdown: [
      "---",
      "name: meeting-brief",
      "description: Turn a meeting goal and known context into a short agenda with the decision needed at the end.",
      "category: Operations",
      "relations: [customer-handoff]",
      "---",
      "",
      "# Meeting brief",
      "",
      "Create a small decision-first agenda from facts already available to the team.",
      "",
      "1. State the decision or outcome.",
      "2. Link the minimum useful context.",
      "3. Name the owner of the next action.",
    ].join("\n"),
  },
  {
    slug: "proposal-review",
    category: "Sales",
    tone: "gold",
    markdown: [
      "---",
      "name: proposal-review",
      "description: Review a draft proposal for evidence, scope, ownership, and a specific customer decision before it is sent.",
      "category: Sales",
      "relations: [customer-handoff, knowledge-audit]",
      "---",
      "",
      "# Proposal review",
      "",
      "Check that every promise has an owner and every important claim has evidence.",
      "",
      "| Check | Question |",
      "| --- | --- |",
      "| Outcome | Is the useful change specific? |",
      "| Scope | Are exclusions visible? |",
      "| Proof | Can the customer verify the result? |",
    ].join("\n"),
  },
  {
    slug: "launch-checklist",
    category: "Delivery",
    tone: "violet",
    markdown: [
      "---",
      "name: launch-checklist",
      "description: Confirm the owner, proof, monitoring, and recovery path before a reviewed change becomes available to users.",
      "category: Delivery",
      "relations: [incident-update, knowledge-audit]",
      "---",
      "",
      "# Launch checklist",
      "",
      "A launch is ready when the result and the recovery path are both observable.",
      "",
      "- [ ] Acceptance evidence is current",
      "- [ ] A named operator can see failure",
      "- [ ] Rollback or forward recovery has been rehearsed",
    ].join("\n"),
  },
  {
    slug: "incident-update",
    category: "Delivery",
    tone: "violet",
    markdown: [
      "---",
      "name: incident-update",
      "description: Write a calm operational update that separates observed impact, current action, owner, and next update time.",
      "category: Delivery",
      "relations: [launch-checklist, customer-handoff]",
      "---",
      "",
      "# Incident update",
      "",
      "Report only what is observed. Do not turn an early theory into a confirmed cause.",
      "",
      "## Update shape",
      "",
      "**Impact:** What users can observe.  ",
      "**Action:** What is happening now.  ",
      "**Owner:** Who is coordinating.  ",
      "**Next update:** A specific time.",
    ].join("\n"),
  },
  {
    slug: "knowledge-audit",
    category: "Governance",
    tone: "blue",
    markdown: [
      "---",
      "name: knowledge-audit",
      "description: Check that a shared instruction still has a source, owner, review date, useful relations, and a recovery path.",
      "category: Governance",
      "relations: [launch-checklist, proposal-review]",
      "---",
      "",
      "# Knowledge audit",
      "",
      "Use this fictional example to inspect the health of a small skill library.",
      "",
      "```text",
      "source → owner → review → distribution → recovery",
      "```",
      "",
      "A missing link is a useful maintenance signal, not invented usage evidence.",
    ].join("\n"),
  },
];

function exampleSkill(source: ExampleSource): AtlasSkill {
  const parsed = parseSkillMarkdown(source.markdown, source.slug);
  return {
    slug: parsed.slug,
    name: parsed.name,
    description: parsed.description,
    category: source.category,
    sourcePath: parsed.sourcePath,
    markdown: parsed.markdown,
    relations: parsed.explicitRelations,
    tone: source.tone,
  };
}

export const EXAMPLE_PACK: AtlasPack = {
  kind: "atlas-pack",
  id: "offline-example",
  repository: "Offline example",
  defaultBranch: "built-in",
  revision: "built-in-2026-08-27",
  access: "read",
  source: "example",
  snapshotLabel: "Built-in fictional demo · available offline",
  components: ["skills"],
  skills: EXAMPLE_SOURCES.map(exampleSkill),
};

export const BUNDLED_SKILLS = EXAMPLE_PACK.skills;
