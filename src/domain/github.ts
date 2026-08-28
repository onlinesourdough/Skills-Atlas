import type {
  AtlasPack,
  AtlasSkill,
  GraphTone,
  PluginComponent,
  ProposalRequest,
  ProposalResult,
} from "../types.js";
import { isRepositoryName } from "./contracts.js";
import {
  MAX_PLUGIN_MANIFEST_BYTES,
  parsePluginManifestComponents,
  PluginManifestError,
} from "./plugin.js";
import { MAX_SKILL_BYTES, parseSkillMarkdown, SkillParseError } from "./skill-parser.js";

export const MAX_PROVIDER_TREE_ENTRIES = 600;
export const MAX_PROVIDER_SKILLS = 100;
export const MAX_PROVIDER_TOTAL_BYTES = 768 * 1024;
export const MAX_PROVIDER_RESPONSE_BYTES = 2 * 1024 * 1024;
export const PROVIDER_TIMEOUT_MS = 4500;

export type ProviderErrorCode =
  | "invalid-repository"
  | "repository-unavailable"
  | "authentication-required"
  | "permission-denied"
  | "rate-limited"
  | "provider-timeout"
  | "provider-error"
  | "provider-payload-invalid"
  | "tree-truncated"
  | "too-many-files"
  | "too-many-skills"
  | "empty-repository"
  | "skill-too-large"
  | "aggregate-too-large"
  | "invalid-skill"
  | "manifest-too-large"
  | "invalid-plugin-manifest"
  | "stale-source"
  | "duplicate-branch";

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;

  constructor(code: ProviderErrorCode) {
    super(code);
    this.name = "ProviderError";
    this.code = code;
  }
}

export interface GitHubResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

export interface GitHubRequest {
  method: "GET" | "POST" | "PUT";
  path: string;
  body?: unknown;
}

export interface GitHubTransport {
  request(input: GitHubRequest): Promise<GitHubResponse>;
}

interface RepositoryMetadata {
  fullName: string;
  htmlUrl: string;
  defaultBranch: string;
  canPush: boolean;
}

interface BranchMetadata {
  sha: string;
  treeSha: string;
}

interface TreeEntry {
  path: string;
  type: string;
  sha: string;
  size?: number;
}

function isCanonicalGitHubUrl(value: string, repository: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "github.com" &&
      !url.port &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname.replace(/\/$/u, "").toLocaleLowerCase() === `/${repository}`.toLocaleLowerCase()
    );
  } catch {
    return false;
  }
}

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function string(value: unknown, maximum = 400): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= maximum ? value : null;
}

function providerFailure(response: GitHubResponse, write = false): never {
  if (response.status === 404) throw new ProviderError("repository-unavailable");
  if (response.status === 401) throw new ProviderError("authentication-required");
  if (
    response.status === 429 ||
    (response.status === 403 && response.headers["x-ratelimit-remaining"] === "0")
  ) {
    throw new ProviderError("rate-limited");
  }
  if (write && response.status === 403) throw new ProviderError("permission-denied");
  throw new ProviderError("provider-error");
}

async function repositoryMetadata(
  transport: GitHubTransport,
  repository: string,
): Promise<RepositoryMetadata> {
  const response = await transport.request({ method: "GET", path: `/repos/${repository}` });
  if (response.status !== 200) providerFailure(response);
  const body = record(response.body);
  const fullName = string(body?.full_name, 220);
  const htmlUrl = string(body?.html_url, 400);
  const defaultBranch = string(body?.default_branch, 180);
  const permissions = record(body?.permissions);
  if (
    !body ||
    !fullName ||
    !isRepositoryName(fullName) ||
    !htmlUrl ||
    !isCanonicalGitHubUrl(htmlUrl, fullName) ||
    !defaultBranch
  ) {
    throw new ProviderError("provider-payload-invalid");
  }
  return {
    fullName,
    htmlUrl,
    defaultBranch,
    canPush: permissions?.push === true,
  };
}

