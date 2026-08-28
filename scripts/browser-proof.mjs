import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const nodePort = 4175;
const staticRootPort = 4176;
const staticPrefixedPort = 4177;
const nodeBase = `http://127.0.0.1:${nodePort}`;
const staticBase = `http://127.0.0.1:${staticRootPort}/`;
const staticPrefix = "/Skills-Atlas/";
const staticPrefixedBase = `http://127.0.0.1:${staticPrefixedPort}${staticPrefix}`;
const root = fileURLToPath(new URL("..", import.meta.url));
const screenshotRoot = new URL("../proof/screenshots/", import.meta.url);
const runtimeRoot = new URL("../proof/runtime/", import.meta.url);
const failures = [];
const observations = [];

const mockMarkdown = `---
name: release-notes
description: Prepare concise release notes from reviewed repository changes.
category: Operations
relations: []
---

# Release notes

This deterministic browser mock proves the complete permission-aware reading and proposal shape.

![tracking image](https://tracking.invalid/pixel.png)

<script>window.__unsafe_markdown_executed = true</script>

## Review

- Keep the source complete.
- Open a branch and pull request.
`;

const mockWritablePack = {
  kind: "atlas-pack",
  id: "example/team-skills",
  repository: "example/team-skills",
  repositoryUrl: "https://github.com/example/team-skills",
  defaultBranch: "main",
  revision: "a".repeat(40),
  access: "write",
  source: "github",
  snapshotLabel: "GitHub · aaaaaaa",
  components: ["skills", "apps", "mcpServers"],
  skills: [
    {
      slug: "release-notes",
      name: "Release notes",
      description: "Prepare concise release notes from reviewed repository changes.",
      category: "Operations",
      sourcePath: "skills/release-notes/SKILL.md",
      markdown: mockMarkdown,
      relations: [],
      tone: "mint",
    },
  ],
};

const canonicalRevision = "d".repeat(40);
const canonicalTree = "e".repeat(40);
const canonicalSkillDefinitions = [
  ["clarify", "Clarify"],
  ["manage-skills", "Manage skills"],
  ["orchestrate-workers", "Orchestrate workers"],
  ["route-models", "Route models"],
  ["shape-offer", "Shape offer"],
];
const canonicalSkillSources = new Map(
  canonicalSkillDefinitions.map(([slug, name]) => [
    slug,
    [
      "---",
      `name: ${slug}`,
      `description: Deterministic anonymous-read fixture for ${name}.`,
      "relations: []",
      "---",
      "",
      `# ${name}`,
      "",
      "This browser-only fixture proves the public startup path without copying unpublished source.",
    ].join("\n"),
  ]),
);
const mockCanonicalPack = {
  kind: "atlas-pack",
  id: "onlinesourdough/skills",
  repository: "onlinesourdough/Skills",
  repositoryUrl: "https://github.com/onlinesourdough/Skills",
  defaultBranch: "main",
  revision: canonicalRevision,
  access: "read",
  source: "github",
  snapshotLabel: "GitHub · ddddddd",
  components: ["skills"],
  skills: canonicalSkillDefinitions.map(([slug, name], index) => ({
    slug,
    name,
    description: `Deterministic anonymous-read fixture for ${name}.`,
    category: "Uncategorised",
    sourcePath: `skills/${slug}/SKILL.md`,
    markdown: canonicalSkillSources.get(slug),
    relations: [],
    tone: ["blue", "mint", "gold", "violet", "clay"][index],
  })),
};

async function interceptCanonicalNodeRead(page, options = {}) {
  const state = { failuresRemaining: options.failures ?? 0, successfulReads: 0 };
  await page.route(`${nodeBase}/api/packs/import?*`, async (route) => {
    const repository = new URL(route.request().url()).searchParams.get("repository");
    if (repository?.toLocaleLowerCase() !== "onlinesourdough/skills") {
      await route.continue();
      return;
    }
    if (state.failuresRemaining > 0) {
      state.failuresRemaining -= 1;
      await route.fulfill({
        status: options.failureStatus ?? 404,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: options.failureCode ?? "repository-unavailable",
            message: "Repository unavailable or private.",
          },
        }),
      });
      return;
    }
    state.successfulReads += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockCanonicalPack),
    });
  });
  return state;
}

