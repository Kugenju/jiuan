# Dao Debate Minigame Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the approved `dao_debate` timed task so dao courses can unlock a next-day schedulable three-round debate minigame with hidden argument cards, `conviction` / `exposure` scoring, and week-summary marks.

**Architecture:** Reuse the existing timed-task shell instead of inventing a second task pipeline. Keep dao debate rules in a dedicated domain module, keep task availability / unlock state in `src/domain/task-system.js`, keep the task panel HTML in a dedicated view helper, and let `main.js` stay responsible for task-mode orchestration and canvas rendering.

**Tech Stack:** Plain JavaScript, existing browser runtime, existing canvas + DOM UI shell, Node.js `node:test`

---

## File Structure And Responsibilities

- `data/tasks.js` (modify): add `dao_debate` task config plus the first topic, argument cards, follow-up definitions, and hidden-card metadata.
- `data/activities.js` (modify): add the schedulable `dao_debate_task` activity entry.
- `data/ui.js` (modify): add dao task labels, round/status copy, and summary mark labels.
- `data/copy.js` (modify): add dao-specific unlock, expiry, and attempt-result copy surfaced through the generic task flow.
- `data/story.js` (modify): add one or two dao story beats whose ids double as hidden-card unlock flags.
- `index.html` (modify): load `src/domain/dao-debate-minigame.js` and `src/app/dao-debate-view.js` before `main.js`.
- `src/domain/task-system.js` (modify): expand weekly progress and task lifecycle helpers so dao courses can unlock a next-day task and carry hidden unlock flags into the task instance.
- `src/domain/dao-debate-minigame.js` (create): own session creation, hand generation, prompt selection, per-round scoring, follow-up transitions, and final settlement.
- `src/app/session.js` (modify): add dao-safe task runtime shape on create/reset/carry-over paths.
- `src/app/day-flow.js` (modify): keep empty task runtime shape in sync with the new dao runtime branch.
- `src/app/dao-debate-view.js` (create): build panel state and HTML for the dao debate task panel without bloating `main.js`.
- `main.js` (modify): branch task startup, render dao task stage/panel, handle argument-card clicks, settle dao rounds, and route success/failure back into resolving flow.
- `tests/task-config.test.cjs` (modify): lock in task config, activity registration, and script load order.
- `tests/task-system.test.cjs` (modify): lock in dao unlock threshold, next-day availability, and hidden-flag capture on task creation.
- `tests/dao-debate-minigame.test.cjs` (create): verify hand generation, follow-up transitions, hidden cards, scoring, and final pass/fail thresholds.
- `tests/dao-debate-view.test.cjs` (create): verify dao panel HTML, round metadata, prompt text, and task-control buttons.
- `tests/task-flow.test.cjs` (modify): verify entering dao task mode, playing three rounds, recording summary marks, and resuming day flow.
- `docs/superpowers/specs/2026-04-07-dao-debate-minigame-design.md` (reference only): approved source of truth.

### Task 1: Add Dao Task Data, Activity Config, UI Labels, And Script Wiring

**Files:**
- Modify: `data/tasks.js`
- Modify: `data/activities.js`
- Modify: `data/ui.js`
- Modify: `index.html`
- Test: `tests/task-config.test.cjs`

- [ ] **Step 1: Write the failing config test**

```js
test("dao debate task config is exported with topic, cards, and task activity metadata", () => {
  const windowObject = loadScripts(["data/core.js", "data/activities.js", "data/tasks.js", "data/ui.js"]);
  const { ACTIVITIES, TASK_DEFS, DAO_DEBATE_TOPICS, DAO_DEBATE_CARDS, DAO_DEBATE_FOLLOWUPS, UI_TEXT } =
    windowObject.GAME_DATA;

  assert.ok(ACTIVITIES.some((activity) => activity.id === "dao_debate_task" && activity.kind === "task"));
  assert.equal(TASK_DEFS.dao_debate.durationDays, 7);
  assert.equal(TASK_DEFS.dao_debate.activityId, "dao_debate_task");
  assert.equal(TASK_DEFS.dao_debate.unlockThreshold, 2);
  assert.equal(TASK_DEFS.dao_debate.availableAfterDays, 1);
  assert.deepEqual(TASK_DEFS.dao_debate.topicPool, ["topic_1"]);
  assert.equal(DAO_DEBATE_TOPICS.topic_1.id, "topic_1");
  assert.ok(DAO_DEBATE_CARDS.uphold_principle.hidden !== true);
  assert.equal(DAO_DEBATE_CARDS.archive_case_note.hidden, true);
  assert.equal(DAO_DEBATE_FOLLOWUPS.press_utility.id, "press_utility");
  assert.equal(UI_TEXT.summary.taskMarkLabels.dao_debate, "道法论辩");
});

test("index loads dao debate runtime modules before main app bootstrap", () => {
  const indexHtml = fs.readFileSync(path.join(TEST_ROOT, "index.html"), "utf8");

  assert.match(indexHtml, /<script src="\.\/src\/domain\/dao-debate-minigame\.js"><\/script>/);
  assert.match(indexHtml, /<script src="\.\/src\/app\/dao-debate-view\.js"><\/script>/);
  assert.ok(indexHtml.indexOf("./src/domain/dao-debate-minigame.js") < indexHtml.indexOf("./main.js"));
  assert.ok(indexHtml.indexOf("./src/app/dao-debate-view.js") < indexHtml.indexOf("./main.js"));
});
```

