export type PackSource = "example" | "github" | "local";
export type RepositoryAccess = "read" | "write";
export type GraphTone = "blue" | "mint" | "gold" | "violet" | "clay";
export type PluginComponent = "skills" | "apps" | "mcpServers";

export interface AtlasSkill {
  slug: string;
  name: string;
  description: string;
  category: string;
  sourcePath: string;
  markdown: string;
  relations: string[];
  tone: GraphTone;
}

export interface AtlasPack {
  kind: "atlas-pack";
  id: string;
  repository: string;
  repositoryUrl?: string;
  defaultBranch: string;
  revision: string;
  access: RepositoryAccess;
  source: PackSource;
  snapshotLabel: string;
  components: PluginComponent[];
  skills: AtlasSkill[];
}

export interface AtlasSnapshot {
  kind: "atlas-snapshot";
  pack: AtlasPack;
  warning?: string;
}

export interface AtlasHealth {
  status: "ok";
  mode: "self-hosted";
  adminConfigured: boolean;
  githubConfigured: boolean;
  sessions: "memory";
}

export interface SessionState {
  kind: "atlas-session";
  mode: "static" | "self-hosted";
  authenticated: boolean;
  adminAvailable: boolean;
  providerAvailable: boolean;
}

export interface ProposalRequest {
  repository: string;
  path: string;
  baseSha: string;
  content: string;
  title: string;
  proposalId: string;
}

export interface ProposalResult {
  kind: "proposal";
  branch: string;
  pullRequestUrl: string;
  pullRequestNumber: number;
}

export type RepositoryHealthSeverity = "good" | "attention";

export interface RepositoryHealthSignal {
  id: "loaded" | "metadata" | "relations";
  label: string;
  detail: string;
  count: number;
  severity: RepositoryHealthSeverity;
}
