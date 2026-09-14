import { skillRepositoryKey, REPOSITORY_COLORS } from "./workspace.js";
import type { AtlasSkill } from "../types.js";
import type { RelationEdge } from "./atlas.js";

export interface GraphNodeLayout {
  skill: AtlasSkill;
  x: number;
  y: number;
}
export interface GraphRepositoryLayout {
  key: string;
  repository: string;
  color: string;
  x: number;
  y: number;
  radius: number;
  nodes: GraphNodeLayout[];
}
export interface Camera {
  x: number;
  y: number;
  zoom: number;
}
export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export function directNeighborhood(
  nodes: GraphNodeLayout[],
  edges: RelationEdge[],
  selectedId: string,
): GraphNodeLayout[] {
  if (!nodes.some((node) => node.skill.id === selectedId)) return [];
  const ids = new Set([selectedId]);
  for (const edge of edges) {
    if (edge.sourceId === selectedId) ids.add(edge.targetId);
    if (edge.targetId === selectedId) ids.add(edge.sourceId);
  }
  return nodes
    .filter((node) => ids.has(node.skill.id))
    .sort(
      (a, b) =>
        Number(b.skill.id === selectedId) - Number(a.skill.id === selectedId) ||
        a.skill.id.localeCompare(b.skill.id),
    );
}

// Screen-space margins reserve room for readable identity callouts, independent
// of world scale. Only loaded visible endpoints participate in these bounds.
export function fitNeighborhood(
  nodes: GraphNodeLayout[],
  width: number,
  height: number,
  reserve = 0,
): Camera {
  if (!nodes.length || width <= 0 || height <= 0) return { x: 0, y: 0, zoom: 1 };
  const left = Math.min(...nodes.map((node) => node.x)),
    right = Math.max(...nodes.map((node) => node.x));
  const top = Math.min(...nodes.map((node) => node.y)),
    bottom = Math.max(...nodes.map((node) => node.y));
  const available = Math.max(80, width - reserve);
  const zoom = Math.max(
    0.025,
    Math.min(
      1.25,
      Math.max(40, available - 240) / Math.max(240, right - left),
      Math.max(40, height - 220) / Math.max(160, bottom - top),
    ),
  );
  return {
    zoom,
    x: available / 2 - ((left + right) / 2) * zoom,
    y: (height + 24) / 2 - ((top + bottom) / 2) * zoom,
  };
}

export interface NeighborhoodLabel {
  node: GraphNodeLayout;
  x: number;
  y: number;
}
export function neighborhoodLabels(
  nodes: GraphNodeLayout[],
  camera: Camera,
  width: number,
  height: number,
  reserve = 0,
): NeighborhoodLabel[] {
  const available = width - reserve;
  if (available < 220 || height < 180) return [];
  const points = nodes.map((node) => ({
    node,
    x: node.x * camera.zoom + camera.x,
    y: node.y * camera.zoom + camera.y,
  }));
  const labels: NeighborhoodLabel[] = [];
  for (const point of points) {
    if (labels.length >= 40) break;
    if (point.x < 12 || point.x > available - 12 || point.y < 64 || point.y > height - 12) continue;
    const candidates = [
      { x: point.x - 90, y: point.y + 14 },
      { x: point.x - 90, y: point.y - 72 },
      { x: point.x + 14, y: point.y - 29 },
      { x: point.x - 194, y: point.y - 29 },
    ];
    for (const offset of [-132, 74, -192, 134])
      candidates.push({ x: point.x - 90, y: point.y + offset });
    const position = candidates
      .map((candidate) => ({
        x: Math.max(12, Math.min(available - 192, candidate.x)),
        y: Math.max(64, Math.min(height - 70, candidate.y)),
      }))
      .find(
        (candidate) =>
          !labels.some(
            (label) =>
              candidate.x < label.x + 188 &&
              candidate.x + 188 > label.x &&
              candidate.y < label.y + 66 &&
              candidate.y + 66 > label.y,
          ) &&
          !points.some(
            (other) =>
              other.x > candidate.x - 8 &&
              other.x < candidate.x + 188 &&
              other.y > candidate.y - 8 &&
              other.y < candidate.y + 66,
          ),
      );
    if (position) labels.push({ node: point.node, ...position });
  }
  return labels;
}

