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

function makeRng(seed) {
  let value = seed >>> 0;
  return () => {
    value = (1664525 * value + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function getNeighborIndices(index) {
  const row = Math.floor(index / 3);
  const col = index % 3;
  const neighbors = [index];
  if (row > 0) neighbors.push(index - 3);
  if (row < 2) neighbors.push(index + 3);
  if (col > 0) neighbors.push(index - 1);
  if (col < 2) neighbors.push(index + 1);
  return neighbors.sort((a, b) => a - b);
}

test("createRefiningAttemptState builds 9-card deck with 3 reveals and uses rng for shuffling", () => {
  const windowObject = loadScripts(["data/tasks.js", "src/domain/refining-minigame.js"]);
  const { TASK_DEFS } = windowObject.GAME_DATA;
  const { createRefiningAttemptState } = windowObject.GAME_RUNTIME;

  const attemptA = createRefiningAttemptState(TASK_DEFS.artifact_refining, makeRng(1));
  const attemptB = createRefiningAttemptState(TASK_DEFS.artifact_refining, makeRng(2));
  const attemptC = createRefiningAttemptState(TASK_DEFS.artifact_refining, makeRng(1));

  assert.equal(attemptA.deck.length, 9);
  assert.equal(attemptA.revealsRemaining, 3);
  assert.notDeepEqual(
    realmSafe(attemptA.deck.map((card) => card.type)),
    realmSafe(attemptB.deck.map((card) => card.type))
  );
  assert.deepEqual(
    realmSafe(attemptA.deck.map((card) => card.type)),
    realmSafe(attemptC.deck.map((card) => card.type))
  );
});

test("revealing guanxing also reveals horizontal and vertical neighbors in 3x3 layout", () => {
  const windowObject = loadScripts(["data/tasks.js", "src/domain/refining-minigame.js"]);
  const { TASK_DEFS } = windowObject.GAME_DATA;
  const { createRefiningAttemptState, revealRefiningCard } = windowObject.GAME_RUNTIME;

  const attempt = createRefiningAttemptState(TASK_DEFS.artifact_refining, makeRng(3));
  const guanxing = attempt.deck.find((card) => card.type === "guanxing");
  assert.ok(guanxing);

  const revealed = revealRefiningCard(attempt, guanxing.id);
  assert.equal(revealed, true);

  const guanxingIndex = attempt.deck.findIndex((card) => card.id === guanxing.id);
  const expectedIds = getNeighborIndices(guanxingIndex).map((index) => attempt.deck[index].id).sort();

  const revealedIds = realmSafe(attempt.deck.filter((card) => card.revealed).map((card) => card.id).sort());
  assert.deepEqual(revealedIds, expectedIds);
});

test("placing cards only works for revealed and unused cards", () => {
  const windowObject = loadScripts(["data/tasks.js", "src/domain/refining-minigame.js"]);
  const { TASK_DEFS } = windowObject.GAME_DATA;
  const { createRefiningAttemptState, revealRefiningCard, placeRefiningCardInSlot } = windowObject.GAME_RUNTIME;

  const attempt = createRefiningAttemptState(TASK_DEFS.artifact_refining, makeRng(4));
  const firstCard = attempt.deck[0];

  assert.equal(placeRefiningCardInSlot(attempt, firstCard.id, 1.2), false);
  assert.equal(placeRefiningCardInSlot(attempt, firstCard.id, 0), false);
  assert.equal(revealRefiningCard(attempt, firstCard.id), true);
  assert.equal(placeRefiningCardInSlot(attempt, firstCard.id, 0), true);
  assert.equal(placeRefiningCardInSlot(attempt, firstCard.id, 1), false);
  assert.equal(placeRefiningCardInSlot(attempt, attempt.deck[1].id, 0), false);
});

test("revealRefiningCard rejects malformed revealsRemaining state", () => {
  const windowObject = loadScripts(["data/tasks.js", "src/domain/refining-minigame.js"]);
  const { TASK_DEFS } = windowObject.GAME_DATA;
  const { createRefiningAttemptState, revealRefiningCard } = windowObject.GAME_RUNTIME;

  const attempt = createRefiningAttemptState(TASK_DEFS.artifact_refining, makeRng(5));
  const firstCard = attempt.deck[0];
  attempt.revealsRemaining = "3";

  assert.equal(revealRefiningCard(attempt, firstCard.id), false);
  assert.equal(firstCard.revealed, false);
});

test("resolving with xuantie plus two lingduan uses wildcard substitution for best valid score", () => {
  const windowObject = loadScripts(["data/tasks.js", "src/domain/refining-minigame.js"]);
  const { TASK_DEFS } = windowObject.GAME_DATA;
  const { createRefiningAttemptState, placeRefiningCardInSlot, resolveRefiningAttempt } = windowObject.GAME_RUNTIME;

  const attempt = createRefiningAttemptState(TASK_DEFS.artifact_refining, makeRng(6));
  const xuantieCard = attempt.deck.find((card) => card.type === "xuantie");
  const lingduanCards = attempt.deck.filter((card) => card.type === "lingduan");

  assert.equal(lingduanCards.length, 1);
  const cloneLingduan = { ...lingduanCards[0], id: "card-clone-lingduan", revealed: true, used: false };
  attempt.deck.push(cloneLingduan);
  attempt.deck.forEach((card) => {
    if (card.id === xuantieCard.id || card.id === lingduanCards[0].id || card.id === cloneLingduan.id) {
      card.revealed = true;
    }
  });

  assert.equal(placeRefiningCardInSlot(attempt, xuantieCard.id, 0), true);
  assert.equal(placeRefiningCardInSlot(attempt, lingduanCards[0].id, 1), true);
  assert.equal(placeRefiningCardInSlot(attempt, cloneLingduan.id, 2), true);

  const result = resolveRefiningAttempt(attempt, TASK_DEFS.artifact_refining);
  assert.equal(result.score, 3);
  assert.equal(result.success, true);
});

test("resolving with fewer than three placed cards returns incomplete non-success result", () => {
  const windowObject = loadScripts(["data/tasks.js", "src/domain/refining-minigame.js"]);
  const { TASK_DEFS } = windowObject.GAME_DATA;
  const { createRefiningAttemptState, placeRefiningCardInSlot, resolveRefiningAttempt } = windowObject.GAME_RUNTIME;

  const attempt = createRefiningAttemptState(TASK_DEFS.artifact_refining, makeRng(7));
  const firstCard = attempt.deck[0];
  firstCard.revealed = true;

  assert.equal(placeRefiningCardInSlot(attempt, firstCard.id, 0), true);
  const result = resolveRefiningAttempt(attempt, TASK_DEFS.artifact_refining);
  assert.equal(result.complete, false);
  assert.equal(result.success, false);
  assert.equal(result.score, 0);
});
