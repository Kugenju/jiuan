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

test("createGameState initializes multiweek fields", () => {
  const runtime = {
    createBasePlayerState: () => ({
      resources: { coins: 0, insight: 0, spirit: 0 },
      stats: { aura: 0 },
      skills: { dao: 0 },
      relationships: { roommate: 0 },
    }),
    createEmptySchedule: () => [null, null],
    createEmptyWeeklyTimetable: () => [[null, null]],
    createEmptyScheduleLocks: () => [false, false],
  };
  const windowObject = loadScripts(["src/app/session.js"], { runtime });
  const { createGameState } = windowObject.GAME_RUNTIME;

  const state = createGameState({
    createRng: () => () => 0.123,
    totalDays: 7,
    totalWeeks: 4,
    slotCount: 2,
    initialArchetypeId: "starter",
    initialActivityId: "homework",
    copy: {
      initialStory: { title: "start", body: "start", speaker: "narrator" },
      introLog: { title: "intro", body: "intro" },
      memoryPendingSummary: "pending",
    },
    createStoryFlags: () => ({ introDone: false }),
    createTodayState: () => ({ actions: [] }),
    createMemoryBoardState: () => [],
    createMemoryBridgeState: () => [],
    createRouteStressState: () => ({ study: 0, work: 0, training: 0 }),
    memoryCenterNodeId: 0,
  });

  assert.equal(state.totalDays, 7);
  assert.equal(state.week, 1);
  assert.equal(state.totalWeeks, 4);
  assert.deepEqual(realmSafe(state.weeklyReports), []);
  assert.deepEqual(realmSafe(state.strategyHistory), []);
  assert.deepEqual(realmSafe(state.routeStress), { study: 0, work: 0, training: 0 });
  assert.equal(state.weekTracker, null);
  assert.equal(state.finalSummary, null);
});

test("createGameState normalizes totalWeeks defensively", () => {
  const runtime = {
    createBasePlayerState: () => ({
      resources: { coins: 0, insight: 0, spirit: 0 },
      stats: { aura: 0 },
      skills: { dao: 0 },
      relationships: { roommate: 0 },
    }),
    createEmptySchedule: () => [null],
    createEmptyWeeklyTimetable: () => [[null]],
    createEmptyScheduleLocks: () => [false],
  };
  const windowObject = loadScripts(["src/app/session.js"], { runtime });
  const { createGameState } = windowObject.GAME_RUNTIME;
  const baseOptions = {
    createRng: () => () => 0.123,
    totalDays: 7,
    slotCount: 1,
    initialArchetypeId: "starter",
    initialActivityId: "homework",
    copy: {
      initialStory: { title: "start", body: "start", speaker: "narrator" },
      introLog: { title: "intro", body: "intro" },
      memoryPendingSummary: "pending",
    },
    createStoryFlags: () => ({ introDone: false }),
    createTodayState: () => ({ actions: [] }),
    createMemoryBoardState: () => [],
    createMemoryBridgeState: () => [],
    createRouteStressState: () => ({ study: 0, work: 0, training: 0 }),
    memoryCenterNodeId: 0,
  };

  const numericString = createGameState({ ...baseOptions, totalWeeks: "6" });
  const nonPositive = createGameState({ ...baseOptions, totalWeeks: -2 });
  const invalid = createGameState({ ...baseOptions, totalWeeks: "not-a-number" });

  assert.equal(numericString.totalWeeks, 6);
  assert.equal(nonPositive.totalWeeks, 4);
  assert.equal(invalid.totalWeeks, 4);
});