- [ ] **Step 2: Run the config test to verify it fails**

Run: `node --test tests/task-config.test.cjs`

Expected: FAIL with missing `dao_debate_task`, missing dao debate exports, and missing script tags in `index.html`.

- [ ] **Step 3: Add the minimal config and script wiring**

Add this new sibling entry inside `TASK_DEFS`:

```js
dao_debate: {
    id: "dao_debate",
    activityId: "dao_debate_task",
    skill: "dao",
    durationDays: 7,
    weeklyLimit: 1,
    unlockThreshold: 2,
    availableAfterDays: 1,
    topicPool: ["topic_1"],
    hiddenUnlockFlags: ["dao_archive_insight", "dao_counterexample_insight"],
    rounds: {
      maxRounds: 3,
      handSize: 5,
      hiddenCardLimit: 1,
    },
    rewards: {
      skills: { dao: 1 },
      resources: { insight: 1 },
      summaryMark: "dao_debate",
    },
    successRules: {
      convictionTarget: 5,
      maxExposure: 1,
      fallbackConvictionTarget: 4,
      fallbackExposure: 0,
    },
  },
};

const DAO_DEBATE_TOPICS = {
  topic_1: {
    id: "topic_1",
    title: "术可代德否",
    openingPrompt: "若一门术法可救万人，却需修者常年损德折寿，此术当兴还是当禁？",
    openingFollowupType: "press_principle",
  },
};

const DAO_DEBATE_CARDS = {
  uphold_principle: { id: "uphold_principle", label: "守其本义", tag: "principle" },
  weigh_outcomes: { id: "weigh_outcomes", label: "衡量得失", tag: "utility" },
  cite_classic: { id: "cite_classic", label: "援引经典", tag: "authority" },
  personal_witness: { id: "personal_witness", label: "援引亲历", tag: "experience" },
  break_assumption: { id: "break_assumption", label: "指出反例", tag: "counterexample" },
  archive_case_note: {
    id: "archive_case_note",
    label: "道阁案牍",
    tag: "experience",
    hidden: true,
    unlockFlag: "dao_archive_insight",
  },
};

const DAO_DEBATE_FOLLOWUPS = {
  press_principle: { id: "press_principle", label: "逼问义理" },
  press_utility: { id: "press_utility", label: "逼问后果" },
  press_authority: { id: "press_authority", label: "逼问依凭" },
  press_evasion: { id: "press_evasion", label: "逼问回避" },
};

Object.assign(window.GAME_DATA, {
  TASK_DEFS,
  DAO_DEBATE_TOPICS,
  DAO_DEBATE_CARDS,
  DAO_DEBATE_FOLLOWUPS,
});
```

Add this new task activity entry inside `ACTIVITIES`:

```js
{
  id: "dao_debate_task",
  name: "道法论辩",
  tone: "study",
  kind: "task",
  scene: "seminar",
  skill: "dao",
  summary: "在时限内应对妙哉偶的三轮论辩，成功则获得道法进展与周总结标记。",
  storySegments: [
    "道法阁深处灯影摇晃，妙哉偶已把第一道论题摆在案上，等你正面接住它的追问。",
  ],
}
```

```js
task: {
  title: "任务",
  daoDebateTitle: "道法论辩",
  daoDebateRound(current, max) {
    return `第 ${current} / ${max} 轮`;
  },
  daoConviction(value) {
    return `立论 ${value}`;
  },
  daoExposure(value) {
    return `破绽 ${value}`;
  },
},
summary: {
  taskMarkLabels: {
    artifact_refining: "炼器委托",
    dao_debate: "道法论辩",
    default: "委托",
  },
},
```

Add these script tags to `index.html` before `main.js`:

```html
<script src="./src/domain/task-system.js"></script>
<script src="./src/domain/refining-minigame.js"></script>
<script src="./src/domain/dao-debate-minigame.js"></script>
<script src="./src/domain/activity.js"></script>
<script src="./src/domain/random-event.js"></script>
<script src="./src/domain/memory.js"></script>
<script src="./src/domain/week-cycle.js"></script>
<script src="./src/domain/summary.js"></script>
<script src="./src/app/session.js"></script>
<script src="./src/app/day-flow.js"></script>
<script src="./src/app/night-flow.js"></script>
<script src="./src/app/keyboard-controls.js"></script>
<script src="./src/app/refining-view.js"></script>
<script src="./src/app/dao-debate-view.js"></script>
<script src="./src/app/info-modal-view.js"></script>
```

- [ ] **Step 4: Run the config test to verify it passes**

Run: `node --test tests/task-config.test.cjs`

Expected: PASS for dao task config export and script load order.

- [ ] **Step 5: Commit**

```bash
git add data/tasks.js data/activities.js data/ui.js index.html tests/task-config.test.cjs
git commit -m "feat: scaffold dao debate task config"
```

### Task 2: Extend The Timed-Task System For Dao Course Unlocks And Next-Day Availability

**Files:**
- Modify: `src/domain/task-system.js`
- Modify: `src/app/session.js`
- Modify: `src/app/day-flow.js`
- Test: `tests/task-system.test.cjs`

- [ ] **Step 1: Write the failing lifecycle test**

