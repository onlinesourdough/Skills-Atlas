import assert from "node:assert/strict";

export async function pluginsLayoutEvidence(page, label) {
  const original = page.viewportSize();
  const measurements = [];
  try {
    for (const width of [390, 820]) {
      await page.setViewportSize({ width, height: 844 });
      await page.waitForTimeout(200);
      const result = await page.evaluate(() => {
        const selectors = [
          ".app-shell",
          ".topbar",
          ".shell-body",
          ".account-trigger",
          ".packs-view",
          ".import-panel input",
          ".import-panel button",
          ".import-preview",
          ".import-result",
          ".pack-list article",
          ".pack-identity h3",
          ".pack-identity p",
          ".pack-actions button",
          ".pack-actions a",
        ];
        const bounds = selectors.flatMap((selector) =>
          [...document.querySelectorAll(selector)]
            .filter((element) => element.getClientRects().length)
            .map((element) => {
              const rect = element.getBoundingClientRect();
              return {
                selector,
                left: rect.left,
                right: rect.right,
                width: rect.width,
                scrollWidth: element.scrollWidth,
                clientWidth: element.clientWidth,
              };
            }),
        );
        return {
          viewport: innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          scrollX,
          bounds,
        };
      });
      assert.equal(result.documentWidth, width, `${label}: document overflow at ${width}px`);
      assert.equal(result.scrollX, 0, `${label}: horizontal page scroll at ${width}px`);
      for (const bound of result.bounds) {
        assert(
          bound.left >= -1 && bound.right <= width + 1 && bound.width > 0,
          `${label}: ${bound.selector} outside viewport at ${width}px: ${JSON.stringify(bound)}`,
        );
        if (bound.selector !== ".import-panel input")
          assert(
            bound.scrollWidth <= bound.clientWidth + 1,
            `${label}: ${bound.selector} clips or overflows content at ${width}px`,
          );
      }
      measurements.push(result);
    }
  } finally {
    await page.setViewportSize(original);
  }
  return { label, measurements };
}

async function settleGraph(page) {
  // Functional SVG measurements need committed layout/paint, even with reduced
  // motion. Keep this bounded wait out of the separate performance workflow.
  await page.waitForTimeout(450);
  await page.waitForFunction(
    () => document.querySelector(".graph-stage")?.dataset.cameraMotion === "idle",
    null,
    { timeout: 2000 },
  );
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  );
}