async function interceptCanonicalGitHubRead(page) {
  const evidence = { requests: [], misses: [] };
  await page.route("https://api.github.com/**", async (route) => {
    const url = new URL(route.request().url());
    evidence.requests.push(url.pathname);
    const repositoryPath = "/repos/onlinesourdough/Skills";
    let body;
    if (url.pathname === repositoryPath) {
      body = {
        full_name: "onlinesourdough/Skills",
        html_url: "https://github.com/onlinesourdough/Skills",
        default_branch: "main",
        permissions: { pull: true, push: false },
      };
    } else if (url.pathname === `${repositoryPath}/branches/main`) {
      body = { commit: { sha: canonicalRevision, commit: { tree: { sha: canonicalTree } } } };
    } else if (url.pathname === `${repositoryPath}/git/trees/${canonicalTree}`) {
      body = {
        truncated: false,
        tree: [
          {
            path: ".codex-plugin/plugin.json",
            type: "blob",
            sha: "f".repeat(40),
            size: 23,
          },
          ...canonicalSkillDefinitions.map(([slug], index) => ({
            path: `skills/${slug}/SKILL.md`,
            type: "blob",
            sha: String(index + 1).repeat(40),
            size: canonicalSkillSources.get(slug).length,
          })),
        ],
      };
    } else if (url.pathname === `${repositoryPath}/git/blobs/${"f".repeat(40)}`) {
      body = {
        encoding: "base64",
        content: Buffer.from(JSON.stringify({ skills: "./skills/" }), "utf8").toString("base64"),
      };
    } else {
      const blobSha = url.pathname.split("/").at(-1);
      const index = canonicalSkillDefinitions.findIndex(
        (_definition, candidate) => String(candidate + 1).repeat(40) === blobSha,
      );
      const slug = canonicalSkillDefinitions[index]?.[0];
      if (!slug) {
        evidence.misses.push(url.pathname);
        await route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
        return;
      }
      body = {
        encoding: "base64",
        content: Buffer.from(canonicalSkillSources.get(slug), "utf8").toString("base64"),
      };
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  return evidence;
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function screenshotPath(name) {
  return new URL(name, screenshotRoot).pathname;
}

async function waitForUrl(url) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
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
  const expectedLocalResponses = [];
  const diagnostics = {
    label,
    pageErrors: [],
    consoleErrors: [],
    consoleWarnings: [],
    localRequestFailures: [],
    localErrorResponses: [],
    expectedLocalResponses: [],
  };
  page.on("pageerror", (error) => {
    diagnostics.pageErrors.push(error.message);
    failures.push(`${label}: uncaught page error: ${error.message}`);
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      if (
        message.text().startsWith("Failed to load resource:") &&
        (expectedLocalResponses.length > 0 || diagnostics.expectedLocalResponses.length > 0)
      ) {
        return;
      }
      diagnostics.consoleErrors.push(message.text());
      failures.push(`${label}: browser console error: ${message.text()}`);
    }
    if (message.type() === "warning") {
      diagnostics.consoleWarnings.push(message.text());
      failures.push(`${label}: browser console warning: ${message.text()}`);
    }
  });
  page.on("requestfailed", (request) => {
    if (request.url().startsWith(origin)) {
      diagnostics.localRequestFailures.push(request.url());
      failures.push(`${label}: local request failed: ${request.url()}`);
    }
  });
  page.on("response", (response) => {
    if (!response.url().startsWith(origin) || response.status() < 400) return;
    const path = new URL(response.url()).pathname;
    const expectedIndex = expectedLocalResponses.findIndex(
      (expected) => expected.status === response.status() && expected.path === path,
    );
    if (expectedIndex >= 0) {
      const [expected] = expectedLocalResponses.splice(expectedIndex, 1);
      diagnostics.expectedLocalResponses.push(expected);
      return;
    }
    diagnostics.localErrorResponses.push({ path, status: response.status() });
    failures.push(`${label}: unexpected local response ${response.status()}: ${path}`);
  });
  return {
    diagnostics,
    allow(status, path) {
      expectedLocalResponses.push({ status, path });
    },
    finish() {
      for (const expected of expectedLocalResponses) {
        failures.push(
          `${label}: expected local response was not observed: ${expected.status} ${expected.path}`,
        );
      }
      observations.push(diagnostics);
    },
  };
}

function trackStaticNetwork(page, label, baseUrl) {
  const base = new URL(baseUrl);
  const evidence = {
    label,
    baseUrl,
    expectedPrefix: base.pathname,
    localApiRequests: [],
    githubRequests: [],
    forbiddenExternalRequests: [],
    localResponses: [],
  };
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin === base.origin && /(?:^|\/)api(?:\/|$)/u.test(url.pathname)) {
      evidence.localApiRequests.push(url.pathname);
    } else if (url.origin === "https://api.github.com") {
      evidence.githubRequests.push(url.pathname);
    } else if (url.origin !== base.origin) {
      evidence.forbiddenExternalRequests.push(url.origin);
    }
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.origin !== base.origin) return;
    const resourceType = response.request().resourceType();
    const kind = url.pathname.endsWith("/favicon.svg") ? "favicon" : resourceType;
    evidence.localResponses.push({ kind, path: url.pathname, status: response.status() });
  });
  return evidence;
}

function recordStaticNetworkEvidence(evidence) {
  assert(
    evidence.localApiRequests.length === 0,
    `${evidence.label}: static build called local API`,
  );
  assert(
    evidence.githubRequests.length >= 4,
    `${evidence.label}: static default did not exercise the anonymous GitHub adapter`,
  );
  assert(
    evidence.forbiddenExternalRequests.length === 0,
    `${evidence.label}: static default contacted an unexpected external origin`,
  );
  for (const kind of ["document", "script", "stylesheet", "font", "favicon"]) {
    assert(
      evidence.localResponses.some(
        (response) => response.kind === kind && response.status >= 200 && response.status < 400,
      ),
      `${evidence.label}: no successful local ${kind} response`,
    );
  }
  const assets = evidence.localResponses.filter((response) =>
    ["script", "stylesheet", "font", "favicon"].includes(response.kind),
  );
  assert(
    assets.every((response) => response.path.startsWith(evidence.expectedPrefix)),
    `${evidence.label}: asset escaped ${evidence.expectedPrefix}`,
  );
  observations.push(evidence);
}