test("buildWeekTransitionState returns continue and final transitions", () => {
  const windowObject = loadScripts(["src/domain/route-stress.js", "src/domain/week-cycle.js"]);
  const { buildWeekTransitionState } = windowObject.GAME_RUNTIME;

  const continueResult = buildWeekTransitionState({
    week: 1,
    totalWeeks: 4,
    weekActions: ["homework", "homework", "homework", "walk_city"],
    routeStress: { study: 0, work: 0, training: 0 },
    strategyHistory: [],
  });
  assert.equal(continueResult.kind, "continue");
  assert.equal(continueResult.canContinue, true);
  assert.deepEqual(realmSafe(continueResult.routeStress), { study: 2, work: 0, training: 0 });

  const finalResult = buildWeekTransitionState({
    week: 4,
    totalWeeks: 4,
    weekActions: ["part_time", "part_time", "part_time", "wash"],
    routeStress: { study: 0, work: 2, training: 0 },
    strategyHistory: [{ week: 3, dominantRoute: "work" }],
  });
  assert.equal(finalResult.kind, "final");
  assert.equal(finalResult.canContinue, false);
  assert.deepEqual(realmSafe(finalResult.routeStress), { study: 0, work: 5, training: 0 });
});

test("finishWeekState writes week progression fields on summary", () => {
  const windowObject = loadScripts(["src/domain/summary.js"]);
  const { finishWeekState } = windowObject.GAME_RUNTIME;
  const logs = [];
  const rootState = {
    mode: "planning",
    scene: "campus",
    week: 2,
    totalWeeks: 4,
    resources: { spirit: 10, insight: 2 },
    stats: { aura: 6 },
    skills: { dao: 3, sigil: 7 },
    storyFlags: { missingClue: false },
    weekTracker: {
      week: 2,
      totalWeeks: 4,
      canContinue: true,
      dominantRoute: "study",
      routeStressBefore: { study: 1, work: 0, training: 0 },
      routeStressAfter: { study: 3, work: 0, training: 0 },
    },
    weeklyReports: [],
    summary: null,
  };
  const context = {
    copy: {
      summary: {
        defaultMajorBeat: "default beat",
        clueMajorBeat: "clue beat",
        title: "week summary",
        speaker: "narrator",
        logTitle: "week log",
        body: () => "body",
      },
    },
    skillLabels: { dao: "Dao", sigil: "Sigil" },
    rankThresholds: [{ min: 0, label: "C" }],
    addLog: (title, body) => logs.push({ title, body }),
  };

  finishWeekState(rootState, context);

  assert.equal(rootState.summary.week, 2);
  assert.equal(rootState.summary.canContinue, true);
  assert.equal(rootState.summary.dominantRoute, "study");
  assert.deepEqual(realmSafe(rootState.summary.routeStressBefore), { study: 1, work: 0, training: 0 });
  assert.deepEqual(realmSafe(rootState.summary.routeStressAfter), { study: 3, work: 0, training: 0 });
  assert.equal(rootState.weeklyReports.length, 1);
  assert.deepEqual(realmSafe(rootState.weeklyReports[0]), {
    week: 2,
    totalWeeks: 4,
    canContinue: true,
    dominantRoute: "study",
    routeStressBefore: { study: 1, work: 0, training: 0 },
    routeStressAfter: { study: 3, work: 0, training: 0 },
    rank: "C",
    bestSkill: ["sigil", 7],
    majorBeat: "default beat",
  });
  assert.equal(rootState.mode, "summary");
  assert.equal(rootState.scene, "summary");
  assert.equal(logs.length, 1);
});

test("finishWeekState passes weekly payload with dominantRoute and routeStress deltas", () => {
  const windowObject = loadScripts(["src/domain/summary.js"]);
  const { finishWeekState } = windowObject.GAME_RUNTIME;
  let receivedPayload = null;
  const rootState = {
    week: 4,
    totalWeeks: 4,
    resources: { spirit: 5, insight: 2 },
    stats: { aura: 2 },
    skills: { dao: 4, sigil: 1 },
    storyFlags: { missingClue: true },
    weekTracker: {
      week: 4,
      totalWeeks: 4,
      canContinue: false,
      dominantRoute: "work",
      routeStressBefore: { study: 0, work: 2, training: 1 },
      routeStressAfter: { study: 0, work: 5, training: 0 },
    },
  };
  const context = {
    copy: {
      summary: {
        defaultMajorBeat: "default beat",
        clueMajorBeat: "clue beat",
        title: "week summary",
        speaker: "narrator",
        logTitle: "week log",
        body: (_rank, _bestSkillLabel, payload) => {
          receivedPayload = payload;
          return "body";
        },
      },
    },
    skillLabels: { dao: "Dao", sigil: "Sigil" },
    rankThresholds: [{ min: 0, label: "C" }],
    addLog: () => {},
  };

  finishWeekState(rootState, context);

  assert.deepEqual(realmSafe(receivedPayload), {
    week: 4,
    totalWeeks: 4,
    canContinue: false,
    dominantRoute: "work",
    routeStressBefore: { study: 0, work: 2, training: 1 },
    routeStressAfter: { study: 0, work: 5, training: 0 },
  });
});

