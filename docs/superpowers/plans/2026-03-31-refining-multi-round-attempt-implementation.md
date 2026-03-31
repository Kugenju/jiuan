# Refining Multi-Round Attempt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add configurable multi-round refining attempts where round scores accumulate, success ends early on reaching target score, and only used cards are replaced between rounds.

**Architecture:** Keep round and refresh rules in shared refining runtime helpers so both the main game and `debug-refining.html` use the same state transitions. The main game continues to own task lifecycle transitions back to day flow, while the domain/minigame layer owns round initialization, settlement accumulation, and board refresh.

**Tech Stack:** Browser JavaScript, existing `window.GAME_DATA` / `window.GAME_RUNTIME` globals, Node built-in test runner, static HTML debug page.

---

## File Structure

- Modify: `data/tasks.js`
  Purpose: add configurable round metadata for `artifact_refining`.

- Modify: `src/domain/refining-minigame.js`
  Purpose: add round-state helpers for initializing multi-round attempts, applying round settlement, and refreshing only used cards.

- Modify: `main.js`
  Purpose: seed task runtime with multi-round refining state, keep the player inside task mode across non-final rounds, and surface cumulative score / round history in the in-game UI.

- Modify: `src/app/refining-view.js`
  Purpose: extend task-panel state generation for round counters, cumulative score, and round history summary.

- Modify: `src/debug/refining-sandbox.js`
  Purpose: reuse the shared multi-round helpers inside the standalone page and show cumulative multi-round progress.

- Modify: `data/ui.js`
  Purpose: add text labels for round count, cumulative score, and round-result summaries.

- Test: `tests/refining-minigame.test.cjs`
  Purpose: verify shared round helpers and used-card replacement behavior.

- Test: `tests/task-flow.test.cjs`
  Purpose: verify main-game task flow stays in task mode between rounds and exits correctly on success/failure.

- Test: `tests/debug-refining-page.test.cjs`
  Purpose: verify sandbox multi-round accumulation and early-success behavior.

---

### Task 1: Add Configurable Multi-Round Refining State Helpers

**Files:**
- Modify: `data/tasks.js`
- Modify: `src/domain/refining-minigame.js`
- Test: `tests/refining-minigame.test.cjs`

- [ ] **Step 1: Write the failing round-helper tests**

```js
test("createRefiningSessionState seeds round metadata from task config", () => {
  const windowObject = loadScripts(["data/tasks.js", "src/domain/refining-minigame.js"]);
  const { TASK_DEFS } = windowObject.GAME_DATA;
  const { createRefiningSessionState } = windowObject.GAME_RUNTIME;

  const session = createRefiningSessionState(TASK_DEFS.artifact_refining, makeRng(11));

  assert.equal(session.roundIndex, 1);
  assert.equal(session.maxRounds, TASK_DEFS.artifact_refining.rounds.maxRounds);
  assert.equal(session.totalScore, 0);
  assert.deepEqual(session.roundResults, []);
  assert.equal(session.attempt.deck.length, 9);
});

test("advanceRefiningSession preserves unused cards and replaces only used cards", () => {
  const windowObject = loadScripts(["data/tasks.js", "src/domain/refining-minigame.js"]);
  const { TASK_DEFS } = windowObject.GAME_DATA;
  const { createRefiningSessionState, advanceRefiningSession } = windowObject.GAME_RUNTIME;

  const session = createRefiningSessionState(TASK_DEFS.artifact_refining, makeRng(12));
  session.attempt.deck[0].revealed = true;
  session.attempt.deck[1].revealed = true;
  session.attempt.deck[1].used = true;
  session.attempt.slots = ["card-1", null, null];

  const beforePreservedId = session.attempt.deck[0].id;
  const beforePreservedType = session.attempt.deck[0].type;
  const beforeReplacedId = session.attempt.deck[1].id;

  const nextSession = advanceRefiningSession(session, { score: 1, success: false, complete: true, recipeKey: "xuantie|xuantie|xuantie" });

  assert.equal(nextSession.roundIndex, 2);
  assert.equal(nextSession.totalScore, 1);
  assert.equal(nextSession.roundResults.length, 1);
  assert.equal(nextSession.attempt.deck[0].id, beforePreservedId);
  assert.equal(nextSession.attempt.deck[0].type, beforePreservedType);
  assert.equal(nextSession.attempt.deck[0].revealed, true);
  assert.notEqual(nextSession.attempt.deck[1].id, beforeReplacedId);
  assert.equal(nextSession.attempt.deck[1].used, false);
  assert.deepEqual(nextSession.attempt.slots, [null, null, null]);
});

test("settleRefiningSession ends early on cumulative success and fails only after max rounds", () => {
  const windowObject = loadScripts(["data/tasks.js", "src/domain/refining-minigame.js"]);
  const { TASK_DEFS } = windowObject.GAME_DATA;
  const { createRefiningSessionState, settleRefiningSession } = windowObject.GAME_RUNTIME;

  const successSession = createRefiningSessionState(TASK_DEFS.artifact_refining, makeRng(13));
  successSession.totalScore = 2;
  const successOutcome = settleRefiningSession(successSession, { score: 1, success: false, complete: true, recipeKey: "lingshi|xuantie|xuantie" }, TASK_DEFS.artifact_refining);

  assert.equal(successOutcome.status, "success");
  assert.equal(successOutcome.session.totalScore, 3);
  assert.equal(successOutcome.session.roundResults.length, 1);

  const failureSession = createRefiningSessionState(TASK_DEFS.artifact_refining, makeRng(14));
  failureSession.roundIndex = failureSession.maxRounds;
  const failureOutcome = settleRefiningSession(failureSession, { score: 1, success: false, complete: true, recipeKey: "xuantie|xuantie|xuantie" }, TASK_DEFS.artifact_refining);

  assert.equal(failureOutcome.status, "failure");
  assert.equal(failureOutcome.session.totalScore, 1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/refining-minigame.test.cjs`

