import { describe, expect, it } from "vitest";
import {
  fitCamera,
  graphBounds,
  graphLayout,
  nodeVisible,
  directNeighborhood,
  fitNeighborhood,
  neighborhoodLabels,
} from "./graph.js";
import { sixRepositoryFixture, unevenSixRepositoryFixture } from "./workspace.fixture.js";
import { visibleWorkspace } from "./workspace.js";
import { relationEdges } from "./atlas.js";
import type { AtlasSkill } from "../types.js";

function fixture(count: number): AtlasSkill[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `github:${900 + Math.floor(index / 100)}:skills/skill-${index}/SKILL.md`,
    slug: `skill-${index}`,
    name: `Synthetic skill ${index}`,
    description: "Synthetic layout fixture",
    category: `Category ${index % 5}`,
    sourcePath: `skills/skill-${index}/SKILL.md`,
    markdown: "# Synthetic layout fixture",
    relations: [],
    tone: "blue",
  }));
}
describe("deterministic graph geometry", () => {
  it.each([0, 2, 50, 500])(
    "bounds a %i-node direct neighborhood with a finite callout budget",
    (count) => {
      const nodes = graphLayout(fixture(count)).flatMap((cluster) => cluster.nodes);
      const selected = nodes[0]?.skill.id ?? "";
      const edges = nodes.slice(1).map((node) => ({ sourceId: selected, targetId: node.skill.id }));
      const neighborhood = directNeighborhood(nodes, edges, selected);
      expect(neighborhood).toHaveLength(count);
      const camera = fitNeighborhood(neighborhood, 1216, 650, 352);
      for (const node of neighborhood) expect(nodeVisible(node, camera, 1216, 650, 352)).toBe(true);
      expect(neighborhoodLabels(neighborhood, camera, 1216, 650, 352).length).toBeLessThanOrEqual(
        40,
      );
    },
  );
  it.each(["balanced", "uneven"])(
    "frames visible direct endpoints and nonoverlapping screen identities beside the inspector: %s",
    (shape) => {
      const packs = shape === "uneven" ? unevenSixRepositoryFixture() : sixRepositoryFixture();
      let layout = graphLayout([]);
      for (let count = 1; count <= packs.length; count++)
        layout = graphLayout(visibleWorkspace(packs.slice(0, count)), layout);
      const skills = visibleWorkspace(packs);
      const neighborhood = directNeighborhood(
        layout.flatMap((cluster) => cluster.nodes),
        relationEdges(skills),
        packs[0]!.skills[0]!.id,
      );
      expect(neighborhood).toHaveLength(4);
      for (const width of [1216, 952]) {
        const camera = fitNeighborhood(neighborhood, width, 650, 352);
        for (const node of neighborhood)
          expect(nodeVisible(node, camera, width, 650, 352)).toBe(true);
        const labels = neighborhoodLabels(neighborhood, camera, width, 650, 352);
        expect(labels).toHaveLength(4);
        for (const label of labels) {
          expect(label.x).toBeGreaterThanOrEqual(12);
          expect(label.x + 180).toBeLessThanOrEqual(width - 352 - 12);
          expect(label.y).toBeGreaterThanOrEqual(64);
          expect(label.y + 58).toBeLessThanOrEqual(650 - 12);
          for (const other of labels.filter((other) => other !== label))
            expect(
              label.x + 180 <= other.x ||
                other.x + 180 <= label.x ||
                label.y + 58 <= other.y ||
                other.y + 58 <= label.y,
            ).toBe(true);
        }
      }
      const visible = visibleWorkspace(packs.slice(0, 5));
      const hiddenLayout = graphLayout(visible, layout);
      const remaining = directNeighborhood(
        hiddenLayout.flatMap((cluster) => cluster.nodes),
        relationEdges(visible),
        packs[0]!.skills[0]!.id,
      );
      expect(remaining).toHaveLength(3);
      expect(JSON.stringify(remaining)).not.toContain(packs[5]!.skills[0]!.id);
      expect(directNeighborhood([], relationEdges(skills), packs[0]!.skills[0]!.id)).toEqual([]);
    },
  );

  it("includes incoming endpoints but excludes unknown target IDs and transitive neighbors", () => {
    const nodes = graphLayout(fixture(4)).flatMap((cluster) => cluster.nodes);
    const selected = nodes[0]!;
    const edges = [
      { sourceId: nodes[1]!.skill.id, targetId: selected.skill.id },
      { sourceId: selected.skill.id, targetId: nodes[2]!.skill.id },
      { sourceId: nodes[2]!.skill.id, targetId: nodes[3]!.skill.id },
      { sourceId: selected.skill.id, targetId: "unavailable" },
    ];
    expect(
      directNeighborhood(nodes, edges, selected.skill.id).map((node) => node.skill.id),
    ).toEqual(nodes.slice(0, 3).map((node) => node.skill.id));
  });
  it.each([0, 2, 50, 500])(
    "fits %i skills into measured space including inspector and label margins",
    (count) => {
      const skills = fixture(count);
      const layout = graphLayout(skills);
      expect(graphLayout([...skills].reverse())).toEqual(layout);
      const bounds = graphBounds(layout);
      if (!count) {
        expect(bounds).toBeNull();
        expect(fitCamera(bounds, 1000, 700)).toEqual({ x: 0, y: 0, zoom: 1 });
        return;
      }
      for (const [width, height, reserve] of [
        [1216, 740, 0],
        [1216, 740, 352],
        [600, 650, 0],
      ]) {
        const camera = fitCamera(bounds, width!, height!, reserve!);
        expect(camera.x + bounds!.left * camera.zoom).toBeGreaterThanOrEqual(31.99);
        expect(camera.x + bounds!.right * camera.zoom).toBeLessThanOrEqual(
          width! - reserve! - 31.99,
        );
        expect(camera.y + bounds!.top * camera.zoom).toBeGreaterThanOrEqual(71.99);
        expect(camera.y + bounds!.bottom * camera.zoom).toBeLessThanOrEqual(height! - 47.99);
      }
      const nodes = layout.flatMap((cluster) => cluster.nodes);
      for (let index = 0; index < nodes.length; index++)
        for (const other of nodes.slice(index + 1)) {
          const node = nodes[index]!;
          expect(Math.abs(node.x - other.x) >= 148 || Math.abs(node.y - other.y) >= 82).toBe(true);
        }
    },
  );

  it("keeps old coordinates through import, hide and reordered refresh while dropping removed bodies", () => {
    const initial = graphLayout(fixture(100));
    const expanded = graphLayout(fixture(500), initial);
    const before = new Map(
      initial.flatMap((cluster) => cluster.nodes.map((node) => [node.skill.id, [node.x, node.y]])),
    );
    for (const node of expanded.flatMap((cluster) => cluster.nodes)) {
      if (before.has(node.skill.id)) expect([node.x, node.y]).toEqual(before.get(node.skill.id));
    }
    const remaining = fixture(500).filter((skill) => !before.has(skill.id));
    const hidden = graphLayout(remaining, expanded);
    expect(hidden.flatMap((cluster) => cluster.nodes)).toHaveLength(400);
    const positions = new Map(
      expanded.flatMap((cluster) => cluster.nodes.map((node) => [node.skill.id, [node.x, node.y]])),
    );
    for (const node of hidden.flatMap((cluster) => cluster.nodes))
      expect([node.x, node.y]).toEqual(positions.get(node.skill.id));
    expect(JSON.stringify(hidden)).not.toContain('"id":"github:900:');
    expect(graphLayout([...remaining].reverse(), hidden)).toEqual(hidden);
  });

  it("distinguishes category fit, all fit and a selected node obscured by an inspector", () => {
    const layout = graphLayout(fixture(50));
    const all = fitCamera(graphBounds(layout), 1216, 740, 352);
    const focused = fitCamera(graphBounds(layout, "Category 0"), 1216, 740, 352);
    expect(focused.zoom).toBeGreaterThan(all.zoom);
    const node = layout[0]!.nodes[0]!;
    expect(nodeVisible(node, { x: 1100 - node.x, y: 350 - node.y, zoom: 1 }, 1216, 740, 352)).toBe(
      false,
    );
    const centered = fitCamera(
      { left: node.x - 150, right: node.x + 150, top: node.y - 120, bottom: node.y + 120 },
      1216,
      740,
      352,
      1.25,
    );
    expect(nodeVisible(node, centered, 1216, 740, 352)).toBe(true);
  });
});