```js
test("dao courses unlock a next-day debate task and keep hidden unlock flags from story state", () => {
  const windowObject = loadScripts(["data/tasks.js", "src/domain/task-system.js"]);
  const {
    createTaskState,
    handleResolvedCourseTaskProgress,
    getSchedulableTaskActivityIds,
  } = windowObject.GAME_RUNTIME;
  const { TASK_DEFS } = windowObject.GAME_DATA;

  const rootState = {
    week: 3,
    day: 4,
    storyFlags: {
      dao_archive_insight: true,
      dao_counterexample_insight: false,
    },
    tasks: createTaskState(),
  };

  handleResolvedCourseTaskProgress(rootState, { id: "dao_a", kind: "course", skill: "dao" }, {
    taskDefs: TASK_DEFS,
    copy: { taskUnlocked: () => ({ title: "unlock", body: "unlock", speaker: "system" }) },
  });
  const unlocked = handleResolvedCourseTaskProgress(rootState, { id: "dao_b", kind: "course", skill: "dao" }, {
    taskDefs: TASK_DEFS,
    copy: { taskUnlocked: () => ({ title: "unlock", body: "unlock", speaker: "system" }) },
  });

  assert.equal(rootState.tasks.weeklyProgress.daoCompleted, 2);
  assert.equal(unlocked.type, "dao_debate");
  assert.equal(unlocked.availableFromDay, 5);
  assert.equal(unlocked.expiresOnDay, 10);
  assert.deepEqual(realmSafe(unlocked.unlockFlags), ["dao_archive_insight"]);

  assert.equal(getSchedulableTaskActivityIds(rootState, 4).has("dao_debate_task"), false);
  assert.equal(getSchedulableTaskActivityIds(rootState, 5).has("dao_debate_task"), true);
});

test("task runtime factories reserve a dao debate branch", () => {
  const windowObject = loadScripts(["src/domain/task-system.js", "src/app/session.js"], {
    runtime: {
      createBasePlayerState: () => ({ resources: {}, stats: {}, skills: {}, relationships: {} }),
      resetPlayerStateOnRoot: () => {},
      applyArchetypeEffectToRoot: () => {},
      createEmptySchedule: () => [],
      createEmptyWeeklyTimetable: () => [],
      createEmptyScheduleLocks: () => [],
      cloneCourseSelectionBlocks: () => [],
      buildWeeklyTimetableFromCourseSelection: () => [],
      isCourseSelectionComplete: () => true,
      pickCourseForBlock: () => true,
      buildDailyScheduleFromWeeklyTimetable: () => [],
      buildScheduleLocksFromWeeklyTimetable: () => [],
      findSchedulePreset: () => null,
      findNextEditableSlot: () => 0,
      setSelectedPlanningSlot: () => true,
      assignPlanningActivity: () => true,
      applySchedulePreset: () => true,
      clearPlanningSchedule: () => true,
      copyPlanningScheduleFromHistory: () => true,
    },
  });

  const { createTaskRuntimeState } = windowObject.GAME_RUNTIME;
  assert.deepEqual(realmSafe(createTaskRuntimeState()), {
    activeTaskId: null,
    pendingSlotIndex: null,
    mode: null,
    result: null,
    refining: null,
    debate: null,
  });
});
```

- [ ] **Step 2: Run the lifecycle tests to verify they fail**

Run: `node --test tests/task-system.test.cjs`

Expected: FAIL because `daoCompleted`, `availableFromDay`, `unlockFlags`, and `debate` runtime state do not exist yet.

- [ ] **Step 3: Implement the generic dao task lifecycle changes**

```js
function createTaskState() {
  return {
    active: [],
    weeklyProgress: {
      craftCompleted: 0,
      craftTotal: 0,
      daoCompleted: 0,
    },
    completedMarks: [],
    lastStory: null,
  };
}

function createTaskRuntimeState() {
  return {
    activeTaskId: null,
    pendingSlotIndex: null,
    mode: null,
    result: null,
    refining: null,
    debate: null,
  };
}

function buildTimedTaskInstance(taskDef, rootState) {
  const durationDays = Math.max(1, normalizeNumber(taskDef.durationDays, 1));
  const availableAfterDays = Math.max(0, normalizeNumber(taskDef.availableAfterDays, 0));
  const unlockFlags = (taskDef.hiddenUnlockFlags || []).filter((flag) => Boolean(rootState.storyFlags?.[flag]));
  return {
    id: `week-${rootState.week}-${taskDef.id}`,
    type: taskDef.id,
    activityId: taskDef.activityId,
    status: "active",
    unlockDay: rootState.day,
    availableFromDay: rootState.day + availableAfterDays,
    expiresOnDay: rootState.day + durationDays - 1,
    attemptCount: 0,
    rewardClaimed: false,
    unlockFlags,
  };
}

function handleResolvedCourseTaskProgress(rootState, activity, context) {
  ensureTaskState(rootState);

  if (activity?.kind !== "course") {
    return null;
  }

  if (activity.skill === "craft") {
    rootState.tasks.weeklyProgress.craftCompleted += 1;
    return maybeUnlockTask(rootState, context.taskDefs?.artifact_refining, (state) =>
      state.tasks.weeklyProgress.craftTotal > 0 &&
      state.tasks.weeklyProgress.craftCompleted === state.tasks.weeklyProgress.craftTotal
    , context);
  }

  if (activity.skill === "dao") {
    rootState.tasks.weeklyProgress.daoCompleted += 1;
    return maybeUnlockTask(rootState, context.taskDefs?.dao_debate, (state, taskDef) =>
      state.tasks.weeklyProgress.daoCompleted >= Number(taskDef.unlockThreshold || 0)
    , context);
  }

  return null;
}

function getSchedulableTaskActivityIds(rootState, currentDay = rootState.day) {
  const activeTasks = rootState.tasks?.active || [];
  return new Set(
    activeTasks
      .filter((task) => task.status === "active" && Number(currentDay || 0) >= Number(task.availableFromDay || task.unlockDay || 0))
      .map((task) => task.activityId)
  );
}
```

