import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

const root = resolve("out");
const port = Number(process.env.PORT || 4173);

const contentTypes = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
  ".webp": "image/webp"
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", "http://localhost");
    const pathname = decodeURIComponent(url.pathname);
    const candidatePath = pathname === "/" ? "/index.html" : pathname;
    const filePath = await resolveFile(candidatePath);

    if (!filePath.startsWith(root)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    response.writeHead(200, {
      "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream"
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain" });
    response.end("Not found");
  }
});

server.listen(port, () => {
  console.log(`Worksheet Universe static preview: http://127.0.0.1:${port}`);
});

async function resolveFile(pathname) {
  const normalized = resolve(join(root, pathname));
  const info = await stat(normalized).catch(() => null);
  if (info?.isFile()) return normalized;
  if (info?.isDirectory()) return resolve(join(normalized, "index.html"));

  if (!extname(normalized)) {
    const htmlPath = `${normalized}.html`;
    const htmlInfo = await stat(htmlPath).catch(() => null);
    if (htmlInfo?.isFile()) return htmlPath;
  }

  return resolve(join(root, "404.html"));
}
