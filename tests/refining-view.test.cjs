const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const REPO_ROOT = path.resolve(__dirname, "..");

function loadScripts(files, { runtime = {}, data = {} } = {}) {
  const context = {
    window: {
      GAME_DATA: data,
      GAME_RUNTIME: { ...runtime },
    },
    structuredClone,
    console,
  };
  context.globalThis = context;
  context.window.window = context.window;

  files.forEach((file) => {
    const fullPath = path.join(REPO_ROOT, file);
    const code = fs.readFileSync(fullPath, "utf8");
    vm.runInNewContext(code, context, { filename: fullPath });
  });

  return context.window;
}

function realmSafe(value) {
  return JSON.parse(JSON.stringify(value));
}

test("buildRefiningStageView derives card and triangle targets for stage interaction", () => {
  const windowObject = loadScripts(["src/app/refining-view.js"]);
  const { buildRefiningStageView, hitTestRefiningStage, createRefiningPresetDecks } = windowObject.GAME_RUNTIME;

  const attempt = {
    deck: [
      { id: "c0", type: "xuantie", revealed: false, used: false },
      { id: "c1", type: "lingshi", revealed: true, used: false },
      { id: "c2", type: "guanxing", revealed: true, used: true },
      { id: "c3", type: "mujing", revealed: false, used: false },
      { id: "c4", type: "lingduan", revealed: false, used: false },
      { id: "c5", type: "xuantie", revealed: false, used: false },
      { id: "c6", type: "mujing", revealed: false, used: false },
      { id: "c7", type: "xuantie", revealed: false, used: false },
      { id: "c8", type: "lingshi", revealed: false, used: false },
    ],
    slots: [null, "c1", null],
    selectedCardId: "c1",
  };

  const view = buildRefiningStageView(attempt, {
    boardOrigin: { x: 120, y: 170 },
    cardSize: { width: 92, height: 92 },
    cardGap: { x: 18, y: 18 },
    triangleSlots: [
      { x: 560, y: 220, width: 96, height: 72 },
      { x: 500, y: 344, width: 96, height: 72 },
      { x: 620, y: 344, width: 96, height: 72 },
    ],
  });

  assert.equal(view.cards.length, 9);
  assert.equal(view.slots.length, 3);
  assert.equal(view.cards[1].isSelected, true);
  assert.equal(view.cards[2].isUsed, true);
  assert.equal(view.slots[1].cardId, "c1");

  assert.deepEqual(realmSafe(hitTestRefiningStage(view, 150, 200)), { kind: "card", id: "c0" });
  assert.deepEqual(realmSafe(hitTestRefiningStage(view, 640, 370)), { kind: "slot", index: 2 });
  assert.equal(hitTestRefiningStage(view, 20, 20), null);

  const presets = createRefiningPresetDecks();
  assert.deepEqual(Object.keys(presets).sort(), ["failure_basic", "guanxing_demo", "lingduan_demo", "success_basic"]);
  assert.equal(presets.success_basic.length, 9);
});
