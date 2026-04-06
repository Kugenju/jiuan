# Random Event Choice Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace auto-resolving random events with an interrupting centered modal that shows event prompt choices first, then branch-specific result text ending with the granted rewards, and only resumes day flow after confirmation.

**Architecture:** Keep random events inside the existing day-flow pipeline, but split them into two explicit stages backed by a dedicated runtime state object: `prompt` and `result`. Let `src/domain/random-event.js` own reward-template expansion and branch resolution, let `src/app/day-flow.js` own pause/resume orchestration, and let the modal reuse the current `#info-modal` / `#overlay-backdrop` shell through a small dedicated HTML renderer.

**Tech Stack:** Plain JavaScript, existing browser runtime, plain CSS, Node.js `node:test`

---

## File Structure And Responsibilities

- `data/events.js` (modify): convert each random event from one auto-applied effect into a prompt body plus 2-3 player choices with reusable reward templates or special-case effects.
- `src/domain/random-event.js` (modify): keep event matching, but change trigger output from “apply immediately” to “build pending payload”; add choice resolution, reward-template expansion, reward summary formatting, and malformed-config safety.
- `src/app/session.js` (modify): add/reset dedicated random-event runtime state on the root session object.
- `src/app/day-flow.js` (modify): pause resolving flow when an event triggers, store deferred continuation context, handle prompt -> result -> resume transitions, and prevent double application.
- `src/app/random-event-view.js` (create): render prompt/result modal HTML so `main.js` does not absorb another large string template.
- `src/app/keyboard-controls.js` (modify): route arrow/confirm keys to the blocking random-event modal before normal resolving controls.
- `data/ui.js` (modify): centralize modal copy for badge, result label, choice hint, continue button, and reward prefix.
- `index.html` (modify): load the new random-event modal renderer before `main.js`.
- `main.js` (modify): wire the new runtime exports, render the modal through the existing overlay shell, bind modal buttons, block backdrop dismiss, and keep autoplay frozen while the modal is active.
- `styles.css` (modify): style the event modal and choice buttons so the new interaction matches the classical light-paper theme.
- `tests/random-event-domain.test.cjs` (create): verify pending-event generation, template rewards, special-case effects, and reward summary strings.
- `tests/random-event-flow.test.cjs` (create): verify prompt/result/resume state transitions in day flow.
- `tests/random-event-view.test.cjs` (create): verify modal HTML and keyboard routing for the blocking event flow.
- `tests/classical-css-theme.test.cjs` (modify): lock in the new modal shell / choice-state CSS contract.
- `docs/superpowers/specs/2026-04-06-random-event-choice-modal-design.md` (reference only): approved interaction and scope source of truth.

### Task 1: Convert Random Event Data And Domain Resolution To Branch Choices

**Files:**
- Create: `tests/random-event-domain.test.cjs`
- Modify: `data/events.js`
- Modify: `src/domain/random-event.js`
- Test: `tests/random-event-domain.test.cjs`

- [ ] **Step 1: Write the failing domain tests**

```js
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

test("triggerRandomEventForTiming returns a pending prompt payload without applying rewards immediately", () => {
  let applied = false;
  const windowObject = loadScripts(["src/domain/random-event.js"], {
    runtime: {
      applyEffectBundleToRoot: () => {
        applied = true;
      },
      normalizePlayerState: () => {},
    },
  });
  const { triggerRandomEventForTiming } = windowObject.GAME_RUNTIME;
  const rootState = {
    day: 2,
    stats: { fatigue: 1, memory: 0 },
    skills: { craft: 2, dao: 1 },
    resources: { insight: 0, spirit: 0, coins: 0 },
    relationships: { friend: 0 },
    today: {
      randomEvents: [],
      kinds: { course: 1, assignment: 0, routine: 0 },
      latestCourseSkill: "craft",
    },
    rng: () => 0,
  };
  const activity = { id: "cafeteria", kind: "routine", name: "食堂" };
  const pending = triggerRandomEventForTiming(rootState, 1, activity, "after", {
    randomEvents: [
      {
        id: "cafeteria_rumor",
        title: "食堂风声",
        body: "邻桌压低嗓音谈起院内近况。",
        speakerKey: "routine",
        timing: "after",
        chance: 1,
        oncePerDay: true,
        condition: { activityIds: ["cafeteria"], minDay: 2 },
        choices: [
          {
            id: "listen",
            label: "侧耳细听",
            resultText: "你记下了几句最关键的词。",
            rewardTemplate: "resource_insight_small",
          },
        ],
      },
    ],
    uiText: { speakers: { routine: "日程系统" } },
    skillLabels: { craft: "炼器", dao: "道法" },
    getMainFocusSkill: () => "craft",
    addLog: () => {},
  });

  assert.equal(applied, false);
  assert.equal(rootState.resources.insight, 0);
  assert.equal(rootState.today.randomEvents.length, 0);
  assert.deepEqual(realmSafe(pending), {
    id: "cafeteria_rumor",
    title: "食堂风声",
    body: "邻桌压低嗓音谈起院内近况。",
    speaker: "日程系统",
    slotIndex: 1,
    activityId: "cafeteria",
    choices: [{ id: "listen", label: "侧耳细听" }],
  });
});

test("resolveRandomEventChoice applies template rewards and appends the final reward summary", () => {
  const windowObject = loadScripts(["src/domain/random-event.js"], {
    runtime: {
      applyEffectBundleToRoot: (rootState, effect) => {
        rootState.resources.insight += effect.resources?.insight || 0;
        rootState.relationships.friend += effect.relationships?.friend || 0;
      },
      normalizePlayerState: () => {},
    },
  });
  const { resolveRandomEventChoice } = windowObject.GAME_RUNTIME;
  const rootState = {
    resources: { insight: 0, spirit: 0, coins: 0 },
    relationships: { friend: 0 },
    skills: { craft: 0 },
    today: { randomEvents: [], latestCourseSkill: "craft" },
  };
  const pendingEvent = {
    id: "cafeteria_rumor",
    title: "食堂风声",
    body: "邻桌压低嗓音谈起院内近况。",
    speaker: "日程系统",
    slotIndex: 1,
    activityId: "cafeteria",
    sourceEvent: {
      id: "cafeteria_rumor",
      title: "食堂风声",
      choices: [
        {
          id: "listen",
          label: "侧耳细听",
          resultText: "你把零散消息串成了一条线。",
          rewardTemplate: "resource_insight_small",
        },
      ],
    },
  };

  const outcome = resolveRandomEventChoice(rootState, pendingEvent, "listen", {
    id: "cafeteria",
    kind: "routine",
    name: "食堂",
  }, {
    skillLabels: { craft: "炼器" },
    getMainFocusSkill: () => "craft",
    addLog: () => {},
  });

  assert.equal(rootState.resources.insight, 1);
  assert.deepEqual(realmSafe(rootState.today.randomEvents), [
    { id: "cafeteria_rumor", slotIndex: 1, activityId: "cafeteria", choiceId: "listen" },
  ]);
  assert.equal(outcome.rewardSummary, "奖励：悟道点+1");
  assert.match(outcome.story.body, /你把零散消息串成了一条线。/);
  assert.match(outcome.story.body, /奖励：悟道点\+1/);
});

test("resolveRandomEventChoice supports special-case custom effects and dynamic skill bonus text", () => {
  const windowObject = loadScripts(["src/domain/random-event.js"], {
    runtime: {
      applyEffectBundleToRoot: (rootState, effect) => {
        rootState.stats.memory += effect.stats?.memory || 0;
      },
      normalizePlayerState: () => {},
    },
  });
  const { resolveRandomEventChoice } = windowObject.GAME_RUNTIME;
  const rootState = {
    stats: { memory: 0 },
    resources: { insight: 0, spirit: 0, coins: 0 },
    relationships: { friend: 0 },
    skills: { craft: 1, dao: 0 },
    today: { randomEvents: [], latestCourseSkill: "craft" },
  };

  const outcome = resolveRandomEventChoice(rootState, {
    id: "assignment_breakthrough",
    title: "题解顿悟",
    speaker: "课程系统",
    slotIndex: 2,
    activityId: "homework",
    sourceEvent: {
      id: "assignment_breakthrough",
      title: "题解顿悟",
      choices: [
        {
          id: "follow-trace",
          label: "顺着灵光追下去",
          resultText: "你把散开的线索一口气接了起来。",
          effect: { stats: { memory: 1 } },
          effectSummary: ["记忆+1"],
          skillBonus: {
            source: "latestCourseSkill",
            fallbackSource: "mainFocusSkill",
            amount: 1,
            noteTemplate: "{skill}+{amount}",
          },
        },
      ],
    },
  }, "follow-trace", {
    id: "homework",
    kind: "assignment",
    name: "作业",
  }, {
    skillLabels: { craft: "炼器" },
    getMainFocusSkill: () => "craft",
    addLog: () => {},
  });

  assert.equal(rootState.stats.memory, 1);
  assert.equal(rootState.skills.craft, 2);
  assert.equal(outcome.rewardSummary, "奖励：记忆+1，炼器+1");
});
```