```js
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
```

- [ ] **Step 4: Run the lifecycle tests to verify they pass**

Run: `node --test tests/task-system.test.cjs`

Expected: PASS for dao unlock threshold, next-day availability, and new runtime shape.

- [ ] **Step 5: Commit**

```bash
git add src/domain/task-system.js src/app/session.js src/app/day-flow.js tests/task-system.test.cjs
git commit -m "feat: unlock dao debate tasks from dao courses"
```

### Task 3: Implement The Dao Debate Domain Engine With Hidden Cards And Follow-Up Scoring

**Files:**
- Create: `src/domain/dao-debate-minigame.js`
- Modify: `data/tasks.js`
- Modify: `data/story.js`
- Test: `tests/dao-debate-minigame.test.cjs`

- [ ] **Step 1: Write the failing dao debate domain tests**

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const REPO_ROOT = path.resolve(__dirname, "..");

function loadScripts(files) {
  const context = {
    window: { GAME_DATA: {}, GAME_RUNTIME: {} },
    structuredClone,
    console,
  };
  context.globalThis = context;
  context.window.window = context.window;

  files.forEach((file) => {
    const fullPath = path.join(REPO_ROOT, file);
    vm.runInNewContext(fs.readFileSync(fullPath, "utf8"), context, { filename: fullPath });
  });

  return context.window;
}

function realmSafe(value) {
  return JSON.parse(JSON.stringify(value));
}

test("createDaoDebateSessionState draws five cards and injects one unlocked hidden card", () => {
  const windowObject = loadScripts(["data/tasks.js", "src/domain/dao-debate-minigame.js"]);
  const { TASK_DEFS } = windowObject.GAME_DATA;
  const { createDaoDebateSessionState } = windowObject.GAME_RUNTIME;

  const session = createDaoDebateSessionState(TASK_DEFS.dao_debate, {
    topicId: "topic_1",
    unlockFlags: ["dao_archive_insight"],
  }, () => 0);

  assert.equal(session.roundIndex, 1);
  assert.equal(session.maxRounds, 3);
  assert.equal(session.hand.length, 5);
  assert.equal(session.topicId, "topic_1");
  assert.equal(session.currentPrompt.followupType, "opening");
  assert.equal(session.hand.some((card) => card.id === "archive_case_note"), true);
});

test("playDaoDebateCard updates conviction, exposure, and followup type from the played tag", () => {
  const windowObject = loadScripts(["data/tasks.js", "src/domain/dao-debate-minigame.js"]);
  const { TASK_DEFS } = windowObject.GAME_DATA;
  const { createDaoDebateSessionState, playDaoDebateCard } = windowObject.GAME_RUNTIME;

  const session = createDaoDebateSessionState(TASK_DEFS.dao_debate, { topicId: "topic_1", unlockFlags: [] }, () => 0);
  session.hand = [
    { id: "weigh_outcomes", label: "衡量得失", tag: "utility" },
    { id: "cite_classic", label: "援引经典", tag: "authority" },
    { id: "uphold_principle", label: "守其本义", tag: "principle" },
  ];

  const next = playDaoDebateCard(session, "weigh_outcomes", TASK_DEFS.dao_debate);
  assert.equal(next.roundIndex, 2);
  assert.equal(next.conviction, 2);
  assert.equal(next.exposure, 0);
  assert.equal(next.currentPrompt.followupType, "press_utility");
  assert.equal(next.history[0].cardId, "weigh_outcomes");
});

