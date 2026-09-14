// In-memory native runtime proof. No Wrangler, env loader, persistent state or live network.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";

const bundled = await build({
  stdin: {
    contents: `import { GitHubIdentity } from './worker/github.ts';
      export default { async fetch() {
        const identity = new GitHubIdentity();
        const policy = { clientId: 'synthetic-client', clientSecret: 'synthetic-secret',
          callback: 'https://fixture.invalid/callback', allowedUserIds: [11] };
        const state = 'a'.repeat(43), verifier = 'b'.repeat(43);
        const url = new URL(policy.callback);
        url.search = new URLSearchParams({state, code: 'synthetic-code', iss: 'https://github.com/login/oauth'});
        const result = await identity.exchange(policy, url, state, verifier);
        const user = await identity.authorize(policy, result.token);
        return Response.json({id: user.id, login: user.login, lifetime: result.lifetime});
      }};`,
    resolveDir: process.cwd(),
    sourcefile: "synthetic-oauth-workerd.ts",
    loader: "ts",
  },
  bundle: true,
  write: false,
  format: "esm",
  platform: "neutral",
  external: ["node:crypto"],
  conditions: ["workerd", "worker", "browser"],
});
const calls = [];
const mf = new Miniflare(
  convertV4MiniflareOptions({
    modules: true,
    script: bundled.outputFiles[0].text,
    compatibilityDate: "2026-09-08",
    compatibilityFlags: ["nodejs_compat"],
    outboundService: async (request) => {
      const url = new URL(request.url);
      calls.push(url.origin + url.pathname);
      if (url.href === "https://github.com/login/oauth/access_token") {
        assert.equal(request.method, "POST");
        const body = new URLSearchParams(await request.text());
        assert.equal(body.get("client_secret"), "synthetic-secret");
        assert.equal(body.get("code_verifier"), "b".repeat(43));
        assert.equal(body.get("redirect_uri"), "https://fixture.invalid/callback");
        return Response.json({
          access_token: "synthetic-token",
          token_type: "bearer",
          scope: "",
          expires_in: 28800,
        });
      }
      assert.equal(url.href, "https://api.github.com/user", "Unexpected outbound target");
      assert.equal(request.headers.get("authorization"), "Bearer synthetic-token");
      return Response.json({ id: 11, login: "fixture-user", type: "User" });
    },
  }),
);
try {
  const response = await mf.dispatchFetch("https://fixture.invalid/proof");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { id: 11, login: "fixture-user", lifetime: 28800000 });
  assert.deepEqual(calls, [
    "https://github.com/login/oauth/access_token",
    "https://api.github.com/user",
  ]);
} finally {
  await mf.dispose();
}
console.log(
  "PASS native Workerd default GitHubIdentity exchange and authorization; synthetic outbound only",
);
