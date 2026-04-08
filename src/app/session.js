(() => {
window.GAME_RUNTIME = window.GAME_RUNTIME || {};

const {
  createBasePlayerState,
  resetPlayerStateOnRoot,
  applyArchetypeEffectToRoot,
} = window.GAME_RUNTIME;
const { syncWeeklyTaskProgress: syncWeeklyTaskProgressFromRuntime } = window.GAME_RUNTIME;
const {
  createEmptySchedule,
  createEmptyWeeklyTimetable,
  createEmptyScheduleLocks,
  cloneCourseSelectionBlocks,
  buildWeeklyTimetableFromCourseSelection,
  isCourseSelectionComplete,
  pickCourseForBlock,
  buildDailyScheduleFromWeeklyTimetable,
  buildScheduleLocksFromWeeklyTimetable,
  findSchedulePreset,
  findNextEditableSlot,
  setSelectedPlanningSlot,
  assignPlanningActivity,
  applySchedulePreset,
  clearPlanningSchedule,
  copyPlanningScheduleFromHistory,
} = window.GAME_RUNTIME;

const defaultCreateRandomEventRuntimeState = () => ({
  stage: "idle",
  pendingEvent: null,
  focusedChoiceIndex: 0,
  selectedChoiceId: null,
  resultText: null,
  rewardSummary: null,
  resolution: null,
  continuation: null,
});

function resolveCreateRandomEventRuntimeState(source) {
  if (typeof source?.createRandomEventRuntimeState === "function") {
    return source.createRandomEventRuntimeState;
  }
  if (typeof window.GAME_RUNTIME.createRandomEventRuntimeState === "function") {
    return window.GAME_RUNTIME.createRandomEventRuntimeState;
  }
  window.GAME_RUNTIME.createRandomEventRuntimeState = defaultCreateRandomEventRuntimeState;
  return defaultCreateRandomEventRuntimeState;
}

function normalizeTotalWeeks(value) {
  const parsed = typeof value === "string" ? Number(value.trim()) : Number(value);
  const normalized = Math.floor(parsed);
  if (!Number.isFinite(parsed) || normalized <= 0) {
    return 4;
  }
  return normalized;
}

function buildWeekStartStory(context, week) {
  if (typeof context.copy?.weekStartStory === "function") {
    return context.copy.weekStartStory(week);
  }
  if (context.copy?.weekStartStory) {
    return structuredClone(context.copy.weekStartStory);
  }
  if (context.copy?.runStartStory) {
    return structuredClone(context.copy.runStartStory);
  }
  return {
    title: `第 ${week} 周开始`,
    body: "沿用既有课表，继续安排这一周的自由时段。",
    speaker: "太学院",
  };
}

function createGameState(options) {
  const playerState = createBasePlayerState();
  const totalWeeks = normalizeTotalWeeks(options.totalWeeks);
  const createRouteStressState =
    typeof options.createRouteStressState === "function"
      ? options.createRouteStressState
      : () => ({ study: 0, work: 0, training: 0 });
  const createTaskState =
    typeof options.createTaskState === "function"
      ? options.createTaskState
      : typeof window.GAME_RUNTIME.createTaskState === "function"
      ? window.GAME_RUNTIME.createTaskState
      : () => ({
          active: [],
          weeklyProgress: { craftCompleted: 0, craftTotal: 0, daoCompleted: 0 },
          completedMarks: [],
          lastStory: null,
        });
  const createTaskRuntimeState =
    typeof options.createTaskRuntimeState === "function"
      ? options.createTaskRuntimeState
      : typeof window.GAME_RUNTIME.createTaskRuntimeState === "function"
      ? window.GAME_RUNTIME.createTaskRuntimeState
      : () => ({
          activeTaskId: null,
          pendingSlotIndex: null,
          mode: null,
          result: null,
          refining: null,
          debate: null,
        });
  const createRandomEventRuntimeState = resolveCreateRandomEventRuntimeState(options);

  return {
    mode: "menu",
    rng: options.createRng(),
    day: 1,
    totalDays: options.totalDays,
    week: 1,
    totalWeeks,
    selectedArchetype: options.initialArchetypeId,
    selectedSlot: 0,
    selectedActivity: options.initialActivityId,
    schedule: createEmptySchedule(options.slotCount),
    scheduleLocks: createEmptyScheduleLocks(options.slotCount),
    dayScheduleHistory: {},
    weeklyTimetable: createEmptyWeeklyTimetable(options.totalDays, options.slotCount),
    courseSelection: {
      blocks: [],
    },
    scene: "menu",
    scenePulse: 0,
    progress: 0,
    resolvingIndex: 0,
    phaseTimer: 0,
    resolvingFlow: {
      phase: "idle",
      slotIndex: 0,
      segmentIndex: 0,
      autoplay: false,
      autoplayDelay: 0.6,
      autoplayTimer: 0,
      storyTrail: [],
      justAppended: false,
    },
    dayModifier: null,
    currentStory: structuredClone(options.copy.initialStory),
    resources: structuredClone(playerState.resources),
    stats: structuredClone(playerState.stats),
    skills: structuredClone(playerState.skills),
    relationships: structuredClone(playerState.relationships),
    storyFlags: options.createStoryFlags(),
    timeline: [],
    ui: {
      statsOpen: false,
      infoModal: null,
    },
    log: [{ day: 0, ...structuredClone(options.copy.introLog) }],
    today: options.createTodayState(),
    memory: {
      board: options.createMemoryBoardState(),
      bridges: options.createMemoryBridgeState(),
      pieces: [],
      selectedPiece: null,
      dragPieceId: null,
      placementsToday: [],
      cursor: { kind: "node", id: options.memoryCenterNodeId },
      lastSummary: options.copy.memoryPendingSummary,
    },
    routeStress: createRouteStressState(),
    weeklyReports: [],
    strategyHistory: [],
    weekActions: [],
    weekTracker: null,
    finalSummary: null,
    summary: null,
    tasks: createTaskState(),
    taskRuntime: createTaskRuntimeState(),
    randomEventRuntime: createRandomEventRuntimeState(),
  };
}

function resetGameState(targetState, options) {
  const fresh = createGameState(options);
  Object.keys(fresh).forEach((key) => {
    targetState[key] = fresh[key];
  });
  return targetState;
}

function syncTaskProgressForSession(rootState, context) {
  const syncWeeklyTaskProgress = context.syncWeeklyTaskProgress || syncWeeklyTaskProgressFromRuntime;
  if (typeof syncWeeklyTaskProgress !== "function") {
    return;
  }
  syncWeeklyTaskProgress(rootState, {
    taskDefs: context.taskDefs,
    getActivity: context.getActivity,
  });
}

function carryOverActiveTasksForNextWeek(rootState, fallbackTotalDays = 7) {
  const totalDays = Math.max(1, Number(rootState.totalDays || fallbackTotalDays || 7));
  const activeTasks = Array.isArray(rootState.tasks?.active) ? rootState.tasks.active : [];
  return activeTasks
    .filter((task) => task && task.status === "active")
    .map((task) => {
      const expiresOnDay = Number(task.expiresOnDay);
      if (!Number.isFinite(expiresOnDay)) {
        return null;
      }
      const shiftedExpiresOnDay = expiresOnDay - totalDays;
      if (shiftedExpiresOnDay <= 0) {
        return null;
      }
      const unlockDay = Number(task.unlockDay);
      const shiftedUnlockDay = Number.isFinite(unlockDay) ? unlockDay - totalDays : task.unlockDay;
      const availableFromDay = Number(task.availableFromDay);
      return {
        ...task,
        unlockDay: shiftedUnlockDay,
        availableFromDay: Number.isFinite(availableFromDay) ? availableFromDay - totalDays : shiftedUnlockDay,
        expiresOnDay: shiftedExpiresOnDay,
      };
    })
    .filter(Boolean);
}

function resetTaskStateForWeek(rootState, context) {
  const createTaskState =
    typeof context.createTaskState === "function"
      ? context.createTaskState
      : typeof window.GAME_RUNTIME.createTaskState === "function"
      ? window.GAME_RUNTIME.createTaskState
      : () => ({
          active: [],
          weeklyProgress: { craftCompleted: 0, craftTotal: 0, daoCompleted: 0 },
          completedMarks: [],
          lastStory: null,
        });
  const createTaskRuntimeState =
    typeof context.createTaskRuntimeState === "function"
      ? context.createTaskRuntimeState
      : typeof window.GAME_RUNTIME.createTaskRuntimeState === "function"
      ? window.GAME_RUNTIME.createTaskRuntimeState
      : () => ({
          activeTaskId: null,
          pendingSlotIndex: null,
          mode: null,
          result: null,
          refining: null,
          debate: null,
        });
  const createRandomEventRuntimeState = resolveCreateRandomEventRuntimeState(context);
  const carryOverTasks = carryOverActiveTasksForNextWeek(rootState, context.totalDays);

  rootState.tasks = createTaskState();
  rootState.tasks.active = carryOverTasks;
  rootState.taskRuntime = createTaskRuntimeState();
  rootState.randomEventRuntime = createRandomEventRuntimeState();
}

function getPlanningAssignmentOptions(context) {
  return {
    getActivity: context.getActivity,
    isActivityAssignable: context.isActivityAssignable,
  };
}

function dispatchSessionCommand(rootState, command, context) {
  switch (command.type) {
    case "archetype/select": {
      const picked = context.getArchetype(command.archetypeId);
      if (!picked) {
        return false;
      }
      rootState.selectedArchetype = picked.id;
      const chosenCopy = context.copy.archetypeChosen(picked.name, picked.summary);
      rootState.currentStory = {
        title: chosenCopy.title,
        body: chosenCopy.body,
        speaker: context.uiText.speakers.survey,
      };
      return true;
    }

    case "archetype/apply": {
      if (rootState.summary || rootState.mode !== "menu") {
        return false;
      }
      resetPlayerStateOnRoot(rootState, createBasePlayerState());
      applyArchetypeEffectToRoot(rootState, context.getArchetype(rootState.selectedArchetype));
      return true;
    }

    case "run/start": {
      rootState.mode = "course_selection";
      rootState.scene = "course_selection";
      rootState.storyFlags.introDone = true;
      rootState.courseSelection.blocks = cloneCourseSelectionBlocks(
        context.courseSelectionBlocks,
        rootState.selectedArchetype,
        context.defaultArchetypeId
      );
      rootState.weeklyTimetable = buildWeeklyTimetableFromCourseSelection(
        rootState.courseSelection.blocks,
        context.totalDays,
        context.slotCount
      );
      rootState.schedule = createEmptySchedule(context.slotCount);
      rootState.scheduleLocks = createEmptyScheduleLocks(context.slotCount);
      rootState.dayScheduleHistory = {};
      rootState.currentStory = structuredClone(context.copy.runStartStory);
      context.addLog(context.copy.runStartLog.title, context.copy.runStartLog.body);
      return true;
    }

    case "course/select":
      return pickCourseForBlock(rootState, command.blockId, command.courseId, {
        getActivity: context.getActivity,
        slotCount: context.slotCount,
      });

    case "course/confirm": {
      if (rootState.mode !== "course_selection" || !isCourseSelectionComplete(rootState.courseSelection.blocks)) {
        return false;
      }
      rootState.mode = "planning";
      rootState.scene = "campus";
      rootState.weeklyTimetable = buildWeeklyTimetableFromCourseSelection(
        rootState.courseSelection.blocks,
        context.totalDays,
        context.slotCount
      );
      rootState.schedule = buildDailyScheduleFromWeeklyTimetable(rootState.weeklyTimetable, rootState.day, context.slotCount);
      rootState.scheduleLocks = buildScheduleLocksFromWeeklyTimetable(rootState.weeklyTimetable, rootState.day, context.slotCount);
      rootState.selectedSlot = findNextEditableSlot(rootState.scheduleLocks, 0, 1);
      rootState.selectedActivity = context.initialActivityId;
      syncTaskProgressForSession(rootState, context);
      rootState.currentStory = structuredClone(context.copy.runStartStory);
      return true;
    }

    case "schedule/apply-preset": {
      const preset = findSchedulePreset(context.schedulePresets, command.presetId);
      return applySchedulePreset(rootState, preset, getPlanningAssignmentOptions(context));
    }

    case "schedule/clear":
      return clearPlanningSchedule(rootState, context.slotCount);

    case "schedule/copy-previous-day":
      return copyPlanningScheduleFromHistory(rootState, Number(command.day || rootState.day - 1), {
        ...getPlanningAssignmentOptions(context),
        slotCount: context.slotCount,
      });

    case "schedule/set-slot":
      return setSelectedPlanningSlot(rootState, command.index, {
        slotCount: context.slotCount,
      });

    case "schedule/assign-activity":
      return assignPlanningActivity(rootState, command.activityId, getPlanningAssignmentOptions(context));

    case "run/restart":
      resetGameState(rootState, context.sessionOptions);
      return true;

    case "run/continue-week": {
      if (rootState.mode !== "summary" || !rootState.summary?.canContinue) {
        return false;
      }

      rootState.week += 1;
      rootState.day = 1;
      rootState.mode = "planning";
      rootState.scene = "campus";
      rootState.progress = 0;
      rootState.resolvingIndex = 0;
      rootState.phaseTimer = 0;
      rootState.resolvingFlow = {
        phase: "idle",
        slotIndex: 0,
        segmentIndex: 0,
        autoplay: false,
        autoplayDelay: 0.6,
        autoplayTimer: 0,
        storyTrail: [],
        justAppended: false,
      };
      rootState.dayModifier = null;
      rootState.summary = null;
      rootState.weekTracker = null;
      rootState.weekActions = [];
      rootState.dayScheduleHistory = {};
      resetTaskStateForWeek(rootState, context);
      rootState.schedule = buildDailyScheduleFromWeeklyTimetable(rootState.weeklyTimetable, rootState.day, context.slotCount);
      rootState.scheduleLocks = buildScheduleLocksFromWeeklyTimetable(rootState.weeklyTimetable, rootState.day, context.slotCount);
      rootState.selectedSlot = findNextEditableSlot(rootState.scheduleLocks, 0, 1);
      rootState.selectedActivity = context.initialActivityId;
      syncTaskProgressForSession(rootState, context);
      rootState.currentStory = buildWeekStartStory(context, rootState.week);
      rootState.memory.pieces = [];
      rootState.memory.selectedPiece = null;
      rootState.memory.dragPieceId = null;
      rootState.memory.placementsToday = [];
      rootState.memory.cursor = { kind: "node", id: context.memoryCenterNodeId };
      rootState.memory.lastSummary = context.copy.memoryPendingSummary;
      return true;
    }

    default:
      return false;
  }
}

Object.assign(window.GAME_RUNTIME, {
  createGameState,
  resetGameState,
  dispatchSessionCommand,
});
})();
