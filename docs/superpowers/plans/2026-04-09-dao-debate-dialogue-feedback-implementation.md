# Dao Debate Dialogue Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade dao debate round feedback so the left panel shows player line first, then Miao Zai'ou reply, with previous rounds viewable in an overlay modal.

**Architecture:** Keep authored dialogue content in `data/tasks.js`, keep round exchange assembly in `src/domain/dao-debate-minigame.js`, and keep reveal timing/modal orchestration in `main.js`. Reuse existing `state.ui.infoModal` overlay channel and existing dao debate right-panel renderer. Preserve current scoring and task settlement behavior.

**Tech Stack:** Plain JavaScript, existing browser runtime, Node.js `node:test`

---

## File Structure And Responsibilities

- `data/tasks.js` (modify): add per-card `line` and per-followup `reply` content.
- `src/domain/dao-debate-minigame.js` (modify): emit normalized exchange payloads and keep `latestExchange` in session state.
- `src/domain/task-system.js` (modify): extend base task runtime shape with debate presentation state.
- `src/app/session.js` (modify): keep task runtime fallback shape synchronized.
- `src/app/day-flow.js` (modify): keep task runtime test doubles/fallback shape synchronized.
- `src/app/dao-debate-view.js` (modify): optionally support disabled card controls from input state.
- `main.js` (modify): orchestrate two-beat reveal timing, left panel exchange rendering, and dao debate history modal.
- `data/ui.js` (modify): add left-panel labels and modal labels for dialogue/history.
- `tests/task-config.test.cjs` (modify): assert new `line`/`reply` content exists.
- `tests/dao-debate-minigame.test.cjs` (modify): assert exchange payload creation and `latestExchange` update.
- `tests/task-system.test.cjs` (modify): assert runtime shape includes debate presentation state.
- `tests/task-flow.test.cjs` (modify): assert two-beat left-panel behavior and history modal behavior.
- `tests/dao-debate-view.test.cjs` (modify): assert debate card buttons can render disabled in reveal-lock state.

### Task 1: Add Dialogue Content Definitions

**Files:**
- Modify: `data/tasks.js`
- Modify: `tests/task-config.test.cjs`

- [ ] **Step 1: Write failing config assertions for player lines and follow-up replies**

```js
assert.equal(typeof DAO_DEBATE_CARDS.uphold_principle.line, "string");
assert.match(DAO_DEBATE_CARDS.uphold_principle.line, /\S/);
assert.equal(typeof DAO_DEBATE_CARDS.weigh_outcomes.line, "string");
assert.equal(typeof DAO_DEBATE_CARDS.archive_case_note.line, "string");

assert.equal(typeof DAO_DEBATE_FOLLOWUPS.press_principle.reply, "string");
assert.equal(typeof DAO_DEBATE_FOLLOWUPS.press_utility.reply, "string");
assert.equal(typeof DAO_DEBATE_FOLLOWUPS.press_authority.reply, "string");
assert.equal(typeof DAO_DEBATE_FOLLOWUPS.press_evasion.reply, "string");
```

- [ ] **Step 2: Run config tests to verify red**

Run: `node --test tests/task-config.test.cjs`  
Expected: FAIL because `line` / `reply` do not exist yet.

- [ ] **Step 3: Add card lines and follow-up replies**

```js
const DAO_DEBATE_CARDS = {
  uphold_principle: {
    id: "uphold_principle",
    label: "守其本义",
    tag: "principle",
    line: "我不回避代价，但有些底线若先退一步，后面的万种便利都会失去凭依。",
  },
  // ...other cards with `line`
};

const DAO_DEBATE_FOLLOWUPS = {
  press_principle: {
    id: "press_principle",
    label: "逼问义理",
    prompt: "...",
    reply: "你说守义，可若义理只能在顺手时成立，它到底是准绳，还是替自己留的台阶？",
  },
  // ...other followups with `reply`
};
```

- [ ] **Step 4: Run config tests to verify green**

