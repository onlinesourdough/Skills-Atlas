import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "vitest/config";

// An empty, freshly created envDir prevents Vite from consulting real local
// credentials. This suite never loads a Wrangler config or Worker plugin.
export default defineConfig({
  envDir: mkdtempSync(join(tmpdir(), "atlas-domain-env-")),
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
