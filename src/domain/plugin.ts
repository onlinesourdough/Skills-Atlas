import type { AtlasPack, PluginComponent } from "../types.js";

export const MAX_PLUGIN_MANIFEST_BYTES = 32 * 1024;
export const DEFAULT_PLUGIN_REPOSITORY = "onlinesourdough/Skills";

export type DefaultPluginResult =
  | { status: "ready"; plugin: AtlasPack }
  | { status: "fallback"; code: string };

export class PluginManifestError extends Error {
  constructor() {
    super("invalid-plugin-manifest");
    this.name = "PluginManifestError";
  }
}

const COMPONENT_ORDER: PluginComponent[] = ["skills", "apps", "mcpServers"];
const COMPONENT_LABELS: Record<PluginComponent, string> = {
  skills: "Skills",
  apps: "Apps",
  mcpServers: "MCP servers",
};
const SAFE_RELATIVE_PATH = /^(?:\.\/)?[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/u;

function isSafePath(value: unknown): value is string {
  const candidate = typeof value === "string" && value.endsWith("/") ? value.slice(0, -1) : value;
  return (
    typeof candidate === "string" &&
    candidate.length > 0 &&
    candidate.length <= 260 &&
    SAFE_RELATIVE_PATH.test(candidate) &&
    !candidate.split("/").includes("..")
  );
}

function isPathDeclaration(value: unknown): boolean {
  if (isSafePath(value)) return true;
  return Array.isArray(value) && value.length > 0 && value.length <= 100 && value.every(isSafePath);
}

export function parsePluginManifestComponents(source: string): PluginComponent[] {
  if (new TextEncoder().encode(source).byteLength > MAX_PLUGIN_MANIFEST_BYTES) {
    throw new PluginManifestError();
  }
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new PluginManifestError();
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PluginManifestError();
  }
  const manifest = value as Record<string, unknown>;
  const components: PluginComponent[] = [];
  for (const component of COMPONENT_ORDER) {
    if (!(component in manifest)) continue;
    if (!isPathDeclaration(manifest[component])) throw new PluginManifestError();
    components.push(component);
  }
  return components;
}

export function pluginComponents(pack: AtlasPack): PluginComponent[] {
  const components = new Set(pack.components);
  if (pack.skills.length > 0) components.add("skills");
  return COMPONENT_ORDER.filter((component) => components.has(component));
}

export function pluginComponentLabels(pack: AtlasPack): string[] {
  return pluginComponents(pack).map((component) => COMPONENT_LABELS[component]);
}

function providerCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && code.length <= 80) return code;
  }
  return "provider-error";
}

function isCanonicalDefault(plugin: AtlasPack): boolean {
  if (
    plugin.source !== "github" ||
    plugin.repository.toLocaleLowerCase() !== DEFAULT_PLUGIN_REPOSITORY.toLocaleLowerCase() ||
    !plugin.repositoryUrl
  ) {
    return false;
  }
  try {
    const url = new URL(plugin.repositoryUrl);
    return (
      url.protocol === "https:" &&
      url.hostname === "github.com" &&
      url.pathname.replace(/\/$/u, "").toLocaleLowerCase() ===
        `/${DEFAULT_PLUGIN_REPOSITORY}`.toLocaleLowerCase()
    );
  } catch {
    return false;
  }
}

export async function resolveDefaultPlugin(
  read: (repository: string) => Promise<AtlasPack>,
): Promise<DefaultPluginResult> {
  try {
    const plugin = await read(DEFAULT_PLUGIN_REPOSITORY);
    if (!isCanonicalDefault(plugin)) {
      return { status: "fallback", code: "provider-payload-invalid" };
    }
    return { status: "ready", plugin: { ...plugin, access: "read" } };
  } catch (error) {
    return { status: "fallback", code: providerCode(error) };
  }
}

export function upsertPlugin(plugins: readonly AtlasPack[], plugin: AtlasPack): AtlasPack[] {
  const identity = plugin.id.toLocaleLowerCase();
  return [...plugins.filter((item) => item.id.toLocaleLowerCase() !== identity), plugin];
}
