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

test("placeRefiningCardInSlot returns false for malformed attempt without deck", () => {
  const windowObject = loadScripts(["src/domain/refining-minigame.js"]);
  const { placeRefiningCardInSlot } = windowObject.GAME_RUNTIME;
  const malformedAttempt = {
    slots: [null, null, null],
  };

  assert.equal(placeRefiningCardInSlot(malformedAttempt, "card-0", 0), false);
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

test("resolving with xuantie xuantie lingduan still substitutes required lingshi when material catalog is incomplete", () => {
  const windowObject = loadScripts(["data/tasks.js", "src/domain/refining-minigame.js"]);
  const { TASK_DEFS } = windowObject.GAME_DATA;
  const { createRefiningAttemptState, placeRefiningCardInSlot, resolveRefiningAttempt } = windowObject.GAME_RUNTIME;

  // Simulate a bad card-catalog declaration: lingshi is no longer tagged as material.
  windowObject.GAME_DATA.REFINING_CARD_TYPES = {
    ...windowObject.GAME_DATA.REFINING_CARD_TYPES,
    lingshi: {
      ...windowObject.GAME_DATA.REFINING_CARD_TYPES.lingshi,
      category: "ability",
    },
  };

  const attempt = createRefiningAttemptState(TASK_DEFS.artifact_refining, makeRng(6));
  const xuantieCards = attempt.deck.filter((card) => card.type === "xuantie").slice(0, 2);
  const lingduanCard = attempt.deck.find((card) => card.type === "lingduan");

  assert.equal(xuantieCards.length, 2);
  assert.ok(lingduanCard);

  attempt.deck.forEach((card) => {
    if (card.id === xuantieCards[0].id || card.id === xuantieCards[1].id || card.id === lingduanCard.id) {
      card.revealed = true;
    }
  });

  assert.equal(placeRefiningCardInSlot(attempt, xuantieCards[0].id, 0), true);
  assert.equal(placeRefiningCardInSlot(attempt, xuantieCards[1].id, 1), true);
  assert.equal(placeRefiningCardInSlot(attempt, lingduanCard.id, 2), true);

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

test("resolveRefiningAttempt respects mujing in materialRequirements", () => {
  const windowObject = loadScripts(["data/tasks.js", "src/domain/refining-minigame.js"]);
  const { TASK_DEFS } = windowObject.GAME_DATA;
  const { createRefiningAttemptState, placeRefiningCardInSlot, resolveRefiningAttempt } = windowObject.GAME_RUNTIME;

  const attempt = createRefiningAttemptState(TASK_DEFS.artifact_refining, makeRng(8));
  const needMujingTaskDef = {
    ...TASK_DEFS.artifact_refining,
    objective: {
      ...TASK_DEFS.artifact_refining.objective,
      scoreTarget: 0,
      materialRequirements: {
        mujing: 1,
      },
    },
  };
  const xuantieCards = attempt.deck.filter((card) => card.type === "xuantie").slice(0, 3);
  xuantieCards.forEach((card) => {
    card.revealed = true;
  });

  assert.equal(placeRefiningCardInSlot(attempt, xuantieCards[0].id, 0), true);
  assert.equal(placeRefiningCardInSlot(attempt, xuantieCards[1].id, 1), true);
  assert.equal(placeRefiningCardInSlot(attempt, xuantieCards[2].id, 2), true);

  const result = resolveRefiningAttempt(attempt, needMujingTaskDef);
  assert.equal(result.complete, true);
  assert.equal(result.success, false);
});

test("resolveRefiningAttempt does not succeed when taskDef is missing", () => {
  const windowObject = loadScripts(["data/tasks.js", "src/domain/refining-minigame.js"]);
  const { TASK_DEFS } = windowObject.GAME_DATA;
  const { createRefiningAttemptState, placeRefiningCardInSlot, resolveRefiningAttempt } = windowObject.GAME_RUNTIME;

  const attempt = createRefiningAttemptState(TASK_DEFS.artifact_refining, makeRng(9));
  const xuantieCards = attempt.deck.filter((card) => card.type === "xuantie").slice(0, 2);
  const lingshiCard = attempt.deck.find((card) => card.type === "lingshi");
  [xuantieCards[0], xuantieCards[1], lingshiCard].forEach((card) => {
    card.revealed = true;
  });

  assert.equal(placeRefiningCardInSlot(attempt, xuantieCards[0].id, 0), true);
  assert.equal(placeRefiningCardInSlot(attempt, xuantieCards[1].id, 1), true);
  assert.equal(placeRefiningCardInSlot(attempt, lingshiCard.id, 2), true);

  const result = resolveRefiningAttempt(attempt, null);
  assert.equal(result.complete, true);
  assert.equal(result.success, false);
});

test("createRefiningSessionState seeds round metadata from task config", () => {
  const windowObject = loadScripts(["data/tasks.js", "src/domain/refining-minigame.js"]);
  const { TASK_DEFS } = windowObject.GAME_DATA;
  const { createRefiningSessionState } = windowObject.GAME_RUNTIME;

  const session = createRefiningSessionState(TASK_DEFS.artifact_refining, makeRng(11));

  assert.equal(TASK_DEFS.artifact_refining.rounds.maxRounds, 3);
  assert.equal(session.roundIndex, 1);
  assert.equal(session.maxRounds, TASK_DEFS.artifact_refining.rounds.maxRounds);
  assert.equal(session.totalScore, 0);
  assert.deepEqual(realmSafe(session.roundResults), []);
  assert.doesNotThrow(() => structuredClone(session));
  assert.equal(session.attempt.deck.length, 9);
});

test("advanceRefiningSession preserves unused cards and replaces only used cards", () => {
  const windowObject = loadScripts(["data/tasks.js", "src/domain/refining-minigame.js"]);
  const { TASK_DEFS } = windowObject.GAME_DATA;
  const { createRefiningSessionState, advanceRefiningSession } = windowObject.GAME_RUNTIME;

  const session = createRefiningSessionState(TASK_DEFS.artifact_refining, makeRng(12));
  session.attempt.deck[0].revealed = true;
  session.attempt.deck[1].revealed = true;
  session.attempt.deck[1].used = true;
  session.attempt.slots = [session.attempt.deck[1].id, null, null];

  const preservedCard = session.attempt.deck[0];
  const replacedCard = session.attempt.deck[1];

  const nextSession = advanceRefiningSession(session, {
    score: 1,
    success: false,
    complete: true,
    recipeKey: "xuantie|xuantie|xuantie",
  });

  assert.equal(nextSession.roundIndex, 2);
  assert.equal(nextSession.totalScore, 1);
  assert.equal(nextSession.roundResults.length, 1);
  assert.equal(nextSession.attempt.deck[0].id, preservedCard.id);
  assert.equal(nextSession.attempt.deck[0].type, preservedCard.type);
  assert.equal(nextSession.attempt.deck[0].revealed, true);
  assert.notEqual(nextSession.attempt.deck[1].id, replacedCard.id);
  assert.equal(nextSession.attempt.deck[1].used, false);
  assert.equal(nextSession.attempt.deck[1].revealed, false);
  assert.deepEqual(realmSafe(nextSession.attempt.slots), [null, null, null]);
});

test("settleRefiningSession ends early on cumulative success and fails only after max rounds", () => {
  const windowObject = loadScripts(["data/tasks.js", "src/domain/refining-minigame.js"]);
  const { TASK_DEFS } = windowObject.GAME_DATA;
  const { createRefiningSessionState, settleRefiningSession } = windowObject.GAME_RUNTIME;

  const successSession = createRefiningSessionState(TASK_DEFS.artifact_refining, makeRng(13));
  successSession.totalScore = 2;
  const successOutcome = settleRefiningSession(
    successSession,
    { score: 1, success: false, complete: true, recipeKey: "lingshi|xuantie|xuantie" },
    TASK_DEFS.artifact_refining
  );

  assert.equal(successOutcome.status, "success");
  assert.equal(successOutcome.session.totalScore, 3);
  assert.equal(successOutcome.session.roundResults.length, 1);

  const failureSession = createRefiningSessionState(TASK_DEFS.artifact_refining, makeRng(14));
  failureSession.roundIndex = failureSession.maxRounds;
  const failureOutcome = settleRefiningSession(
    failureSession,
    { score: 1, success: false, complete: true, recipeKey: "xuantie|xuantie|xuantie" },
    TASK_DEFS.artifact_refining
  );

  assert.equal(failureOutcome.status, "failure");
  assert.equal(failureOutcome.session.totalScore, 1);
});
