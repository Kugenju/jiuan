import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
};

function resolveFilePath(rootDir, urlPath) {
  const relativePath = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
  const filePath = path.normalize(path.join(rootDir, relativePath));
  if (!filePath.startsWith(rootDir)) {
    return null;
  }
  return filePath;
}

async function readResponse(filePath) {
  const buffer = await fs.readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  return {
    buffer,
    contentType: MIME_TYPES[ext] || "application/octet-stream",
  };
}

export function createStaticServer(rootDir) {
  return http.createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
      const filePath = resolveFilePath(rootDir, urlPath);

      if (!filePath) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }

      const { buffer, contentType } = await readResponse(filePath);
      res.writeHead(200, { "Content-Type": contentType });
      res.end(buffer);
    } catch (error) {
      const code = error?.code === "ENOENT" ? 404 : 500;
      const message = error?.code === "ENOENT" ? "Not Found" : "Server Error";
      res.writeHead(code);
      res.end(message);
    }
  });
}

export async function startStaticServer({ rootDir, host = "127.0.0.1", port = 0 }) {
  const server = createStaticServer(rootDir);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Static server did not expose a numeric address");
  }

  return {
    server,
    host,
    port: address.port,
    url: `http://${host}:${address.port}`,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      }),
  };
}
