export type SourceKind = "bundled" | "local";

export type GraphTone = "blue" | "mint" | "gold" | "violet" | "clay";

export interface AtlasSkill {
  slug: string;
  name: string;
  description: string;
  category: string;
  version: string;
  reviewed: string;
  sourcePath: string;
  excerpt: string;
  relations: string[];
  usage: number;
  tone: GraphTone;
}

export interface AtlasSnapshot {
  kind: "atlas-snapshot";
  source: SourceKind;
  repository: string;
  skills: AtlasSkill[];
  warning?: string;
}

export interface AtlasHealth {
  status: "ok";
  source: SourceKind;
  skills: number;
  fallback: boolean;
}

export type FixtureName = "success" | "loading" | "empty" | "error" | "permission" | "offline";

export interface AskAnswer {
  title: string;
  body: string;
  related: string[];
  matched: boolean;
}
