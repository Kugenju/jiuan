const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const stylesPath = path.join(__dirname, "..", "styles.css");
const styles = fs.readFileSync(stylesPath, "utf8");

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getBlock(selectorPattern) {
  const pattern = new RegExp(`^${selectorPattern}\\s*\\{([\\s\\S]*?)^\\}`, "m");
  const match = styles.match(pattern);
  assert.ok(match, `Expected ${selectorPattern} block to exist`);
  return match[1];
}

test(":root defines the classical light-paper tokens and compatibility aliases", () => {
  const rootBlock = getBlock(escapeRegExp(":root"));
  const requiredFragments = [
    "--paper-bg-top:",
    "--paper-bg-mid:",
    "--paper-bg-bottom:",
    "--paper-panel:",
    "--paper-panel-strong:",
    "--line-soft:",
    "--ink-strong:",
    "--ink-muted:",
    "--accent-daiqing:",
    "--accent-gold-soft:",
    "--panel: var(--paper-panel);",
    "--panel-strong: var(--paper-panel-strong);",
    "--line: var(--line-soft);",
    "--text: var(--ink-strong);",
    "--muted: var(--ink-muted);",
    "--gold: var(--accent-gold-soft);",
    "--jade: var(--accent-daiqing);",
    "--accent-daiqing-soft:",
  ];

  for (const fragment of requiredFragments) {
    assert.match(rootBlock, new RegExp(escapeRegExp(fragment)));
  }
});

test("html, body block uses the paper gradient and strong ink text", () => {
  const htmlBodyBlock = getBlock("html\\s*,(?:\\s*\\r?\\n\\s*|\\s+)body");
  assert.match(htmlBodyBlock, /color:\s*var\(--ink-strong\);/);
  assert.match(
    htmlBodyBlock,
    /background:\s*linear-gradient\(160deg,\s*var\(--paper-bg-top\)\s*0%,\s*var\(--paper-bg-mid\)\s*45%,\s*var\(--paper-bg-bottom\)\s*100%\);/
  );
});

test(".panel-card block uses the paper surface baseline", () => {
  const panelCardBlock = getBlock(escapeRegExp(".panel-card"));
  assert.match(panelCardBlock, /background:\s*var\(--paper-panel-strong\);/);
  assert.match(panelCardBlock, /border:\s*1px solid var\(--line-soft\);/);
});

test("active cards use the daiqing accent surface", () => {
  const activeSelectorPattern = [
    ".slot-card.active,",
    ".activity-card.active,",
    ".choice-card.active,",
    ".memory-piece.active,",
    ".memory-cell.active",
  ]
    .map(escapeRegExp)
    .join("\\s*");

  const activeCardBlock = getBlock(activeSelectorPattern);
  assert.match(activeCardBlock, /background:\s*var\(--accent-daiqing-soft\);/);
  assert.match(activeCardBlock, /border-color:\s*rgba\(47,\s*107,\s*102,\s*0\.56\);/);
});

test("baseline buttons use a paper-like fill", () => {
  const buttonSelectorPattern = [".action-row button,", ".ghost-button"]
    .map(escapeRegExp)
    .join("\\s*");

  const buttonBlock = getBlock(buttonSelectorPattern);
  assert.match(buttonBlock, /background:\s*rgba\(250,\s*246,\s*236,\s*0\.9\);/);
});

test("primary buttons lean on the daiqing gradient", () => {
  const primarySelectorPattern = [".action-row button.primary,", ".ghost-button.primary"]
    .map(escapeRegExp)
    .join("\\s*");

  const primaryButtonBlock = getBlock(primarySelectorPattern);
  assert.match(
    primaryButtonBlock,
    /background:\s*linear-gradient\(135deg,\s*rgba\(47,\s*107,\s*102,\s*0\.22\),\s*rgba\(96,\s*132,\s*121,\s*0\.14\)\);/
  );
});

test("warn controls soften cinnabar tone", () => {
  const warnSelectorPattern = [".action-row button.warn,", ".ghost-button.warn"]
    .map(escapeRegExp)
    .join("\\s*");

  const warnBlock = getBlock(warnSelectorPattern);
  assert.match(warnBlock, /background:\s*rgba\(239,\s*143,\s*133,\s*0\.12\);/);
  assert.match(warnBlock, /border-color:\s*rgba\(239,\s*143,\s*133,\s*0\.36\);/);
  assert.match(warnBlock, /color:\s*var\(--ink-strong\);/);
});

