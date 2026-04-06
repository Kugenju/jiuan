const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const packagePath = path.join(__dirname, "..", "package.json");
const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));

test("package.json wires npm test to node --test", () => {
  assert.equal(pkg.scripts?.test, "node --test");
});
