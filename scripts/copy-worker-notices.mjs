import { cp } from "node:fs/promises";
await cp("public/third-party", "dist/worker/third-party", { recursive: true });
