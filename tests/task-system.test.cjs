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

test("task system supports weekly lifecycle unlock and expiry", () => {
  const windowObject = loadScripts(["data/tasks.js", "src/domain/task-system.js"]);
  const {
    createTaskState,
    syncWeeklyTaskProgress,
    handleResolvedCourseTaskProgress,
    expireTimedTasksForDay,
    getSchedulableTaskActivityIds,
  } = windowObject.GAME_RUNTIME;
  const { TASK_DEFS } = windowObject.GAME_DATA;

  const rootState = {
    week: 2,
    day: 3,
    weeklyTimetable: [
      ["course_craft_a", "course_other"],
      [null, "course_craft_b"],
      ["part_time", null],
    ],
    tasks: createTaskState(),
    currentStory: null,
  };

  assert.deepEqual(realmSafe(rootState.tasks), {
    active: [],
    weeklyProgress: {
      craftCompleted: 0,
      craftTotal: 0,
    },
    completedMarks: [],
    lastStory: null,
  });

  syncWeeklyTaskProgress(rootState, {
    taskDefs: TASK_DEFS,
    getActivity: (activityId) => {
      if (activityId === "course_craft_a" || activityId === "course_craft_b") {
        return { id: activityId, kind: "course", skill: "craft" };
      }
      if (activityId === "course_other") {
        return { id: activityId, kind: "course", skill: "dao" };
      }
      return { id: activityId, kind: "normal" };
    },
  });

  assert.equal(rootState.tasks.weeklyProgress.craftTotal, 2);

  const firstResult = handleResolvedCourseTaskProgress(
    rootState,
    { id: "course_craft_a", kind: "course", skill: "craft" },
    {
      taskDefs: TASK_DEFS,
      copy: {
        taskUnlocked: () => ({ title: "unlocked", body: "first", speaker: "system" }),
      },
    }
  );
  assert.equal(firstResult, null);
  assert.equal(rootState.tasks.active.length, 0);
  assert.equal(rootState.tasks.weeklyProgress.craftCompleted, 1);

  const secondResult = handleResolvedCourseTaskProgress(
    rootState,
    { id: "course_craft_b", kind: "course", skill: "craft" },
    {
      taskDefs: TASK_DEFS,
      copy: {
        taskUnlocked: (_name, expiresOnDay) => ({ title: "unlocked", body: String(expiresOnDay), speaker: "system" }),
      },
    }
  );

  assert.ok(secondResult);
  assert.equal(secondResult.type, "artifact_refining");
  assert.equal(secondResult.activityId, "artifact_refining_task");
  assert.deepEqual(realmSafe(rootState.tasks.active), [
    {
      id: "week-2-artifact_refining",
      type: "artifact_refining",
      activityId: "artifact_refining_task",
      status: "active",
      unlockDay: 3,
      expiresOnDay: 6,
      attemptCount: 0,
      rewardClaimed: false,
    },
  ]);

  const schedulable = getSchedulableTaskActivityIds(rootState);
  assert.equal(schedulable.has("artifact_refining_task"), true);

  expireTimedTasksForDay(rootState, 7, {
    copy: {
      taskExpired: () => ({ title: "expired", body: "artifact", speaker: "system" }),
    },
  });
  assert.equal(rootState.tasks.active[0].status, "expired");
  assert.deepEqual(realmSafe(rootState.tasks.lastStory), {
    title: "expired",
    body: "artifact",
    speaker: "system",
  });
});

test("dispatchSessionCommand falls back to runtime syncWeeklyTaskProgress when context does not inject it", () => {
  const runtime = {
    createBasePlayerState: () => ({
      resources: {},
      stats: {},
      skills: {},
      relationships: {},
    }),
    resetPlayerStateOnRoot: () => {},
    applyArchetypeEffectToRoot: () => {},
    createEmptySchedule: () => [null, null],
    createEmptyWeeklyTimetable: () => [[null, null]],
    createEmptyScheduleLocks: () => [false, false],
    cloneCourseSelectionBlocks: () => [],
    buildWeeklyTimetableFromCourseSelection: () => [["course_craft_a", "course_dao"]],
    isCourseSelectionComplete: () => true,
    pickCourseForBlock: () => true,
    buildDailyScheduleFromWeeklyTimetable: (weeklyTimetable, day) => weeklyTimetable[day - 1].slice(),
    buildScheduleLocksFromWeeklyTimetable: (weeklyTimetable, day) => weeklyTimetable[day - 1].map(Boolean),
    findSchedulePreset: () => null,
    findNextEditableSlot: () => 0,
    setSelectedPlanningSlot: () => true,
    assignPlanningActivity: () => true,
    applySchedulePreset: () => true,
    clearPlanningSchedule: () => true,
  };
  const windowObject = loadScripts(["src/domain/task-system.js", "src/app/session.js"], { runtime });
  const { createGameState, dispatchSessionCommand } = windowObject.GAME_RUNTIME;

  const rootState = createGameState({
    createRng: () => () => 0.1,
    totalDays: 1,
    totalWeeks: 4,
    slotCount: 2,
    initialArchetypeId: "starter",
    initialActivityId: "homework",
    copy: {
      initialStory: { title: "start", body: "", speaker: "narrator" },
      introLog: { title: "intro", body: "intro" },
      runStartStory: { title: "run", body: "run", speaker: "narrator" },
      memoryPendingSummary: "pending",
    },
    createStoryFlags: () => ({ introDone: false }),
    createTodayState: () => ({ actions: [] }),
    createMemoryBoardState: () => [],
    createMemoryBridgeState: () => [],
    memoryCenterNodeId: 0,
  });
  rootState.mode = "course_selection";
  rootState.courseSelection.blocks = [{ id: "b1", selectedCourseId: "course_craft_a" }];

  const ok = dispatchSessionCommand(rootState, { type: "course/confirm" }, {
    totalDays: 1,
    slotCount: 2,
    initialActivityId: "homework",
    copy: {
      runStartStory: { title: "run", body: "run", speaker: "narrator" },
    },
    getActivity: (activityId) => {
      if (activityId === "course_craft_a") {
        return { id: activityId, kind: "course", skill: "craft" };
      }
      if (activityId === "course_dao") {
        return { id: activityId, kind: "course", skill: "dao" };
      }
      return { id: activityId, kind: "normal" };
    },
  });

  assert.equal(ok, true);
  assert.equal(rootState.tasks.weeklyProgress.craftTotal, 1);
});
