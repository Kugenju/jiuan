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
  const {
    buildRefiningStageView,
    hitTestRefiningStage,
    createRefiningPresetDecks,
    buildRefiningTaskPanelState,
    renderRefiningTaskPanelHtml,
  } = windowObject.GAME_RUNTIME;

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

  const panelState = buildRefiningTaskPanelState({
    taskText: {
      remainingDays: (days) => `${days}d`,
      scoreTarget: (score) => `target:${score}`,
      requirements: (text) => text,
      slot: (index) => `slot-${index + 1}`,
      noSelection: "none",
      attemptCount: (count) => `attempt:${count}`,
    },
    task: { attemptCount: 2 },
    taskDef: {
      objective: {
        name: "Spirit Needle",
        scoreTarget: 3,
      },
    },
    activity: { name: "Refining Task", summary: "summary" },
    attempt,
    requirementText: "xuantie / lingshi",
    remainingDays: 2,
    selectedCardLabel: "lingshi",
    statusText: "ready",
  });

  assert.equal(panelState.canConfirm, false);
  assert.equal(panelState.remainingDaysText, "2d");
  assert.equal(panelState.attemptCountText, "attempt:2");
  assert.equal(panelState.selectedCardText, "lingshi");
  assert.deepEqual(realmSafe(panelState.slotSummaries), [
    { index: 0, label: "slot-1", cardLabel: null },
    { index: 1, label: "slot-2", cardLabel: "lingshi" },
    { index: 2, label: "slot-3", cardLabel: null },
  ]);
  assert.equal(Object.prototype.hasOwnProperty.call(panelState, "cards"), false);

  const panelHtml = renderRefiningTaskPanelHtml(panelState, {
    title: "Refining Task",
    objective: "Objective",
    requirement: "Requirement",
    selected: "Selected",
    emptySlot: "empty",
    confirm: "confirm",
  });

  assert.match(panelHtml, /task-summary-shell/);
  assert.match(panelHtml, /task-slot-summary-grid/);
  assert.match(panelHtml, /data-task-control="confirm"/);
  assert.doesNotMatch(panelHtml, /data-task-card=/);
  assert.doesNotMatch(panelHtml, /data-task-slot=/);
});

test("buildRefiningTaskPanelState includes round progress and cumulative score", () => {
  const windowObject = loadScripts(["src/app/refining-view.js"]);
  const { buildRefiningTaskPanelState } = windowObject.GAME_RUNTIME;

  const panelState = buildRefiningTaskPanelState({
    taskText: {
      roundProgress: (current, max) => `${current}/${max}`,
      totalScore: (score) => `score:${score}`,
    },
    refiningSession: {
      roundIndex: 2,
      maxRounds: 3,
      totalScore: 4,
      roundResults: [{ roundIndex: 1, score: 1 }, { roundIndex: 2, score: 3 }],
    },
    attempt: { slots: [null, null, null] },
  });

  assert.equal(panelState.roundProgressText, "2/3");
  assert.equal(panelState.totalScoreText, "score:4");
  assert.deepEqual(realmSafe(panelState.roundHistory), [
    { label: "R1", score: 1 },
    { label: "R2", score: 3 },
  ]);
});

test("buildRefiningTaskPanelState resolves slot labels from placed cards instead of raw ids", () => {
  const windowObject = loadScripts(["src/app/refining-view.js"]);
  const { buildRefiningTaskPanelState } = windowObject.GAME_RUNTIME;

  const panelState = buildRefiningTaskPanelState({
    taskText: {
      slot: (index) => `slot-${index + 1}`,
    },
    attempt: {
      deck: [
        { id: "card-0", type: "xuantie", revealed: true, used: true },
        { id: "card-1", type: "lingshi", revealed: true, used: true },
      ],
      slots: ["card-0", "card-1", null],
    },
    getCardLabel: (cardOrType) => `label:${typeof cardOrType === "string" ? cardOrType : cardOrType?.type}`,
  });

  assert.deepEqual(realmSafe(panelState.slotSummaries), [
    { index: 0, label: "slot-1", cardLabel: "label:xuantie" },
    { index: 1, label: "slot-2", cardLabel: "label:lingshi" },
    { index: 2, label: "slot-3", cardLabel: null },
  ]);
});
