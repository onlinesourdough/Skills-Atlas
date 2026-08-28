import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import type { ProposalRequest } from "../types.js";
import {
  createGitHubFetchTransport,
  MAX_PROVIDER_RESPONSE_BYTES,
  MAX_PROVIDER_TREE_ENTRIES,
  ProviderError,
  proposeGitHubChange,
  readGitHubPack,
  type GitHubRequest,
  type GitHubResponse,
  type GitHubTransport,
} from "./github.js";

const COMMIT_SHA = "a".repeat(40);
const TREE_SHA = "b".repeat(40);
const FILE_SHA = "c".repeat(40);
const MANIFEST_SHA = "d".repeat(40);
const SKILL = `---
name: public-skill
description: A public fixture skill used to prove tokenless provider reads.
category: Operations
---

# Public skill

Read the complete safe Markdown source.
`;

function response(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): GitHubResponse {
  return { status, body, headers };
}

class QueueTransport implements GitHubTransport {
  readonly requests: GitHubRequest[] = [];
  constructor(private readonly responses: GitHubResponse[]) {}

  async request(input: GitHubRequest): Promise<GitHubResponse> {
    this.requests.push(input);
    const next = this.responses.shift();
    if (!next) throw new Error(`No fixture response for ${input.method} ${input.path}`);
    return next;
  }
}

function readResponses(
  options: { push?: boolean; tree?: unknown; blob?: string; manifest?: string } = {},
): GitHubResponse[] {
  const tree =
    options.tree ??
    ({
      truncated: false,
      tree: [
        ...(options.manifest
          ? [
              {
                path: ".codex-plugin/plugin.json",
                type: "blob",
                sha: MANIFEST_SHA,
                size: options.manifest.length,
              },
            ]
          : []),
        { path: "skills/public-skill/SKILL.md", type: "blob", sha: FILE_SHA, size: SKILL.length },
      ],
    } as const);
  return [
    response(200, {
      full_name: "public/team-skills",
      html_url: "https://github.com/public/team-skills",
      default_branch: "main",
      ...(options.push === undefined ? {} : { permissions: { pull: true, push: options.push } }),
    }),
    response(200, {
      commit: { sha: COMMIT_SHA, commit: { tree: { sha: TREE_SHA } } },
    }),
    response(200, tree),
    ...(options.manifest
      ? [
          response(200, {
            encoding: "base64",
            content: Buffer.from(options.manifest, "utf8").toString("base64"),
          }),
        ]
      : []),
    response(200, {
      encoding: "base64",
      content: Buffer.from(options.blob ?? SKILL, "utf8").toString("base64"),
    }),
  ];
}

function proposal(overrides: Partial<ProposalRequest> = {}): ProposalRequest {
  return {
    repository: "private/team-skills",
    path: "skills/public-skill/SKILL.md",
    baseSha: COMMIT_SHA,
    content: SKILL,
    title: "Improve public skill",
    proposalId: "proof-12345678",
    ...overrides,
  };
}