function spiral(index: number): { x: number; y: number } {
  if (!index) return { x: 0, y: 0 };
  const ring = Math.ceil((Math.sqrt(index + 1) - 1) / 2);
  const side = ring * 2;
  const offset = (side + 1) ** 2 - 1 - index;
  if (offset < side) return { x: ring - offset, y: -ring };
  if (offset < side * 2) return { x: -ring, y: -ring + offset - side };
  if (offset < side * 3) return { x: -ring + offset - side * 2, y: ring };
  return { x: ring, y: ring - offset + side * 3 };
}

// A session keeps existing coordinates through refresh/import/hide. New nodes take
// the nearest free repository slot. The spatial index bounds collision work without
// a force simulation; removed content is never retained in the returned layout.
export function graphLayout(
  skills: AtlasSkill[],
  previous: GraphRepositoryLayout[] = [],
): GraphRepositoryLayout[] {
  const grouped = new Map<string, AtlasSkill[]>();
  for (const skill of [...skills].sort(
    (a, b) =>
      skillRepositoryKey(a).localeCompare(skillRepositoryKey(b)) || a.id.localeCompare(b.id),
  )) {
    const group = grouped.get(skillRepositoryKey(skill)) ?? [];
    group.push(skill);
    grouped.set(skillRepositoryKey(skill), group);
  }
  const oldRepositories = new Map(previous.map((cluster) => [cluster.key, cluster]));
  const oldNodes = new Map(
    previous.flatMap((cluster) => cluster.nodes.map((node) => [node.skill.id, node] as const)),
  );
  const cells = new Map<string, { x: number; y: number }[]>();
  function occupy(point: { x: number; y: number }): void {
    const key = `${Math.floor(point.x / 160)},${Math.floor(point.y / 96)}`;
    const cell = cells.get(key) ?? [];
    cell.push(point);
    cells.set(key, cell);
  }
  function available(point: { x: number; y: number }): boolean {
    const column = Math.floor(point.x / 160);
    const row = Math.floor(point.y / 96);
    for (let x = column - 1; x <= column + 1; x++)
      for (let y = row - 1; y <= row + 1; y++)
        if (
          cells
            .get(`${x},${y}`)
            ?.some((other) => Math.abs(other.x - point.x) < 148 && Math.abs(other.y - point.y) < 82)
        )
          return false;
    return true;
  }
  for (const skill of skills) {
    const node = oldNodes.get(skill.id);
    if (node && skillRepositoryKey(node.skill) === skillRepositoryKey(skill)) occupy(node);
  }
  const largest = Math.max(1, ...[...grouped.values()].map((group) => group.length));
  const spacing = Math.max(440, Math.ceil(Math.sqrt(largest)) * 240 + 260);
  const columns = Math.max(1, Math.ceil(Math.sqrt(grouped.size)));
  const placed = previous.filter((cluster) => grouped.has(cluster.key));
  let nextCluster = 0;
  return [...grouped.entries()].map(([key, group], index) => {
    const old = oldRepositories.get(key);
    const predictedRadius = Math.max(
      100,
      ...group.map((_, i) => {
        const slot = spiral(i);
        return Math.hypot(slot.x * 160, slot.y * 96) + 70;
      }),
    );
    let position = old ?? {
      x: (index % columns) * spacing,
      y: Math.floor(index / columns) * spacing,
    };
    if (!old && previous.length) {
      do {
        const slot = spiral(nextCluster++);
        position = { x: slot.x * spacing, y: slot.y * spacing };
      } while (
        placed.some(
          (cluster) =>
            Math.hypot(cluster.x - position.x, cluster.y - position.y) <
            cluster.radius + predictedRadius + 160,
        )
      );
    }
    let next = 0;
    const nodes = group.map((skill) => {
      const existing = oldNodes.get(skill.id);
      if (existing && skillRepositoryKey(existing.skill) === key)
        return { skill, x: existing.x, y: existing.y };
      let point;
      do {
        const slot = spiral(next++);
        point = { x: position.x + slot.x * 160, y: position.y + slot.y * 96 };
      } while (!available(point));
      occupy(point);
      return { skill, ...point };
    });
    const cluster = {
      key,
      repository: group[0]?.sourceRepository ?? key,
      color: group[0]?.sourceColor ?? REPOSITORY_COLORS[index % REPOSITORY_COLORS.length]!,
      x: position.x,
      y: position.y,
      radius: Math.max(
        100,
        ...nodes.map((node) => Math.hypot(node.x - position.x, node.y - position.y) + 70),
      ),
      nodes,
    };
    // A refreshed repository can grow beyond its former envelope. Preserve
    // coordinates normally; move that whole cluster only to avoid overlap.
    const others = placed.filter((item) => item.key !== key);
    if (
      others.some(
        (item) =>
          Math.hypot(item.x - cluster.x, item.y - cluster.y) < item.radius + cluster.radius + 120,
      )
    ) {
      let candidate = { x: 0, y: 0 };
      do {
        const slot = spiral(nextCluster++);
        candidate = { x: slot.x * spacing, y: slot.y * spacing };
      } while (
        others.some(
          (item) =>
            Math.hypot(item.x - candidate.x, item.y - candidate.y) <
            item.radius + cluster.radius + 120,
        )
      );
      for (const node of cluster.nodes) {
        node.x += candidate.x - cluster.x;
        node.y += candidate.y - cluster.y;
      }
      cluster.x = candidate.x;
      cluster.y = candidate.y;
    }
    const placedIndex = placed.findIndex((item) => item.key === key);
    if (placedIndex < 0) placed.push(cluster);
    else placed[placedIndex] = cluster;
    return cluster;
  });
}

