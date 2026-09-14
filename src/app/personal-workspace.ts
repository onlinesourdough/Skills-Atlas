import type { ReactNode } from "react";
import type { AtlasPack, ImportPreview } from "../types.js";

export interface PersonalWorkspace {
  requestedSkillId?: string | undefined;
  onOpenSkill?: (id: string, view: "graph" | "library" | "plugins" | "usage") => void;
  userName: string;
  packs: AtlasPack[];
  visibleIds: string[];
  busyIds: string[];
  notice: ReactNode;
  sourcesPanel: ReactNode;
  onAccount: () => void;
  onToggleSource: (pack: AtlasPack) => void;
  onPreview: (repository: string) => Promise<ImportPreview>;
  onImport: (repository: string, preview: ImportPreview) => Promise<AtlasPack>;
}