- [ ] **Step 2: Run the focused domain test to verify it fails**

Run: `node --test tests/random-event-domain.test.cjs`  
Expected: FAIL because `triggerRandomEventForTiming` still mutates state immediately and `resolveRandomEventChoice` does not exist yet.

- [ ] **Step 3: Convert `data/events.js` and `src/domain/random-event.js` to the branchable model**

```js
// data/events.js
const RANDOM_EVENTS = [
  {
    id: "course_followup",
    title: "课后加讲",
    body: "散课前，先生忽然补了一段延伸讲解，正好把你先前卡住的地方接上。",
    speakerKey: "course",
    timing: "after",
    chance: 0.3,
    oncePerDay: false,
    condition: {
      activityKinds: ["course"],
      maxStats: { fatigue: 5 },
    },
    choices: [
      {
        id: "copy-core-points",
        label: "记下关键脉络",
        resultText: "你把先生临时点出的关键脉络誊清，回去后还能顺着继续推演。",
        rewardTemplate: "resource_insight_small",
      },
      {
        id: "ask-one-more-question",
        label: "追问一句",
        resultText: "你趁人散去之前追问了一句，连带把同窗之间的讨论也接了上来。",
        rewardTemplate: "resource_insight_friend_small",
      },
    ],
  },
  {
    id: "cafeteria_rumor",
    title: "食堂风声",
    body: "邻桌压低嗓音谈起院内近况，你隐约听见了几个和自己有关的关键词。",
    speakerKey: "routine",
    timing: "after",
    chance: 0.45,
    oncePerDay: true,
    condition: {
      activityIds: ["cafeteria"],
      minDay: 2,
    },
    choices: [
      {
        id: "listen",
        label: "侧耳细听",
        resultText: "你不动声色地把最关键的几句记在心里，回头越想越有门道。",
        rewardTemplate: "resource_insight_small",
      },
      {
        id: "join-chat",
        label: "顺势搭话",
        resultText: "你接过话头，既探到消息，也和同桌熟络了几分。",
        rewardTemplate: "resource_insight_friend_small",
      },
    ],
  },
  {
    id: "assignment_breakthrough",
    title: "题解顿悟",
    body: "纸页翻到一半时，你忽然意识到几条分散的思路其实能拼成同一个答案。",
    speakerKey: "assignment",
    timing: "after",
    chance: 0.4,
    oncePerDay: false,
    condition: {
      activityKinds: ["assignment"],
      minKinds: { course: 1 },
    },
    choices: [
      {
        id: "follow-trace",
        label: "顺着灵光追下去",
        resultText: "你把散开的线索一口气接了起来，题路一下开阔起来。",
        effect: { stats: { memory: 1 } },
        effectSummary: ["记忆+1"],
        skillBonus: {
          source: "latestCourseSkill",
          fallbackSource: "mainFocusSkill",
          amount: 1,
          noteTemplate: "{skill}+{amount}",
          fallbackNote: "悟性虽未落到具体学科上，但这次顿悟依旧让你的记忆更稳了一层。",
        },
      },
      {
        id: "rewrite-clean",
        label: "重新誊清推导",
        resultText: "你没有贪快，而是把整道推导重新梳理了一遍，记忆也跟着扎实下来。",
        rewardTemplate: "stat_memory_small",
      },
    ],
  },
];
```

