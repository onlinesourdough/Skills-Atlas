// Local preview only. Read-only static files, bound to loopback, no dependencies.
import { createServer } from "node:http";
import { readFile, realpath } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
const root = await realpath(dirname(fileURLToPath(import.meta.url)));
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
};
const server = createServer(async (request, response) => {
  if (!["GET", "HEAD"].includes(request.method)) {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end();
    return;
  }
  try {
    const path = decodeURIComponent(
      new URL(request.url, "http://127.0.0.1").pathname,
    );
    const file = await realpath(
      resolve(root, "." + (path === "/" ? "/index.html" : path)),
    );
    if (!file.startsWith(root + sep) || !types[extname(file)])
      throw new Error("Not served");
    const body = await readFile(file);
    response.writeHead(200, {
      "Content-Type": types[extname(file)],
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain" });
    response.end("Not found");
  }
});
server.listen(Number(process.argv[2] || 0), "127.0.0.1", () => {
  console.log(
    `Atlas design preview: http://127.0.0.1:${server.address().port}`,
  );
  console.log(`Serving read-only files from ${root}`);
});
