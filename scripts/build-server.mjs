import { rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Remove generated output so retired modules cannot survive an incremental build.
await rm(new URL("../dist/server", import.meta.url), { recursive: true, force: true });
const result = spawnSync(
  process.execPath,
  ["node_modules/typescript/bin/tsc", "-p", "tsconfig.server.json"],
  {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    stdio: "inherit",
  },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
