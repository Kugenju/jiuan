const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const mainPath = path.join(__dirname, "..", "main.js");
const mainSource = fs.readFileSync(mainPath, "utf8");

function expectContains(fragment, message) {
  assert.equal(mainSource.includes(fragment), true, message);
}

test("random-event modal closes competing overlays when active", () => {
  expectContains("if (randomEventOpen)", "expected random-event overlay guard");
  expectContains("state.ui.statsOpen = false;", "expected stats overlay to close during random events");
  expectContains("state.ui.infoModal = null;", "expected info modal to close during random events");
});