describe("GitHub pack reads", () => {
  it("reads a public repository without credentials and preserves complete Markdown", async () => {
    const transport = new QueueTransport(readResponses());
    const pack = await readGitHubPack(transport, "public/team-skills");
    expect(pack).toMatchObject({
      repository: "public/team-skills",
      revision: COMMIT_SHA,
      access: "read",
      source: "github",
      components: ["skills"],
    });
    expect(pack.skills[0]).toMatchObject({
      slug: "public-skill",
      name: "Public skill",
      markdown: SKILL,
      relations: [],
    });
    expect(transport.requests.every((request) => request.method === "GET")).toBe(true);
  });

  it("reads only component paths declared by the repository plugin manifest", async () => {
    const manifest = JSON.stringify({
      name: "team-plugin",
      skills: "./skills",
      apps: ["./apps/review"],
    });
    const transport = new QueueTransport(readResponses({ manifest }));
    const pack = await readGitHubPack(transport, "public/team-skills");
    expect(pack.components).toEqual(["skills", "apps"]);
    expect(transport.requests.map((request) => request.path)).toContain(
      `/repos/public/team-skills/git/blobs/${MANIFEST_SHA}`,
    );
  });

  it("uses verified provider push permission for Can edit", async () => {
    const pack = await readGitHubPack(
      new QueueTransport(readResponses({ push: true })),
      "public/team-skills",
    );
    expect(pack.access).toBe("write");
  });

  it("maps anonymous 404 to one existence-safe unavailable code", async () => {
    await expect(
      readGitHubPack(new QueueTransport([response(404, { message: "Not Found" })]), "hidden/repo"),
    ).rejects.toEqual(new ProviderError("repository-unavailable"));
  });

  it("rejects misleading canonical repository identity from provider metadata", async () => {
    await expect(
      readGitHubPack(
        new QueueTransport([
          response(200, {
            full_name: "public/team-skills",
            html_url: "https://attacker.example/public/team-skills",
            default_branch: "main",
          }),
        ]),
        "public/team-skills",
      ),
    ).rejects.toEqual(new ProviderError("provider-payload-invalid"));
  });

  it("surfaces provider rate limiting", async () => {
    await expect(
      readGitHubPack(
        new QueueTransport([
          response(403, { message: "rate limit" }, { "x-ratelimit-remaining": "0" }),
        ]),
        "public/team-skills",
      ),
    ).rejects.toEqual(new ProviderError("rate-limited"));
  });

  it("rejects truncated, excessive, and invalid skill payloads", async () => {
    await expect(
      readGitHubPack(
        new QueueTransport(readResponses({ tree: { truncated: true, tree: [] } }).slice(0, 3)),
        "public/team-skills",
      ),
    ).rejects.toEqual(new ProviderError("tree-truncated"));

    const excessive = Array.from({ length: MAX_PROVIDER_TREE_ENTRIES + 1 }, (_, index) => ({
      path: `docs/${index}.md`,
      type: "blob",
      sha: FILE_SHA,
      size: 1,
    }));
    await expect(
      readGitHubPack(
        new QueueTransport(
          readResponses({ tree: { truncated: false, tree: excessive } }).slice(0, 3),
        ),
        "public/team-skills",
      ),
    ).rejects.toEqual(new ProviderError("too-many-files"));

    await expect(
      readGitHubPack(
        new QueueTransport(readResponses({ blob: "not a skill" })),
        "public/team-skills",
      ),
    ).rejects.toEqual(new ProviderError("invalid-skill"));
  });

  it("rejects excessive skill counts and declared oversized files before blob reads", async () => {
    const excessiveSkills = Array.from({ length: 101 }, (_, index) => ({
      path: `skills/public-skill-${index}/SKILL.md`,
      type: "blob",
      sha: FILE_SHA,
      size: SKILL.length,
    }));
    await expect(
      readGitHubPack(
        new QueueTransport(
          readResponses({ tree: { truncated: false, tree: excessiveSkills } }).slice(0, 3),
        ),
        "public/team-skills",
      ),
    ).rejects.toEqual(new ProviderError("too-many-skills"));

    const oversizedSkill = [
      {
        path: "skills/public-skill/SKILL.md",
        type: "blob",
        sha: FILE_SHA,
        size: 128 * 1024 + 1,
      },
    ];
    await expect(
      readGitHubPack(
        new QueueTransport(
          readResponses({ tree: { truncated: false, tree: oversizedSkill } }).slice(0, 3),
        ),
        "public/team-skills",
      ),
    ).rejects.toEqual(new ProviderError("skill-too-large"));
  });
});