test("final round settlement recognizes pass and fail thresholds", () => {
  const windowObject = loadScripts(["data/tasks.js", "src/domain/dao-debate-minigame.js"]);
  const { TASK_DEFS } = windowObject.GAME_DATA;
  const { settleDaoDebateSession } = windowObject.GAME_RUNTIME;

  assert.deepEqual(
    realmSafe(settleDaoDebateSession({
      conviction: 5,
      exposure: 1,
      roundIndex: 4,
      maxRounds: 3,
      history: [],
    }, TASK_DEFS.dao_debate)),
    { status: "success", conviction: 5, exposure: 1, scoreLabel: "pass" }
  );

  assert.deepEqual(
    realmSafe(settleDaoDebateSession({
      conviction: 3,
      exposure: 2,
      roundIndex: 4,
      maxRounds: 3,
      history: [],
    }, TASK_DEFS.dao_debate)),
    { status: "failure", conviction: 3, exposure: 2, scoreLabel: "fail" }
  );
});
```

- [ ] **Step 2: Run the dao debate domain tests to verify they fail**

Run: `node --test tests/dao-debate-minigame.test.cjs`

Expected: FAIL because `src/domain/dao-debate-minigame.js` does not exist and dao topic/card metadata is incomplete.

- [ ] **Step 3: Implement the dao debate rule engine**

```js
(() => {
window.GAME_RUNTIME = window.GAME_RUNTIME || {};

function buildDaoDebateCardPool(taskDef, taskInstance) {
  const allCards = window.GAME_DATA.DAO_DEBATE_CARDS || {};
  const hiddenFlags = new Set(taskInstance?.unlockFlags || []);
  return Object.values(allCards).filter((card) => {
    if (!card.hidden) {
      return true;
    }
    return hiddenFlags.has(card.unlockFlag);
  });
}

function drawDaoDebateHand(taskDef, taskInstance, rng) {
  const pool = buildDaoDebateCardPool(taskDef, taskInstance).map((card) => ({ ...card }));
  const handSize = Math.max(1, Number(taskDef?.rounds?.handSize || 5));
  const hand = [];
  while (pool.length && hand.length < handSize) {
    const index = Math.floor((typeof rng === "function" ? rng() : Math.random()) * pool.length);
    hand.push(pool.splice(index, 1)[0]);
  }
  return hand;
}

function getOpeningPrompt(topicId) {
  const topic = window.GAME_DATA.DAO_DEBATE_TOPICS?.[topicId];
  return {
    title: topic?.title || "",
    body: topic?.openingPrompt || "",
    followupType: "opening",
  };
}

function getFollowupTypeForTag(tag) {
  const map = {
    principle: "press_principle",
    utility: "press_utility",
    authority: "press_authority",
    experience: "press_principle",
    counterexample: "press_principle",
    evasion: "press_evasion",
  };
  return map[tag] || "press_principle";
}

function scorePromptResponse(promptType, tag) {
  const matrix = {
    opening: { principle: "strong", utility: "strong", authority: "ok", experience: "ok", counterexample: "ok", evasion: "weak" },
    press_principle: { principle: "strong", counterexample: "strong", experience: "ok", authority: "weak", utility: "ok", evasion: "weak" },
    press_utility: { experience: "strong", utility: "ok", principle: "ok", authority: "weak", counterexample: "ok", evasion: "weak" },
    press_authority: { experience: "strong", counterexample: "strong", principle: "ok", authority: "weak", utility: "ok", evasion: "weak" },
    press_evasion: { principle: "strong", utility: "ok", experience: "ok", counterexample: "ok", authority: "weak", evasion: "weak" },
  };
  return matrix[promptType]?.[tag] || "weak";
}

function createDaoDebateSessionState(taskDef, taskInstance, rng) {
  const topicId = taskInstance?.topicId || taskDef?.topicPool?.[0] || "topic_1";
  return {
    topicId,
    roundIndex: 1,
    maxRounds: Math.max(1, Number(taskDef?.rounds?.maxRounds || 3)),
    conviction: 0,
    exposure: 0,
    hand: drawDaoDebateHand(taskDef, taskInstance, rng),
    currentPrompt: getOpeningPrompt(topicId),
    history: [],
    result: null,
  };
}

function playDaoDebateCard(session, cardId, taskDef) {
  const card = (session.hand || []).find((entry) => entry.id === cardId);
  if (!card) {
    return session;
  }

  const scoreType = scorePromptResponse(session.currentPrompt?.followupType || "opening", card.tag);
  const nextSession = {
    ...session,
    hand: session.hand.filter((entry) => entry.id !== cardId),
    conviction: session.conviction + (scoreType === "strong" ? 2 : scoreType === "ok" ? 1 : 0),
    exposure: session.exposure + (scoreType === "weak" ? 1 : 0),
    history: session.history.concat([{
      roundIndex: session.roundIndex,
      cardId: card.id,
      tag: card.tag,
      scoreType,
      promptType: session.currentPrompt?.followupType || "opening",
    }]),
    roundIndex: session.roundIndex + 1,
  };

  if (session.roundIndex >= session.maxRounds) {
    nextSession.result = settleDaoDebateSession(nextSession, taskDef);
    return nextSession;
  }

  nextSession.currentPrompt = {
    followupType: getFollowupTypeForTag(card.tag),
    body: window.GAME_DATA.DAO_DEBATE_FOLLOWUPS?.[getFollowupTypeForTag(card.tag)]?.prompt || "",
  };
  return nextSession;
}

function settleDaoDebateSession(session, taskDef) {
  const rules = taskDef?.successRules || {};
  const directPass =
    session.conviction >= Number(rules.convictionTarget || 5) &&
    session.exposure <= Number(rules.maxExposure || 1);
  const fallbackPass =
    session.conviction >= Number(rules.fallbackConvictionTarget || 4) &&
    session.exposure === Number(rules.fallbackExposure || 0);
  const status = directPass || fallbackPass ? "success" : "failure";
  return { status, conviction: session.conviction, exposure: session.exposure, scoreLabel: status === "success" ? "pass" : "fail" };
}

Object.assign(window.GAME_RUNTIME, {
  createDaoDebateSessionState,
  playDaoDebateCard,
  settleDaoDebateSession,
});
})();
```

Add these two new beat entries to `STORY_BEATS`:

```js
{
    id: "dao_archive_insight",
    condition: {
      activityId: "dao_seminar",
      minSkill: { key: "dao", value: 2 },
    },
    effect: {},
    note: "你从妙哉偶先前批注的旧案里摸到了一条可在论辩中援引的线索。",
  },
  {
    id: "dao_counterexample_insight",
    condition: {
      activityId: "cultivation_ethics",
      minDay: 3,
    },
    effect: {},
    note: "你记下了一则足以拆开空泛义理的反例，之后论辩时可以动用它。",
  },
