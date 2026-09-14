import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import {
  sixRepositoryFixture,
  unevenSixRepositoryFixture,
} from "../src/domain/workspace.fixture.ts";

// Lead-owned execution, after a clean-copy build:
// node --import tsx scripts/browser-repository-proof.mjs
// No normal browser profile, real provider access, Worker or credential loader.
const root = resolve(new URL("..", import.meta.url).pathname);
const base = "http://127.0.0.1:4185";
const uneven = process.argv.includes("--uneven");
const output = resolve(root, uneven ? "proof/repository-graph-uneven" : "proof/repository-graph");
const packs = uneven ? unevenSixRepositoryFixture() : sixRepositoryFixture();
// The public startup contract requires its canonical name. Only fictional
// fixture bodies are returned, including for this public-name alias.
packs[0].repository = "onlinesourdough/Global-Skills";
packs[0].repositoryUrl = `https://github.com/${packs[0].repository}`;
const report = {
  status: "RUNNING",
  fixture: `six synthetic repositories / 44 Uncategorized skills / ${uneven ? "3/21/4/8/2/6" : "balanced"}`,
  visualAcceptance: "PENDING lead inspection",
  frames: [],
};
let server, browser;
try {
  const occupied = await fetch(base).then(
    () => true,
    () => false,
  );
  assert.equal(occupied, false, "Fixture port 4185 is occupied");
  server = spawn(process.execPath, ["dist/server/index.js"], {
    cwd: root,
    env: { PATH: process.env.PATH, PORT: "4185", HOST: "127.0.0.1" },
    stdio: "ignore",
  });
  for (let retry = 0; ; retry++) {
    if (
      await fetch(base).then(
        (response) => response.ok,
        () => false,
      )
    )
      break;
    assert.ok(retry < 100, "Synthetic preview failed to start");
    await new Promise((done) => setTimeout(done, 100));
  }
  await mkdir(output, { recursive: true });
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== base) return route.abort();
    if (url.pathname === "/api/packs/import") {
      const pack = packs.find((pack) => pack.repository === url.searchParams.get("repository"));
      return route.fulfill(
        pack
          ? { json: pack }
          : { status: 404, json: { error: { code: "repository-unavailable" } } },
      );
    }
    return route.continue();
  });
  const painted = () =>
    page.evaluate(async () => {
      let previous = "";
      let steady = 0;
      for (let attempt = 0; attempt < 120; attempt++) {
        await new Promise((done) => requestAnimationFrame(done));
        const svg = document.querySelector(".relationship-graph");
        const sample = JSON.stringify({
          camera: document.querySelector(".graph-camera")?.getAttribute("transform"),
          box: svg?.getBoundingClientRect().toJSON(),
          labels: [...document.querySelectorAll(".neighborhood-label rect")].map((element) =>
            element.getBoundingClientRect().toJSON(),
          ),
        });
        steady = sample === previous ? steady + 1 : 0;
        previous = sample;
        if (steady >= 4) return;
      }
      throw new Error("Graph geometry did not settle");
    });
  const frame = async (name) => {
    await painted();
    const path = resolve(output, `${name}.png`);
    await page.screenshot({ path, fullPage: true });
    report.frames.push(path);
  };
  const node = (id) => page.locator(`[data-skill-node][data-skill-id="${id}"]`);
  const source = (pack) =>
    page.locator(".source-controls").getByRole("checkbox", { name: pack.repository, exact: true });
  await page.goto(`${base}/#graph`);
  await source(packs[0]).waitFor();
  await node(packs[0].skills[0].id).waitFor();
  await page.goto(`${base}/#plugins`);
  for (const pack of packs.slice(1)) {
    await page.getByPlaceholder("owner/repository").fill(pack.repository);
    await page.getByRole("button", { name: "Preview repository", exact: true }).click();
    await page.getByRole("button", { name: "Confirm import", exact: true }).click();
    await page
      .getByText(`${pack.repository} imported with ${pack.skills.length} skills.`, { exact: true })
      .waitFor();
  }
  await page.goto(`${base}/#graph`);
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await painted();
  assert.equal(await page.locator("[data-skill-node]").count(), 44);
  assert.equal(await page.locator(".repository-label").count(), 6);
  assert.equal(await page.locator(".repository-bridge").count(), 2);
  const labels = await page.locator(".repository-label").evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect();
      const text = element.querySelector("text");
      return {
        label: element.getAttribute("aria-label"),
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        font: parseFloat(getComputedStyle(text).fontSize) * text.getScreenCTM().a,
        strokes: [text, ...text.querySelectorAll("tspan")].map(
          (item) => getComputedStyle(item).stroke,
        ),
      };
    }),
  );
  const stage = await page.locator(".graph-stage").boundingBox();
  for (let index = 0; index < labels.length; index++) {
    const label = labels[index];
    assert.ok(label.font >= 12, "Repository label shrank below screen-readable size");
    assert.ok(
      label.strokes.every((stroke) => stroke === "none"),
      "Repository text inherited SVG stroke",
    );
    assert.ok(
      label.x >= stage.x && label.x + label.width <= stage.x + stage.width + 1,
      "Repository label clipped horizontally",
    );
    assert.ok(
      label.y >= stage.y && label.y + label.height <= stage.y + stage.height,
      "Repository label clipped vertically",
    );
    for (const other of labels.slice(index + 1))
      assert.ok(
        label.x + label.width <= other.x ||
          other.x + other.width <= label.x ||
          label.y + label.height <= other.y ||
          other.y + other.height <= label.y,
        "Repository labels overlap",
      );
  }
  const colors = [];
  for (const pack of packs) {
    const swatch = await source(pack)
      .locator("..")
      .locator(".source-swatch")
      .evaluate((element) => getComputedStyle(element).backgroundColor);
    const fill = await node(pack.skills[0].id)
      .locator("circle")
      .evaluate((element) => getComputedStyle(element).fill);
    assert.equal(fill, swatch);
    colors.push(swatch);
  }
  assert.equal(new Set(colors).size, 6);
  report.labels = labels;
  report.colors = colors;
  await frame("overview-1440");

  await node(packs[0].skills[0].id).focus();
  await page.keyboard.press("Enter");
  await page.locator(".graph-selection").waitFor();
  assert.equal(await page.locator(".graph-edge.cross-repository").count(), 2);
  const verifyNeighborhood = async (expected) => {
    await painted();
    const canvas = await page.locator(".graph-stage").boundingBox();
    const inspector = await page.locator(".graph-selection").boundingBox();
    const identities = [];
    for (const id of expected) {
      const point = await node(id).locator("circle").boundingBox();
      assert.ok(
        point.x >= canvas.x + 80 && point.x + point.width < inspector.x - 16,
        "Direct endpoint is obscured horizontally",
      );
      assert.ok(
        point.y >= canvas.y + 64 && point.y + point.height < canvas.y + canvas.height - 64,
        "Direct endpoint is obscured vertically",
      );
      const label = page.locator(`[data-neighborhood-id="${id}"]`);
      const box = await label.locator("rect").boundingBox();
      assert.ok(
        box.x >= canvas.x &&
          box.x + box.width < inspector.x - 8 &&
          box.y >= canvas.y &&
          box.y + box.height <= canvas.y + canvas.height,
        "Connected identity is obscured",
      );
      const text = await label.locator("text").evaluate((element) => ({
        stroke: getComputedStyle(element).stroke,
        size: parseFloat(getComputedStyle(element).fontSize),
        content: element.textContent,
      }));
      assert.equal(text.stroke, "none");
      assert.ok(text.size >= 12 && text.content.trim().length > 0);
      for (const other of identities)
        assert.ok(
          box.x + box.width <= other.x ||
            other.x + other.width <= box.x ||
            box.y + box.height <= other.y ||
            other.y + other.height <= box.y,
          "Connected identity labels overlap",
        );
      identities.push(box);
    }
    assert.equal(await page.locator(".neighborhood-label").count(), expected.length);
  };
  const directIds = [
    packs[0].skills[0].id,
    packs[0].skills[1].id,
    packs[1].skills[0].id,
    packs[5].skills[0].id,
  ];
  await verifyNeighborhood(directIds);
  const hoverCamera = await page.locator(".graph-camera").getAttribute("transform");
  await node(packs[1].skills[0].id).hover();
  await painted();
  assert.equal(
    await page.locator(".graph-camera").getAttribute("transform"),
    hoverCamera,
    "Hover moved the camera",
  );
  await page.setViewportSize({ width: 1176, height: 900 });
  await verifyNeighborhood(directIds);
  await page.setViewportSize({ width: 1440, height: 900 });
  await verifyNeighborhood(directIds);
  await source(packs[5]).uncheck();
  await verifyNeighborhood(directIds.slice(0, 3));
  assert.equal(await page.locator(`[data-neighborhood-id="${packs[5].skills[0].id}"]`).count(), 0);
  await source(packs[5]).check();
  await verifyNeighborhood(directIds);
  await frame("directed-inspector");
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  const camera = await page.locator(".graph-camera").getAttribute("transform");
  await page.getByRole("button", { name: "Read skill", exact: false }).click();
  await page.getByRole("button", { name: "Back to graph", exact: true }).click();
  await painted();
  assert.equal(await page.locator(".graph-camera").getAttribute("transform"), camera);
  await page.getByRole("button", { name: "Read skill", exact: false }).click();
  await page.locator(".markdown-body").getByRole("button", { name: "Exact", exact: true }).click();
  assert.equal(new URL(page.url()).searchParams.get("skill"), packs[1].skills[0].id);
  await frame("cross-repository-reader");
  await page.getByRole("button", { name: "Back to graph", exact: true }).click();
  await page.getByRole("button", { name: "Close inspector", exact: true }).click();
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await page.getByRole("button", { name: /Possible overlaps/ }).click();
  const summaries = await page.locator(".overlap-panel summary").evaluateAll((elements) =>
    elements.map((element) => ({
      title: element.querySelector("strong")?.textContent,
      context: element.querySelector("small")?.textContent,
      text: element.textContent,
    })),
  );
  assert.ok(
    summaries.every((summary) => summary.title?.trim() && summary.context?.includes("/")),
    "Collapsed candidates lack identity or source context",
  );
  assert.equal(
    new Set(summaries.map((summary) => summary.text)).size,
    summaries.length,
    "Collapsed candidates are indistinguishable",
  );
  await page
    .locator(".overlap-panel summary")
    .filter({ hasText: "Identical full Markdown" })
    .click();
  await frame("separate-overlap-evidence");
  await page
    .locator(".overlap-panel")
    .getByRole("button", { name: /synthetic-organization\/operations/ })
    .first()
    .click();
  assert.equal(new URL(page.url()).searchParams.get("skill"), packs[2].skills[0].id);
  await page.getByRole("button", { name: "Back to graph", exact: true }).click();
  await page.getByRole("button", { name: /Possible overlaps/ }).click();
  await page.getByRole("button", { name: "Close inspector", exact: true }).click();
  await source(packs[5]).uncheck();
  assert.equal(await page.locator('[data-skill-node][data-skill-id^="github:9105:"]').count(), 0);
  assert.equal(await page.locator(".repository-label").filter({ hasText: "knowledge" }).count(), 0);
  await source(packs[5]).check();
  assert.equal(
    await node(packs[5].skills[0].id)
      .locator("circle")
      .evaluate((element) => getComputedStyle(element).fill),
    colors[5],
  );
  for (const pack of packs) await source(pack).uncheck();
  await page.getByText("No loaded skills", { exact: true }).waitFor();
  for (const pack of packs) await source(pack).check();
  assert.equal(await page.locator("[data-skill-node]").count(), 44);
  for (const width of [820, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await frame(`repository-list-${width}`);
    await page.getByRole("button", { name: /Possible overlaps/ }).click();
    await frame(`identified-overlaps-${width}`);
    await page.getByRole("button", { name: /Possible overlaps/ }).click();
    await page.locator(".mobile-relationship-list button").first().click();
    await page.getByRole("button", { name: "Read skill", exact: false }).click();
    await page.getByRole("button", { name: "Back to graph", exact: true }).click();
    await page.getByRole("button", { name: "Close inspector", exact: true }).click();
  }
  assert.deepEqual(errors, []);
  report.status = "AUTOMATED_CHECKS_PASS";
} catch (error) {
  report.status = "FAIL";
  report.error = error.message;
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await once(server, "exit");
  }
  await mkdir(output, { recursive: true });
  await writeFile(resolve(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(report.status, resolve(output, "report.json"));
}