Run: `node --test tests/task-config.test.cjs`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add data/tasks.js tests/task-config.test.cjs
git commit -m "feat: add dao debate dialogue copy definitions"
```

### Task 2: Extend Dao Debate Domain Exchange State

**Files:**
- Modify: `src/domain/dao-debate-minigame.js`
- Modify: `tests/dao-debate-minigame.test.cjs`

- [ ] **Step 1: Write failing domain tests for exchange payload**

```js
assert.equal(typeof next.latestExchange.playerLine, "string");
assert.equal(typeof next.latestExchange.replyLine, "string");
assert.equal(next.latestExchange.cardId, "weigh_outcomes");
assert.equal(next.latestExchange.promptType, "opening");
assert.equal(next.history.at(-1).playerLine, next.latestExchange.playerLine);
assert.equal(next.history.at(-1).replyLine, next.latestExchange.replyLine);
```

- [ ] **Step 2: Run domain tests to verify red**

Run: `node --test tests/dao-debate-minigame.test.cjs`  
Expected: FAIL because `latestExchange` / dialogue fields are missing.

- [ ] **Step 3: Implement exchange creation and session state updates**

```js
function buildExchangeRecord(session, card, scoreType, followupType) {
  const promptType = session.currentPrompt?.followupType || "opening";
  const reply = window.GAME_DATA.DAO_DEBATE_FOLLOWUPS?.[followupType]?.reply || "";
  return {
    roundIndex: session.roundIndex,
    cardId: card.id,
    cardLabel: card.label || "",
    playerLine: card.line || "",
    replyLine: reply,
    promptType,
    nextFollowupType: followupType,
    scoreType,
  };
}

function createDaoDebateSessionState(taskDef, taskInstance, rng) {
  return {
    // ...existing fields
    history: [],
    latestExchange: null,
    result: null,
  };
}

// inside playDaoDebateCard()
const followupType = getFollowupTypeForTag(card.tag);
const exchange = buildExchangeRecord(session, card, scoreType, followupType);
const nextSession = {
  ...session,
  latestExchange: exchange,
  history: (session.history || []).concat([exchange]),
  // ...existing score/round updates
};
```

- [ ] **Step 4: Run domain tests to verify green**

Run: `node --test tests/dao-debate-minigame.test.cjs`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/dao-debate-minigame.js tests/dao-debate-minigame.test.cjs
git commit -m "feat: record dao debate exchange dialogue"
```

### Task 3: Add Debate Presentation State And Control Lock

**Files:**
- Modify: `src/domain/task-system.js`
- Modify: `src/app/session.js`
- Modify: `src/app/day-flow.js`
- Modify: `src/app/dao-debate-view.js`
- Modify: `tests/task-system.test.cjs`
- Modify: `tests/dao-debate-view.test.cjs`

- [ ] **Step 1: Write failing tests for runtime shape + disabled controls**

```js
assert.deepEqual(realmSafe(createTaskRuntimeState()), {
  activeTaskId: null,
  pendingSlotIndex: null,
  mode: null,
  result: null,
  refining: null,
  debate: null,
  debatePresentation: { stage: "idle", revealTimerId: null },
});
```

```js
const panelState = buildDaoDebateTaskPanelState({
  // ...existing input
  controlsDisabled: true,
});
const html = renderDaoDebateTaskPanelHtml(panelState);
assert.match(html, /data-task-control="debate-card"/);
assert.match(html, /disabled/);
```

- [ ] **Step 2: Run targeted tests to verify red**

Run: `node --test tests/task-system.test.cjs tests/dao-debate-view.test.cjs`  
Expected: FAIL.

- [ ] **Step 3: Implement runtime shape + disabled-card rendering**

```js
// createTaskRuntimeState() in task-system/session/day-flow fallbacks
debatePresentation: {
  stage: "idle",
  revealTimerId: null,
},
```

```js
// dao-debate-view.js
function buildDaoDebateTaskPanelState(input) {
  return {
    // ...existing fields
    controlsDisabled: Boolean(input?.controlsDisabled),
  };
}

// in cardsHtml template:
<button ... ${panelState?.controlsDisabled ? "disabled" : ""}>
```

- [ ] **Step 4: Run targeted tests to verify green**