async function markTourComplete(page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("skill-atlas-tour-complete", "1");
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
        document.querySelector("aside.taxonomy-rail"),
    ),
    removedSurfaceText: /Ask the Atlas|Current source|write denied|state fixture/i.test(
      document.body.textContent ?? "",
    ),
    legacyPluginTerm:
      /\bPacks?\b/u.test(document.body.innerText) ||
      [...document.querySelectorAll("[aria-label], [title], [placeholder]")].some((element) =>
        /\bPacks?\b/u.test(
          ["aria-label", "title", "placeholder"]
            .map((name) => element.getAttribute(name) ?? "")
            .join(" "),
        ),
      ),
  }));
  assert(result.width <= result.viewport, `${label}: horizontal overflow`);
  assert(result.fonts, `${label}: local Geist font did not load`);
  assert(!result.secret, `${label}: secret marker in client DOM`);
  assert(result.landmarks, `${label}: semantic shell landmark missing`);
  assert(!result.removedSurfaceText, `${label}: removed setup/demo surface remains`);
  assert(!result.legacyPluginTerm, `${label}: legacy Pack terminology remains user-visible`);
  assert(
    await page.getByRole("button", { name: "Replay Skill Atlas onboarding" }).isVisible(),
    `${label}: Skill Atlas product label missing`,
  );
  const sourceLink = page.getByRole("link", { name: "View Skills Atlas source on GitHub" });
  assert(await sourceLink.isVisible(), `${label}: GitHub source link missing`);
  assert(
    (await sourceLink.getAttribute("href")) === "https://github.com/onlinesourdough/Skills-Atlas" &&
      (await sourceLink.getAttribute("target")) === "_blank" &&
      (await sourceLink.getAttribute("rel"))?.includes("noopener"),
    `${label}: GitHub source link target or safe-new-tab contract changed`,
  );
  assert(
    (await page.getByRole("button", { name: "Ask the Atlas" }).count()) === 0,
    `${label}: Ask the Atlas was not removed`,
  );
  observations.push({ label, ...result });
}

