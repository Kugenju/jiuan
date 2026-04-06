const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const mainPath = path.join(__dirname, "..", "main.js");
const mainSource = fs.readFileSync(mainPath, "utf8");

function expectContains(fragment, message) {
  assert.equal(mainSource.includes(fragment), true, message);
}

test("main canvas defines a classical theme token set", () => {
  expectContains("const CANVAS_THEME = {", "missing canvas theme constant");
  expectContains("backgroundTop:", "missing canvas backgroundTop token");
  expectContains("bannerFill:", "missing canvas bannerFill token");
  expectContains("panelFill:", "missing canvas panelFill token");
  expectContains("accentDaiqing:", "missing canvas accentDaiqing token");
  expectContains("accentGold:", "missing canvas accentGold token");
});

test("drawBackground uses the classical canvas theme instead of hardcoded dark colors", () => {
  expectContains('gradient.addColorStop(0, CANVAS_THEME.backgroundTop);', "drawBackground should use classical top color");
  expectContains('gradient.addColorStop(0.45, CANVAS_THEME.backgroundMid);', "drawBackground should use classical middle color");
  expectContains('gradient.addColorStop(1, CANVAS_THEME.backgroundBottom);', "drawBackground should use classical bottom color");
});

test("drawBanner and timeline strip use the classical panel palette", () => {
  expectContains('ctx.fillStyle = CANVAS_THEME.bannerFill;', "drawBanner should use paper banner fill");
  expectContains('ctx.strokeStyle = CANVAS_THEME.bannerStroke;', "drawBanner should use paper banner stroke");
  expectContains('ctx.fillStyle = CANVAS_THEME.slotIdleFill;', "timeline should use classical idle fill");
  expectContains('ctx.fillStyle = CANVAS_THEME.slotSelectedFill;', "timeline should use classical selected fill");
});
