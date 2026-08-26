import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const nodePort = 4175;
const staticPort = 4176;
const nodeBase = `http://127.0.0.1:${nodePort}`;
const staticBase = `http://127.0.0.1:${staticPort}`;
const root = fileURLToPath(new URL("..", import.meta.url));
const screenshotRoot = new URL("../proof/screenshots/", import.meta.url);
const runtimeRoot = new URL("../proof/runtime/", import.meta.url);
const failures = [];
const observations = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

async function waitForUrl(url) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The local process may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`local artifact did not become available: ${url}`);
}

function attachBrowserDiagnostics(page, label, origin) {
  page.on("pageerror", () => failures.push(`${label}: uncaught page error`));
  page.on("console", (message) => {
    if (message.type() === "error")
      failures.push(`${label}: browser console error: ${message.text()}`);
  });
  page.on("requestfailed", (request) => {
    if (request.url().startsWith(origin))
      failures.push(`${label}: local asset request failed: ${request.url()}`);
  });
  page.on("response", (response) => {
    if (response.url().startsWith(origin) && response.status() >= 400)
      failures.push(`${label}: local response ${response.status()}: ${response.url()}`);
  });
}

async function checkCommon(page, label) {
  const result = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
    fonts: document.fonts.check('14px "Geist Sans"'),
    secret:
      /(?:sk-[A-Za-z0-9_-]{20,}|(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_-]{20,}|-----BEGIN [A-Z ]+ PRIVATE KEY-----)/u.test(
        document.documentElement.innerHTML,
      ),
    landmarks: Boolean(
      document.querySelector("header.topbar") &&
        document.querySelector("main#main") &&
        document.querySelector("aside.rail"),
    ),
  }));
  assert(result.width <= result.viewport, `${label}: horizontal overflow`);
  assert(result.fonts, `${label}: local Geist font did not load`);
  assert(!result.secret, `${label}: secret marker in client DOM`);
  assert(result.landmarks, `${label}: semantic product shell landmark missing`);
  observations.push({ label, ...result });
}

