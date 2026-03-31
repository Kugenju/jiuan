(() => {
window.GAME_RUNTIME = window.GAME_RUNTIME || {};

const {
  findDayModifier,
  applyActivityToState,
  getActivitySpeaker,
  triggerRandomEventForTiming,
} = window.GAME_RUNTIME;

function createResolvingFlowState() {
  return {
    phase: "opening",
    slotIndex: 0,
    segmentIndex: 0,
    autoplay: false,
    autoplayDelay: 1.05,
    autoplayTimer: 0,
    storyTrail: [],
    justAppended: false,
  };
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

  if (randomEvent?.story) {
    pushResolvingStoryToState(rootState, randomEvent.story);
  }

  const notes = [activityNotes, randomEvent?.notesText].filter(Boolean).join(" ");
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
}

function createEmptyTaskRuntimeState() {
  return {
    activeTaskId: null,
    pendingSlotIndex: null,
    mode: null,
    result: null,
    refining: null,
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
  rootState.resolvingFlow.autoplay = typeof force === "boolean" ? force : !rootState.resolvingFlow.autoplay;
  rootState.resolvingFlow.autoplayTimer = 0;
  return true;
}

Object.assign(window.GAME_RUNTIME, {
  createResolvingFlowState,
  getResolvingSlotActivity,
  pushResolvingStoryToState,
  resetResolvingStoryTrailOnState,
  getResolvingSegmentsForSlot,
  showResolvingLeadForSlot,
  appendResolvingSegmentForSlot,
  resolveSlotForFlowState,
  resumeResolvingAfterTaskAttempt,
  startDayFlow,
  advanceResolvingFlowState,
  toggleResolvingAutoplayOnState,
});
})();
