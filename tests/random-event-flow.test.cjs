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

function createBaseState() {
  return {
    mode: "resolving",
    scene: "resolving",
    day: 1,
    week: 1,
    schedule: ["study"],
    progress: 0,
    resolvingIndex: 0,
    currentStory: null,
    resources: {},
    stats: {},
    skills: {},
    relationships: {},
    today: {
      tones: {},
      kinds: {},
      latestCourseSkill: null,
      randomEvents: [],
    },
    resolvingFlow: {
      phase: "story",
      slotIndex: 0,
      segmentIndex: 0,
      autoplay: true,
      autoplayDelay: 1.05,
      autoplayTimer: 0,
      storyTrail: [],
      justAppended: false,
    },
    tasks: {
      active: [],
      weeklyProgress: { craftCompleted: 0, craftTotal: 0 },
      completedMarks: [],
      lastStory: null,
    },
    randomEventRuntime: {
      stage: "idle",
      pendingEvent: null,
      focusedChoiceIndex: 0,
      selectedChoiceId: null,
      resultText: null,
      rewardSummary: null,
      resolution: null,
      continuation: null,
    },
  };
}

test("resolveSlotForFlowState opens a random-event prompt and defers slot completion", () => {
  const calls = {
    pushTimeline: 0,
  };
  const pendingEvent = {
    id: "event-1",
    title: "A strange note",
    body: "You find a note.",
    speaker: "mystery",
    slotIndex: 0,
    activityId: "study",
    activityKind: "course",
    activityName: "Study",
    choices: [
      { id: "accept", label: "Accept" },
      { id: "ignore", label: "Ignore" },
    ],
    sourceEvent: {
      id: "event-1",
      title: "A strange note",
      choices: [
        { id: "accept", label: "Accept", note: "note accepted", effect: { resources: { insight: 1 } } },
        { id: "ignore", label: "Ignore", note: "ignored" },
      ],
    },
  };
  const runtime = {
    applyActivityToState: (rootState) => {
      rootState.tasks.lastStory = { title: "unlock", body: "unlocked", speaker: "mentor" };
      return "activity notes";
    },
    getActivitySpeaker: () => "schedule",
    triggerRandomEventForTiming: () => pendingEvent,
  };
  const windowObject = loadScripts(["src/app/day-flow.js"], { runtime });
  const { resolveSlotForFlowState, advanceResolvingFlowState } = windowObject.GAME_RUNTIME;
  const rootState = createBaseState();
  const context = {
    slotNames: ["morning"],
    uiText: { speakers: { schedule: "schedule" } },
    copy: {
      dayFlowResult: () => ({ title: "result", body: "body" }),
    },
    storyBeats: [],
    skillLabels: {},
    getMainFocusSkill: () => "craft",
    addLog: () => {},
    pushTimeline: () => {
      calls.pushTimeline += 1;
    },
    randomEvents: [],
    getActivity: () => ({ id: "study", kind: "course", name: "Study", storySegments: [] }),
    fallbackActivityId: "homework",
  };

  const result = resolveSlotForFlowState(rootState, 0, context);

  assert.equal(result?.interruptedByRandomEvent, true);
  assert.equal(rootState.resolvingIndex, 0);
  assert.equal(rootState.progress, 0);
  assert.equal(calls.pushTimeline, 0);
  assert.equal(rootState.randomEventRuntime.stage, "prompt");
  assert.equal(rootState.randomEventRuntime.pendingEvent?.id, "event-1");
  assert.equal(rootState.randomEventRuntime.continuation?.slotIndex, 0);
  assert.equal(rootState.randomEventRuntime.continuation?.activity, undefined);
  assert.equal(rootState.randomEventRuntime.continuation?.activityId, "study");
  assert.equal(rootState.resolvingFlow.autoplay, true);

  const blocked = advanceResolvingFlowState(rootState, context);
  assert.equal(blocked?.blockedByRandomEvent, true);
  assert.equal(rootState.resolvingFlow.autoplay, true);
});