async function exerciseDesktop(page, diagnostics) {
  const canonicalRead = await interceptCanonicalNodeRead(page);
  await page.goto(`${nodeBase}/?tour=1&tourStep=1#graph`, { waitUntil: "networkidle" });
  await page.locator(".tour-dialog").waitFor({ state: "visible" });
  await checkCommon(page, "desktop-node");

  const onboardingPresentation = await page.evaluate(() => {
    const dialog = document.querySelector(".tour-dialog");
    const card = document.querySelector(".tour-card");
    const controls = document.querySelector(".tour-actions");
    if (!(dialog instanceof HTMLElement) || !(card instanceof HTMLElement)) return null;
    const dialogRect = dialog.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const controlsRect = controls?.getBoundingClientRect();
    return {
      dialog: {
        width: dialogRect.width,
        height: dialogRect.height,
        background: getComputedStyle(dialog).backgroundColor,
      },
      card: {
        width: cardRect.width,
        height: cardRect.height,
        top: cardRect.top,
        horizontalOffset: Math.abs(cardRect.left - (window.innerWidth - cardRect.width) / 2),
        verticalOffset: Math.abs(cardRect.top - (window.innerHeight - cardRect.height) / 2),
      },
      controlsInsideCard: Boolean(
        controlsRect && controlsRect.top >= cardRect.top && controlsRect.bottom <= cardRect.bottom,
      ),
      skipInsideCard: card.contains(dialog.querySelector(".tour-skip")),
    };
  });
  assert(
    onboardingPresentation?.dialog.width === 1440 &&
      onboardingPresentation.dialog.height === 900 &&
      onboardingPresentation.dialog.background === "rgb(248, 242, 232)",
    "desktop: onboarding is not a standalone warm-neutral canvas",
  );
  assert(
    Boolean(
      onboardingPresentation &&
        onboardingPresentation.card.width >= 520 &&
        onboardingPresentation.card.width <= 600 &&
        onboardingPresentation.card.horizontalOffset < 1 &&
        onboardingPresentation.card.verticalOffset < 1,
    ),
    "desktop: onboarding card is not the centered 520–600px composition",
  );
  assert(
    onboardingPresentation?.controlsInsideCard && onboardingPresentation.skipInsideCard,
    "desktop: onboarding controls are not contained by the card",
  );

  const onboarding = [
    "Useful instructions end up everywhere.",
    "A good improvement can stay trapped in one copy.",
    "Git becomes the source everyone can return to.",
    "Work with the library without living in GitHub.",
    "The current version can reach the whole team.",
  ];
  for (const [index, heading] of onboarding.entries()) {
    assert(
      (await page
        .getByRole("button", { name: `Onboarding step ${index + 1}` })
        .getAttribute("aria-current")) === "step",
      `desktop: onboarding progress missing at step ${index + 1}`,
    );
    assert(
      await page.getByRole("heading", { name: heading }).isVisible(),
      `desktop: onboarding content missing at step ${index + 1}`,
    );
    if (index === 0) {
      await page.screenshot({ path: screenshotPath("r4-desktop-onboarding-start.png") });
    }
    if (index < onboarding.length - 1) {
      await page.getByRole("button", { name: /Next/ }).click();
    }
  }
  assert(
    await page.getByRole("button", { name: "Explore Atlas" }).isVisible(),
    "desktop: Atlas onboarding action missing",
  );
  assert(
    await page.getByRole("button", { name: /Import repository/ }).isVisible(),
    "desktop: import onboarding action missing",
  );
  await page.screenshot({ path: screenshotPath("r4-desktop-onboarding-finish.png") });
  await page.getByRole("button", { name: "Explore Atlas" }).click();

  await page.locator("#graph-title").waitFor({ state: "visible" });
  const headerAlignment = await page.evaluate(() => {
    const brand = document.querySelector(".brand-cell");
    const rail = document.querySelector(".taxonomy-rail");
    const mainHeader = document.querySelector(".topbar-main");
    const main = document.querySelector(".product-main");
    if (
      !(brand instanceof HTMLElement) ||
      !(rail instanceof HTMLElement) ||
      !(mainHeader instanceof HTMLElement) ||
      !(main instanceof HTMLElement)
    )
      return null;
    const brandRect = brand.getBoundingClientRect();
    const railRect = rail.getBoundingClientRect();
    const mainHeaderRect = mainHeader.getBoundingClientRect();
    const mainRect = main.getBoundingClientRect();
    return {
      brandWidth: brandRect.width,
      railWidth: railRect.width,
      headerMainX: mainHeaderRect.left,
      canvasX: mainRect.left,
    };
  });
  assert(
    Boolean(
      headerAlignment &&
        Math.abs(headerAlignment.brandWidth - headerAlignment.railWidth) < 1 &&
        Math.abs(headerAlignment.headerMainX - headerAlignment.canvasX) < 1,
    ),
    "desktop: header brand/sidebar and tabs/canvas grid lines diverged",
  );
  assert(
    (await page.locator(".graph-cluster").count()) === 1,
    "desktop: graph category count is not source-derived",
  );
  assert(
    (await page.locator(".skill-node").count()) === 5,
    "desktop: graph includes non-skill nodes or omits a skill",
  );
  const graphLabelsAreDistinct = await page.locator(".skill-node text").evaluateAll((labels) => {
    const boxes = labels.map((label) => label.getBoundingClientRect());
    return boxes.every((box, index) =>
      boxes.every(
        (candidate, candidateIndex) =>
          candidateIndex === index ||
          box.right <= candidate.left ||
          candidate.right <= box.left ||
          box.bottom <= candidate.top ||
          candidate.bottom <= box.top,
      ),
    );
  });
  assert(graphLabelsAreDistinct, "desktop: canonical graph labels overlap");
  assert(
    (await page.locator(".graph-edge").count()) === 0,
    "desktop: graph did not render every unique loaded relation exactly once",
  );
  assert(
    canonicalRead.successfulReads === 1,
    "desktop: canonical startup read did not complete once",
  );
  await page.screenshot({ path: screenshotPath("r4-desktop-graph-loaded-default.png") });
  const topologyBeforeEmphasis = {
    clusters: await page.locator(".graph-cluster").count(),
    nodes: await page.locator(".skill-node").count(),
    edges: await page.locator(".graph-edge").count(),
  };
  await page.getByRole("button", { name: /^Uncategorised/ }).click();
  const topologyAfterEmphasis = {
    clusters: await page.locator(".graph-cluster").count(),
    nodes: await page.locator(".skill-node").count(),
    edges: await page.locator(".graph-edge").count(),
  };
  assert(
    JSON.stringify(topologyBeforeEmphasis) === JSON.stringify(topologyAfterEmphasis),
    "desktop: category emphasis filtered graph topology",
  );
  assert(
    (await page.locator(".skill-node.category-emphasized").count()) === 5,
    "desktop: category selection did not create visual emphasis",
  );
  await page.screenshot({ path: screenshotPath("r4-desktop-graph-category-emphasis.png") });
  await page.getByRole("button", { name: /^All skills/ }).click();
  assert(
    (await page.locator(".skill-node.category-muted").count()) === 0,
    "desktop: All skills did not restore full graph emphasis",
  );
  const graphTransform = page.locator(".relationship-graph > g");
  const beforeZoom = await graphTransform.getAttribute("transform");
  await page.getByRole("button", { name: "Zoom in" }).click();
  const afterZoom = await graphTransform.getAttribute("transform");
  assert(beforeZoom !== afterZoom, "desktop: graph zoom control had no effect");
  await page.getByRole("button", { name: "Reset" }).click();
  await page.getByRole("button", { name: /Clarify, 0 outgoing relations/ }).click();
  assert(
    await page.locator(".graph-selection strong").getByText("Clarify", { exact: true }).isVisible(),
    "desktop: graph selection did not update",
  );
  await page.screenshot({ path: screenshotPath("r4-desktop-graph-selection.png") });

  await page.getByRole("button", { name: "Library", exact: true }).click();
  assert(
    (await page.locator(".skill-list > button").count()) === 5,
    "desktop: Library does not list the complete canonical plugin",
  );
  assert(
    await page.getByRole("heading", { name: "Clarify", level: 2 }).isVisible(),
    "desktop: selected skill reader missing",
  );
  const calmLibrary = await page.evaluate(() => {
    const row = document.querySelector(".skill-list > button");
    const selected = document.querySelector(".skill-list > button.selected");
    const sourceDetails = document.querySelector(".reader-source");
    if (!(row instanceof HTMLElement) || !(selected instanceof HTMLElement)) return null;
    return {
      rowBorderWidth: getComputedStyle(row).borderTopWidth,
      selectedBackground: getComputedStyle(selected).backgroundColor,
      progressiveSource: sourceDetails instanceof HTMLDetailsElement && !sourceDetails.open,
      fourSourceBoxes: document.querySelectorAll(".skill-facts > *").length,
    };
  });
  assert(
    calmLibrary?.rowBorderWidth === "0px" &&
      calmLibrary.selectedBackground === "rgb(239, 226, 210)" &&
      calmLibrary.progressiveSource &&
      calmLibrary.fourSourceBoxes === 0,
    "desktop: Library did not retain the calm borderless list and progressive source treatment",
  );
  await page.screenshot({ path: screenshotPath("r4-desktop-library-rendered.png") });
  await page.locator(".reader-source > summary").click();
  assert(
    await page.getByText("onlinesourdough/Skills ·").isVisible(),
    "desktop: canonical source identity is not visible in Library",
  );
  assert(
    await page.getByText(canonicalRevision.slice(0, 12), { exact: true }).isVisible(),
    "desktop: observed revision is not visible in Library",
  );
  assert(
    await page.locator(".reader-source").getByText("Read only", { exact: true }).isVisible(),
    "desktop: anonymous Library access is not read-only",
  );
  await page.getByRole("tab", { name: "Full source" }).click();
  const source = await page.locator(".source-code").textContent();
  assert(source?.startsWith("---\nname: clarify"), "desktop: full Markdown frontmatter missing");
  assert(
    source?.includes("browser-only fixture proves the public startup path"),
    "desktop: full Markdown body was truncated",
  );
  await page.screenshot({ path: screenshotPath("r4-desktop-library-source.png") });

  const filter = page.getByLabel("Filter the skill library");
  await filter.fill("no matching skill");
  assert(
    await page.getByText("No matching skills", { exact: true }).isVisible(),
    "desktop: Library empty state missing",
  );
  await page.screenshot({ path: screenshotPath("r4-desktop-library-empty.png") });
  await page.getByRole("button", { name: "Clear filters" }).click();

  await page.keyboard.press("Control+K");
  const search = page.getByLabel("Search active skill plugin");
  await search.fill("models");
  assert(
    (await page.locator(".search-results > button").count()) > 0,
    "desktop: global search returned no source-grounded result",
  );
  await page.keyboard.press("Escape");
  await page.waitForFunction(
    () => document.activeElement?.getAttribute("aria-label") === "Search skills",
  );

  await page.getByRole("button", { name: "Usage", exact: true }).click();
  assert(
    await page.getByRole("heading", { name: "Usage data isn’t connected." }).isVisible(),
    "desktop: honest usage empty state missing",
  );
  assert(
    (await page.locator(".health-row").count()) === 3,
    "desktop: repository health signals missing",
  );
  assert(
    (await page.getByText("Never used", { exact: true }).count()) === 0,
    "desktop: unsupported never-used claim shown",
  );
  await page.screenshot({ path: screenshotPath("r4-desktop-usage-health.png") });

  await page.getByRole("button", { name: /onlinesourdough\/Skills Manage plugins/ }).click();
  assert(
    await page.getByText("A plugin is a Git-backed collection.").isVisible(),
    "desktop: concise plugin guide missing",
  );
  diagnostics.allow(400, "/api/packs/import");
  await page.getByRole("textbox", { name: "GitHub repository" }).fill("not a repository");
  await page.getByRole("button", { name: "Import repository" }).click();
  await page.getByRole("alert").waitFor({ state: "visible" });
  assert(
    await page.getByRole("alert").getByText("Use a repository in owner/name format.").isVisible(),
    "desktop: bounded import error missing",
  );
  assert(
    await page
      .getByText("Built-in fictional demo · available offline · not repository data")
      .isVisible(),
    "desktop: safe Offline example truth label missing",
  );
  assert(
    (await page.getByText("Skills", { exact: true }).count()) === 0,
    "desktop: redundant Skills component label duplicates the skill count",
  );
  assert(
    await page.getByRole("heading", { name: "onlinesourdough/Skills", level: 3 }).isVisible(),
    "desktop: canonical plugin identity missing",
  );
  assert(
    await page
      .locator(".pack-list article")
      .filter({ has: page.getByRole("heading", { name: "onlinesourdough/Skills", level: 3 }) })
      .getByText("Read only", { exact: true })
      .isVisible(),
    "desktop: canonical anonymous access is not read-only",
  );
  await page.screenshot({ path: screenshotPath("r4-desktop-plugins-loaded-and-error.png") });

  await page.evaluate(() => {
    window.location.hash = "#library";
  });
  await page.locator("#library-title").waitFor({ state: "visible" });
  assert(
    new URL(page.url()).hash === "#library",
    "desktop: same-document hash and rendered Library diverged",
  );
  await page.evaluate(() => {
    window.location.hash = "#not-an-atlas-view";
  });
  await page.locator("#graph-title").waitFor({ state: "visible" });
  assert(
    new URL(page.url()).hash === "#graph",
    "desktop: invalid hash did not normalize to the rendered Graph fallback",
  );
  await page.goBack();
  await page.locator("#library-title").waitFor({ state: "visible" });
  assert(
    new URL(page.url()).hash === "#library",
    "desktop: back navigation did not restore hash-authoritative Library state",
  );
  await page.goBack();
  await page.locator("#plugins-title").waitFor({ state: "visible" });
  assert(
    new URL(page.url()).hash === "#plugins",
    "desktop: back navigation did not restore hash-authoritative Plugins state",
  );

  await page.getByRole("button", { name: "Public", exact: true }).click();
  assert(
    await page.getByRole("heading", { name: "Public self-hosted edition" }).isVisible(),
    "desktop: honest account state missing",
  );
  assert(
    await page.getByText("No GitHub identity is claimed.").isVisible(),
    "desktop: account identity disclaimer missing",
  );
  await page.getByRole("button", { name: "Close account" }).click();

  observations.push({
    label: "desktop-journey",
    onboardingSteps: onboarding.length,
    graphSkills: 5,
    graphCategories: 1,
    categoryEmphasisPreservedTopology: true,
    fullMarkdown: true,
    search: true,
    usageConnected: false,
    importFailure: "invalid-repository",
    startup: "onlinesourdough/Skills anonymous fixture",
    account: "public-self-hosted",
  });
  diagnostics.finish();
}

