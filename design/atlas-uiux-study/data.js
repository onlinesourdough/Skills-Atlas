/* Original, fictional design data. No imported private skill bodies or live usage. */
const AtlasData = (() => {
  const sources = [
    {
      id: "global",
      name: "Global Skills",
      repo: "demo/global-skills",
      color: "#377c6b",
      center: [250, 210],
      access: "read",
      kind: "Shared library",
      items: [
        [
          "clarify",
          "Clarify",
          "Turn a complex idea into a clear, visual explanation.",
        ],
        [
          "shape-offer",
          "Shape offer",
          "Make the outcome, audience, and next test of an offer specific.",
        ],
        [
          "research-brief",
          "Research brief",
          "Define the question and the evidence needed before researching.",
        ],
        [
          "meeting-brief",
          "Meeting brief",
          "Prepare the context and decision for a useful meeting.",
        ],
        [
          "customer-handoff",
          "Customer handoff",
          "Give the next owner the context needed to continue.",
        ],
        [
          "knowledge-audit",
          "Knowledge audit",
          "Find gaps and conflicting guidance in a knowledge base.",
        ],
        [
          "launch-checklist",
          "Launch checklist",
          "Check the result, owner, proof, and recovery path before release.",
        ],
        [
          "proposal-review",
          "Proposal review",
          "Review a proposal for evidence, scope, and the customer decision.",
        ],
        [
          "incident-update",
          "Incident update",
          "Explain what changed, what is known, and what happens next.",
        ],
      ],
    },
    {
      id: "aios",
      name: "AIOS Plugin",
      repo: "demo/aios-plugin",
      color: "#7763a7",
      center: [665, 185],
      access: "read",
      kind: "Plugin",
      items: [
        [
          "aios",
          "AIOS",
          "Find the relevant context and the smallest useful next action.",
        ],
        [
          "spec-work",
          "Spec work",
          "Agree on the result, boundaries, and proof before building.",
        ],
        [
          "build-work",
          "Build work",
          "Build an accepted result and verify the important paths.",
        ],
        [
          "review-work",
          "Review work",
          "Check a completed result against its accepted outcome.",
        ],
        [
          "ship-work",
          "Ship work",
          "Deliver reviewed work to an authorised destination.",
        ],
        [
          "design",
          "Design",
          "Create a visual direction that serves a specific job.",
        ],
        [
          "review-design",
          "Review design",
          "Inspect the actual visual, interaction, and accessibility.",
        ],
        [
          "write-code",
          "Write code",
          "Keep implementation small, readable, and verifiable.",
        ],
        [
          "human-writing",
          "Human writing",
          "Write clearly for the intended reader.",
        ],
        [
          "maintain-context",
          "Maintain context",
          "Keep the owner’s facts and routes useful and current.",
        ],
        [
          "risky-changes",
          "Risky changes",
          "Test important assumptions and retain a recovery path.",
        ],
      ],
    },
    {
      id: "project",
      name: "Project Template",
      repo: "demo/project-template",
      color: "#3f78a6",
      center: [1030, 335],
      access: "read",
      kind: "Repository-local skills",
      items: [
        [
          "choose-technology",
          "Choose technology",
          "Select the smallest reliable stack for the accepted job.",
        ],
        [
          "project-setup",
          "Project setup",
          "Establish a clean project boundary and useful starting point.",
        ],
        [
          "verify-build",
          "Verify build",
          "Reproduce the relevant checks before a change is accepted.",
        ],
        [
          "release-check",
          "Release check",
          "Check the final revision and its delivery conditions.",
        ],
        [
          "document-change",
          "Document change",
          "Update the instructions whose truth changed.",
        ],
        [
          "recover-project",
          "Recover project",
          "Restore a known working state without losing unrelated work.",
        ],
        [
          "review-code",
          "Review code",
          "Inspect the changed code and its real behaviour.",
        ],
      ],
    },
    {
      id: "system",
      name: "System Template",
      repo: "demo/system-template",
      color: "#b47834",
      center: [810, 580],
      access: "read",
      kind: "Repository-local skills",
      items: [
        [
          "system-contract",
          "System contract",
          "Define one capability and its responsibility.",
        ],
        [
          "choose-technology",
          "Choose technology",
          "Choose an implementation that can be operated independently.",
        ],
        [
          "input-validation",
          "Input validation",
          "Validate inputs before the specialist acts on them.",
        ],
        [
          "system-proof",
          "System proof",
          "Demonstrate the complete supported workflow.",
        ],
        [
          "system-recovery",
          "System recovery",
          "Keep recovery instructions close to the implementation.",
        ],
        [
          "delivery-check",
          "Delivery check",
          "Verify the exact output and its receiving boundary.",
        ],
      ],
    },
    {
      id: "personal",
      name: "My Skills",
      repo: "demo/my-skills",
      color: "#af5e6d",
      center: [400, 600],
      access: "propose",
      kind: "Private · example",
      items: [
        [
          "weekly-review",
          "Weekly review",
          "Look back at what moved and choose next week’s focus.",
        ],
        [
          "daily-plan",
          "Daily plan",
          "Choose the work that matters before the calendar fills up.",
        ],
        [
          "writing-pass",
          "Writing pass",
          "Make a draft clear, particular, and natural.",
        ],
        [
          "research-notes",
          "Research notes",
          "Keep conclusions connected to their sources.",
        ],
        [
          "meeting-brief",
          "Meeting brief",
          "A personal agenda for a meeting that needs a decision.",
        ],
        [
          "idea-capture",
          "Idea capture",
          "Keep enough context for an idea to make sense later.",
        ],
      ],
    },
    {
      id: "team",
      name: "Team Skills",
      repo: "demo/team-skills",
      color: "#7c854a",
      center: [100, 440],
      access: "propose",
      kind: "Team library · example",
      items: [
        [
          "onboard-teammate",
          "Onboard teammate",
          "Help a teammate find their context, tools, and first result.",
        ],
        [
          "project-kickoff",
          "Project kickoff",
          "Align on the problem, scope, and first proof.",
        ],
        [
          "decision-log",
          "Decision log",
          "Record what was decided and why it matters.",
        ],
        [
          "status-update",
          "Status update",
          "Explain progress, uncertainty, and the next useful action.",
        ],
        [
          "quality-check",
          "Quality check",
          "Check the output at the boundary where someone will use it.",
        ],
      ],
    },
  ];
  const special = {
    "global:clarify":
      "# Clarify\n\nMake the idea easy to understand, then give the reader one useful next step.\n\n> This is original sample content for the Atlas design study, not a live skill.\n\n## When to use\n\nA decision, workflow, or technical topic needs a shared understanding. Start with a named reader and the question they need answered.\n\n## The workflow\n\n1. State the reader’s question in one sentence.\n2. Separate what is known from what still needs evidence.\n3. Choose a small visual only when it makes the relationship clearer.\n4. Write the explanation in plain language.\n5. Check it at the size and in the context where it will be used.\n\n## A useful result\n\nThe reader can explain the idea back and knows what to do next.\n\n## References\n\nSee references/example-brief.md for a small example.\n\n## Done when\n\nThe original question is answered, sources are visible, and no extra explanation is needed to use the result.",
    "personal:weekly-review":
      "# Weekly review\n\nClose the week with a clear view of what moved and what deserves attention next.\n\n> Fictional skill used to demonstrate the proposed editor.\n\n## Before you start\n\nBring your current commitments, calendar, and the notes you already keep. Do not create a second tracking system.\n\n## Review\n\n1. Name the result that moved forward.\n2. Notice what stayed blocked and why.\n3. Drop a commitment that no longer earns its place.\n4. Choose one result for next week.\n\n## Output\n\nA short note with what changed, what remains open, and the next useful action.\n\n## Done when\n\nNext week’s focus is clear enough to start without another planning session.",
  };
  const skills = sources.flatMap((source) =>
    source.items.map(([slug, name, description], index) => {
      const id = `${source.id}:${slug}`;
      const body =
        special[id] ||
        `# ${name}\n\n${description}\n\n> Original example content for this design study. This is not a file fetched from GitHub.\n\n## When to use\n\nUse this when the work needs a shared understanding of the result, its boundaries, and the next action.\n\n## The workflow\n\n1. Read the minimum relevant context.\n2. State the intended result and what is outside its scope.\n3. Complete the smallest useful piece of work.\n4. Check the result through the interface someone will actually use.\n\n## Keep the source clear\n\nFacts stay with their owner. Link to evidence and distinguish an observation from an assumption.\n\n## Done when\n\nThe next person can understand the result and continue without rebuilding the context.`;
      const frontmatter = `---\nname: ${slug}\ndescription: ${description}\nversion: 1.0.0\n---\n\n`;
      const a = index * 2.3999632297;
      const radius = index === 0 ? 0 : 32 + Math.sqrt(index) * 17;
      return {
        id,
        slug,
        name,
        description,
        source: source.id,
        category: ["Planning", "Building", "Review", "Communication"][
          index % 4
        ],
        path: `${["project", "system"].includes(source.id) ? ".agents/skills" : "skills"}/${slug}/SKILL.md`,
        x: source.center[0] + Math.cos(a) * radius,
        y: source.center[1] + Math.sin(a) * radius,
        markdown: frontmatter + body,
        body,
        files: {
          "SKILL.md": frontmatter + body,
          "references/example-brief.md": `# Example brief\n\n## Job\n\n${description}\n\n## Reader\n\nA teammate who needs to continue the work.\n\n## Evidence\n\nA concrete result, a source, and an explicit limitation.\n\nThis supporting file is fictional.`,
          ...(index === 0
            ? {
                "references/checklist.md":
                  "# Review checklist\n\n- The result answers the original question.\n- Sources and limitations are visible.\n- The next action has an owner.\n- The output works at the intended size.\n\nFictional reference file.",
              }
            : {}),
        },
      };
    }),
  );
  const links = [
    ["global:clarify", "aios:design"],
    ["global:clarify", "aios:human-writing"],
    ["global:clarify", "global:research-brief"],
    ["global:shape-offer", "global:proposal-review"],
    ["global:customer-handoff", "global:meeting-brief"],
    ["global:customer-handoff", "global:knowledge-audit"],
    ["global:launch-checklist", "global:incident-update"],
    ["global:launch-checklist", "global:knowledge-audit"],
    ["global:proposal-review", "global:customer-handoff"],
    ["aios:aios", "aios:spec-work"],
    ["aios:aios", "aios:build-work"],
    ["aios:aios", "aios:review-work"],
    ["aios:build-work", "aios:write-code"],
    ["aios:build-work", "aios:review-work"],
    ["aios:review-work", "aios:risky-changes"],
    ["aios:ship-work", "aios:review-work"],
    ["aios:design", "aios:review-design"],
    ["aios:design", "aios:human-writing"],
    ["aios:maintain-context", "aios:human-writing"],
    ["project:project-setup", "project:choose-technology"],
    ["project:verify-build", "project:review-code"],
    ["project:release-check", "project:verify-build"],
    ["project:release-check", "project:recover-project"],
    ["project:review-code", "aios:write-code"],
    ["project:document-change", "aios:human-writing"],
    ["project:choose-technology", "aios:spec-work"],
    ["system:system-contract", "system:choose-technology"],
    ["system:system-proof", "system:input-validation"],
    ["system:delivery-check", "system:system-proof"],
    ["system:delivery-check", "system:system-recovery"],
    ["system:system-proof", "aios:review-work"],
    ["personal:weekly-review", "personal:daily-plan"],
    ["personal:weekly-review", "personal:research-notes"],
    ["personal:writing-pass", "aios:human-writing"],
    ["personal:meeting-brief", "global:meeting-brief"],
    ["personal:idea-capture", "personal:research-notes"],
    ["team:onboard-teammate", "team:project-kickoff"],
    ["team:project-kickoff", "team:decision-log"],
    ["team:quality-check", "aios:review-work"],
    ["team:status-update", "global:customer-handoff"],
  ].map(([from, to], i) => ({
    from,
    to,
    line: 18 + (i % 19),
    kind: "File reference",
    example: true,
  }));
  const overlaps = [
    {
      ids: ["project:choose-technology", "system:choose-technology"],
      reason: "Same name, different source",
      strength: "Name match",
    },
    {
      ids: ["global:meeting-brief", "personal:meeting-brief"],
      reason: "Similar name and purpose",
      strength: "Possible overlap",
    },
  ];
  return { sources, skills, links, overlaps };
})();