test("resolveSlotForFlowState ignores random events without choices", () => {
  const calls = {
    pushTimeline: 0,
  };
  const pendingEvent = {
    id: "event-2",
    title: "Silent moment",
    body: "No choices here.",
    speaker: "mystery",
    slotIndex: 0,
    activityId: "study",
    activityKind: "course",
    activityName: "Study",
    choices: [],
    sourceEvent: { id: "event-2", title: "Silent moment", choices: [] },
  };
  const runtime = {
    applyActivityToState: () => "activity notes",
    getActivitySpeaker: () => "schedule",
    triggerRandomEventForTiming: () => pendingEvent,
  };
  const windowObject = loadScripts(["src/app/day-flow.js"], { runtime });
  const { resolveSlotForFlowState } = windowObject.GAME_RUNTIME;
  const rootState = createBaseState();
  const context = {
    slotNames: ["morning"],
    uiText: { speakers: { schedule: "schedule" } },
    copy: {
      dayFlowResult: (_slot, _activity, notes) => ({ title: "result", body: notes }),
    },
    storyBeats: [],
    skillLabels: {},
    getMainFocusSkill: () => "craft",
    addLog: () => {},
    pushTimeline: () => {
      calls.pushTimeline += 1;
    },
    randomEvents: [],
    getActivity: () => ({ id: "study", kind: "course", name: "Study", storySegments: [] }),
    fallbackActivityId: "homework",
  };

  const result = resolveSlotForFlowState(rootState, 0, context);

  assert.equal(result?.skippedRandomEvent, true);
  assert.equal(calls.pushTimeline, 1);
  assert.equal(rootState.randomEventRuntime.stage, "idle");
  assert.equal(rootState.resolvingIndex, 1);
  assert.equal(rootState.progress, 1);
});

test("chooseRandomEventOptionForFlowState moves prompt to result without resuming flow", () => {
  const calls = {
    pushTimeline: 0,
    applyEffect: 0,
  };
  const runtime = {
    applyEffectBundleToRoot: () => {
      calls.applyEffect += 1;
    },
    normalizePlayerState: () => {},
    applyActivityToState: () => "activity notes",
    getActivitySpeaker: () => "schedule",
    triggerRandomEventForTiming: () => null,
  };
  const windowObject = loadScripts(["src/domain/random-event.js", "src/app/day-flow.js"], { runtime });
  const { chooseRandomEventOptionForFlowState } = windowObject.GAME_RUNTIME;
  const rootState = createBaseState();
  rootState.randomEventRuntime.stage = "prompt";
  rootState.randomEventRuntime.pendingEvent = {
    id: "event-1",
    title: "A strange note",
    body: "You find a note.",
    speaker: "mystery",
    slotIndex: 0,
    activityId: "study",
    activityKind: "course",
    activityName: "Study",
    choices: [
      { id: "accept", label: "Accept" },
      { id: "ignore", label: "Ignore" },
    ],
    sourceEvent: {
      id: "event-1",
      title: "A strange note",
      choices: [
        { id: "accept", label: "Accept", note: "note accepted", effect: { resources: { insight: 1 } } },
        { id: "ignore", label: "Ignore", note: "ignored" },
      ],
    },
  };
  rootState.randomEventRuntime.continuation = {
    slotIndex: 0,
    activityNotes: "activity notes",
    activityId: "study",
    activityKind: "course",
    activityName: "Study",
  };
  const context = {
    slotNames: ["morning"],
    uiText: { speakers: { schedule: "schedule" } },
    copy: {
      dayFlowResult: () => ({ title: "result", body: "body" }),
    },
    storyBeats: [],
    skillLabels: {},
    getMainFocusSkill: () => "craft",
    addLog: () => {},
    pushTimeline: () => {
      calls.pushTimeline += 1;
    },
    randomEvents: [],
    getActivity: () => ({ id: "study", kind: "course", name: "Study", storySegments: [] }),
    fallbackActivityId: "homework",
  };

  const result = chooseRandomEventOptionForFlowState(rootState, "accept", context);

  assert.equal(result?.ok, true);
  assert.equal(rootState.randomEventRuntime.stage, "result");
  assert.equal(rootState.randomEventRuntime.selectedChoiceId, "accept");
  assert.equal(rootState.randomEventRuntime.resultText, "note accepted");
  assert.equal(rootState.resolvingIndex, 0);
  assert.equal(rootState.progress, 0);
  assert.equal(calls.pushTimeline, 0);
  assert.ok(calls.applyEffect > 0);
});

test("chooseRandomEventOptionForFlowState uses context override for resolution", () => {
  const runtime = {
    applyActivityToState: () => "activity notes",
    getActivitySpeaker: () => "schedule",
    triggerRandomEventForTiming: () => null,
  };
  const windowObject = loadScripts(["src/app/day-flow.js"], { runtime });
  const { chooseRandomEventOptionForFlowState } = windowObject.GAME_RUNTIME;
  const rootState = createBaseState();
  rootState.randomEventRuntime.stage = "prompt";
  rootState.randomEventRuntime.pendingEvent = {
    id: "event-override",
    title: "Override Event",
    body: "Use override.",
    speaker: "mystery",
    slotIndex: 0,
    activityId: "study",
    activityKind: "course",
    activityName: "Study",
    choices: [{ id: "accept", label: "Accept" }],
    sourceEvent: { id: "event-override", title: "Override Event", choices: [{ id: "accept", label: "Accept" }] },
  };
  rootState.randomEventRuntime.continuation = {
    slotIndex: 0,
    activityNotes: "activity notes",
    activityId: "study",
    activityKind: "course",
    activityName: "Study",
  };
  const context = {
    slotNames: ["morning"],
    uiText: { speakers: { schedule: "schedule" } },
    copy: {
      dayFlowResult: () => ({ title: "result", body: "body" }),
    },
    storyBeats: [],
    skillLabels: {},
    getMainFocusSkill: () => "craft",
    addLog: () => {},
    pushTimeline: () => {},
    randomEvents: [],
    getActivity: () => ({ id: "study", kind: "course", name: "Study", storySegments: [] }),
    fallbackActivityId: "homework",
    resolveRandomEventChoice: () => ({ ok: true, notesText: "override note", rewardSummary: "bonus reward" }),
  };

  const result = chooseRandomEventOptionForFlowState(rootState, "accept", context);

  assert.equal(result?.ok, true);
  assert.equal(rootState.randomEventRuntime.stage, "result");
  assert.equal(rootState.randomEventRuntime.resultText, "override note");
  assert.equal(rootState.randomEventRuntime.rewardSummary, "bonus reward");
});

