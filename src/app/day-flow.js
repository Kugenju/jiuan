(() => {
window.GAME_RUNTIME = window.GAME_RUNTIME || {};

const {
  findDayModifier,
  applyActivityToState,
  getActivitySpeaker,
  triggerRandomEventForTiming,
} = window.GAME_RUNTIME;
const RESOLVING_AUTOPLAY_DELAY = 0.6;

function createResolvingFlowState() {
  return {
    phase: "opening",
    slotIndex: 0,
    segmentIndex: 0,
    autoplay: false,
    autoplayDelay: RESOLVING_AUTOPLAY_DELAY,
    autoplayTimer: 0,
    storyTrail: [],
    justAppended: false,
  };
}

const createRandomEventRuntimeState =
  typeof window.GAME_RUNTIME.createRandomEventRuntimeState === "function"
    ? window.GAME_RUNTIME.createRandomEventRuntimeState
    : () => ({
        stage: "idle",
        pendingEvent: null,
        focusedChoiceIndex: 0,
        selectedChoiceId: null,
        resultText: null,
        rewardSummary: null,
        resolution: null,
        continuation: null,
      });

function getRandomEventRuntimeState(rootState) {
  if (!rootState.randomEventRuntime || typeof rootState.randomEventRuntime !== "object") {
    rootState.randomEventRuntime = createRandomEventRuntimeState();
  }
  return rootState.randomEventRuntime;
}

function isRandomEventActive(rootState) {
  const runtime = getRandomEventRuntimeState(rootState);
  return runtime.stage && runtime.stage !== "idle";
}

function getResolveRandomEventChoice(context) {
  if (typeof context?.resolveRandomEventChoice === "function") {
    return context.resolveRandomEventChoice;
  }
  return typeof window.GAME_RUNTIME.resolveRandomEventChoice === "function"
    ? window.GAME_RUNTIME.resolveRandomEventChoice
    : null;
}

function getResolvingSlotActivity(rootState, slotIndex, getActivity, fallbackActivityId) {
  return getActivity(rootState.schedule[slotIndex]) || getActivity(fallbackActivityId);
}

function pushResolvingStoryToState(rootState, entry) {
  rootState.currentStory = {
    title: entry.title,
    body: entry.body,
    speaker: entry.speaker,
  };
  if (rootState.mode !== "resolving") {
    return;
  }
  const flow = rootState.resolvingFlow;
  flow.storyTrail.push({ title: entry.title, body: entry.body, speaker: entry.speaker });
  flow.storyTrail = flow.storyTrail.slice(-32);
  flow.justAppended = true;
}

function resetResolvingStoryTrailOnState(rootState) {
  if (rootState.mode !== "resolving") {
    return;
  }
  rootState.resolvingFlow.storyTrail = [];
  rootState.resolvingFlow.justAppended = false;
}

function getResolvingSegmentsForSlot(rootState, slotIndex, context) {
  const activity = getResolvingSlotActivity(rootState, slotIndex, context.getActivity, context.fallbackActivityId);
  const rawSegments = Array.isArray(activity.storySegments) ? activity.storySegments : [];
  const segments = rawSegments.map((line) => String(line || "").trim()).filter(Boolean);
  return segments.length ? segments : [context.copy.dayFlowPlaceholder(context.slotNames[slotIndex], activity.name)];
}

function showResolvingLeadForSlot(rootState, slotIndex, context) {
  const activity = getResolvingSlotActivity(rootState, slotIndex, context.getActivity, context.fallbackActivityId);
  resetResolvingStoryTrailOnState(rootState);
  rootState.resolvingFlow.segmentIndex = 0;
  pushResolvingStoryToState(rootState, {
    title: context.copy.dayFlowLeadTitle(context.slotNames[slotIndex]),
    body: context.copy.dayFlowLead(context.slotNames[slotIndex], activity.name),
    speaker: context.uiText.speakers.schedule,
  });
}

function appendResolvingSegmentForSlot(rootState, slotIndex, context) {
  const flow = rootState.resolvingFlow;
  const activity = getResolvingSlotActivity(rootState, slotIndex, context.getActivity, context.fallbackActivityId);
  const segments = getResolvingSegmentsForSlot(rootState, slotIndex, context);
  if (flow.segmentIndex >= segments.length) {
    return false;
  }
  const index = flow.segmentIndex;
  pushResolvingStoryToState(rootState, {
    title: context.copy.dayFlowSegmentTitle(context.slotNames[slotIndex], index, segments.length),
    body: segments[index],
    speaker: getActivitySpeaker(activity, context.uiText),
  });
  flow.segmentIndex += 1;
  return true;
}

function resolveSlotForFlowState(rootState, slotIndex, context) {
  if (isRandomEventActive(rootState)) {
    return { ok: false, blockedByRandomEvent: true };
  }
  const activity = getResolvingSlotActivity(rootState, slotIndex, context.getActivity, context.fallbackActivityId);
  if (activity.kind === "task") {
    return context.beginTaskActivityForSlot(rootState, activity, slotIndex, {
      copy: context.copy,
      taskDefs: context.taskDefs,
      getActivity: context.getActivity,
    });
  }

  const previousTaskStory = rootState.tasks?.lastStory || null;
  const activityNotes = applyActivityToState(rootState, activity, slotIndex, {
    copy: context.copy,
    storyBeats: context.storyBeats,
    slotNames: context.slotNames,
    skillLabels: context.skillLabels,
    getMainFocusSkill: context.getMainFocusSkill,
    addLog: context.addLog,
    taskDefs: context.taskDefs,
    handleResolvedCourseTaskProgress: context.handleResolvedCourseTaskProgress,
  });
  const unlockedTaskStory =
    rootState.tasks?.lastStory && rootState.tasks.lastStory !== previousTaskStory
      ? structuredClone(rootState.tasks.lastStory)
      : null;

  const randomEvent = triggerRandomEventForTiming(rootState, slotIndex, activity, "after", {
    randomEvents: context.randomEvents,
    skillLabels: context.skillLabels,
    uiText: context.uiText,
    getMainFocusSkill: context.getMainFocusSkill,
    addLog: context.addLog,
  });

  const randomEventChoices = Array.isArray(randomEvent?.choices) ? randomEvent.choices : [];
  let skippedRandomEvent = false;
  if (randomEvent && randomEventChoices.length > 0) {
    const opened = openRandomEventPromptForFlowState(rootState, randomEvent, {
      slotIndex,
      activityNotes,
      activityId: activity?.id || null,
      activityName: activity?.name || null,
      activityKind: activity?.kind || null,
      unlockedTaskStory,
    });
    if (opened.ok) {
      if (rootState.resolvingFlow) {
        rootState.resolvingFlow.autoplayTimer = 0;
      }
      return { ok: true, interruptedByRandomEvent: true };
    }
  }
  if (randomEvent) {
    skippedRandomEvent = true;
  }

  const notes = [activityNotes].filter(Boolean).join(" ");
  context.pushTimeline(slotIndex, activity, notes);

  const detail = context.copy.dayFlowResult(context.slotNames[slotIndex], activity.name, notes);
  pushResolvingStoryToState(rootState, {
    title: detail.title,
    body: detail.body,
    speaker: getActivitySpeaker(activity, context.uiText),
  });
  if (unlockedTaskStory) {
    pushResolvingStoryToState(rootState, unlockedTaskStory);
  }
  rootState.resolvingIndex = slotIndex + 1;
  rootState.progress = rootState.resolvingIndex / context.slotNames.length;
  if (skippedRandomEvent) {
    return { ok: true, skippedRandomEvent: true };
  }
}

function resetRandomEventRuntimeState(rootState) {
  const runtime = getRandomEventRuntimeState(rootState);
  const fresh = createRandomEventRuntimeState();
  Object.keys(runtime).forEach((key) => {
    if (!(key in fresh)) {
      delete runtime[key];
    }
  });
  Object.assign(runtime, fresh);
  return runtime;
}

function openRandomEventPromptForFlowState(rootState, pendingEvent, continuation) {
  const runtime = getRandomEventRuntimeState(rootState);
  if (runtime.stage && runtime.stage !== "idle") {
    return { ok: false, reason: "already_active" };
  }

  runtime.stage = "prompt";
  runtime.pendingEvent = pendingEvent
    ? {
        id: pendingEvent.id,
        title: pendingEvent.title,
        body: pendingEvent.body,
        speaker: pendingEvent.speaker,
        slotIndex: pendingEvent.slotIndex,
        activityId: pendingEvent.activityId || null,
        activityKind: pendingEvent.activityKind || null,
        activityName: pendingEvent.activityName || null,
        choices: Array.isArray(pendingEvent.choices)
          ? pendingEvent.choices.map((choice) => ({ id: choice.id, label: choice.label }))
          : [],
        sourceEvent: pendingEvent.sourceEvent || null,
      }
    : null;
  runtime.focusedChoiceIndex = 0;
  runtime.selectedChoiceId = null;
  runtime.resultText = null;
  runtime.rewardSummary = null;
  runtime.resolution = null;
  runtime.continuation = continuation
    ? {
        slotIndex: continuation.slotIndex,
        activityNotes: continuation.activityNotes || null,
        activityId: continuation.activityId || null,
        activityName: continuation.activityName || null,
        activityKind: continuation.activityKind || null,
        unlockedTaskStory: continuation.unlockedTaskStory || null,
      }
    : null;
  return { ok: true };
}

function chooseRandomEventOptionForFlowState(rootState, choiceId, context) {
  const runtime = getRandomEventRuntimeState(rootState);
  if (runtime.stage !== "prompt" || !runtime.pendingEvent) {
    return { ok: false, reason: "not_prompt" };
  }
  const resolveChoice = getResolveRandomEventChoice(context);
  if (typeof resolveChoice !== "function") {
    return { ok: false, reason: "missing_resolver" };
  }

  const pendingEvent = runtime.pendingEvent;
  const activity =
    (typeof context.getActivity === "function"
      ? context.getActivity(runtime.continuation?.activityId || pendingEvent.activityId)
      : null);
  const resolution = resolveChoice(rootState, pendingEvent, choiceId, activity, {
    randomEvents: context.randomEvents,
    skillLabels: context.skillLabels,
    uiText: context.uiText,
    getMainFocusSkill: context.getMainFocusSkill,
    addLog: context.addLog,
  });

  if (!resolution?.ok) {
    return resolution || { ok: false, reason: "resolution_failed" };
  }

  runtime.stage = "result";
  runtime.selectedChoiceId = choiceId;
  runtime.resultText = resolution.notesText || "";
  runtime.rewardSummary = resolution.rewardSummary || null;
  runtime.resolution = resolution;
  if (Array.isArray(pendingEvent.choices)) {
    const choiceIndex = pendingEvent.choices.findIndex((choice) => choice.id === choiceId);
    if (choiceIndex >= 0) {
      runtime.focusedChoiceIndex = choiceIndex;
    }
  }

  return { ok: true, resolution };
}

function confirmRandomEventResultForFlowState(rootState, context) {
  const runtime = getRandomEventRuntimeState(rootState);
  if (runtime.stage !== "result") {
    return { ok: false, reason: "not_result" };
  }
  const continuation = runtime.continuation;
  const resolution = runtime.resolution;
  if (!continuation || !resolution?.ok) {
    return { ok: false, reason: "missing_context" };
  }

  const slotCount = Array.isArray(context.slotNames) ? context.slotNames.length : 0;
  const rawSlotIndex = Number.isInteger(continuation.slotIndex)
    ? continuation.slotIndex
    : Number.isInteger(runtime.pendingEvent?.slotIndex)
    ? runtime.pendingEvent.slotIndex
    : Number(rootState.resolvingFlow?.slotIndex || 0);
  const slotIndex = slotCount > 0 ? Math.max(0, Math.min(rawSlotIndex, slotCount - 1)) : 0;
  const activity =
    typeof context.getActivity === "function"
      ? context.getActivity(continuation.activityId || runtime.pendingEvent?.activityId)
      : null;
  const notes = [continuation.activityNotes, resolution.notesText].filter(Boolean).join(" ");

  if (typeof context.pushTimeline === "function") {
    context.pushTimeline(slotIndex, activity, notes);
  }

  const activityName =
    activity?.name || continuation.activityName || runtime.pendingEvent?.activityName || "";
  const detail = context.copy.dayFlowResult(context.slotNames[slotIndex], activityName, notes);
  pushResolvingStoryToState(rootState, {
    title: detail.title,
    body: detail.body,
    speaker: activity
      ? getActivitySpeaker(activity, context.uiText)
      : context.uiText?.speakers?.schedule || context.uiText?.speakers?.routine || null,
  });
  if (continuation.unlockedTaskStory) {
    pushResolvingStoryToState(rootState, continuation.unlockedTaskStory);
  }

  rootState.resolvingIndex = Math.max(Number(rootState.resolvingIndex || 0), slotIndex + 1);
  if (slotCount > 0) {
    rootState.progress = rootState.resolvingIndex / slotCount;
  }
  if (rootState.resolvingFlow) {
    rootState.resolvingFlow.autoplayTimer = 0;
  }

  resetRandomEventRuntimeState(rootState);
  return { ok: true };
}

function createEmptyTaskRuntimeState() {
  return {
    activeTaskId: null,
    pendingSlotIndex: null,
    mode: null,
    result: null,
    refining: null,
    debate: null,
  };
}

function resumeResolvingAfterTaskAttempt(rootState, entry, context = {}) {
  const slotCount = Math.max(1, Array.isArray(context.slotNames) ? context.slotNames.length : 0);
  const pendingSlotIndex = Number(rootState.taskRuntime?.pendingSlotIndex);
  const fallbackSlotIndex = Number(rootState.resolvingFlow?.slotIndex || 0);
  const slotIndex = Number.isInteger(pendingSlotIndex)
    ? Math.max(0, Math.min(pendingSlotIndex, slotCount - 1))
    : Math.max(0, Math.min(fallbackSlotIndex, slotCount - 1));

  if (!rootState.resolvingFlow || typeof rootState.resolvingFlow !== "object") {
    rootState.resolvingFlow = createResolvingFlowState();
  }

  rootState.mode = "resolving";
  rootState.scene = "resolving";
  rootState.progress = (slotIndex + 1) / slotCount;
  rootState.resolvingIndex = Math.max(Number(rootState.resolvingIndex || 0), slotIndex + 1);
  rootState.resolvingFlow.phase = "result";
  rootState.resolvingFlow.slotIndex = slotIndex;
  rootState.resolvingFlow.autoplay = false;
  rootState.resolvingFlow.autoplayTimer = 0;

  pushResolvingStoryToState(rootState, {
    title: entry.title,
    body: entry.body,
    speaker: entry.speaker || context.uiText?.speakers?.schedule,
  });

  if (typeof context.resetTaskRuntime === "function") {
    context.resetTaskRuntime(rootState);
  } else {
    rootState.taskRuntime = createEmptyTaskRuntimeState();
  }

  return slotIndex;
}

function startDayFlow(rootState, context) {
  if (!context.areAllScheduleSlotsFilled(rootState.schedule)) {
    rootState.currentStory = structuredClone(context.copy.incompleteSchedule);
    return { ok: false, reason: "incomplete_schedule" };
  }
  rootState.dayScheduleHistory = rootState.dayScheduleHistory || {};
  rootState.dayScheduleHistory[rootState.day] = rootState.schedule.slice();

  rootState.today = context.createTodayState();
  rootState.progress = 0;
  rootState.resolvingIndex = 0;
  rootState.phaseTimer = 0;
  rootState.mode = "resolving";
  rootState.scene = "resolving";
  rootState.resolvingFlow = createResolvingFlowState();
  rootState.dayModifier = findDayModifier(context.dayModifiers, rootState);

  if (rootState.dayModifier) {
    const modifierLog = context.copy.dayModifierLog(rootState.day, rootState.dayModifier);
    context.addLog(modifierLog.title, modifierLog.body);
  }

  const dayStart = context.copy.dayStart(rootState.day);
  pushResolvingStoryToState(rootState, {
    title: dayStart.title,
    body: context.copy.dayFlowOpening(rootState.day),
    speaker: dayStart.speaker,
  });
  return { ok: true };
}

function advanceResolvingFlowState(rootState, context) {
  if (rootState.mode !== "resolving") {
    return { transitioned: false };
  }
  if (isRandomEventActive(rootState)) {
    if (rootState.resolvingFlow) {
      rootState.resolvingFlow.autoplayTimer = 0;
    }
    return { transitioned: false, blockedByRandomEvent: true };
  }

  const flow = rootState.resolvingFlow;
  flow.autoplayTimer = 0;

  if (flow.phase === "opening") {
    flow.phase = "lead";
    showResolvingLeadForSlot(rootState, flow.slotIndex, context);
    return { transitioned: true };
  }

  if (flow.phase === "lead") {
    if (appendResolvingSegmentForSlot(rootState, flow.slotIndex, context)) {
      flow.phase = "story";
      return { transitioned: true };
    }
    resolveSlotForFlowState(rootState, flow.slotIndex, context);
    flow.phase = "result";
    return { transitioned: true };
  }

  if (flow.phase === "story") {
    if (appendResolvingSegmentForSlot(rootState, flow.slotIndex, context)) {
      return { transitioned: true };
    }
    resolveSlotForFlowState(rootState, flow.slotIndex, context);
    flow.phase = "result";
    return { transitioned: true };
  }

  if (flow.phase === "result") {
    if (flow.slotIndex >= context.slotNames.length - 1) {
      context.addLog(context.copy.dayEndLog.title, context.copy.dayEndLog.body);
      pushResolvingStoryToState(rootState, {
        title: context.copy.dayEndLog.title,
        body: context.copy.dayEndLog.body,
        speaker: context.uiText.speakers.schedule,
      });
      flow.phase = "ending";
      return { transitioned: true };
    }

    pushResolvingStoryToState(rootState, {
      title: context.copy.dayFlowOutroTitle(context.slotNames[flow.slotIndex]),
      body: context.copy.dayFlowOutro(context.slotNames[flow.slotIndex]),
      speaker: context.uiText.speakers.schedule,
    });
    flow.phase = "outro";
    return { transitioned: true };
  }

  if (flow.phase === "outro") {
    flow.slotIndex += 1;
    flow.phase = "lead";
    showResolvingLeadForSlot(rootState, flow.slotIndex, context);
    return { transitioned: true };
  }

  if (flow.phase === "ending") {
    context.enterMemoryPhase();
    return { transitioned: true, enteredMemory: true };
  }

  return { transitioned: false };
}

function toggleResolvingAutoplayOnState(rootState, force) {
  if (rootState.mode !== "resolving") {
    return false;
  }
  if (isRandomEventActive(rootState)) {
    rootState.resolvingFlow.autoplay = false;
    rootState.resolvingFlow.autoplayTimer = 0;
    return false;
  }
  rootState.resolvingFlow.autoplay = typeof force === "boolean" ? force : !rootState.resolvingFlow.autoplay;
  rootState.resolvingFlow.autoplayTimer = 0;
  return true;
}

Object.assign(window.GAME_RUNTIME, {
  createResolvingFlowState,
  createRandomEventRuntimeState,
  getResolvingSlotActivity,
  pushResolvingStoryToState,
  resetResolvingStoryTrailOnState,
  getResolvingSegmentsForSlot,
  showResolvingLeadForSlot,
  appendResolvingSegmentForSlot,
  resolveSlotForFlowState,
  openRandomEventPromptForFlowState,
  chooseRandomEventOptionForFlowState,
  confirmRandomEventResultForFlowState,
  resumeResolvingAfterTaskAttempt,
  startDayFlow,
  advanceResolvingFlowState,
  toggleResolvingAutoplayOnState,
});
})();