Expected: FAIL with missing `createRefiningSessionState`, `advanceRefiningSession`, or `settleRefiningSession`.

- [ ] **Step 3: Add task config and minimal shared helpers**

```js
// data/tasks.js
const TASK_DEFS = {
  artifact_refining: {
    id: "artifact_refining",
    activityId: "artifact_refining_task",
    skill: "craft",
    durationDays: 3,
    weeklyLimit: 1,
    rounds: {
      maxRounds: 3,
      refreshMode: "replace_used_only",
      refreshPool: "base_refining_pool",
    },
    rewards: {
      skills: { craft: 1 },
      resources: { spirit: 1, insight: 1 },
      summaryMark: "artifact_refining",
    },
    objective: {
      id: "spirit_needle_blank",
      name: "聚灵针胚",
      scoreTarget: 3,
      materialRequirements: { xuantie: 1, lingshi: 1 },
    },
  },
};
```

```js
// src/domain/refining-minigame.js
function createReplacementCard(index, rng) {
  const pool = BASE_DECK;
  const nextType = pool[Math.floor(getRngValue(rng) * pool.length)] || pool[0];
  return {
    id: `card-${index}-${Math.floor(getRngValue(rng) * 1e9)}`,
    type: nextType,
    revealed: false,
    used: false,
  };
}

function createRefiningSessionState(taskDef, rng) {
  return {
    roundIndex: 1,
    maxRounds: Math.max(1, Number(taskDef?.rounds?.maxRounds || 1)),
    totalScore: 0,
    roundResults: [],
    attempt: createRefiningAttemptState(taskDef, rng),
    rng,
  };
}

function advanceRefiningSession(session, result) {
  const nextAttempt = {
    ...session.attempt,
    deck: session.attempt.deck.map((card, index) => {
      if (!card.used) {
        return { ...card };
      }
      return createReplacementCard(index, session.rng);
    }),
    slots: [null, null, null],
    selectedCardId: null,
    result: null,
  };
  return {
    ...session,
    roundIndex: session.roundIndex + 1,
    totalScore: session.totalScore + (result?.score || 0),
    roundResults: session.roundResults.concat([{ ...result, roundIndex: session.roundIndex }]),
    attempt: nextAttempt,
  };
}

function settleRefiningSession(session, result, taskDef) {
  const totalScore = session.totalScore + (result?.score || 0);
  const roundResults = session.roundResults.concat([{ ...result, roundIndex: session.roundIndex }]);
  const baseSession = {
    ...session,
    totalScore,
    roundResults,
  };
  if (totalScore >= Number(taskDef?.objective?.scoreTarget || 0)) {
    return { status: "success", session: baseSession };
  }
  if (session.roundIndex >= session.maxRounds) {
    return { status: "failure", session: baseSession };
  }
  return { status: "continue", session: advanceRefiningSession(session, result) };
}

Object.assign(window.GAME_RUNTIME, {
  createRefiningSessionState,
  advanceRefiningSession,
  settleRefiningSession,
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/refining-minigame.test.cjs`

