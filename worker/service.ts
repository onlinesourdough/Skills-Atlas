import type { AtlasPack } from "../src/types.js";
import { oauthDiagnostic, type OAuthStage } from "./oauth-diagnostic.js";
import { internalDestination } from "../src/domain/deep-link.js";
import { GITHUB_OAUTH_ISSUER, type GitHubIdentity } from "./github.js";
import type { ProfileStore, SessionRow, SourceRow } from "./store.js";
import {
  AtlasError,
  boundedText,
  cookie,
  cookieName,
  equalSecret,
  hash,
  OAUTH_MS,
  randomSecret,
  READ_LEASE_MS,
  readCookie,
  seal,
  unseal,
  type DeploymentPolicy,
} from "./security.js";

export interface ReadPrincipal {
  userId: number;
  login: string;
  expiresAt: number;
  token: string;
  checkedAt: number;
  assertCurrent: () => Promise<void>;
}

export interface Principal extends ReadPrincipal {
  session: SessionRow;
}

export class AtlasService {
  constructor(
    readonly policy: DeploymentPolicy,
    readonly store: ProfileStore,
    readonly github: GitHubIdentity,
    readonly now: () => number = Date.now,
  ) {}

  async login(request: Request): Promise<Response> {
    const body = await boundedText(request, 16384);
    if (body.length > 16384) throw new AtlasError("request-limit", 413);
    const form = new URLSearchParams(body);
    const returnTo = internalDestination(form.get("returnTo"), this.policy.origin);
    if (form.has("returnTo") && (!returnTo || form.getAll("returnTo").length !== 1))
      throw new AtlasError("invalid-return-destination");
    const state = randomSecret();
    const browser = readCookie(request, cookieName(this.policy, "oauth")) ?? randomSecret();
    const verifier = randomSecret();
    const stateHash = await hash(state);
    const oldSession = readCookie(request, cookieName(this.policy, "session"));
    const now = this.now();
    await this.store.startAttempt(
      {
        state_hash: stateHash,
        return_to: returnTo,
        browser_hash: await hash(browser),
        verifier_ciphertext: await seal(
          verifier,
          this.policy.encryptionKey,
          `${this.policy.key}:flow:${stateHash}`,
        ),
        expires_at: now + OAUTH_MS,
      },
      await hash(oldSession ?? ""),
      now,
    );
    const headers = new Headers({
      location: await this.github.authorizationUrl(this.policy, state, verifier),
    });
    headers.append("set-cookie", cookie(this.policy, "oauth", browser, OAUTH_MS));
    headers.append("set-cookie", cookie(this.policy, "session", "", 0));
    return new Response(null, { status: 303, headers });
  }