async function branchMetadata(
  transport: GitHubTransport,
  repository: string,
  branch: string,
): Promise<BranchMetadata> {
  const response = await transport.request({
    method: "GET",
    path: `/repos/${repository}/branches/${encodeURIComponent(branch)}`,
  });
  if (response.status !== 200) providerFailure(response);
  const body = record(response.body);
  const commit = record(body?.commit);
  const nestedCommit = record(commit?.commit);
  const tree = record(nestedCommit?.tree);
  const sha = string(commit?.sha, 40);
  const treeSha = string(tree?.sha, 40);
  if (!sha || !treeSha) throw new ProviderError("provider-payload-invalid");
  return { sha, treeSha };
}

async function repositoryTree(
  transport: GitHubTransport,
  repository: string,
  treeSha: string,
): Promise<TreeEntry[]> {
  const response = await transport.request({
    method: "GET",
    path: `/repos/${repository}/git/trees/${treeSha}?recursive=1`,
  });
  if (response.status !== 200) providerFailure(response);
  const body = record(response.body);
  if (body?.truncated === true) throw new ProviderError("tree-truncated");
  if (!Array.isArray(body?.tree)) throw new ProviderError("provider-payload-invalid");
  if (body.tree.length > MAX_PROVIDER_TREE_ENTRIES) throw new ProviderError("too-many-files");
  return body.tree.map((value) => {
    const entry = record(value);
    const path = string(entry?.path, 260);
    const type = string(entry?.type, 20);
    const sha = string(entry?.sha, 40);
    const size = entry?.size;
    if (!path || !type || !sha || (size !== undefined && typeof size !== "number")) {
      throw new ProviderError("provider-payload-invalid");
    }
    return { path, type, sha, ...(typeof size === "number" ? { size } : {}) };
  });
}

function base64ToText(
  encoded: string,
  invalidCode: "invalid-skill" | "invalid-plugin-manifest",
): string {
  let binary: string;
  try {
    binary = atob(encoded.replace(/\s/gu, ""));
  } catch {
    throw new ProviderError("provider-payload-invalid");
  }
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new ProviderError(invalidCode);
  }
}

function textToBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}

async function readBlob(
  transport: GitHubTransport,
  repository: string,
  entry: TreeEntry,
  maximumBytes: number,
  tooLargeCode: "skill-too-large" | "manifest-too-large",
  invalidCode: "invalid-skill" | "invalid-plugin-manifest",
): Promise<string> {
  if (entry.size !== undefined && entry.size > maximumBytes) {
    throw new ProviderError(tooLargeCode);
  }
  const response = await transport.request({
    method: "GET",
    path: `/repos/${repository}/git/blobs/${entry.sha}`,
  });
  if (response.status !== 200) providerFailure(response);
  const body = record(response.body);
  const content = string(body?.content, Math.ceil((maximumBytes * 4) / 3) + 4096);
  if (body?.encoding !== "base64" || !content) {
    throw new ProviderError("provider-payload-invalid");
  }
  const decoded = base64ToText(content, invalidCode);
  if (new TextEncoder().encode(decoded).byteLength > maximumBytes) {
    throw new ProviderError(tooLargeCode);
  }
  return decoded;
}

const TONES: GraphTone[] = ["blue", "mint", "gold", "violet", "clay"];

function toneFor(slug: string): GraphTone {
  const total = [...slug].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return TONES[total % TONES.length] ?? "blue";
}

