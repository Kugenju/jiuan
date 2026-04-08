const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const TEST_ROOT = path.resolve(__dirname, "..");


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
    const abs = path.join(TEST_ROOT, file);
    const code = fs.readFileSync(abs, "utf8");
    vm.runInNewContext(code, context, { filename: abs });
  });

  return context.window;
}


test("artifact refining task config is exported with task activity metadata", () => {
  const windowObject = loadScripts(["data/core.js", "data/activities.js", "data/tasks.js"]);
  const { ACTIVITY_KIND_LABELS, ACTIVITIES, TASK_DEFS, REFINING_CARD_TYPES, REFINING_RECIPE_TABLE } =
    windowObject.GAME_DATA;

  assert.equal(ACTIVITY_KIND_LABELS.task, "任务");
  assert.ok(ACTIVITIES.some((activity) => activity.id === "artifact_refining_task" && activity.kind === "task"));
  assert.equal(TASK_DEFS.artifact_refining.durationDays, 3);
  assert.equal(TASK_DEFS.artifact_refining.activityId, "artifact_refining_task");
  assert.deepEqual(Object.keys(REFINING_CARD_TYPES).sort(), ["guanxing", "lingduan", "lingshi", "mujing", "xuantie"]);
  assert.equal(REFINING_RECIPE_TABLE["lingshi|xuantie|xuantie"], 3);
  assert.equal(REFINING_RECIPE_TABLE["xuantie|xuantie|xuantie"], 1);
});


test("dao debate task config exposes topics, cards, followups, and summary mark", () => {
  const windowObject = loadScripts(["data/core.js", "data/activities.js", "data/tasks.js", "data/ui.js"]);
  const {
    ACTIVITIES,
    TASK_DEFS,
    DAO_DEBATE_TOPICS,
    DAO_DEBATE_CARDS,
    DAO_DEBATE_FOLLOWUPS,
    UI_TEXT,
  } = windowObject.GAME_DATA;

  assert.ok(ACTIVITIES.some((activity) => activity.id === "dao_debate_task" && activity.kind === "task"));
  assert.equal(TASK_DEFS.dao_debate.durationDays, 7);
  assert.equal(TASK_DEFS.dao_debate.activityId, "dao_debate_task");
  assert.equal(TASK_DEFS.dao_debate.unlockThreshold, 2);
  assert.equal(TASK_DEFS.dao_debate.availableAfterDays, 1);
  assert.deepEqual(Array.from(TASK_DEFS.dao_debate.topicPool || []), ["topic_1"]);
  assert.equal(DAO_DEBATE_TOPICS.topic_1.id, "topic_1");
  assert.ok(DAO_DEBATE_CARDS.uphold_principle.hidden !== true);
  assert.equal(DAO_DEBATE_CARDS.archive_case_note.hidden, true);
  assert.equal(DAO_DEBATE_FOLLOWUPS.press_utility.id, "press_utility");
  assert.equal(UI_TEXT.summary.taskMarkLabels.dao_debate, "\u9053\u6cd5\u8bba\u8fa9");
});


test("index loads timed task runtime modules before main app bootstrap", () => {
  const indexHtml = fs.readFileSync(path.join(TEST_ROOT, "index.html"), "utf8");

  assert.match(indexHtml, /<script src="\.\/src\/domain\/task-system\.js"><\/script>/);
  assert.match(indexHtml, /<script src="\.\/src\/domain\/refining-minigame\.js"><\/script>/);
  assert.match(indexHtml, /<script src="\.\/src\/app\/refining-view\.js"><\/script>/);
  assert.ok(indexHtml.indexOf('./src/domain/task-system.js') < indexHtml.indexOf('./main.js'));
  assert.ok(indexHtml.indexOf('./src/domain/refining-minigame.js') < indexHtml.indexOf('./main.js'));
  assert.ok(indexHtml.indexOf('./src/app/refining-view.js') < indexHtml.indexOf('./main.js'));
});


test("index loads dao debate modules before main app bootstrap", () => {
  const indexHtml = fs.readFileSync(path.join(TEST_ROOT, "index.html"), "utf8");

  assert.match(indexHtml, /<script src="\.\/src\/domain\/dao-debate-minigame\.js"><\/script>/);
  assert.match(indexHtml, /<script src="\.\/src\/app\/dao-debate-view\.js"><\/script>/);
  assert.ok(indexHtml.indexOf('./src/domain/dao-debate-minigame.js') < indexHtml.indexOf('./main.js'));
  assert.ok(indexHtml.indexOf('./src/app/dao-debate-view.js') < indexHtml.indexOf('./main.js'));
});


test("debug refining page loads sandbox scripts and mount node", () => {
  const debugHtml = fs.readFileSync(path.join(TEST_ROOT, "debug-refining.html"), "utf8");

  assert.match(debugHtml, /<script src="\.\/src\/debug\/refining-sandbox\.js"><\/script>/);
  assert.match(debugHtml, /id="refining-debug-app"/);
});

test("index exposes weekly timetable modal entry points", () => {
  const indexHtml = fs.readFileSync(path.join(TEST_ROOT, "index.html"), "utf8");

  assert.match(indexHtml, /id="timetable-toggle-btn"/);
  assert.match(indexHtml, /<script src="\.\/src\/app\/info-modal-view\.js"><\/script>/);
  assert.ok(indexHtml.indexOf('./src/app/info-modal-view.js') < indexHtml.indexOf('./main.js'));
});
