const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");


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
    const abs = path.join(process.cwd(), file);
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
