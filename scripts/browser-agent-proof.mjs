import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { textContrast } from "./ui-evidence.mjs";
import { fixtureControl, origin, startFixture, wrangler } from "./fixture-runtime.mjs";
import {
  connectAgent,
  prepareAgentAuthorization,
  startAgentCallback,
  toolResult,
} from "./agent-fixture.mjs";

await mkdir("proof/runtime", { recursive: true });
await mkdir("proof/screenshots", { recursive: true });
const state = await mkdtemp(resolve("proof/runtime/phase-d-browser-"));
let server;
let browser;
let agent;
let callbackListener;
const extraAgents = [];
const diagnostics = [];
let stage = "startup";
const startedAt = new Date().toISOString();
const errors = [];
const escaped = [];
const observations = [];
async function assertConsent(page, authorizationUrl, account, clientName) {
  const card = page.locator(".auth-card");
  await card.getByRole("heading", { name: "Connect your agent", exact: true }).waitFor();
  const value = async (label) => {
    const term = card.locator("dt").filter({ hasText: new RegExp(`^${label}$`, "u") });
    assert.equal(await term.count(), 1, `Missing unique consent label: ${label}`);
    return term.locator("xpath=following-sibling::*[1][self::dd]");
  };
  assert.equal(await (await value("Installation")).innerText(), origin);
  assert.equal(await (await value("GitHub")).innerText(), account);
  assert.equal(await (await value("Scope")).innerText(), "atlas:read");
  const client = await value("Client");
  const clientId = new URL(authorizationUrl).searchParams.get("client_id");
  assert.ok(clientId, "Authorization request lacks client identity");
  assert.equal(await client.locator("code").innerText(), clientId);
  assert.equal(await client.evaluate((element) => element.firstChild.textContent), clientName);
  assert.equal(
    await card
      .getByText(
        "Read sources, search, and read explicitly requested skills and relations. Requested content goes to your chosen agent and model environment.",
        { exact: true },
      )
      .count(),
    1,
  );
}
function safeError(error) {
  return {
    kind: ["AssertionError", "TimeoutError", "TypeError", "Error"].includes(error?.name)
      ? error.name
      : "OtherError",
    locations: [
      ...String(error?.stack ?? "").matchAll(
        /(?:browser-agent-proof|agent-fixture)\.mjs:\d+:\d+/gu,
      ),
    ]
      .map((match) => match[0])
      .slice(0, 4),
  };
}
function localRoute(raw) {
  const url = new URL(raw);
  if (url.origin === "http://127.0.0.1:4199") return "agent callback listener";
  if (url.origin !== origin) return null;
  if (
    [
      "/agent/authorize",
      "/agent/token",
      "/auth/github/login",
      "/auth/github/callback",
      "/api/profile",
      "/api/session",
      "/api/signout-everywhere",
    ].includes(url.pathname)
  )
    return url.pathname;
  if (url.pathname.startsWith("/api/sources")) return "source API";
  return null;
}
function diagnostic(value) {
  diagnostics.push({ stage, ...value });
  if (diagnostics.length > 250) diagnostics.shift();
}
try {
  await wrangler(["d1", "migrations", "apply", "DB", "--local", "--persist-to", state]);
  server = await startFixture(state);
  stage = "callback listener startup";
  callbackListener = await startAgentCallback();
  stage = "Chromium startup";
  browser = await chromium.launch({ channel: "chromium-headless-shell" });
  async function createContext(user) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    context.on("page", (page) => {
      page.on("pageerror", (error) => errors.push({ stage, ...safeError(error) }));
      page.on("response", (response) => {
        const route = localRoute(response.url());
        if (route)
          diagnostic({ route, method: response.request().method(), status: response.status() });
      });
      page.on("requestfailed", (request) => {
        const route = localRoute(request.url());
        if (route)
          diagnostic({
            route,
            kind:
              /net::ERR_[A-Z_]+/u.exec(request.failure()?.errorText ?? "")?.[0] ?? "request failed",
          });
      });
      page.on("console", (message) => {
        if (message.type() === "error")
          diagnostic({
            kind: /content security policy|form-action/i.test(message.text())
              ? "CSP console error"
              : "console error",
          });
      });
    });
    await context.exposeBinding("recordPolicyViolation", (_, directive) => {
      errors.push({ stage, kind: "CSP", directive });
    });
    await context.addInitScript(() =>
      document.addEventListener("securitypolicyviolation", (event) => {
        // Never retain blocked URI, callback query, source text or credentials.
        window.recordPolicyViolation(event.effectiveDirective);
      }),
    );
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin === "http://127.0.0.1:4199") {
        await route.continue();
        return;
      }
      if (url.origin !== origin) {
        escaped.push(url.origin);
        await route.abort();
        return;
      }
      if (url.pathname === "/auth/github/login") {
        assert.equal(route.request().method(), "POST");
        assert.equal(await route.request().headerValue("origin"), origin);
        const response = await route.fetch({ maxRedirects: 0 });
        const { callback: target } = await fixtureControl("authorize", {
          user,
          url: response.headers().location,
        });
        await route.fulfill({ response, headers: { ...response.headers(), location: target } });
        return;
      }
      await route.continue();
    });
    return { context };
  }
  const aliceBrowser = await createContext("alice");
  const { context } = aliceBrowser;
  const page = await context.newPage();
  stage = "Alice browser GitHub login";
  await page.goto(origin);
  await page.getByRole("button", { name: "Sign in with GitHub", exact: true }).click();
  await page.getByRole("button", { name: "fixture-alice", exact: true }).waitFor();
  const profile = await page.evaluate(async () => (await fetch("/api/profile")).json());
  const cookie = (await context.cookies(origin))
    .map((row) => `${row.name}=${row.value}`)
    .join("; ");
  agent = await connectAgent(cookie, profile.csrfToken, "Synthetic browser agent", async (url) => {
    stage = "Alice consent document";
    const callback = callbackListener.expect(url);
    await page.goto(url);
    await assertConsent(page, url, "fixture-alice — numeric account 11", "Synthetic browser agent");
    await page.screenshot({ path: "proof/screenshots/phase-g-agent-consent.png" });
    observations.push({ label: "phase-g-consent-contrast", ...(await textContrast(page)) });
    stage = "Alice native approval and callback";
    await page.getByRole("button", { name: "Approve read access", exact: true }).click();
    await page.getByText("Synthetic agent callback complete", { exact: true }).waitFor();
    assert.ok(callback());
    stage = "Alice code exchange and SDK initialization";
    return callback();
  });
  stage = "public SDK read and browser reader";
  const sourceId = profile.sources[0].id;
  const source = await (
    await fetch(`${origin}/api/sources/${sourceId}`, { headers: { cookie } })
  ).json();
  const read = await toolResult(agent.client, "read_skill", {
    sourceId,
    skillId: source.pack.skills[0].id,
  });
  await page.goto(read.url);
  await page.getByRole("button", { name: "fixture-alice", exact: true }).waitFor();
  await page
    .locator(".skill-reader")
    .getByText(source.pack.skills[0].name, { exact: true })
    .first()
    .waitFor();
  assert.equal(read.sha, source.pack.revision);
  assert.equal(new URL(page.url()).searchParams.get("skill"), read.skillId);
  observations.push(
    "Native browser consent shows client/installation/numeric account and explicit read disclosure; actual MCP-returned URL opens the matching reader with the browser ID/SHA.",
  );
  stage = "public hidden source temporary opening";
  await page.evaluate(
    async ({ sourceId, csrf }) =>
      fetch(`/api/sources/${sourceId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-atlas-csrf": csrf },
        body: JSON.stringify({ visible: false }),
      }),
    { sourceId, csrf: profile.csrfToken },
  );
  await page.reload();
  await page.getByRole("button", { name: "Open hidden source temporarily", exact: true }).click();
  await page
    .locator(".skill-reader")
    .getByText(source.pack.skills[0].name, { exact: true })
    .first()
    .waitFor();
  const hidden = await page.evaluate(async () => (await fetch("/api/profile")).json());
  assert.equal(hidden.sources.find((row) => row.id === sourceId).visible, false);
  const mismatch = new URL(read.url);
  stage = "public account mismatch and Back";
  mismatch.searchParams.set("account", "22");
  await page.goto(mismatch.href);
  await page
    .getByText(
      "This link belongs to a different GitHub account. Sign in with the intended account.",
      { exact: true },
    )
    .waitFor();
  await page.goBack();
  await page.getByRole("button", { name: "Open hidden source temporarily", exact: true }).waitFor();
  observations.push(
    "Hidden-source opening is explicitly temporary and does not mutate saved visibility; account mismatch and Back navigation are honest.",
  );
  stage = "browser agent disconnect and MCP denial";
  await page.getByRole("button", { name: "fixture-alice", exact: true }).click();
  await page.screenshot({ path: "proof/screenshots/phase-g-agent-connected.png" });
  await page
    .getByRole("button", { name: "Disconnect Synthetic browser agent", exact: true })
    .click();
  await page.getByText("No active agent connections.", { exact: true }).waitFor();
  await page.screenshot({ path: "proof/screenshots/phase-g-agent-disconnected.png" });
  await assert.rejects(() => toolResult(agent.client, "connection_identity"));
  stage = "public logout and login return";
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByRole("button", { name: "Sign in with GitHub", exact: true }).waitFor();
  await page.goto(read.url);
  await page.getByRole("button", { name: "Sign in with GitHub", exact: true }).click();
  await page.getByRole("button", { name: "Open hidden source temporarily", exact: true }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get("skill"), read.skillId);
  observations.push(
    "Account UI disconnect immediately denies MCP; ordinary GitHub login preserves the validated deep link without restoring private content before authentication.",
  );
  stage = "native cancellation document";
  const cancellation = await prepareAgentAuthorization("Synthetic cancellation");
  const cancellationCallback = callbackListener.expect(cancellation.url);
  await page.goto(cancellation.url);
  stage = "native cancel and callback";
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByText("Synthetic agent callback complete", { exact: true }).waitFor();
  const cancelled = new URL(cancellationCallback());
  assert.equal(cancelled.searchParams.get("error"), "access_denied");
  assert.equal(cancelled.searchParams.get("state"), cancellation.query.get("state"));
  assert.equal(cancelled.searchParams.has("code"), false);
  assert.equal(cancelled.searchParams.get("iss"), origin);
  const invalid = new URL(cancellation.url);
  stage = "unregistered callback rejection";
  invalid.searchParams.set("redirect_uri", "http://127.0.0.1:4199/unregistered");
  const before = callbackListener.completed();
  assert.equal((await page.goto(invalid.href)).status(), 400);
  assert.equal(
    await page.getByRole("button", { name: "Approve read access", exact: true }).count(),
    0,
  );
  assert.equal(callbackListener.completed(), before);

  stage = "login-required consent and private two-profile handoff";
  const bobBrowser = await createContext("bob");
  const bobPage = await bobBrowser.context.newPage();
  const bobAgent = await connectAgent("", "", "Synthetic Bob agent", async (url) => {
    stage = "Bob login-required consent";
    const callback = callbackListener.expect(url);
    await bobPage.goto(url);
    await bobPage.getByRole("button", { name: "Sign in with GitHub", exact: true }).click();
    await assertConsent(bobPage, url, "fixture-bob — numeric account 22", "Synthetic Bob agent");
    stage = "Bob native approval and callback";
    await bobPage.getByRole("button", { name: "Approve read access", exact: true }).click();
    await bobPage.getByText("Synthetic agent callback complete", { exact: true }).waitFor();
    stage = "Bob code exchange and SDK initialization";
    return callback();
  });
  extraAgents.push(bobAgent);
  await page.goto(origin);
  await bobPage.goto(origin);
  async function importPrivate(target, repository) {
    stage = target === page ? "Alice private import" : "Bob private import";
    await target.bringToFront();
    await target.getByRole("button", { name: /fixture-(alice|bob)/, exact: true }).waitFor();
    return target.evaluate(async (repository) => {
      const profile = await (await fetch("/api/profile")).json();
      const imported = await fetch("/api/sources", {
        method: "POST",
        headers: { "content-type": "application/json", "x-atlas-csrf": profile.csrfToken },
        body: JSON.stringify({ repository }),
      });
      if (!imported.ok) throw new Error("Synthetic import failed");
      const updated = await (await fetch("/api/profile")).json();
      const source = updated.sources.find((row) => row.repository === repository);
      const data = await (await fetch(`/api/sources/${source.id}`)).json();
      return { profile: updated, source, pack: data.pack };
    }, repository);
  }
  const alicePrivate = await importPrivate(page, "fixture-alice/private-skills");
  const bobPrivate = await importPrivate(bobPage, "fixture-bob/private-skills");
  stage = "private SDK connections and reads";
  const aliceAgent = await connectAgent(
    (await context.cookies(origin)).map((row) => `${row.name}=${row.value}`).join("; "),
    alicePrivate.profile.csrfToken,
    "Synthetic retry agent",
  );
  extraAgents.push(aliceAgent);
  const privateRead = await toolResult(aliceAgent.client, "read_skill", {
    sourceId: alicePrivate.source.id,
    skillId: alicePrivate.pack.skills[0].id,
  });
  const bobRead = await toolResult(bobAgent.client, "read_skill", {
    sourceId: bobPrivate.source.id,
    skillId: bobPrivate.pack.skills[0].id,
  });
  assert.equal(source.pack.skills[0].slug, "fixture-skill");
  assert.equal(alicePrivate.pack.skills[0].slug, source.pack.skills[0].slug);
  assert.equal(bobPrivate.pack.skills[0].slug, source.pack.skills[0].slug);
  assert.equal(new Set([read.skillId, privateRead.skillId, bobRead.skillId]).size, 3);
  assert.equal(privateRead.sha, alicePrivate.pack.revision);
  assert.equal(bobRead.sha, bobPrivate.pack.revision);
  async function visibleRevision(target, sha) {
    const source = target.locator(".skill-reader .reader-source");
    if ((await source.getAttribute("open")) === null) await source.locator("summary").click();
    await source.getByText(sha, { exact: true }).waitFor({ state: "visible" });
  }
  async function freshSource(target, link, status = 200, action) {
    const destination = new URL(link.url);
    const sourcePath = `/api/sources/${destination.searchParams.get("source")}`;
    const [response] = await Promise.all([
      target.waitForResponse(
        (response) =>
          response.url() === `${origin}${sourcePath}` && response.request().method() === "GET",
      ),
      action
        ? action()
        : (async () => {
            const current = new URL(target.url());
            current.hash = "";
            destination.hash = "";
            if (current.href === destination.href) {
              if (target.url() !== link.url) await target.goto(link.url);
              await target.reload();
            } else await target.goto(link.url);
          })(),
    ]);
    assert.equal(response.status(), status);
  }
  async function reader(target, link, marker) {
    stage = target === page ? "Alice private SDK reader" : "Bob private SDK reader";
    await target.bringToFront();
    await freshSource(target, link);
    await target.locator(".skill-reader").getByText(marker, { exact: false }).waitFor();
    assert.equal(new URL(target.url()).searchParams.get("skill"), link.skillId);
    await visibleRevision(target, link.sha);
  }
  await reader(page, privateRead, "PRIVATE ALICE SYNTHETIC CONTENT");
  await page.screenshot({ path: "proof/screenshots/phase-g-agent-private-reader.png" });
  await reader(bobPage, bobRead, "PRIVATE BOB SYNTHETIC CONTENT");
  stage = "private account mismatch and Back";
  await bobPage.goto(privateRead.url);
  await bobPage
    .getByText(
      "This link belongs to a different GitHub account. Sign in with the intended account.",
      { exact: true },
    )
    .waitFor();
  assert.ok(
    !(await bobPage.locator("body").innerText()).includes("PRIVATE ALICE SYNTHETIC CONTENT"),
  );
  await bobPage.screenshot({ path: "proof/screenshots/phase-g-private-account-mismatch.png" });
  await bobPage.goBack();
  await bobPage
    .locator(".skill-reader")
    .getByText("PRIVATE BOB SYNTHETIC CONTENT", { exact: false })
    .waitFor();
  stage = "stale revision refreshed reader";
  await fixtureControl("control", { repositoryId: 202, revision: "d".repeat(40) });
  await freshSource(bobPage, bobRead);
  await bobPage
    .locator(".skill-reader")
    .getByText("PRIVATE BOB SYNTHETIC CONTENT", { exact: false })
    .waitFor();
  await visibleRevision(bobPage, "d".repeat(40));
  stage = "deleted selected skill with another path retained";
  await fixtureControl("control", { repositoryId: 202, revision: "e".repeat(40), deleted: true });
  await freshSource(bobPage, bobRead);
  await bobPage
    .getByText(
      "This skill path has changed or was removed. Refresh access or choose another skill.",
      { exact: true },
    )
    .waitFor();
  await bobPage.getByText("Select a skill to read", { exact: true }).waitFor();
  assert.ok(!(await bobPage.locator("body").innerText()).includes("PRIVATE BOB SYNTHETIC CONTENT"));
  await fixtureControl("control", { repositoryId: 202, revision: "a".repeat(40), deleted: false });
  await reader(bobPage, bobRead, "PRIVATE BOB SYNTHETIC CONTENT");
  stage = "empty repository clears stale body";
  await fixtureControl("control", { repositoryId: 202, revision: "e".repeat(40), empty: true });
  // Reload performs a fresh body read; Refresh access may retain a valid read lease.
  await freshSource(bobPage, bobRead, 422);
  await bobPage
    .getByText(
      "No supported SKILL.md files were found in the repository’s root skills or .agents/skills shelves.",
      { exact: true },
    )
    .waitFor();
  assert.ok(!(await bobPage.locator("body").innerText()).includes("PRIVATE BOB SYNTHETIC CONTENT"));
  stage = "empty repository recovery";
  await fixtureControl("control", { repositoryId: 202, revision: "a".repeat(40) });
  await freshSource(bobPage, bobRead, 200, () =>
    bobPage.getByRole("button", { name: "Refresh access", exact: true }).click(),
  );
  await bobPage
    .locator(".skill-reader")
    .getByText("PRIVATE BOB SYNTHETIC CONTENT", { exact: false })
    .waitFor();
  assert.equal(new URL(bobPage.url()).searchParams.get("skill"), bobRead.skillId);
  stage = "private temporary hidden source";
  await page.bringToFront();
  await page.evaluate(
    async ({ id, csrf }) =>
      fetch(`/api/sources/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-atlas-csrf": csrf },
        body: JSON.stringify({ visible: false }),
      }),
    { id: alicePrivate.source.id, csrf: alicePrivate.profile.csrfToken },
  );
  await page.reload();
  await page.getByRole("button", { name: "Open hidden source temporarily", exact: true }).click();
  await page
    .locator(".skill-reader")
    .getByText("PRIVATE ALICE SYNTHETIC CONTENT", { exact: false })
    .waitFor();
  assert.equal(
    await page.evaluate(
      async (id) =>
        (await (await fetch("/api/profile")).json()).sources.find((row) => row.id === id).visible,
      alicePrivate.source.id,
    ),
    false,
  );

  stage = "ordinary logout preserves agent and private login return";
  await page.getByRole("button", { name: "fixture-alice", exact: true }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByRole("button", { name: "Sign in with GitHub", exact: true }).waitFor();
  assert.ok(!(await page.locator("body").innerText()).includes("PRIVATE ALICE SYNTHETIC CONTENT"));
  assert.equal((await toolResult(aliceAgent.client, "connection_identity")).user.id, 11);
  await page.goto(privateRead.url);
  await page.getByRole("button", { name: "Sign in with GitHub", exact: true }).click();
  await page.getByRole("button", { name: "Open hidden source temporarily", exact: true }).click();
  await page
    .locator(".skill-reader")
    .getByText("PRIVATE ALICE SYNTHETIC CONTENT", { exact: false })
    .waitFor();
  assert.equal(new URL(page.url()).searchParams.get("skill"), privateRead.skillId);

  stage = "global logout failure and same-scope retry";
  const logoutRequests = [];
  await context.route("**/api/signout-everywhere", async (route) => {
    logoutRequests.push(`${route.request().method()} global`);
    if (logoutRequests.length === 1)
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "provider-unavailable" }),
      });
    else await route.continue();
  });
  await context.route("**/api/session", async (route) => {
    if (route.request().method() === "DELETE") logoutRequests.push("DELETE browser");
    await route.continue();
  });
  await page.getByRole("button", { name: "fixture-alice", exact: true }).click();
  await page.getByRole("button", { name: "Sign out everywhere", exact: true }).click();
  const retry = page.getByRole("button", { name: "Retry sign out everywhere", exact: true });
  await retry.waitFor();
  stage = "global failure private clearing and agent still active";
  assert.ok(!(await page.locator("body").innerText()).includes("PRIVATE ALICE SYNTHETIC CONTENT"));
  assert.equal((await toolResult(aliceAgent.client, "connection_identity")).user.id, 11);
  stage = "global Retry success and MCP denial";
  await retry.click();
  await page
    .getByText("Signed out everywhere. Browser and agent access is revoked.", { exact: true })
    .waitFor();
  await page.screenshot({ path: "proof/screenshots/phase-g-agent-revoked.png" });
  assert.equal(await retry.count(), 0);
  assert.deepEqual(logoutRequests, ["POST global", "POST global"]);
  await assert.rejects(() => toolResult(aliceAgent.client, "connection_identity"));
  assert.equal((await toolResult(bobAgent.client, "connection_identity")).user.id, 22);
  observations.push(
    "Native cancellation/invalid callback and login-required consent; two private profiles with same-slug distinct IDs, SDK URLs, SHA, hidden temporary opening, Back and private login return; browser logout preserves agent, failed global logout Retry repeats POST and revokes agent while immediately clearing private content.",
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(escaped, []);
  await writeFile(
    "proof/runtime/phase-d-browser.json",
    JSON.stringify(
      {
        status: "PASS",
        startedAt,
        completedAt: new Date().toISOString(),
        syntheticOnly: true,
        observations,
        diagnostics,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ status: "PASS", report: "proof/runtime/phase-d-browser.json" }));
} catch (error) {
  await writeFile(
    "proof/runtime/phase-d-browser.json",
    JSON.stringify(
      {
        status: "FAIL",
        syntheticOnly: true,
        stage,
        failure: safeError(error),
        errors,
        diagnostics,
        observations,
      },
      null,
      2,
    ),
  );
  throw new Error(
    `Synthetic browser proof failed at ${stage}; see sanitized phase-d-browser.json`,
    {
      // eslint-disable-next-line preserve-caught-error -- Raw assertions may contain OAuth values or private bodies; preserve only sanitized diagnostics.
      cause: safeError(error),
    },
  );
} finally {
  await Promise.allSettled([
    ...extraAgents.map((connection) => connection.client.close()),
    agent?.client.close(),
    browser?.close(),
    server?.stop(),
    callbackListener?.stop(),
  ]);
}
