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

test("applyActivityToState reports craft course resolution into timed task progression", () => {
  const calls = {
    handleResolvedCourseTaskProgress: 0,
  };
  const windowObject = loadScripts(["src/domain/activity.js"], {
    runtime: {
      applyEffectBundleToRoot: () => {},
      normalizePlayerState: () => {},
      triggerStoryBeatForActivity: () => {},
      getRouteStressPenaltyProfile: () => null,
      ROUTE_ACTIVITY_MAP: {},
    },
  });
  const { applyActivityToState } = windowObject.GAME_RUNTIME;
  const rootState = {
    stats: { fatigue: 0 },
    skills: {},
    resources: {},
    relationships: {},
    today: {
      tones: { study: 0, life: 0, body: 0, social: 0 },
      kinds: { course: 0, assignment: 0, routine: 0 },
      focus: {},
      courseSkills: {},
      courses: [],
      assignments: [],
      randomEvents: [],
      actions: [],
      latestCourseSkill: null,
    },
    tasks: {
      active: [],
      weeklyProgress: { craftCompleted: 0, craftTotal: 1 },
      completedMarks: [],
      lastStory: null,
    },
    dayModifier: null,
    weekActions: [],
    scheduleLocks: [true],
  };

  applyActivityToState(
    rootState,
    {
      id: "artifact_intelligence",
      name: "本命法宝智能系统",
      kind: "course",
      tone: "study",
      skill: "craft",
      effects: {},
      notes: {},
    },
    0,
    {
      slotNames: ["morning"],
      copy: {},
      storyBeats: [],
      skillLabels: { craft: "Craft" },
      getMainFocusSkill: () => "craft",
      addLog: () => {},
      taskDefs: {
        artifact_refining: {
          id: "artifact_refining",
          activityId: "artifact_refining_task",
          durationDays: 3,
        },
      },
      handleResolvedCourseTaskProgress: (state, activity, context) => {
        calls.handleResolvedCourseTaskProgress += 1;
        state.tasks.weeklyProgress.craftCompleted += 1;
        state.tasks.active.push({
          id: "week-1-artifact_refining",
          type: "artifact_refining",
          activityId: context.taskDefs.artifact_refining.activityId,
          status: "active",
        });
      },
    }
  );

  assert.equal(calls.handleResolvedCourseTaskProgress, 1);
  assert.equal(rootState.tasks.weeklyProgress.craftCompleted, 1);
  assert.equal(rootState.tasks.active[0].activityId, "artifact_refining_task");
});

test("resolveSlotForFlowState shows unlock story after the final craft course unlocks a task", () => {
  const runtime = {
    findDayModifier: () => null,
    applyActivityToState: (rootState) => {
      rootState.tasks = {
        active: [
          {
            id: "week-1-artifact_refining",
            type: "artifact_refining",
            activityId: "artifact_refining_task",
            status: "active",
          },
        ],
        weeklyProgress: { craftCompleted: 1, craftTotal: 1 },
        completedMarks: [],
        lastStory: {
          title: "unlock",
          body: "refining task unlocked",
          speaker: "mentor",
        },
      };
      return "course notes";
    },
    getActivitySpeaker: () => "course",
    triggerRandomEventForTiming: () => null,
  };
  const windowObject = loadScripts(["src/app/day-flow.js"], { runtime });
  const { resolveSlotForFlowState } = windowObject.GAME_RUNTIME;
  const rootState = {
    mode: "resolving",
    day: 3,
    week: 1,
    schedule: ["artifact_intelligence"],
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
    tasks: {
      active: [],
      weeklyProgress: { craftCompleted: 0, craftTotal: 1 },
      completedMarks: [],
      lastStory: null,
    },
  };

  resolveSlotForFlowState(rootState, 0, {
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
    pushTimeline: () => {},
    randomEvents: [],
    getActivity: () => ({
      id: "artifact_intelligence",
      kind: "course",
      name: "Artifact Intelligence",
      storySegments: [],
    }),
    fallbackActivityId: "homework",
  });

  assert.equal(rootState.tasks.active.length, 1);
  assert.equal(rootState.currentStory.title, "unlock");
  assert.deepEqual(realmSafe(rootState.resolvingFlow.storyTrail), [
    { title: "result", body: "result body", speaker: "course" },
    { title: "unlock", body: "refining task unlocked", speaker: "mentor" },
  ]);
});