```

- [ ] **Step 4: Run the dao debate domain tests to verify they pass**

Run: `node --test tests/dao-debate-minigame.test.cjs`

Expected: PASS for hand generation, hidden-card injection, follow-up routing, and settlement thresholds.

- [ ] **Step 5: Commit**

```bash
git add data/tasks.js data/story.js src/domain/dao-debate-minigame.js tests/dao-debate-minigame.test.cjs
git commit -m "feat: implement dao debate minigame rules"
```

### Task 4: Add A Dedicated Dao Debate Task Panel Renderer

**Files:**
- Create: `src/app/dao-debate-view.js`
- Modify: `data/ui.js`
- Test: `tests/dao-debate-view.test.cjs`

- [ ] **Step 1: Write the failing dao debate view test**

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const REPO_ROOT = path.resolve(__dirname, "..");

function loadScripts(files) {
  const context = {
    window: { GAME_DATA: {}, GAME_RUNTIME: {} },
    structuredClone,
    console,
  };
  context.globalThis = context;
  context.window.window = context.window;

  files.forEach((file) => {
    const fullPath = path.join(REPO_ROOT, file);
    vm.runInNewContext(fs.readFileSync(fullPath, "utf8"), context, { filename: fullPath });
  });

  return context.window;
}

test("renderDaoDebateTaskPanelHtml shows prompt, scores, and playable card buttons", () => {
  const windowObject = loadScripts(["src/app/dao-debate-view.js"]);
  const { buildDaoDebateTaskPanelState, renderDaoDebateTaskPanelHtml } = windowObject.GAME_RUNTIME;

  const panelState = buildDaoDebateTaskPanelState({
    activity: { name: "道法论辩", summary: "summary" },
    task: { attemptCount: 1 },
    session: {
      roundIndex: 2,
      maxRounds: 3,
      conviction: 2,
      exposure: 1,
      currentPrompt: { title: "术可代德否", body: "追问文本" },
      hand: [
        { id: "uphold_principle", label: "守其本义", tag: "principle" },
        { id: "cite_classic", label: "援引经典", tag: "authority" },
      ],
      history: [{ roundIndex: 1, scoreType: "strong", cardId: "weigh_outcomes" }],
    },
    taskText: {
      daoDebateRound: (current, max) => `${current}/${max}`,
      daoConviction: (value) => `立论:${value}`,
      daoExposure: (value) => `破绽:${value}`,
      attemptCount: (value) => `attempt:${value}`,
    },
  });

  const html = renderDaoDebateTaskPanelHtml(panelState);
  assert.equal(panelState.roundText, "2/3");
  assert.equal(panelState.convictionText, "立论:2");
  assert.equal(panelState.exposureText, "破绽:1");
  assert.match(html, /道法论辩/);
  assert.match(html, /追问文本/);
  assert.match(html, /data-task-control="debate-card"/);
  assert.match(html, /data-debate-card="uphold_principle"/);
});
```

- [ ] **Step 2: Run the dao debate view test to verify it fails**

Run: `node --test tests/dao-debate-view.test.cjs`

Expected: FAIL because `src/app/dao-debate-view.js` does not exist.

- [ ] **Step 3: Implement the panel-state builder and HTML renderer**

```js
(() => {
window.GAME_RUNTIME = window.GAME_RUNTIME || {};

function buildDaoDebateTaskPanelState(input) {
  const taskText = input?.taskText || {};
  const session = input?.session || {};
  return {
    activityName: input?.activity?.name || "",
    activitySummary: input?.activity?.summary || "",
    promptTitle: session.currentPrompt?.title || "",
    promptBody: session.currentPrompt?.body || "",
    roundText:
      typeof taskText.daoDebateRound === "function"
        ? taskText.daoDebateRound(session.roundIndex || 1, session.maxRounds || 1)
        : `${session.roundIndex || 1}/${session.maxRounds || 1}`,
    convictionText:
      typeof taskText.daoConviction === "function"
        ? taskText.daoConviction(session.conviction || 0)
        : String(session.conviction || 0),
    exposureText:
      typeof taskText.daoExposure === "function"
        ? taskText.daoExposure(session.exposure || 0)
        : String(session.exposure || 0),
    attemptCountText:
      typeof taskText.attemptCount === "function"
        ? taskText.attemptCount(input?.task?.attemptCount || 0)
        : "",
    cards: (session.hand || []).map((card) => ({
      id: card.id,
      label: card.label,
      tag: card.tag,
    })),
    history: session.history || [],
  };
}

function renderDaoDebateTaskPanelHtml(panelState) {
  return `
    <div class="planning-shell task-summary-shell dao-debate-shell">
      <div class="panel-title">
        <h2>${panelState.activityName}</h2>
        <span class="badge">${panelState.roundText}</span>
      </div>
      <div class="story-card focus-callout">
        <strong>${panelState.promptTitle}</strong>
        <small>${panelState.promptBody}</small>
        <small>${panelState.attemptCountText}</small>
      </div>
      <div class="planning-meta-grid">
        <div class="story-card"><strong>${panelState.convictionText}</strong></div>
        <div class="story-card"><strong>${panelState.exposureText}</strong></div>
      </div>
      <div class="activity-grid planning-activity-grid">
        ${panelState.cards.map((card) => `
          <button class="activity-card" type="button" data-task-control="debate-card" data-debate-card="${card.id}">
            <strong>${card.label}</strong>
            <small>${card.tag}</small>
          </button>
        `).join("")}
      </div>
    </div>
  `;
}

Object.assign(window.GAME_RUNTIME, {
  buildDaoDebateTaskPanelState,
  renderDaoDebateTaskPanelHtml,
});
})();
```