async function exerciseDesktop(page) {
  await page.goto(`${nodeBase}/#graph`, { waitUntil: "networkidle" });
  await page.waitForSelector("#graph-title");
  await checkCommon(page, "desktop-node");
  assert(
    (await page.locator(".skill-cluster").count()) === 5,
    "desktop: graph did not render five category clusters",
  );
  assert(
    (await page.locator(".cluster-node").count()) === 8,
    "desktop: graph did not expose every bundled skill node",
  );
  await page.screenshot({
    path: new URL("r2-desktop-graph.png", screenshotRoot).pathname,
    fullPage: true,
  });

  const tourTrigger = page.getByRole("button", { name: "Replay Atlas onboarding" });
  await tourTrigger.click();
  await page.locator(".tour-dialog").waitFor({ state: "visible" });
  assert(
    (await page.locator(".tour-progress-row p").textContent())?.includes("Step 1 of 5"),
    "desktop: five-page onboarding did not start at step 1",
  );
  assert(
    await page
      .getByRole("heading", { name: "Keep team skills findable." })
      .evaluate((element) => document.activeElement === element),
    "desktop: onboarding heading did not receive focus",
  );
  await page.screenshot({ path: new URL("r2-desktop-tour-first.png", screenshotRoot).pathname });
  for (let index = 0; index < 4; index += 1)
    await page.getByRole("button", { name: /Next/ }).click();
  assert(
    await page
      .getByRole("heading", { name: "Let everyone follow the reviewed version." })
      .isVisible(),
    "desktop: onboarding did not reach the latest-version page",
  );
  await page.screenshot({ path: new URL("r2-desktop-tour-final.png", screenshotRoot).pathname });
  await page.getByRole("button", { name: /Enter the public Atlas/ }).click();
  assert(await page.locator("#graph-title").isVisible(), "desktop: onboarding did not enter Graph");

  await tourTrigger.click();
  await page.keyboard.press("Escape");
  assert(
    await tourTrigger.evaluate((element) => document.activeElement === element),
    "desktop: onboarding Escape did not restore trigger focus",
  );
  await page.goto(`${nodeBase}/?tour=1&tourStep=3#graph`, { waitUntil: "networkidle" });
  assert(
    await page.getByRole("heading", { name: "Good edits should not stay isolated." }).isVisible(),
    "desktop: deterministic onboarding step link unavailable",
  );
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: /Manage skills, Govern the shelf/ }).click();
  assert(
    await page.getByRole("heading", { name: "Manage skills" }).isVisible(),
    "desktop: graph selection did not update the preview",
  );
  await page.getByRole("button", { name: /Govern the shelf 2/ }).click();
  assert(
    (await page
      .getByRole("button", { name: /Govern the shelf 2/ })
      .getAttribute("aria-pressed")) === "true",
    "desktop: taxonomy filter did not activate",
  );

  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page.locator("#library-search").fill("no-such-skill");
  assert(await page.locator(".empty-state").isVisible(), "desktop: library empty state missing");
  await page.getByRole("button", { name: "Reset library" }).click();
  await page.getByRole("button", { name: /Manage skills 27 demo refs/ }).click();
  assert(
    await page.getByRole("heading", { name: "Manage skills" }).isVisible(),
    "desktop: persistent library detail did not update",
  );
  await page.getByRole("button", { name: "Edit shape" }).click();
  assert(
    await page.getByRole("button", { name: "Save to Git" }).isDisabled(),
    "desktop: public save action was enabled",
  );
  assert(
    await page.getByText("Editing is denied in the public Atlas.").isVisible(),
    "desktop: edit denial was not visible",
  );
  await page.screenshot({
    path: new URL("r2-desktop-library-edit.png", screenshotRoot).pathname,
    fullPage: true,
  });

  await page.getByRole("button", { name: "Usage", exact: true }).click();
  assert(
    await page.getByText("DEMO DATA", { exact: true }).isVisible(),
    "desktop: demo usage label missing",
  );
  assert(
    await page.getByRole("heading", { name: "Most used" }).isVisible(),
    "desktop: ranked usage missing",
  );
  assert(
    await page.getByRole("heading", { name: /Quiet/ }).isVisible(),
    "desktop: quiet skills missing",
  );
  await page.locator(".activity-log summary").click();
  assert(
    await page.getByText("NOT LIVE", { exact: true }).isVisible(),
    "desktop: activity fixture label missing",
  );
  await page.screenshot({ path: new URL("r2-desktop-usage.png", screenshotRoot).pathname });

  const askTrigger = page.getByRole("button", { name: "Ask the Atlas", exact: true });
  await askTrigger.click();
  await page.locator("#ask-input").fill("where is the canonical git source?");
  await page.getByRole("button", { name: "Ask bundled index" }).click();
  assert(
    await page.getByRole("heading", { name: "Start with the source path" }).isVisible(),
    "desktop: deterministic bundled Ask answer missing",
  );
  await page.screenshot({ path: new URL("r2-desktop-ask.png", screenshotRoot).pathname });
  await page.getByRole("button", { name: "Close Ask the Atlas" }).click();
  await page.waitForFunction(() => document.activeElement?.classList.contains("ask-fab"));
  assert(
    await askTrigger.evaluate((element) => document.activeElement === element),
    "desktop: Ask close did not restore floating-control focus",
  );

  await page.keyboard.press("Control+K");
  await page.locator('.search-dialog input[aria-label="Search skills"]').fill("clarify");
  assert(
    await page.locator(".search-results").isVisible(),
    "desktop: global search results missing",
  );
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.activeElement?.classList.contains("search-trigger"));
  assert(
    await page
      .getByRole("button", { name: "Search skills" })
      .evaluate((element) => document.activeElement === element),
    "desktop: search Escape did not restore trigger focus",
  );

  await page.getByRole("button", { name: "Public source" }).click();
  await page.getByRole("radio", { name: /Provider token/ }).check();
  await page.getByRole("button", { name: "Preview safe connection" }).click();
  assert(
    await page.getByText("no provider action was taken", { exact: false }).isVisible(),
    "desktop: setup provider denial truth missing",
  );
  assert(
    await page.getByRole("heading", { name: "Capability boundary" }).isVisible(),
    "desktop: static/Node capability boundary missing",
  );
  await page.getByRole("button", { name: "error", exact: true }).click();
  assert(
    await page.getByText("Source read failed", { exact: true }).isVisible(),
    "desktop: error fixture missing",
  );
  await page.screenshot({
    path: new URL("r2-desktop-setup.png", screenshotRoot).pathname,
    fullPage: true,
  });
}

