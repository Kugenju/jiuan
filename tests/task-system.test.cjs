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
      daoCompleted: 0,
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
      availableFromDay: 3,
      expiresOnDay: 5,
      unlockFlags: [],
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

test("syncWeeklyTaskProgress is defensive for missing getActivity and null slots", () => {
  const windowObject = loadScripts(["src/domain/task-system.js"]);
  const { createTaskState, syncWeeklyTaskProgress } = windowObject.GAME_RUNTIME;

  const rootState = {
    weeklyTimetable: [["course_craft_a", null, undefined, ""], [false, "course_other"]],
    tasks: createTaskState(),
  };

  syncWeeklyTaskProgress(rootState, {});
  assert.equal(rootState.tasks.weeklyProgress.craftTotal, 0);

  syncWeeklyTaskProgress(rootState, {
    getActivity: (activityId) => {
      if (activityId === "course_craft_a") {
        return { id: activityId, kind: "course", skill: "craft" };
      }
      return { id: activityId, kind: "course", skill: "dao" };
    },
  });
  assert.equal(rootState.tasks.weeklyProgress.craftTotal, 1);
});

test("lifecycle methods normalize partial persisted task state and expiry day math", () => {
  const windowObject = loadScripts(["data/tasks.js", "src/domain/task-system.js"]);
  const { syncWeeklyTaskProgress, handleResolvedCourseTaskProgress, expireTimedTasksForDay } = windowObject.GAME_RUNTIME;
  const { TASK_DEFS } = windowObject.GAME_DATA;

  const rootState = {
    week: 1,
    day: 4,
    weeklyTimetable: [["course_craft_a"]],
    tasks: {
      weeklyProgress: {},
    },
    currentStory: null,
  };

  syncWeeklyTaskProgress(rootState, {
    taskDefs: TASK_DEFS,
    getActivity: (activityId) => ({ id: activityId, kind: "course", skill: "craft" }),
  });
  assert.deepEqual(realmSafe(rootState.tasks.completedMarks), []);
  assert.equal(rootState.tasks.lastStory, null);
  assert.equal(rootState.tasks.weeklyProgress.craftCompleted, 0);
  assert.equal(rootState.tasks.weeklyProgress.craftTotal, 1);

  const unlocked = handleResolvedCourseTaskProgress(
    rootState,
    { id: "course_craft_a", kind: "course", skill: "craft" },
    {
      taskDefs: TASK_DEFS,
      copy: {
        taskUnlocked: () => ({ title: "unlock", body: "unlock", speaker: "system" }),
      },
    }
  );

  assert.ok(unlocked);
  assert.equal(unlocked.unlockDay, 4);
  assert.equal(unlocked.expiresOnDay, 6);

  expireTimedTasksForDay(rootState, 6, {
    copy: {
      taskExpired: () => ({ title: "expired", body: "artifact", speaker: "system" }),
    },
  });
  assert.equal(rootState.tasks.active[0].status, "active");

  expireTimedTasksForDay(rootState, 7, {
    copy: {
      taskExpired: () => ({ title: "expired", body: "artifact", speaker: "system" }),
    },
  });
  assert.equal(rootState.tasks.active[0].status, "expired");
});

test("dao course lifecycle unlocks next-day debate task with hidden unlock flags", () => {
  const windowObject = loadScripts(["data/tasks.js", "src/domain/task-system.js"]);
  const {
    createTaskState,
    createTaskRuntimeState,
    handleResolvedCourseTaskProgress,
    getSchedulableTaskActivityIds,
    expireTimedTasksForDay,
  } = windowObject.GAME_RUNTIME;
  const { TASK_DEFS } = windowObject.GAME_DATA;
  const copyCalls = {
    taskUnlocked: [],
    taskExpired: [],
  };

  const rootState = {
    week: 3,
    day: 4,
    tasks: createTaskState(),
    storyFlags: {
      dao_archive_insight: true,
      dao_counterexample_insight: false,
    },
  };

  assert.deepEqual(realmSafe(createTaskRuntimeState()), {
    activeTaskId: null,
    pendingSlotIndex: null,
    mode: null,
    result: null,
    refining: null,
    debate: null,
    debatePresentation: {
      stage: "idle",
      revealTimerId: null,
    },
  });

  const firstUnlockResult = handleResolvedCourseTaskProgress(
    rootState,
    { id: "course_dao_a", kind: "course", skill: "dao" },
    {
      taskDefs: TASK_DEFS,
      copy: {
        taskUnlocked: (taskName) => {
          copyCalls.taskUnlocked.push(taskName);
          return { title: "unlocked", body: taskName, speaker: "system" };
        },
      },
    }
  );
  assert.equal(firstUnlockResult, null);
  assert.equal(rootState.tasks.weeklyProgress.daoCompleted, 1);

  const unlockedTask = handleResolvedCourseTaskProgress(
    rootState,
    { id: "course_dao_b", kind: "course", skill: "dao" },
    {
      taskDefs: TASK_DEFS,
      copy: {
        taskUnlocked: (taskName) => {
          copyCalls.taskUnlocked.push(taskName);
          return { title: "unlocked", body: taskName, speaker: "system" };
        },
      },
    }
  );

  assert.equal(rootState.tasks.weeklyProgress.daoCompleted, 2);
  assert.ok(unlockedTask);
  assert.equal(unlockedTask.type, "dao_debate");
  assert.equal(unlockedTask.availableFromDay, 5);
  assert.equal(unlockedTask.expiresOnDay, 10);
  assert.deepEqual(realmSafe(unlockedTask.unlockFlags), ["dao_archive_insight"]);
  assert.equal(getSchedulableTaskActivityIds(rootState, 4).has("dao_debate_task"), false);
  assert.equal(getSchedulableTaskActivityIds(rootState, 5).has("dao_debate_task"), true);
  assert.deepEqual(copyCalls.taskUnlocked, ["道法论辩"]);

  expireTimedTasksForDay(rootState, 11, {
    copy: {
      taskExpired: (taskName) => {
        copyCalls.taskExpired.push(taskName);
        return { title: "expired", body: taskName, speaker: "system" };
      },
    },
  });
  assert.equal(rootState.tasks.active[0].status, "expired");
  assert.deepEqual(copyCalls.taskExpired, ["道法论辩"]);
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
