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
  expectContains("courtyardMist:", "missing courtyardMist token");
  expectContains("screenLine:", "missing screenLine token");
  expectContains("roofShadow:", "missing roofShadow token");
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

test("academy backdrop layers in courtyard framing helpers", () => {
  expectContains("drawCourtyardFrame();", "drawAcademyBackdrop should call drawCourtyardFrame");
  expectContains("drawRoofline();", "drawAcademyBackdrop should call drawRoofline");
  expectContains("drawLatticeScreen();", "drawAcademyBackdrop should call drawLatticeScreen");
});

test("menu floating cards are drawn below the banner card", () => {
  expectContains(
    "drawFloatingCards(UI_TEXT.canvas.menuCards, 258);",
    "menu floating cards should start below the title banner to avoid overlap"
  );
});

test("task scene focuses on refining board without timeline slot strip", () => {
  const start = mainSource.indexOf("function drawTaskScene()");
  const end = mainSource.indexOf("function drawMemoryScene()");
  assert.ok(start >= 0 && end > start, "drawTaskScene block should exist");
  const block = mainSource.slice(start, end);
  assert.equal(
    block.includes("drawTimelineStrip();"),
    false,
    "task scene should not render day slot timeline cards"
  );
});

test("task scene keeps a clear vertical gap below the title banner", () => {
  expectContains("const taskAreaTop = 170;", "task scene should start below banner with explicit top offset");
  expectContains(
    "const taskAreaHeight = 340;",
    "task scene should define task area height independently for balanced spacing"
  );
});
