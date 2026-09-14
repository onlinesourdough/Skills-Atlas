import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, writeFile, realpath } from "node:fs/promises";
import { hostname, cpus, platform, release, arch } from "node:os";
import { resolve } from "node:path";
import { chromium } from "playwright";

// Run against a preserved built candidate to measure before and after identically.
const root = await realpath(process.argv[2] ?? ".");
const label = process.argv[3] ?? "candidate";
if (!/^[a-z0-9-]+$/u.test(label)) throw new Error("Invalid report label");
const base = "http://127.0.0.1:4185";
try {
  await fetch(base);
  throw new Error("Port 4185 occupied");
} catch (error) {
  if (error.message === "Port 4185 occupied") throw error;
}
const server = spawn(process.execPath, ["dist/server/index.js"], {
  cwd: root,
  env: { PATH: process.env.PATH, PORT: "4185", HOST: "127.0.0.1" },
  stdio: "ignore",
});
let browser;
const report = {
  label,
  root,
  machine: {
    hostname: hostname(),
    cpu: cpus()[0]?.model,
    platform: platform(),
    release: release(),
    arch: arch(),
    node: process.version,
  },
  method:
    "Synthetic HTTP fixtures; startup to painted graph, category click to two animation frames; five 100-skill sources for stress. No provider timing or production limit change.",
  cases: [],
};
function pack(repository, count, repositoryId) {
  return {
    kind: "atlas-pack",
    id: `github:${repositoryId}`,
    repositoryId,
    repository,
    repositoryUrl: `https://github.com/${repository}`,
    defaultBranch: "main",
    revision: "a".repeat(40),
    access: "read",
    source: "github",
    snapshotLabel: "Synthetic performance fixture",
    components: ["skills"],
    skills: Array.from({ length: count }, (_, index) => ({
      id: `github:${repositoryId}:skills/skill-${index}/SKILL.md`,
      slug: `skill-${index}`,
      name: `Synthetic skill ${index}`,
      description: "Synthetic performance fixture.",
      category: `Category ${index % 5}`,
      sourcePath: `skills/skill-${index}/SKILL.md`,
      markdown: `---\nname: skill-${index}\ndescription: Synthetic performance fixture.\ncategory: Category ${index % 5}\n---\n\n# Synthetic skill ${index}\n\nSynthetic performance fixture.`,
      relations: [],
      tone: "blue",
    })),
  };
}
async function painted(page) {
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  );
}
try {
  for (let retry = 0; retry < 100; retry++) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {
      /* wait for local listener */
    }
    if (retry === 99) throw new Error("Preview failed to start");
    await new Promise((done) => setTimeout(done, 100));
  }
  browser = await chromium.launch({ headless: true });
  report.browser = browser.version();
  for (const count of [0, 2, 50, 500]) {
    const samples = [];
    for (let repetition = 0; repetition < 3; repetition++) {
      const page = await browser.newPage({
        viewport: { width: 1440, height: 900 },
        reducedMotion: "reduce",
      });
      await page.route("**/api/packs/import?**", async (route) => {
        const repository = new URL(route.request().url()).searchParams.get("repository");
        const ordinal = Number(/source-(\d+)$/u.exec(repository)?.[1] ?? 0);
        await route.fulfill({
          json: pack(repository, count === 500 ? 100 : Math.max(2, count), 900 + ordinal),
        });
      });
      const start = performance.now();
      await page.goto(`${base}/#graph`);
      await page
        .locator(".source-controls label")
        .filter({ hasText: "onlinesourdough/Global-Skills" })
        .locator("input:checked")
        .waitFor();
      await page.locator('[data-skill-node="true"]').first().waitFor();
      if (count === 0) {
        for (const checkbox of await page.locator(".source-controls input:checked").all())
          await checkbox.uncheck();
        await page.getByText("No loaded skills", { exact: true }).waitFor();
      }
      if (count === 500) {
        await page.goto(`${base}/#plugins`);
        for (let index = 1; index < 5; index++) {
          await page.getByPlaceholder("owner/repository").fill(`synthetic/source-${index}`);
          const preview = page.getByRole("button", { name: "Preview repository", exact: true });
          if (await preview.count()) {
            await preview.click();
            await page.getByRole("button", { name: "Confirm import", exact: true }).click();
          } else await page.getByRole("button", { name: "Import repository", exact: true }).click();
          await page
            .getByText(`synthetic/source-${index} imported with 100 skills.`, { exact: true })
            .waitFor();
        }
        await page.goto(`${base}/#graph`);
      }
      await painted(page);
      const startupMs = performance.now() - start;
      const actual = await page.locator('[data-skill-node="true"]').count();
      if (actual !== count) throw new Error(`Expected ${count} nodes, found ${actual}`);
      let focusMs = null;
      if (count) {
        const before = performance.now();
        await page.locator(".taxonomy-item").filter({ hasText: "Category 0" }).click();
        await painted(page);
        focusMs = performance.now() - before;
      }
      samples.push({ startupMs, focusMs, actual });
      await page.close();
    }
    const median = (values) => [...values].sort((a, b) => a - b)[1];
    const startupMedianMs = median(samples.map((sample) => sample.startupMs));
    const focusMedianMs = count ? median(samples.map((sample) => sample.focusMs)) : null;
    const budget = { startupMs: count === 500 ? 1500 : 350, focusMs: 150 };
    report.cases.push({
      count,
      samples,
      startupMedianMs,
      focusMedianMs,
      budget,
      withinBudget:
        startupMedianMs <= budget.startupMs &&
        (focusMedianMs === null || focusMedianMs <= budget.focusMs),
    });
  }
  report.status = "MEASURED";
  if (label !== "baseline" && report.cases.some((item) => !item.withinBudget)) {
    report.status = "BUDGET_EXCEEDED";
    process.exitCode = 1;
  }
} catch (error) {
  report.status = "FAILED";
  report.error = error.message;
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (server.exitCode === null) {
    server.kill("SIGTERM");
    await once(server, "exit");
  }
  await mkdir("proof/runtime", { recursive: true });
  const path = resolve(`proof/runtime/performance-${label}.json`);
  await writeFile(path, `${JSON.stringify(report, null, 2)}\n`);
  console.log(path);
}