  async callback(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const rejection: OAuthStage | null =
      `${url.origin}${url.pathname}` !== this.policy.callback
        ? "callback-url"
        : url.hash
          ? "callback-hash"
          : url.searchParams.getAll("state").length !== 1
            ? "callback-state-count"
            : url.searchParams.getAll("code").length !== 1
              ? "callback-code-count"
              : url.searchParams.getAll("iss").length > 1 ||
                  (url.searchParams.has("iss") &&
                    url.searchParams.get("iss") !== GITHUB_OAUTH_ISSUER)
                ? "callback-issuer"
                : [...url.searchParams.keys()].some(
                      (name) => !["state", "code", "iss"].includes(name),
                    )
                  ? "callback-unexpected-parameter"
                  : null;
    if (rejection) {
      const errors = url.searchParams.getAll("error");
      oauthDiagnostic(
        rejection,
        undefined,
        errors.length === 1 ? errors[0] : undefined,
        rejection === "callback-unexpected-parameter"
          ? [...url.searchParams.keys()].filter((name) => !["state", "code", "iss"].includes(name))
          : undefined,
      );
      throw new AtlasError("oauth-invalid");
    }
    const state = url.searchParams.get("state")!;
    const code = url.searchParams.get("code")!;
    const browser = readCookie(request, cookieName(this.policy, "oauth"));
    if (!/^[A-Za-z0-9_-]{43}$/u.test(state) || !code || code.length > 512 || !browser) {
      oauthDiagnostic("callback-browser");
      throw new AtlasError("oauth-invalid");
    }
    const stateHash = await hash(state);
    const attempt = await this.store.consumeAttempt(stateHash, await hash(browser));
    if (!attempt) {
      oauthDiagnostic("callback-attempt");
      throw new AtlasError("oauth-invalid");
    }
    let stage: OAuthStage = "callback-expiry";
    try {
      if (attempt.expires_at <= this.now()) throw new AtlasError("oauth-expired");
      stage = "callback-unseal";
      const verifier = await unseal(
        attempt.verifier_ciphertext,
        this.policy.encryptionKey,
        `${this.policy.key}:flow:${stateHash}`,
      );
      const started = this.now();
      stage = "callback-exchange";
      const upstream = await this.github.exchange(this.policy, url, state, verifier);
      stage = "callback-access";
      const user = await this.github.authorize(this.policy, upstream.token);
      stage = "callback-session";
      const token = randomSecret();
      const sessionHash = await hash(token);
      const expires = started + upstream.lifetime;
      const credentialId = crypto.randomUUID();
      const row: SessionRow = {
        session_hash: sessionHash,
        browser_hash: attempt.browser_hash,
        user_id: user.id,
        login: user.login,
        credential_id: credentialId,
        token_ciphertext: await seal(
          upstream.token,
          this.policy.encryptionKey,
          `${this.policy.key}:credential:${credentialId}:${user.id}`,
        ),
        csrf_token: randomSecret(),
        policy_key: this.policy.key,
        expires_at: expires,
      };
      await this.store.completeLogin(row, stateHash, this.policy.defaultRepository, this.now());
      const destination =
        internalDestination(attempt.return_to ?? null, this.policy.origin) ?? "/#graph";
      const headers = new Headers({ location: `${this.policy.origin}${destination}` });
      headers.append("set-cookie", cookie(this.policy, "session", token, expires - this.now()));
      headers.append("set-cookie", cookie(this.policy, "oauth", "", 0));
      return new Response(null, { status: 303, headers });
    } catch (error) {
      oauthDiagnostic(stage);
      throw error;
    } finally {
      await this.store.discardAttempt(stateHash);
    }
  }

  async principal(request: Request): Promise<Principal> {
    const raw = readCookie(request, cookieName(this.policy, "session"));
    if (!raw) throw new AtlasError("login-required", 401);
    const session = await this.store.session(await hash(raw));
    if (!session || session.expires_at <= this.now() || session.policy_key !== this.policy.key)
      throw new AtlasError("session-expired", 401);
    const checkedAt = this.now();
    try {
      const token = await unseal(
        session.token_ciphertext,
        this.policy.encryptionKey,
        `${this.policy.key}:credential:${session.credential_id}:${session.user_id}`,
      );
      const user = await this.github.authorize(this.policy, token, session.user_id);
      await this.store.assertCurrent(session, this.now());
      return {
        session: { ...session, login: user.login },
        token,
        checkedAt,
        userId: session.user_id,
        login: user.login,
        expiresAt: session.expires_at,
        assertCurrent: () => this.store.assertCurrent(session, this.now()),
      };
    } catch (error) {
      if (
        error instanceof AtlasError &&
        ["session-expired", "access-denied", "membership-pending"].includes(error.code)
      )
        await this.store.revokeUser(session.user_id);
      throw error;
    }
  }

  async csrf(request: Request, principal: Principal): Promise<void> {
    if (
      !(await equalSecret(request.headers.get("x-atlas-csrf") ?? "", principal.session.csrf_token))
    )
      throw new AtlasError("csrf-denied", 403);
  }

  async logout(request: Request, everywhere = false): Promise<Response> {
    const raw = readCookie(request, cookieName(this.policy, "session"));
    const sessionHash = await hash(raw ?? "");
    const session = raw ? await this.store.session(sessionHash) : null;
    if (everywhere && !session) throw new AtlasError("login-required", 401);
    // Logout must remain possible when GitHub is unavailable or has revoked access.
    if (
      session &&
      !(await equalSecret(request.headers.get("x-atlas-csrf") ?? "", session.csrf_token))
    )
      throw new AtlasError("csrf-denied", 403);
    const browser = readCookie(request, cookieName(this.policy, "oauth"));
    if (everywhere && session) await this.store.revokeUser(session.user_id);
    await this.store.logout(sessionHash, await hash(browser ?? ""));
    const headers = new Headers();
    headers.append("set-cookie", cookie(this.policy, "session", "", 0));
    headers.append("set-cookie", cookie(this.policy, "oauth", "", 0));
    return Response.json({ kind: "atlas-logout", signedOut: true }, { headers });
  }

