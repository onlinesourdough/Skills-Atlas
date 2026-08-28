import { describe, expect, it } from "vitest";
import { EXAMPLE_PACK } from "../data/bundled-skills.js";
import { ProviderError } from "./github.js";
import {
  DEFAULT_PLUGIN_REPOSITORY,
  parsePluginManifestComponents,
  pluginComponentLabels,
  PluginManifestError,
  resolveDefaultPlugin,
  upsertPlugin,
} from "./plugin.js";

describe("plugin declarations", () => {
  it("reports only component paths declared by a valid plugin manifest", () => {
    expect(
      parsePluginManifestComponents(
        JSON.stringify({
          name: "team-plugin",
          skills: "./skills/",
          apps: ["./apps/review"],
          mcpServers: "./mcp.json",
          tools: ["not-a-supported-declaration"],
        }),
      ),
    ).toEqual(["skills", "apps", "mcpServers"]);
  });

  it("does not invent absent components and rejects unsafe declarations", () => {
    expect(parsePluginManifestComponents(JSON.stringify({ skills: "./skills" }))).toEqual([
      "skills",
    ]);
    expect(() => parsePluginManifestComponents(JSON.stringify({ apps: "../private-app" }))).toThrow(
      PluginManifestError,
    );
  });

  it("labels the public-safe fallback as an unattributed offline example", () => {
    expect(EXAMPLE_PACK).toMatchObject({
      repository: "Offline example",
      source: "example",
      snapshotLabel: "Built-in fictional demo · available offline",
      components: ["skills"],
    });
    expect(EXAMPLE_PACK.repositoryUrl).toBeUndefined();
    expect(pluginComponentLabels(EXAMPLE_PACK)).toEqual(["Skills"]);
  });

  it("resolves the canonical startup repository as read-only provider truth", async () => {
    const live = {
      ...EXAMPLE_PACK,
      id: "onlinesourdough/skills",
      repository: "onlinesourdough/Skills",
      repositoryUrl: "https://github.com/onlinesourdough/Skills",
      revision: "1".repeat(40),
      access: "write" as const,
      source: "github" as const,
      skills: EXAMPLE_PACK.skills.slice(0, 5),
    };
    const requested: string[] = [];
    const result = await resolveDefaultPlugin(async (repository) => {
      requested.push(repository);
      return live;
    });

    expect(requested).toEqual([DEFAULT_PLUGIN_REPOSITORY]);
    expect(result).toEqual({
      status: "ready",
      plugin: expect.objectContaining({
        repository: "onlinesourdough/Skills",
        revision: "1".repeat(40),
        access: "read",
        source: "github",
      }),
    });
    expect(result.status === "ready" ? result.plugin.skills : []).toHaveLength(5);
  });

  it.each(["repository-unavailable", "rate-limited"] as const)(
    "returns the offline fallback contract for %s startup",
    async (code) => {
      await expect(
        resolveDefaultPlugin(async () => {
          throw new ProviderError(code);
        }),
      ).resolves.toEqual({ status: "fallback", code });
    },
  );

  it("upserts a retried canonical plugin without creating a duplicate", () => {
    const first = {
      ...EXAMPLE_PACK,
      id: "onlinesourdough/skills",
      repository: "onlinesourdough/Skills",
      source: "github" as const,
    };
    const refreshed = { ...first, revision: "2".repeat(40) };

    expect(upsertPlugin(upsertPlugin([EXAMPLE_PACK], first), refreshed)).toEqual([
      EXAMPLE_PACK,
      refreshed,
    ]);
  });
});
