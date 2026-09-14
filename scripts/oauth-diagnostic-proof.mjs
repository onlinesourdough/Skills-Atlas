// Isolated in-memory proof: no environment loader, Wrangler, database or network.
import assert from "node:assert/strict";
import { GitHubIdentity } from "../worker/github.ts";
import { AtlasService } from "../worker/service.ts";
import { oauthDiagnostic } from "../worker/oauth-diagnostic.ts";
import { hash, seal } from "../worker/security.ts";

const sentinel = "SYNTHETIC_SECRET_NEVER_LOG";
const policy = {
  clientId: sentinel,
  clientSecret: sentinel,
  callback: "https://fixture.invalid/auth/github/callback",
};
const state = "a".repeat(43);
const verifier = "b".repeat(43);
const url = new URL(`${policy.callback}?state=${state}&code=${sentinel}`);
const logs = [];
const warn = console.warn;
const originalFetch = globalThis.fetch;
globalThis.fetch = () => {
  throw new Error("Network forbidden in diagnostic proof");
};
console.warn = (line) => logs.push(line);
try {
  for (const [body, status, expected] of [
    [{ access_token: sentinel, token_type: "bearer", scope: "", expires_in: 28800 }, 200, null],
    [
      { error: sentinel, error_description: sentinel, error_uri: sentinel },
      400,
      "exchange-response",
    ],
    [
      { access_token: sentinel, token_type: "bearer", scope: sentinel },
      200,
      "exchange-token-policy",
    ],
    [sentinel, 502, "exchange-response"],
  ]) {
    logs.length = 0;
    const provider = new GitHubIdentity(async (_input, options) => {
      const params = new URLSearchParams(options.body);
      assert.equal(params.get("code_verifier"), verifier);
      assert.equal(params.get("redirect_uri"), policy.callback);
      assert.equal(params.get("client_secret"), sentinel);
      return Response.json(body, { status });
    });
    if (!expected) {
      assert.equal((await provider.exchange(policy, url, state, verifier)).token, sentinel);
      assert.deepEqual(logs, []);
    } else {
      await assert.rejects(
        provider.exchange(policy, url, state, verifier),
        (error) => error.code === "oauth-invalid" && error.cause === undefined,
      );
      assert.deepEqual(logs.map(JSON.parse), [
        { event: "atlas-oauth-failure", stage: expected, status },
      ]);
    }
    assert(!logs.join("").includes(sentinel));
  }
  logs.length = 0;
  const broken = new GitHubIdentity(async () => {
    throw new Error(sentinel, { cause: sentinel });
  });
  await assert.rejects(broken.exchange(policy, url, state, verifier));
  assert.deepEqual(logs.map(JSON.parse), [
    { event: "atlas-oauth-failure", stage: "exchange-request" },
  ]);
  logs.length = 0;
  await assert.rejects(broken.exchange(policy, url, "wrong-state", verifier));
  assert.deepEqual(logs.map(JSON.parse), [
    { event: "atlas-oauth-failure", stage: "exchange-validation" },
  ]);
  const service = new AtlasService(policy, { consumeAttempt: async () => null }, broken);
  for (const [request, stage] of [
    [new Request(`${url}&${sentinel}=${sentinel}`), "callback-unexpected-parameter"],
    [new Request(url), "callback-browser"],
    [
      new Request(url, { headers: { cookie: `atlas_local_oauth=${"c".repeat(43)}` } }),
      "callback-attempt",
    ],
  ]) {
    logs.length = 0;
    await assert.rejects(service.callback(request));
    assert.deepEqual(logs.map(JSON.parse), [
      {
        event: "atlas-oauth-failure",
        stage,
        ...(stage === "callback-unexpected-parameter" ? { parameterCategories: ["unknown"] } : {}),
      },
    ]);
  }
  for (const [suffix, stage, oauthError] of [
    [
      `?state=${state}&error=access_denied&error_description=${sentinel}`,
      "callback-code-count",
      "access_denied",
    ],
    [`?error=access_denied`, "callback-state-count", "access_denied"],
    [`?state=${state}&error=${sentinel}`, "callback-code-count", undefined],
    [`?state=${state}&error=access_denied&error=access_denied`, "callback-code-count", undefined],
    [`?state=${state}&error=access_denied&error=${sentinel}`, "callback-code-count", undefined],
    [
      `?state=${state}&code=${sentinel}&error=access_denied`,
      "callback-unexpected-parameter",
      "access_denied",
    ],
    [`?state=${state}&state=${sentinel}&code=${sentinel}`, "callback-state-count", undefined],
    [`?state=${state}&code=${sentinel}&code=${sentinel}`, "callback-code-count", undefined],
    [`?state=${state}&code=${sentinel}#${sentinel}`, "callback-hash", undefined],
    [`/wrong?state=${state}&code=${sentinel}`, "callback-url", undefined],
  ]) {
    logs.length = 0;
    await assert.rejects(
      service.callback(new Request(`${policy.callback}${suffix}`)),
      (error) => error.code === "oauth-invalid",
    );
    assert.deepEqual(logs.map(JSON.parse), [
      {
        event: "atlas-oauth-failure",
        stage,
        ...(oauthError ? { oauthError } : {}),
        ...(stage === "callback-unexpected-parameter" ? { parameterCategories: ["error"] } : {}),
      },
    ]);
    assert(!logs.join("").includes(sentinel));
  }
  for (const category of [
    "scope",
    "installation_id",
    "setup_action",
    "authuser",
    "prompt",
    "error",
    "error_description",
    "error_uri",
    sentinel,
  ]) {
    logs.length = 0;
    await assert.rejects(
      service.callback(
        new Request(`${url}&${category}=${sentinel}&${category}=${sentinel}&${sentinel}=private`),
      ),
      (error) => error.code === "oauth-invalid",
    );
    assert.deepEqual(logs.map(JSON.parse), [
      {
        event: "atlas-oauth-failure",
        stage: "callback-unexpected-parameter",
        parameterCategories: category === sentinel ? ["unknown"] : [category, "unknown"],
      },
    ]);
    assert(!logs.join("").includes(sentinel));
  }
  logs.length = 0;
  for (const suffix of [
    "&iss=",
    `&iss=${sentinel}`,
    "&iss=https://github.com/",
    "&iss=https://github.com",
    "&iss=https://github.com/login/oauth/",
    "&iss=http://github.com",
    "&iss=https://github.com/login/oauth&iss=https://github.com/login/oauth",
    "&iss=https://github.com%3Fextra",
    "&iss=%00",
  ]) {
    logs.length = 0;
    await assert.rejects(
      service.callback(new Request(`${url}${suffix}`)),
      (error) => error.code === "oauth-invalid",
    );
    assert.deepEqual(logs.map(JSON.parse), [
      { event: "atlas-oauth-failure", stage: "callback-issuer" },
    ]);
  }
  for (const suffix of ["", "&iss=https%3A%2F%2Fgithub.com%2Flogin%2Foauth"]) {
    logs.length = 0;
    let exchanges = 0;
    let completed = false;
    const fullPolicy = {
      ...policy,
      origin: "https://fixture.invalid",
      key: "synthetic-policy",
      encryptionKey: "d".repeat(43),
      allowedUserIds: [11],
      defaultRepository: "fixture/example",
    };
    const provider = new GitHubIdentity(async (input, options) => {
      if (String(input) === "https://github.com/login/oauth/access_token") {
        exchanges++;
        assert.equal(new URLSearchParams(options.body).get("code_verifier"), verifier);
        return Response.json({ access_token: sentinel, token_type: "bearer", scope: "" });
      }
      assert.equal(String(input), "https://api.github.com/user");
      return Response.json({ id: 11, login: "fixture-user", type: "User" });
    });
    const store = {
      consumeAttempt: async () => ({
        expires_at: Date.now() + 60000,
        browser_hash: await hash("c".repeat(43)),
        verifier_ciphertext: await seal(
          verifier,
          fullPolicy.encryptionKey,
          `${fullPolicy.key}:flow:${await hash(state)}`,
        ),
      }),
      completeLogin: async () => {
        completed = true;
      },
      discardAttempt: async () => {},
    };
    const result = await new AtlasService(fullPolicy, store, provider).callback(
      new Request(`${url}${suffix}`, {
        headers: { cookie: `atlas_local_oauth=${"c".repeat(43)}` },
      }),
    );
    assert.equal(result.status, 303);
    assert.equal(exchanges, 1);
    assert(completed);
    assert.deepEqual(logs, []);
  }
  logs.length = 0;
  oauthDiagnostic(sentinel, 400);
  oauthDiagnostic("exchange-request", sentinel);
  oauthDiagnostic("exchange-request", NaN);
  oauthDiagnostic("exchange-request", 999);
  assert.deepEqual(
    logs.map(JSON.parse),
    Array.from({ length: 3 }, () => ({ event: "atlas-oauth-failure", stage: "exchange-request" })),
  );
  assert(!logs.join("").includes(sentinel));
} finally {
  console.warn = warn;
  globalThis.fetch = originalFetch;
}
console.log("PASS isolated OAuth compatibility, stage and secret-redaction proof");
