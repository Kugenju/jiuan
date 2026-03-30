import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startStaticServer } from "./lib/static-server.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");

function createDummyServer(port) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("occupied");
    });
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

function requestText(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        resolve({ statusCode: res.statusCode, body: data });
      });
    });
    req.on("error", reject);
  });
}

test("startStaticServer uses an available port even if 4173 is occupied", async () => {
  const blocker = await createDummyServer(4173);
  const started = await startStaticServer({ rootDir: ROOT_DIR });

  try {
    assert.notEqual(started.port, 4173);
    const response = await requestText(started.url);
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /<!doctype html>|<html/i);
  } finally {
    await started.close();
    await new Promise((resolve, reject) => {
      blocker.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
});