test("status badges lean on the soft gold accent", () => {
  const badgeBlock = getBlock(escapeRegExp(".badge"));
  assert.match(badgeBlock, /color:\s*var\(--accent-gold-soft\);/);
});

test("phase cards highlight the current phase with daiqing", () => {
  const currentBlock = getBlock(escapeRegExp(".phase-card.current"));
  assert.match(currentBlock, /border-color:\s*rgba\(47,\s*107,\s*102,\s*0\.5\);/);
});

test("#game-canvas embraces the paper panel surface", () => {
  const gameCanvasBlock = getBlock(escapeRegExp("#game-canvas"));
  assert.match(gameCanvasBlock, /border:\s*1px solid var\(--line-soft\);/);
  assert.match(gameCanvasBlock, /background:\s*var\(--paper-panel-strong\);/);
  assert.match(gameCanvasBlock, /position:\s*relative;/);
  assert.match(gameCanvasBlock, /overflow:\s*hidden;/);
});

test("hint and quick cards use the paper surface treatment", () => {
  const cardsSelectorPattern = [".hint-card,", ".quick-card"]
    .map(escapeRegExp)
    .join("\\s*");
  const cardsBlock = getBlock(cardsSelectorPattern);
  assert.match(cardsBlock, /border:\s*1px solid var\(--line-soft\);/);
  assert.match(cardsBlock, /background:\s*var\(--paper-panel\);/);
});

test("focus callouts lean on the daiqing and gold palette", () => {
  const calloutBlock = getBlock(escapeRegExp(".focus-callout"));
  assert.match(calloutBlock, /border-color:\s*rgba\(199,\s*164,\s*90,\s*0\.4\);/);
  assert.match(
    calloutBlock,
    /background:\s*linear-gradient\(135deg,\s*rgba\(199,\s*164,\s*90,\s*0\.12\),\s*rgba\(47,\s*107,\s*102,\s*0\.12\)\);/
  );
});

test("#resolve-story-card focus-visible ring relies on daiqing", () => {
  const focusBlock = getBlock(escapeRegExp("#resolve-story-card:focus-visible"));
  assert.match(focusBlock, /outline:\s*2px solid rgba\(69,\s*107,\s*109,\s*0\.75\);/);
  assert.match(focusBlock, /outline-offset:\s*2px;/);
});

test("fixed slots and notes tone with the classical accents", () => {
  const fixedBlock = getBlock(escapeRegExp(".left-slot-card.fixed"));
  assert.match(fixedBlock, /border-color:\s*rgba\(47,\s*107,\s*102,\s*0\.4\);/);
  assert.match(fixedBlock, /background:\s*rgba\(47,\s*107,\s*102,\s*0\.08\);/);

  const lockedBlock = getBlock(escapeRegExp(".locked-slot-note"));
  assert.match(lockedBlock, /border-color:\s*rgba\(199,\s*164,\s*90,\s*0\.3\);/);
  assert.match(lockedBlock, /background:\s*rgba\(199,\s*164,\s*90,\s*0\.06\);/);
});

test("drawer close control matches the refined warn tone", () => {
  const drawerBlock = getBlock(escapeRegExp(".drawer-close"));
  assert.match(drawerBlock, /border:\s*1px solid rgba\(199,\s*164,\s*90,\s*0\.45\);/);
  assert.match(drawerBlock, /background:\s*rgba\(199,\s*164,\s*90,\s*0\.12\);/);
  assert.match(drawerBlock, /color:\s*var\(--ink-strong\);/);
});

test("planning actions bar uses a light paper footer instead of dark glass", () => {
  const actionsBlock = getBlock(escapeRegExp(".planning-actions"));
  assert.match(actionsBlock, /border-top:\s*1px solid rgba\(168,\s*142,\s*112,\s*0\.38\);/);
  assert.match(
    actionsBlock,
    /background:\s*linear-gradient\(180deg,\s*rgba\(248,\s*242,\s*230,\s*0\),\s*rgba\(248,\s*242,\s*230,\s*0\.94\)\s*28%\);/
  );
  assert.match(actionsBlock, /backdrop-filter:\s*blur\(8px\);/);
});

test("overlay elements rely on a misty backdrop and blurred paper rule", () => {
  const overlayBlock = getBlock(escapeRegExp(".overlay-backdrop"));
  assert.match(overlayBlock, /background:\s*rgba\(64,\s*79,\s*76,\s*0\.24\);/);
  assert.match(overlayBlock, /backdrop-filter:\s*blur\(3px\);/);

  const ruleBlock = getBlock(escapeRegExp(".modal-rule"));
  assert.match(ruleBlock, /background:\s*rgba\(252,\s*248,\s*238,\s*0\.82\);/);
});

