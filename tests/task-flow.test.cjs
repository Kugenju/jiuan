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

test("resolveSlotForFlowState enters task mode for artifact refining activity", () => {
  const calls = {
    applyActivityToState: 0,
    beginTaskActivityForSlot: 0,
    triggerRandomEventForTiming: 0,
    pushTimeline: 0,
  };
  const runtime = {
    findDayModifier: () => null,
    applyActivityToState: () => {
      calls.applyActivityToState += 1;
      return "normal notes";
    },
    getActivitySpeaker: () => "system",
    triggerRandomEventForTiming: () => {
      calls.triggerRandomEventForTiming += 1;
      return null;
    },
  };
  const windowObject = loadScripts(["src/app/day-flow.js"], { runtime });
  const { resolveSlotForFlowState } = windowObject.GAME_RUNTIME;
  const rootState = {
    mode: "resolving",
    day: 3,
    week: 1,
    schedule: ["artifact_refining_task"],
    progress: 0,
    resolvingIndex: 0,
    currentStory: null,
    taskRuntime: {
      activeTaskId: null,
      pendingSlotIndex: null,
      mode: null,
      result: null,
      refining: null,
    },
    resolvingFlow: {
      storyTrail: [],
      justAppended: false,
    },
  };
  const context = {
    slotNames: ["morning"],
    uiText: {
      speakers: {
        schedule: "schedule",
      },
    },
    copy: {
      dayFlowResult: () => ({
        title: "result",
        body: "result body",
      }),
    },
    storyBeats: [],
    skillLabels: {},
    getMainFocusSkill: () => "craft",
    addLog: () => {},
    pushTimeline: () => {
      calls.pushTimeline += 1;
    },
    randomEvents: [],
    getActivity: (activityId) => ({
      id: activityId,
      kind: "task",
      name: "Artifact Refining",
      storySegments: [],
    }),
    fallbackActivityId: "homework",
    beginTaskActivityForSlot: (state, activity, slotIndex) => {
      calls.beginTaskActivityForSlot += 1;
      state.mode = "task";
      state.taskRuntime = {
        activeTaskId: "week-1-artifact_refining",
        pendingSlotIndex: slotIndex,
        mode: activity.id,
        result: null,
        refining: null,
      };
      return { ok: true, enteredTask: true };
    },
  };

  const result = resolveSlotForFlowState(rootState, 0, context);

  assert.equal(result?.enteredTask, true);
  assert.equal(rootState.mode, "task");
  assert.deepEqual(realmSafe(rootState.taskRuntime), {
    activeTaskId: "week-1-artifact_refining",
    pendingSlotIndex: 0,
    mode: "artifact_refining_task",
    result: null,
    refining: null,
  });
  assert.equal(calls.beginTaskActivityForSlot, 1);
  assert.equal(calls.applyActivityToState, 0);
  assert.equal(calls.triggerRandomEventForTiming, 0);
  assert.equal(calls.pushTimeline, 0);
});

test("finishNightFlow expires timed tasks before advancing to the next planning day", () => {
  const calls = {
    expireTimedTasksForDay: [],
  };
  const windowObject = loadScripts(["src/app/night-flow.js"], {
    runtime: {
      normalizePlayerState: () => {},
      buildDailyScheduleFromWeeklyTimetable: () => ["homework", null],
      buildScheduleLocksFromWeeklyTimetable: () => [true, false],
      findNextEditableSlot: () => 1,
    },
  });
  const { finishNightFlow } = windowObject.GAME_RUNTIME;
  const rootState = {
    day: 2,
    totalDays: 7,
    weeklyTimetable: [["course"], ["course"], ["homework"]],
    schedule: ["course", null],
    scheduleLocks: [true, false],
    selectedSlot: 1,
    selectedActivity: "homework",
    mode: "memory",
    scene: "memory",
    currentStory: { title: "", body: "", speaker: "" },
    resources: { insight: 0, spirit: 0 },
    stats: {
      fatigue: 0,
      mood: 0,
      memory: 0,
      intelligence: 0,
      inspiration: 0,
    },
    skills: { craft: 0 },
    memory: {
      placementsToday: [{ type: "anchor" }],
      bridges: [],
      board: [],
    },
    tasks: {
      active: [
        {
          id: "week-1-artifact_refining",
          type: "artifact_refining",
          activityId: "artifact_refining_task",
          status: "active",
          unlockDay: 1,
          expiresOnDay: 2,
        },
      ],
      weeklyProgress: { craftCompleted: 0, craftTotal: 0 },
      completedMarks: [],
      lastStory: null,
    },
  };

  finishNightFlow(rootState, {
    layout: { edges: [] },
    copy: {
      memoryStart: () => ({ speaker: "night" }),
      emptyNightFinish: { title: "empty", body: "empty", speaker: "night" },
      nightEffects: {
        baseUnlock: "unlock",
        abilityBoost: () => "ability",
        boostRecover: "boost",
        reasoningBreakthrough: "reasoning",
        bridgeLink: "bridge",
        resonance: (count) => `resonance ${count}`,
      },
      nightLog: (day, body) => ({ title: `night ${day}`, body }),
    },
    skillLabels: { craft: "Craft" },
    getMainFocusSkill: () => "craft",
    addLog: () => {},
    defaultFreeActivityId: "homework",
    expireTimedTasksForDay: (state, nextDay) => {
      calls.expireTimedTasksForDay.push(nextDay);
      state.tasks.active[0].status = nextDay > state.tasks.active[0].expiresOnDay ? "expired" : "active";
    },
  });

  assert.deepEqual(calls.expireTimedTasksForDay, [3]);
  assert.equal(rootState.tasks.active[0].status, "expired");
  assert.equal(rootState.day, 3);
  assert.equal(rootState.mode, "planning");
  assert.equal(rootState.selectedActivity, "homework");
});

test("dispatchSessionCommand keeps the assignability hook active for task activities", () => {
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
    buildWeeklyTimetableFromCourseSelection: () => [[null, null]],
    isCourseSelectionComplete: () => true,
    pickCourseForBlock: () => true,
    buildDailyScheduleFromWeeklyTimetable: () => [null, null],
    buildScheduleLocksFromWeeklyTimetable: () => [false, false],
    findSchedulePreset: () => null,
    findNextEditableSlot: () => 0,
    setSelectedPlanningSlot: () => true,
    clearPlanningSchedule: () => true,
  };
  const windowObject = loadScripts(["src/domain/schedule.js", "src/app/session.js"], { runtime });
  const { dispatchSessionCommand } = windowObject.GAME_RUNTIME;
  const rootState = {
    mode: "planning",
    selectedSlot: 0,
    selectedActivity: "homework",
    schedule: [null, null],
    scheduleLocks: [false, false],
  };
  const taskActivity = { id: "artifact_refining_task", kind: "task", name: "Artifact Refining" };
  const context = {
    getActivity: (activityId) => (activityId === taskActivity.id ? taskActivity : { id: activityId, kind: "routine" }),
    isActivityAssignable: (_state, activity) => activity.kind !== "task",
  };

  const ok = dispatchSessionCommand(rootState, { type: "schedule/assign-activity", activityId: taskActivity.id }, context);

  assert.equal(ok, false);
  assert.equal(rootState.schedule[0], null);
  assert.equal(rootState.selectedActivity, "homework");
});
