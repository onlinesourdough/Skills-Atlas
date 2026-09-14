import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { textContrast, pluginsLayoutEvidence } from "./ui-evidence.mjs";
const startedAt = new Date().toISOString();
import { fixtureControl, origin, startFixture, wrangler } from "./fixture-runtime.mjs";

await mkdir("proof/runtime", { recursive: true });
await mkdir("proof/screenshots", { recursive: true });
const persist = await mkdtemp(resolve("proof/runtime/phase-c-browser-"));
await wrangler(["d1", "migrations", "apply", "DB", "--local", "--persist-to", persist]);
let server;
let browser;
const observations = [];
const pageErrors = [];
const escapedRequests = [];
async function eventually(check) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await check()) return;
    await new Promise((done) => setTimeout(done, 100));
  }
  assert.fail("Browser state did not reach the expected condition");
}
async function userContext(user) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin) {
      if (url.pathname === "/auth/github/login") {
        assert.equal(request.method(), "POST");
        assert.equal(await request.headerValue("origin"), origin);
        assert.equal(await request.headerValue("referer"), `${origin}/`);
        const response = await route.fetch({ maxRedirects: 0 });
        assert.equal(response.status(), 303);
        assert.equal(response.headers()["referrer-policy"], "no-referrer");
        const { callback } = await fixtureControl("authorize", {
          user,
          url: response.headers().location,
        });
        await route.fulfill({ response, headers: { ...response.headers(), location: callback } });
        return;
      }
      if (url.pathname === "/auth/github/callback")
        assert.equal(await request.headerValue("referer"), null);
      await route.continue();
      return;
    }
    if (url.origin === "https://api.github.com") {
      assert.equal(await request.headerValue("authorization"), null);
      assert.equal(await request.headerValue("cookie"), null);
      assert.doesNotMatch(
        (await request.headerValue("referer")) ?? "",
        /callback|code=|private-skills/,
      );
      await route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
      return;
    }
    escapedRequests.push(request.url());
    await route.abort();
  });
  context.on("page", (page) => page.on("pageerror", (error) => pageErrors.push(error.message)));
  return context;
}
async function signIn(page, user) {
  await page.bringToFront();
  await page.goto(origin);
  await page.getByRole("button", { name: "Sign in with GitHub", exact: true }).click();
  await page.getByRole("button", { name: `fixture-${user}`, exact: true }).waitFor();
  await eventually(
    async () =>
      (await page
        .getByRole("checkbox", { name: "onlinesourdough/Global-Skills", exact: true })
        .count()) === 1,
  );
}
async function plugins(page) {
  await page.bringToFront();
  await page.getByRole("button", { name: /Manage plugins/ }).click();
}
async function importSource(page, repository) {
  await plugins(page);
  observations.push(await pluginsLayoutEvidence(page, "personal-plugins-initial"));
  await page.getByRole("textbox", { name: "GitHub repository", exact: true }).fill("invalid");
  await page.getByRole("button", { name: "Preview repository", exact: true }).click();
  await page.locator(".import-result.error").waitFor();
  observations.push(await pluginsLayoutEvidence(page, "personal-plugins-error"));
  await page.getByRole("textbox", { name: "GitHub repository", exact: true }).fill(repository);
  const beforePreview = await profile(page);
  const preferences = (value) =>
    value.sources.map(({ id, repositoryId, repository, visible }) => ({
      id,
      repositoryId,
      repository,
      visible,
    }));
  await page.getByRole("button", { name: "Preview repository", exact: true }).click();
  await page.getByRole("button", { name: "Confirm import", exact: true }).waitFor();
  assert.equal(await page.locator(".import-result.error").count(), 0);
  assert.equal(
    await page.getByText("Use a repository in owner/name format.", { exact: true }).count(),
    0,
    "Successful preview retained stale invalid-repository feedback",
  );
  observations.push(await pluginsLayoutEvidence(page, "personal-plugins-preview"));
  assert.doesNotMatch(await page.locator(".import-preview").innerText(), /\b1 skills\b/u);
  assert.deepEqual(
    preferences(await profile(page)),
    preferences(beforePreview),
    "Preview must not persist source preferences",
  );
  await page.screenshot({ path: "proof/screenshots/phase-g-import-preview.png" });
  await page.getByRole("button", { name: "Cancel preview", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "Confirm import", exact: true }).count(), 0);
  assert.deepEqual(
    preferences(await profile(page)),
    preferences(beforePreview),
    "Cancel saved a source",
  );
  await page.getByRole("button", { name: "Preview repository", exact: true }).click();
  const result = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/sources" && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Confirm import", exact: true }).click();
  assert.equal((await result).status(), 200);
  await page.getByRole("heading", { name: repository, exact: true }).waitFor();
  observations.push(await pluginsLayoutEvidence(page, "personal-plugins-success"));
}
async function profile(page) {
  return page.evaluate(async () => (await fetch("/api/profile")).json());
}
async function openPrivateReader(page, repository) {
  await page.bringToFront();
  const defaultSource = page.getByRole("checkbox", {
    name: "onlinesourdough/Global-Skills",
    exact: true,
  });
  await defaultSource.waitFor();
  if (await defaultSource.isChecked()) await defaultSource.uncheck();
  const privateSource = page.getByRole("checkbox", { name: repository, exact: true });
  if (!(await privateSource.isChecked())) await privateSource.check();
  await page.locator(".primary-tabs").getByRole("button", { name: "Library", exact: true }).click();
  await page.locator(".skill-list").getByRole("button").first().click();
  await page.getByText("PRIVATE ALICE SYNTHETIC CONTENT", { exact: true }).waitFor();
}
try {
  server = await startFixture(persist);
  browser = await chromium.launch({ headless: true });
  for (const user of ["pending", "nonmember", "outside"]) {
    const context = await userContext(user);
    const page = await context.newPage();
    await page.goto(origin);
    await page.getByRole("button", { name: "Sign in with GitHub", exact: true }).waitFor();
    if (user === "pending") {
      const actions = await page.locator(".personal-login").evaluate((login) => {
        const primary = login.querySelector("form button");
        const secondary = login.querySelector(".login-secondary-actions");
        const demo = secondary.querySelector("a");
        const button = primary.getBoundingClientRect();
        const group = secondary.getBoundingClientRect();
        const link = demo.getBoundingClientRect();
        return {
          gap: group.top - button.bottom,
          primaryBackground: getComputedStyle(primary).backgroundColor,
          demoBackground: getComputedStyle(demo).backgroundColor,
          demoReachable:
            link.height >= 44 && link.right <= innerWidth && link.bottom <= innerHeight,
        };
      });
      assert(
        actions.gap >= 12 && actions.demoReachable,
        "Login actions lack spacing or reachable targets",
      );
      assert.notEqual(
        actions.primaryBackground,
        actions.demoBackground,
        "Public demo competes with primary sign-in",
      );
      await page.screenshot({ path: "proof/screenshots/phase-g-login.png" });
      observations.push({ label: "phase-g-login-contrast", ...(await textContrast(page)) });
    }
    await page.getByRole("button", { name: "Sign in with GitHub", exact: true }).click();
    await page.waitForURL(/authError=/);
    await page.getByRole("alert").waitFor();
    assert.equal(await page.locator(".app-shell").count(), 0);
    if (user === "pending") await page.getByText(/invitation is pending/).waitFor();
    await page.screenshot({ path: `proof/screenshots/phase-g-${user}-denied.png` });
    await context.close();
  }
  observations.push(
    "Pending invitation, nonmember and outside collaborator each remain on a clear denial screen.",
  );
  const alice = await userContext("alice");
  const bob = await userContext("bob");
  const a = await alice.newPage();
  const b = await bob.newPage();
  await signIn(a, "alice");
  await signIn(b, "bob");
  await a.screenshot({ path: "proof/screenshots/phase-g-first-source.png" });
  await a.route("**/api/sources/*", (route) =>
    route.fulfill({
      status: 503,
      json: { error: { code: "service-unavailable" } },
    }),
  );
  await a.reload();
  await a.getByRole("alert").waitFor();
  assert.equal(
    await a.locator(".skill-node").count(),
    0,
    "Failed personal default retained graph content",
  );
  assert.equal(
    await a.getByText("Offline example", { exact: true }).count(),
    0,
    "Failed personal default silently became a demo",
  );
  await a.screenshot({ path: "proof/screenshots/phase-g-personal-default-error.png" });
  await a.unroute("**/api/sources/*");
  await a.getByRole("button", { name: "Refresh access", exact: true }).click();
  await a.locator(".skill-node").first().waitFor();
  await importSource(a, "fixture-alice/private-skills");
  await importSource(b, "fixture-bob/private-skills");
  await b.getByRole("button", { name: "Remove fixture-bob/private-skills", exact: true }).click();
  await b.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal((await profile(b)).sources.length, 2);
  await b.getByRole("button", { name: "Remove fixture-bob/private-skills", exact: true }).click();
  await b.getByRole("button", { name: "Confirm remove", exact: true }).click();
  await eventually(async () => (await profile(b)).sources.length === 1);
  await importSource(b, "fixture-bob/private-skills");
  const ap = await profile(a);
  const bp = await profile(b);
  const privateId = ap.sources.find(
    (source) => source.repository === "fixture-alice/private-skills",
  ).id;
  assert.equal(ap.user.id, 11);
  assert.equal(bp.user.id, 22);
  assert.equal(
    bp.sources.some((source) => source.id === privateId),
    false,
  );
  assert.equal(
    await b.evaluate(async (id) => (await fetch(`/api/sources/${id}`)).status, privateId),
    404,
  );
  await openPrivateReader(a, "fixture-alice/private-skills");
  await a.screenshot({ path: "proof/screenshots/phase-c-private-reader.png", fullPage: true });
  assert.equal((await b.content()).includes("PRIVATE ALICE SYNTHETIC CONTENT"), false);
  observations.push(
    "Two browser contexts follow real Worker OAuth/cookie/D1 flows and display only their own private fixtures.",
  );
  let releaseVisibility;
  let visibilityStarted;
  const pendingVisibility = new Promise((done) => {
    visibilityStarted = done;
  });
  await alice.route(`**/api/sources/${privateId}`, async (route) => {
    if (route.request().method() !== "PATCH") return route.fallback();
    await new Promise((done) => {
      releaseVisibility = done;
      visibilityStarted();
    });
    await route.continue();
  });
  await a.getByRole("checkbox", { name: "fixture-alice/private-skills", exact: true }).uncheck();
  await pendingVisibility;
  const refresh = a.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/profile",
  );
  await a.getByRole("button", { name: "Refresh access", exact: true }).click();
  assert.equal((await refresh).status(), 200);
  assert.equal((await profile(a)).sources.find((source) => source.id === privateId).visible, true);
  assert.equal(
    await a
      .getByRole("checkbox", { name: "fixture-alice/private-skills", exact: true })
      .isChecked(),
    false,
  );
  releaseVisibility();
  await eventually(
    async () => !(await profile(a)).sources.find((source) => source.id === privateId).visible,
  );
  await alice.unroute(`**/api/sources/${privateId}`);
  await a.getByRole("checkbox", { name: "fixture-alice/private-skills", exact: true }).check();
  assert.equal(await a.locator(".skill-list .selected").count(), 0);
  await a.getByRole("checkbox", { name: "fixture-alice/private-skills", exact: true }).uncheck();
  await eventually(
    async () => !(await profile(a)).sources.find((source) => source.id === privateId).visible,
  );
  await a.reload();
  await a.getByRole("checkbox", { name: "fixture-alice/private-skills", exact: true }).waitFor();
  assert.equal(
    await a
      .getByRole("checkbox", { name: "fixture-alice/private-skills", exact: true })
      .isChecked(),
    false,
  );
  await importSource(a, "fixture-alice/private-skills");
  assert.equal((await profile(a)).sources.filter((source) => source.id === privateId).length, 1);
  assert.equal(
    await a
      .getByRole("checkbox", { name: "fixture-alice/private-skills", exact: true })
      .isChecked(),
    false,
  );
  await openPrivateReader(a, "fixture-alice/private-skills");
  await a.getByRole("checkbox", { name: "fixture-alice/private-skills", exact: true }).uncheck();
  await eventually(
    async () => !(await profile(a)).sources.find((source) => source.id === privateId).visible,
  );
  await plugins(a);
  await a
    .locator(".pack-list article")
    .filter({ has: a.getByRole("heading", { name: "fixture-alice/private-skills", exact: true }) })
    .getByRole("button", { name: "Use plugin", exact: true })
    .click();
  await eventually(
    async () => (await profile(a)).sources.find((source) => source.id === privateId).visible,
  );
  await fixtureControl("control", {
    repositoryId: 201,
    repositoryName: "fixture-alice/renamed-skills",
  });
  await fixtureControl("control", {
    repositoryId: 301,
    repositoryName: "fixture-alice/private-skills",
  });
  await a.getByRole("button", { name: "Refresh access", exact: true }).click();
  await a.getByRole("checkbox", { name: "fixture-alice/renamed-skills", exact: true }).waitFor();
  await plugins(a);
  await a.getByRole("heading", { name: "fixture-alice/renamed-skills", exact: true }).waitFor();
  assert.equal(
    await a
      .getByRole("link", { name: "Open fixture-alice/renamed-skills on GitHub", exact: true })
      .getAttribute("href"),
    "https://github.com/fixture-alice/renamed-skills",
  );
  assert.equal(
    await a
      .getByRole("link", { name: "Open fixture-alice/private-skills on GitHub", exact: true })
      .count(),
    0,
  );
  await fixtureControl("control", {
    repositoryId: 201,
    repositoryName: "fixture-alice/private-skills",
  });
  await fixtureControl("control", {
    repositoryId: 301,
    repositoryName: "fixture-team/shared-skills",
  });
  await a.getByRole("button", { name: "Refresh access", exact: true }).click();
  await a.getByRole("checkbox", { name: "fixture-alice/private-skills", exact: true }).waitFor();
  const demo = await alice.newPage();
  let demoApiRequests = 0;
  demo.on("request", (request) => {
    if (
      new URL(request.url()).origin === origin &&
      new URL(request.url()).pathname.startsWith("/api/")
    )
      demoApiRequests += 1;
  });
  await demo.goto(`${origin}/?demo=1#graph`);
  await demo.locator(".app-shell").waitFor();
  await demo.getByText(/Public demo · no personal profile/).waitFor();
  assert.equal(demoApiRequests, 0);
  assert.equal((await profile(a)).user.id, 11);
  assert.equal((await demo.content()).includes("PRIVATE ALICE SYNTHETIC CONTENT"), false);
  await demo.close();
  observations.push(
    "Native sign-in retains same-origin POST with callback referrers suppressed; pending visibility survives refresh, hide/show clears selection, Use plugin persists visibility, renamed pack links reload, and signed-in demo makes no personal API requests.",
  );
  let releaseImport;
  let importStarted;
  const delayedImport = new Promise((done) => {
    importStarted = done;
  });
  await alice.route("**/api/sources", async (route) => {
    const response = await route.fetch();
    await new Promise((done) => {
      releaseImport = done;
      importStarted();
    });
    await route.fulfill({ response });
  });
  await plugins(a);
  await a
    .getByRole("textbox", { name: "GitHub repository", exact: true })
    .fill("fixture-team/shared-skills");
  await a.getByRole("button", { name: "Preview repository", exact: true }).click();
  await a.getByRole("button", { name: "Confirm import", exact: true }).click();
  await delayedImport;
  const sibling = await alice.newPage();
  await sibling.goto(`${origin}/#graph`);
  await sibling.getByRole("button", { name: "fixture-alice", exact: true }).waitFor();
  await a.bringToFront();
  await a.getByRole("button", { name: "fixture-alice", exact: true }).click();
  await a.getByRole("button", { name: "Sign out", exact: true }).click();
  await eventually(
    async () =>
      (await a.locator(".app-shell").count()) === 0 &&
      (await sibling.locator(".app-shell").count()) === 0,
  );
  releaseImport();
  await alice.unroute("**/api/sources");
  await eventually(
    async () => (await a.evaluate(async () => (await fetch("/api/profile")).status)) === 401,
  );
  assert.equal((await a.content()).includes("PRIVATE ALICE SYNTHETIC CONTENT"), false);
  await a.goBack();
  await eventually(async () => (await a.locator(".app-shell").count()) === 0);
  await signIn(a, "alice");
  assert.equal(
    (await profile(a)).sources.some((source) => source.id === privateId),
    true,
  );
  observations.push(
    "Preference removal requires confirmation; hidden preferences survive reload/duplicate import; logout clears private views, a delayed import and another tab; history cannot restore private content; re-login restores the same profile.",
  );
  await sibling.close();
  await fixtureControl("control", { repositoryId: 201, users: [] });
  await a.getByRole("button", { name: "Refresh access", exact: true }).click();
  await eventually(
    async () =>
      (await a
        .getByRole("checkbox", { name: "fixture-alice/private-skills", exact: true })
        .count()) === 0,
  );
  await fixtureControl("control", { user: "alice", membership: "absent" });
  await a.getByRole("button", { name: "Refresh access", exact: true }).click();
  await eventually(async () => (await a.locator(".app-shell").count()) === 0);
  await b.bringToFront();
  await b.getByRole("button", { name: "Refresh access", exact: true }).waitFor();
  await fixtureControl("control", { user: "bob", revoked: true });
  await b.getByRole("button", { name: "Refresh access", exact: true }).click();
  await eventually(async () => (await b.locator(".app-shell").count()) === 0);
  observations.push(
    "Repository removal drops its content; membership loss and upstream token revocation lock existing profiles.",
  );
  await a.goto(`${origin}/?demo=1#graph`);
  await a.getByText(/Public demo · no personal profile/).waitFor();
  await a.locator(".app-shell").waitFor();
  assert.equal((await a.content()).includes("PRIVATE ALICE SYNTHETIC CONTENT"), false);
  const stored = await a.evaluate(() => ({
    local: { ...localStorage },
    session: { ...sessionStorage },
  }));
  assert.doesNotMatch(JSON.stringify(stored), /PRIVATE ALICE|fixture-user-token|csrfToken/);
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(escapedRequests, []);
  await writeFile(
    "proof/runtime/phase-c-browser.json",
    JSON.stringify(
      {
        status: "PASS",
        startedAt,
        completedAt: new Date().toISOString(),
        fixtureOnly: true,
        observations,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(JSON.stringify({ status: "PASS", observations }, null, 2));
} finally {
  await browser?.close();
  await server?.stop();
}