async function exerciseMobile(page) {
  await page.goto(`${nodeBase}/#graph`, { waitUntil: "networkidle" });
  await page.waitForSelector("#graph-title");
  await checkCommon(page, "mobile-node");
  await page.locator("main#main").focus();

  const reverseTabTrail = [];
  for (let index = 0; index < 9; index += 1) {
    await page.keyboard.press("Shift+Tab");
    reverseTabTrail.push(
      await page.locator("body").evaluate(() => {
        const active = document.activeElement;
        const rail = document.querySelector("aside.rail");
        return {
          tag: active?.tagName ?? "none",
          name:
            active?.getAttribute("aria-label") ?? active?.textContent?.trim().slice(0, 40) ?? "",
          insideRail: Boolean(active && rail?.contains(active)),
        };
      }),
    );
  }
  assert(
    !reverseTabTrail.some((entry) => entry.insideRail),
    "mobile: reverse tab order entered the closed rail",
  );
  assert(
    reverseTabTrail.some((entry) => entry.name === "Open navigation"),
    "mobile: reverse tab order did not reach the menu control",
  );

  const closedRail = await page.locator("aside.rail").evaluate((rail) => {
    const firstControl = rail.querySelector("button");
    if (firstControl instanceof HTMLElement) firstControl.focus();
    return {
      ariaHidden: rail.getAttribute("aria-hidden"),
      inert: rail.inert,
      programmaticFocusInsideRail: rail.contains(document.activeElement),
    };
  });
  assert(closedRail.ariaHidden === "true", "mobile: closed rail remained exposed");
  assert(closedRail.inert, "mobile: closed rail remained focusable");
  assert(!closedRail.programmaticFocusInsideRail, "mobile: closed rail accepted direct focus");

  const menu = page.getByRole("button", { name: "Open navigation" });
  await menu.focus();
  await menu.click();
  const openRail = await page.locator("aside.rail").evaluate((rail) => ({
    ariaHidden: rail.getAttribute("aria-hidden"),
    inert: rail.inert,
  }));
  assert(!openRail.inert, "mobile: opened rail remained inert");
  assert(openRail.ariaHidden !== "true", "mobile: opened rail remained hidden");
  await page.getByRole("button", { name: /Govern the shelf 2/ }).focus();
  assert(
    await page
      .getByRole("button", { name: /Govern the shelf 2/ })
      .evaluate((element) => document.activeElement === element),
    "mobile: opened taxonomy could not receive focus",
  );
  await page.locator(".rail-close").click();
  await page.waitForFunction(
    () => document.activeElement?.getAttribute("aria-label") === "Open navigation",
  );
  assert(
    await menu.evaluate((element) => document.activeElement === element),
    "mobile: closing taxonomy did not restore menu focus",
  );

  const tourTrigger = page.getByRole("button", { name: "Replay Atlas onboarding" });
  await tourTrigger.click();
  assert(
    (await page.locator(".tour-progress-row p").textContent())?.includes("Step 1 of 5"),
    "mobile: onboarding unavailable",
  );
  await page.getByRole("button", { name: /Next/ }).click();
  await page.screenshot({ path: new URL("r2-mobile-tour.png", screenshotRoot).pathname });
  await page.keyboard.press("Escape");
  assert(
    await tourTrigger.evaluate((element) => document.activeElement === element),
    "mobile: onboarding Escape did not restore focus",
  );

  await page.screenshot({
    path: new URL("r2-mobile-graph.png", screenshotRoot).pathname,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page.getByRole("button", { name: /Manage skills 27 demo refs/ }).click();
  await page.getByRole("heading", { name: "Manage skills" }).scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Edit shape" }).click();
  assert(
    await page.getByRole("button", { name: "Save to Git" }).isDisabled(),
    "mobile: public save action was enabled",
  );
  await page.locator(".permission").scrollIntoViewIfNeeded();
  await page.screenshot({ path: new URL("r2-mobile-library-edit.png", screenshotRoot).pathname });

  const askTrigger = page.getByRole("button", { name: "Ask the Atlas", exact: true });
  await askTrigger.click();
  await page.waitForFunction(() => document.activeElement?.id === "ask-input");
  assert(
    await page.locator("#ask-input").evaluate((element) => document.activeElement === element),
    "mobile: Ask input did not receive focus",
  );
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.activeElement?.classList.contains("ask-fab"));
  assert(
    await askTrigger.evaluate((element) => document.activeElement === element),
    "mobile: Ask Escape did not restore focus",
  );

  const result = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
  }));
  assert(result.width <= result.viewport, "mobile: horizontal overflow after critical journey");
  assert(result.reducedMotion, "mobile: reduced-motion emulation was not active");
  observations.push({
    label: "mobile-drawer-a11y",
    reverseTabTrail,
    closedRail,
    openRail,
    focusRestored: true,
    ...result,
  });
}