test("memory stage surfaces lean on softer borders and layered shadows", () => {
  const memoryStageBlock = getBlock(escapeRegExp(".memory-stage"));
  assert.match(memoryStageBlock, /border:\s*1px solid rgba\(255,\s*255,\s*255,\s*0\.2\);/);
  assert.match(
    memoryStageBlock,
    /box-shadow:[\s\S]*?0\s*24px\s*56px\s*rgba\(5,\s*11,\s*20,\s*0\.45\),[\s\S]*?inset 0 0 24px rgba\(255,\s*255,\s*255,\s*0\.08\);/
  );
});

test("memory hex board keeps the tuned halo and contour glow", () => {
  const hexBlock = getBlock(escapeRegExp(".memory-hex-board"));
  assert.match(hexBlock, /border:\s*1px solid rgba\(255,\s*255,\s*255,\s*0\.18\);/);
  assert.match(
    hexBlock,
    /box-shadow:[\s\S]*?inset 0 0 40px rgba\(255,\s*255,\s*255,\s*0\.06\),[\s\S]*?0\s*18px\s*38px\s*rgba\(4,\s*8,\s*18,\s*0\.6\);/
  );
});

test("memory fragment field keeps the feathered contour and glow", () => {
  const fragmentBlock = getBlock(escapeRegExp(".memory-fragment-field"));
  assert.match(fragmentBlock, /border:\s*1px solid rgba\(255,\s*255,\s*255,\s*0\.16\);/);
  assert.match(
    fragmentBlock,
    /box-shadow:[\s\S]*?0\s*18px\s*36px\s*rgba\(8,\s*12,\s*22,\s*0\.35\),[\s\S]*?inset 0 1px 3px rgba\(255,\s*255,\s*255,\s*0\.15\);/
  );
});

test("task round pills follow the refined gold/daiqing status palette", () => {
  const pillBlock = getBlock(escapeRegExp(".task-round-pill"));
  assert.match(pillBlock, /border:\s*1px solid rgba\(47,\s*107,\s*102,\s*0\.42\);/);
  assert.match(pillBlock, /background:\s*rgba\(199,\s*164,\s*90,\s*0\.18\);/);
  assert.match(pillBlock, /box-shadow:\s*0\s*6px\s*12px\s*rgba\(47,\s*107,\s*102,\s*0\.22\);/);
});

test("task summary stack uses vertical flow and non-sticky actions to avoid overlap", () => {
  const taskShellBlock = getBlock(escapeRegExp(".task-summary-shell"));
  assert.match(taskShellBlock, /display:\s*flex;/);
  assert.match(taskShellBlock, /flex-direction:\s*column;/);

  const taskActionBlock = getBlock(escapeRegExp(".task-summary-shell .planning-actions"));
  assert.match(taskActionBlock, /position:\s*static;/);
  assert.match(taskActionBlock, /background:\s*transparent;/);
  assert.match(taskActionBlock, /backdrop-filter:\s*none;/);
});

test("task mode hides lower left panel and gives canvas more space", () => {
  const stagePanelTaskBlock = getBlock(escapeRegExp("body.task-mode .stage-panel"));
  assert.match(stagePanelTaskBlock, /grid-template-rows:\s*auto minmax\(0,\s*1fr\);/);

  const leftPanelTaskBlock = getBlock(escapeRegExp("body.task-mode #left-panel"));
  assert.match(leftPanelTaskBlock, /display:\s*none;/);
});

test("mobile views reinforce contours on key cards with the classical scheme", () => {
  const mediaMarker = "@media (max-width: 720px)";
  const markerIndex = styles.indexOf(mediaMarker);
  assert.notStrictEqual(markerIndex, -1, "Expected mobile media section to exist in styles");

  const braceStart = styles.indexOf("{", markerIndex);
  assert.notStrictEqual(braceStart, -1, "Expected opening brace for mobile media block");

  let depth = 0;
  let braceEnd = -1;
  for (let idx = braceStart; idx < styles.length; idx++) {
    const char = styles[idx];
    if (char === "{") {
      depth++;
    } else if (char === "}") {
      depth--;
      if (depth === 0) {
        braceEnd = idx;
        break;
      }
    }
  }
  assert.notStrictEqual(braceEnd, -1, "Expected closing brace for mobile media block");

  const mediaContent = styles.slice(braceStart + 1, braceEnd).replace(/\r/g, "");

  const selectorLines = [
    ".phase-card,",
    ".slot-card,",
    ".activity-card,",
    ".choice-card,",
    ".memory-piece,",
    ".memory-cell {",
  ];

  for (const line of selectorLines) {
    assert.match(mediaContent, new RegExp(escapeRegExp(line)));
  }

  const borderString = "border-color: rgba(67, 99, 93, 0.42);";
  const borderIndex = mediaContent.indexOf(borderString);
  assert.notStrictEqual(borderIndex, -1, "Expected the border-color inside the mobile selector block");
});

