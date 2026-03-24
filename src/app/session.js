window.GAME_RUNTIME = window.GAME_RUNTIME || {};

const {
  createBasePlayerState,
  resetPlayerStateOnRoot,
  applyArchetypeEffectToRoot,
} = window.GAME_RUNTIME;
const {
  createEmptySchedule,
  cloneDefaultSchedule,
  findSchedulePreset,
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
      rootState.mode = "planning";
      rootState.scene = "campus";
      rootState.storyFlags.introDone = true;
      rootState.schedule = cloneDefaultSchedule(
        context.defaultSchedules,
        rootState.selectedArchetype,
        context.defaultArchetypeId
      );
      rootState.selectedSlot = 0;
      rootState.selectedActivity = rootState.schedule[0] || context.initialActivityId;
      rootState.currentStory = structuredClone(context.copy.runStartStory);
      context.addLog(context.copy.runStartLog.title, context.copy.runStartLog.body);
      return true;
    }

    case "schedule/apply-preset": {
      const preset = findSchedulePreset(context.schedulePresets, command.presetId);
      return applySchedulePreset(rootState, preset, {
        fallbackActivityId: context.initialActivityId,
      });
    }

    case "schedule/clear":
      return clearPlanningSchedule(rootState, context.slotCount);

    case "schedule/set-slot":
      return setSelectedPlanningSlot(rootState, command.index, {
        slotCount: context.slotCount,
        fallbackActivityId: context.initialActivityId,
      });

    case "schedule/assign-activity":
      return assignPlanningActivity(rootState, command.activityId, {
        activityExists: context.activityExists,
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