Run: `node --test tests/task-system.test.cjs tests/dao-debate-view.test.cjs`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/task-system.js src/app/session.js src/app/day-flow.js src/app/dao-debate-view.js tests/task-system.test.cjs tests/dao-debate-view.test.cjs
git commit -m "feat: add dao debate presentation state"
```

### Task 4: Wire Two-Beat Reveal And History Modal

**Files:**
- Modify: `main.js`
- Modify: `data/ui.js`
- Modify: `tests/task-flow.test.cjs`

- [ ] **Step 1: Write failing task-flow tests for staged reveal and history modal**

```js
assert.match(elements.get("#left-panel").innerHTML, /你的回应/);
assert.match(elements.get("#left-panel").innerHTML, /守其本义/);
assert.doesNotMatch(elements.get("#left-panel").innerHTML, /妙哉偶回应/);
```

```js
await new Promise((resolve) => setTimeout(resolve, 450));
api.syncUi();
assert.match(elements.get("#left-panel").innerHTML, /妙哉偶回应/);
assert.match(elements.get("#left-panel").innerHTML, /查看前几轮/);
```

```js
api.state.ui.infoModal = "dao-debate-history";
api.syncUi();
assert.match(elements.get("#info-modal").innerHTML, /第 1 轮/);
assert.match(elements.get("#info-modal").innerHTML, /你的回应/);
```

- [ ] **Step 2: Run flow tests to verify red**

Run: `node --test tests/task-flow.test.cjs`  
Expected: FAIL because staged reveal/modal branch do not exist.

- [ ] **Step 3: Implement reveal sequencing + modal + left panel**

```js
const DAO_DEBATE_REPLY_REVEAL_MS = 420;

function clearDaoDebateRevealTimer(rootState = state) {
  const timerId = getActiveTaskRuntime(rootState).debatePresentation?.revealTimerId;
  if (timerId) clearTimeout(timerId);
  if (getActiveTaskRuntime(rootState).debatePresentation) {
    getActiveTaskRuntime(rootState).debatePresentation.revealTimerId = null;
  }
}

function beginDaoDebateReveal() {
  const presentation = state.taskRuntime.debatePresentation;
  presentation.stage = "player_only";
  clearDaoDebateRevealTimer(state);
  presentation.revealTimerId = setTimeout(() => {
    if (state.mode !== "task" || !getActiveDaoDebateSession(state)) return;
    presentation.stage = "full";
    presentation.revealTimerId = null;
    syncUi();
  }, DAO_DEBATE_REPLY_REVEAL_MS);
}
```

```js
// in playDaoDebateCardFromUi:
if (state.taskRuntime.debatePresentation?.stage === "player_only") return false;
// after nextSession assignment:
beginDaoDebateReveal();
if (!nextSession.result) {
  syncUi();
  return true;
}
// final handoff moved into reveal timer callback after stage reaches "full"
```

```js
// renderInfoModal() add branch:
if (kind === "dao-debate-history") {
  infoModal.innerHTML = renderDaoDebateHistoryModalHtml({
    title: UI_TEXT.infoModal.daoDebateHistoryTitle,
    closeLabel: UI_TEXT.common.close,
    rounds: getDaoDebateHistoryForModal(state),
  });
  infoModal.querySelector("#info-close-btn").addEventListener("click", closeInfoModal);
  return;
}
```

```js
// renderLeftPanel() dao_debate branch:
<small>${UI_TEXT.left.daoDebatePlayerLabel}</small>
<small>${escapeHtml(latestExchange?.playerLine || fallbackPrompt)}</small>
${presentation.stage === "full" ? `<small>${UI_TEXT.left.daoDebateReplyLabel}</small><small>${escapeHtml(latestExchange?.replyLine || "")}</small>` : ""}
${historyCount > 0 ? `<button class="ghost-button" id="dao-debate-history-btn" type="button">${UI_TEXT.left.daoDebateHistoryBtn}</button>` : ""}
```

- [ ] **Step 4: Run flow tests to verify green**

Run: `node --test tests/task-flow.test.cjs`  
Expected: PASS.

- [ ] **Step 5: Run full suite and commit**

Run: `npm test`  
Expected: PASS (`0 fail`).

```bash
git add main.js data/ui.js tests/task-flow.test.cjs
git commit -m "feat: add staged dao debate dialogue feedback and history modal"
```

## Self-Review

### Spec Coverage

- left panel staged dialogue (`player -> reply`) is covered in Task 4.
- previous-round modal history is covered in Task 4.
- per-card player lines and per-followup replies are covered in Task 1.
- domain ownership of exchange assembly is covered in Task 2.
- temporary control lock and runtime presentation state are covered in Task 3.
- regression safety via domain/view/flow/config tests is covered in Tasks 1-4.

### Placeholder Scan

- no TODO/TBD placeholders.
- each task has explicit files, concrete test commands, and expected outcomes.
- each code step includes concrete code shape, not abstract prose-only instructions.

### Type Consistency

- runtime key naming is consistently `debatePresentation`.
- exchange key naming is consistently `latestExchange`, `playerLine`, `replyLine`.
- modal kind naming is consistently `dao-debate-history`.