async function exerciseMobile(page, diagnostics) {
  await interceptCanonicalNodeRead(page);
  await markTourComplete(page);
  await page.goto(`${nodeBase}/#graph`, { waitUntil: "networkidle" });
  await page.locator("#graph-title").waitFor({ state: "visible" });
  await checkCommon(page, "mobile-node");
  assert(
    !(await page.locator(".relationship-graph").isVisible()),
    "mobile: desktop graph remained visible",
  );
  assert(
    (await page.locator(".mobile-relationship-list > button").count()) === 5,
    "mobile: relationship fallback is incomplete",
  );
  await page.screenshot({ path: screenshotPath("r4-mobile-graph-loaded-default.png") });

  const rail = page.locator("aside.taxonomy-rail");
  const closedRail = await rail.evaluate((element) => ({
    ariaHidden: element.getAttribute("aria-hidden"),
    inert: element.inert,
  }));
  assert(
    closedRail.ariaHidden === "true" && closedRail.inert,
    "mobile: closed navigation is exposed",
  );
  const menu = page.getByRole("button", { name: "Open navigation" });
  await menu.click();
  assert(
    !(await rail.evaluate((element) => element.inert)),
    "mobile: open navigation remained inert",
  );
  await rail.getByRole("button", { name: "Close navigation" }).click();
  await page.waitForFunction(
    () => document.activeElement?.getAttribute("aria-label") === "Open navigation",
  );
  assert(
    await menu.evaluate((element) => document.activeElement === element),
    "mobile: navigation did not restore focus",
  );

  const tour = page.getByRole("button", { name: "Replay Skill Atlas onboarding" });
  await tour.click();
  await page.getByRole("button", { name: /Next/ }).click();
  assert(
    await page
      .getByRole("heading", { name: "A good improvement can stay trapped in one copy." })
      .isVisible(),
    "mobile: onboarding second causal step missing",
  );
  const mobileOnboarding = await page.locator(".tour-card").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      width: rect.width,
      horizontalOffset: Math.abs(rect.left - (window.innerWidth - rect.width) / 2),
      withinViewport: rect.top >= 0 && rect.bottom <= window.innerHeight,
    };
  });
  assert(
    mobileOnboarding.width === 360 &&
      mobileOnboarding.horizontalOffset < 1 &&
      mobileOnboarding.withinViewport,
    "mobile: onboarding card is not centered and usable",
  );
  await page.screenshot({ path: screenshotPath("r4-mobile-onboarding.png") });
  await page.keyboard.press("Escape");
  assert(
    await tour.evaluate((element) => document.activeElement === element),
    "mobile: onboarding did not restore focus",
  );

  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page.getByRole("button", { name: /Clarify Deterministic anonymous-read fixture/ }).click();
  await page.locator(".skill-reader").scrollIntoViewIfNeeded();
  assert(
    await page.getByRole("heading", { name: "Clarify", level: 2 }).isVisible(),
    "mobile: full skill reader unavailable",
  );
  await page.screenshot({ path: screenshotPath("r4-mobile-library-read.png") });

  await page.getByRole("button", { name: "Usage", exact: true }).click();
  assert(
    await page.getByRole("heading", { name: "Repository health" }).isVisible(),
    "mobile: repository health unavailable",
  );
  await page.screenshot({ path: screenshotPath("r4-mobile-usage-health.png") });

  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: /onlinesourdough\/Skills Manage plugins/ }).click();
  diagnostics.allow(400, "/api/packs/import");
  await page.getByRole("textbox", { name: "GitHub repository" }).fill("invalid");
  await page.getByRole("button", { name: "Import repository" }).click();
  await page.getByRole("alert").waitFor({ state: "visible" });
  assert(await page.getByRole("alert").isVisible(), "mobile: import failure state unavailable");
  await page.screenshot({ path: screenshotPath("r4-mobile-plugins-error.png") });

  const result = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
  }));
  assert(result.width <= result.viewport, "mobile: horizontal overflow after full journey");
  assert(result.reducedMotion, "mobile: reduced-motion emulation is inactive");
  observations.push({ label: "mobile-journey", closedRail, ...result });
  diagnostics.finish();
}

