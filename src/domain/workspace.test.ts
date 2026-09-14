import { describe, expect, it } from "vitest";
import { relationEdges } from "./atlas.js";
import { graphBounds, graphLayout, fitCamera } from "./graph.js";
import { sixRepositoryFixture } from "./workspace.fixture.js";
import { overlapGroups, repositoryColors, repositoryKey, visibleWorkspace } from "./workspace.js";

describe("visible multi-repository workspace", () => {
  it("resolves exact revision/file links without slug inference or mutation, preserving file/line evidence", () => {
    const packs = sixRepositoryFixture();
    const before = JSON.stringify(packs);
    const skills = visibleWorkspace(packs);
    const source = skills.find((skill) => skill.id === packs[0]!.skills[0]!.id)!;
    expect(new Set(skills.map((skill) => skill.category))).toEqual(new Set(["Uncategorized"]));
    expect(source.relations).toEqual([
      packs[1]!.skills[0]!.id,
      packs[0]!.skills[1]!.id,
      packs[5]!.skills[0]!.id,
    ]);
    expect(source.evidence!.filter((item) => item.status === "resolved")).toHaveLength(4);
    expect(source.evidence!.filter((item) => item.status !== "resolved")).toHaveLength(4);
    for (const item of source.evidence!) {
      expect(source.markdown.split("\n")[item.line - 1]).toContain(item.target);
      if (item.status !== "resolved") expect(item.explanation).toBeTruthy();
    }
    expect(skills.find((skill) => skill.id === packs[4]!.skills[0]!.id)!.evidence![0]!.status).toBe(
      "ambiguous",
    );
    expect(relationEdges(skills).filter((edge) => edge.sourceId === source.id)).toHaveLength(3);
    expect(JSON.stringify(packs)).toBe(before);
  });

  it("rejects multiple exact candidates, URL variants, and stale cross-source target IDs", () => {
    const packs = sixRepositoryFixture();
    const alias = {
      ...packs[1]!,
      id: "github:9999",
      repositoryId: 9999,
      skills: packs[1]!.skills.map((skill) => ({ ...skill, id: skill.id.replace("9101", "9999") })),
    };
    const duplicate = visibleWorkspace([...packs, alias]).find(
      (skill) => skill.id === packs[0]!.skills[0]!.id,
    )!;
    expect(
      duplicate.evidence!.find((item) => item.target.includes("/reviewing/blob/222"))!.status,
    ).toBe("ambiguous");
    expect(duplicate.relations).not.toContain(packs[1]!.skills[0]!.id);
    const source = packs[0]!.skills[0]!;
    const exact = source.evidence!.find((item) => item.target.includes("/reviewing/blob/222"))!;
    for (const target of [
      exact.target + "?raw=1",
      exact.target.replace("github.com/", "github.com.evil/"),
      exact.target.replace("https://", "https://user@"),
      exact.target.replace("/skills/", "/other/../skills/"),
    ]) {
      const altered = {
        ...source,
        evidence: [
          { ...exact, target, status: "resolved" as const, targetId: packs[1]!.skills[0]!.id },
        ],
      };
      const result = visibleWorkspace([{ ...packs[0]!, skills: [altered] }, packs[1]!])[0]!;
      expect(result.evidence![0]!.status).toBe("unresolved");
      expect(result.relations).toEqual([]);
    }
  });

  it("recomputes after hide/denial/account replacement and recovers only after reloading", () => {
    const packs = sixRepositoryFixture();
    const hidden = packs[5]!;
    hidden.skills[0]!.name = "WITHHELD SYNTHETIC TITLE";
    hidden.skills[0]!.markdown += "WITHHELD SYNTHETIC BODY";
    const before = visibleWorkspace(packs);
    const after = visibleWorkspace(packs.slice(0, 5));
    const source = after.find((skill) => skill.id === packs[0]!.skills[0]!.id)!;
    expect(source.evidence!.find((item) => item.target.includes("/knowledge/"))!.status).toBe(
      "unresolved",
    );
    expect(source.relations).not.toContain(hidden.skills[0]!.id);
    const derived = JSON.stringify({
      skills: after,
      overlaps: overlapGroups(after),
      layout: graphLayout(after, graphLayout(before)),
      edges: relationEdges(after),
    });
    expect(derived).not.toContain("WITHHELD SYNTHETIC");
    expect(derived).not.toContain(hidden.skills[0]!.id);
    expect(visibleWorkspace([])).toEqual([]);
    expect(graphLayout([], graphLayout(before))).toEqual([]);
    expect(overlapGroups(visibleWorkspace([hidden]))).toEqual([]);
    expect(visibleWorkspace(packs)).toEqual(before);
  });

  it("separates exact full content from weak name/description candidates and documented edges", () => {
    const packs = sixRepositoryFixture();
    const skills = visibleWorkspace(packs);
    const edges = relationEdges(skills);
    const groups = overlapGroups(skills);
    expect(groups.filter((group) => group.kind === "identical-content")).toEqual([
      {
        kind: "identical-content",
        evidenceKinds: ["identical-content"],
        skills: skills.filter((skill) =>
          [packs[2]!.skills[0]!.id, packs[3]!.skills[0]!.id].includes(skill.id),
        ),
      },
    ]);
    expect(groups.some((group) => group.kind === "same-name" && group.skills.length === 6)).toBe(
      true,
    );
    expect(
      groups.some(
        (group) => group.evidenceKinds.includes("same-description") && group.skills.length === 6,
      ),
    ).toBe(true);
    expect(relationEdges(skills)).toEqual(edges);
    packs[3]!.skills[0]!.markdown += "\n";
    expect(
      overlapGroups(visibleWorkspace(packs)).filter((group) => group.kind === "identical-content"),
    ).toEqual([]);
  });

  it("assigns six separated swatches with screen-text contrast and stable session identity", () => {
    const packs = sixRepositoryFixture();
    const keys = packs.map(repositoryKey);
    const colors = repositoryColors(keys);
    expect(new Set(colors.values()).size).toBe(6);
    expect(repositoryColors([...keys].reverse())).toEqual(colors);
    expect(repositoryColors(["github:1", ...keys], colors).get(keys[0]!)).toBe(
      colors.get(keys[0]!),
    );
    expect(repositoryColors(keys.slice(0, 5), colors).has(keys[5]!)).toBe(false);
    for (const hex of colors.values()) {
      const rgb = [1, 3, 5]
        .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      const luminance = rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722;
      // Conservative darker-than-paper reference (#eeeeee).
      expect((0.855 + 0.05) / (luminance + 0.05)).toBeGreaterThan(4.5);
    }
  });

  it.each([0, 2, 50, 500])(
    "bounds %i skills in repository clusters; shared categories never coalesce owners",
    (count) => {
      const packs = sixRepositoryFixture(count);
      const skills = visibleWorkspace(packs);
      const layout = graphLayout(skills);
      expect(layout).toHaveLength(Math.min(count, 6));
      expect(layout.flatMap((cluster) => cluster.nodes)).toHaveLength(count);
      expect(graphLayout([...skills].reverse())).toEqual(layout);
      const bounds = graphBounds(layout);
      const camera = fitCamera(bounds, 1216, 600);
      expect(camera.zoom).toBeGreaterThan(0);
      for (const cluster of layout) {
        expect(new Set(cluster.nodes.map((node) => node.skill.sourceKey)).size).toBe(1);
        for (const other of layout.filter((other) => other !== cluster))
          expect(Math.hypot(cluster.x - other.x, cluster.y - other.y)).toBeGreaterThan(
            cluster.radius + other.radius,
          );
      }
    },
  );

  it("keeps sequential imports compact and existing nodes stable", () => {
    const packs = sixRepositoryFixture();
    let layout = graphLayout(visibleWorkspace(packs.slice(0, 1)));
    const first = layout[0]!.nodes.map((node) => [node.x, node.y]);
    for (let n = 2; n <= 6; n++) layout = graphLayout(visibleWorkspace(packs.slice(0, n)), layout);
    expect(layout[0]!.nodes.map((node) => [node.x, node.y])).toEqual(first);
    const bounds = graphBounds(layout)!;
    expect((bounds.right - bounds.left) / (bounds.bottom - bounds.top)).toBeLessThan(2.5);
  });

  it("separates envelopes when a loaded repository grows on refresh", () => {
    const before = graphLayout(visibleWorkspace(sixRepositoryFixture()));
    const expanded = sixRepositoryFixture(500);
    const packs = sixRepositoryFixture();
    packs[0] = expanded[0]!;
    const after = graphLayout(visibleWorkspace(packs), before);
    for (const cluster of after)
      for (const other of after.filter((other) => other !== cluster))
        expect(Math.hypot(cluster.x - other.x, cluster.y - other.y)).toBeGreaterThan(
          cluster.radius + other.radius,
        );
    expect(after.flatMap((cluster) => cluster.nodes)).toHaveLength(
      packs.reduce((sum, pack) => sum + pack.skills.length, 0),
    );
  });

  it("normalizes only weak text evidence, never complete-content comparison", () => {
    const packs = sixRepositoryFixture(2);
    packs[0]!.skills[0]!.name = "Shared CHECK";
    packs[1]!.skills[0]!.name = "  shared   check  ";
    packs[1]!.skills[0]!.description = "  REVIEW   shared instructions. ";
    const groups = overlapGroups(visibleWorkspace(packs));
    expect(groups).toHaveLength(1);
    expect(groups[0]!.evidenceKinds).toEqual(["same-name", "same-description"]);
  });

  it("combines only identical member sets and retains each exact versus weak rationale", () => {
    const packs = sixRepositoryFixture(2);
    packs[1]!.skills[0]!.markdown = packs[0]!.skills[0]!.markdown;
    const groups = overlapGroups(visibleWorkspace(packs));
    expect(groups).toHaveLength(1);
    expect(groups[0]!.kind).toBe("identical-content");
    expect(groups[0]!.evidenceKinds).toEqual([
      "identical-content",
      "same-name",
      "same-description",
    ]);
    expect(groups[0]!.skills).toHaveLength(2);
    expect(overlapGroups(visibleWorkspace(packs.slice(0, 1)))).toEqual([]);
    const broader = overlapGroups(visibleWorkspace(sixRepositoryFixture()));
    expect(broader.find((group) => group.kind === "identical-content")!.skills).toHaveLength(2);
    expect(broader.find((group) => group.kind === "same-name")!.skills).toHaveLength(6);
  });
});
