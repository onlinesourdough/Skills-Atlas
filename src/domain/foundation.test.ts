import { describe, expect, it } from "vitest";
import {
  readGitHubPack,
  proposeGitHubChange,
  ProviderError,
  type GitHubTransport,
} from "./github.js";
import { parsePackPayload, parseProposalRequest } from "./contracts.js";
import { findSkill, filterSkills, relationEdges } from "./atlas.js";
import { upsertPlugin, resolveDefaultPlugin } from "./plugin.js";
import { relativeRepositoryPath } from "./relations.js";

// Synthetic provider responses: these names, IDs, revisions and bodies are not live sources.
const revision = "a".repeat(40);
const source = (slug: string, body = "Complete source.\n", metadata = "") =>
  `---\nname: ${slug}\ndescription: Synthetic foundation regression.\n${metadata}---\n\n# ${slug}\n\n${body}`;

function fixture(
  files: Record<string, string>,
  options: { id?: unknown; name?: string; duplicate?: boolean; symlink?: string } = {},
) {
  const requests: string[] = [];
  const name = options.name ?? "synthetic/library";
  const entries = Object.keys(files).map((path, i) => ({
    path,
    type: "blob",
    mode: path === options.symlink ? "120000" : "100644",
    sha: `${i}`.padStart(40, "0"),
    size: files[path]!.length,
  }));
  const transport: GitHubTransport = {
    async request(request) {
      requests.push(`${request.method} ${request.path}`);
      if (request.method !== "GET") throw new Error("Unexpected fixture write");
      const response = (body: unknown) => ({ status: 200, headers: {}, body });
      if (request.path === `/repos/${name}`)
        return response({
          id: options.id === undefined ? 42 : options.id,
          full_name: name,
          html_url: `https://github.com/${name}`,
          default_branch: "main",
        });
      if (request.path.includes("/branches/"))
        return response({ commit: { sha: revision, commit: { tree: { sha: "b".repeat(40) } } } });
      if (request.path.includes("/git/trees/"))
        return response({
          truncated: false,
          tree: options.duplicate ? [...entries, entries[0]] : entries,
        });
      const entry = entries.find((item) => request.path.endsWith(`/git/blobs/${item.sha}`));
      if (!entry) throw new Error("Unexpected fixture path");
      return response({
        encoding: "base64",
        content: Buffer.from(files[entry.path]!).toString("base64"),
      });
    },
  };
  return { requests, read: () => readGitHubPack(transport, name) };
}