test("confirmRandomEventResultForFlowState finalizes slot once and resumes resolving", () => {
  const calls = {
    pushTimeline: 0,
  };
  let receivedNotes = null;
  const runtime = {
    applyEffectBundleToRoot: () => {},
    normalizePlayerState: () => {},
    applyActivityToState: () => "activity notes",
    getActivitySpeaker: () => "schedule",
    triggerRandomEventForTiming: () => null,
  };
  const windowObject = loadScripts(["src/domain/random-event.js", "src/app/day-flow.js"], { runtime });
  const { confirmRandomEventResultForFlowState } = windowObject.GAME_RUNTIME;
  const rootState = createBaseState();
  rootState.randomEventRuntime.stage = "result";
  rootState.randomEventRuntime.pendingEvent = {
    id: "event-1",
    title: "A strange note",
    body: "You find a note.",
    speaker: "mystery",
    slotIndex: 0,
    activityId: "study",
    activityKind: "course",
    activityName: "Study",
    choices: [
      { id: "accept", label: "Accept" },
      { id: "ignore", label: "Ignore" },
    ],
    sourceEvent: {
      id: "event-1",
      title: "A strange note",
      choices: [
        { id: "accept", label: "Accept", note: "note accepted", effect: { resources: { insight: 1 } } },
        { id: "ignore", label: "Ignore", note: "ignored" },
      ],
    },
  };
  rootState.randomEventRuntime.selectedChoiceId = "accept";
  rootState.randomEventRuntime.resultText = "note accepted";
  rootState.randomEventRuntime.rewardSummary = null;
  rootState.randomEventRuntime.resolution = {
    ok: true,
    eventId: "event-1",
    choiceId: "accept",
    notesText: "note accepted",
  };
  rootState.randomEventRuntime.continuation = {
    slotIndex: 0,
    activityNotes: "activity notes",
    activityId: "study",
    activityKind: "course",
    activityName: "Study",
    unlockedTaskStory: { title: "unlock", body: "unlocked", speaker: "mentor" },
  };
  const context = {
    slotNames: ["morning"],
    uiText: { speakers: { schedule: "schedule" } },
    copy: {
      dayFlowResult: (_slot, _activity, notes) => {
        receivedNotes = notes;
        return { title: "result", body: notes };
      },
      dayFlowOutroTitle: () => "outro",
      dayFlowOutro: () => "outro body",
      dayEndLog: { title: "day end", body: "end" },
    },
    storyBeats: [],
    skillLabels: {},
    getMainFocusSkill: () => "craft",
    addLog: () => {},
    pushTimeline: () => {
      calls.pushTimeline += 1;
    },
    randomEvents: [],
    getActivity: () => ({ id: "study", kind: "course", name: "Study", storySegments: [] }),
    fallbackActivityId: "homework",
  };

  const result = confirmRandomEventResultForFlowState(rootState, context);

  assert.equal(result?.ok, true);
  assert.equal(rootState.resolvingIndex, 1);
  assert.equal(rootState.progress, 1);
  assert.equal(receivedNotes, "activity notes note accepted");
  assert.equal(calls.pushTimeline, 1);
  assert.equal(rootState.resolvingFlow.storyTrail.length, 2);
  assert.equal(rootState.resolvingFlow.storyTrail[0].title, "result");
  assert.equal(rootState.resolvingFlow.storyTrail[1].title, "unlock");
  assert.equal(rootState.resolvingFlow.autoplay, true);
  assert.equal(rootState.randomEventRuntime.stage, "idle");
  assert.equal(rootState.randomEventRuntime.pendingEvent, null);

  const second = confirmRandomEventResultForFlowState(rootState, context);
  assert.equal(second?.ok, false);
  assert.equal(calls.pushTimeline, 1);
});