test("buildTextStateExport snapshots selected state fields", () => {
  const windowObject = loadScripts(["src/debug/state-export.js"]);
  const { buildTextStateExport } = windowObject.GAME_RUNTIME;
  const rootState = {
    mode: "planning",
    day: 1,
    week: 1,
    totalWeeks: 4,
    selectedArchetype: "starter",
    currentStory: { title: "story", body: "", speaker: "narrator" },
    routeStress: { study: 1, work: 2, training: 3 },
    weeklyReports: [{ week: 1, dominantRoute: "study" }],
    strategyHistory: [{ week: 1, dominantRoute: "study" }],
    schedule: [null],
    scheduleLocks: [false],
    selectedSlot: 0,
    weeklyTimetable: [[null]],
    courseSelection: { blocks: [] },
    stats: { aura: 1 },
    skills: { dao: 2 },
    resources: { coins: 3 },
    relationships: { roommate: 4 },
    ui: { statsOpen: false, infoModal: null },
    resolvingFlow: {
      slotIndex: 0,
      phase: "idle",
      autoplay: false,
      segmentIndex: 0,
      storyTrail: [],
    },
    progress: 0,
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
    summary: { ending: "ok" },
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
    getActivity: () => null,
    getResolvingSegments: () => [],
  };

  const exported = buildTextStateExport(rootState, context);

  assert.notStrictEqual(exported.route_stress, rootState.routeStress);
  assert.notStrictEqual(exported.weekly_reports, rootState.weeklyReports);
  assert.notStrictEqual(exported.strategy_history, rootState.strategyHistory);
  assert.notStrictEqual(exported.stats, rootState.stats);
  assert.notStrictEqual(exported.skills, rootState.skills);
  assert.notStrictEqual(exported.resources, rootState.resources);
  assert.notStrictEqual(exported.relationships, rootState.relationships);
  assert.notStrictEqual(exported.ui, rootState.ui);
  assert.notStrictEqual(exported.summary, rootState.summary);

  rootState.routeStress.study = 99;
  rootState.weeklyReports.push({ week: 2, dominantRoute: "work" });
  rootState.strategyHistory.push({ week: 2, dominantRoute: "work" });
  rootState.stats.aura = 100;
  rootState.skills.dao = 100;
  rootState.resources.coins = 100;
  rootState.relationships.roommate = 100;
  rootState.ui.statsOpen = true;
  rootState.summary.ending = "changed";

  assert.deepEqual(realmSafe(exported.route_stress), { study: 1, work: 2, training: 3 });
  assert.deepEqual(realmSafe(exported.weekly_reports), [{ week: 1, dominantRoute: "study" }]);
  assert.deepEqual(realmSafe(exported.strategy_history), [{ week: 1, dominantRoute: "study" }]);
  assert.deepEqual(realmSafe(exported.stats), { aura: 1 });
  assert.deepEqual(realmSafe(exported.skills), { dao: 2 });
  assert.deepEqual(realmSafe(exported.resources), { coins: 3 });
  assert.deepEqual(realmSafe(exported.relationships), { roommate: 4 });
  assert.deepEqual(realmSafe(exported.ui), { statsOpen: false, infoModal: null });
  assert.deepEqual(realmSafe(exported.summary), { ending: "ok" });
});

