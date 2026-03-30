const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const REPO_ROOT = path.resolve(__dirname, "..");

function loadScripts(files) {
  const context = {
    window: {
      GAME_DATA: {},
      GAME_RUNTIME: {},
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

test("createRefiningAttemptState builds 9-card deck with 3 reveals", () => {
  const windowObject = loadScripts(["data/tasks.js", "src/domain/refining-minigame.js"]);
  const { TASK_DEFS } = windowObject.GAME_DATA;
  const { createRefiningAttemptState } = windowObject.GAME_RUNTIME;

  const attempt = createRefiningAttemptState(TASK_DEFS.artifact_refining, () => 0.5);
  assert.equal(attempt.deck.length, 9);
  assert.equal(attempt.revealsRemaining, 3);
});

test("revealing guanxing also reveals horizontal and vertical neighbors in 3x3 layout", () => {
  const windowObject = loadScripts(["data/tasks.js", "src/domain/refining-minigame.js"]);
  const { TASK_DEFS } = windowObject.GAME_DATA;
  const { createRefiningAttemptState, revealRefiningCard } = windowObject.GAME_RUNTIME;

  const attempt = createRefiningAttemptState(TASK_DEFS.artifact_refining, () => 0.5);
  const guanxing = attempt.deck.find((card) => card.type === "guanxing");
  assert.ok(guanxing);

  const revealed = revealRefiningCard(attempt, guanxing.id);
  assert.equal(revealed, true);

  const guanxingIndex = attempt.deck.findIndex((card) => card.id === guanxing.id);
  assert.equal(guanxingIndex, 6);

  const revealedIds = realmSafe(attempt.deck.filter((card) => card.revealed).map((card) => card.id).sort());
  assert.deepEqual(revealedIds, ["card-3", "card-6", "card-7"]);
});

test("placing cards only works for revealed and unused cards", () => {
  const windowObject = loadScripts(["data/tasks.js", "src/domain/refining-minigame.js"]);
  const { TASK_DEFS } = windowObject.GAME_DATA;
  const { createRefiningAttemptState, revealRefiningCard, placeRefiningCardInSlot } = windowObject.GAME_RUNTIME;

  const attempt = createRefiningAttemptState(TASK_DEFS.artifact_refining, () => 0.5);
  const firstCard = attempt.deck[0];

  assert.equal(placeRefiningCardInSlot(attempt, firstCard.id, 0), false);
  assert.equal(revealRefiningCard(attempt, firstCard.id), true);
  assert.equal(placeRefiningCardInSlot(attempt, firstCard.id, 0), true);
  assert.equal(placeRefiningCardInSlot(attempt, firstCard.id, 1), false);
  assert.equal(placeRefiningCardInSlot(attempt, attempt.deck[1].id, 0), false);
});

test("resolving with xuantie xuantie lingduan scores 3 and succeeds via lingshi substitution", () => {
  const windowObject = loadScripts(["data/tasks.js", "src/domain/refining-minigame.js"]);
  const { TASK_DEFS } = windowObject.GAME_DATA;
  const { createRefiningAttemptState, placeRefiningCardInSlot, resolveRefiningAttempt } = windowObject.GAME_RUNTIME;

  const attempt = createRefiningAttemptState(TASK_DEFS.artifact_refining, () => 0.5);
  const xuantieCards = attempt.deck.filter((card) => card.type === "xuantie");
  const lingduanCard = attempt.deck.find((card) => card.type === "lingduan");

  xuantieCards[0].revealed = true;
  xuantieCards[1].revealed = true;
  lingduanCard.revealed = true;

  assert.equal(placeRefiningCardInSlot(attempt, xuantieCards[0].id, 0), true);
  assert.equal(placeRefiningCardInSlot(attempt, xuantieCards[1].id, 1), true);
  assert.equal(placeRefiningCardInSlot(attempt, lingduanCard.id, 2), true);

  const result = resolveRefiningAttempt(attempt, TASK_DEFS.artifact_refining);
  assert.equal(result.score, 3);
  assert.equal(result.success, true);
});