test("random-event modal and choices use the classical paper styling", () => {
  const modalBlock = getBlock(escapeRegExp(".random-event-modal"));
  assert.match(modalBlock, /display:\s*grid;/);
  assert.match(modalBlock, /gap:\s*16px;/);
  assert.match(modalBlock, /padding:\s*8px;/);
  assert.match(modalBlock, /background:\s*linear-gradient\(180deg,\s*rgba\(255,\s*251,\s*243,\s*0\.94\),\s*rgba\(246,\s*238,\s*221,\s*0\.92\)\);/);

  const choiceBlock = getBlock(escapeRegExp(".random-event-choice"));
  assert.match(choiceBlock, /border:\s*1px solid rgba\(168,\s*142,\s*112,\s*0\.4\);/);
  assert.match(choiceBlock, /background:\s*linear-gradient\(180deg,\s*rgba\(253,\s*249,\s*239,\s*0\.96\),\s*rgba\(242,\s*233,\s*216,\s*0\.92\)\);/);
  assert.match(choiceBlock, /color:\s*var\(--ink-strong\);/);
});

test("main panel action rows use the same seal-and-scroll treatment", () => {
  const actionBlock = getBlock(escapeRegExp("#main-panel .action-row"));
  assert.match(actionBlock, /padding-top:\s*14px;/);
  assert.match(actionBlock, /border-top:\s*1px solid rgba\(168,\s*142,\s*112,\s*0\.28\);/);
});

test("night academy mode darkens the shell while keeping layered classical surfaces", () => {
  const memoryStageNightBlock = getBlock(escapeRegExp("body.memory-mode .memory-stage"));
  assert.match(
    memoryStageNightBlock,
    /background:\s*linear-gradient\(160deg,\s*rgba\(25,\s*27,\s*34,\s*0\.96\)\s*0%,\s*rgba\(14,\s*17,\s*24,\s*0\.98\)\s*56%,\s*rgba\(8,\s*10,\s*15,\s*0\.99\)\s*100%\);/
  );
  assert.match(memoryStageNightBlock, /border:\s*1px solid rgba\(199,\s*164,\s*90,\s*0\.16\);/);

  const nightPanelBlock = getBlock(escapeRegExp("body.memory-mode #main-panel"));
  assert.match(nightPanelBlock, /background:\s*linear-gradient\(180deg,\s*rgba\(27,\s*25,\s*28,\s*0\.94\),\s*rgba\(15,\s*16,\s*21,\s*0\.96\)\);/);
  assert.match(nightPanelBlock, /border-color:\s*rgba\(199,\s*164,\s*90,\s*0\.14\);/);
});

test("night academy memory board trades sci-fi blues for lamp-lit ink and gold", () => {
  const nightHexBlock = getBlock(escapeRegExp("body.memory-mode .memory-hex-board"));
  assert.match(
    nightHexBlock,
    /background:[\s\S]*?radial-gradient\(circle at 50% 14%, rgba\(214,\s*188,\s*126,\s*0\.12\), transparent 24%\),[\s\S]*?linear-gradient\(180deg,\s*rgba\(19,\s*24,\s*29,\s*0\.96\)\s*0%,\s*rgba\(8,\s*11,\s*15,\s*0\.98\)\s*100%\);/
  );
  assert.match(
    nightHexBlock,
    /box-shadow:[\s\S]*?0\s*26px\s*54px\s*rgba\(0,\s*0,\s*0,\s*0\.34\),[\s\S]*?inset 0 0 0 1px rgba\(199,\s*164,\s*90,\s*0\.08\);/
  );

  const fragmentNightBlock = getBlock(escapeRegExp("body.memory-mode #main-panel .memory-fragment-field"));
  assert.match(fragmentNightBlock, /border:\s*1px solid rgba\(199,\s*164,\s*90,\s*0\.14\);/);
  assert.match(
    fragmentNightBlock,
    /background:[\s\S]*?radial-gradient\(circle at 24% 20%, rgba\(214,\s*188,\s*126,\s*0\.1\), transparent 24%\),[\s\S]*?rgba\(20,\s*22,\s*28,\s*0\.82\);/
  );
});
