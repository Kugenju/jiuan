# Refining Task UI And Debug Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move refining-task interaction to the left stage, reduce the right panel to summary/confirm duties, and add an isolated `debug-refining.html` page for direct refining minigame testing.

**Architecture:** Extract a shared refining presentation helper that derives stage rectangles and interaction targets from attempt state, then reuse it in both the main game task mode and a standalone debug page. Keep all rule evaluation in `src/domain/refining-minigame.js`; the new work only changes rendering, hit-testing, and debug bootstrapping.

**Tech Stack:** Browser JavaScript, canvas rendering in `main.js`, existing `window.GAME_DATA` / `window.GAME_RUNTIME` globals, Node built-in test runner (`node --test`), existing Playwright dependency only if needed later, static HTML entry pages.

---

## File Structure

- Create: `src/app/refining-view.js`
  Purpose: shared refining stage layout math, hit-testing helpers, preset deck helpers, and UI-state derivation that can be reused by the main game and standalone page.

- Create: `src/debug/refining-sandbox.js`
  Purpose: standalone refining sandbox bootstrap, seed parsing, preset switching, and right-side debug panel updates.

- Create: `debug-refining.html`
  Purpose: isolated refining debug entry page that boots directly into a playable refining attempt.

- Modify: `index.html`
  Purpose: load `src/app/refining-view.js` before `main.js`.

- Modify: `main.js`
  Purpose: route task-mode clicks through stage hit-testing, draw the triangle and board as the real interaction surface, and simplify the right panel into summary/confirm UI only.

- Modify: `src/app/keyboard-controls.js`
  Purpose: keep keyboard task navigation aligned with the new stage-first interactive order.

- Modify: `data/ui.js`
  Purpose: add stage-first task copy, debug-page labels, preset labels, and any canvas subtitle text needed by the new task layout.

- Modify: `styles.css`
  Purpose: style the simplified right-side task panel and the standalone debug page shell.

- Test: `tests/refining-view.test.cjs`
  Purpose: verify shared stage rectangles, hit-testing, and preset deck construction.

- Test: `tests/task-flow.test.cjs`
  Purpose: extend regression coverage so task mode still unlocks, enters, resolves, and returns to the day flow under the new interaction shape.

- Test: `tests/task-config.test.cjs`
  Purpose: verify `debug-refining.html` loads required scripts and boot assets in the correct order.

- Test: `tests/debug-refining-page.test.cjs`
  Purpose: verify sandbox seed restart, preset switching, and summary payload updates without the weekly shell.

---

### Task 1: Extract Shared Refining View State And Presets

**Files:**
- Create: `src/app/refining-view.js`
- Test: `tests/refining-view.test.cjs`

- [ ] **Step 1: Write the failing shared-view test**

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