- [ ] **Step 4: Run the dao debate view test to verify it passes**

Run: `node --test tests/dao-debate-view.test.cjs`

Expected: PASS for prompt text, score labels, and `data-task-control="debate-card"` buttons.

- [ ] **Step 5: Commit**

```bash
git add src/app/dao-debate-view.js tests/dao-debate-view.test.cjs data/ui.js
git commit -m "feat: render dao debate task panel"
```

### Task 5: Wire Dao Debate Into Task Entry, Round Resolution, Canvas Rendering, And Day-Flow Resume

**Files:**
- Modify: `main.js`
- Modify: `data/copy.js`
- Modify: `tests/task-flow.test.cjs`
- Test: `tests/task-flow.test.cjs`

- [ ] **Step 1: Write the failing task-flow integration tests**

```js
test("beginTaskActivityForSlot creates a dao debate runtime session", () => {
  const state = {
    mode: "resolving",
    day: 5,
    rng: () => 0,
    tasks: {
      active: [{
        id: "week-1-dao_debate",
        type: "dao_debate",
        activityId: "dao_debate_task",
        status: "active",
        availableFromDay: 5,
        unlockFlags: ["dao_archive_insight"],
      }],
    },
  };

  const result = beginTaskActivityForSlot(state, {
    id: "dao_debate_task",
    kind: "task",
    name: "道法论辩",
    scene: "seminar",
  }, 2, { taskDefs: TASK_DEFS });

  assert.equal(result.enteredTask, true);
  assert.equal(state.mode, "task");
  assert.equal(state.taskRuntime.mode, "dao_debate_task");
  assert.equal(state.taskRuntime.debate.topicId, "topic_1");
  assert.equal(state.taskRuntime.refining, null);
});

test("playing the third dao debate card completes the task and resumes resolving flow", () => {
  state.mode = "task";
  state.day = 5;
  state.resolvingFlow = { slotIndex: 1, phase: "story", storyTrail: [], justAppended: false };
  state.tasks = {
    active: [{
      id: "week-1-dao_debate",
      type: "dao_debate",
      activityId: "dao_debate_task",
      status: "active",
      attemptCount: 0,
      rewardClaimed: false,
      expiresOnDay: 10,
    }],
    completedMarks: [],
    lastStory: null,
  };
  state.taskRuntime = {
    activeTaskId: "week-1-dao_debate",
    pendingSlotIndex: 1,
    mode: "dao_debate_task",
    result: null,
    refining: null,
    debate: {
      topicId: "topic_1",
      roundIndex: 3,
      maxRounds: 3,
      conviction: 4,
      exposure: 0,
      currentPrompt: { followupType: "press_principle", body: "最后追问" },
      hand: [{ id: "uphold_principle", label: "守其本义", tag: "principle" }],
      history: [],
    },
  };

  playDaoDebateCardFromUi("uphold_principle");

  assert.equal(state.mode, "resolving");
  assert.equal(state.tasks.active[0].status, "completed");
  assert.equal(state.tasks.completedMarks.includes("dao_debate"), true);
  assert.equal(state.taskRuntime.debate, null);
});
```

- [ ] **Step 2: Run the task-flow tests to verify they fail**

Run: `node --test tests/task-flow.test.cjs`

Expected: FAIL because task startup only knows refining, dao task runtime does not exist, and there is no dao card click handler.

- [ ] **Step 3: Implement dao task startup, panel rendering, and result handoff**

```js
function beginTaskActivityForSlot(rootState, activity, slotIndex, options = {}) {
  const taskDef = findTaskDefByActivityId(activity.id, options.taskDefs || TASK_DEFS);
  const activeTask = findActiveTaskForActivity(rootState, activity.id);
  if (!taskDef || !activeTask) {
    return { ok: false, reason: "task_not_available" };
  }

  rootState.mode = "task";
  rootState.scene = activity.scene || "task";
  rootState.taskRuntime = {
    activeTaskId: activeTask.id,
    pendingSlotIndex: slotIndex,
    mode: activity.id,
    result: null,
    refining:
      taskDef.id === "artifact_refining" && typeof createRefiningSessionState === "function"
        ? createRefiningSessionState(taskDef, rootState.rng)
        : null,
    debate:
      taskDef.id === "dao_debate" && typeof createDaoDebateSessionState === "function"
        ? createDaoDebateSessionState(taskDef, activeTask, rootState.rng)
        : null,
  };

  return { ok: true, enteredTask: true };
}

function getActiveDaoDebateSession(rootState = state) {
  const debate = getActiveTaskRuntime(rootState).debate;
  return debate && Array.isArray(debate.hand) ? debate : null;
}

function playDaoDebateCardFromUi(cardId) {
  if (state.mode !== "task") {
    return false;
  }
  const task = getActiveTaskInstance(state);
  const taskDef = getActiveTaskDef(state);
  const session = getActiveDaoDebateSession(state);
  if (!task || !taskDef || !session) {
    return false;
  }

  const nextSession = playDaoDebateCard(session, cardId, taskDef);
  state.taskRuntime.debate = nextSession.result ? null : nextSession;

  if (!nextSession.result) {
    syncUi();
    return true;
  }

  task.attemptCount = Number(task.attemptCount || 0) + 1;
  if (nextSession.result.status === "success") {
    applyEffectBundle(taskDef.rewards);
    normalizeState();
    if (!state.tasks.completedMarks.includes(taskDef.rewards.summaryMark)) {
      state.tasks.completedMarks.push(taskDef.rewards.summaryMark);
    }
    task.status = "completed";
    task.rewardClaimed = true;
  }

  const detail = RUNTIME_COPY.taskAttemptResult(taskDef.id, {
    taskName: getActiveTaskActivity(state)?.name || "道法论辩",
    success: nextSession.result.status === "success",
    conviction: nextSession.result.conviction,
    exposure: nextSession.result.exposure,
    remainingDays: getTaskRemainingDays(state, task),
  });

  pushTimeline(state.taskRuntime.pendingSlotIndex, getActiveTaskActivity(state), detail.body);
  addLog(detail.title, detail.body);
  state.tasks.lastStory = structuredClone(detail);
  resumeResolvingAfterTaskAttempt(state, detail, {
    slotNames: SLOT_NAMES,
    uiText: UI_TEXT,
    resetTaskRuntime: resetTaskRuntimeForState,
  });
  syncUi();
  return true;
}
```