test("buildWeekTransitionState uses runtime helpers resolved at call time", () => {
  const windowObject = loadScripts(["src/domain/week-cycle.js"], {
    runtime: {
      createRouteStressState: () => ({ study: 0, work: 0, training: 0 }),
      detectDominantRoute: () => "balanced",
      updateRouteStress: (current) => ({ ...current, study: 3 }),
    },
  });
  const { buildWeekTransitionState } = windowObject.GAME_RUNTIME;

  windowObject.GAME_RUNTIME.detectDominantRoute = () => "work";
  windowObject.GAME_RUNTIME.updateRouteStress = (current, context) => ({
    ...current,
    work: context.dominantRoute === "work" ? 6 : 0,
  });

  const result = buildWeekTransitionState({
    week: 1,
    totalWeeks: 4,
    weekActions: ["part_time", "part_time", "part_time"],
    routeStress: { study: 0, work: 0, training: 0 },
    strategyHistory: [],
  });

  assert.equal(result.dominantRoute, "work");
  assert.deepEqual(realmSafe(result.routeStress), { study: 0, work: 6, training: 0 });
});

test("buildWeekTransitionState uses option overrides and does not mutate input routeStress", () => {
  const windowObject = loadScripts(["src/domain/week-cycle.js"], {
    runtime: {
      createRouteStressState: () => ({ study: 0, work: 0, training: 0 }),
      detectDominantRoute: () => {
        throw new Error("runtime detectDominantRoute should not be called");
      },
      updateRouteStress: () => {
        throw new Error("runtime updateRouteStress should not be called");
      },
    },
  });
  const { buildWeekTransitionState } = windowObject.GAME_RUNTIME;
  const rootState = {
    week: 2,
    totalWeeks: 4,
    weekActions: ["homework", "part_time"],
    routeStress: { study: 1, work: 1, training: 1 },
    strategyHistory: [{ week: 1, dominantRoute: "study" }],
  };

  const result = buildWeekTransitionState(rootState, {
    detectDominantRoute: () => "training",
    updateRouteStress: (current) => {
      current.training = 9;
      current.study = 0;
      return current;
    },
  });

  assert.equal(result.dominantRoute, "training");
  assert.deepEqual(realmSafe(rootState.routeStress), { study: 1, work: 1, training: 1 });
  assert.deepEqual(realmSafe(result.routeStress), { study: 0, work: 1, training: 9 });
});