test("buildRefiningStageView derives card and triangle targets for stage interaction", () => {
  const windowObject = loadScripts(["src/app/refining-view.js"]);
  const { buildRefiningStageView, hitTestRefiningStage, createRefiningPresetDecks } = windowObject.GAME_RUNTIME;

  const attempt = {
    deck: [
      { id: "c0", type: "xuantie", revealed: false, used: false },
      { id: "c1", type: "lingshi", revealed: true, used: false },
      { id: "c2", type: "guanxing", revealed: true, used: true },
      { id: "c3", type: "mujing", revealed: false, used: false },
      { id: "c4", type: "lingduan", revealed: false, used: false },
      { id: "c5", type: "xuantie", revealed: false, used: false },
      { id: "c6", type: "mujing", revealed: false, used: false },
      { id: "c7", type: "xuantie", revealed: false, used: false },
      { id: "c8", type: "lingshi", revealed: false, used: false },
    ],
    slots: [null, "c1", null],
    selectedCardId: "c1",
  };

  const view = buildRefiningStageView(attempt, {
    boardOrigin: { x: 120, y: 170 },
    cardSize: { width: 92, height: 92 },
    cardGap: { x: 18, y: 18 },
    triangleSlots: [
      { x: 560, y: 220, width: 96, height: 72 },
      { x: 500, y: 344, width: 96, height: 72 },
      { x: 620, y: 344, width: 96, height: 72 },
    ],
  });

  assert.equal(view.cards.length, 9);
  assert.equal(view.slots.length, 3);
  assert.equal(view.cards[1].isSelected, true);
  assert.equal(view.cards[2].isUsed, true);
  assert.equal(view.slots[1].cardId, "c1");

  assert.deepEqual(hitTestRefiningStage(view, 150, 200), { kind: "card", id: "c0" });
  assert.deepEqual(hitTestRefiningStage(view, 640, 370), { kind: "slot", index: 2 });
  assert.equal(hitTestRefiningStage(view, 20, 20), null);

  const presets = createRefiningPresetDecks();
  assert.deepEqual(Object.keys(presets).sort(), ["failure_basic", "guanxing_demo", "lingduan_demo", "success_basic"]);
  assert.equal(presets.success_basic.length, 9);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/refining-view.test.cjs`
Expected: FAIL with `ENOENT` for `src/app/refining-view.js` or missing exported helpers.

- [ ] **Step 3: Write the minimal shared-view implementation**

```js
(() => {
window.GAME_RUNTIME = window.GAME_RUNTIME || {};

function buildRefiningStageView(attempt, layout) {
  const cards = (attempt?.deck || []).map((card, index) => {
    const row = Math.floor(index / 3);
    const col = index % 3;
    const x = layout.boardOrigin.x + col * (layout.cardSize.width + layout.cardGap.x);
    const y = layout.boardOrigin.y + row * (layout.cardSize.height + layout.cardGap.y);
    return {
      ...card,
      x,
      y,
      width: layout.cardSize.width,
      height: layout.cardSize.height,
      isSelected: attempt?.selectedCardId === card.id,
      isUsed: Boolean(card.used),
    };
  });

  const slots = (layout.triangleSlots || []).map((slot, index) => ({
    index,
    x: slot.x,
    y: slot.y,
    width: slot.width,
    height: slot.height,
    cardId: attempt?.slots?.[index] || null,
  }));

  return { cards, slots };
}

function hitTestRect(rect, x, y) {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

function hitTestRefiningStage(view, x, y) {
  const card = view.cards.find((item) => hitTestRect(item, x, y));
  if (card) {
    return { kind: "card", id: card.id };
  }
  const slot = view.slots.find((item) => hitTestRect(item, x, y));
  if (slot) {
    return { kind: "slot", index: slot.index };
  }
  return null;
}

function createRefiningPresetDecks() {
  return {
    success_basic: ["xuantie", "xuantie", "lingshi", "mujing", "mujing", "guanxing", "lingduan", "xuantie", "mujing"],
    failure_basic: ["xuantie", "xuantie", "xuantie", "mujing", "mujing", "guanxing", "lingshi", "lingduan", "mujing"],
    guanxing_demo: ["guanxing", "xuantie", "lingshi", "mujing", "xuantie", "mujing", "lingduan", "mujing", "xuantie"],
    lingduan_demo: ["lingduan", "xuantie", "xuantie", "mujing", "lingshi", "mujing", "guanxing", "mujing", "xuantie"],
  };
}

Object.assign(window.GAME_RUNTIME, {
  buildRefiningStageView,
  hitTestRefiningStage,
  createRefiningPresetDecks,
});
})();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/refining-view.test.cjs`
Expected: PASS with `1 test` and `0 fail`.

- [ ] **Step 5: Commit**

```bash
git add src/app/refining-view.js tests/refining-view.test.cjs
git commit -m "feat: add refining stage view helpers"
```

### Task 2: Move In-Game Refining Interaction To The Left Stage

**Files:**
- Modify: `main.js`
- Modify: `src/app/keyboard-controls.js`
- Modify: `data/ui.js`
- Modify: `styles.css`
- Test: `tests/task-flow.test.cjs`

- [ ] **Step 1: Write the failing task-mode interaction regression test**

```js
test("task mode uses stage hit targets for reveal and placement while panel stays summary-only", () => {
  const windowObject = loadScripts(["src/app/refining-view.js"]);
  const { buildRefiningStageView, hitTestRefiningStage } = windowObject.GAME_RUNTIME;

  const attempt = {
    deck: [
      { id: "c0", type: "xuantie", revealed: false, used: false },
      { id: "c1", type: "lingshi", revealed: true, used: false },
      { id: "c2", type: "mujing", revealed: false, used: false },
      { id: "c3", type: "mujing", revealed: false, used: false },
      { id: "c4", type: "lingduan", revealed: false, used: false },
      { id: "c5", type: "xuantie", revealed: false, used: false },
      { id: "c6", type: "mujing", revealed: false, used: false },
      { id: "c7", type: "mujing", revealed: false, used: false },
      { id: "c8", type: "xuantie", revealed: false, used: false },
    ],
    slots: [null, null, null],
    selectedCardId: "c1",
  };
  const view = buildRefiningStageView(attempt, {
    boardOrigin: { x: 120, y: 170 },
    cardSize: { width: 92, height: 92 },
    cardGap: { x: 18, y: 18 },
    triangleSlots: [
      { x: 560, y: 220, width: 96, height: 72 },
      { x: 500, y: 344, width: 96, height: 72 },
      { x: 620, y: 344, width: 96, height: 72 },
    ],
  });

  assert.deepEqual(hitTestRefiningStage(view, 164, 214), { kind: "card", id: "c0" });
  assert.deepEqual(hitTestRefiningStage(view, 548, 380), { kind: "slot", index: 1 });
});
```

Add a second assertion block in `tests/task-flow.test.cjs` that checks the rendered task panel HTML does not include `data-task-card=` after the UI change. Build the HTML through a small helper exported from `main.js` or a new pure function if needed.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/refining-view.test.cjs tests/task-flow.test.cjs`
Expected: FAIL because task interaction is still wired to right-panel card buttons and the panel still renders `data-task-card`.

- [ ] **Step 3: Implement stage-first task interaction and panel simplification**

```js
// main.js
const REFINING_STAGE_LAYOUT = {
  boardOrigin: { x: 120, y: 170 },
  cardSize: { width: 92, height: 92 },
  cardGap: { x: 18, y: 18 },
  triangleSlots: [
    { x: 560, y: 220, width: 96, height: 72 },
    { x: 500, y: 344, width: 96, height: 72 },
    { x: 620, y: 344, width: 96, height: 72 },
  ],
};

function getTaskStageView(rootState = state) {
  return buildRefiningStageView(getActiveTaskRuntime(rootState).refining, REFINING_STAGE_LAYOUT);
}

canvas.addEventListener("click", (event) => {
  if (state.mode !== "task") {
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
  const target = hitTestRefiningStage(getTaskStageView(state), x, y);
  if (!target) {
    return;
  }
  if (target.kind === "card") {
    revealOrSelectTaskCard(target.id);
    return;
  }
  placeSelectedTaskCard(target.index);
});
```

```js
// main.js inside renderTaskPanel()
const slotsSummaryHtml = (attempt?.slots || [null, null, null])
  .map((cardId, index) => `
    <div class="task-slot-summary ${cardId ? "filled" : ""}">
      <strong>${typeof taskText.slot === "function" ? taskText.slot(index) : `槽位 ${index + 1}`}</strong>
      <small>${cardId ? getRefiningCardLabel(cardId) : taskText.emptySlot}</small>
    </div>
  `)
  .join("");

mainPanel.innerHTML = `
  <div class="planning-shell task-summary-shell">
    <div class="panel-title">
      <h2>${taskText.title}</h2>
      <span class="badge">${taskText.remainingDays(remainingDays)}</span>
    </div>
    <div class="story-card focus-callout">
      <strong>${activity.name}</strong>
      <small>${activity.summary || ""}</small>
      <small>${taskText.attemptCount(task.attemptCount || 0)}</small>
    </div>
    <div class="planning-meta-grid">
      <div class="story-card">
        <strong>${taskText.objective}</strong>
        <small>${objectiveName}</small>
        <small>${taskText.scoreTarget(taskDef?.objective?.scoreTarget || 0)}</small>
      </div>
      <div class="story-card">
        <strong>${taskText.requirement}</strong>
        <small>${taskText.requirements(requirementText)}</small>
        <small>${getTaskStatusText(state)}</small>
      </div>
    </div>
    <div class="task-slot-summary-grid">${slotsSummaryHtml}</div>
    <div class="story-card">
      <strong>${taskText.selected}</strong>
      <small>${selectedCard ? getRefiningCardLabel(selectedCard) : taskText.noSelection}</small>
      <small>${getTaskStatusText(state)}</small>
    </div>
    <div class="action-row planning-actions">
      <button class="primary" id="task-confirm-btn" data-task-control="confirm" ${canConfirm ? "" : "disabled"}>${taskText.confirm}</button>
    </div>
  </div>
`;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/refining-view.test.cjs tests/task-flow.test.cjs`
Expected: PASS with no `data-task-card` panel regression and stage hit-testing green.

- [ ] **Step 5: Commit**

```bash
git add main.js src/app/keyboard-controls.js data/ui.js styles.css tests/task-flow.test.cjs tests/refining-view.test.cjs
git commit -m "feat: move refining task interaction to stage"
```

### Task 3: Add Standalone Refining Debug Page With Seed And Presets

**Files:**
- Create: `src/debug/refining-sandbox.js`
- Create: `debug-refining.html`
- Modify: `styles.css`
- Modify: `data/ui.js`
- Test: `tests/debug-refining-page.test.cjs`
- Test: `tests/task-config.test.cjs`

- [ ] **Step 1: Write the failing standalone-page tests**

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
    document: {
      querySelector: () => null,
    },
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

test("refining sandbox can create attempts from seed and presets", () => {
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

  const seeded = controller.restartFromSeed(7);
  const preset = controller.restartFromPreset("success_basic");

  assert.equal(seeded.deck.length, 9);
  assert.equal(preset.deck[0].type, "xuantie");
  assert.equal(controller.getState().presetId, "success_basic");
});
```

Extend `tests/task-config.test.cjs` with an assertion that `debug-refining.html` includes:

```js
assert.match(debugHtml, /<script src="\.\/src\/debug\/refining-sandbox\.js"><\/script>/);
assert.match(debugHtml, /id="refining-debug-app"/);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/debug-refining-page.test.cjs tests/task-config.test.cjs`
Expected: FAIL with missing `debug-refining.html` and `src/debug/refining-sandbox.js`.

- [ ] **Step 3: Write the standalone debug page implementation**

```js
// src/debug/refining-sandbox.js
(() => {
window.GAME_RUNTIME = window.GAME_RUNTIME || {};

function createSeededRng(seed = 1) {
  let value = Number(seed) >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createRefiningSandboxController({ taskDef, presets }) {
  let sandboxState = {
    seed: 1,
    presetId: null,
    attempt: window.GAME_RUNTIME.createRefiningAttemptState(taskDef, createSeededRng(1)),
    result: null,
  };

  return {
    restartFromSeed(seed) {
      sandboxState = {
        seed,
        presetId: null,
        attempt: window.GAME_RUNTIME.createRefiningAttemptState(taskDef, createSeededRng(seed)),
        result: null,
      };
      return sandboxState.attempt;
    },
    restartFromPreset(presetId) {
      const types = presets[presetId];
      sandboxState = {
        seed: sandboxState.seed,
        presetId,
        attempt: window.GAME_RUNTIME.createRefiningAttemptState(taskDef, createSeededRng(sandboxState.seed)),
        result: null,
      };
      sandboxState.attempt.deck = types.map((type, index) => ({ id: `card-${index}`, type, revealed: false, used: false }));
      return sandboxState.attempt;
    },
    getState() {
      return sandboxState;
    },
  };
}

Object.assign(window.GAME_RUNTIME, {
  createSeededRng,
  createRefiningSandboxController,
});
})();
```

```html
<!-- debug-refining.html -->
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>炼器调试页</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body class="debug-refining-page">
    <div id="refining-debug-app"></div>
    <script src="./data/tasks.js"></script>
    <script src="./data/ui.js"></script>
    <script src="./src/domain/refining-minigame.js"></script>
    <script src="./src/app/refining-view.js"></script>
    <script src="./src/debug/refining-sandbox.js"></script>
  </body>
</html>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/debug-refining-page.test.cjs tests/task-config.test.cjs`
Expected: PASS with sandbox controller and HTML script-load assertions green.

- [ ] **Step 5: Commit**

```bash
git add src/debug/refining-sandbox.js debug-refining.html styles.css data/ui.js tests/debug-refining-page.test.cjs tests/task-config.test.cjs
git commit -m "feat: add standalone refining debug page"
```

### Task 4: Wire Shared Rendering Into The Debug Page And Finalize UI Copy

**Files:**
- Modify: `src/debug/refining-sandbox.js`
- Modify: `src/app/refining-view.js`
- Modify: `data/ui.js`
- Modify: `styles.css`
- Test: `tests/debug-refining-page.test.cjs`

- [ ] **Step 1: Extend the failing sandbox test to cover preset result output**

```js
test("refining sandbox resolves a preset and exposes score summary", () => {
  const windowObject = loadScripts([
    "data/tasks.js",
    "src/domain/refining-minigame.js",
    "src/app/refining-view.js",
    "src/debug/refining-sandbox.js",
  ]);
  const { TASK_DEFS } = windowObject.GAME_DATA;
  const { createRefiningSandboxController, resolveRefiningAttempt } = windowObject.GAME_RUNTIME;

  const controller = createRefiningSandboxController({
    taskDef: TASK_DEFS.artifact_refining,
    presets: windowObject.GAME_RUNTIME.createRefiningPresetDecks(),
  });
  const attempt = controller.restartFromPreset("success_basic");

  attempt.deck.forEach((card) => {
    card.revealed = true;
  });
  attempt.slots = ["card-0", "card-1", "card-2"];
  const result = resolveRefiningAttempt(attempt, TASK_DEFS.artifact_refining);

  assert.equal(result.complete, true);
  assert.equal(result.success, true);
  assert.equal(typeof result.recipeKey, "string");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/debug-refining-page.test.cjs`
Expected: FAIL because the sandbox does not yet update or surface a usable result summary flow.

- [ ] **Step 3: Implement final sandbox rendering and copy plumbing**

```js
// src/debug/refining-sandbox.js
function renderSandbox(root, sandboxState, helpers) {
  const view = helpers.buildRefiningStageView(sandboxState.attempt, helpers.layout);
  const result = sandboxState.result;

  root.innerHTML = `
    <main class="debug-refining-shell">
      <section class="debug-refining-stage">
        <canvas id="debug-refining-canvas" width="960" height="540"></canvas>
      </section>
      <aside class="debug-refining-panel">
        <label>Seed <input id="debug-seed-input" value="${sandboxState.seed}" /></label>
        <button id="debug-seed-restart-btn">按 seed 重开</button>
        <div class="debug-preset-grid">
          <button data-preset="success_basic">稳定成功</button>
          <button data-preset="failure_basic">稳定失败</button>
          <button data-preset="guanxing_demo">带观星</button>
          <button data-preset="lingduan_demo">带灵锻</button>
        </div>
        <div class="story-card">
          <strong>当前结果</strong>
          <small>${result ? `得分 ${result.score} / ${result.recipeKey}` : "尚未结算"}</small>
          <small>${result ? (result.success ? "成功" : "失败") : "等待结算"}</small>
        </div>
        <button id="debug-confirm-btn">结算</button>
      </aside>
    </main>
  `;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/debug-refining-page.test.cjs`
Expected: PASS with sandbox result summary assertions green.

- [ ] **Step 5: Commit**

```bash
git add src/debug/refining-sandbox.js src/app/refining-view.js data/ui.js styles.css tests/debug-refining-page.test.cjs
git commit -m "feat: finish refining sandbox controls"
```

### Task 5: Full Verification And Manual Test Notes

**Files:**
- Modify: `docs/superpowers/specs/2026-03-31-refining-task-ui-and-debug-page-design.md` (only if acceptance wording needs alignment after implementation)
- No code changes expected unless verification reveals defects

- [ ] **Step 1: Run the full automated verification set**

Run: `node --test tests/task-config.test.cjs tests/task-system.test.cjs tests/refining-minigame.test.cjs tests/refining-view.test.cjs tests/debug-refining-page.test.cjs tests/task-flow.test.cjs tests/week-cycle.test.cjs tests/course-selection.test.cjs`
Expected: PASS with `0 fail`.

Run: `node --check main.js`
Expected: no output.

Run: `npm run encoding:check`
Expected: `encoding-guard: OK`.

- [ ] **Step 2: Perform the main-game manual verification**

Run:

```powershell
cd F:\personal\game_t\xianDemo\.worktrees\artifact-task-minigame
npm run dev
```

Verify:

- complete a week containing `《本命法宝智能系统》`
- after the last `craft` course resolves, the unlock prompt appears immediately
- schedule `炼器任务`
- all flip/select/place interactions occur on the left stage
- the right panel shows summary and confirmation only
- confirm returns to normal resolving flow

- [ ] **Step 3: Perform the standalone-page manual verification**

Open `debug-refining.html` in the same app shell or a local static-server context and verify:

- page opens directly into a refining attempt
- seed restart changes the board deterministically
- all four presets load
- successful and failing presets produce expected score summaries

- [ ] **Step 4: Commit only if verification required a code fix**

```bash
git add -A
git commit -m "fix: close refining ui verification gaps"
```

If verification passes without new code changes, skip this commit.

## Self-Review

### Spec coverage

- left-stage primary play surface: Task 1 and Task 2
- right-panel summary-only behavior: Task 2
- standalone `debug-refining.html`: Task 3 and Task 4
- seed restart and four presets: Task 3 and Task 4
- shared rule reuse with no duplicate scoring logic: Task 1 through Task 4
- automated and manual validation: Task 5

### Placeholder scan

- no `TODO`, `TBD`, or deferred placeholders remain
- every task has exact files, commands, and expected results
- later tasks do not rely on unnamed helpers

### Type consistency

- shared helper names are consistent: `buildRefiningStageView`, `hitTestRefiningStage`, `createRefiningPresetDecks`
- sandbox helper names are consistent: `createSeededRng`, `createRefiningSandboxController`
- existing rule entry points stay unchanged: `createRefiningAttemptState`, `resolveRefiningAttempt`