```js
function renderTaskPanel() {
  const taskDef = getActiveTaskDef(state);
  if (taskDef?.id === "dao_debate") {
    const session = getActiveDaoDebateSession(state);
    const panelState = buildDaoDebateTaskPanelState({
      activity: getActiveTaskActivity(state),
      task: getActiveTaskInstance(state),
      session,
      taskText: UI_TEXT.task,
    });
    mainPanel.innerHTML = renderDaoDebateTaskPanelHtml(panelState);
    mainPanel.querySelectorAll("[data-debate-card]").forEach((button) => {
      button.addEventListener("click", () => playDaoDebateCardFromUi(button.dataset.debateCard));
    });
    return;
  }
}

function drawTaskScene() {
  const taskDef = getActiveTaskDef(state);
  if (taskDef?.id === "dao_debate") {
    drawAcademyBackdrop("#efe6d8", "#d7c2a7");
    drawBanner(UI_TEXT.canvas.taskTitle(state.day, "道法论辩"), UI_TEXT.canvas.taskSubtitle(getTaskRemainingDays(state), "妙哉偶"));
    const session = getActiveDaoDebateSession(state);
    ctx.fillStyle = CANVAS_THEME.panelFill;
    ctx.fillRect(72, 180, 816, 300);
    ctx.strokeStyle = CANVAS_THEME.panelStroke;
    ctx.strokeRect(72, 180, 816, 300);
    ctx.font = "24px 'Microsoft YaHei'";
    ctx.fillStyle = CANVAS_THEME.panelText;
    ctx.fillText(session?.currentPrompt?.title || "术可代德否", 112, 228);
    wrapText(session?.currentPrompt?.body || "", 112, 270, 736, 30, CANVAS_THEME.panelMuted);
    ctx.fillText(`立论 ${session?.conviction || 0}`, 112, 420);
    ctx.fillText(`破绽 ${session?.exposure || 0}`, 252, 420);
    return;
  }
}
```

```js
taskAttemptResult(taskType, result = {}) {
  if (taskType === "dao_debate") {
    if (result.success) {
      return {
        title: `${result.taskName} · 辩成`,
        body: `你接住了妙哉偶三轮追问，立论 ${result.conviction}，破绽 ${result.exposure}，本周论道标记已记录。`,
        speaker: "妙哉偶",
      };
    }
    return {
      title: `${result.taskName} · 未稳`,
      body: `这场论辩仍有破口，立论 ${result.conviction}，破绽 ${result.exposure}。剩余 ${result.remainingDays} 天，可再择时重试。`,
      speaker: "妙哉偶",
    };
  }
}
```

- [ ] **Step 4: Run the task-flow tests to verify they pass**

Run: `node --test tests/task-flow.test.cjs tests/dao-debate-view.test.cjs tests/dao-debate-minigame.test.cjs tests/task-system.test.cjs tests/task-config.test.cjs`

Expected: PASS for dao task entry, three-round completion, resume-to-resolving behavior, and all new dao-specific modules.

- [ ] **Step 5: Commit**

```bash
git add main.js data/copy.js tests/task-flow.test.cjs
git commit -m "feat: integrate dao debate task flow"
```

## Self-Review

### Spec Coverage

- 通用限时任务接法：Task 2 and Task 5 cover unlock timing, next-day availability, retries, expiry, summary mark writes, and runtime reset.
- 三轮论辩与标签追问：Task 3 covers session creation, tag-to-follow-up routing, and round settlement.
- 隐藏论点牌：Task 2 captures unlock flags on the task instance; Task 3 injects hidden cards from those flags; Task 3 also adds story-beat sources.
- UI 信息结构：Task 4 and Task 5 cover prompt text, round count, `conviction`, `exposure`, playable cards, and task-mode canvas rendering.
- 周循环反馈：Task 5 writes summary marks and resumes day flow cleanly.

### Placeholder Scan

- No `TODO`, `TBD`, “implement later”, or “similar to Task N” placeholders remain.
- Every task names exact files, test commands, and commit commands.
- Every implementation step includes concrete code blocks rather than abstract instructions.

### Type Consistency

- Task type remains `dao_debate`.
- Activity id remains `dao_debate_task`.
- Runtime state uses `taskRuntime.debate`.
- Domain entry points are `createDaoDebateSessionState`, `playDaoDebateCard`, and `settleDaoDebateSession`.
- Hidden-card source ids stay aligned with story-beat ids: `dao_archive_insight` and `dao_counterexample_insight`.