```js
// src/domain/random-event.js
const RANDOM_EVENT_REWARD_TEMPLATES = {
  resource_insight_small: {
    effect: { resources: { insight: 1 } },
    effectSummary: ["悟道点+1"],
  },
  relationship_friend_small: {
    effect: { relationships: { friend: 1 } },
    effectSummary: ["好友关系+1"],
  },
  resource_insight_friend_small: {
    effect: {
      resources: { insight: 1 },
      relationships: { friend: 1 },
    },
    effectSummary: ["悟道点+1", "好友关系+1"],
  },
  stat_memory_small: {
    effect: { stats: { memory: 1 } },
    effectSummary: ["记忆+1"],
  },
};

function cloneEffectBundle(bundle = {}) {
  return structuredClone({
    resources: { ...(bundle.resources || {}) },
    stats: { ...(bundle.stats || {}) },
    skills: { ...(bundle.skills || {}) },
    relationships: { ...(bundle.relationships || {}) },
  });
}

function createPendingRandomEvent(event, activity, slotIndex, context) {
  return {
    id: event.id,
    title: event.title,
    body: event.body || event.story?.body || "",
    speaker:
      context.uiText.speakers[event.speakerKey] ||
      context.uiText.speakers.assignment ||
      context.uiText.speakers.course ||
      context.uiText.speakers.routine,
    slotIndex,
    activityId: activity.id,
    choices: (event.choices || []).map((choice) => ({
      id: choice.id,
      label: choice.label,
    })),
    sourceEvent: structuredClone(event),
  };
}

function buildRewardPayload(choice) {
  if (choice.rewardTemplate) {
    const template = RANDOM_EVENT_REWARD_TEMPLATES[choice.rewardTemplate];
    if (!template) {
      return { ok: false, error: "unknown_reward_template" };
    }
    return {
      ok: true,
      effect: cloneEffectBundle(template.effect),
      effectSummary: [...template.effectSummary],
    };
  }

  return {
    ok: true,
    effect: cloneEffectBundle(choice.effect),
    effectSummary: [...(choice.effectSummary || [])],
  };
}

function resolveRandomEventChoice(rootState, pendingEvent, choiceId, activity, context) {
  const choice = pendingEvent?.sourceEvent?.choices?.find((entry) => entry.id === choiceId);
  if (!choice) {
    return { ok: false, error: "unknown_choice" };
  }

  const rewardPayload = buildRewardPayload(choice);
  if (!rewardPayload.ok) {
    return rewardPayload;
  }

  applyEffectBundleToRoot(rootState, rewardPayload.effect);
  const rewardParts = [...rewardPayload.effectSummary];

  if (choice.skillBonus) {
    const skill = resolveRandomEventSkill(rootState, activity, { skillBonus: choice.skillBonus }, context);
    if (skill) {
      rootState.skills[skill] += choice.skillBonus.amount;
      rewardParts.push(
        choice.skillBonus.noteTemplate
          .replace("{skill}", context.skillLabels[skill])
          .replace("{amount}", String(choice.skillBonus.amount))
      );
    } else if (choice.skillBonus.fallbackNote) {
      rewardParts.push(choice.skillBonus.fallbackNote);
    }
  }

  rootState.today.randomEvents.push({
    id: pendingEvent.id,
    slotIndex: pendingEvent.slotIndex,
    activityId: pendingEvent.activityId,
    choiceId,
  });

  normalizePlayerState(rootState);

  const rewardSummary = `奖励：${rewardParts.join("，")}`;
  const story = {
    title: `随机事件 · ${pendingEvent.title}`,
    body: `${choice.resultText}\n${rewardSummary}`,
    speaker: pendingEvent.speaker,
  };

  context.addLog(`随机事件 · ${pendingEvent.title}`, `${choice.resultText} ${rewardSummary}`);

  return {
    ok: true,
    choiceId,
    resultText: choice.resultText,
    rewardSummary,
    notesText: `${choice.resultText} ${rewardSummary}`,
    story,
  };
}

function triggerRandomEventForTiming(rootState, slotIndex, activity, timing, context) {
  const events = context.randomEvents || [];
  const matching = events.filter(
    (event) => (event.timing || "after") === timing && randomEventMatchesState(rootState, event, activity, slotIndex)
  );

  for (const event of matching) {
    const chance = typeof event.chance === "number" ? event.chance : 1;
    if (rootState.rng() > chance) {
      continue;
    }
    return createPendingRandomEvent(event, activity, slotIndex, context);
  }

  return null;
}

Object.assign(window.GAME_RUNTIME, {
  randomEventMatchesState,
  triggerRandomEventForTiming,
  resolveRandomEventChoice,
});
```

- [ ] **Step 4: Run the focused domain test again**

Run: `node --test tests/random-event-domain.test.cjs`  
Expected: PASS for pending-event behavior, template rewards, and custom-effect branch resolution.

- [ ] **Step 5: Commit**

```bash
git add data/events.js src/domain/random-event.js tests/random-event-domain.test.cjs
git commit -m "feat(events): add branchable random event resolution"
```

### Task 2: Pause Resolving Flow And Resume Only After Result Confirmation

**Files:**
- Create: `tests/random-event-flow.test.cjs`
- Modify: `src/app/session.js`
- Modify: `src/app/day-flow.js`
- Test: `tests/random-event-flow.test.cjs`

- [ ] **Step 1: Write the failing day-flow state-machine tests**

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const REPO_ROOT = path.resolve(__dirname, "..");