test("resumeResolvingAfterTaskAttempt returns task flow to resolving and advances normally", () => {
  const windowObject = loadScripts(["src/app/day-flow.js"]);
  const { resumeResolvingAfterTaskAttempt, advanceResolvingFlowState } = windowObject.GAME_RUNTIME;
  const rootState = {
    mode: "task",
    scene: "workshop",
    progress: 0,
    resolvingIndex: 0,
    currentStory: null,
    taskRuntime: {
      activeTaskId: "week-1-artifact_refining",
      pendingSlotIndex: 0,
      mode: "artifact_refining_task",
      result: { success: true, score: 3 },
      refining: {
        deck: [],
        slots: ["card-1", "card-2", "card-3"],
      },
    },
    resolvingFlow: {
      phase: "result",
      slotIndex: 0,
      segmentIndex: 0,
      autoplay: true,
      autoplayDelay: 1.05,
      autoplayTimer: 0.5,
      storyTrail: [],
      justAppended: false,
    },
  };
  const detail = {
    title: "task result",
    body: "finished the refining check",
    speaker: "mentor",
  };

  resumeResolvingAfterTaskAttempt(rootState, detail, {
    slotNames: ["morning", "noon", "night"],
  });

  assert.equal(rootState.mode, "resolving");
  assert.equal(rootState.scene, "resolving");
  assert.equal(rootState.progress, 1 / 3);
  assert.equal(rootState.resolvingIndex, 1);
  assert.equal(rootState.resolvingFlow.phase, "result");
  assert.equal(rootState.resolvingFlow.autoplay, false);
  assert.equal(rootState.resolvingFlow.autoplayTimer, 0);
  assert.deepEqual(realmSafe(rootState.taskRuntime), {
    activeTaskId: null,
    pendingSlotIndex: null,
    mode: null,
    result: null,
    refining: null,
  });
  assert.deepEqual(realmSafe(rootState.resolvingFlow.storyTrail), [detail]);
  assert.equal(rootState.currentStory.title, "task result");

  const advanced = advanceResolvingFlowState(rootState, {
    slotNames: ["morning", "noon", "night"],
    copy: {
      dayFlowOutroTitle: (slotName) => `${slotName} outro`,
      dayFlowOutro: (slotName) => `${slotName} continues`,
      dayEndLog: { title: "day end", body: "done" },
    },
    uiText: {
      speakers: {
        schedule: "schedule",
      },
    },
    addLog: () => {},
    enterMemoryPhase: () => {},
  });

  assert.equal(advanced.transitioned, true);
  assert.equal(rootState.resolvingFlow.phase, "outro");
  assert.equal(rootState.currentStory.title, "morning outro");
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

test("dispatchSessionCommand carries unexpired active tasks into next week", () => {
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
    createTaskState: () => ({
      active: [],
      weeklyProgress: { craftCompleted: 0, craftTotal: 0 },
      completedMarks: [],
      lastStory: null,
    }),
    createTaskRuntimeState: () => ({
      activeTaskId: null,
      pendingSlotIndex: null,
      mode: null,
      result: null,
      refining: null,
    }),
  };
  const windowObject = loadScripts(["src/app/session.js"], { runtime });
  const { dispatchSessionCommand } = windowObject.GAME_RUNTIME;
  const rootState = {
    mode: "summary",
    scene: "summary",
    day: 7,
    week: 1,
    totalWeeks: 4,
    summary: { canContinue: true },
    weekTracker: { week: 1, totalWeeks: 4, canContinue: true },
    progress: 1,
    resolvingIndex: 6,
    phaseTimer: 1,
    resolvingFlow: {
      phase: "ending",
      slotIndex: 5,
      segmentIndex: 2,
      autoplay: true,
      autoplayDelay: 1.05,
      autoplayTimer: 0.7,
      storyTrail: [{ title: "old" }],
      justAppended: true,
    },
    dayModifier: { id: "busy" },
    weeklyTimetable: [[null, null]],
    schedule: ["artifact_refining_task", null],
    scheduleLocks: [false, false],
    selectedSlot: 0,
    selectedActivity: "artifact_refining_task",
    currentStory: { title: "summary", body: "body", speaker: "system" },
    memory: {
      pieces: [{ id: "piece-1" }],
      selectedPiece: "piece-1",
      dragPieceId: "piece-1",
      placementsToday: [{ id: "placement-1" }],
      cursor: { kind: "node", id: 7 },
      lastSummary: "old summary",
    },
    tasks: {
      active: [
        { id: "week-1-artifact_refining", status: "active", unlockDay: 1, expiresOnDay: 9 },
        { id: "week-1-old-task", status: "active", unlockDay: 2, expiresOnDay: 7 },
      ],
      weeklyProgress: { craftCompleted: 1, craftTotal: 1 },
      completedMarks: ["artifact_refining"],
      lastStory: { title: "task", body: "done", speaker: "mentor" },
    },
    taskRuntime: {
      activeTaskId: "week-1-artifact_refining",
      pendingSlotIndex: 0,
      mode: "artifact_refining_task",
      result: { success: true, score: 3 },
      refining: { slots: ["card-0", "card-1", "card-2"] },
    },
    weekActions: ["task"],
    totalDays: 7,
  };
  const context = {
    slotCount: 2,
    initialActivityId: "homework",
    memoryCenterNodeId: 0,
    copy: {
      memoryPendingSummary: "pending",
      weekStartStory: (week) => ({ title: `week ${week}`, body: "start", speaker: "system" }),
    },
    sessionOptions: {},
    getActivity: () => ({ kind: "routine" }),
  };

  const ok = dispatchSessionCommand(rootState, { type: "run/continue-week" }, context);

  assert.equal(ok, true);
  assert.equal(rootState.week, 2);
  assert.equal(rootState.day, 1);
  assert.deepEqual(realmSafe(rootState.tasks), {
    active: [{ id: "week-1-artifact_refining", status: "active", unlockDay: -6, expiresOnDay: 2 }],
    weeklyProgress: { craftCompleted: 0, craftTotal: 0 },
    completedMarks: [],
    lastStory: null,
  });
  assert.deepEqual(realmSafe(rootState.taskRuntime), {
    activeTaskId: null,
    pendingSlotIndex: null,
    mode: null,
    result: null,
    refining: null,
  });
});

test("finishWeekState carries completed task marks into the weekly summary payload", () => {
  const windowObject = loadScripts(["src/domain/summary.js"]);
  const { finishWeekState } = windowObject.GAME_RUNTIME;
  let receivedPayload = null;
  const rootState = {
    mode: "planning",
    scene: "campus",
    week: 1,
    totalWeeks: 4,
    resources: { coins: 0, insight: 2, spirit: 3 },
    stats: { aura: 1 },
    skills: { dao: 1, craft: 4 },
    storyFlags: { missingClue: false },
    tasks: {
      active: [],
      weeklyProgress: { craftCompleted: 1, craftTotal: 1 },
      completedMarks: ["artifact_refining"],
      lastStory: null,
    },
    weekTracker: {
      week: 1,
      totalWeeks: 4,
      canContinue: true,
      dominantRoute: "training",
      routeStressBefore: { study: 0, work: 0, training: 1 },
      routeStressAfter: { study: 0, work: 0, training: 2 },
    },
    weeklyReports: [],
    summary: null,
  };
  const context = {
    copy: {
      summary: {
        defaultMajorBeat: "default beat",
        clueMajorBeat: "clue beat",
        title: "summary",
        speaker: "academy",
        logTitle: "week log",
        body: (_rank, _bestSkillLabel, payload) => {
          receivedPayload = payload;
          return "body";
        },
      },
    },
    skillLabels: { dao: "Dao", craft: "Craft" },
    rankThresholds: [{ min: 0, label: "C" }],
    addLog: () => {},
  };

  finishWeekState(rootState, context);

  assert.deepEqual(realmSafe(receivedPayload), {
    week: 1,
    totalWeeks: 4,
    canContinue: true,
    dominantRoute: "training",
    routeStressBefore: { study: 0, work: 0, training: 1 },
    routeStressAfter: { study: 0, work: 0, training: 2 },
    taskMarks: ["artifact_refining"],
  });
  assert.deepEqual(realmSafe(rootState.summary.taskMarks), ["artifact_refining"]);
  assert.deepEqual(realmSafe(rootState.weeklyReports[0].taskMarks), ["artifact_refining"]);
});

test("buildTextStateExport snapshots task system state for debugging", () => {
  const windowObject = loadScripts(["src/debug/state-export.js"]);
  const { buildTextStateExport } = windowObject.GAME_RUNTIME;
  const rootState = {
    mode: "task",
    day: 4,
    week: 1,
    totalWeeks: 4,
    selectedArchetype: "starter",
    currentStory: { title: "task story", body: "", speaker: "system" },
    routeStress: { study: 0, work: 0, training: 0 },
    weeklyReports: [],
    strategyHistory: [],
    schedule: ["artifact_refining_task"],
    scheduleLocks: [false],
    selectedSlot: 0,
    weeklyTimetable: [["artifact_refining_task"]],
    courseSelection: { blocks: [] },
    stats: { aura: 1 },
    skills: { craft: 2 },
    resources: { coins: 3, insight: 4, spirit: 5 },
    relationships: { roommate: 0 },
    ui: { statsOpen: false, infoModal: null },
    resolvingFlow: {
      slotIndex: 0,
      phase: "result",
      autoplay: false,
      segmentIndex: 0,
      storyTrail: [],
    },
    progress: 0.5,
    memory: {
      pieces: [],
      selectedPiece: null,
      cursor: { kind: "node", id: 0 },
      board: [
        {
          zone: "center",
          unlocked: true,
          unlockedDay: 0,
          structure: null,
          structureSkill: null,
          day: null,
          fragments: [],
        },
      ],
      bridges: [null],
    },
    tasks: {
      active: [{ id: "week-1-artifact_refining", status: "active" }],
      weeklyProgress: { craftCompleted: 1, craftTotal: 1 },
      completedMarks: ["artifact_refining"],
      lastStory: { title: "task done", body: "done", speaker: "system" },
    },
    taskRuntime: {
      activeTaskId: "week-1-artifact_refining",
      pendingSlotIndex: 0,
      mode: "artifact_refining_task",
      result: { success: true, score: 3 },
      refining: {
        deck: [{ id: "card-0", type: "xuantie" }],
        slots: ["card-0", null, null],
        revealsRemaining: 2,
        selectedCardId: "card-0",
      },
    },
    summary: null,
  };
  const context = {
    normalizeMemoryCursor: (cursor) => cursor,
    layout: {
      nodes: [{ index: 0, q: 0, r: 0, zone: "center" }],
      edges: [{ index: 0, a: 0, b: 0 }],
    },
    isValidPlacement: () => false,
    uiText: {
      stateExport: { coordinateSystem: "axial" },
      common: { unassigned: "unassigned" },
    },
    slotNames: ["morning"],
    getActivity: (activityId) => (activityId ? { id: activityId, name: "Artifact Refining" } : null),
    getResolvingSegments: () => [],
  };

  const exported = buildTextStateExport(rootState, context);

  assert.deepEqual(realmSafe(exported.tasks), realmSafe(rootState.tasks));
  assert.deepEqual(realmSafe(exported.task_runtime), realmSafe(rootState.taskRuntime));
  assert.notStrictEqual(exported.tasks, rootState.tasks);
  assert.notStrictEqual(exported.task_runtime, rootState.taskRuntime);

  rootState.tasks.completedMarks.push("mutated");
  rootState.taskRuntime.refining.slots[0] = null;

  assert.deepEqual(realmSafe(exported.tasks.completedMarks), ["artifact_refining"]);
  assert.deepEqual(realmSafe(exported.task_runtime.refining.slots), ["card-0", null, null]);
});

test("applyRefiningTaskRound keeps task runtime active when cumulative score is still below target", () => {
  const windowObject = loadScripts(["data/tasks.js", "src/domain/refining-minigame.js", "src/domain/task-system.js"]);
  const { TASK_DEFS } = windowObject.GAME_DATA;
  const { createRefiningSessionState, applyRefiningTaskRound } = windowObject.GAME_RUNTIME;

  const rootState = {
    tasks: {
      active: [{ id: "week-1-artifact_refining", type: "artifact_refining", activityId: "artifact_refining_task", status: "active", attemptCount: 0 }],
    },
    taskRuntime: {
      activeTaskId: "week-1-artifact_refining",
      pendingSlotIndex: 0,
      mode: "artifact_refining_task",
      result: null,
      refining: createRefiningSessionState(TASK_DEFS.artifact_refining, () => 0.25),
    },
  };

  const outcome = applyRefiningTaskRound(
    rootState,
    { score: 1, success: false, complete: true, recipeKey: "xuantie|xuantie|xuantie" },
    { taskDef: TASK_DEFS.artifact_refining, rng: () => 0.5 }
  );

  assert.equal(outcome.status, "continue");
  assert.equal(rootState.taskRuntime.activeTaskId, "week-1-artifact_refining");
  assert.equal(rootState.taskRuntime.refining.roundIndex, 2);
  assert.equal(rootState.taskRuntime.refining.totalScore, 1);
  assert.equal(rootState.tasks.active[0].attemptCount, 0);
});

test("applyRefiningTaskRound returns cumulative terminal result on success", () => {
  const windowObject = loadScripts(["data/tasks.js", "src/domain/refining-minigame.js", "src/domain/task-system.js"]);
  const { TASK_DEFS } = windowObject.GAME_DATA;
  const { createRefiningSessionState, applyRefiningTaskRound } = windowObject.GAME_RUNTIME;

  const rootState = {
    tasks: {
      active: [{ id: "week-1-artifact_refining", type: "artifact_refining", activityId: "artifact_refining_task", status: "active", attemptCount: 0 }],
    },
    taskRuntime: {
      activeTaskId: "week-1-artifact_refining",
      pendingSlotIndex: 0,
      mode: "artifact_refining_task",
      result: null,
      refining: createRefiningSessionState(TASK_DEFS.artifact_refining, () => 0.25),
    },
  };
  rootState.taskRuntime.refining.totalScore = 2;
  rootState.taskRuntime.refining.roundIndex = 2;

  const outcome = applyRefiningTaskRound(
    rootState,
    { score: 1, success: false, complete: true, recipeKey: "lingshi|xuantie|xuantie" },
    { taskDef: TASK_DEFS.artifact_refining, rng: () => 0.5 }
  );

  assert.equal(outcome.status, "success");
  assert.equal(outcome.finalResult.score, 3);
  assert.equal(outcome.finalResult.success, true);
  assert.equal(rootState.taskRuntime.refining.totalScore, 3);
  assert.equal(rootState.tasks.active[0].attemptCount, 1);
});