describe("source foundation (synthetic)", () => {
  it("finds both root shelves without scanning backups, nested repositories, links, or other Markdown", async () => {
    const f = fixture(
      {
        "skills/shared/SKILL.md": source("shared"),
        ".agents/skills/shared/SKILL.md": source("shared"),
        "backup/skills/old/SKILL.md": "must not read",
        "nested/.agents/skills/old/SKILL.md": "must not read",
        "skills/shared/notes.md": "must not read",
        "skills/link/SKILL.md": source("link"),
        "skills/../escape/SKILL.md": "must not read",
      },
      { symlink: "skills/link/SKILL.md" },
    );
    const pack = await f.read();
    expect(pack.id).toBe("github:42");
    expect(pack.skills.map((skill) => skill.sourcePath).sort()).toEqual([
      ".agents/skills/shared/SKILL.md",
      "skills/shared/SKILL.md",
    ]);
    expect(new Set(pack.skills.map((skill) => skill.id)).size).toBe(2);
    expect(f.requests.filter((request) => request.includes("/git/blobs/"))).toHaveLength(2);
    expect(parsePackPayload(pack)).toEqual(pack);
  });

  it("preserves numeric identity across repository rename and revision refresh; same slug in another repo stays distinct", async () => {
    const files = { "skills/shared/SKILL.md": source("shared") };
    const before = await fixture(files).read();
    const renamed = await fixture(files, { name: "new-owner/renamed" }).read();
    const other = await fixture(files, { id: 43 }).read();
    expect(renamed.skills[0]!.id).toBe(before.skills[0]!.id);
    const refreshed = { ...renamed, revision: "c".repeat(40) };
    expect(upsertPlugin([before, other], refreshed)).toEqual([other, refreshed]);
    expect(other.skills[0]!.id).not.toBe(before.skills[0]!.id);
    const all = [...before.skills, ...other.skills];
    expect(findSkill(all, other.skills[0]!.id)).toBe(other.skills[0]);
    expect(findSkill(all, "shared")).toBeUndefined();
    expect(filterSkills(all, "Complete source", "All skills")).toHaveLength(2);
  });

  it("keeps complete long Markdown and only resolves directed source evidence", async () => {
    const body = [
      "Do not call `target`. A name mention is not a call.",
      "[Target](../target/SKILL.md#details)",
      "[Local](../../.agents/skills/target/SKILL.md)",
      "[Missing](../missing/SKILL.md)",
      "[External](https://github.com/hidden/repo/blob/main/skills/target/SKILL.md)",
      "[Defined][target-ref]",
      "\n[target-ref]: ../target/SKILL.md\n",
      "```md\n[Not evidence](../target/SKILL.md)\n```",
      "`[Not evidence](../target/SKILL.md)`",
      "<!-- [Not evidence](../target/SKILL.md) -->",
      "| Field | Value |\n| --- | --- |\n| Long | " + "x".repeat(1000) + " |",
      "\nParagraph.\n".repeat(800),
      "FOUNDATION LAST LINE",
    ].join("\n");
    const markdown = source("start", body, "relations: [target, missing]\n");
    const pack = await fixture({
      "skills/start/SKILL.md": markdown,
      "skills/target/SKILL.md": source("target"),
      ".agents/skills/target/SKILL.md": source("target"),
    }).read();
    const start = pack.skills.find((skill) => skill.slug === "start")!;
    expect(start.markdown).toBe(markdown);
    expect(start.markdown.endsWith("FOUNDATION LAST LINE")).toBe(true);
    expect(start.evidence?.filter((item) => item.kind === "reference")).toHaveLength(5);
    expect(
      start.evidence?.find((item) => item.kind === "declared-relation" && item.target === "target")
        ?.status,
    ).toBe("ambiguous");
    expect(start.evidence?.find((item) => item.target === "missing")?.status).toBe("unresolved");
    const targetId = "github:42:skills/target/SKILL.md";
    // The relative local-shelf path is valid from skills/start and resolves precisely.
    expect(start.relations).toEqual([targetId, "github:42:.agents/skills/target/SKILL.md"]);
    expect(relationEdges(pack.skills)).toEqual([
      { sourceId: start.id, targetId: "github:42:.agents/skills/target/SKILL.md" },
      { sourceId: start.id, targetId: targetId },
    ]);
    for (const evidence of start.evidence!.filter((item) => item.kind === "reference")) {
      expect(markdown.split("\n")[evidence.line - 1]).toContain("[");
    }
    expect(relationEdges(pack.skills.filter((skill) => skill.id !== targetId))).toHaveLength(1);
    expect(parsePackPayload(pack)).toEqual(pack);
  });

  it("denies duplicate paths, malformed numeric identity, empty unsupported layouts and forged payload identity", async () => {
    const files = { "skills/shared/SKILL.md": source("shared") };
    await expect(fixture(files, { duplicate: true }).read()).rejects.toEqual(
      new ProviderError("provider-payload-invalid"),
    );
    for (const id of [0, -1, "42", null, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      await expect(fixture(files, { id }).read()).rejects.toEqual(
        new ProviderError("provider-payload-invalid"),
      );
    }
    await expect(
      fixture({ "nested/skills/shared/SKILL.md": source("shared") }).read(),
    ).rejects.toEqual(new ProviderError("empty-repository"));
    const pack = await fixture(files).read();
    expect(parsePackPayload({ ...pack, repositoryId: 43 })).toBeNull();
    expect(parsePackPayload({ ...pack, skills: [pack.skills[0], pack.skills[0]] })).toBeNull();
    expect(
      parsePackPayload({
        ...pack,
        skills: [{ ...pack.skills[0], sourcePath: "skills/shared/skill.md" }],
      }),
    ).toBeNull();
  });

  it("keeps repository-local proposal writes denied before any provider request", async () => {
    const request = {
      repository: "synthetic/library",
      path: ".agents/skills/shared/SKILL.md",
      baseSha: revision,
      content: source("shared"),
      title: "Synthetic proposal",
      proposalId: "fixture-12345678",
    };
    expect(parseProposalRequest(request)).toBeNull();
    await expect(
      proposeGitHubChange(
        {
          request: async () => {
            throw new Error("Provider must not be called");
          },
        },
        request,
      ),
    ).rejects.toEqual(new ProviderError("invalid-skill"));
  });

  it("bounds relation evidence without silently dropping references", async () => {
    await expect(
      fixture({
        "skills/shared/SKILL.md": source("shared", "[target](../target/SKILL.md)\n\n".repeat(513)),
      }).read(),
    ).rejects.toEqual(new ProviderError("invalid-skill"));
  });

  it("resolves the corrected default, while stale canonical names and unknown links do not trigger alternate reads", async () => {
    const pack = await fixture(
      { "skills/shared/SKILL.md": source("shared") },
      { name: "onlinesourdough/Global-Skills" },
    ).read();
    const requested: string[] = [];
    expect(
      (
        await resolveDefaultPlugin(async (name) => {
          requested.push(name);
          return pack;
        })
      ).status,
    ).toBe("ready");
    expect(requested).toEqual(["onlinesourdough/Global-Skills"]);
    expect(
      (await resolveDefaultPlugin(async () => ({ ...pack, repository: "onlinesourdough/Skills" })))
        .status,
    ).toBe("fallback");
    expect(relativeRepositoryPath("skills/shared/SKILL.md", "../../../secret")).toBeNull();
    expect(relativeRepositoryPath("skills/shared/SKILL.md", "https://other/repo")).toBeNull();
    expect(relativeRepositoryPath("skills/shared/SKILL.md", "%2Fsecret")).toBeNull();
    expect(relativeRepositoryPath("skills/shared/SKILL.md", "../Target/SKILL.md")).toBe(
      "skills/Target/SKILL.md",
    );
  });
});