async function exerciseStatic(page) {
  let apiRequests = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/")) apiRequests += 1;
  });
  await page.goto(staticBase, { waitUntil: "networkidle" });
  assert(
    await page.locator(".tour-dialog").isVisible(),
    "static: first visit did not open onboarding",
  );
  assert(
    await page.getByText("Step 1 of 5", { exact: true }).isVisible(),
    "static: first-visit onboarding progress missing",
  );
  await page.getByRole("button", { name: "Skip tour" }).click();
  await page.locator("#graph-title").waitFor({ state: "visible" });
  await checkCommon(page, "static-public");
  assert(apiRequests === 0, "static: public build attempted an API request");
  assert(
    (await page.locator(".source-warning").count()) === 0,
    "static: false live-source warning shown",
  );
  assert(
    await page.getByRole("button", { name: "Public source" }).isVisible(),
    "static: bundled source status missing",
  );
  await page.getByRole("button", { name: "Library", exact: true }).click();
  assert(
    await page.getByRole("heading", { name: "Clarify" }).isVisible(),
    "static: Library detail missing",
  );
  await page.getByRole("button", { name: "Usage", exact: true }).click();
  assert(
    await page.getByText("DEMO DATA", { exact: true }).isVisible(),
    "static: Usage unavailable",
  );
  await page.getByRole("button", { name: "Ask the Atlas", exact: true }).click();
  assert(await page.locator("#ask-input").isVisible(), "static: deterministic Ask unavailable");
  await page.keyboard.press("Escape");
  await page.screenshot({
    path: new URL("r2-static-public.png", screenshotRoot).pathname,
    fullPage: true,
  });
  observations.push({ label: "static-public-source", apiRequests, falseWarning: false });
}

const nodeServer = spawn(process.execPath, ["dist/server/index.js"], {
  cwd: root,
  env: { ...process.env, PORT: String(nodePort), HOST: "127.0.0.1" },
  stdio: ["ignore", "ignore", "ignore"],
});
const staticServer = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    String(staticPort),
    "--outDir",
    "dist/static",
  ],
  { cwd: root, stdio: ["ignore", "ignore", "ignore"] },
);

try {
  await mkdir(screenshotRoot, { recursive: true });
  await mkdir(runtimeRoot, { recursive: true });
  await Promise.all([waitForUrl(`${nodeBase}/api/health`), waitForUrl(staticBase)]);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    attachBrowserDiagnostics(desktop, "desktop", nodeBase);
    await exerciseDesktop(desktop);
    await desktop.close();

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await mobile.emulateMedia({ reducedMotion: "reduce" });
    attachBrowserDiagnostics(mobile, "mobile", nodeBase);
    await exerciseMobile(mobile);
    await mobile.close();

    const staticPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    attachBrowserDiagnostics(staticPage, "static", staticBase);
    await exerciseStatic(staticPage);
    await staticPage.close();
  } finally {
    await browser.close();
  }
} catch (error) {
  failures.push(error instanceof Error ? error.message : "browser proof failed");
} finally {
  nodeServer.kill("SIGTERM");
  staticServer.kill("SIGTERM");
}

await writeFile(
  new URL("browser-proof.json", runtimeRoot),
  JSON.stringify(
    {
      nodeBase,
      staticBase,
      viewport: { desktop: "1440x1000", mobile: "390x844" },
      observations,
      failures,
    },
    null,
    2,
  ),
);

if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    "PASS r2 browser proof: Node/static desktop/mobile journeys, focus, denial, and client safety",
  );
}
