const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const REPO_ROOT = path.resolve(__dirname, "..");

function loadScripts(files, { runtime = {} } = {}) {
  const context = {
    window: {
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

test("copyPlanningScheduleFromHistory copies editable slots from history", () => {
  const windowObject = loadScripts(["src/domain/schedule.js"]);
  const { copyPlanningScheduleFromHistory } = windowObject.GAME_RUNTIME;
  const rootState = {
    mode: "planning",
    schedule: [null, "old_locked", null],
    scheduleLocks: [false, true, false],
    selectedSlot: 2,
    selectedActivity: "study",
    dayScheduleHistory: {
      2: ["rest", "course_math", "craft"],
    },
  };
  const activities = {
    rest: { id: "rest", kind: "routine" },
    course_math: { id: "course_math", kind: "course" },
    craft: { id: "craft", kind: "assignment" },
  };

  const changed = copyPlanningScheduleFromHistory(rootState, 2, {
    slotCount: 3,
    getActivity: (id) => activities[id],
    isActivityAssignable: () => true,
  });

  assert.equal(changed, true);
  assert.deepEqual(rootState.schedule, ["rest", "old_locked", "craft"]);
  assert.equal(rootState.selectedActivity, "craft");
});

test("copyPlanningScheduleFromHistory clears disallowed entries and guards missing day history", () => {
  const windowObject = loadScripts(["src/domain/schedule.js"]);
  const { copyPlanningScheduleFromHistory } = windowObject.GAME_RUNTIME;
  const rootState = {
    mode: "planning",
    schedule: ["rest", "craft"],
    scheduleLocks: [false, false],
    selectedSlot: 0,
    selectedActivity: "rest",
    dayScheduleHistory: {
      1: ["course_math", "unknown"],
    },
  };

  const changed = copyPlanningScheduleFromHistory(rootState, 1, {
    slotCount: 2,
    getActivity: (id) => (id === "course_math" ? { id, kind: "course" } : null),
    isActivityAssignable: () => true,
  });

  assert.equal(changed, true);
  assert.deepEqual(rootState.schedule, [null, null]);
  assert.equal(rootState.selectedActivity, "rest");

  const missingHistory = copyPlanningScheduleFromHistory(rootState, 9, {
    slotCount: 2,
    getActivity: () => null,
    isActivityAssignable: () => true,
  });
  assert.equal(missingHistory, false);
});