async function exerciseDefaultFallback(page, diagnostics) {
  diagnostics.allow(404, "/api/packs/import");
  const canonicalRead = await interceptCanonicalNodeRead(page, { failures: 1 });
  await markTourComplete(page);
  await page.goto(`${nodeBase}/#plugins`, { waitUntil: "networkidle" });
  await page.getByText("Live skills are unavailable. Showing Offline example.").waitFor();
  assert(
    (await page.locator(".default-load-status").count()) === 1,
    "fallback: startup failure created more than one status surface",
  );
  assert(
    await page.getByRole("heading", { name: "Offline example", level: 3 }).isVisible(),
    "fallback: fictional starter is not clearly labelled Offline example",
  );
  assert(
    await page
      .getByText("Built-in fictional demo · available offline · not repository data")
      .isVisible(),
    "fallback: offline content is attributed as repository truth",
  );
  await page.screenshot({ path: screenshotPath("r4-desktop-offline-fallback.png") });

  await page.getByRole("button", { name: "Retry" }).click();
  await page.getByRole("heading", { name: "onlinesourdough/Skills", level: 3 }).waitFor();
  assert(
    (await page.locator(".default-load-status").count()) === 0,
    "fallback: successful retry left the error status visible",
  );
  assert(canonicalRead.successfulReads === 1, "fallback: retry did not read the canonical plugin");

  await page.getByRole("textbox", { name: "GitHub repository" }).fill("onlinesourdough/Skills");
  await page.getByRole("button", { name: "Import repository" }).click();
  await page.getByRole("status").getByText("Plugin ready").waitFor();
  assert(
    (await page.getByRole("heading", { name: "onlinesourdough/Skills", level: 3 }).count()) === 1,
    "fallback: retry plus import duplicated the canonical plugin",
  );
  assert(
    (await page.getByRole("heading", { name: "Offline example", level: 3 }).count()) === 1,
    "fallback: retry removed the bounded offline recovery option",
  );
  await page.screenshot({ path: screenshotPath("r4-desktop-fallback-recovered.png") });
  observations.push({
    label: "canonical-default-fallback",
    initialFailure: "repository-unavailable",
    calmStatusCount: 1,
    retrySucceeded: true,
    canonicalPluginsAfterImport: 1,
  });
  diagnostics.finish();
}

