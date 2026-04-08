const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const REPO_ROOT = path.resolve(__dirname, "..");

function loadScripts(files) {
  const context = {
    window: { GAME_DATA: {}, GAME_RUNTIME: {} },
    structuredClone,
    console,
  };
  context.globalThis = context;
  context.window.window = context.window;

  files.forEach((file) => {
    const fullPath = path.join(REPO_ROOT, file);
    vm.runInNewContext(fs.readFileSync(fullPath, "utf8"), context, { filename: fullPath });
  });

  return context.window;
}

function realmSafe(value) {
  return JSON.parse(JSON.stringify(value));
}

test("createDaoDebateSessionState draws five cards and injects one unlocked hidden card", () => {
  const windowObject = loadScripts(["data/tasks.js", "src/domain/dao-debate-minigame.js"]);
  const { TASK_DEFS } = windowObject.GAME_DATA;
  const { createDaoDebateSessionState } = windowObject.GAME_RUNTIME;

  const session = createDaoDebateSessionState(
    TASK_DEFS.dao_debate,
    {
      topicId: "topic_1",
      unlockFlags: ["dao_archive_insight"],
    },
    () => 0
  );

  assert.equal(session.roundIndex, 1);
  assert.equal(session.maxRounds, 3);
  assert.equal(session.hand.length, 5);
  assert.equal(session.topicId, "topic_1");
  assert.equal(session.currentPrompt.followupType, "opening");
  assert.equal(session.hand.some((card) => card.id === "archive_case_note"), true);
});

test("playDaoDebateCard updates conviction, exposure, and followup type from the played tag", () => {
  const windowObject = loadScripts(["data/tasks.js", "src/domain/dao-debate-minigame.js"]);
  const { TASK_DEFS } = windowObject.GAME_DATA;
  const { createDaoDebateSessionState, playDaoDebateCard } = windowObject.GAME_RUNTIME;

  const session = createDaoDebateSessionState(
    TASK_DEFS.dao_debate,
    { topicId: "topic_1", unlockFlags: [] },
    () => 0
  );
  session.hand = [
    { id: "weigh_outcomes", label: "衡量得失", tag: "utility" },
    { id: "cite_classic", label: "援引经典", tag: "authority" },
    { id: "uphold_principle", label: "守其本义", tag: "principle" },
  ];

  const next = playDaoDebateCard(session, "weigh_outcomes", TASK_DEFS.dao_debate);
  assert.equal(next.roundIndex, 2);
  assert.equal(next.conviction, 2);
  assert.equal(next.exposure, 0);
  assert.equal(next.currentPrompt.followupType, "press_utility");
  assert.equal(next.history[0].cardId, "weigh_outcomes");
});

test("final round settlement recognizes pass and fail thresholds", () => {
  const windowObject = loadScripts(["data/tasks.js", "src/domain/dao-debate-minigame.js"]);
  const { TASK_DEFS } = windowObject.GAME_DATA;
  const { settleDaoDebateSession } = windowObject.GAME_RUNTIME;

  assert.deepEqual(
    realmSafe(
      settleDaoDebateSession(
        {
          conviction: 5,
          exposure: 1,
          roundIndex: 4,
          maxRounds: 3,
          history: [],
        },
        TASK_DEFS.dao_debate
      )
    ),
    { status: "success", conviction: 5, exposure: 1, scoreLabel: "pass" }
  );

  assert.deepEqual(
    realmSafe(
      settleDaoDebateSession(
        {
          conviction: 3,
          exposure: 2,
          roundIndex: 4,
          maxRounds: 3,
          history: [],
        },
        TASK_DEFS.dao_debate
      )
    ),
    { status: "failure", conviction: 3, exposure: 2, scoreLabel: "fail" }
  );
});