Expected: PASS with new round-helper coverage green.

- [ ] **Step 5: Commit**

```bash
git add data/tasks.js src/domain/refining-minigame.js tests/refining-minigame.test.cjs
git commit -m "feat: add configurable refining round helpers"
```

### Task 2: Wire Multi-Round Session State Into Main Task Flow

**Files:**
- Modify: `main.js`
- Test: `tests/task-flow.test.cjs`

- [ ] **Step 1: Write the failing task-flow tests**

```js
test("confirmTaskAttempt keeps task mode active when refining should continue to the next round", () => {
  const windowObject = loadScripts(["src/app/day-flow.js"]);
  const { resumeResolvingAfterTaskAttempt } = windowObject.GAME_RUNTIME;
  assert.equal(typeof resumeResolvingAfterTaskAttempt, "function");
});

test("multi-round refining task success exits immediately once cumulative score reaches target", () => {
  const rootState = {
    mode: "task",
    day: 3,
    resolvingIndex: 0,
    progress: 0,
    tasks: {
      active: [{ id: "week-1-artifact_refining", type: "artifact_refining", activityId: "artifact_refining_task", status: "active", attemptCount: 0 }],
      completedMarks: [],
      lastStory: null,
    },
    taskRuntime: {
      activeTaskId: "week-1-artifact_refining",
      pendingSlotIndex: 0,
      mode: "artifact_refining_task",
      result: null,
      refining: {
        roundIndex: 2,
        maxRounds: 3,
        totalScore: 2,
        roundResults: [{ roundIndex: 1, score: 2 }],
        attempt: { deck: [], slots: ["card-0", "card-1", "card-2"], selectedCardId: null, result: null },
      },
    },
  };

  assert.equal(rootState.taskRuntime.refining.totalScore, 2);
});
```

Add two concrete assertions into `tests/task-flow.test.cjs` after wiring:

- continuing outcome keeps `rootState.mode === "task"` and increments `roundIndex`
- success outcome resets task runtime and pushes the resolving story as today

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/task-flow.test.cjs`

Expected: FAIL because main task flow still treats one settlement as the end of the entire task.

- [ ] **Step 3: Implement multi-round main-task behavior**

```js
// main.js
function createRefiningTaskSession(taskDef, rng) {
  return typeof createRefiningSessionState === "function" ? createRefiningSessionState(taskDef, rng) : null;
}

function getActiveRefiningSession(rootState = state) {
  return getActiveTaskRuntime(rootState).refining;
}

function continueTaskRound(session) {
  const runtime = getActiveTaskRuntime(state);
  runtime.refining = session;
  runtime.result = null;
  syncUi();
  return true;
}

function finishTaskAttempt(result) {
  const runtime = getActiveTaskRuntime(state);
  const task = getActiveTaskInstance(state);
  const taskDef = getActiveTaskDef(state);
  const activity = getActiveTaskActivity(state);
  const session = runtime.refining;
  const settlement = settleRefiningSession(session, result, taskDef);

  task.attemptCount = Number(task.attemptCount || 0) + 1;
  runtime.refining = settlement.session;

  if (settlement.status === "continue") {
    state.tasks.lastStory = {
      title: `${activity.name} · 第 ${settlement.session.roundIndex - 1} 轮完成`,
      body: `本轮 ${result.score} 分，累计 ${settlement.session.totalScore} 分，进入下一轮。`,
      speaker: "mentor",
    };
    syncUi();
    return true;
  }

  if (settlement.status === "success") {
    result = {
      ...result,
      score: settlement.session.totalScore,
    };
  }

  // existing success/failure return-to-resolving branch remains below
}