function detectedRelations(markdown: string, available: Set<string>, ownSlug: string): string[] {
  const relations = new Set<string>();
  for (const slug of available) {
    if (slug === ownSlug) continue;
    const escaped = slug.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    const explicit = new RegExp(
      "(?:skills/" +
        escaped +
        "/SKILL\\.md|`" +
        escaped +
        "`|relations?:[^\\n]*\\b" +
        escaped +
        "\\b)",
      "iu",
    );
    if (explicit.test(markdown)) relations.add(slug);
  }
  return [...relations];
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next;
      next += 1;
      const item = items[index];
      if (item !== undefined) results[index] = await mapper(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

export async function readGitHubPack(
  transport: GitHubTransport,
  repository: string,
): Promise<AtlasPack> {
  if (!isRepositoryName(repository)) throw new ProviderError("invalid-repository");
  const metadata = await repositoryMetadata(transport, repository);
  const branch = await branchMetadata(transport, metadata.fullName, metadata.defaultBranch);
  const tree = await repositoryTree(transport, metadata.fullName, branch.treeSha);
  const skillEntries = tree.filter(
    (entry) =>
      entry.type === "blob" && /^skills\/[a-z0-9]+(?:-[a-z0-9]+)*\/SKILL\.md$/u.test(entry.path),
  );
  if (skillEntries.length === 0) throw new ProviderError("empty-repository");
  if (skillEntries.length > MAX_PROVIDER_SKILLS) throw new ProviderError("too-many-skills");

  const manifestEntry = tree.find(
    (entry) => entry.type === "blob" && entry.path === ".codex-plugin/plugin.json",
  );
  let components: PluginComponent[] = [];
  if (manifestEntry) {
    const manifest = await readBlob(
      transport,
      metadata.fullName,
      manifestEntry,
      MAX_PLUGIN_MANIFEST_BYTES,
      "manifest-too-large",
      "invalid-plugin-manifest",
    );
    try {
      components = parsePluginManifestComponents(manifest);
    } catch (error) {
      if (error instanceof PluginManifestError) {
        throw new ProviderError("invalid-plugin-manifest");
      }
      throw error;
    }
  }

  let aggregateBytes = 0;
  const sources = await mapWithConcurrency(skillEntries, 4, async (entry) => {
    const markdown = await readBlob(
      transport,
      metadata.fullName,
      entry,
      MAX_SKILL_BYTES,
      "skill-too-large",
      "invalid-skill",
    );
    aggregateBytes += new TextEncoder().encode(markdown).byteLength;
    if (aggregateBytes > MAX_PROVIDER_TOTAL_BYTES) {
      throw new ProviderError("aggregate-too-large");
    }
    const slug = entry.path.split("/")[1] ?? "";
    try {
      return parseSkillMarkdown(markdown, slug);
    } catch (error) {
      if (error instanceof SkillParseError) throw new ProviderError("invalid-skill");
      throw error;
    }
  });

  const available = new Set(sources.map((source) => source.slug));
  const skills: AtlasSkill[] = sources
    .map((source) => ({
      slug: source.slug,
      name: source.name,
      description: source.description,
      category: source.category ?? "Uncategorised",
      sourcePath: source.sourcePath,
      markdown: source.markdown,
      relations: [
        ...new Set([
          ...source.explicitRelations.filter((slug) => available.has(slug) && slug !== source.slug),
          ...detectedRelations(source.markdown, available, source.slug),
        ]),
      ],
      tone: toneFor(source.category ?? "Uncategorised"),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  return {
    kind: "atlas-pack",
    id: metadata.fullName.toLocaleLowerCase(),
    repository: metadata.fullName,
    repositoryUrl: metadata.htmlUrl,
    defaultBranch: metadata.defaultBranch,
    revision: branch.sha,
    access: metadata.canPush ? "write" : "read",
    source: "github",
    snapshotLabel: `GitHub · ${branch.sha.slice(0, 7)}`,
    components: [...new Set<PluginComponent>(["skills", ...components])],
    skills,
  };
}

export async function proposeGitHubChange(
  transport: GitHubTransport,
  input: ProposalRequest,
): Promise<ProposalResult> {
  if (!isRepositoryName(input.repository)) throw new ProviderError("invalid-repository");
  const slug = /^skills\/([a-z0-9]+(?:-[a-z0-9]+)*)\/SKILL\.md$/u.exec(input.path)?.[1];
  if (!slug) throw new ProviderError("invalid-skill");
  try {
    parseSkillMarkdown(input.content, slug);
  } catch (error) {
    if (error instanceof SkillParseError) throw new ProviderError("invalid-skill");
    throw error;
  }

  const metadata = await repositoryMetadata(transport, input.repository);
  if (!metadata.canPush) throw new ProviderError("permission-denied");
  const branch = await branchMetadata(transport, metadata.fullName, metadata.defaultBranch);
  if (branch.sha !== input.baseSha) throw new ProviderError("stale-source");

  const fileResponse = await transport.request({
    method: "GET",
    path: `/repos/${metadata.fullName}/contents/${input.path}?ref=${input.baseSha}`,
  });
  if (fileResponse.status !== 200) providerFailure(fileResponse, true);
  const fileSha = string(record(fileResponse.body)?.sha, 40);
  if (!fileSha) throw new ProviderError("provider-payload-invalid");

  const proposalBranch = `atlas/${slug}-${input.proposalId}`;
  const refResponse = await transport.request({
    method: "POST",
    path: `/repos/${metadata.fullName}/git/refs`,
    body: { ref: `refs/heads/${proposalBranch}`, sha: branch.sha },
  });
  if (refResponse.status === 422) throw new ProviderError("duplicate-branch");
  if (refResponse.status !== 201) providerFailure(refResponse, true);

  const updateResponse = await transport.request({
    method: "PUT",
    path: `/repos/${metadata.fullName}/contents/${input.path}`,
    body: {
      message: input.title,
      content: textToBase64(input.content),
      branch: proposalBranch,
      sha: fileSha,
    },
  });
  if (updateResponse.status !== 200) providerFailure(updateResponse, true);

  const pullResponse = await transport.request({
    method: "POST",
    path: `/repos/${metadata.fullName}/pulls`,
    body: {
      title: input.title,
      head: proposalBranch,
      base: metadata.defaultBranch,
      body: "Proposed from Skill Atlas. Review the full Markdown diff before merging.",
    },
  });
  if (pullResponse.status !== 201) providerFailure(pullResponse, true);
  const pullBody = record(pullResponse.body);
  const pullRequestUrl = string(pullBody?.html_url, 400);
  const pullRequestNumber = pullBody?.number;
  if (
    !pullRequestUrl ||
    typeof pullRequestNumber !== "number" ||
    !Number.isInteger(pullRequestNumber)
  ) {
    throw new ProviderError("provider-payload-invalid");
  }
  return {
    kind: "proposal",
    branch: proposalBranch,
    pullRequestUrl,
    pullRequestNumber,
  };
}

export function createGitHubFetchTransport(
  options: {
    token?: string;
    fetcher?: typeof fetch;
    baseUrl?: string;
    timeoutMs?: number;
  } = {},
): GitHubTransport {
  const fetcher = options.fetcher ?? fetch;
  const baseUrl = options.baseUrl ?? "https://api.github.com";
  const timeoutMs = options.timeoutMs ?? PROVIDER_TIMEOUT_MS;
  return {
    async request(input): Promise<GitHubResponse> {
      const attempts = input.method === "GET" ? 2 : 1;
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const headers: Record<string, string> = {
            accept: "application/vnd.github+json",
            "x-github-api-version": "2022-11-28",
          };
          if (options.token) headers.authorization = `Bearer ${options.token}`;
          if (input.body !== undefined) headers["content-type"] = "application/json";
          const response = await fetcher(`${baseUrl}${input.path}`, {
            method: input.method,
            headers,
            signal: controller.signal,
            ...(input.body !== undefined ? { body: JSON.stringify(input.body) } : {}),
          });
          const content = await response.text();
          if (new TextEncoder().encode(content).byteLength > MAX_PROVIDER_RESPONSE_BYTES) {
            throw new ProviderError("provider-payload-invalid");
          }
          let body: unknown = null;
          if (content) {
            try {
              body = JSON.parse(content) as unknown;
            } catch {
              throw new ProviderError("provider-payload-invalid");
            }
          }
          const headersRecord: Record<string, string> = {};
          response.headers.forEach((value, key) => {
            headersRecord[key.toLocaleLowerCase()] = value;
          });
          if (attempt + 1 < attempts && [502, 503, 504].includes(response.status)) continue;
          return { status: response.status, headers: headersRecord, body };
        } catch (error) {
          if (error instanceof ProviderError) throw error;
          if (attempt + 1 < attempts) continue;
          if (error instanceof DOMException && error.name === "AbortError") {
            throw new ProviderError("provider-timeout");
          }
          throw new ProviderError("provider-error");
        } finally {
          clearTimeout(timer);
        }
      }
      throw new ProviderError("provider-error");
    },
  };
}