export async function resizeSelectionEvidence(page, base, screenshotPath) {
  const repository = "onlinesourdough/Global-Skills";
  const makePack = (count, revision) => ({
    kind: "atlas-pack",
    id: "github:980",
    repositoryId: 980,
    repository,
    repositoryUrl: `https://github.com/${repository}`,
    defaultBranch: "main",
    revision,
    access: "read",
    source: "github",
    snapshotLabel: "Synthetic resize regression",
    components: ["skills"],
    skills: Array.from({ length: count }, (_, index) => {
      const category = index < 15 || index >= 30 ? "Category A" : "Category B";
      return {
        id: `github:980:skills/probe-${index}/SKILL.md`,
        slug: `probe-${index}`,
        name: `Probe ${index}`,
        description: "Synthetic resize probe.",
        category,
        sourcePath: `skills/probe-${index}/SKILL.md`,
        relations: [],
        tone: "blue",
        markdown: `---\nname: probe-${index}\ndescription: Synthetic resize probe.\ncategory: ${category}\n---\n\n# Probe ${index}\n\nSynthetic content only.`,
      };
    }),
  });
  let pack = makePack(30, "a".repeat(40));
  await page.route(`${base}/api/packs/import?**`, (route) => route.fulfill({ json: pack }));
  await page.goto(`${base}/#graph`);
  await page.locator(".skill-node").first().waitFor();
  await page.locator(".taxonomy-item").filter({ hasText: "Category A" }).click();
  await page.getByRole("button", { name: "Search skills", exact: true }).click();
  await page.getByRole("combobox").fill("Probe 29");
  await page.locator(".search-results > button").click();
  await page.locator(".graph-selection").waitFor();
  async function sample() {
    await settleGraph(page);
    return page.evaluate(() => {
      const selected = document.querySelector(".skill-node.selected");
      const circle = selected.querySelector("circle").getBoundingClientRect();
      const graph = document.querySelector(".relationship-graph").getBoundingClientRect();
      const inspector = document.querySelector(".graph-selection").getBoundingClientRect();
      return {
        selected: selected.dataset.skillId,
        category: document.querySelector(".taxonomy-item[aria-pressed=true]").textContent,
        camera: document.querySelector(".graph-camera").getAttribute("transform"),
        positions: [...document.querySelectorAll(".skill-node")].map((node) => [
          node.dataset.skillId,
          node.getAttribute("transform"),
        ]),
        node: { left: circle.left, right: circle.right, top: circle.top, bottom: circle.bottom },
        available: {
          left: graph.left,
          right: inspector.left - 16,
          top: graph.top,
          bottom: graph.bottom,
        },
        visible:
          circle.left >= graph.left &&
          circle.right <= inspector.left - 16 &&
          circle.top >= graph.top &&
          circle.bottom <= graph.bottom,
      };
    });
  }
  const before = await sample();
  assert.equal(before.selected, "github:980:skills/probe-29/SKILL.md");
  assert.match(before.category, /^Category A/u);
  assert(before.visible, "Search failed to show selected Category B node");
  await page.screenshot({ path: screenshotPath("phase-g-resize-fixed-before.png") });
  await page.setViewportSize({ width: 1100, height: 800 });
  const resized = await sample();
  assert.equal(resized.selected, before.selected);
  assert.equal(resized.category, before.category);
  assert.deepEqual(resized.positions, before.positions, "Resize moved graph nodes");
  assert(resized.visible, `Resize hid selected node: ${JSON.stringify(resized)}`);
  await page.screenshot({ path: screenshotPath("phase-g-resize-fixed-after.png") });
  async function readBack(expected) {
    await page.getByRole("button", { name: "Read skill", exact: true }).click();
    assert.equal(new URL(page.url()).searchParams.get("skill"), expected.selected);
    await page
      .locator(".skill-reader")
      .getByRole("heading", { name: "Probe 29", exact: true, level: 2 })
      .waitFor();
    await page.locator(".skill-reader .reader-source > summary").click();
    assert.equal(
      await page
        .locator(".skill-reader")
        .getByRole("link", { name: "Read file on GitHub" })
        .getAttribute("href"),
      `https://github.com/${repository}/blob/${pack.revision}/skills/probe-29/SKILL.md`,
    );
    await page.getByRole("button", { name: "Back to graph", exact: true }).click();
    const returned = await sample();
    assert.equal(returned.camera, expected.camera, "Read/Back reset camera");
    assert.equal(returned.selected, expected.selected);
    assert.equal(returned.category, expected.category);
  }
  await readBack(resized);

  // Refresh the same source with more Category A nodes while B stays selected.
  // Existing-source confirmation preserves the current category and selection.
  pack = makePack(45, "b".repeat(40));
  await page.getByRole("button", { name: /Manage plugins/ }).click();
  await page.getByRole("textbox", { name: "GitHub repository", exact: true }).fill(repository);
  await page.getByRole("button", { name: "Preview repository", exact: true }).click();
  await page.getByRole("button", { name: "Confirm import", exact: true }).click();
  await page.getByRole("status").getByText("Plugin ready", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Graph", exact: true }).click();
  const refreshed = await sample();
  assert.equal(refreshed.positions.length, 45);
  assert.equal(refreshed.selected, before.selected);
  assert.match(refreshed.category, /^Category A/u);
  const positions = new Map(refreshed.positions);
  for (const [id, position] of before.positions) assert.equal(positions.get(id), position);
  assert(refreshed.visible, "Source geometry refresh hid the selected node");
  await page.screenshot({ path: screenshotPath("phase-g-selected-source-refresh.png") });
  await readBack(refreshed);

  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await graphFitEvidence(page, true);
  assert.equal(
    await page.locator(".skill-node.selected").getAttribute("data-skill-id"),
    before.selected,
  );
  assert.match(await page.locator(".taxonomy-item[aria-pressed=true]").innerText(), /^Category A/u);
  await page.getByRole("button", { name: /^All skills/ }).click();
  await graphFitEvidence(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.locator(".taxonomy-item").filter({ hasText: "Category A" }).click();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  const interrupted = await page.locator(".graph-camera").getAttribute("transform");
  const manual = await sample();
  assert.equal(manual.camera, interrupted, "Camera animation resumed after manual zoom");
  await readBack(manual);
  const frame = await page.locator(".relationship-graph").boundingBox();
  await page.mouse.move(frame.x + 4, frame.y + frame.height - 4);
  await page.mouse.down();
  await page.mouse.move(frame.x + 44, frame.y + frame.height - 24);
  await page.mouse.up();
  const panned = await sample();
  assert.notEqual(panned.camera, manual.camera, "Manual pan had no effect");
  assert.equal(panned.selected, manual.selected);
  assert.equal(panned.category, manual.category);
  await readBack(panned);
  await page.emulateMedia({ reducedMotion: "reduce" });
  return { before, resized, refreshed, manual, panned, fixtureOnly: true };
}

// Measures rendered solid-color text, including nested opacity and SVG category
// fills. It deliberately reports unsupported image/gradient backgrounds instead
// of treating them as an accessibility pass. This is not a full WCAG audit.
export async function textContrast(page, scope = "body") {
  const result = await page.locator(scope).evaluate((root) => {
    const parse = (value) => {
      const parts = value.match(/[\d.]+/gu)?.map(Number);
      return parts?.length >= 3 ? [...parts.slice(0, 3), parts[3] ?? 1] : [0, 0, 0, 0];
    };
    const over = (front, back) => {
      const alpha = front[3] + back[3] * (1 - front[3]);
      return alpha
        ? [0, 1, 2]
            .map((i) => (front[i] * front[3] + back[i] * back[3] * (1 - front[3])) / alpha)
            .concat(alpha)
        : [0, 0, 0, 0];
    };
    const luminance = (color) =>
      color
        .slice(0, 3)
        .map((channel) => {
          const c = channel / 255;
          return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        })
        .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
    const samples = [];
    const unsupported = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const element = node.parentElement;
      if (
        !node.textContent.trim() ||
        !element ||
        element.closest("script,style,title,desc,.sr-only,[hidden],[inert],[disabled]")
      )
        continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const rect = range.getBoundingClientRect();
      if (
        !rect.width ||
        !rect.height ||
        rect.bottom < 0 ||
        rect.top > innerHeight ||
        rect.right < 0 ||
        rect.left > innerWidth
      )
        continue;
      const x = Math.min(innerWidth - 1, Math.max(0, rect.left + Math.min(rect.width / 2, 12)));
      const y = Math.min(innerHeight - 1, Math.max(0, rect.top + rect.height / 2));
      const hit = document.elementFromPoint(x, y);
      if (!hit || !(element.contains(hit) || hit.contains(element))) continue;
      const style = getComputedStyle(element);
      if (style.visibility !== "visible") continue;
      let foreground = parse(element instanceof SVGElement ? style.fill : style.color);
      let background = [0, 0, 0, 0];
      let unknown = false;
      for (let current = element; current; current = current.parentElement) {
        const currentStyle = getComputedStyle(current);
        if (currentStyle.backgroundImage !== "none") unknown = true;
        let own = parse(currentStyle.backgroundColor);
        if (current instanceof SVGSVGElement) {
          for (const circle of current.querySelectorAll(".graph-cluster circle")) {
            const matrix = circle.getScreenCTM();
            if (
              !matrix ||
              !circle.isPointInFill(new DOMPoint(x, y).matrixTransform(matrix.inverse()))
            )
              continue;
            const fill = parse(getComputedStyle(circle).fill);
            fill[3] *= Number(getComputedStyle(circle).opacity);
            own = over(fill, own);
          }
        }
        foreground = over(foreground, own);
        background = over(background, own);
        foreground[3] *= Number(currentStyle.opacity);
        background[3] *= Number(currentStyle.opacity);
      }
      foreground = over(foreground, [255, 255, 255, 1]);
      background = over(background, [255, 255, 255, 1]);
      const values = [luminance(foreground), luminance(background)].sort((a, b) => a - b);
      const sample = {
        text: node.textContent.trim().slice(0, 100),
        selector: `${element.tagName}.${element.getAttribute("class") ?? ""}`,
        foreground,
        background,
        ratio: (values[1] + 0.05) / (values[0] + 0.05),
      };
      if (unknown) unsupported.push(sample);
      else samples.push(sample);
    }
    return { samples, unsupported };
  });
  assert(result.samples.length > 0, "No visible text contrast samples");
  assert.equal(
    result.unsupported.length,
    0,
    "Text backgrounds require additional manual measurement",
  );
  const failures = result.samples.filter((sample) => sample.ratio < 4.5);
  assert.equal(failures.length, 0, `Text below 4.5:1: ${JSON.stringify(failures)}`);
  return result;
}

export async function graphFitEvidence(page, categoryOnly = false) {
  await settleGraph(page);
  const result = await page.locator(".relationship-graph").evaluate((svg, category) => {
    const frame = svg.getBoundingClientRect();
    const inspector = document.querySelector(".graph-selection")?.getBoundingClientRect();
    const right = inspector?.width ? inspector.left - 16 : frame.right;
    const selector = category ? ".skill-node.category-emphasized" : ".skill-node";
    const nodes = [...svg.querySelectorAll(selector)].map((node) => {
      const rect = node.querySelector("circle").getBoundingClientRect();
      return {
        id: node.dataset.skillId,
        visible:
          rect.left >= frame.left &&
          rect.right <= right &&
          rect.top >= frame.top &&
          rect.bottom <= frame.bottom,
      };
    });
    return { nodes, frame: { width: frame.width, height: frame.height }, right };
  }, categoryOnly);
  assert(result.nodes.length > 0, "Fit proof has no nodes");
  assert(
    result.nodes.every((node) => node.visible),
    `Clipped graph nodes: ${JSON.stringify(result)}`,
  );
  return result;
}

export async function navigationEvidence(page, screenshotPath) {
  const camera = page.locator(".graph-camera");
  await page.getByRole("button", { name: /^All skills/ }).click();
  const fit = await graphFitEvidence(page);
  const positions = await page
    .locator(".skill-node")
    .evaluateAll((nodes) =>
      nodes.map((node) => [node.dataset.skillId, node.getAttribute("transform")]),
    );
  await page.locator(".taxonomy-item").nth(1).click();
  const categoryFit = await graphFitEvidence(page, true);
  assert.deepEqual(
    await page
      .locator(".skill-node")
      .evaluateAll((nodes) =>
        nodes.map((node) => [node.dataset.skillId, node.getAttribute("transform")]),
      ),
    positions,
    "Category focus changed node layout",
  );
  await page.screenshot({ path: screenshotPath("phase-g-category-fit.png") });
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  assert.equal(await page.locator(".taxonomy-item[aria-pressed=true]").count(), 1);
  await graphFitEvidence(page, true);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByRole("button", { name: /^All skills/ }).click();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  const interrupted = await camera.getAttribute("transform");
  await page.waitForTimeout(400);
  assert.equal(
    await camera.getAttribute("transform"),
    interrupted,
    "Animation resumed after manual zoom",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: /^All skills/ }).click();
  await settleGraph(page);
  const initial = await camera.getAttribute("transform");
  const node = page.locator(".skill-node").first();
  await page.keyboard.press("Tab");
  await node.focus();
  const focusStyle = await node.evaluate((element) => ({
    visible: element.matches(":focus-visible"),
    stroke: getComputedStyle(element.querySelector("circle")).stroke,
    width: parseFloat(getComputedStyle(element.querySelector("circle")).strokeWidth),
  }));
  assert(focusStyle.visible && focusStyle.width >= 3, "Graph keyboard focus is not visibly marked");
  const focusSamples = await textContrast(page, ".graph-stage");
  const lum = (color) =>
    color
      .slice(0, 3)
      .map((channel) => {
        const c = channel / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      })
      .reduce((sum, c, index) => sum + c * [0.2126, 0.7152, 0.0722][index], 0);
  const strokeLuminance = lum(focusStyle.stroke.match(/[\d.]+/gu).map(Number));
  const focusContrast = Math.min(
    ...focusSamples.samples.map(({ background }) => {
      const value = lum(background);
      return (Math.max(value, strokeLuminance) + 0.05) / (Math.min(value, strokeLuminance) + 0.05);
    }),
  );
  assert(
    focusContrast >= 3,
    "Keyboard focus stroke is below 3:1 against sampled graph backgrounds",
  );
  await page.screenshot({ path: screenshotPath("phase-g-keyboard-focus.png") });
  await settleGraph(page);
  assert.equal(await camera.getAttribute("transform"), initial, "Keyboard focus moved camera");
  await node.press("Enter");
  await page.locator(".graph-selection").waitFor();
  await settleGraph(page);
  const selectedId = await page.locator(".skill-node.selected").getAttribute("data-skill-id");
  const selectedCamera = await camera.getAttribute("transform");
  await page.screenshot({ path: screenshotPath("phase-g-inspector.png") });
  const inspectorContrast = await textContrast(page);
  await page.getByRole("button", { name: "Read skill", exact: true }).click();
  assert.equal(
    await page.locator(".skill-list > button.selected").getAttribute("data-skill-id"),
    selectedId,
  );
  await page.getByRole("button", { name: "Back to graph", exact: true }).click();
  assert.equal(await camera.getAttribute("transform"), selectedCamera, "Read/Back changed camera");
  await settleGraph(page);
  assert.equal(
    await camera.getAttribute("transform"),
    selectedCamera,
    "Read/Back changed settled camera",
  );
  assert.equal(
    await page.locator(".skill-node.selected").getAttribute("data-skill-id"),
    selectedId,
  );
  await page.getByRole("button", { name: "Close inspector", exact: true }).click();
  assert.equal(await camera.getAttribute("transform"), selectedCamera, "Close changed camera");
  await settleGraph(page);
  assert.equal(
    await camera.getAttribute("transform"),
    selectedCamera,
    "Close changed settled camera",
  );
  await page.getByRole("button", { name: "Search skills", exact: true }).click();
  const search = page.getByRole("combobox");
  await search.fill("clarify");
  await search.press("ArrowDown");
  const target = await page
    .locator(".search-results [aria-selected=true]")
    .getAttribute("data-skill-id");
  await search.press("Enter");
  await settleGraph(page);
  assert.equal(await page.locator(".skill-node.selected").getAttribute("data-skill-id"), target);
  const searchCamera = await camera.getAttribute("transform");
  await page.getByRole("button", { name: "Close inspector", exact: true }).click();
  assert.equal(await camera.getAttribute("transform"), searchCamera, "Search close changed camera");
  await settleGraph(page);
  assert.equal(
    await camera.getAttribute("transform"),
    searchCamera,
    "Search close changed settled camera",
  );
  return {
    fit,
    categoryFit,
    inspectorContrast,
    selectedId,
    keyboardSearchTarget: target,
    manualZoomInterrupted: true,
    stableCategoryPositions: true,
    focusStyle,
    focusContrast,
  };
}
