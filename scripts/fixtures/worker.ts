import { handleRequest } from "../../worker/index.js";
import { githubFixture, type FixtureUser, type FixtureMembership } from "./github.js";

const fixture = githubFixture();
const origin = "http://127.0.0.1:8790";

// Local-only entrypoint. Production imports neither this module nor its control routes.
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.origin !== origin) return new Response("Local fixture only", { status: 403 });
    if (url.pathname.startsWith("/__fixture/")) {
      if (request.method !== "POST" || request.headers.get("origin") !== origin)
        return new Response(null, { status: 403 });
      const body = await request.json<{
        url?: string;
        user?: FixtureUser;
        membership?: FixtureMembership;
        revoked?: boolean;
        repositoryId?: number;
        repositoryName?: string;
        users?: number[];
        revision?: string;
        deleted?: boolean;
        empty?: boolean;
      }>();
      if (
        url.pathname === "/__fixture/authorize" &&
        body.url &&
        body.user &&
        Object.hasOwn(fixture.users, body.user)
      ) {
        return Response.json({ callback: fixture.authorize(body.url, body.user) });
      }
      if (url.pathname === "/__fixture/control") {
        if (body.user && Object.hasOwn(fixture.users, body.user)) {
          if (body.membership) fixture.users[body.user].membership = body.membership;
          if (typeof body.revoked === "boolean") fixture.users[body.user].revoked = body.revoked;
        }
        const repository = fixture.repositories.find((repo) => repo.id === body.repositoryId);
        if (repository && body.users) repository.users = body.users;
        if (repository && body.revision && /^[a-f0-9]{40}$/u.test(body.revision))
          fixture.contentState.set(repository.id, {
            revision: body.revision,
            deleted: body.deleted === true,
            empty: body.empty === true,
          });
        if (repository && body.repositoryName) repository.name = body.repositoryName;
        return Response.json({ ok: true });
      }
      return new Response(null, { status: 404 });
    }
    return handleRequest(
      request,
      {
        ...env,
        ATLAS_ORIGIN: origin,
        ATLAS_DEPLOYMENT: "self-hosted",
        ATLAS_LOCAL_HTTP: "true",
        ATLAS_ALLOWED_ORG: env.ATLAS_ALLOWED_ORG ?? "onlinesourdough",
        ATLAS_ALLOWED_USER_IDS: env.ATLAS_ALLOWED_USER_IDS ?? "",
        ATLAS_DEFAULT_REPOSITORY: env.ATLAS_DEFAULT_REPOSITORY ?? "onlinesourdough/Global-Skills",
        GITHUB_CLIENT_ID: "fixture-client-id",
        GITHUB_CLIENT_SECRET: "fixture-client-secret",
        ATLAS_ENCRYPTION_KEY: btoa("0123456789abcdef0123456789abcdef"),
      },
      { fetcher: fixture.fetcher, ctx },
    );
  },
} satisfies ExportedHandler<Env>;
