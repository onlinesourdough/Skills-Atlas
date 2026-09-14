import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { findSkill, relationEdges } from "../domain/atlas.js";
import {
  fitCamera,
  graphBounds,
  graphLayout,
  directNeighborhood,
  fitNeighborhood,
  neighborhoodLabels,
  type Camera,
  type GraphRepositoryLayout,
} from "../domain/graph.js";
import type { AtlasPack, AtlasSkill } from "../types.js";
import { overlapGroups, REPOSITORY_COLORS, skillRepositoryKey } from "../domain/workspace.js";

export interface GraphFocus {
  serial: number;
  center: boolean;
}

function nodeLabel(name: string): string[] {
  const words = name.replace(/-/gu, " ").split(/\s+/u);
  const lines = [""];
  for (const word of words) {
    const index = lines.length - 1;
    if (lines[index]!.length + word.length + 1 > 19 && lines[index]) lines.push(word);
    else lines[index] += `${lines[index] ? " " : ""}${word}`;
  }
  return lines
    .slice(0, 2)
    .map(
      (line, index) =>
        `${line.slice(0, 19)}${line.length > 19 || (index === 1 && lines.length > 2) ? "…" : ""}`,
    );
}

export function GraphView({
  pack,
  sources,
  layoutSkills,
  category,
  selectedId,
  focus,
  fitVersion,
  onSelect,
  onOpen,
}: {
  pack: AtlasPack;
  sources: AtlasPack[];
  layoutSkills: AtlasSkill[];
  category: string;
  selectedId: string;
  focus: GraphFocus;
  fitVersion: number;
  onSelect: (id: string, center?: boolean) => void;
  onOpen: (id: string) => void;
}): ReactNode {
  const retained = useRef<GraphRepositoryLayout[]>([]);
  const layout = useMemo(() => {
    retained.current = graphLayout(layoutSkills, retained.current);
    const visible = new Set(pack.skills.map((skill) => skill.id));
    const current = new Map(pack.skills.map((skill) => [skill.id, skill]));
    return retained.current
      .map((cluster) => {
        const nodes = cluster.nodes
          .filter((node) => visible.has(node.skill.id))
          .map((node) => ({ ...node, skill: current.get(node.skill.id)! }));
        if (!nodes.length) return { ...cluster, nodes };
        const x =
          (Math.min(...nodes.map((node) => node.x)) + Math.max(...nodes.map((node) => node.x))) / 2;
        const y =
          (Math.min(...nodes.map((node) => node.y)) + Math.max(...nodes.map((node) => node.y))) / 2;
        return {
          ...cluster,
          nodes,
          x,
          y,
          radius: Math.max(100, ...nodes.map((node) => Math.hypot(node.x - x, node.y - y) + 70)),
        };
      })
      .filter((cluster) => cluster.nodes.length);
  }, [layoutSkills, pack.skills]);
  const nodes = useMemo(() => layout.flatMap((cluster) => cluster.nodes), [layout]);
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.skill.id, node])), [nodes]);
  const edges = useMemo(() => relationEdges(pack.skills), [pack.skills]);
  const geometryKey = nodes.map((node) => `${node.skill.id}:${node.x},${node.y}`).join(";");
  const selected = findSkill(pack.skills, selectedId);
  const [hovered, setHovered] = useState("");
  const emphasizedId = selectedId || (nodeById.has(hovered) ? hovered : "");
  const neighborhood = useMemo(
    () => directNeighborhood(nodes, edges, selectedId),
    [nodes, edges, selectedId],
  );
  const neighbors = useMemo(() => {
    const result = new Set<string>();
    for (const edge of edges) {
      if (edge.sourceId === emphasizedId) result.add(edge.targetId);
      if (edge.targetId === emphasizedId) result.add(edge.sourceId);
    }
    return result;
  }, [edges, emphasizedId]);
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 });
  const cameraRef = useRef(camera);
  const animation = useRef<number | null>(null);
  const [moving, setMoving] = useState(false);
  const [listMode, setListMode] = useState(false);
  const [overlapsOpen, setOverlapsOpen] = useState(false);
  const overlaps = useMemo(() => overlapGroups(pack.skills), [pack.skills]);
  const bridges = useMemo(() => {
    const groups = new Map<
      string,
      { source: GraphRepositoryLayout; target: GraphRepositoryLayout; count: number }
    >();
    const clusters = new Map(
      layout.flatMap((cluster) => cluster.nodes.map((node) => [node.skill.id, cluster] as const)),
    );
    for (const edge of edges) {
      const source = clusters.get(edge.sourceId),
        target = clusters.get(edge.targetId);
      if (!source || !target || source.key === target.key) continue;
      const key = `${source.key}→${target.key}`;
      const group = groups.get(key) ?? { source, target, count: 0 };
      group.count++;
      groups.set(key, group);
    }
    return [...groups.entries()];
  }, [layout, edges]);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const stageRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const inspectorRef = useRef<HTMLElement>(null);
  const handledFocus = useRef("");
  const reserve = selected && !window.matchMedia("(max-width: 820px)").matches ? 352 : 0;
  const identityLabels = useMemo(
    () => neighborhoodLabels(neighborhood, camera, size.width, size.height, reserve),
    [neighborhood, camera, size, reserve],
  );
  const labelledIds = new Set(identityLabels.map((label) => label.node.skill.id));
  const drag = useRef<{ pointerId: number; x: number; y: number; origin: Camera } | null>(null);

  function apply(next: Camera): void {
    cameraRef.current = next;
    setCamera(next);
  }
  function interrupt(): void {
    if (animation.current !== null) cancelAnimationFrame(animation.current);
    animation.current = null;
    setMoving(false);
  }
  function move(next: Camera, animate = true): void {
    interrupt();
    if (!animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      apply(next);
      return;
    }
    const previous = cameraRef.current;
    const started = performance.now();
    setMoving(true);
    const step = (now: number) => {
      const progress = Math.min(1, (now - started) / 300);
      const eased = 1 - (1 - progress) ** 3;
      apply({
        x: previous.x + (next.x - previous.x) * eased,
        y: previous.y + (next.y - previous.y) * eased,
        zoom: previous.zoom + (next.zoom - previous.zoom) * eased,
      });
      if (progress < 1) animation.current = requestAnimationFrame(step);
      else {
        animation.current = null;
        setMoving(false);
      }
    };
    animation.current = requestAnimationFrame(step);
  }
  function fit(): void {
    move(fitCamera(graphBounds(layout, category), size.width, size.height, reserve));
  }
  function selectionCamera(): Camera {
    return fitNeighborhood(neighborhood, size.width, size.height, reserve);
  }
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry || entry.contentRect.width <= 0 || entry.contentRect.height <= 0) return;
      const { width, height } = entry.contentRect;
      setSize((current) =>
        current.width === width && current.height === height ? current : { width, height },
      );
    });
    observer.observe(stage);
    return () => {
      observer.disconnect();
      if (animation.current !== null) cancelAnimationFrame(animation.current);
    };
  }, []);
  useEffect(() => {
    if (!size.width || !size.height) return;
    const fitted = fitCamera(graphBounds(layout, category), size.width, size.height, reserve);
    const node = nodeById.get(selectedId);
    // Resize/source geometry keeps the selected neighborhood together. Explicit
    // category/Reset actions are separate; ordinary Read/Back does not refit.
    move(node ? selectionCamera() : fitted, false);
  }, [geometryKey, size.width, size.height]);
  useEffect(() => {
    if (size.width && size.height) fit();
  }, [category, fitVersion]);
  useEffect(() => {
    const key = `${selectedId}:${focus.serial}`;
    const node = nodeById.get(selectedId);
    if (!node || !size.width || !size.height || handledFocus.current === key) return;
    handledFocus.current = key;
    move(selectionCamera());
    if (window.matchMedia("(max-width: 820px)").matches)
      requestAnimationFrame(() => inspectorRef.current?.focus());
  }, [selectedId, focus.serial, geometryKey, size.width, size.height]);

  function zoomAt(factor: number, x = (size.width - reserve) / 2, y = size.height / 2): void {
    interrupt();
    const current = cameraRef.current;
    const zoom = Math.max(0.025, Math.min(2.5, current.zoom * factor));
    const ratio = zoom / current.zoom;
    apply({ zoom, x: x - (x - current.x) * ratio, y: y - (y - current.y) * ratio });
  }
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      zoomAt(
        Math.exp(-Math.max(-100, Math.min(100, event.deltaY)) * 0.004),
        event.clientX - rect.left,
        event.clientY - rect.top,
      );
    };
    svg.addEventListener("wheel", wheel, { passive: false });
    return () => svg.removeEventListener("wheel", wheel);
  }, [size.width, size.height, reserve, Boolean(nodes.length)]);
  function startPan(event: ReactPointerEvent<SVGSVGElement>): void {
    if (
      event.button !== 0 ||
      (event.target as Element).closest("[data-skill-node], [data-repository-focus]")
    )
      return;
    interrupt();
    drag.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      origin: cameraRef.current,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function movePan(event: ReactPointerEvent<SVGSVGElement>): void {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    apply({
      ...current.origin,
      x: current.origin.x + event.clientX - current.x,
      y: current.origin.y + event.clientY - current.y,
    });
  }
  function stopPan(event: ReactPointerEvent<SVGSVGElement>): void {
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
  }
  function closeInspector(): void {
    const id = selectedId;
    onSelect("");
    requestAnimationFrame(() => {
      const targets = stageRef.current?.querySelectorAll<HTMLElement>("[data-skill-id]");
      [...(targets ?? [])]
        .find(
          (element) => element.dataset.skillId === id && element.getBoundingClientRect().width > 0,
        )
        ?.focus();
    });
  }

  return (
    <section className="graph-view" aria-labelledby="graph-title">
      <header className="view-heading graph-heading">
        <h1 id="graph-title">Skill relationships</h1>
        <span>
          {pack.skills.length} {pack.skills.length === 1 ? "skill" : "skills"} · {sources.length}{" "}
          visible {sources.length === 1 ? "source" : "sources"} · {edges.length}{" "}
          {edges.length === 1 ? "reference" : "references"}
        </span>
        <button className="graph-list-toggle" onClick={() => setListMode((current) => !current)}>
          {listMode ? "Graph view" : "List view"}
        </button>
      </header>
      <details className="repository-summary">
        <summary>
          {layout.length} repositories · {bridges.reduce((n, [, bridge]) => n + bridge.count, 0)}{" "}
          cross-repository references
        </summary>
        <p>
          Solid arrows summarize directed references between repositories. Zoom or select a skill
          for individual references; dashed arrows cross repository boundaries.
        </p>
        <ul>
          {layout.map((cluster) => (
            <li key={cluster.key}>
              <button
                onClick={() =>
                  move(fitCamera(graphBounds([cluster]), size.width, size.height, reserve))
                }
              >
                {cluster.repository} · {cluster.nodes.length} skills
              </button>
            </li>
          ))}
        </ul>
        <ul>
          {bridges.map(([key, bridge]) => (
            <li key={key}>
              {bridge.source.repository} → {bridge.target.repository}: {bridge.count} references
            </li>
          ))}
        </ul>
      </details>
      <button
        className="overlap-toggle"
        aria-expanded={overlapsOpen}
        onClick={() => setOverlapsOpen((value) => !value)}
      >
        Possible overlaps · {overlaps.length} candidates
      </button>
      {overlapsOpen ? (
        <section className="overlap-panel" aria-label="Possible overlaps">
          <h2>Possible overlaps</h2>
          <p>
            Candidates are separate from references. Identical content does not establish semantic
            equivalence or justify removal; weak text matches need comparison. No runtime calls are
            inferred.
          </p>
          {!overlaps.length ? (
            <p>No cross-repository matches in the visible loaded skills.</p>
          ) : null}
          {overlaps.map((group, index) => (
            <details key={index}>
              <summary>
                <strong>
                  {group.kind === "same-description"
                    ? group.skills[0]!.description.slice(0, 100)
                    : group.skills[0]!.name}
                </strong>
                <span>
                  {group.kind === "identical-content"
                    ? "Identical full Markdown (exact content)"
                    : group.kind === "same-name"
                      ? "Same normalized name (weak evidence)"
                      : "Same normalized description (weak evidence)"}{" "}
                  · {group.skills.length} skills
                </span>
                <small>
                  {[...new Set(group.skills.map((skill) => skill.sourceRepository))]
                    .slice(0, 2)
                    .join(" ↔ ")}
                  {new Set(group.skills.map((skill) => skill.sourceRepository)).size > 2
                    ? ` +${new Set(group.skills.map((skill) => skill.sourceRepository)).size - 2} repositories`
                    : ""}
                </small>
              </summary>
              {group.evidenceKinds.map((kind) => (
                <p key={kind}>
                  {kind === "identical-content"
                    ? "The complete loaded Markdown strings match, including frontmatter and whitespace."
                    : `Weak evidence — matching ${kind === "same-name" ? "name" : "description"}, ignoring case and repeated whitespace: ${kind === "same-name" ? group.skills[0]!.name : group.skills[0]!.description}`}
                </p>
              ))}
              <ul>
                {group.skills.map((skill) => (
                  <li key={skill.id}>
                    <button onClick={() => onOpen(skill.id)}>
                      {skill.name} · {skill.sourceRepository}
                    </button>
                    <small>
                      {skill.sourcePath} · revision {skill.sourceRevision}
                    </small>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </section>
      ) : null}
      <div
        ref={stageRef}
        className={`graph-stage${selected ? " has-selection" : ""}${listMode ? " list-view" : ""}`}
        data-camera-motion={moving ? "moving" : "idle"}
      >
        <div className="graph-controls" aria-label="Graph controls">
          <button onClick={() => zoomAt(1.2)} aria-label="Zoom in">
            +
          </button>
          <button onClick={() => zoomAt(1 / 1.2)} aria-label="Zoom out">
            −
          </button>
          <button onClick={fit}>Reset view</button>
        </div>
        {reserve > 0 && size.width > 0 && neighborhood.length > identityLabels.length ? (
          <p className="neighborhood-limit">
            Additional identities are available in References and Referenced by.
          </p>
        ) : null}
        {nodes.length ? (
          <svg
            ref={svgRef}
            className="relationship-graph"
            viewBox={`0 0 ${size.width || 940} ${size.height || 720}`}
            role="group"
            aria-labelledby="graph-svg-title graph-svg-description"
            onPointerDown={startPan}
            onPointerMove={movePan}
            onPointerUp={stopPan}
            onPointerCancel={stopPan}
          >
            <title id="graph-svg-title">Relationship graph for visible sources</title>
            <desc id="graph-svg-description">
              Only loaded skills and documented directed references are shown. Use List view for the
              same skills without dragging or zooming. Node size does not represent usage.
            </desc>
            <defs>
              <marker
                id="relation-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth={8 / camera.zoom}
                markerHeight={8 / camera.zoom}
                markerUnits="userSpaceOnUse"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
              </marker>
            </defs>
            <g
              className="graph-camera"
              transform={`translate(${camera.x} ${camera.y}) scale(${camera.zoom})`}
            >
              {layout.map((cluster) => (
                <g
                  key={cluster.key}
                  className={`graph-cluster ${category !== "All skills" && !cluster.nodes.some((node) => node.skill.category === category) ? "category-muted" : "category-emphasized"}`}
                >
                  <circle cx={cluster.x} cy={cluster.y} r={cluster.radius} fill={cluster.color} />
                </g>
              ))}
              {!emphasizedId
                ? bridges.map(([key, bridge]) => {
                    const { source, target, count } = bridge;
                    const dx = target.x - source.x,
                      dy = target.y - source.y;
                    const distance = Math.hypot(dx, dy) || 1;
                    const sx = source.x + (dx / distance) * source.radius;
                    const sy = source.y + (dy / distance) * source.radius;
                    const tx = target.x - (dx / distance) * target.radius;
                    const ty = target.y - (dy / distance) * target.radius;
                    const mx = (sx + tx) / 2 - (dy / distance) * 28;
                    const my = (sy + ty) / 2 + (dx / distance) * 28;
                    return (
                      <g key={key} className="repository-bridge">
                        <path
                          d={`M ${sx} ${sy} Q ${mx} ${my} ${tx} ${ty}`}
                          markerEnd="url(#relation-arrow)"
                        />
                        <text
                          x={mx}
                          y={my - 8 / camera.zoom}
                          textAnchor="middle"
                          style={{ fontSize: 13 / camera.zoom }}
                        >
                          {count}
                        </text>
                        <title>{`${source.repository} → ${target.repository}: ${count} documented references`}</title>
                      </g>
                    );
                  })
                : null}
              {edges.map((edge) => {
                const start = nodeById.get(edge.sourceId);
                const end = nodeById.get(edge.targetId);
                if (!start || !end) return null;
                const distance = Math.hypot(end.x - start.x, end.y - start.y) || 1;
                const active = edge.sourceId === emphasizedId || edge.targetId === emphasizedId;
                const cross = skillRepositoryKey(start.skill) !== skillRepositoryKey(end.skill);
                if (emphasizedId && !active) return null;
                if (!active && (camera.zoom < 0.8 || cross)) return null;
                return (
                  <line
                    key={`${edge.sourceId}-${edge.targetId}`}
                    data-edge-source={edge.sourceId}
                    data-edge-target={edge.targetId}
                    className={`graph-edge${active ? " active" : ""}${cross ? " cross-repository" : ""}`}
                    x1={start.x}
                    y1={start.y}
                    x2={end.x - ((end.x - start.x) * 14) / distance}
                    y2={end.y - ((end.y - start.y) * 14) / distance}
                    markerEnd="url(#relation-arrow)"
                  >
                    <title>{`${start.skill.name} (${start.skill.sourceRepository}) → ${end.skill.name} (${end.skill.sourceRepository}); inspect source evidence in the inspector`}</title>
                  </line>
                );
              })}
              {nodes.map((node) => {
                const active = node.skill.id === selectedId;
                const highlighted = node.skill.id === emphasizedId || neighbors.has(node.skill.id);
                const muted = category !== "All skills" && node.skill.category !== category;
                const showLabel = selected
                  ? active || highlighted
                  : camera.zoom >= 1 || highlighted;
                return (
                  <g
                    key={node.skill.id}
                    data-skill-node="true"
                    data-skill-id={node.skill.id}
                    className={`skill-node${active ? " selected" : ""}${highlighted ? " related" : ""}${muted ? " category-muted" : " category-emphasized"}`}
                    transform={`translate(${node.x} ${node.y})`}
                    role="button"
                    tabIndex={0}
                    aria-label={`${node.skill.name}, ${node.skill.category}, ${node.skill.sourceRepository}, ${node.skill.sourcePath}`}
                    aria-pressed={active}
                    onMouseEnter={() => setHovered(node.skill.id)}
                    onMouseLeave={() => setHovered("")}
                    onFocus={() => setHovered(node.skill.id)}
                    onBlur={() => setHovered("")}
                    onClick={() => onSelect(node.skill.id, true)}
                    onDoubleClick={() => onOpen(node.skill.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelect(node.skill.id, true);
                      }
                    }}
                  >
                    <title>{`${node.skill.name} · ${node.skill.sourceRepository} · ${node.skill.category}`}</title>
                    <circle
                      r={active ? 12 : 9}
                      fill={node.skill.sourceColor ?? REPOSITORY_COLORS[0]}
                    />
                    <text
                      textAnchor="middle"
                      className={
                        showLabel && !labelledIds.has(node.skill.id) ? "" : "zoom-label-hidden"
                      }
                      style={{ fontSize: 13 / camera.zoom }}
                    >
                      {nodeLabel(node.skill.name).map((line, index) => (
                        <tspan key={index} x="0" y={(25 + index * 15) / camera.zoom}>
                          {line}
                        </tspan>
                      ))}
                    </text>
                  </g>
                );
              })}
            </g>
            {/* Screen-space labels never shrink with the world camera. Full
                identities also remain available in the keyboard summary/list. */}
            {!selected &&
              layout.map((cluster) => {
                const center = cluster.x * camera.zoom + camera.x;
                if (size.width && (center < -94 || center > size.width - reserve + 94)) return null;
                const x = size.width
                  ? Math.max(96, Math.min(size.width - reserve - 96, center))
                  : center;
                const y = (cluster.y - cluster.radius) * camera.zoom + camera.y - 10;
                const name = cluster.repository.split("/").slice(1).join("/") || cluster.repository;
                const lines = nodeLabel(name);
                return (
                  <g
                    key={cluster.key}
                    className="repository-label"
                    data-repository-focus="true"
                    transform={`translate(${x} ${y})`}
                    role="button"
                    tabIndex={0}
                    aria-label={`Focus ${cluster.repository}, ${cluster.nodes.length} skills`}
                    onClick={() =>
                      move(fitCamera(graphBounds([cluster]), size.width, size.height, reserve))
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        move(fitCamera(graphBounds([cluster]), size.width, size.height, reserve));
                      }
                    }}
                  >
                    <title>{`${cluster.repository} · ${cluster.nodes.length} skills`}</title>
                    <rect
                      x={-94}
                      y={-lines.length * 16 - 17}
                      width={188}
                      height={lines.length * 16 + 24}
                      rx={5}
                    />
                    <circle cx={-82} cy={-9} r={4} fill={cluster.color} />
                    <text textAnchor="middle">
                      {lines.map((line, index) => (
                        <tspan key={index} x={0} y={-(lines.length - index) * 16}>
                          {line}
                        </tspan>
                      ))}
                      <tspan className="repository-owner" x={0} y={0}>
                        {cluster.repository.split("/")[0]} · {cluster.nodes.length} skills
                      </tspan>
                    </text>
                  </g>
                );
              })}
            {identityLabels.map((label) => {
              const node = label.node;
              const point = {
                x: node.x * camera.zoom + camera.x,
                y: node.y * camera.zoom + camera.y,
              };
              const repository = node.skill.sourceRepository ?? "";
              const shortRepository = repository.split("/").slice(1).join("/") || repository;
              return (
                <g
                  key={node.skill.id}
                  className="neighborhood-label"
                  data-neighborhood-id={node.skill.id}
                >
                  <line
                    x1={point.x}
                    y1={point.y}
                    x2={Math.max(label.x, Math.min(label.x + 180, point.x))}
                    y2={Math.max(label.y, Math.min(label.y + 58, point.y))}
                  />
                  <rect x={label.x} y={label.y} width={180} height={58} rx={5} />
                  <title>{`${node.skill.name} · ${repository} · ${node.skill.sourcePath}`}</title>
                  <text x={label.x + 8} y={label.y + 16}>
                    {nodeLabel(node.skill.name).map((line, index) => (
                      <tspan key={index} x={label.x + 8} y={label.y + 16 + index * 14}>
                        {line}
                      </tspan>
                    ))}
                    <tspan className="neighborhood-repository" x={label.x + 8} y={label.y + 48}>
                      {shortRepository.length > 25
                        ? shortRepository.slice(0, 24) + "…"
                        : shortRepository}
                    </tspan>
                  </text>
                </g>
              );
            })}
          </svg>
        ) : (
          <div className="empty-state">
            <strong>No loaded skills</strong>
            <p>Select a source checkbox or import a repository with supported skill files.</p>
          </div>
        )}
        <div className="mobile-relationship-list" aria-label="Skill relationship list">
          {pack.skills.map((skill) => (
            <button
              key={skill.id}
              data-skill-id={skill.id}
              className={skill.id === selectedId ? "selected" : ""}
              aria-pressed={skill.id === selectedId}
              onClick={() => onSelect(skill.id, true)}
            >
              <i style={{ "--node": skill.sourceColor ?? REPOSITORY_COLORS[0] } as CSSProperties} />
              <span>
                <strong>{skill.name}</strong>
                <small>
                  {skill.category} · {skill.sourceRepository}
                </small>
                <small>
                  {skill.relations.length} outgoing{" "}
                  {skill.relations.length === 1 ? "reference" : "references"}
                </small>
              </span>
              <span aria-hidden="true">→</span>
            </button>
          ))}
        </div>
        {selected ? (
          <aside
            ref={inspectorRef}
            tabIndex={-1}
            className="graph-selection"
            aria-labelledby="inspector-title"
          >
            <header>
              <h2 id="inspector-title">{selected.name}</h2>
              <button onClick={closeInspector} aria-label="Close inspector">
                Close
              </button>
            </header>
            <div className="inspector-content">
              <p className="inspector-category">{selected.category}</p>
              <p>{selected.description}</p>
              <dl>
                <dt>Repository</dt>
                <dd>
                  {
                    sources.find((source) => source.skills.some((skill) => skill.id === selectedId))
                      ?.repository
                  }
                </dd>
                <dt>Shelf</dt>
                <dd>
                  {selected.sourcePath.startsWith(".agents/") ? "Repository-local" : "Distributed"}
                </dd>
                <dt>Path</dt>
                <dd>
                  <code>{selected.sourcePath}</code>
                </dd>
                <dt>Revision</dt>
                <dd>
                  <code>
                    {
                      sources.find((source) =>
                        source.skills.some((skill) => skill.id === selectedId),
                      )?.revision
                    }
                  </code>
                </dd>
                <dt>Access</dt>
                <dd>Read only</dd>
              </dl>
              <InspectorRelations
                skill={selected}
                skills={pack.skills}
                onSelect={(id) => onSelect(id, true)}
              />
              <p className="inspector-usage">Usage not connected</p>
            </div>
            <footer>
              <button onClick={() => onOpen(selected.id)}>
                Read skill <span aria-hidden="true">→</span>
              </button>
            </footer>
          </aside>
        ) : null}
      </div>
    </section>
  );
}

function InspectorRelations({
  skill,
  skills,
  onSelect,
}: {
  skill: AtlasSkill;
  skills: AtlasSkill[];
  onSelect: (id: string) => void;
}): ReactNode {
  const outgoing = skill.evidence ?? [];
  const incoming = skills.filter((item) => item.relations.includes(skill.id));
  return (
    <div className="inspector-relations">
      <h3>References</h3>
      {outgoing
        .filter((item) => item.status === "resolved")
        .map((item, index) => {
          const target = skills.find((candidate) => candidate.id === item.targetId);
          return (
            <div key={index}>
              {target ? (
                <button onClick={() => onSelect(target.id)}>
                  {target.name} · {target.sourceRepository} · {target.sourcePath}
                </button>
              ) : (
                <span>Unavailable target</span>
              )}
              <small>
                {item.kind === "reference" ? "Reference" : "Declared relation"} · {item.sourcePath}:
                {item.line}
              </small>
            </div>
          );
        })}
      {!outgoing.some((item) => item.status === "resolved") ? (
        <p>No resolved outgoing references.</p>
      ) : null}
      <h3>Referenced by</h3>
      {incoming.map((item) => (
        <div key={item.id}>
          <button onClick={() => onSelect(item.id)}>{item.name}</button>
          <small>
            {item.sourceRepository} ·{" "}
            {item.evidence
              ?.filter((evidence) => evidence.targetId === skill.id)
              .map((evidence) => `${evidence.sourcePath}:${evidence.line}`)
              .join(", ")}
          </small>
        </div>
      ))}
      {!incoming.length ? <p>No incoming references.</p> : null}
      {outgoing.some((item) => item.status !== "resolved") ? (
        <>
          <h3>Unresolved evidence</h3>
          <ul>
            {outgoing
              .filter((item) => item.status !== "resolved")
              .map((item, index) => (
                <li key={index}>
                  {item.target} · {item.status}
                  {item.explanation ? ` · ${item.explanation}` : ""}
                  <small>
                    {item.sourcePath}:{item.line}
                  </small>
                </li>
              ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
