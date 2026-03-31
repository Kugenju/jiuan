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
    document: {
      querySelector: () => null,
    },
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

test("refining sandbox can create attempts from seed and presets", () => {
  const windowObject = loadScripts([
    "data/tasks.js",
    "src/domain/refining-minigame.js",
    "src/app/refining-view.js",
    "src/debug/refining-sandbox.js",
  ]);
  const { TASK_DEFS } = windowObject.GAME_DATA;
  const { createRefiningSandboxController } = windowObject.GAME_RUNTIME;

  const controller = createRefiningSandboxController({
    taskDef: TASK_DEFS.artifact_refining,
    presets: windowObject.GAME_RUNTIME.createRefiningPresetDecks(),
  });

  const seeded = controller.restartFromSeed(7);
  const preset = controller.restartFromPreset("success_basic");

  assert.equal(seeded.deck.length, 9);
  assert.equal(preset.deck[0].type, "xuantie");
  assert.equal(controller.getState().session.roundIndex, 1);
  assert.equal(controller.getState().session.attempt.deck[0].type, "xuantie");
  assert.equal(controller.getState().presetId, "success_basic");
});

test("refining sandbox continues into the next round when cumulative score is below target", () => {
  const windowObject = loadScripts([
    "data/tasks.js",
    "src/domain/refining-minigame.js",
    "src/app/refining-view.js",
    "src/debug/refining-sandbox.js",
  ]);
  const { TASK_DEFS } = windowObject.GAME_DATA;
  const { createRefiningSandboxController } = windowObject.GAME_RUNTIME;

  const controller = createRefiningSandboxController({
    taskDef: TASK_DEFS.artifact_refining,
    presets: windowObject.GAME_RUNTIME.createRefiningPresetDecks(),
  });
  controller.restartFromPreset("failure_basic");
  const state = controller.getState();

  state.session.attempt.deck.forEach((card) => {
    card.revealed = true;
  });
  state.session.attempt.slots = ["card-0", "card-1", "card-2"];
  const outcome = controller.resolveCurrentAttempt();

  assert.equal(outcome.status, "continue");
  assert.equal(controller.getState().session.roundIndex, 2);
  assert.equal(controller.getState().session.totalScore, 1);
  assert.equal(controller.getState().session.roundResults.length, 1);
  assert.equal(controller.getState().status, "continue");
});

test("refining sandbox ends early once cumulative score reaches target", () => {
  const windowObject = loadScripts([
    "data/tasks.js",
    "src/domain/refining-minigame.js",
    "src/app/refining-view.js",
    "src/debug/refining-sandbox.js",
  ]);
  const { TASK_DEFS } = windowObject.GAME_DATA;
  const { createRefiningSandboxController } = windowObject.GAME_RUNTIME;

  const controller = createRefiningSandboxController({
    taskDef: TASK_DEFS.artifact_refining,
    presets: windowObject.GAME_RUNTIME.createRefiningPresetDecks(),
  });
  controller.restartFromPreset("failure_basic");

  let state = controller.getState();
  state.session.attempt.deck.forEach((card) => {
    card.revealed = true;
  });
  state.session.attempt.slots = ["card-0", "card-1", "card-2"];
  controller.resolveCurrentAttempt();

  state = controller.getState();
  state.session.attempt.deck = [
    { id: "card-0", type: "xuantie", revealed: true, used: false },
    { id: "card-1", type: "xuantie", revealed: true, used: false },
    { id: "card-2", type: "lingshi", revealed: true, used: false },
    { id: "card-3", type: "mujing", revealed: false, used: false },
    { id: "card-4", type: "mujing", revealed: false, used: false },
    { id: "card-5", type: "guanxing", revealed: false, used: false },
    { id: "card-6", type: "lingduan", revealed: false, used: false },
    { id: "card-7", type: "xuantie", revealed: false, used: false },
    { id: "card-8", type: "mujing", revealed: false, used: false },
  ];
  state.session.attempt.slots = ["card-0", "card-1", "card-2"];

  const outcome = controller.resolveCurrentAttempt();

  assert.equal(outcome.status, "success");
  assert.equal(outcome.session.totalScore, 4);
  assert.equal(controller.getState().status, "success");
  assert.equal(controller.getState().session.roundResults.length, 2);
  assert.equal(controller.getState().result.score, 3);
});

test("refining sandbox does not advance after terminal success", () => {
  const windowObject = loadScripts([
    "data/tasks.js",
    "src/domain/refining-minigame.js",
    "src/app/refining-view.js",
    "src/debug/refining-sandbox.js",
  ]);
  const { TASK_DEFS } = windowObject.GAME_DATA;
  const { createRefiningSandboxController } = windowObject.GAME_RUNTIME;

  const controller = createRefiningSandboxController({
    taskDef: TASK_DEFS.artifact_refining,
    presets: windowObject.GAME_RUNTIME.createRefiningPresetDecks(),
  });
  controller.restartFromPreset("success_basic");

  let state = controller.getState();
  state.session.attempt.deck.forEach((card) => {
    card.revealed = true;
  });
  state.session.attempt.slots = ["card-0", "card-1", "card-2"];

  const firstOutcome = controller.resolveCurrentAttempt();
  const beforeRepeat = JSON.parse(JSON.stringify(controller.getState()));
  const secondOutcome = controller.resolveCurrentAttempt();

  assert.equal(firstOutcome.status, "success");
  assert.equal(secondOutcome.status, "success");
  assert.deepEqual(JSON.parse(JSON.stringify(controller.getState())), beforeRepeat);
});