// task start
rootState.taskRuntime = {
  activeTaskId: activeTask.id,
  pendingSlotIndex: slotIndex,
  mode: activity.id,
  result: null,
  refining: createRefiningTaskSession(taskDef, rootState.rng),
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/task-flow.test.cjs`

Expected: PASS with continuation, early-success, and final-failure flow covered.

- [ ] **Step 5: Commit**

```bash
git add main.js tests/task-flow.test.cjs
git commit -m "feat: keep refining tasks active across rounds"
```

### Task 3: Surface Round Progress In Main Game UI

**Files:**
- Modify: `src/app/refining-view.js`
- Modify: `main.js`
- Modify: `data/ui.js`
- Test: `tests/refining-view.test.cjs`

- [ ] **Step 1: Write the failing task-panel view tests**

```js
test("buildRefiningTaskPanelState includes round progress and cumulative score", () => {
  const windowObject = loadScripts(["src/app/refining-view.js"]);
  const { buildRefiningTaskPanelState } = windowObject.GAME_RUNTIME;

  const panelState = buildRefiningTaskPanelState({
    taskText: {
      roundProgress: (current, max) => `${current}/${max}`,
      totalScore: (score) => `score:${score}`,
    },
    refiningSession: {
      roundIndex: 2,
      maxRounds: 3,
      totalScore: 4,
      roundResults: [{ roundIndex: 1, score: 1 }, { roundIndex: 2, score: 3 }],
    },
    attempt: { slots: [null, null, null] },
  });

  assert.equal(panelState.roundProgressText, "2/3");
  assert.equal(panelState.totalScoreText, "score:4");
  assert.deepEqual(realmSafe(panelState.roundHistory), [
    { label: "R1", score: 1 },
    { label: "R2", score: 3 },
  ]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/refining-view.test.cjs`

Expected: FAIL because panel-state output does not include round fields yet.

- [ ] **Step 3: Extend view state and renderers**

```js
// src/app/refining-view.js
function buildRefiningTaskPanelState(input) {
  const taskText = input?.taskText || {};
  const refiningSession = input?.refiningSession || {};
  return {
    // existing fields...
    roundProgressText:
      typeof taskText.roundProgress === "function"
        ? taskText.roundProgress(refiningSession.roundIndex || 1, refiningSession.maxRounds || 1)
        : `${refiningSession.roundIndex || 1}/${refiningSession.maxRounds || 1}`,
    totalScoreText:
      typeof taskText.totalScore === "function"
        ? taskText.totalScore(refiningSession.totalScore || 0)
        : String(refiningSession.totalScore || 0),
    roundHistory: (refiningSession.roundResults || []).map((entry) => ({
      label: `R${entry.roundIndex}`,
      score: entry.score || 0,
    })),
  };
}
```

```js
// main.js inside renderTaskPanel()
const session = getActiveRefiningSession(state);
const panelState = buildRefiningTaskPanelState({
  taskText,
  task,
  taskDef,
  activity,
  attempt: session?.attempt,
  refiningSession: session,
  requirementText: getTaskRequirementText(taskDef),
  remainingDays: getTaskRemainingDays(state, task),
  selectedCardLabel: selectedCard ? getRefiningCardLabel(selectedCard) : taskText.noSelection || "",
  slotCardLabels: (session?.attempt?.slots || [null, null, null]).map((cardId) => (cardId ? getRefiningCardLabel(cardId) : null)),
  statusText: getTaskStatusText(state),
});
```

Add compact render blocks for:

- current round / max rounds
- cumulative score
- round history list

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/refining-view.test.cjs`

Expected: PASS with round-summary state and HTML output covered.

- [ ] **Step 5: Commit**

```bash
git add src/app/refining-view.js main.js data/ui.js tests/refining-view.test.cjs
git commit -m "feat: show refining round progress in task ui"
```

### Task 4: Add Multi-Round Support To Debug Sandbox

**Files:**
- Modify: `src/debug/refining-sandbox.js`
- Test: `tests/debug-refining-page.test.cjs`

- [ ] **Step 1: Write the failing sandbox tests**

```js
test("refining sandbox continues into the next round when cumulative score is below target", () => {
  const windowObject = loadScripts([
    "data/tasks.js",
    "src/domain/refining-minigame.js",
    "src/app/refining-view.js",
    "src/debug/refining-sandbox.js",
  ]);
  const { TASK_DEFS } = windowObject.GAME_DATA;
  const { createRefiningSandboxController } = windowObject.GAME_RUNTIME;

  const controller = createRefiningSandboxController({
    taskDef: TASK_DEFS.artifact_refining,
    presets: windowObject.GAME_RUNTIME.createRefiningPresetDecks(),
  });
  controller.restartFromPreset("failure_basic");

  const state = controller.getState();
  state.session.attempt.deck.forEach((card) => {
    card.revealed = true;
  });
  state.session.attempt.slots = ["card-0", "card-1", "card-2"];

  const result = controller.resolveCurrentAttempt();

  assert.equal(result.status, "continue");
  assert.equal(controller.getState().session.roundIndex, 2);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/debug-refining-page.test.cjs`

Expected: FAIL because the sandbox still assumes one settlement ends the session.

- [ ] **Step 3: Reuse shared round helpers in the sandbox**

```js
// src/debug/refining-sandbox.js
function createRefiningSandboxController({ taskDef, presets }) {
  let sandboxState = {
    seed: 1,
    presetId: null,
    session: window.GAME_RUNTIME.createRefiningSessionState(taskDef, createSeededRng(1)),
    result: null,
    status: "idle",
  };

  return {
    restartFromSeed(seed) {
      const nextSeed = toSeedNumber(seed);
      sandboxState = {
        seed: nextSeed,
        presetId: null,
        session: window.GAME_RUNTIME.createRefiningSessionState(taskDef, createSeededRng(nextSeed)),
        result: null,
        status: "idle",
      };
      return sandboxState.session.attempt;
    },
    resolveCurrentAttempt() {
      const roundResult = window.GAME_RUNTIME.resolveRefiningAttempt(sandboxState.session.attempt, taskDef);
      const outcome = window.GAME_RUNTIME.settleRefiningSession(sandboxState.session, roundResult, taskDef);
      sandboxState.session = outcome.session;
      sandboxState.result = roundResult;
      sandboxState.status = outcome.status;
      return outcome;
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/debug-refining-page.test.cjs`

Expected: PASS with sandbox continuation and early-success behavior green.

- [ ] **Step 5: Commit**

```bash
git add src/debug/refining-sandbox.js tests/debug-refining-page.test.cjs
git commit -m "feat: add multi-round refining sandbox flow"
```

### Task 5: Full Verification And Manual Test Notes

**Files:**
- No new files expected unless verification reveals defects

- [ ] **Step 1: Run the full automated verification set**

Run: `node --test tests/task-config.test.cjs tests/task-system.test.cjs tests/refining-minigame.test.cjs tests/refining-view.test.cjs tests/debug-refining-page.test.cjs tests/task-flow.test.cjs tests/week-cycle.test.cjs tests/course-selection.test.cjs`

Expected: PASS with `0 fail`.

Run: `node --check main.js`

Expected: no output.

Run: `npm run encoding:check`

Expected: `encoding-guard: OK`.

- [ ] **Step 2: Perform main-game manual verification**

Run:

```powershell
cd F:\personal\game_t\xianDemo\.worktrees\artifact-task-minigame
npm run dev
```

Verify:

- complete the final weekly `craft` course and unlock the refining task
- schedule the refining task
- settle a low-score first round and confirm the game remains in task mode
- verify unused revealed cards stay revealed in round 2
- verify used cards are replaced with fresh cards in round 2
- verify success exits immediately once cumulative score reaches target
- verify failing the final configured round exits as task failure

- [ ] **Step 3: Perform debug-page manual verification**

Open `debug-refining.html` and verify:

- random start still works
- seed restart still works deterministically
- low-score preset can continue across rounds
- cumulative score and round history update after each settlement
- early success stops further rounds immediately

- [ ] **Step 4: Commit only if verification requires a code fix**

```bash
git add -A
git commit -m "fix: close refining multi-round verification gaps"
```

If verification passes without code changes, skip this commit.

## Self-Review

### Spec coverage

- configurable round count from task config: Task 1
- cumulative multi-round session state: Task 1 and Task 2
- early success / final-round failure: Task 1, Task 2, Task 4
- preserve unused cards and replace only used cards: Task 1 and Task 5
- main-game UI summary of rounds and score: Task 3
- standalone page parity: Task 4 and Task 5

### Placeholder scan

- no `TODO` or `TBD` placeholders remain
- each task includes exact files, commands, and expected outcomes
- helper names are defined before later tasks rely on them

### Type consistency

- shared round helpers are named consistently: `createRefiningSessionState`, `advanceRefiningSession`, `settleRefiningSession`
- runtime accessor naming stays consistent: `getActiveRefiningSession`
- `roundIndex`, `maxRounds`, `totalScore`, and `roundResults` are the same field names throughout the plan