  async revocationUser(request: Request): Promise<number> {
    const raw = readCookie(request, cookieName(this.policy, "session"));
    const session = raw ? await this.store.session(await hash(raw)) : null;
    if (!session || session.expires_at <= this.now() || session.policy_key !== this.policy.key)
      throw new AtlasError("login-required", 401);
    if (!(await equalSecret(request.headers.get("x-atlas-csrf") ?? "", session.csrf_token)))
      throw new AtlasError("csrf-denied", 403);
    return session.user_id;
  }

  lease(principal: ReadPrincipal): number {
    return Math.min(principal.checkedAt + READ_LEASE_MS, principal.expiresAt);
  }

  private preference(source: SourceRow, available: boolean, until: number) {
    return {
      id: source.id,
      repositoryId: source.repository_id,
      repository: source.repository,
      visible: source.visible === 1,
      available,
      authorizedUntil: available ? until : 0,
    };
  }

  async profile(principal: Principal) {
    const rows = await this.store.sources(principal.session.user_id);
    const sources = [];
    for (const source of rows) {
      try {
        const repository = await this.github.repository(
          principal.token,
          source.repository,
          source.repository_id,
        );
        sources.push(
          this.preference(
            { ...source, repository: repository.name, repository_id: repository.id },
            true,
            this.lease(principal),
          ),
        );
      } catch (error) {
        if (error instanceof AtlasError && error.code === "session-expired") {
          await this.store.revokeUser(principal.session.user_id);
          throw error;
        }
        sources.push(this.preference(source, false, 0));
      }
    }
    await this.store.assertCurrent(principal.session, this.now());
    if (this.lease(principal) <= this.now()) throw new AtlasError("authorization-unavailable", 503);
    return {
      kind: "atlas-profile" as const,
      deployment: this.policy.deployment,
      user: { id: principal.session.user_id, login: principal.session.login },
      csrfToken: principal.session.csrf_token,
      expiresAt: principal.session.expires_at,
      authorizedUntil: this.lease(principal),
      sources,
    };
  }

  async readSource(principal: Principal, id: string) {
    const result = await this.readAuthorizedSource(principal, id);
    await this.store.identifySource(
      principal.session,
      id,
      result.source.repositoryId!,
      result.source.repository,
      this.now(),
    );
    return result;
  }

  async readAuthorizedSource(principal: ReadPrincipal, id: string) {
    const source = await this.store.source(principal.userId, id);
    const repository = await this.github.repository(
      principal.token,
      source.repository,
      source.repository_id,
    );
    const pack = await this.github.read(principal.token, repository);
    await principal.assertCurrent();
    const current = await this.store.source(principal.userId, id);
    if (current.repository_id !== source.repository_id || current.repository !== source.repository)
      throw new AtlasError("source-unavailable", 404);
    return this.sourceResult(
      principal,
      { ...current, repository_id: repository.id, repository: repository.name },
      pack,
    );
  }

  async previewSource(principal: Principal, repositoryName: string) {
    const repository = await this.github.repository(principal.token, repositoryName);
    const pack = await this.github.read(principal.token, repository);
    await this.store.assertCurrent(principal.session, this.now());
    if (this.lease(principal) <= this.now()) throw new AtlasError("authorization-unavailable", 503);
    return { kind: "atlas-source-preview" as const, pack, authorizedUntil: this.lease(principal) };
  }

  async importSource(
    principal: Principal,
    repositoryName: string,
    expected?: { repositoryId: number; revision: string },
  ) {
    const { pack } = await this.previewSource(principal, repositoryName);
    if (
      expected &&
      (pack.repositoryId !== expected.repositoryId || pack.revision !== expected.revision)
    )
      throw new AtlasError("preview-changed", 409);
    const source = await this.store.saveSource(
      principal.session,
      pack.repositoryId!,
      pack.repository,
      this.now(),
    );
    return this.sourceResult(principal, source, pack);
  }

  private sourceResult(principal: ReadPrincipal, source: SourceRow, pack: AtlasPack) {
    if (this.lease(principal) <= this.now()) throw new AtlasError("authorization-unavailable", 503);
    return {
      kind: "atlas-source" as const,
      source: this.preference(source, true, this.lease(principal)),
      pack,
    };
  }

  async visibility(principal: Principal, id: string, visible: boolean): Promise<void> {
    const source = await this.store.source(principal.session.user_id, id);
    if (visible)
      await this.github.repository(principal.token, source.repository, source.repository_id);
    await this.store.setVisible(principal.session, id, visible, this.now());
  }
}