async function exercisePermissionUi(page, diagnostics) {
  let proposalBody = null;
  const externalRequests = [];
  page.on("request", (request) => {
    const origin = new URL(request.url()).origin;
    if (origin !== new URL(nodeBase).origin) externalRequests.push(request.url());
  });
  await page.route(`${nodeBase}/api/session`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        kind: "atlas-session",
        mode: "self-hosted",
        authenticated: true,
        adminAvailable: true,
        providerAvailable: true,
      }),
    });
  });
  await page.route(`${nodeBase}/api/packs/import?*`, async (route) => {
    const repository = new URL(route.request().url()).searchParams.get("repository");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        repository?.toLocaleLowerCase() === "onlinesourdough/skills"
          ? mockCanonicalPack
          : mockWritablePack,
      ),
    });
  });
  await page.route(`${nodeBase}/api/proposals`, async (route) => {
    proposalBody = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        kind: "proposal",
        branch: "atlas/release-notes-proof-12345678",
        pullRequestUrl: "https://github.com/example/team-skills/pull/17",
        pullRequestNumber: 17,
      }),
    });
  });
  await markTourComplete(page);
  await page.goto(`${nodeBase}/#plugins`, { waitUntil: "networkidle" });
  assert(
    await page.getByRole("button", { name: "Admin", exact: true }).isVisible(),
    "permission UI: authenticated account state missing",
  );
  await page.getByRole("textbox", { name: "GitHub repository" }).fill("example/team-skills");
  await page.getByRole("button", { name: "Import repository" }).click();
  await page.getByRole("status").waitFor({ state: "visible" });
  assert(
    await page.getByText("Can edit", { exact: true }).isVisible(),
    "permission UI: verified write label missing",
  );
  assert(
    await page.getByRole("status").getByText("Plugin ready").isVisible(),
    "permission UI: import success missing",
  );
  assert(
    await page.getByText("Apps", { exact: true }).isVisible(),
    "permission UI: source-declared Apps component missing",
  );
  assert(
    await page.getByText("MCP servers", { exact: true }).isVisible(),
    "permission UI: source-declared MCP servers component missing",
  );
  await page.screenshot({ path: screenshotPath("r4-desktop-plugins-can-edit.png") });

  await page.getByRole("button", { name: "Library", exact: true }).click();
  assert(
    await page.getByRole("button", { name: /Propose edit/ }).isVisible(),
    "permission UI: edit action not offered",
  );
  assert(
    await page.getByText("Image omitted: tracking image").isVisible(),
    "permission UI: remote Markdown image was not made inert",
  );
  assert(
    (await page.locator(".markdown-body img").count()) === 0,
    "permission UI: imported Markdown created an image request surface",
  );
  assert(
    (await page.locator(".markdown-body script").count()) === 0,
    "permission UI: raw Markdown HTML rendered",
  );
  await page.screenshot({ path: screenshotPath("r4-desktop-edit-permission.png") });

  await page.getByRole("button", { name: /Propose edit/ }).click();
  const editor = page.getByLabel("Complete Markdown source");
  assert(
    (await editor.inputValue()) === mockMarkdown,
    "permission UI: editor did not preserve complete Markdown",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(50);
  await page.locator(".editor-pane").scrollIntoViewIfNeeded();
  await page.screenshot({ path: screenshotPath("r4-mobile-edit-permission.png") });
  await page.setViewportSize({ width: 1440, height: 900 });
  await editor.fill(`${mockMarkdown}\nProposal proof line.\n`);
  await page.getByRole("button", { name: "Create branch & pull request" }).click();
  await page.getByRole("status").waitFor({ state: "visible" });
  assert(
    await page.getByText("Pull request #17 opened").isVisible(),
    "permission UI: proposal success missing",
  );
  await page.screenshot({ path: screenshotPath("r4-desktop-proposal-success.png") });

  assert(
    proposalBody?.repository === "example/team-skills",
    "permission UI: proposal repository changed",
  );
  assert(
    proposalBody?.path === "skills/release-notes/SKILL.md",
    "permission UI: proposal path changed",
  );
  assert(proposalBody?.baseSha === "a".repeat(40), "permission UI: observed base SHA missing");
  assert(
    proposalBody?.content?.endsWith("Proposal proof line.\n"),
    "permission UI: proposal did not submit full edited Markdown",
  );
  assert(
    !Object.hasOwn(proposalBody ?? {}, "branch"),
    "permission UI: client attempted to select a write branch",
  );
  assert(
    externalRequests.length === 0,
    "permission UI: deterministic journey made an external request",
  );
  assert(
    await page.evaluate(() => window.__unsafe_markdown_executed !== true),
    "permission UI: imported raw HTML executed",
  );

  observations.push({
    label: "permission-proposal-ui",
    importedAccess: "write",
    completeMarkdownPreserved: true,
    remoteImagesInert: true,
    rawHtmlSkipped: true,
    providerMutation: "intercepted-only",
    proposalPath: proposalBody?.path,
    proposalBaseSha: proposalBody?.baseSha,
    branchChosenByClient: Object.hasOwn(proposalBody ?? {}, "branch"),
    externalRequests,
  });
  diagnostics.finish();
}