test("dispatchSessionCommand continues into next week from summary", () => {
  const runtime = {
    createBasePlayerState: () => ({
      resources: { coins: 0, insight: 0, spirit: 0 },
      stats: { aura: 0 },
      skills: { dao: 0 },
      relationships: { roommate: 0 },
    }),
    resetPlayerStateOnRoot: () => {},
    applyArchetypeEffectToRoot: () => {},
    createEmptySchedule: () => [null, null],
    createEmptyWeeklyTimetable: () => [[null, null]],
    createEmptyScheduleLocks: () => [false, false],
    cloneCourseSelectionBlocks: () => [],
    buildWeeklyTimetableFromCourseSelection: () => [
      [null, "course_sigil"],
      ["course_math", null],
    ],
    isCourseSelectionComplete: () => true,
    pickCourseForBlock: () => true,
    buildDailyScheduleFromWeeklyTimetable: (weeklyTimetable, day) => weeklyTimetable[day - 1].slice(),
    buildScheduleLocksFromWeeklyTimetable: (weeklyTimetable, day) => weeklyTimetable[day - 1].map(Boolean),
    findSchedulePreset: () => null,
    findNextEditableSlot: (locks) => locks.findIndex((locked) => !locked),
    setSelectedPlanningSlot: () => true,
    assignPlanningActivity: () => true,
    applySchedulePreset: () => true,
    clearPlanningSchedule: () => true,
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
    weekTracker: {
      week: 1,
      dominantRoute: "study",
    },
    weekActions: ["homework", "homework"],
    schedule: ["homework", "part_time"],
    scheduleLocks: [false, false],
    weeklyTimetable: [
      [null, "course_sigil"],
      ["course_math", null],
    ],
    selectedSlot: 1,
    selectedActivity: "part_time",
    currentStory: { title: "old", body: "old", speaker: "narrator" },
    progress: 1,
    resolvingIndex: 2,
    phaseTimer: 3,
    dayModifier: { title: "old" },
    resolvingFlow: {
      phase: "ending",
      slotIndex: 1,
      segmentIndex: 2,
      autoplay: true,
      autoplayDelay: 1.05,
      autoplayTimer: 0.2,
      storyTrail: [{ title: "old", body: "old" }],
      justAppended: true,
    },
    memory: {
      pieces: [{ id: "piece-1" }],
      selectedPiece: "piece-1",
      dragPieceId: "piece-1",
      placementsToday: [{ type: "anchor" }],
      cursor: { kind: "node", id: 0 },
      lastSummary: "old summary",
    },
  };
  const ok = dispatchSessionCommand(
    rootState,
    { type: "run/continue-week" },
    {
      slotCount: 2,
      initialActivityId: "homework",
      copy: {
        weekStartStory: (week) => ({
          title: `week ${week}`,
          body: `body ${week}`,
          speaker: "academy",
        }),
        memoryPendingSummary: "pending",
      },
      createTodayState: () => ({ actions: [] }),
      memoryCenterNodeId: 0,
    }
  );

  assert.equal(ok, true);
  assert.equal(rootState.week, 2);
  assert.equal(rootState.day, 1);
  assert.equal(rootState.mode, "planning");
  assert.equal(rootState.scene, "campus");
  assert.equal(rootState.summary, null);
  assert.equal(rootState.weekTracker, null);
  assert.deepEqual(realmSafe(rootState.weekActions), []);
  assert.deepEqual(realmSafe(rootState.schedule), [null, "course_sigil"]);
  assert.deepEqual(realmSafe(rootState.scheduleLocks), [false, true]);
  assert.equal(rootState.selectedSlot, 0);
  assert.equal(rootState.selectedActivity, "homework");
  assert.equal(rootState.progress, 0);
  assert.equal(rootState.resolvingIndex, 0);
  assert.equal(rootState.phaseTimer, 0);
  assert.equal(rootState.dayModifier, null);
  assert.deepEqual(realmSafe(rootState.memory), {
    pieces: [],
    selectedPiece: null,
    dragPieceId: null,
    placementsToday: [],
    cursor: { kind: "node", id: 0 },
    lastSummary: "pending",
  });
  assert.deepEqual(realmSafe(rootState.currentStory), {
    title: "week 2",
    body: "body 2",
    speaker: "academy",
  });
});

test("finishNightFlow triggers weekly summary transition on final day", () => {
  const windowObject = loadScripts(["src/app/night-flow.js"], {
    runtime: {
      normalizePlayerState: () => {},
      buildDailyScheduleFromWeeklyTimetable: () => {
        throw new Error("should not rebuild schedule on final day");
      },
      buildScheduleLocksFromWeeklyTimetable: () => {
        throw new Error("should not rebuild schedule on final day");
      },
      findNextEditableSlot: () => {
        throw new Error("should not choose next slot on final day");
      },
    },
  });
  const { finishNightFlow } = windowObject.GAME_RUNTIME;
  let finishWeekCalls = 0;
  let finishRunCalls = 0;
  const rootState = {
    day: 7,
    totalDays: 7,
    resources: { insight: 0, spirit: 0 },
    stats: { fatigue: 0, mood: 0, memory: 0, intelligence: 0, inspiration: 0 },
    skills: { dao: 0 },
    currentStory: { title: "", body: "", speaker: "" },
    memory: {
      placementsToday: [{ type: "anchor" }],
      bridges: [],
      board: [],
    },
  };

  const result = finishNightFlow(rootState, {
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
    skillLabels: { dao: "道法" },
    getMainFocusSkill: () => "dao",
    addLog: () => {},
    finishWeek: () => {
      finishWeekCalls += 1;
    },
    finishRun: () => {
      finishRunCalls += 1;
    },
  });

  assert.equal(result.ok, true);
  assert.equal(finishWeekCalls, 1);
  assert.equal(finishRunCalls, 0);
});