function loadScripts(files, { runtime = {} } = {}) {
  const context = {
    window: {
      GAME_DATA: {},
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

test("resolveSlotForFlowState opens the prompt modal and defers slot completion when a random event triggers", () => {
  const calls = { timeline: 0 };
  const windowObject = loadScripts(["src/app/day-flow.js"], {
    runtime: {
      findDayModifier: () => null,
      applyActivityToState: () => "课程收益",
      getActivitySpeaker: () => "课程系统",
      triggerRandomEventForTiming: () => ({
        id: "course_followup",
        title: "课后加讲",
        body: "先生忽然补讲。",
        speaker: "课程系统",
        slotIndex: 0,
        activityId: "alchemy_intro",
        choices: [
          { id: "copy-core-points", label: "记下关键脉络" },
          { id: "ask-one-more-question", label: "追问一句" },
        ],
      }),
    },
  });
  const { resolveSlotForFlowState } = windowObject.GAME_RUNTIME;
  const rootState = {
    mode: "resolving",
    scene: "resolving",
    schedule: ["alchemy_intro"],
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
      phase: "story",
      slotIndex: 0,
      segmentIndex: 0,
      autoplay: true,
      autoplayDelay: 1.05,
      autoplayTimer: 0.4,
      storyTrail: [],
      justAppended: false,
    },
    randomEvent: {
      stage: null,
      pendingEvent: null,
      focusedChoiceIndex: 0,
      selectedChoiceId: null,
      resultText: "",
      rewardSummary: "",
      resolution: null,
      continuation: null,
    },
    tasks: {
      active: [],
      weeklyProgress: { craftCompleted: 0, craftTotal: 0 },
      completedMarks: [],
      lastStory: null,
    },
  };

  resolveSlotForFlowState(rootState, 0, {
    slotNames: ["清晨"],
    uiText: { speakers: { schedule: "排程法阵" } },
    copy: {
      dayFlowResult: () => ({ title: "result", body: "body" }),
    },
    storyBeats: [],
    skillLabels: {},
    getMainFocusSkill: () => "craft",
    addLog: () => {},
    pushTimeline: () => {
      calls.timeline += 1;
    },
    randomEvents: [],
    getActivity: () => ({ id: "alchemy_intro", kind: "course", name: "丹器导论", storySegments: [] }),
    fallbackActivityId: "homework",
    resolveRandomEventChoice: () => null,
  });

  assert.equal(calls.timeline, 0);
  assert.equal(rootState.resolvingIndex, 0);
  assert.equal(rootState.progress, 0);
  assert.equal(rootState.resolvingFlow.phase, "event");
  assert.equal(rootState.resolvingFlow.autoplay, false);
  assert.equal(rootState.randomEvent.stage, "prompt");
  assert.equal(rootState.randomEvent.pendingEvent.title, "课后加讲");
  assert.equal(rootState.randomEvent.continuation.activityNotes, "课程收益");
});

test("chooseRandomEventOptionForFlowState moves the modal to result state without resuming day flow yet", () => {
  const windowObject = loadScripts(["src/app/day-flow.js"]);
  const { chooseRandomEventOptionForFlowState } = windowObject.GAME_RUNTIME;
  const rootState = {
    mode: "resolving",
    progress: 0,
    resolvingIndex: 0,
    resolvingFlow: {
      phase: "event",
      slotIndex: 0,
      segmentIndex: 0,
      autoplay: false,
      autoplayDelay: 1.05,
      autoplayTimer: 0,
      storyTrail: [],
      justAppended: false,
    },
    randomEvent: {
      stage: "prompt",
      pendingEvent: {
        id: "course_followup",
        title: "课后加讲",
        body: "先生忽然补讲。",
        speaker: "课程系统",
        slotIndex: 0,
        activityId: "alchemy_intro",
        choices: [
          { id: "copy-core-points", label: "记下关键脉络" },
          { id: "ask-one-more-question", label: "追问一句" },
        ],
      },
      focusedChoiceIndex: 0,
      selectedChoiceId: null,
      resultText: "",
      rewardSummary: "",
      resolution: null,
      continuation: {
        slotIndex: 0,
        activity: { id: "alchemy_intro", kind: "course", name: "丹器导论" },
        activityNotes: "课程收益",
        unlockedTaskStory: null,
      },
    },
  };

  const outcome = chooseRandomEventOptionForFlowState(rootState, "copy-core-points", {
    getActivity: () => ({ id: "alchemy_intro", kind: "course", name: "丹器导论" }),
    fallbackActivityId: "homework",
    resolveRandomEventChoice: () => ({
      ok: true,
      choiceId: "copy-core-points",
      resultText: "你把脉络誊清了。",
      rewardSummary: "奖励：悟道点+1",
      notesText: "你把脉络誊清了。 奖励：悟道点+1",
      story: { title: "随机事件 · 课后加讲", body: "你把脉络誊清了。\n奖励：悟道点+1", speaker: "课程系统" },
    }),
    skillLabels: {},
    getMainFocusSkill: () => "craft",
    addLog: () => {},
  });

  assert.equal(outcome.ok, true);
  assert.equal(rootState.randomEvent.stage, "result");
  assert.equal(rootState.randomEvent.selectedChoiceId, "copy-core-points");
  assert.equal(rootState.randomEvent.rewardSummary, "奖励：悟道点+1");
  assert.equal(rootState.resolvingIndex, 0);
  assert.equal(rootState.resolvingFlow.phase, "event");
});

test("confirmRandomEventResultForFlowState finalizes notes and resumes resolving flow exactly once", () => {
  const calls = { timeline: [] };
  const windowObject = loadScripts(["src/app/day-flow.js"], {
    runtime: {
      getActivitySpeaker: () => "课程系统",
    },
  });
  const { confirmRandomEventResultForFlowState } = windowObject.GAME_RUNTIME;
  const rootState = {
    mode: "resolving",
    scene: "resolving",
    progress: 0,
    resolvingIndex: 0,
    currentStory: null,
    resolvingFlow: {
      phase: "event",
      slotIndex: 0,
      segmentIndex: 0,
      autoplay: false,
      autoplayDelay: 1.05,
      autoplayTimer: 0,
      storyTrail: [],
      justAppended: false,
    },
    randomEvent: {
      stage: "result",
      pendingEvent: {
        id: "course_followup",
        title: "课后加讲",
        body: "先生忽然补讲。",
        speaker: "课程系统",
        slotIndex: 0,
        activityId: "alchemy_intro",
        choices: [{ id: "copy-core-points", label: "记下关键脉络" }],
      },
      focusedChoiceIndex: 0,
      selectedChoiceId: "copy-core-points",
      resultText: "你把脉络誊清了。",
      rewardSummary: "奖励：悟道点+1",
      resolution: {
        ok: true,
        resultText: "你把脉络誊清了。",
        rewardSummary: "奖励：悟道点+1",
        notesText: "你把脉络誊清了。 奖励：悟道点+1",
        story: { title: "随机事件 · 课后加讲", body: "你把脉络誊清了。\n奖励：悟道点+1", speaker: "课程系统" },
      },
      continuation: {
        slotIndex: 0,
        activity: { id: "alchemy_intro", kind: "course", name: "丹器导论" },
        activityNotes: "课程收益",
        unlockedTaskStory: null,
      },
    },
  };

  const ok = confirmRandomEventResultForFlowState(rootState, {
    slotNames: ["清晨", "午后"],
    uiText: { speakers: { schedule: "排程法阵" } },
    copy: {
      dayFlowResult: (slotName, activityName, notes) => ({
        title: `${slotName} · ${activityName}`,
        body: notes,
      }),
    },
    pushTimeline: (slotIndex, activity, notes) => {
      calls.timeline.push({ slotIndex, activity: activity.name, notes });
    },
  });

  assert.equal(ok, true);
  assert.equal(rootState.randomEvent.stage, null);
  assert.equal(rootState.resolvingFlow.phase, "result");
  assert.equal(rootState.resolvingIndex, 1);
  assert.equal(rootState.progress, 0.5);
  assert.deepEqual(realmSafe(calls.timeline), [
    { slotIndex: 0, activity: "丹器导论", notes: "课程收益 你把脉络誊清了。 奖励：悟道点+1" },
  ]);
  assert.equal(rootState.currentStory.title, "清晨 · 丹器导论");
  assert.deepEqual(realmSafe(rootState.resolvingFlow.storyTrail), [
    { title: "随机事件 · 课后加讲", body: "你把脉络誊清了。\n奖励：悟道点+1", speaker: "课程系统" },
    { title: "清晨 · 丹器导论", body: "课程收益 你把脉络誊清了。 奖励：悟道点+1", speaker: "课程系统" },
  ]);
});
```

- [ ] **Step 2: Run the focused flow test to verify it fails**

Run: `node --test tests/random-event-flow.test.cjs`  
Expected: FAIL because session/day-flow do not yet have `randomEvent` runtime state or prompt/result helpers.

- [ ] **Step 3: Add the dedicated runtime state and prompt/result/resume helpers**

```js
// src/app/session.js
function createRandomEventRuntimeState() {
  return {
    stage: null,
    pendingEvent: null,
    focusedChoiceIndex: 0,
    selectedChoiceId: null,
    resultText: "",
    rewardSummary: "",
    resolution: null,
    continuation: null,
  };
}

function createGameState(options) {
  const playerState = createBasePlayerState();
  const totalWeeks = normalizeTotalWeeks(options.totalWeeks);
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
    weeklyTimetable: createEmptyWeeklyTimetable(options.totalDays, options.slotCount),
    randomEvent: createRandomEventRuntimeState(),
    ui: { statsOpen: false, infoModal: null },
    resources: structuredClone(playerState.resources),
    stats: structuredClone(playerState.stats),
    skills: structuredClone(playerState.skills),
    relationships: structuredClone(playerState.relationships),
    today: options.createTodayState(),
    tasks: createTaskState(),
    taskRuntime: createTaskRuntimeState(),
  };
}

Object.assign(window.GAME_RUNTIME, {
  createGameState,
  resetGameState,
  dispatchSessionCommand,
  createRandomEventRuntimeState,
});
```

```js
// src/app/day-flow.js
const {
  findDayModifier,
  applyActivityToState,
  getActivitySpeaker,
  triggerRandomEventForTiming,
  resolveRandomEventChoice,
  createRandomEventRuntimeState,
} = window.GAME_RUNTIME;

function buildRandomEventContinuation(slotIndex, activity, activityNotes, unlockedTaskStory) {
  return {
    slotIndex,
    activity: structuredClone(activity),
    activityNotes,
    unlockedTaskStory: unlockedTaskStory ? structuredClone(unlockedTaskStory) : null,
  };
}

function ensureRandomEventState(rootState) {
  if (!rootState.randomEvent || typeof rootState.randomEvent !== "object") {
    rootState.randomEvent = createRandomEventRuntimeState();
  }
  return rootState.randomEvent;
}

function openRandomEventPromptForFlowState(rootState, pendingEvent, continuation) {
  const randomEvent = ensureRandomEventState(rootState);
  randomEvent.stage = "prompt";
  randomEvent.pendingEvent = pendingEvent;
  randomEvent.focusedChoiceIndex = 0;
  randomEvent.selectedChoiceId = null;
  randomEvent.resultText = "";
  randomEvent.rewardSummary = "";
  randomEvent.resolution = null;
  randomEvent.continuation = continuation;
  rootState.resolvingFlow.phase = "event";
  rootState.resolvingFlow.autoplay = false;
  rootState.resolvingFlow.autoplayTimer = 0;
}

function finalizeResolvedSlot(rootState, continuation, context, randomEventResolution) {
  if (randomEventResolution?.story) {
    pushResolvingStoryToState(rootState, randomEventResolution.story);
  }

  const notes = [continuation.activityNotes, randomEventResolution?.notesText].filter(Boolean).join(" ");
  context.pushTimeline(continuation.slotIndex, continuation.activity, notes);

  const detail = context.copy.dayFlowResult(
    context.slotNames[continuation.slotIndex],
    continuation.activity.name,
    notes
  );
  pushResolvingStoryToState(rootState, {
    title: detail.title,
    body: detail.body,
    speaker: getActivitySpeaker(continuation.activity, context.uiText),
  });

  if (continuation.unlockedTaskStory) {
    pushResolvingStoryToState(rootState, continuation.unlockedTaskStory);
  }

  rootState.resolvingIndex = continuation.slotIndex + 1;
  rootState.progress = rootState.resolvingIndex / context.slotNames.length;
}

function chooseRandomEventOptionForFlowState(rootState, choiceId, context) {
  const randomEvent = ensureRandomEventState(rootState);
  if (randomEvent.stage !== "prompt" || !randomEvent.continuation) {
    return { ok: false, error: "not_in_prompt" };
  }

  const activity =
    context.getActivity(randomEvent.continuation.activity?.id) ||
    randomEvent.continuation.activity ||
    getResolvingSlotActivity(rootState, randomEvent.continuation.slotIndex, context.getActivity, context.fallbackActivityId);

  const resolution = (context.resolveRandomEventChoice || resolveRandomEventChoice)(
    rootState,
    randomEvent.pendingEvent,
    choiceId,
    activity,
    {
      skillLabels: context.skillLabels,
      uiText: context.uiText,
      getMainFocusSkill: context.getMainFocusSkill,
      addLog: context.addLog,
    }
  );

  if (!resolution.ok) {
    context.addLog("随机事件配置", `事件 ${randomEvent.pendingEvent?.id || "unknown"} 选择 ${choiceId} 无法结算，已跳过。`);
    finalizeResolvedSlot(rootState, randomEvent.continuation, context, null);
    rootState.randomEvent = createRandomEventRuntimeState();
    rootState.resolvingFlow.phase = "result";
    return resolution;
  }

  randomEvent.stage = "result";
  randomEvent.selectedChoiceId = choiceId;
  randomEvent.resultText = resolution.resultText;
  randomEvent.rewardSummary = resolution.rewardSummary;
  randomEvent.resolution = resolution;
  return resolution;
}

function confirmRandomEventResultForFlowState(rootState, context) {
  const randomEvent = ensureRandomEventState(rootState);
  if (randomEvent.stage !== "result" || !randomEvent.continuation) {
    return false;
  }

  finalizeResolvedSlot(rootState, randomEvent.continuation, context, randomEvent.resolution);
  rootState.randomEvent = createRandomEventRuntimeState();
  rootState.resolvingFlow.phase = "result";
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

  const pendingRandomEvent = triggerRandomEventForTiming(rootState, slotIndex, activity, "after", {
    randomEvents: context.randomEvents,
    skillLabels: context.skillLabels,
    uiText: context.uiText,
    getMainFocusSkill: context.getMainFocusSkill,
    addLog: context.addLog,
  });

  if (pendingRandomEvent) {
    openRandomEventPromptForFlowState(
      rootState,
      pendingRandomEvent,
      buildRandomEventContinuation(slotIndex, activity, activityNotes, unlockedTaskStory)
    );
    return { ok: true, interruptedByRandomEvent: true };
  }

  finalizeResolvedSlot(
    rootState,
    buildRandomEventContinuation(slotIndex, activity, activityNotes, unlockedTaskStory),
    context,
    null
  );
  return { ok: true };
}

function advanceResolvingFlowState(rootState, context) {
  if (rootState.mode !== "resolving") {
    return { transitioned: false };
  }
  if (rootState.randomEvent?.stage) {
    return { transitioned: false, blockedByRandomEvent: true };
  }

  const flow = rootState.resolvingFlow;
  flow.autoplayTimer = 0;

  if (flow.phase === "lead" || flow.phase === "story") {
    const outcome = resolveSlotForFlowState(rootState, flow.slotIndex, context);
    if (outcome?.interruptedByRandomEvent) {
      return { transitioned: true, openedRandomEvent: true };
    }
    flow.phase = "result";
    return { transitioned: true };
  }

  return { transitioned: false };
}

Object.assign(window.GAME_RUNTIME, {
  createResolvingFlowState,
  resolveSlotForFlowState,
  advanceResolvingFlowState,
  openRandomEventPromptForFlowState,
  chooseRandomEventOptionForFlowState,
  confirmRandomEventResultForFlowState,
});
```

- [ ] **Step 4: Run the focused flow test again**

Run: `node --test tests/random-event-flow.test.cjs`  
Expected: PASS for prompt interruption, result-state storage, and single resume behavior.

- [ ] **Step 5: Commit**

```bash
git add src/app/session.js src/app/day-flow.js tests/random-event-flow.test.cjs
git commit -m "feat(day-flow): interrupt resolving flow for random event choices"
```

### Task 3: Add Modal Renderer, Copy, And Keyboard Routing For The Blocking Choice Flow

**Files:**
- Create: `src/app/random-event-view.js`
- Create: `tests/random-event-view.test.cjs`
- Modify: `src/app/keyboard-controls.js`
- Modify: `data/ui.js`
- Modify: `index.html`
- Test: `tests/random-event-view.test.cjs`

- [ ] **Step 1: Write the failing modal-render and keyboard-routing tests**

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const REPO_ROOT = path.resolve(__dirname, "..");

function loadScripts(files, { data = {} } = {}) {
  const context = {
    window: {
      GAME_DATA: data,
      GAME_RUNTIME: {},
    },
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

test("renderRandomEventModalHtml keeps rewards hidden in prompt stage and reveals them only in result stage", () => {
  const windowObject = loadScripts(["src/app/random-event-view.js"]);
  const { renderRandomEventModalHtml } = windowObject.GAME_RUNTIME;

  const promptHtml = renderRandomEventModalHtml({
    stage: "prompt",
    badge: "随机事件",
    stageLabel: "选择",
    title: "食堂风声",
    body: "邻桌压低嗓音谈起院内近况。",
    hint: "请先做出选择",
    choices: [
      { id: "listen", label: "侧耳细听", isActive: true },
      { id: "join-chat", label: "顺势搭话", isActive: false },
    ],
  });

  assert.match(promptHtml, /随机事件/);
  assert.match(promptHtml, /食堂风声/);
  assert.match(promptHtml, /data-random-event-choice="listen"/);
  assert.doesNotMatch(promptHtml, /奖励：/);

  const resultHtml = renderRandomEventModalHtml({
    stage: "result",
    badge: "随机事件",
    stageLabel: "结果",
    title: "食堂风声",
    body: "你接过话头，既探到消息，也和同桌熟络了几分。",
    rewardSummary: "奖励：悟道点+1，好友关系+1",
    continueLabel: "收束因果",
  });

  assert.match(resultHtml, /奖励：悟道点\+1，好友关系\+1/);
  assert.match(resultHtml, /id="random-event-continue-btn"/);
});

test("createKeyboardHandler routes resolving keys to the blocking random event modal before normal day flow", () => {
  const windowObject = loadScripts(["src/app/keyboard-controls.js"]);
  const { createKeyboardHandler } = windowObject.GAME_RUNTIME;
  const calls = {
    focus: [],
    activate: 0,
    advance: 0,
  };

  const handler = createKeyboardHandler({
    state: {
      mode: "resolving",
      randomEvent: { stage: "prompt" },
      summary: null,
    },
    slotCount: 6,
    clamp: (value) => value,
    toggleStatsPanel: () => {},
    setSlot: () => {},
    changeArchetype: () => {},
    applyArchetypeIfNeeded: () => {},
    startRun: () => {},
    confirmCourseSelection: () => {},
    cycleSelectedActivity: () => {},
    assignActivity: () => {},
    startDay: () => {},
    advanceResolvingFlow: () => {
      calls.advance += 1;
    },
    toggleResolvingAutoplay: () => {},
    focusTaskControl: () => {},
    activateTaskControl: () => {},
    moveMemoryCursor: () => {},
    cycleMemoryPiece: () => {},
    placeMemoryPiece: () => {},
    endNight: () => {},
    continueWeek: () => {},
    restartGame: () => {},
    toggleFullscreen: () => {},
    focusRandomEventChoice: (delta) => {
      calls.focus.push(delta);
    },
    activateRandomEventAction: () => {
      calls.activate += 1;
    },
  });

  handler({ key: "ArrowRight", preventDefault() {} });
  handler({ key: "Enter", preventDefault() {} });

  assert.deepEqual(calls.focus, [1]);
  assert.equal(calls.activate, 1);
  assert.equal(calls.advance, 0);
});
```

- [ ] **Step 2: Run the focused renderer/keyboard test to verify it fails**

Run: `node --test tests/random-event-view.test.cjs`  
Expected: FAIL because the renderer file does not exist yet and keyboard controls still treat Enter/Space as regular resolving progression.

- [ ] **Step 3: Add the modal HTML helper, UI copy, keyboard routing, and script loading**

```js
// src/app/random-event-view.js
(() => {
window.GAME_RUNTIME = window.GAME_RUNTIME || {};

function renderRandomEventModalHtml(input = {}) {
  if (input.stage === "result") {
    return `
      <div class="random-event-modal">
        <div class="panel-title">
          <h2>${input.badge || ""}</h2>
          <span class="badge">${input.stageLabel || ""}</span>
        </div>
        <div class="story-card focus-callout random-event-story">
          <strong>${input.title || ""}</strong>
          <small>${input.body || ""}</small>
        </div>
        <div class="modal-rule random-event-reward">
          <strong>${input.rewardSummary || ""}</strong>
        </div>
        <div class="action-row planning-actions">
          <button class="primary" id="random-event-continue-btn" type="button">${input.continueLabel || ""}</button>
        </div>
      </div>
    `;
  }

  const choicesHtml = (input.choices || [])
    .map(
      (choice) => `
        <button
          class="random-event-choice ${choice.isActive ? "active" : ""}"
          type="button"
          data-random-event-choice="${choice.id}"
        >
          <strong>${choice.label}</strong>
        </button>
      `
    )
    .join("");

  return `
    <div class="random-event-modal">
      <div class="panel-title">
        <h2>${input.badge || ""}</h2>
        <span class="badge">${input.stageLabel || ""}</span>
      </div>
      <div class="story-card focus-callout random-event-story">
        <strong>${input.title || ""}</strong>
        <small>${input.body || ""}</small>
        <small>${input.hint || ""}</small>
      </div>
      <div class="random-event-choice-grid">
        ${choicesHtml}
      </div>
    </div>
  `;
}

Object.assign(window.GAME_RUNTIME, {
  renderRandomEventModalHtml,
});
})();
```

```js
// data/ui.js
const UI_TEXT = {
  common: {
    close: "关闭",
  },
  randomEvent: {
    badge: "随机事件",
    promptLabel: "抉择",
    resultLabel: "结果",
    chooseHint: "请先做出选择，奖励会在结果中揭示。",
    continueBtn: "收束因果",
    rewardPrefix: "奖励：",
  },
};
```

```js
// src/app/keyboard-controls.js
function createKeyboardHandler(context) {
  return (event) => {
    const key = event.key.toLowerCase();
    const hasRandomEventModal = Boolean(context.state.randomEvent?.stage);

    if (
      ["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "enter", "a", "b", "f", "i", "p"].includes(key) ||
      event.key === " " ||
      (context.state.mode === "planning" && /^[1-9]$/.test(event.key))
    ) {
      event.preventDefault();
    }

    if (hasRandomEventModal) {
      if (key === "arrowleft" || key === "arrowup") context.focusRandomEventChoice(-1);
      if (key === "arrowright" || key === "arrowdown") context.focusRandomEventChoice(1);
      if (key === " " || key === "enter") context.activateRandomEventAction();
      if (key === "f") context.toggleFullscreen();
      return;
    }

    if (key === "i") {
      context.toggleStatsPanel();
    }

    if (context.state.mode === "resolving") {
      if (key === " " || key === "enter") context.advanceResolvingFlow();
      if (key === "p") context.toggleResolvingAutoplay();
    }
  };
}
```

```html
<!-- index.html -->
<script src="./src/app/night-flow.js"></script>
<script src="./src/app/keyboard-controls.js"></script>
<script src="./src/app/refining-view.js"></script>
<script src="./src/app/info-modal-view.js"></script>
<script src="./src/app/random-event-view.js"></script>
<script src="./src/debug/state-export.js"></script>
<script type="module" src="./main.js"></script>
```

- [ ] **Step 4: Run the focused renderer/keyboard test again**

Run: `node --test tests/random-event-view.test.cjs`  
Expected: PASS for prompt/result HTML and random-event-first keyboard routing.

- [ ] **Step 5: Commit**

```bash
git add data/ui.js index.html src/app/keyboard-controls.js src/app/random-event-view.js tests/random-event-view.test.cjs
git commit -m "feat(ui): add random event modal renderer and controls"
```

### Task 4: Integrate The Modal Into `main.js` And Style It To Match The Classical Theme

**Files:**
- Modify: `main.js`
- Modify: `styles.css`
- Modify: `tests/classical-css-theme.test.cjs`
- Test: `tests/classical-css-theme.test.cjs`

- [ ] **Step 1: Extend the CSS contract test for the new modal shell and choice states**

```js
test("random event modal uses the classical paper shell and restrained overlay styling", () => {
  const modalBlock = getBlock(escapeRegExp(".random-event-modal"));
  assert.match(
    modalBlock,
    /background:\s*linear-gradient\(180deg,\s*rgba\(251,\s*248,\s*240,\s*0\.98\),\s*rgba\(244,\s*236,\s*221,\s*0\.96\)\);/
  );
  assert.match(modalBlock, /border:\s*1px solid rgba\(168,\s*142,\s*112,\s*0\.36\);/);
  assert.match(modalBlock, /box-shadow:\s*0 24px 48px rgba\(47,\s*39,\s*27,\s*0\.18\);/);
});

test("random event choices use daiqing focus states while staying within the paper palette", () => {
  const choiceBlock = getBlock(escapeRegExp(".random-event-choice"));
  assert.match(choiceBlock, /background:\s*rgba\(252,\s*248,\s*239,\s*0\.92\);/);
  assert.match(choiceBlock, /border:\s*1px solid rgba\(168,\s*142,\s*112,\s*0\.22\);/);

  const activeChoiceBlock = getBlock(escapeRegExp(".random-event-choice.active"));
  assert.match(activeChoiceBlock, /background:\s*rgba\(69,\s*107,\s*109,\s*0\.14\);/);
  assert.match(activeChoiceBlock, /border-color:\s*rgba\(69,\s*107,\s*109,\s*0\.46\);/);
});
```

- [ ] **Step 2: Run the CSS contract test to verify it fails**

Run: `node --test tests/classical-css-theme.test.cjs`  
Expected: FAIL because the new modal selectors do not exist yet.

- [ ] **Step 3: Wire the modal through `main.js` and add the classical modal styles**

```js
// main.js
const {
  chooseRandomEventOptionForFlowState,
  confirmRandomEventResultForFlowState,
} = window.GAME_RUNTIME;

function getRandomEventState() {
  return state.randomEvent || {
    stage: null,
    pendingEvent: null,
    focusedChoiceIndex: 0,
    selectedChoiceId: null,
    resultText: "",
    rewardSummary: "",
    resolution: null,
    continuation: null,
  };
}

function focusRandomEventChoice(delta) {
  const randomEvent = getRandomEventState();
  if (randomEvent.stage !== "prompt" || !randomEvent.pendingEvent?.choices?.length) {
    return;
  }
  const total = randomEvent.pendingEvent.choices.length;
  randomEvent.focusedChoiceIndex = (randomEvent.focusedChoiceIndex + delta + total) % total;
  syncUi();
}

function chooseRandomEventOption(choiceId) {
  const outcome = chooseRandomEventOptionForFlowState(state, choiceId, createDayFlowContext());
  if (outcome?.ok || outcome?.error) {
    syncUi();
  }
}

function confirmRandomEventResult() {
  if (confirmRandomEventResultForFlowState(state, createDayFlowContext())) {
    syncUi();
  }
}

function activateRandomEventAction() {
  const randomEvent = getRandomEventState();
  if (randomEvent.stage === "prompt") {
    const choice = randomEvent.pendingEvent?.choices?.[randomEvent.focusedChoiceIndex] || null;
    if (choice) {
      chooseRandomEventOption(choice.id);
    }
    return;
  }
  if (randomEvent.stage === "result") {
    confirmRandomEventResult();
  }
}

function renderInfoModal() {
  const randomEvent = getRandomEventState();
  if (randomEvent.stage) {
    infoModal.classList.remove("overlay-modal-timetable");
    infoModal.innerHTML = window.GAME_RUNTIME.renderRandomEventModalHtml({
      stage: randomEvent.stage,
      badge: UI_TEXT.randomEvent.badge,
      stageLabel:
        randomEvent.stage === "prompt" ? UI_TEXT.randomEvent.promptLabel : UI_TEXT.randomEvent.resultLabel,
      title: randomEvent.pendingEvent?.title || "",
      body: randomEvent.stage === "prompt" ? randomEvent.pendingEvent?.body || "" : randomEvent.resultText || "",
      hint: UI_TEXT.randomEvent.chooseHint,
      rewardSummary: randomEvent.rewardSummary,
      continueLabel: UI_TEXT.randomEvent.continueBtn,
      choices: (randomEvent.pendingEvent?.choices || []).map((choice, index) => ({
        ...choice,
        isActive: index === randomEvent.focusedChoiceIndex,
      })),
    });

    infoModal.querySelectorAll("[data-random-event-choice]").forEach((button) => {
      button.addEventListener("click", () => chooseRandomEventOption(button.dataset.randomEventChoice));
    });
    infoModal.querySelector("#random-event-continue-btn")?.addEventListener("click", confirmRandomEventResult);
    return;
  }

  const kind = state.ui.infoModal;
  if (!kind) {
    infoModal.innerHTML = "";
    infoModal.classList.remove("overlay-modal-timetable");
    return;
  }

  infoModal.classList.remove("overlay-modal-timetable");
}

function syncUi() {
  renderLeftPanel();
  renderTopPanel();
  renderFlowPanel();
  renderMainPanel();
  renderLogPanel();
  renderMemoryStage();
  renderInfoModal();

  const hasBlockingRandomEvent = Boolean(state.randomEvent?.stage);
  topPanel.classList.toggle("hidden", !state.ui.statsOpen);
  infoModal.classList.toggle("hidden", !state.ui.infoModal && !hasBlockingRandomEvent);
  overlayBackdrop.classList.toggle("hidden", !state.ui.statsOpen && !state.ui.infoModal && !hasBlockingRandomEvent);
}

function update(dt) {
  state.scenePulse += dt;
  if (state.randomEvent?.stage) {
    return;
  }
  if (state.mode !== "resolving" || !state.resolvingFlow.autoplay) {
    return;
  }
  state.resolvingFlow.autoplayTimer += dt;
  if (state.resolvingFlow.autoplayTimer >= state.resolvingFlow.autoplayDelay) {
    advanceResolvingFlow();
  }
}

document.addEventListener(
  "keydown",
  createKeyboardHandler({
    state,
    slotCount: SLOT_NAMES.length,
    clamp,
    toggleStatsPanel,
    setSlot,
    changeArchetype,
    applyArchetypeIfNeeded,
    startRun,
    confirmCourseSelection,
    cycleSelectedActivity,
    assignActivity,
    startDay,
    advanceResolvingFlow,
    toggleResolvingAutoplay,
    focusTaskControl,
    activateTaskControl,
    moveMemoryCursor,
    cycleMemoryPiece,
    placeMemoryPiece,
    endNight,
    continueWeek,
    restartGame,
    toggleFullscreen,
    focusRandomEventChoice,
    activateRandomEventAction,
  })
);

overlayBackdrop.addEventListener("click", () => {
  if (state.randomEvent?.stage) {
    return;
  }
  toggleStatsPanel(false);
  closeInfoModal();
});
```

```css
/* styles.css */
.random-event-modal {
  display: grid;
  gap: 16px;
  background: linear-gradient(180deg, rgba(251, 248, 240, 0.98), rgba(244, 236, 221, 0.96));
  border: 1px solid rgba(168, 142, 112, 0.36);
  box-shadow: 0 24px 48px rgba(47, 39, 27, 0.18);
}

.random-event-story {
  margin: 0;
}

.random-event-choice-grid {
  display: grid;
  gap: 12px;
}

.random-event-choice {
  width: 100%;
  text-align: left;
  border: 1px solid rgba(168, 142, 112, 0.22);
  background: rgba(252, 248, 239, 0.92);
  color: var(--ink-strong);
  border-radius: 16px;
  padding: 14px 16px;
  transition:
    transform 0.16s ease,
    border-color 0.16s ease,
    background 0.16s ease,
    box-shadow 0.16s ease;
}

.random-event-choice:hover,
.random-event-choice:focus-visible {
  transform: translateY(-1px);
  border-color: rgba(199, 164, 90, 0.42);
  box-shadow: 0 10px 22px rgba(69, 107, 109, 0.14);
}

.random-event-choice.active {
  background: rgba(69, 107, 109, 0.14);
  border-color: rgba(69, 107, 109, 0.46);
}

.random-event-reward {
  margin-top: -4px;
}
```

- [ ] **Step 4: Run focused UI contract checks and nearby regressions**

Run:

```bash
node --test tests/random-event-domain.test.cjs
node --test tests/random-event-flow.test.cjs
node --test tests/random-event-view.test.cjs
node --test tests/classical-css-theme.test.cjs
node --test tests/task-flow.test.cjs
node --test tests/info-modal-view.test.cjs
```

Expected: PASS for all listed tests.

- [ ] **Step 5: Commit**

```bash
git add main.js styles.css tests/classical-css-theme.test.cjs
git commit -m "feat(random-events): wire blocking event modal into the classical UI"
```

### Task 5: Full Verification And Manual Smoke Pass

**Files:**
- Modify: `main.js` (only if a verification defect is found)
- Modify: `styles.css` (only if a verification defect is found)
- Test: `tests/random-event-domain.test.cjs`
- Test: `tests/random-event-flow.test.cjs`
- Test: `tests/random-event-view.test.cjs`
- Test: `tests/classical-css-theme.test.cjs`

- [ ] **Step 1: Run the full automated suite**

Run: `node --test`  
Expected: PASS across the repo, including the new random-event tests and existing flow regressions.

- [ ] **Step 2: Launch the local app for a manual smoke test**

Run: `npm run dev`

Manual checklist:
- trigger a random event during day resolution and confirm it interrupts immediately
- prompt modal shows title/body/options only, without reward preview
- choosing an option switches to result text and ends with the actual reward summary
- clicking or pressing Enter on continue closes the modal and resumes the interrupted slot exactly once
- clicking the backdrop while the modal is open does nothing
- autoplay does not continue behind the modal
- the modal, choices, and continue button match the existing classical light-paper style on both desktop and narrow widths

- [ ] **Step 3: Fix only the defects found during verification**

If a defect appears, make the smallest scoped fix in `main.js` or `styles.css`, then rerun:

```bash
node --test
```

Expected: PASS again after the fix.

- [ ] **Step 4: Capture the final repo state**

Run: `git status --short`  
Expected: only the intended implementation files remain changed; leave unrelated user edits such as `小游戏玩法描述.md` untouched.

- [ ] **Step 5: Commit**

```bash
git add data/events.js data/ui.js index.html main.js styles.css src/app/day-flow.js src/app/keyboard-controls.js src/app/random-event-view.js src/app/session.js src/domain/random-event.js tests/random-event-domain.test.cjs tests/random-event-flow.test.cjs tests/random-event-view.test.cjs tests/classical-css-theme.test.cjs
git commit -m "feat: add random event choice modal flow"
```

## Spec Coverage Check (Self-Review)

- immediate interruption when a random event triggers: covered in Task 2 prompt-state flow and Task 5 manual smoke test.
- centered blocking modal with 2-3 options: covered in Task 3 renderer and Task 4 `main.js` / `styles.css`.
- no reward preview before choice: covered in Task 1 pending-payload shape, Task 3 prompt HTML test, and Task 5 manual smoke test.
- branch-specific result text ending with reward summary: covered in Task 1 domain resolver and Task 2 result confirmation test.
- mostly reusable reward templates with some special-case effects: covered in Task 1 reward template map plus custom `effect` / `skillBonus` branch.
- confirm resumes interrupted flow correctly and only once: covered in Task 2 confirmation test and Task 5 verification.
- safe handling for malformed configuration: covered in Task 1 unknown-template path and Task 2 safe-skip behavior.

No placeholders (`TBD`, `TODO`, vague “appropriate handling”, or “similar to above”) remain in this plan.
