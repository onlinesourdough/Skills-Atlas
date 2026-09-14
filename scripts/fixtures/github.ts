// Synthetic provider used only by tests and the separately configured local browser fixture.
// It is never imported by the production Worker entrypoint.
export type FixtureUser = "alice" | "bob" | "pending" | "nonmember" | "outside";
export type FixtureMembership = "active" | "pending" | "absent" | "unknown" | "rate-limited";

export function githubFixture() {
  const users = {
    alice: {
      id: 11,
      login: "fixture-alice",
      membership: "active" as FixtureMembership,
      revoked: false,
    },
    bob: {
      id: 22,
      login: "fixture-bob",
      membership: "active" as FixtureMembership,
      revoked: false,
    },
    pending: {
      id: 33,
      login: "fixture-pending",
      membership: "pending" as FixtureMembership,
      revoked: false,
    },
    nonmember: {
      id: 44,
      login: "fixture-nonmember",
      membership: "absent" as FixtureMembership,
      revoked: false,
    },
    outside: {
      id: 55,
      login: "fixture-outside",
      membership: "absent" as FixtureMembership,
      revoked: false,
    },
  };
  const repositories = [
    {
      id: 101,
      name: "onlinesourdough/Global-Skills",
      users: [11, 22, 33, 44, 55],
      installed: true,
      marker: "PUBLIC SYNTHETIC DEFAULT",
    },
    {
      id: 201,
      name: "fixture-alice/private-skills",
      users: [11],
      installed: true,
      marker: "PRIVATE ALICE SYNTHETIC CONTENT",
    },
    {
      id: 202,
      name: "fixture-bob/private-skills",
      users: [22],
      installed: true,
      marker: "PRIVATE BOB SYNTHETIC CONTENT",
    },
    {
      id: 301,
      name: "fixture-team/shared-skills",
      users: [11, 22],
      installed: true,
      marker: "SHARED SYNTHETIC CONTENT",
    },
    {
      id: 401,
      name: "fixture-alice/not-installed",
      users: [11],
      installed: false,
      marker: "UNINSTALLED SYNTHETIC CONTENT",
    },
    {
      id: 102,
      name: "fixture-operator/public-skills",
      users: [11, 22, 33, 44, 55],
      installed: true,
      marker: "PUBLIC SYNTHETIC OPERATOR DEFAULT",
    },
  ];
  const contentState = new Map<number, { revision: string; deleted: boolean; empty?: boolean }>();
  const codes = new Map<
    string,
    { user: FixtureUser; challenge: string; callback: string; lifetime: number }
  >();
  const calls: Array<{ path: string; method: string; userId: number | null }> = [];
  let tokenExchanges = 0;

  function authorize(url: string, user: FixtureUser, lifetime = 28800): string {
    const parsed = new URL(url);
    if (
      parsed.origin !== "https://github.com" ||
      parsed.pathname !== "/login/oauth/authorize" ||
      parsed.searchParams.get("code_challenge_method") !== "S256" ||
      !parsed.searchParams.get("state")
    )
      throw new Error("Invalid fixture authorization request");
    const code = `fixture-code-${crypto.randomUUID()}`;
    const callback = parsed.searchParams.get("redirect_uri")!;
    codes.set(code, {
      user,
      callback,
      challenge: parsed.searchParams.get("code_challenge")!,
      lifetime,
    });
    const result = new URL(callback);
    result.searchParams.set("state", parsed.searchParams.get("state")!);
    result.searchParams.set("code", code);
    return result.href;
  }

  const fetcher: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (url.origin === "https://github.com" && url.pathname === "/login/oauth/access_token") {
      tokenExchanges += 1;
      const body = new URLSearchParams(new TextDecoder().decode(await request.arrayBuffer()));
      const code = body.get("code") ?? "";
      const saved = codes.get(code);
      codes.delete(code);
      const hash = new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(body.get("code_verifier") ?? ""),
        ),
      );
      const challenge = btoa(String.fromCharCode(...hash))
        .replaceAll("+", "-")
        .replaceAll("/", "_")
        .replaceAll("=", "");
      if (
        !saved ||
        saved.challenge !== challenge ||
        saved.callback !== body.get("redirect_uri") ||
        body.get("client_secret") !== "fixture-client-secret" ||
        body.get("client_id") !== "fixture-client-id"
      )
        return Response.json({ error: "bad_verification_code" }, { status: 400 });
      return Response.json({
        access_token: `fixture-user-token-${users[saved.user].id}`,
        token_type: "bearer",
        scope: "",
        expires_in: saved.lifetime,
        refresh_token: "unused-fixture-refresh-token",
      });
    }
    if (url.origin !== "https://api.github.com" || request.method !== "GET")
      throw new Error("Fixture blocked unexpected upstream request");
    if (request.redirect !== "manual" || !request.headers.get("user-agent"))
      throw new Error("Fixture requires explicit server redirect and User-Agent policy");
    const tokenId = Number(
      request.headers.get("authorization")?.replace("Bearer fixture-user-token-", ""),
    );
    const user = Object.values(users).find((item) => item.id === tokenId);
    calls.push({ path: url.pathname, method: request.method, userId: user?.id ?? null });
    if (!user || user.revoked) return Response.json({}, { status: 401 });
    if (url.pathname === "/user")
      return Response.json({ id: user.id, login: user.login, type: "User" });
    if (url.pathname.startsWith("/user/memberships/orgs/")) {
      if (user.membership === "absent") return Response.json({}, { status: 404 });
      if (user.membership === "rate-limited")
        return Response.json({}, { status: 403, headers: { "x-ratelimit-remaining": "0" } });
      return Response.json({
        state: user.membership,
        role: "member",
        organization: { login: url.pathname.split("/").at(-1), id: 999 },
        user: { id: user.id, login: user.login },
      });
    }
    const repository = repositories.find(
      (repo) =>
        url.pathname === `/repositories/${repo.id}` ||
        url.pathname === `/repos/${repo.name}` ||
        url.pathname.startsWith(`/repos/${repo.name}/`),
    );
    if (!repository || !repository.installed || !repository.users.includes(user.id))
      return Response.json({}, { status: 404 });
    const prefix = `/repos/${repository.name}`;
    if (url.pathname === prefix || url.pathname === `/repositories/${repository.id}`)
      return Response.json({
        id: repository.id,
        full_name: repository.name,
        html_url: `https://github.com/${repository.name}`,
        default_branch: "main",
        private: ![101, 102].includes(repository.id),
        permissions: { pull: true, push: false },
      });
    if (url.pathname === `${prefix}/branches/main`)
      return Response.json({
        commit: {
          sha: contentState.get(repository.id)?.revision ?? "a".repeat(40),
          commit: { tree: { sha: "b".repeat(40) } },
        },
      });
    const markdown = `---\nname: fixture-skill\ndescription: Synthetic phase C fixture.\ncategory: ${[101, 102].includes(repository.id) ? "Public" : "Private"}\n---\n\n# Fixture skill\n\n${repository.marker}\n\nFINAL SYNTHETIC LINE\n`;
    if (url.pathname === `${prefix}/git/trees/${"b".repeat(40)}`)
      return Response.json({
        truncated: false,
        tree: contentState.get(repository.id)?.empty
          ? []
          : contentState.get(repository.id)?.deleted
            ? [
                {
                  path: "skills/retained-skill/SKILL.md",
                  type: "blob",
                  mode: "100644",
                  sha: "f".repeat(40),
                  size: 100,
                },
              ]
            : [
                {
                  path: "skills/fixture-skill/SKILL.md",
                  type: "blob",
                  mode: "100644",
                  sha: "c".repeat(40),
                  size: markdown.length,
                },
              ],
      });
    if (url.pathname === `${prefix}/git/blobs/${"c".repeat(40)}`)
      return Response.json({
        encoding: "base64",
        content: btoa(markdown),
        size: markdown.length,
        sha: "c".repeat(40),
      });
    if (url.pathname === `${prefix}/git/blobs/${"f".repeat(40)}`) {
      const retained =
        "---\nname: retained-skill\ndescription: Synthetic remaining path.\n---\n\nSYNTHETIC RETAINED SKILL\n";
      return Response.json({
        encoding: "base64",
        content: btoa(retained),
        size: retained.length,
        sha: "f".repeat(40),
      });
    }
    return Response.json({}, { status: 404 });
  };
  return {
    users,
    repositories,
    contentState,
    calls,
    codes,
    authorize,
    fetcher,
    tokenExchanges: () => tokenExchanges,
  };
}
