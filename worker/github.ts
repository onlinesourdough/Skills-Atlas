import * as oauth from "oauth4webapi";
import { oauthDiagnostic, type OAuthStage } from "./oauth-diagnostic.js";
import { createGitHubFetchTransport, readGitHubPack } from "../src/domain/github.js";
import { isRepositoryName } from "../src/domain/contracts.js";
import type { AtlasPack } from "../src/types.js";
import { AtlasError, boundedText, SESSION_MS, type DeploymentPolicy } from "./security.js";

export const GITHUB_OAUTH_ISSUER = "https://github.com/login/oauth";

const issuer: oauth.AuthorizationServer = {
  issuer: GITHUB_OAUTH_ISSUER,
  authorization_endpoint: "https://github.com/login/oauth/authorize",
  token_endpoint: "https://github.com/login/oauth/access_token",
};

export interface GitHubUser {
  id: number;
  login: string;
}
export interface GitHubRepository {
  id: number;
  name: string;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new AtlasError("authorization-unavailable", 503);
  return value as Record<string, unknown>;
}

export class GitHubIdentity {
  constructor(private readonly fetcher: typeof fetch = (...args) => fetch(...args)) {}

  async authorizationUrl(
    policy: DeploymentPolicy,
    state: string,
    verifier: string,
  ): Promise<string> {
    const url = new URL(issuer.authorization_endpoint!);
    url.search = new URLSearchParams({
      client_id: policy.clientId,
      redirect_uri: policy.callback,
      state,
      code_challenge: await oauth.calculatePKCECodeChallenge(verifier),
      code_challenge_method: "S256",
      prompt: "select_account",
    }).toString();
    return url.href;
  }

  async exchange(
    policy: DeploymentPolicy,
    url: URL,
    state: string,
    verifier: string,
  ): Promise<{ token: string; lifetime: number }> {
    const client: oauth.Client = { client_id: policy.clientId };
    let stage: OAuthStage = "exchange-validation";
    let status: number | undefined;
    try {
      const parameters = oauth.validateAuthResponse(issuer, client, url, state);
      stage = "exchange-request";
      const response = await oauth.authorizationCodeGrantRequest(
        issuer,
        client,
        oauth.ClientSecretPost(policy.clientSecret),
        parameters,
        policy.callback,
        verifier,
        {
          signal: AbortSignal.timeout(5000),
          [oauth.customFetch]: async (input, options) => {
            const result = await this.fetcher(input, {
              ...options,
              redirect: "manual",
              headers: {
                ...Object.fromEntries(new Headers(options.headers)),
                accept: "application/json",
              },
            });
            status = result.status;
            stage = "exchange-body";
            return new Response(await boundedText(result, 16384), {
              status: result.status,
              headers: result.headers,
            });
          },
        },
      );
      stage = "exchange-response";
      const result = await oauth.processAuthorizationCodeResponse(issuer, client, response);
      stage = "exchange-token-policy";
      if (result.scope || result.access_token.length > 1024) throw new Error("unexpected-token");
      const lifetime =
        result.expires_in === undefined
          ? SESSION_MS
          : Math.min(SESSION_MS, result.expires_in * 1000);
      if (!Number.isFinite(lifetime) || lifetime <= 0) throw new Error("expiry");
      return { token: result.access_token, lifetime };
    } catch {
      oauthDiagnostic(stage, status);
      throw new AtlasError("oauth-invalid", 400);
    }
  }

  private async json(path: string, token: string): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetcher(`https://api.github.com${path}`, {
        headers: {
          authorization: `Bearer ${token}`,
          accept: "application/vnd.github+json",
          "user-agent": "Skills-Atlas",
          "x-github-api-version": "2026-03-10",
        },
        redirect: "manual",
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      throw new AtlasError("authorization-unavailable", 503);
    }
    if (response.status === 401) throw new AtlasError("session-expired", 401);
    if (response.status === 404) throw new AtlasError("access-denied", 403);
    if (
      response.status === 429 ||
      (response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0")
    )
      throw new AtlasError("authorization-rate-limited", 429);
    if (response.status !== 200) throw new AtlasError("authorization-unavailable", 503);
    try {
      return JSON.parse(await boundedText(response));
    } catch {
      throw new AtlasError("authorization-unavailable", 503);
    }
  }

  async user(token: string): Promise<GitHubUser> {
    const value = record(await this.json("/user", token));
    if (
      !Number.isSafeInteger(value.id) ||
      Number(value.id) <= 0 ||
      typeof value.login !== "string" ||
      !/^[A-Za-z0-9-]{1,39}$/u.test(value.login) ||
      value.type !== "User"
    )
      throw new AtlasError("access-denied", 403);
    return { id: Number(value.id), login: value.login };
  }

  async authorize(
    policy: DeploymentPolicy,
    token: string,
    expectedId?: number,
  ): Promise<GitHubUser> {
    const user = await this.user(token);
    if (expectedId !== undefined && user.id !== expectedId)
      throw new AtlasError("session-expired", 401);
    if (policy.organization) {
      const value = record(await this.json(`/user/memberships/orgs/${policy.organization}`, token));
      const organization = record(value.organization);
      const member = record(value.user);
      if (
        member.id !== user.id ||
        typeof organization.login !== "string" ||
        organization.login.toLowerCase() !== policy.organization
      )
        throw new AtlasError("authorization-unavailable", 503);
      if (value.state === "pending") throw new AtlasError("membership-pending", 403);
      if (value.state !== "active" || !["admin", "member"].includes(String(value.role)))
        throw new AtlasError("access-denied", 403);
    } else if (!policy.allowedUserIds.includes(user.id)) throw new AtlasError("access-denied", 403);
    return user;
  }

  async repository(
    token: string,
    repository: string,
    expectedId: number | null = null,
  ): Promise<GitHubRepository> {
    if (!isRepositoryName(repository)) throw new AtlasError("invalid-repository");
    const path = expectedId === null ? `/repos/${repository}` : `/repositories/${expectedId}`;
    let value: Record<string, unknown>;
    try {
      value = record(await this.json(path, token));
    } catch (error) {
      if (error instanceof AtlasError && error.code === "access-denied")
        throw new AtlasError("source-unavailable", 404);
      throw error;
    }
    const permissions = record(value.permissions);
    if (
      !Number.isSafeInteger(value.id) ||
      Number(value.id) <= 0 ||
      (expectedId !== null && value.id !== expectedId) ||
      typeof value.full_name !== "string" ||
      !isRepositoryName(value.full_name) ||
      permissions.pull !== true
    )
      throw new AtlasError("source-unavailable", 404);
    return { id: Number(value.id), name: value.full_name };
  }

  async read(token: string, repository: GitHubRepository): Promise<AtlasPack> {
    const pack = await readGitHubPack(
      createGitHubFetchTransport({ token, fetcher: this.fetcher }),
      repository.name,
    );
    if (pack.repositoryId !== repository.id) throw new AtlasError("source-unavailable", 404);
    return { ...pack, access: "read" };
  }
}