export function graphBounds(
  layout: GraphRepositoryLayout[],
  category = "All skills",
): Bounds | null {
  const clusters = layout.flatMap((cluster) => {
    const nodes = cluster.nodes.filter(
      (node) => category === "All skills" || node.skill.category === category,
    );
    if (!nodes.length) return [];
    if (category === "All skills") return [cluster];
    const x = (Math.min(...nodes.map((n) => n.x)) + Math.max(...nodes.map((n) => n.x))) / 2;
    const y = (Math.min(...nodes.map((n) => n.y)) + Math.max(...nodes.map((n) => n.y))) / 2;
    return [
      {
        ...cluster,
        x,
        y,
        radius: Math.max(80, ...nodes.map((n) => Math.hypot(n.x - x, n.y - y) + 70)),
      },
    ];
  });
  if (!clusters.length) return null;
  return {
    left: Math.min(...clusters.map((cluster) => cluster.x - cluster.radius)),
    right: Math.max(...clusters.map((cluster) => cluster.x + cluster.radius)),
    top: Math.min(...clusters.map((cluster) => cluster.y - cluster.radius - 32)),
    bottom: Math.max(...clusters.map((cluster) => cluster.y + cluster.radius)),
  };
}

export function fitCamera(
  bounds: Bounds | null,
  width: number,
  height: number,
  reserve = 0,
  maximumZoom = 1.5,
): Camera {
  if (!bounds || width <= 0 || height <= 0) return { x: 0, y: 0, zoom: 1 };
  const availableWidth = Math.max(80, width - reserve);
  const zoom = Math.max(
    0.025,
    Math.min(
      maximumZoom,
      Math.max(40, availableWidth - 64) / Math.max(1, bounds.right - bounds.left),
      Math.max(40, height - 120) / Math.max(1, bounds.bottom - bounds.top),
    ),
  );
  return {
    zoom,
    x: availableWidth / 2 - ((bounds.left + bounds.right) / 2) * zoom,
    y: (height + 24) / 2 - ((bounds.top + bounds.bottom) / 2) * zoom,
  };
}

export function nodeVisible(
  node: GraphNodeLayout,
  camera: Camera,
  width: number,
  height: number,
  reserve: number,
): boolean {
  const x = node.x * camera.zoom + camera.x;
  const y = node.y * camera.zoom + camera.y;
  return x >= 90 && x <= width - reserve - 90 && y >= 80 && y <= height - 80;
}
