const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const FIX = process.argv.includes("--fix");
const decoder = new TextDecoder("utf-8", { fatal: true });

const SOURCE_EXTENSIONS = new Set([".js", ".cjs", ".mjs", ".css", ".html", ".json", ".md"]);
const SKIP_DIRS = new Set([".git", "node_modules", "dist-desktop", "output", "tmp"]);

function shouldSkipDir(dirName) {
  return SKIP_DIRS.has(dirName);
}

function isSourceFile(filePath) {
  return SOURCE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function normalizeText(text) {
  // Normalize all text files to LF so they match .editorconfig/.gitattributes.
  return text.replace(/\r\n?/g, "\n");
}

function walk(dirPath, out = []) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  entries.forEach((entry) => {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (!shouldSkipDir(entry.name)) {
        walk(fullPath, out);
      }
      return;
    }
    if (entry.isFile() && isSourceFile(fullPath)) {
      out.push(fullPath);
    }
  });
  return out;
}

function checkFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  const hasBom = buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
  let text;

  try {
    text = decoder.decode(hasBom ? buffer.slice(3) : buffer);
  } catch (error) {
    return { filePath, issues: ["invalid-utf8"] };
  }

  const normalized = normalizeText(text);
  const hasCrLf = text.includes("\r");
  const issues = [];

  if (hasBom) issues.push("utf8-bom");
  if (hasCrLf) issues.push("crlf");

  if (FIX && (hasBom || hasCrLf)) {
    fs.writeFileSync(filePath, normalized, { encoding: "utf8" });
  }

  return { filePath, issues };
}

function main() {
  const files = walk(ROOT);
  const failures = [];

  files.forEach((filePath) => {
    const result = checkFile(filePath);
    if (result.issues.length) {
      failures.push(result);
    }
  });

  if (!failures.length) {
    console.log(`encoding-guard: OK (${files.length} files checked)`);
    return;
  }

  const action = FIX ? "fixed" : "found";
  console.log(`encoding-guard: ${action} ${failures.length} files with encoding issues`);
  failures.forEach((item) => {
    console.log(`- ${path.relative(ROOT, item.filePath)}: ${item.issues.join(", ")}`);
  });

  if (!FIX) {
    process.exitCode = 1;
  }
}

main();
