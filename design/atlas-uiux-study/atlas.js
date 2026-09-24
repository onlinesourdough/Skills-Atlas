/* Standalone interaction study. No network calls, account access, or persistent writes. */
(() => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [
    ...root.querySelectorAll(selector),
  ];
  const esc = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const sources = AtlasData.sources;
  const skills = AtlasData.skills;
  const links = AtlasData.links;
  const sourceOf = (skill) =>
    sources.find((source) => source.id === skill.source);
  const skillById = (id) => skills.find((skill) => skill.id === id);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const mobile = matchMedia("(max-width: 820px)");
  const systemDark = matchMedia("(prefers-color-scheme: dark)");
  const state = {
    view: "graph",
    selected: null,
    visible: new Set(sources.map((source) => source.id)),
    filter: "",
    sort: "name",
    readerTab: "read",
    file: "SKILL.md",
    reading: false,
    expanded: false,
    editor: null,
    queued: null,
    theme: "light",
    sampleUsage: false,
    period: 30,
    searchIndex: 0,
    searchMatches: [],
    drawer: false,
    camera: { x: 0, y: 0, k: 1 },
    fitted: false,
    hover: null,
    focusSource: null,
    onboardStep: 0,
    onboardSources: new Set(["global", "aios"]),
    importRepo: null,
    importTimer: 0,
    loadingTimer: 0,
    toastTimer: 0,
    tour: false,
  };
  const paths = {
    menu: "M4 6h16M4 12h16M4 18h16",
    close: "m6 6 12 12M18 6 6 18",
    search: "M16 16l5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
    plus: "M12 5v14M5 12h14",
    grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
    overlap:
      "M14 8a6 6 0 1 1-12 0 6 6 0 0 1 12 0M22 16a6 6 0 1 1-12 0 6 6 0 0 1 12 0",
    chevrons: "m8 8 4-4 4 4M8 16l4 4 4-4",
    list: "M8 6h13M8 12h13M8 18h13M3 6h.1M3 12h.1M3 18h.1",
    agent:
      "M9 3h6M12 3v4M5 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2M8 12v2M16 12v2M9 17h6",
    "arrow-up": "M6 18 18 6M6 6h12v12",
    "arrow-right": "M4 12h16m-6-6 6 6-6 6",
    "arrow-left": "M20 12H4m6-6-6 6 6 6",
    file: "M6 2h8l5 5v15H6zM14 2v6h5M9 12h7M9 16h7",
    folder: "M3 6h6l2 3h10v11H3z",
    repo: "M5 3h15v18H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2M7 3v14M3 17h17",
    lock: "M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5zM12 14v3",
    eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
    edit: "m15 3 6 6M3 21l2-7L16 3a2 2 0 0 1 3 0l2 2a2 2 0 0 1 0 3L10 19z",
    expand: "M9 3H3v6M15 3h6v6M3 15v6h6M21 15v6h-6",
    minimize: "M3 9h6V3M15 3v6h6M3 15h6v6M15 21v-6h6",
    info: "M12 11v6M12 7h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
    check: "m5 12 4 4L20 5",
    settings: "M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6",
    refresh: "M20 8a9 9 0 1 0 1 8M20 2v6h-6",
    copy: "M8 8h13v13H8zM16 8V3H3v13h5",
    activity: "M2 12h5l3-8 4 16 3-8h5",
    moon: "M21 13A9 9 0 0 1 11 3 9 9 0 1 0 21 13",
    sun: "M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0M12 1v3M12 20v3M1 12h3M20 12h3M4 4l2 2M18 18l2 2M4 20l2-2M18 6l2-2",
    monitor: "M2 3h20v14H2zM12 17v4M7 21h10",
    download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
    map: "M2 5 9 2l6 3 7-3v17l-7 3-6-3-7 3zM9 2v17M15 5v17",
  };
  const icon = (name) =>
    `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${paths[name] || paths.info}"/></svg>`;
  const dot = (source) =>
    `<i class="color-dot" style="--source-color:${source.color}" aria-hidden="true"></i>`;
  function staticIcons() {
    [
      "search",
      "plus",
      "grid",
      "overlap",
      "chevrons",
      "list",
      "agent",
      "arrow-up",
    ].forEach((name) =>
      $$(`.${name}-icon`).forEach((el) => {
        if (!el.firstElementChild) el.innerHTML = icon(name);
      }),
    );
    [
      ["open-sources", "menu"],
      ["close-sources", "close"],
      ["manage-sources", "settings"],
    ].forEach(([action, name]) =>
      $$(`[data-action="${action}"]`).forEach((el) => {
        if (!el.innerHTML.trim()) el.innerHTML = icon(name);
      }),
    );
  }
  const visibleSkills = () =>
    skills.filter((skill) => state.visible.has(skill.source));
  const sourcePosition = (source) =>
    mobile.matches
      ? [
          140 + (sources.indexOf(source) % 2) * 330,
          130 + Math.floor(sources.indexOf(source) / 2) * 300,
        ]
      : source.center;
  const positionOf = (skill) => {
    const source = sourceOf(skill),
      center = sourcePosition(source);
    return {
      ...skill,
      x: skill.x - source.center[0] + center[0],
      y: skill.y - source.center[1] + center[1],
    };
  };
  const visibleLinks = () =>
    links.filter(
      (link) =>
        state.visible.has(skillById(link.from)?.source) &&
        state.visible.has(skillById(link.to)?.source),
    );
  const relations = (id) =>
    visibleLinks().filter((link) => link.from === id || link.to === id);
  function toast(message) {
    clearTimeout(state.toastTimer);
    $("#toast").textContent = message;
    $("#toast").hidden = false;
    state.toastTimer = setTimeout(() => {
      $("#toast").hidden = true;
    }, 4300);
  }
  function dialog(title, content, footer = "") {
    $("#profile-dialog").close();
    const el = $("#detail-dialog");
    el.className = "detail-dialog";
    el.innerHTML = `<header class="dialog-heading"><h2 id="detail-title" tabindex="-1">${title}</h2><button class="icon-button" data-close="detail-dialog" aria-label="Close dialog">${icon("close")}</button></header>${content}${footer ? `<footer class="dialog-footer">${footer}</footer>` : ""}`;
    if (!el.open) el.showModal();
    $("#detail-title").focus();
  }
  function guard(action) {
    if (!state.editor || state.editor.draft === state.editor.original) {
      state.editor = null;
      action();
      return;
    }
    state.queued = action;
    $("#confirm-dialog").innerHTML =
      `<h2 id="confirm-title">Leave this draft?</h2><p>Your changes only exist in this preview. Leaving will discard them; no repository has been changed.</p><div class="confirm-actions"><button class="secondary-button" data-action="stay-draft">Keep editing</button><button class="primary-button" data-action="discard-draft">Discard draft</button></div>`;
    $("#confirm-dialog").showModal();
    $('[data-action="stay-draft"]').focus();
  }
  function syncUrl(replace = false) {
    const query = new URLSearchParams();
    if (state.selected) query.set("skill", state.selected);
    const hash = `#${state.view}${query.size ? "?" + query : ""}`;
    if (location.hash !== hash)
      history[replace ? "replaceState" : "pushState"](null, "", hash);
  }
  function navigate(view, id = state.selected, options = {}) {
    guard(() => {
      const changed = id !== state.selected;
      state.view = view;
      state.selected =
        skillById(id) && state.visible.has(skillById(id).source) ? id : null;
      if (changed) {
        state.readerTab = "read";
        state.file = "SKILL.md";
        state.expanded = false;
        state.focusSource = null;
        state.fitted = false;
      }
      if (options.reading !== undefined) state.reading = options.reading;
      else if (view === "library" && state.selected) state.reading = true;
      if (options.focusMap) state.fitted = false;
      closeSources(false);
      syncUrl();
      render();
      if (options.focusReader)
        requestAnimationFrame(() => $("#reader-title")?.focus());
    });
  }
  function readUrl() {
    const [view, params] = location.hash.slice(1).split("?");
    const id = new URLSearchParams(params).get("skill");
    state.view = ["graph", "library", "usage"].includes(view) ? view : "graph";
    state.selected =
      skillById(id) && state.visible.has(skillById(id).source) ? id : null;
    state.reading = Boolean(state.selected);
    state.readerTab = "read";
    state.file = "SKILL.md";
    state.fitted = false;
  }
  function renderSources() {
    $("#source-list").innerHTML = sources
      .map(
        (source) =>
          `<div class="source-row ${state.visible.has(source.id) ? "" : "is-hidden"}" style="--source-color:${source.color}"><input id="source-${source.id}" type="checkbox" data-source="${source.id}" ${state.visible.has(source.id) ? "checked" : ""} aria-label="Show ${esc(source.name)}"><label for="source-${source.id}"><span class="source-text"><strong>${esc(source.name)}</strong><small>${esc(source.kind)}</small></span><span class="count">${skills.filter((s) => s.source === source.id).length}</span></label></div>`,
      )
      .join("");
    $("#all-count").textContent = skills.length;
    $("#overlap-count").textContent = AtlasData.overlaps.filter((o) =>
      o.ids.every((id) => state.visible.has(skillById(id).source)),
    ).length;
    $("#workspace-count").textContent =
      `${visibleSkills().length}${visibleSkills().length < skills.length ? " / " + skills.length : ""} skills · ${state.visible.size} sources`;
  }
  function render() {
    renderSources();
    $$("[data-view]").forEach((el) =>
      el.getAttribute("data-view") === state.view
        ? el.setAttribute("aria-current", "page")
        : el.removeAttribute("aria-current"),
    );
    ["graph", "library", "usage"].forEach((view) => {
      $(`#${view}-view`).hidden = state.view !== view;
    });
    if (state.view === "graph") {
      renderInspector();
      renderGraph();
    }
    if (state.view === "library") {
      renderList();
      renderReader();
    }
    if (state.view === "usage") renderUsage();
    staticIcons();
    updateDrawerAccess();
  }

  // One source of truth for visibility, selection and reference direction in every view.
  function renderInspector() {
    const skill = skillById(state.selected),
      panel = $("#inspector");
    panel.hidden = !skill;
    $("#graph-layout").classList.toggle("has-selection", Boolean(skill));
    if (!skill) return;
    const source = sourceOf(skill),
      all = relations(skill.id);
    const outgoing = all.filter((r) => r.from === skill.id),
      incoming = all.filter((r) => r.to === skill.id);
    const row = (r, id) => {
      const target = skillById(id),
        targetSource = sourceOf(target);
      return `<button class="relation-row" data-skill="${target.id}" data-destination="graph">${dot(targetSource)}<span><strong>${esc(target.name)}</strong><small>${esc(targetSource.name)} · sample line ${r.line}</small></span>${icon("arrow-right")}</button>`;
    };
    panel.innerHTML = `<header class="inspector-heading"><div><h2 id="inspector-title" tabindex="-1">${esc(skill.name)}</h2><div class="inspector-source">${dot(source)}${esc(source.name)}</div></div><button class="icon-button" data-action="close-inspector" aria-label="Back to full graph">${icon("close")}</button></header><p class="inspector-description">${esc(skill.description)}</p><div class="inspector-meta">${icon(source.access === "propose" ? "edit" : "lock")}<span>${source.access === "propose" ? "Edit proposal available · demo" : "Read-only source"}</span></div><div class="inspector-metrics"><div><strong>${all.length}</strong><small>visible references</small></div><div><strong>${Object.keys(skill.files).length}</strong><small>files in folder</small></div><div><strong>—</strong><small>usage unconnected</small></div></div><div class="inspector-scroll"><h3>References <span class="muted">${outgoing.length}</span></h3>${outgoing.length ? outgoing.map((r) => row(r, r.to)).join("") : '<p class="relation-note">No outgoing references in the visible sample.</p>'}<h3 class="section-gap">Referenced by <span class="muted">${incoming.length}</span></h3>${incoming.length ? incoming.map((r) => row(r, r.from)).join("") : '<p class="relation-note">No incoming references in the visible sample.</p>'}<details class="evidence-details"><summary>What does a connection mean?</summary><p>A directed reference in a skill file, not a measured call or an execution path. The relationships and line numbers here are fictional examples.</p><p><code>${esc(source.repo)}/${esc(skill.path)}</code></p></details></div><footer class="inspector-footer"><button class="primary-button" data-action="read-selected">Read skill ${icon("arrow-right")}</button>${source.access === "propose" ? `<button class="secondary-button" data-action="edit-selected">${icon("edit")} Propose edit</button>` : ""}<small>Example content · nothing is connected to GitHub</small></footer>`;
  }
  const graph = $("#graph");
  let graphSize = { width: 0, height: 0 };
  let cameraFrame = 0,
    cameraReady = false;
  function moveCamera(next, animated = true) {
    cancelAnimationFrame(cameraFrame);
    if (!animated || !cameraReady || reduced.matches) {
      state.camera = next;
      updateCamera();
      cameraReady = true;
      return;
    }
    const start = { ...state.camera },
      time = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - time) / 360),
        ease = 1 - Math.pow(1 - t, 3);
      state.camera = {
        x: start.x + (next.x - start.x) * ease,
        y: start.y + (next.y - start.y) * ease,
        k: start.k + (next.k - start.k) * ease,
      };
      updateCamera();
      if (t < 1) cameraFrame = requestAnimationFrame(tick);
    };
    cameraFrame = requestAnimationFrame(tick);
  }
  function fitGraph(focusIds) {
    const rect = $("#map-area").getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    graphSize = { width: rect.width, height: rect.height };
    let targets = visibleSkills();
    if (focusIds) targets = targets.filter((skill) => focusIds.has(skill.id));
    else if (state.focusSource)
      targets = targets.filter((skill) => skill.source === state.focusSource);
    else if (state.selected) {
      const ids = new Set([state.selected]);
      relations(state.selected).forEach((r) => {
        ids.add(r.from);
        ids.add(r.to);
      });
      targets = targets.filter((skill) => ids.has(skill.id));
    }
    if (!targets.length) return;
    targets = targets.map(positionOf);
    const padding = state.selected || state.focusSource ? 90 : 72;
    const minX = Math.min(...targets.map((s) => s.x)) - padding,
      maxX = Math.max(...targets.map((s) => s.x)) + padding;
    const minY = Math.min(...targets.map((s) => s.y)) - padding,
      maxY = Math.max(...targets.map((s) => s.y)) + padding;
    const top = 103,
      bottom = 98;
    const k = Math.min(
      (rect.width - 65) / (maxX - minX),
      (rect.height - top - bottom) / (maxY - minY),
      2.2,
    );
    const next = {
      k: Math.max(0.12, k),
      x: rect.width / 2 - ((minX + maxX) / 2) * k,
      y: top + (rect.height - top - bottom) / 2 - ((minY + maxY) / 2) * k,
    };
    state.fitted = true;
    moveCamera(next);
  }
  function renderGraph() {
    const current = visibleSkills().map(positionOf),
      edges = visibleLinks();
    const rect = $("#map-area").getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    graphSize = { width: rect.width, height: rect.height };
    graph.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
    $("#graph-description").textContent = state.selected
      ? "A skill and its visible references."
      : `${current.length} skills · ${edges.length} sample references · ${state.visible.size} sources`;
    $("#graph-empty").hidden = current.length > 0;
    $("#graph-empty").innerHTML =
      `<div class="empty-orbit">${icon("map")}</div><h2>A little room to explore.</h2><p>Your sources are hidden. Show them again to bring the skills back into view.</p><button class="primary-button" data-action="show-all">Show all sources</button>`;
    graph.innerHTML = `<defs>${sources.map((s) => `<marker id="arrow-${s.id}" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 10 5 0 10" fill="${s.color}"/></marker>`).join("")}</defs><g class="camera">${sources
      .filter((s) => state.visible.has(s.id))
      .map(
        (s) =>
          `<circle class="source-halo" cx="${sourcePosition(s)[0]}" cy="${sourcePosition(s)[1]}" r="126" style="--source-color:${s.color}"/>`,
      )
      .join("")}<g class="edges">${edges
      .map((r) => {
        const a = positionOf(skillById(r.from)),
          b = positionOf(skillById(r.to)),
          s = sourceOf(a);
        return `<path class="graph-edge ${a.source !== b.source ? "is-cross" : ""}" data-from="${a.id}" data-to="${b.id}" d="M${a.x},${a.y} L${b.x},${b.y}" style="--source-color:${s.color}" marker-end="url(#arrow-${s.id})"/>`;
      })
      .join(
        "",
      )}</g><g class="nodes">${current.map((s, i) => `<g class="skill-node" role="button" tabindex="${state.selected ? (s.id === state.selected ? 0 : -1) : i === 0 ? 0 : -1}" aria-label="${esc(s.name)}, ${esc(sourceOf(s).name)}" data-node="${s.id}" transform="translate(${s.x} ${s.y})" style="--source-color:${sourceOf(s).color}"><circle class="node-ring" r="22"/><circle class="node-hit" r="17" fill="transparent"/><circle class="node-core" r="${6 + Math.min(relations(s.id).length, 7) * 1.5}"/></g>`).join("")}</g></g><g class="map-labels"></g>`;
    if (!state.fitted) fitGraph();
    else updateCamera();
    highlightGraph();
  }
  function updateCamera() {
    const { x, y, k } = state.camera;
    $(".camera", graph)?.setAttribute(
      "transform",
      `translate(${x} ${y}) scale(${k})`,
    );
    renderMapLabels();
  }
  function renderMapLabels() {
    const layer = $(".map-labels", graph);
    if (!layer) return;
    const { x, y, k } = state.camera,
      w = graphSize.width,
      h = graphSize.height;
    const focus = state.hover || state.selected;
    if (focus) {
      const ids = new Set([focus]);
      relations(focus).forEach((r) => {
        ids.add(r.from);
        ids.add(r.to);
      });
      const placed = [];
      layer.innerHTML = visibleSkills()
        .map(positionOf)
        .filter((s) => ids.has(s.id))
        .sort((a, b) => (a.id === focus ? -1 : b.id === focus ? 1 : a.y - b.y))
        .map((s) => {
          const px = s.x * k + x,
            py = s.y * k + y,
            width = s.name.length * 6.3;
          if (px < 0 || px > w || py < 75 || py > h - 68) return "";
          let tx = Math.max(15, Math.min(px + 16, w - width - 16)),
            ty = py + 4;
          let attempts = 0;
          while (
            placed.some(
              (p) =>
                Math.abs(p.y - ty) < 18 &&
                tx < p.x + p.w + 8 &&
                tx + width > p.x - 8,
            ) &&
            attempts++ < 8
          )
            ty += 18;
          ty = Math.min(h - 77, ty);
          placed.push({ x: tx, y: ty, w: width });
          return `<text class="node-label" x="${tx}" y="${ty}">${esc(s.name)}</text>`;
        })
        .join("");
    } else {
      layer.innerHTML = sources
        .filter((s) => state.visible.has(s.id))
        .map((s) => {
          const count = skills.filter((skill) => skill.source === s.id).length,
            width = s.name.length * 6.8 + 50;
          const center = sourcePosition(s),
            px = Math.max(
              width / 2 + 12,
              Math.min(w - width / 2 - 12, center[0] * k + x),
            ),
            py = Math.max(
              108,
              Math.min(h - 87, center[1] * k + y + 125 * k + 19),
            );
          return `<g class="cluster-label" role="button" tabindex="0" aria-label="Focus ${esc(s.name)}" data-focus-source="${s.id}" transform="translate(${px - width / 2} ${py - 14})"><rect width="${width}" height="29" rx="7"/><circle cx="13" cy="14" r="3" fill="${s.color}"/><text x="23" y="18">${esc(s.name)}<tspan class="label-count" dx="8">${count}</tspan></text></g>`;
        })
        .join("");
    }
  }
  function highlightGraph() {
    const focus = state.hover || state.selected;
    const adjacent = new Set(focus ? [focus] : []);
    if (focus)
      relations(focus).forEach((r) => {
        adjacent.add(r.from);
        adjacent.add(r.to);
      });
    $$(".skill-node", graph).forEach((el) => {
      el.classList.toggle("is-selected", el.dataset.node === state.selected);
      el.classList.toggle(
        "is-muted",
        Boolean(focus) && !adjacent.has(el.dataset.node),
      );
      el.setAttribute(
        "aria-pressed",
        String(el.dataset.node === state.selected),
      );
    });
    $$(".graph-edge", graph).forEach((el) => {
      const related =
        Boolean(focus) &&
        (el.dataset.from === focus || el.dataset.to === focus);
      el.classList.toggle("is-related", related);
      el.classList.toggle("is-muted", Boolean(focus) && !related);
    });
    renderMapLabels();
  }
  function zoom(factor, point) {
    cancelAnimationFrame(cameraFrame);
    const old = state.camera.k,
      next = Math.min(4, Math.max(0.16, old * factor));
    const p = point || { x: graphSize.width / 2, y: graphSize.height / 2 };
    state.camera = {
      k: next,
      x: p.x - ((p.x - state.camera.x) * next) / old,
      y: p.y - ((p.y - state.camera.y) * next) / old,
    };
    updateCamera();
  }
  let drag = null;
  graph.addEventListener("pointerdown", (event) => {
    if (
      event.button !== 0 ||
      event.target.closest("[data-node],[data-focus-source]")
    )
      return;
    cancelAnimationFrame(cameraFrame);
    drag = {
      pointer: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      camera: { ...state.camera },
      moved: false,
    };
    graph.setPointerCapture(event.pointerId);
    graph.classList.add("is-dragging");
  });
  graph.addEventListener("pointermove", (event) => {
    if (drag) {
      const dx = event.clientX - drag.x,
        dy = event.clientY - drag.y;
      drag.moved ||= Math.abs(dx) + Math.abs(dy) > 5;
      state.camera = {
        ...drag.camera,
        x: drag.camera.x + dx,
        y: drag.camera.y + dy,
      };
      updateCamera();
      return;
    }
    const node = event.target.closest("[data-node]"),
      id = node?.dataset.node || null;
    if (id !== state.hover) {
      state.hover = id;
      highlightGraph();
    }
    const tip = $("#graph-tooltip");
    tip.hidden = !id;
    if (id) {
      const skill = skillById(id),
        rect = graph.getBoundingClientRect();
      tip.innerHTML = `<strong>${esc(skill.name)}</strong><small>${esc(sourceOf(skill).name)} · ${relations(id).length} visible references</small>`;
      tip.style.left = `${Math.max(10, Math.min(event.clientX - rect.left + 14, rect.width - 240))}px`;
      tip.style.top = `${Math.max(85, Math.min(event.clientY - rect.top - 54, rect.height - 120))}px`;
    }
  });
  function endDrag(event) {
    if (drag) {
      if (graph.hasPointerCapture(event.pointerId))
        graph.releasePointerCapture(event.pointerId);
      drag = null;
      graph.classList.remove("is-dragging");
    }
  }
  graph.addEventListener("pointerup", endDrag);
  graph.addEventListener("pointercancel", endDrag);
  graph.addEventListener("pointerleave", () => {
    if (!drag) {
      state.hover = null;
      $("#graph-tooltip").hidden = true;
      highlightGraph();
    }
  });
  graph.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const r = graph.getBoundingClientRect();
      graph.classList.add("is-dragging");
      zoom(Math.exp(-event.deltaY * 0.0016), {
        x: event.clientX - r.left,
        y: event.clientY - r.top,
      });
      clearTimeout(graph.wheelTimer);
      graph.wheelTimer = setTimeout(
        () => graph.classList.remove("is-dragging"),
        100,
      );
    },
    { passive: false },
  );
  new ResizeObserver((entries) => {
    if (state.view !== "graph") return;
    const { width, height } = entries[0].contentRect;
    if (
      width &&
      height &&
      (Math.abs(width - graphSize.width) > 2 ||
        Math.abs(height - graphSize.height) > 2)
    ) {
      state.fitted = false;
      renderGraph();
    }
  }).observe($("#map-area"));

  // The renderer deliberately treats HTML and remote media as inert text.
  function markdown(raw) {
    const text = raw.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, "");
    const inline = (str) =>
      esc(str)
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    let list = null,
      code = false,
      output = "";
    const closeList = () => {
      if (list) {
        output += `</${list}>`;
        list = null;
      }
    };
    for (const line of text.split("\n")) {
      if (line.startsWith("```")) {
        closeList();
        output += code ? "</code></pre>" : '<pre class="source-code"><code>';
        code = !code;
        continue;
      }
      if (code) {
        output += esc(line) + "\n";
        continue;
      }
      const item = line.match(/^(\d+\. |[-*] )(.*)/);
      if (item) {
        const kind = /^\d/.test(item[1]) ? "ol" : "ul";
        if (list !== kind) {
          closeList();
          list = kind;
          output += `<${kind}>`;
        }
        output += `<li>${inline(item[2])}</li>`;
        continue;
      }
      closeList();
      if (!line.trim()) continue;
      const heading = line.match(/^(#{1,3}) (.+)/);
      if (heading) {
        const n = heading[1].length;
        output += `<h${n}>${inline(heading[2])}</h${n}>`;
      } else if (line.startsWith("> "))
        output += `<blockquote><p>${inline(line.slice(2))}</p></blockquote>`;
      else output += `<p>${inline(line)}</p>`;
    }
    closeList();
    if (code) output += "</code></pre>";
    return output;
  }
  function matches(skill, query) {
    return `${skill.name} ${skill.slug} ${skill.description} ${sourceOf(skill).name} ${skill.path} ${Object.values(skill.files).join(" ")}`
      .toLowerCase()
      .includes(query.toLowerCase());
  }
  function renderList() {
    const result = visibleSkills().filter((s) => matches(s, state.filter));
    result.sort((a, b) =>
      state.sort === "references"
        ? relations(b.id).length - relations(a.id).length ||
          a.name.localeCompare(b.name)
        : state.sort === "source"
          ? sourceOf(a).name.localeCompare(sourceOf(b).name) ||
            a.name.localeCompare(b.name)
          : a.name.localeCompare(b.name),
    );
    $("#library-count").textContent =
      result.length === skills.length
        ? result.length
        : `${result.length} / ${skills.length}`;
    $("#library-filter").value = state.filter;
    $("#library-sort").value = state.sort;
    $("#skill-list").innerHTML = result.length
      ? result
          .map(
            (s) =>
              `<button class="skill-row" data-skill="${s.id}" data-destination="library" style="--source-color:${sourceOf(s).color}" aria-current="${s.id === state.selected}"><span class="skill-row-title">${dot(sourceOf(s))}${esc(s.name)}</span><span class="skill-row-description">${esc(s.description)}</span><span class="skill-row-source">${sourceOf(s).access === "propose" ? icon("edit") : ""}${esc(sourceOf(s).name)}${state.sort === "references" ? ` · ${relations(s.id).length} refs` : ""}</span></button>`,
          )
          .join("")
      : `<div class="list-empty"><strong>${state.visible.size ? "No matches in this library." : "No sources are visible."}</strong><p>${state.visible.size ? "Try a shorter phrase or search by a file name." : "Show a source to start exploring its skills."}</p><button class="secondary-button" data-action="${state.visible.size ? "clear-filter" : "show-all"}">${state.visible.size ? "Clear filter" : "Show all sources"}</button></div>`;
  }
  function renderReader() {
    const skill = skillById(state.selected),
      reader = $("#reader"),
      library = $("#library-view");
    library.classList.toggle("is-reading", state.reading && Boolean(skill));
    library.classList.toggle("focus-reading", state.expanded);
    if (!skill) {
      reader.innerHTML = `<div class="reader-empty"><div class="empty-orbit">${icon("file")}</div><h2>A little context goes a long way.</h2><p>Choose a skill to read the complete instructions, inspect its files, and follow its references.</p></div>`;
      return;
    }
    const source = sourceOf(skill),
      editing = Boolean(state.editor);
    reader.innerHTML = `<div class="reader-topline"><div class="reader-back"><button class="text-button back-to-list" data-action="back-list">${icon("arrow-left")} Library</button><button class="text-button" data-action="back-graph">${icon("map")} Graph</button></div><div class="reader-actions">${!editing && source.access === "propose" ? `<button class="secondary-button" data-action="edit-selected">${icon("edit")} Propose edit</button>` : ""}<button class="icon-button expand-reader" data-action="expand-reader" aria-label="${state.expanded ? "Exit focused reading" : "Expand reader"}" aria-pressed="${state.expanded}">${icon(state.expanded ? "minimize" : "expand")}</button></div></div><header class="reader-title"><div class="reader-source-label">${dot(source)}${esc(source.name)} <span class="badge">${editing ? "Editing draft" : source.access === "propose" ? "Proposal demo" : "Read only"}</span></div><h2 id="reader-title" tabindex="-1">${esc(skill.name)}</h2><p>${esc(skill.description)}</p><div class="reader-provenance"><button class="text-button" data-action="source-info">${icon("repo")}${esc(source.repo)}</button><span>Example revision · not a live file</span></div></header>${
      editing
        ? editorHtml()
        : `<div class="reader-tabs" role="tablist" aria-label="Skill content">${[
            ["read", "Read"],
            ["source", "Source"],
            [
              "files",
              `Files <span class="muted">${Object.keys(skill.files).length}</span>`,
            ],
          ]
            .map(
              ([id, label]) =>
                `<button role="tab" id="tab-${id}" aria-controls="reader-content" aria-selected="${state.readerTab === id}" tabindex="${state.readerTab === id ? 0 : -1}" data-reader-tab="${id}">${label}</button>`,
            )
            .join(
              "",
            )}</div><div id="reader-content" role="tabpanel" aria-labelledby="tab-${state.readerTab}" tabindex="0" class="reader-scroll">${readerContent(skill)}</div><footer class="reader-bottom"><span>${esc(skill.path)}</span><button class="text-button" data-action="show-references">${relations(skill.id).length} references ${icon("arrow-right")}</button></footer>`
    }`;
  }
  function readerContent(skill) {
    if (state.readerTab === "read")
      return `<article class="markdown">${markdown(skill.markdown)}</article>`;
    if (state.readerTab === "source")
      return `<div class="source-toolbar"><span>Full file, including metadata</span><button class="text-button" data-action="copy-source">${icon("copy")} Copy</button></div><pre class="source-code">${esc(skill.markdown)}</pre>`;
    return `<div class="file-tree" aria-label="Skill folder">${Object.entries(
      skill.files,
    )
      .map(
        ([name, content]) =>
          `<button class="file-row" data-file="${esc(name)}" aria-current="${state.file === name}">${icon(name === "SKILL.md" ? "file" : "folder")}<span>${esc(name)}</span><small>${new TextEncoder().encode(content).length.toLocaleString()} B</small></button>`,
      )
      .join(
        "",
      )}</div><div class="source-toolbar"><span>${esc(state.file)}</span><button class="text-button" data-action="download-file">${icon("download")} Download example</button></div><article class="markdown">${markdown(skill.files[state.file] || "")}</article>`;
  }
  function beginEdit() {
    const skill = skillById(state.selected);
    if (!skill) return;
    if (sourceOf(skill).access !== "propose") {
      toast("This source is read only. No editor is available.");
      return;
    }
    state.view = "library";
    state.reading = true;
    state.editor = {
      id: skill.id,
      original: skill.markdown,
      draft: skill.markdown,
      mode: "source",
    };
    syncUrl();
    render();
    $("#draft")?.focus();
  }
  function draftError() {
    if (!state.editor) return "";
    const draft = state.editor.draft;
    if (!draft.trim()) return "Add the skill content before reviewing changes.";
    if (!/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.test(draft))
      return "Keep the opening metadata block between two lines of ---.";
    if (!/^name:\s*\S.+$/m.test(draft.split(/^---\s*$/m)[1] || ""))
      return "The metadata needs a non-empty name.";
    if (!/^#\s+\S/m.test(draft.replace(/^---\r?\n[\s\S]*?\r?\n---/, "")))
      return "Add a heading to the skill body, for example # Weekly review.";
    return "";
  }
  function editorHtml() {
    const editor = state.editor,
      dirty = editor.draft !== editor.original,
      error = draftError();
    return `<div class="editor-area"><div class="editor-notice">${icon("info")}<span>Local draft only. In the product, a proposal would require a fresh permission check and a reviewed diff.</span></div><div class="editor-mode"><button data-editor-mode="source" aria-pressed="${editor.mode === "source"}">Markdown</button><button data-editor-mode="preview" aria-pressed="${editor.mode === "preview"}">Preview</button><span class="badge warm">Demo · no GitHub writes</span></div>${editor.mode === "source" ? `<label class="sr-only" for="draft">Edit skill Markdown</label><textarea id="draft" spellcheck="false" aria-describedby="draft-error" aria-invalid="${Boolean(error)}">${esc(editor.draft)}</textarea>` : `<div class="editor-preview markdown">${markdown(editor.draft)}</div>`}<p id="draft-error" class="field-error" role="alert" ${error ? "" : "hidden"}>${esc(error)}</p></div><footer class="editor-footer"><small id="draft-status">${dirty ? "Unsaved local draft" : "No changes yet"} · <kbd>⌘ S</kbd> reviews</small><button class="secondary-button" data-action="cancel-edit">Cancel</button><button class="primary-button" data-action="review-draft" ${dirty && !error ? "" : "disabled"}>Review changes ${icon("arrow-right")}</button></footer>`;
  }
  function updateDraft(value) {
    state.editor.draft = value;
    const error = draftError(),
      dirty = value !== state.editor.original;
    $("#draft-error").textContent = error;
    $("#draft-error").hidden = !error;
    $("#draft").setAttribute("aria-invalid", String(Boolean(error)));
    $('[data-action="review-draft"]').disabled = !dirty || Boolean(error);
    $("#draft-status").innerHTML =
      `${dirty ? "Unsaved local draft" : "No changes yet"} · <kbd>⌘ S</kbd> reviews`;
  }
  function reviewDraft() {
    const ed = state.editor;
    if (!ed || draftError() || ed.draft === ed.original) return;
    const before = ed.original.split("\n"),
      after = ed.draft.split("\n");
    const diff = (lines, other, type) =>
      lines
        .map(
          (line, i) =>
            `<span class="diff-line ${line !== other[i] ? type : ""}"><span class="diff-number">${i + 1}</span>${esc(line) || " "}</span>`,
        )
        .join("");
    dialog(
      "Review your changes",
      `<p class="dialog-intro">${esc(skillById(ed.id).name)} · <code>${esc(sourceOf(skillById(ed.id)).repo)}</code></p><div class="notice-box">Design preview. This compares a local draft with the original example. It cannot create a branch, commit, or pull request.</div><div class="diff-columns"><div class="diff-column"><h3>Original</h3><pre>${diff(before, after, "removed")}</pre></div><div class="diff-column"><h3>Your draft</h3><pre>${diff(after, before, "added")}</pre></div></div>`,
      `<button class="secondary-button" data-close="detail-dialog">Keep editing</button><button class="primary-button" data-action="simulate-proposal">Preview proposal step ${icon("arrow-right")}</button>`,
    );
    const changed = after.findIndex((line, i) => line !== before[i]);
    requestAnimationFrame(() => {
      $$(".diff-column pre").forEach((pre) => {
        const lines = $$(".diff-line", pre),
          line = lines[Math.min(Math.max(0, changed - 3), lines.length - 1)];
        if (line) pre.scrollTop = line.offsetTop - pre.offsetTop - 12;
      });
    });
  }
  function proposalPreview() {
    dialog(
      "Ready for the proposal step",
      `<div class="completion-mark">${icon("check")}</div><p class="dialog-intro">Your local draft has been compared with the example revision. No pull request was created.</p><dl class="info-grid"><dt>Next in product</dt><dd>Recheck your access and the source revision, then ask you to confirm the exact proposed change.</dd><dt>If access changed</dt><dd>Keep the draft available to copy. Explain why the proposal cannot continue.</dd><dt>This preview</dt><dd>No account, remote write, or saved draft. Reloading clears the draft.</dd></dl>`,
      `<button class="secondary-button" data-action="copy-draft">${icon("copy")} Copy draft</button><button class="primary-button" data-close="detail-dialog">Back to draft</button>`,
    );
  }
  async function copyText(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      toast(label);
    } catch {
      toast(
        "Clipboard is unavailable here. You can select and copy the source text.",
      );
    }
  }
  function usageFixture() {
    const covered = new Set(["global", "aios", "project", "personal"]),
      factor = state.period / 30;
    const rows = visibleSkills().map((s) => {
      const i = skills.indexOf(s);
      return {
        skill: s,
        runs:
          covered.has(s.source) && i % 7 !== 0
            ? Math.max(1, Math.round((13 + ((i * 29) % 173)) * factor))
            : 0,
        known: covered.has(s.source),
      };
    });
    return {
      covered,
      rows,
      active: rows.filter((r) => r.runs > 0).sort((a, b) => b.runs - a.runs),
      total: rows.reduce((n, r) => n + r.runs, 0),
    };
  }
  function healthHtml() {
    const rows = [
      [
        "graph-list",
        "grid",
        "Visible skills",
        "The same source scope as Graph and Library",
        visibleSkills().length,
      ],
      [
        "reference-map",
        "overlap",
        "File references",
        "Directed links, separate from possible overlaps",
        visibleLinks().length,
      ],
      [
        "overlaps",
        "eye",
        "Possible overlaps",
        "Inspect the evidence; nothing is merged or removed",
        AtlasData.overlaps.filter((o) =>
          o.ids.every((id) => state.visible.has(skillById(id).source)),
        ).length,
      ],
      [
        "manage-sources",
        "repo",
        "Visible sources",
        "Example repositories, each with its own identity",
        state.visible.size,
      ],
    ];
    return `<div class="usage-section-head"><h2>Library health</h2><span>Example repository data</span></div>${rows.map(([action, name, title, desc, n]) => `<button class="health-row" data-action="${action}">${icon(name)}<span><strong>${title}</strong><small>${desc}</small></span><span class="health-value">${n}</span><span class="health-arrow">${icon("arrow-right")}</span></button>`).join("")}`;
  }
  function renderUsage() {
    const fixture = usageFixture();
    const header = `<div class="usage-heading"><div><h1>Usage</h1><p>See what is known. Keep the gaps visible.</p></div>${state.sampleUsage ? `<label><span class="sr-only">Sample activity period</span><select id="usage-period" class="usage-period"><option value="7" ${state.period === 7 ? "selected" : ""}>Last 7 days</option><option value="30" ${state.period === 30 ? "selected" : ""}>Last 30 days</option><option value="90" ${state.period === 90 ? "selected" : ""}>Last 90 days</option></select></label>` : `<button class="quiet-button" data-action="sample-usage">${icon("eye")} Explore sample activity</button>`}</div>`;
    if (!state.sampleUsage) {
      $("#usage-view").innerHTML =
        `<div class="usage-content">${header}<div class="connection-notice"><div class="notice-icon">${icon("activity")}</div><div><h2>Activity is not connected.</h2><p>Your skills are available to explore. Atlas does not yet know when they were used. Missing events are not the same as zero use.</p><button class="text-button" data-action="usage-connection">How tracking would work ${icon("arrow-right")}</button></div></div>${healthHtml()}<p class="usage-footnote">This design study uses fictional library data. Live usage remains disconnected in the current product.</p></div>`;
      return;
    }
    const top = fixture.active.slice(0, 10),
      max = top[0]?.runs || 1;
    const coverage = sources.filter((s) => state.visible.has(s.id));
    $("#usage-view").innerHTML =
      `<div class="usage-content">${header}<div class="sample-notice">${icon("info")}<span>Fictional activity · ${state.period}-day sample · no real events collected</span><button data-action="hide-sample">Return to unconnected state</button></div><div class="metric-row"><div class="metric"><strong>${fixture.total.toLocaleString()}</strong><span>sample runs</span></div><div class="metric"><strong>${fixture.active.length}<span class="metric-denominator"> / ${visibleSkills().length}</span></strong><span>skills observed</span></div><div class="metric"><strong>${coverage.filter((s) => fixture.covered.has(s.id)).length}<span class="metric-denominator"> / ${coverage.length}</span></strong><span>sources with sample events</span></div></div><div class="usage-section-head"><h2>Most used skills</h2><span>In this sample</span></div>${top.length ? top.map((r, i) => `<button class="usage-row" data-skill="${r.skill.id}" data-destination="library" style="--source-color:${sourceOf(r.skill).color}"><span class="rank">${String(i + 1).padStart(2, "0")}</span><span><strong>${esc(r.skill.name)}</strong><small class="usage-source">${esc(sourceOf(r.skill).name)}</small></span><span class="bar-track" aria-hidden="true"><span style="width:${(r.runs / max) * 100}%;--bar-order:${i}"></span></span><span class="runs">${r.runs}</span><time>${i + 1}h ago</time></button>`).join("") : '<p class="usage-subtitle">No sample events for the selected sources.</p>'}<div class="usage-section-head"><h2>Tracking coverage</h2><span>${coverage.length} visible sources</span></div><p class="usage-subtitle">Counts only make sense alongside their coverage.</p>${coverage.map((s) => `<div class="coverage-row"><span>${dot(s)}${esc(s.name)}</span><small>${fixture.covered.has(s.id) ? "Sample events available" : "No events · usage unknown"}</small></div>`).join("")}<div class="usage-section-head"><h2>Not observed in this sample</h2></div><p class="usage-subtitle">No deletion recommendation. Check collection coverage and the job these skills serve.</p><div class="quiet-skills">${
        fixture.rows
          .filter((r) => !r.runs)
          .slice(0, 8)
          .map(
            (r) =>
              `<button data-skill="${r.skill.id}" data-destination="library">${dot(sourceOf(r.skill))}${esc(r.skill.name)}</button>`,
          )
          .join("") ||
        '<span class="small muted">Every visible skill appears in this sample.</span>'
      }</div><div class="usage-section-head"><h2>Recent activity</h2><span>Fictional sequence</span></div>${top
        .slice(0, 6)
        .map(
          (r, i) =>
            `<button class="activity-row" data-skill="${r.skill.id}" data-destination="library">${dot(sourceOf(r.skill))}<span><strong>${esc(r.skill.name)}</strong><br>${esc(sourceOf(r.skill).name)} · example session</span><time>${i + 1}h ago ${icon("arrow-right")}</time></button>`,
        )
        .join(
          "",
        )}${healthHtml()}<p class="usage-footnote">All numbers, times, and events on this screen are generated examples. Changing the period switches the example totals; it does not query a tracking service.</p></div>`;
  }
  function searchResults() {
    const query = $("#global-search").value.trim(),
      all = visibleSkills().filter((s) => matches(s, query));
    all.sort((a, b) => {
      const aa = a.name.toLowerCase().startsWith(query.toLowerCase()),
        bb = b.name.toLowerCase().startsWith(query.toLowerCase());
      return Number(bb) - Number(aa) || a.name.localeCompare(b.name);
    });
    state.searchMatches = all.slice(0, 8);
    state.searchIndex = Math.max(
      0,
      Math.min(state.searchIndex, state.searchMatches.length - 1),
    );
    $("#search-scope").textContent =
      `${state.visible.size} visible sources · ${query ? `${all.length} matches${all.length > 8 ? " · first 8 shown" : ""}` : "Search names, descriptions, paths, and file contents"}`;
    const highlight = (value) => {
      if (!query) return esc(value);
      const at = value.toLowerCase().indexOf(query.toLowerCase());
      return at < 0
        ? esc(value)
        : `${esc(value.slice(0, at))}<mark>${esc(value.slice(at, at + query.length))}</mark>${esc(value.slice(at + query.length))}`;
    };
    $("#search-results").innerHTML = state.searchMatches.length
      ? state.searchMatches
          .map((s, i) => {
            let context = s.description;
            if (query && !context.toLowerCase().includes(query.toLowerCase())) {
              const allText =
                `${s.path} ${Object.values(s.files).join(" ")}`.replace(
                  /\s+/g,
                  " ",
                );
              const at = allText.toLowerCase().indexOf(query.toLowerCase());
              if (at >= 0)
                context = `${at > 30 ? "…" : ""}${allText.slice(Math.max(0, at - 30), at + 100)}…`;
            }
            return `<div role="option" id="result-${i}" class="search-result" data-search-result="${i}" aria-selected="${i === state.searchIndex}">${dot(sourceOf(s))}<span><strong>${highlight(s.name)}</strong><small>${esc(sourceOf(s).name)} · ${esc(s.path)}</small><small class="search-match">${highlight(context)}</small></span>${icon("arrow-right")}</div>`;
          })
          .join("")
      : `<div class="search-no-results"><strong>${state.visible.size ? "Nothing matched that search." : "No sources are visible."}</strong><p>${state.visible.size ? "Try a shorter phrase or the name of a source." : "Close search and show a source to continue."}</p></div>`;
    if (state.searchMatches.length)
      $("#global-search").setAttribute(
        "aria-activedescendant",
        `result-${state.searchIndex}`,
      );
    else $("#global-search").removeAttribute("aria-activedescendant");
  }
  function openSearch() {
    closeSources(false);
    $("#profile-dialog").close();
    state.searchIndex = 0;
    $("#global-search").value = "";
    searchResults();
    $("#search-dialog").showModal();
    $("#global-search").focus();
  }
  function selectSearch(index) {
    const skill = state.searchMatches[index];
    if (!skill) return;
    $("#search-dialog").close();
    navigate("library", skill.id, { focusReader: true });
  }

  function profile() {
    const el = $("#profile-dialog");
    el.innerHTML = `<header class="profile-menu-head"><span class="avatar">GA</span><div><h2 id="profile-title">Gustav Anderson</h2><p>Example profile · not signed in</p></div><button class="icon-button" data-close="profile-dialog" aria-label="Close profile menu">${icon("close")}</button></header><button class="menu-item" data-action="account">${icon("lock")} Account & access <small>Demo</small></button><button class="menu-item" data-action="agent">${icon("agent")} Connect your agent ${icon("arrow-up")}</button><div class="menu-section-label">Appearance</div><div class="appearance-options" role="group" aria-label="Appearance">${["light", "dark", "system"].map((theme) => `<button data-theme="${theme}" aria-pressed="${state.theme === theme}">${theme[0].toUpperCase() + theme.slice(1)}</button>`).join("")}</div><div class="menu-separator"></div><button class="menu-item" data-action="onboarding">${icon("map")} Try the new onboarding</button><button class="menu-item" data-action="replay-loading">${icon("refresh")} Replay loading</button><button class="menu-item" data-action="about">${icon("info")} About this design study</button>`;
    if (!el.open) el.showModal();
    $("#profile-trigger").setAttribute("aria-expanded", "true");
  }
  function about() {
    dialog(
      "A familiar Atlas. A clearer flow.",
      `<p class="dialog-intro">A local design study for Online Sourdough, informed by the interaction patterns in <a href="https://skill-atlas-preview.vercel.app/" target="_blank" rel="noreferrer">Remi’s Atlas preview</a>.</p><ul class="about-list"><li>Our warm palette, Geist type, repository sources, and evidence-based graph.</li><li>A compact header, contextual inspector, file browser, and connected reading flow.</li><li>Bottom-left profile, quieter motion, and sequential mobile screens.</li><li>44 fictional skills, 6 example sources, and 40 sample references at the initial state.</li></ul><div class="notice-box">No sign-in, repository requests, tracking, or remote writes. Changes to sources, theme, and drafts last only for this page session. Reload to reset them.</div>`,
      `<button class="secondary-button" data-action="replay-loading">Replay loading</button><button class="primary-button" data-action="onboarding">Try onboarding ${icon("arrow-right")}</button>`,
    );
  }
  function account() {
    dialog(
      "Account & access",
      `<p class="dialog-intro">Keep the account simple. Make permissions visible when they matter.</p><dl class="info-grid"><dt>Identity</dt><dd>Example profile for Gustav. No GitHub login has taken place.</dd><dt>Repositories</dt><dd>In the current product, both your account and the Atlas app need access. A repository being visible to you is not enough on its own.</dd><dt>Skill changes</dt><dd>The active product is read only. This study explores a future edit-proposal interface without enabling writes.</dd><dt>Agent access</dt><dd>Separate read-only consent. Connecting an agent does not grant permission to edit repositories.</dd></dl><p>In the product, disconnecting an agent, signing out of this browser, and signing out everywhere remain distinct actions.</p>`,
      `<button class="secondary-button" data-close="detail-dialog">Done</button><button class="primary-button" data-action="preview-auth">Preview sign-in flow</button>`,
    );
  }
  function agentInfo() {
    dialog(
      "Your atlas, in your agent.",
      `<div class="agent-emblem">${icon("agent")}</div><p class="dialog-intro">Let your agent find and read the skills you have chosen. Keep the conversation in the tool you already use.</p><ol class="setup-list"><li><strong>Add the Atlas connection</strong><span>Use the endpoint supplied by your own Atlas deployment.</span></li><li><strong>Sign in and review access</strong><span>Approve read access to your selected sources. GitHub write access is not included.</span></li><li><strong>Open the evidence</strong><span>Ask the agent to find a skill, then follow its link back to the same file and source in Atlas.</span></li></ol><div class="notice-box">This is the proposed UI around the existing read-only MCP direction. No endpoint is active in this prototype and no client is connected.</div>`,
      `<button class="primary-button" data-close="detail-dialog">Got it</button>`,
    );
  }
  function usageConnection() {
    dialog(
      "Know what the numbers cover.",
      `<p class="dialog-intro">Usage needs an explicit event source. Reading a skill in Atlas is not proof that an agent used it.</p><ol class="setup-list"><li><strong>Choose an event source</strong><span>Explain which client or session emits events, what is collected, and when collection starts.</span></li><li><strong>Confirm the first event</strong><span>Show a test event, the skill identity, timestamp, and source before displaying totals.</span></li><li><strong>Keep coverage beside the chart</strong><span>Expose missing or stale collection. “Not observed” is different from “never used”.</span></li></ol><div class="notice-box">This integration is not implemented in the current Atlas. The sample activity screen demonstrates the layout only.</div>`,
      `<button class="primary-button" data-action="sample-usage">Explore sample activity ${icon("arrow-right")}</button>`,
    );
  }
  function sourceInfo() {
    const skill = skillById(state.selected);
    if (!skill) return;
    const s = sourceOf(skill);
    dialog(
      "Source & provenance",
      `<p class="dialog-intro">${dot(s)} ${esc(s.name)}</p><dl class="info-grid"><dt>Repository</dt><dd><code>${esc(s.repo)}</code></dd><dt>Skill identity</dt><dd><code>${esc(skill.id)}</code></dd><dt>File</dt><dd><code>${esc(skill.path)}</code></dd><dt>Revision</dt><dd>Fictional example. In the product, show the exact inspected revision and sync status.</dd><dt>Access</dt><dd>${s.access === "propose" ? "Proposal interface available in the demo. No actual write permission is claimed." : "Read only. No edit action is offered."}</dd><dt>Connections</dt><dd>Sample file references with explicit direction. Not inferred agent executions.</dd></dl>`,
      `<button class="primary-button" data-close="detail-dialog">Done</button>`,
    );
  }
  function overlaps() {
    const current = AtlasData.overlaps.filter((o) =>
      o.ids.every((id) => state.visible.has(skillById(id).source)),
    );
    dialog(
      "Possible overlaps",
      `<p class="dialog-intro">Similar names can be useful clues. They do not make two skills interchangeable.</p>${
        current
          .map(
            (o) =>
              `<details class="overlap-group" open><summary>${esc(o.reason)} <span class="badge">${esc(o.strength)}</span></summary><div class="overlap-members">${o.ids
                .map((id) => {
                  const s = skillById(id);
                  return `<button class="overlap-member" data-skill="${id}" data-destination="library">${dot(sourceOf(s))}<span><strong>${esc(s.name)}</strong><small>${esc(sourceOf(s).name)} · ${esc(s.path)}</small></span></button>`;
                })
                .join(
                  "",
                )}<p>Compare the purpose, scope, and instructions. Keep both source identities intact.</p></div></details>`,
          )
          .join("") ||
        '<div class="notice-box">No overlap examples within the currently visible sources.</div>'
      }`,
      `<span class="footnote">Illustrative matches · no merge or deletion</span><button class="primary-button" data-close="detail-dialog">Done</button>`,
    );
  }
  function manageSources() {
    dialog(
      "Your sources",
      `<p class="dialog-intro">Show the libraries you want to explore together. Hiding a source does not remove any files.</p>${sources.map((s) => `<label class="source-management-row" style="--source-color:${s.color}">${dot(s)}<span><strong>${esc(s.name)}</strong><small>${esc(s.repo)} · ${skills.filter((skill) => skill.source === s.id).length} example skills</small></span><input type="checkbox" data-source="${s.id}" ${state.visible.has(s.id) ? "checked" : ""} aria-label="Show ${esc(s.name)}"></label>`).join("")}`,
      `<button class="secondary-button" data-action="add-source">${icon("plus")} Add a source</button><button class="primary-button" data-close="detail-dialog">Done</button>`,
    );
  }
  function addSource() {
    clearTimeout(state.importTimer);
    state.importRepo = null;
    dialog(
      "Add a source",
      `<p class="dialog-intro">Start with a repository. Inspect what Atlas would add before it becomes part of your workspace.</p><form id="import-form"><label class="field-label" for="repo-input">GitHub repository</label><input id="repo-input" class="form-input" placeholder="owner/repository" autocomplete="off" aria-describedby="repo-help repo-error"><p id="repo-help" class="form-help">Design demo: any valid new name previews three fictional files. Nothing is fetched.</p><p id="repo-error" class="field-error" role="alert" hidden></p><div class="form-actions"><button class="primary-button" type="submit">Preview example ${icon("arrow-right")}</button></div></form><div id="import-result" aria-live="polite"></div>`,
      `<span class="footnote">No account or access is implied.</span><button class="secondary-button" data-close="detail-dialog">Cancel</button>`,
    );
    $("#repo-input").focus();
  }
  function previewImport() {
    const input = $("#repo-input");
    let repo = input.value
      .trim()
      .replace(/^https:\/\/github\.com\//i, "")
      .replace(/\/$/, "");
    const valid =
      /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9_.-]{1,100}$/.test(repo) &&
      !repo.endsWith("/.") &&
      !repo.endsWith("/..");
    const error = !valid
      ? "Use a GitHub repository URL or owner/repository."
      : sources.some((s) => s.repo.toLowerCase() === repo.toLowerCase())
        ? "That source is already in this example workspace."
        : null;
    $("#repo-error").hidden = !error;
    $("#repo-error").textContent = error || "";
    input.setAttribute("aria-invalid", String(Boolean(error)));
    if (error) {
      input.focus();
      return;
    }
    const button = $('button[type="submit"]', $("#import-form"));
    button.disabled = true;
    input.disabled = true;
    $("#import-result").innerHTML =
      '<div class="import-preview"><div class="skeleton-line"></div><div class="skeleton-line short"></div><p>Preparing a local example preview…</p></div>';
    clearTimeout(state.importTimer);
    state.importTimer = setTimeout(
      () => {
        if (!$("#import-result") || !$("#detail-dialog").open) return;
        state.importRepo = repo;
        button.disabled = false;
        input.disabled = false;
        $("#import-result").innerHTML =
          `<div class="import-preview"><strong>${esc(repo)}</strong><p>3 fictional skills · 1 example shelf · read only</p><p>Sample revision only. A real import must recheck account access and the same revision when you confirm.</p><ul class="import-files"><li>skills/plan/SKILL.md</li><li>skills/build/SKILL.md</li><li>skills/review/SKILL.md</li></ul><button class="primary-button" data-action="confirm-import">Add example to this preview</button></div>`;
      },
      reduced.matches ? 20 : 750,
    );
  }
  function confirmImport() {
    const repo = state.importRepo;
    if (
      !repo ||
      sources.some((s) => s.repo.toLowerCase() === repo.toLowerCase())
    )
      return;
    const id = `example-${sources.length + 1}`,
      s = {
        id,
        name: repo.split("/")[1],
        repo,
        color: "#477a87",
        center: [1220, 620],
        access: "read",
        kind: "Added example source",
      };
    sources.push(s);
    ["Plan", "Build", "Review"].forEach((name, i) => {
      const slug = name.toLowerCase(),
        body = `# ${name}\n\nA fictional skill added through the design preview.\n\n## Purpose\n\nExplore how a new source joins the library.\n\nNo content was fetched from ${repo}.`,
        content = `---\nname: ${slug}\ndescription: Fictional imported example\n---\n\n${body}`;
      skills.push({
        id: `${id}:${slug}`,
        slug,
        name,
        description: "A fictional skill added through the source preview.",
        source: id,
        category: "Example",
        path: `skills/${slug}/SKILL.md`,
        x: s.center[0] + Math.cos(i * 2.1) * 50,
        y: s.center[1] + Math.sin(i * 2.1) * 50,
        markdown: content,
        body,
        files: { "SKILL.md": content },
      });
    });
    state.visible.add(id);
    state.importRepo = null;
    state.focusSource = null;
    state.selected = null;
    state.view = "graph";
    state.fitted = false;
    $("#detail-dialog").close();
    syncUrl();
    render();
    toast("Example source added. No repository was contacted.");
  }
  function startOnboarding() {
    guard(() => {
      closeSources(false);
      state.onboardStep = 0;
      state.onboardSources = new Set(["global", "aios"]);
      renderOnboarding();
    });
  }
  function constellation() {
    return `<div class="onboard-constellation" aria-hidden="true"><div class="constellation-line l1"></div><div class="constellation-line l2"></div><div class="constellation-line l3"></div><span class="onboard-node n1"></span><span class="onboard-node n2"></span><span class="onboard-node n3"></span><span class="onboard-node n4"></span><span class="onboard-node n5"></span><span class="onboard-node n6"></span><div class="onboard-map-center">${icon("map")}</div><span class="onboard-map-label label-one">Your skills</span><span class="onboard-map-label label-two">Their context</span><span class="onboard-map-label label-three">One place</span></div>`;
  }
  function renderOnboarding() {
    const step = state.onboardStep,
      chosen = skills.filter((s) => state.onboardSources.has(s.source));
    const progress = `<ol class="onboard-progress" aria-label="Onboarding progress">${["Start", "Choose sources", "Explore"].map((name, i) => `<li ${step === i ? 'aria-current="step"' : ""} class="${i < step ? "done" : ""}"><span>${i < step ? icon("check") : i + 1}</span>${name}</li>`).join("")}</ol>`;
    let body, footer;
    if (step === 0) {
      body = `<div class="onboard-welcome">${constellation()}<span class="eyebrow">WELCOME TO YOUR ATLAS</span><h3>Know what you have.<br>Find what you need.</h3><p>Your skills, their instructions, and the connections between them. A map for exploring. A library for getting to work.</p><div class="onboard-promises"><span>${icon("eye")} Read-first by default</span><span>${icon("repo")} Sources stay distinct</span></div></div>`;
      footer = `<button class="text-button" data-action="preview-auth">How GitHub access works</button><button class="primary-button" data-action="onboard-next">Start with an example ${icon("arrow-right")}</button>`;
    } else if (step === 1) {
      body = `<p class="dialog-intro">Choose a useful starting point. You can add more sources later; you do not need to organise everything first.</p><div class="onboard-source-grid">${sources
        .filter((s) => !s.id.startsWith("example-"))
        .map(
          (s) =>
            `<label class="onboard-source ${state.onboardSources.has(s.id) ? "is-chosen" : ""}" style="--source-color:${s.color}"><input type="checkbox" data-onboard-source="${s.id}" ${state.onboardSources.has(s.id) ? "checked" : ""}>${dot(s)}<strong>${esc(s.name)}</strong><small>${skills.filter((skill) => skill.source === s.id).length} example skills · ${esc(s.kind)}</small></label>`,
        )
        .join(
          "",
        )}</div><div class="onboard-selection-summary" id="onboard-summary">${chosen.length} example skills from ${state.onboardSources.size} sources</div><p class="form-help">These are fictional sources. Private access is never assumed from a name or a checkbox.</p>`;
      footer = `<button class="text-button" data-action="onboard-back">${icon("arrow-left")} Back</button><button id="onboard-continue" class="primary-button" data-action="onboard-next" ${chosen.length ? "" : "disabled"}>Preview your atlas ${icon("arrow-right")}</button>`;
    } else {
      const refCount = links.filter(
        (r) =>
          state.onboardSources.has(skillById(r.from).source) &&
          state.onboardSources.has(skillById(r.to).source),
      ).length;
      body = `<div class="onboard-ready"><div class="completion-mark">${icon("check")}</div><h3>Your starting point is ready.</h3><p>${chosen.length} example skills. ${state.onboardSources.size} sources. ${refCount} references to explore.</p></div><div class="first-skill-card"><div>${dot(sourceOf(chosen[0]))}<span class="eyebrow">A GOOD PLACE TO START</span></div><h3>${esc(chosen[0].name)}</h3><p>${esc(chosen[0].description)}</p><small>${esc(sourceOf(chosen[0]).name)} · full instructions + supporting files</small></div><div class="onboard-next-steps"><span>${icon("map")} Click a node to see its context.</span><span>${icon("search")} Use <kbd>⌘ K</kbd> to find a phrase or file.</span><span>${icon("agent")} Connect your agent when you need it.</span></div>`;
      footer = `<button class="text-button" data-action="onboard-back">${icon("arrow-left")} Change sources</button><button class="secondary-button" data-action="finish-onboarding" data-open="graph">Open the map</button><button class="primary-button" data-action="finish-onboarding" data-open="library">Read the first skill ${icon("arrow-right")}</button>`;
    }
    dialog(
      step === 0
        ? "Make yourself at home."
        : step === 1
          ? "What belongs in your atlas?"
          : "A small start. A useful view.",
      `${progress}<div class="onboard-stage" key="${step}">${body}</div>`,
      footer,
    );
    $("#detail-dialog").classList.add("onboarding-dialog");
    $(".dialog-heading button", $("#detail-dialog")).setAttribute(
      "aria-label",
      "Skip onboarding",
    );
  }
  function previewAuth(denied = false) {
    dialog(
      denied ? "This account cannot access Atlas." : "Continue with GitHub",
      `<div class="auth-preview-brand"><img src="assets/atlas-icon.png" width="42" height="42" alt=""><span>Skill Atlas</span></div><p class="dialog-intro">${denied ? "No workspace has been opened. Try the intended account or ask the Atlas operator to check access." : "Your source choices belong to your profile. Atlas only reads repositories that both your account and the app are allowed to access."}</p>${denied ? '<div class="notice-box">Example denied state. Your existing draft and sources are not replaced by a different account.</div>' : '<dl class="info-grid"><dt>You approve</dt><dd>Signing in to this Atlas and reading authorised source content.</dd><dt>You do not approve</dt><dd>Repository changes, agent access, or usage tracking. Those are separate decisions.</dd></dl>'}<p class="form-help">Sign-in preview only. No OAuth flow, credentials, or account request is started.</p>`,
      `<button class="text-button" data-action="${denied ? "preview-auth" : "auth-denied"}">${denied ? "Back to sign-in" : "Preview denied access"}</button><button class="primary-button" data-action="auth-example">${denied ? "Try example access" : "Continue with example access"} ${icon("arrow-right")}</button>`,
    );
  }
  function finishOnboarding(view) {
    closeSources(false);
    state.visible = new Set(state.onboardSources);
    const first = visibleSkills()[0];
    state.selected = view === "library" ? first?.id : null;
    state.view = view;
    state.reading = view === "library";
    state.readerTab = "read";
    state.file = "SKILL.md";
    state.fitted = false;
    $("#detail-dialog").close();
    syncUrl();
    render();
    toast("Your example atlas is ready. Reopen the guide from your profile.");
    if (view === "library") $("#reader-title")?.focus();
  }
  function playLoading(onFinish) {
    clearTimeout(state.loadingTimer);
    $$("dialog[open]").forEach((d) => d.close());
    $("#boot").hidden = false;
    $("#boot").classList.remove("is-leaving");
    $("#app").inert = true;
    state.loadingTimer = setTimeout(
      () => {
        $("#app").inert = false;
        $("#boot").classList.add("is-leaving");
        render();
        state.loadingTimer = setTimeout(
          () => {
            $("#boot").hidden = true;
            onFinish?.();
          },
          reduced.matches ? 0 : 260,
        );
      },
      reduced.matches ? 30 : 1150,
    );
  }
  function openSources() {
    if (!mobile.matches) return;
    state.drawer = true;
    $("#sources-rail").classList.add("is-open");
    $("#drawer-scrim").hidden = false;
    updateDrawerAccess();
    $('[data-action="close-sources"]').focus();
  }
  function closeSources(restore = true) {
    const wasOpen = state.drawer;
    state.drawer = false;
    $("#sources-rail").classList.remove("is-open");
    $("#drawer-scrim").hidden = true;
    updateDrawerAccess();
    if (wasOpen && restore) $('[data-action="open-sources"]').focus();
  }
  function updateDrawerAccess() {
    const rail = $("#sources-rail");
    rail.inert = mobile.matches && !state.drawer;
    $("#workspace").inert = mobile.matches && state.drawer;
    $(".topbar").inert = mobile.matches && state.drawer;
    if (mobile.matches && state.drawer) {
      rail.setAttribute("role", "dialog");
      rail.setAttribute("aria-modal", "true");
    } else {
      rail.removeAttribute("role");
      rail.removeAttribute("aria-modal");
    }
  }
  function setTheme(theme) {
    state.theme = theme;
    document.body.dataset.theme =
      theme === "system" ? (systemDark.matches ? "dark" : "light") : theme;
    $$("[data-theme]")
      .filter((el) => el.tagName === "BUTTON")
      .forEach((el) =>
        el.setAttribute("aria-pressed", String(el.dataset.theme === theme)),
      );
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest(".skip-link")) {
      event.preventDefault();
      $("#workspace").focus();
      return;
    }
    const close = event.target.closest("[data-close]");
    if (close) {
      $(`#${close.dataset.close}`)?.close();
      return;
    }
    const view = event.target.closest("[data-view]");
    if (view) {
      navigate(view.dataset.view);
      return;
    }
    const selected = event.target.closest("[data-skill]");
    if (selected) {
      $$("dialog[open]").forEach((d) => d.close());
      navigate(
        selected.dataset.destination || "library",
        selected.dataset.skill,
        { focusReader: selected.dataset.destination !== "graph" },
      );
      return;
    }
    const node = event.target.closest("[data-node]");
    if (node) {
      state.hover = null;
      $("#graph-tooltip").hidden = true;
      navigate("graph", node.dataset.node, { focusMap: true });
      $("#inspector-title")?.focus();
      return;
    }
    const cluster = event.target.closest("[data-focus-source]");
    if (cluster) {
      state.focusSource = cluster.dataset.focusSource;
      state.selected = null;
      state.fitted = false;
      render();
      syncUrl();
      return;
    }
    const result = event.target.closest("[data-search-result]");
    if (result) {
      selectSearch(Number(result.dataset.searchResult));
      return;
    }
    const tab = event.target.closest("[data-reader-tab]");
    if (tab) {
      state.readerTab = tab.dataset.readerTab;
      renderReader();
      $(`#tab-${state.readerTab}`)?.focus();
      return;
    }
    const file = event.target.closest("[data-file]");
    if (file) {
      state.file = file.dataset.file;
      renderReader();
      $(`[data-file="${CSS.escape(state.file)}"]`)?.focus();
      return;
    }
    const mode = event.target.closest("[data-editor-mode]");
    if (mode) {
      state.editor.mode = mode.dataset.editorMode;
      renderReader();
      $(`[data-editor-mode="${state.editor.mode}"]`)?.focus();
      return;
    }
    const theme = event.target.closest("button[data-theme]");
    if (theme) {
      setTheme(theme.dataset.theme);
      return;
    }
    const action = event.target.closest("[data-action]");
    if (!action) return;
    const handlers = {
      search: openSearch,
      profile: profile,
      about: about,
      account: account,
      agent: agentInfo,
      "usage-connection": usageConnection,
      "open-sources": openSources,
      "close-sources": closeSources,
      "manage-sources": manageSources,
      "add-source": () => guard(addSource),
      "confirm-import": confirmImport,
      overlaps: overlaps,
      "source-info": sourceInfo,
      "all-skills": () =>
        guard(() => {
          state.visible = new Set(sources.map((s) => s.id));
          state.filter = "";
          state.fitted = false;
          navigate("library", state.selected, { reading: false });
        }),
      "graph-list": () =>
        navigate("library", state.selected, { reading: false }),
      "reference-map": () => navigate("graph", null, { focusMap: true }),
      "back-graph": () => navigate("graph"),
      "back-list": () =>
        guard(() => {
          state.reading = false;
          state.expanded = false;
          renderReader();
          requestAnimationFrame(() =>
            $(".skill-row[aria-current=true]")?.focus(),
          );
        }),
      "close-inspector": () => navigate("graph", null, { focusMap: true }),
      "read-selected": () =>
        navigate("library", state.selected, { focusReader: true }),
      "show-references": () =>
        navigate("graph", state.selected, { focusMap: true }),
      "edit-selected": beginEdit,
      "expand-reader": () => {
        state.expanded = !state.expanded;
        renderReader();
        $(".expand-reader")?.focus();
      },
      "clear-filter": () => {
        state.filter = "";
        renderList();
        $("#library-filter").focus();
      },
      "show-all": () =>
        guard(() => {
          state.visible = new Set(sources.map((s) => s.id));
          state.fitted = false;
          render();
        }),
      "zoom-in": () => zoom(1.25),
      "zoom-out": () => zoom(0.8),
      fit: () => {
        state.focusSource = null;
        fitGraph(new Set(visibleSkills().map((s) => s.id)));
      },
      "copy-source": () =>
        copyText(skillById(state.selected).markdown, "Example source copied."),
      "copy-draft": () =>
        copyText(
          state.editor.draft,
          "Local draft copied. No repository changed.",
        ),
      "download-file": () => {
        const content = skillById(state.selected).files[state.file];
        const url = URL.createObjectURL(
          new Blob([content], { type: "text/markdown;charset=utf-8" }),
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = `example-${state.file.split("/").at(-1)}`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        toast("Fictional supporting file downloaded.");
      },
      "cancel-edit": () => guard(() => renderReader()),
      "review-draft": reviewDraft,
      "simulate-proposal": proposalPreview,
      "stay-draft": () => {
        state.queued = null;
        $("#confirm-dialog").close();
        $("#draft")?.focus();
      },
      "discard-draft": () => {
        state.editor = null;
        $("#confirm-dialog").close();
        const next = state.queued;
        state.queued = null;
        next?.();
      },
      "sample-usage": () => {
        state.sampleUsage = true;
        $("#detail-dialog").close();
        navigate("usage");
      },
      "hide-sample": () => {
        state.sampleUsage = false;
        renderUsage();
      },
      onboarding: startOnboarding,
      "onboard-next": () => {
        if (state.onboardStep === 1 && !state.onboardSources.size) return;
        state.onboardStep = Math.min(2, state.onboardStep + 1);
        renderOnboarding();
      },
      "onboard-back": () => {
        state.onboardStep = Math.max(0, state.onboardStep - 1);
        renderOnboarding();
      },
      "finish-onboarding": () => finishOnboarding(action.dataset.open),
      "preview-auth": () => previewAuth(false),
      "auth-denied": () => previewAuth(true),
      "auth-example": () => {
        state.onboardStep = 1;
        renderOnboarding();
      },
      "replay-loading": () => playLoading(),
    };
    handlers[action.dataset.action]?.();
  });
  document.addEventListener("input", (event) => {
    if (event.target.id === "library-filter") {
      state.filter = event.target.value;
      renderList();
    }
    if (event.target.id === "global-search") {
      state.searchIndex = 0;
      searchResults();
    }
    if (event.target.id === "draft") updateDraft(event.target.value);
    if (event.target.id === "repo-input") {
      state.importRepo = null;
      if ($("#import-result")) $("#import-result").innerHTML = "";
    }
  });
  document.addEventListener("change", (event) => {
    const el = event.target;
    if (el.dataset.source) {
      const id = el.dataset.source,
        checked = el.checked,
        focusId = document.activeElement === el ? el.id : null;
      guard(() => {
        checked ? state.visible.add(id) : state.visible.delete(id);
        if (
          state.selected &&
          !state.visible.has(skillById(state.selected).source)
        ) {
          state.selected = null;
          state.reading = false;
        }
        state.fitted = false;
        render();
        syncUrl();
        $$(`[data-source="${id}"]`).forEach((input) => {
          input.checked = checked;
        });
        if (focusId) $("#" + CSS.escape(focusId))?.focus();
      });
      if (state.editor) el.checked = state.visible.has(id);
    }
    if (el.dataset.onboardSource) {
      el.checked
        ? state.onboardSources.add(el.dataset.onboardSource)
        : state.onboardSources.delete(el.dataset.onboardSource);
      el.closest("label").classList.toggle("is-chosen", el.checked);
      $("#onboard-summary").textContent =
        `${skills.filter((s) => state.onboardSources.has(s.source)).length} example skills from ${state.onboardSources.size} sources`;
      $("#onboard-continue").disabled = !state.onboardSources.size;
    }
    if (el.id === "library-sort") {
      state.sort = el.value;
      renderList();
    }
    if (el.id === "usage-period") {
      state.period = Number(el.value);
      renderUsage();
      $("#usage-period").focus();
    }
  });
  document.addEventListener("submit", (event) => {
    if (event.target.id === "import-form") {
      event.preventDefault();
      previewImport();
    }
  });
  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if (!$$("dialog[open]").length) openSearch();
      return;
    }
    if (
      (event.metaKey || event.ctrlKey) &&
      event.key.toLowerCase() === "s" &&
      state.editor
    ) {
      event.preventDefault();
      if (!$$("dialog[open]").length) reviewDraft();
      return;
    }
    if (event.target.id === "global-search") {
      if (["ArrowDown", "ArrowUp"].includes(event.key)) {
        event.preventDefault();
        const n = state.searchMatches.length;
        if (n) {
          state.searchIndex =
            (state.searchIndex + (event.key === "ArrowDown" ? 1 : -1) + n) % n;
          searchResults();
          $(`#result-${state.searchIndex}`)?.scrollIntoView({
            block: "nearest",
          });
        }
      }
      if (event.key === "Enter") {
        event.preventDefault();
        selectSearch(state.searchIndex);
      }
      return;
    }
    const target = event.target.closest?.("[data-node],[data-focus-source]");
    if (
      target?.dataset.node &&
      ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    ) {
      event.preventDefault();
      const from = positionOf(skillById(target.dataset.node)),
        horizontal = ["ArrowLeft", "ArrowRight"].includes(event.key),
        sign = ["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1;
      const next = visibleSkills()
        .map(positionOf)
        .filter((s) => s.id !== from.id)
        .map((s) => ({
          skill: s,
          along: (horizontal ? s.x - from.x : s.y - from.y) * sign,
          across: Math.abs(horizontal ? s.y - from.y : s.x - from.x),
        }))
        .filter((p) => p.along > 0)
        .sort((a, b) => a.along + a.across * 2 - (b.along + b.across * 2))[0];
      if (next) {
        $$("[data-node]", graph).forEach((el) =>
          el.setAttribute(
            "tabindex",
            el.dataset.node === next.skill.id ? "0" : "-1",
          ),
        );
        $(`[data-node="${CSS.escape(next.skill.id)}"]`, graph)?.focus();
        state.hover = next.skill.id;
        highlightGraph();
      }
      return;
    }
    if (target && ["Enter", " "].includes(event.key)) {
      event.preventDefault();
      target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      return;
    }
    const tab = event.target.closest?.("[data-reader-tab]");
    if (tab && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const tabs = ["read", "source", "files"],
        i = tabs.indexOf(state.readerTab);
      state.readerTab =
        event.key === "Home"
          ? "read"
          : event.key === "End"
            ? "files"
            : tabs[(i + (event.key === "ArrowRight" ? 1 : 2)) % 3];
      renderReader();
      $(`#tab-${state.readerTab}`)?.focus();
      return;
    }
    if (state.drawer && !$$("dialog[open]").length) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeSources();
      }
      if (event.key === "Tab") {
        const focusable = $$(
            "button:not([disabled]),input:not([disabled])",
            $("#sources-rail"),
          ).filter((el) => el.getBoundingClientRect().height > 0),
          first = focusable[0],
          last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
  });
  $$("dialog").forEach((el) => {
    el.addEventListener("click", (event) => {
      if (event.target !== el) return;
      const r = el.getBoundingClientRect();
      if (
        event.clientX < r.left ||
        event.clientX > r.right ||
        event.clientY < r.top ||
        event.clientY > r.bottom
      )
        el.close();
    });
    el.addEventListener("close", () => {
      if (el.id === "profile-dialog")
        $("#profile-trigger").setAttribute("aria-expanded", "false");
      if (el.id === "detail-dialog") {
        clearTimeout(state.importTimer);
        state.importRepo = null;
      }
      if (el.id === "confirm-dialog") state.queued = null;
    });
  });
  $("#drawer-scrim").addEventListener("click", () => closeSources());
  mobile.addEventListener("change", () => {
    closeSources(false);
    state.fitted = false;
    render();
  });
  systemDark.addEventListener("change", () => {
    if (state.theme === "system") setTheme("system");
  });
  window.addEventListener("popstate", () => {
    const next = location.hash;
    if (state.editor && state.editor.draft !== state.editor.original) {
      syncUrl(true);
      guard(() => {
        history.replaceState(null, "", next);
        readUrl();
        render();
      });
    } else {
      readUrl();
      render();
    }
  });
  window.addEventListener("beforeunload", (event) => {
    if (state.editor && state.editor.draft !== state.editor.original) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
  staticIcons();
  readUrl();
  syncUrl(true);
  setTheme("light");
  render();
  playLoading(() => {
    if (new URLSearchParams(location.search).get("welcome") === "1")
      startOnboarding();
  });
})();