async function exerciseStatic(page, baseUrl, label, screenshot, diagnostics) {
  const githubMock = await interceptCanonicalGitHubRead(page);
  await markTourComplete(page);
  const network = trackStaticNetwork(page, label, baseUrl);
  await page.goto(`${baseUrl}#graph`, { waitUntil: "networkidle" });
  await page.locator("#graph-title").waitFor({ state: "visible" });
  await checkCommon(page, label);
  assert(
    await page.getByRole("button", { name: "Public", exact: true }).isVisible(),
    `${label}: public account state missing`,
  );
  const loadedNodeCount = await page.locator(".skill-node").count();
  if (loadedNodeCount !== 5) {
    throw new Error(
      `${label}: canonical default graph unavailable; mock=${JSON.stringify(githubMock)}`,
    );
  }
  await page.getByRole("button", { name: "Library", exact: true }).click();
  assert(
    await page.getByRole("heading", { name: "Clarify", level: 2 }).isVisible(),
    `${label}: Library reader unavailable`,
  );
  await page.getByRole("button", { name: "Usage", exact: true }).click();
  assert(
    await page.getByRole("heading", { name: "Usage data isn’t connected." }).isVisible(),
    `${label}: Usage truth unavailable`,
  );
  await page.getByRole("button", { name: /onlinesourdough\/Skills Manage plugins/ }).click();
  assert(
    await page.getByRole("heading", { name: "onlinesourdough/Skills", level: 3 }).isVisible(),
    `${label}: canonical plugin identity missing`,
  );
  assert(
    await page
      .locator(".pack-list article")
      .filter({ has: page.getByRole("heading", { name: "onlinesourdough/Skills", level: 3 }) })
      .getByText("Read only", { exact: true })
      .isVisible(),
    `${label}: anonymous static access is not read-only`,
  );
  await page.getByRole("button", { name: "Graph", exact: true }).click();
  await page.screenshot({ path: screenshotPath(screenshot) });
  recordStaticNetworkEvidence(network);
  diagnostics.finish();
}

const processEnvironment = {
  NODE_ENV: "production",
  PORT: "0",
  HOST: "127.0.0.1",
};
const nodeServer = spawn(process.execPath, ["dist/server/index.js"], {
  cwd: root,
  env: { ...processEnvironment, PORT: String(nodePort) },
  stdio: ["ignore", "ignore", "ignore"],
});
const staticRootServer = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    String(staticRootPort),
    "--strictPort",
    "--outDir",
    "dist/static",
  ],
  { cwd: root, env: processEnvironment, stdio: ["ignore", "ignore", "ignore"] },
);
const staticPrefixedServer = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    String(staticPrefixedPort),
    "--strictPort",
    "--outDir",
    "dist/static",
    "--base",
    staticPrefix,
  ],
  { cwd: root, env: processEnvironment, stdio: ["ignore", "ignore", "ignore"] },
);

try {
  await mkdir(screenshotRoot, { recursive: true });
  await mkdir(runtimeRoot, { recursive: true });
  await Promise.all([
    waitForUrl(`${nodeBase}/api/health`),
    waitForUrl(staticBase),
    waitForUrl(staticPrefixedBase),
  ]);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const desktopDiagnostics = attachBrowserDiagnostics(
      desktop,
      "desktop",
      new URL(nodeBase).origin,
    );
    await exerciseDesktop(desktop, desktopDiagnostics);
    await desktop.close();

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await mobile.emulateMedia({ reducedMotion: "reduce" });
    const mobileDiagnostics = attachBrowserDiagnostics(mobile, "mobile", new URL(nodeBase).origin);
    await exerciseMobile(mobile, mobileDiagnostics);
    await mobile.close();

    const fallback = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const fallbackDiagnostics = attachBrowserDiagnostics(
      fallback,
      "default-fallback",
      new URL(nodeBase).origin,
    );
    await exerciseDefaultFallback(fallback, fallbackDiagnostics);
    await fallback.close();

    const permission = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await permission.emulateMedia({ reducedMotion: "reduce" });
    const permissionDiagnostics = attachBrowserDiagnostics(
      permission,
      "permission-ui",
      new URL(nodeBase).origin,
    );
    await exercisePermissionUi(permission, permissionDiagnostics);
    await permission.close();

    const staticRootPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const rootDiagnostics = attachBrowserDiagnostics(
      staticRootPage,
      "static-root",
      new URL(staticBase).origin,
    );
    await exerciseStatic(
      staticRootPage,
      staticBase,
      "static-root",
      "r4-static-root.png",
      rootDiagnostics,
    );
    await staticRootPage.close();

    const staticPrefixedPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const prefixedDiagnostics = attachBrowserDiagnostics(
      staticPrefixedPage,
      "static-prefixed",
      new URL(staticPrefixedBase).origin,
    );
    await exerciseStatic(
      staticPrefixedPage,
      staticPrefixedBase,
      "static-prefixed",
      "r4-static-prefixed.png",
      prefixedDiagnostics,
    );
    await staticPrefixedPage.close();
  } finally {
    await browser.close();
  }
} catch (error) {
  failures.push(error instanceof Error ? error.message : "browser proof failed");
} finally {
  nodeServer.kill("SIGTERM");
  staticRootServer.kill("SIGTERM");
  staticPrefixedServer.kill("SIGTERM");
}

await writeFile(
  new URL("browser-proof.json", runtimeRoot),
  JSON.stringify(
    {
      nodeBase,
      staticArtifact: "dist/static",
      staticBase,
      staticPrefixedBase,
      viewport: { desktop: "1440x900", mobile: "390x844" },
      providerWrites: "deterministic browser interception only",
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
    "PASS r4 browser proof: canonical anonymous startup fixtures, calm Offline example fallback and retry, source/revision/access truth, GitHub navigation, centered onboarding, permission/proposal interception, safe Markdown, and dual-root static assets",
  );
}
