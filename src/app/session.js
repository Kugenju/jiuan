(() => {
window.GAME_RUNTIME = window.GAME_RUNTIME || {};

const {
  createBasePlayerState,
  resetPlayerStateOnRoot,
  applyArchetypeEffectToRoot,
} = window.GAME_RUNTIME;
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
} = window.GAME_RUNTIME;

function createGameState(options) {
  const playerState = createBasePlayerState();

  return {
    mode: "menu",
    rng: options.createRng(),
    day: 1,
    totalDays: options.totalDays,
    selectedArchetype: options.initialArchetypeId,
    selectedSlot: 0,
    selectedActivity: options.initialActivityId,
    schedule: createEmptySchedule(options.slotCount),
    scheduleLocks: createEmptyScheduleLocks(options.slotCount),
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
      autoplayDelay: 1.05,
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
    summary: null,
  };
}

function resetGameState(targetState, options) {
  const fresh = createGameState(options);
  Object.keys(fresh).forEach((key) => {
    targetState[key] = fresh[key];
  });
  return targetState;
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
      rootState.currentStory = structuredClone(context.copy.runStartStory);
      return true;
    }

    case "schedule/apply-preset": {
      const preset = findSchedulePreset(context.schedulePresets, command.presetId);
      return applySchedulePreset(rootState, preset, {
        getActivity: context.getActivity,
      });
    }

    case "schedule/clear":
      return clearPlanningSchedule(rootState, context.slotCount);

    case "schedule/set-slot":
      return setSelectedPlanningSlot(rootState, command.index, {
        slotCount: context.slotCount,
      });

    case "schedule/assign-activity":
      return assignPlanningActivity(rootState, command.activityId, {
        getActivity: context.getActivity,
      });

    case "run/restart":
      resetGameState(rootState, context.sessionOptions);
      return true;

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