describe("GitHub fetch transport", () => {
  it("retries a transient GET once but never retries a write", async () => {
    let readAttempts = 0;
    const read = createGitHubFetchTransport({
      fetcher: async () => {
        readAttempts += 1;
        return new Response(JSON.stringify({ ok: true }), {
          status: readAttempts === 1 ? 503 : 200,
          headers: { "content-type": "application/json" },
        });
      },
    });
    await expect(read.request({ method: "GET", path: "/bounded-read" })).resolves.toMatchObject({
      status: 200,
    });
    expect(readAttempts).toBe(2);

    let writeAttempts = 0;
    const write = createGitHubFetchTransport({
      fetcher: async () => {
        writeAttempts += 1;
        return new Response(JSON.stringify({ message: "unavailable" }), { status: 503 });
      },
    });
    await expect(
      write.request({ method: "POST", path: "/write", body: { bounded: true } }),
    ).resolves.toMatchObject({ status: 503 });
    expect(writeAttempts).toBe(1);
  });

  it("maps bounded aborts and excessive provider bodies to stable failures", async () => {
    const aborted = createGitHubFetchTransport({
      fetcher: async () => Promise.reject(new DOMException("aborted", "AbortError")),
    });
    await expect(aborted.request({ method: "GET", path: "/slow" })).rejects.toEqual(
      new ProviderError("provider-timeout"),
    );

    const oversized = createGitHubFetchTransport({
      fetcher: async () =>
        new Response("x".repeat(MAX_PROVIDER_RESPONSE_BYTES + 1), { status: 200 }),
    });
    await expect(oversized.request({ method: "GET", path: "/large" })).rejects.toEqual(
      new ProviderError("provider-payload-invalid"),
    );
  });
});

describe("GitHub pull-request proposals", () => {
  function proposalReadResponses(push = true): GitHubResponse[] {
    return [
      response(200, {
        full_name: "private/team-skills",
        html_url: "https://github.com/private/team-skills",
        default_branch: "main",
        permissions: { pull: true, push },
      }),
      response(200, { commit: { sha: COMMIT_SHA, commit: { tree: { sha: TREE_SHA } } } }),
    ];
  }

  it("creates a branch from observed SHA, updates one skill there, then opens a PR", async () => {
    const transport = new QueueTransport([
      ...proposalReadResponses(),
      response(200, { sha: FILE_SHA }),
      response(201, { ref: "created" }),
      response(200, { content: { sha: "d".repeat(40) } }),
      response(201, { html_url: "https://github.com/private/team-skills/pull/17", number: 17 }),
    ]);
    const result = await proposeGitHubChange(transport, proposal());
    expect(result).toEqual({
      kind: "proposal",
      branch: "atlas/public-skill-proof-12345678",
      pullRequestUrl: "https://github.com/private/team-skills/pull/17",
      pullRequestNumber: 17,
    });
    expect(transport.requests.map((request) => `${request.method} ${request.path}`)).toEqual([
      "GET /repos/private/team-skills",
      "GET /repos/private/team-skills/branches/main",
      `GET /repos/private/team-skills/contents/skills/public-skill/SKILL.md?ref=${COMMIT_SHA}`,
      "POST /repos/private/team-skills/git/refs",
      "PUT /repos/private/team-skills/contents/skills/public-skill/SKILL.md",
      "POST /repos/private/team-skills/pulls",
    ]);
    expect(transport.requests[3]?.body).toEqual({
      ref: "refs/heads/atlas/public-skill-proof-12345678",
      sha: COMMIT_SHA,
    });
    expect(transport.requests[4]?.body).toEqual(
      expect.objectContaining({ branch: "atlas/public-skill-proof-12345678", sha: FILE_SHA }),
    );
    expect(JSON.stringify(transport.requests[4]?.body)).not.toContain('"branch":"main"');
  });

  it("denies missing write permission before any provider mutation", async () => {
    const transport = new QueueTransport(proposalReadResponses(false).slice(0, 1));
    await expect(proposeGitHubChange(transport, proposal())).rejects.toEqual(
      new ProviderError("permission-denied"),
    );
    expect(transport.requests).toHaveLength(1);
  });

  it("denies stale source before any provider mutation", async () => {
    const transport = new QueueTransport([...proposalReadResponses()]);
    await expect(
      proposeGitHubChange(transport, proposal({ baseSha: "d".repeat(40) })),
    ).rejects.toEqual(new ProviderError("stale-source"));
    expect(transport.requests.every((request) => request.method === "GET")).toBe(true);
  });

  it("reports a duplicate proposal branch and stops before content or PR writes", async () => {
    const transport = new QueueTransport([
      ...proposalReadResponses(),
      response(200, { sha: FILE_SHA }),
      response(422, { message: "Reference already exists" }),
    ]);
    await expect(proposeGitHubChange(transport, proposal())).rejects.toEqual(
      new ProviderError("duplicate-branch"),
    );
    expect(transport.requests.at(-1)?.path).toBe("/repos/private/team-skills/git/refs");
  });
});
