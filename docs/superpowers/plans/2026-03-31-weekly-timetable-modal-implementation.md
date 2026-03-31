# Weekly Timetable Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a top-toolbar button that opens a read-only modal showing the complete weekly timetable.

**Architecture:** Reuse the existing `info-modal` overlay and the existing `renderWeeklyTimetable()` renderer. Add one new modal kind, a small presentational helper for timetable modal HTML so it can be tested without booting `main.js`, and one timetable-specific modal width/scroll treatment in CSS.

**Tech Stack:** Static HTML, browser JavaScript with `window.GAME_RUNTIME` globals, existing overlay/modal system, Node built-in test runner.

---

## File Structure

- Modify: `index.html`
  Purpose: add the new toolbar button and load the timetable modal view helper before `main.js`.

- Modify: `data/ui.js`
  Purpose: add toolbar and modal copy for the weekly timetable button and modal title.

- Create: `src/app/info-modal-view.js`
  Purpose: hold pure modal view helpers that render the weekly timetable modal shell in a testable way.

- Modify: `main.js`
  Purpose: wire the new toolbar button, support `state.ui.infoModal = "weekly-timetable"`, and render the timetable inside the existing info modal.

- Modify: `styles.css`
  Purpose: widen the timetable modal and make its timetable body scroll cleanly.

- Modify: `tests/task-config.test.cjs`
  Purpose: assert the new toolbar button and helper script are loaded in `index.html`.

- Create: `tests/info-modal-view.test.cjs`
  Purpose: verify the timetable modal helper renders a close button, title, wrapper class, and embedded timetable HTML.

---

### Task 1: Add Testable Timetable Modal View Helpers

**Files:**
- Create: `src/app/info-modal-view.js`
- Create: `tests/info-modal-view.test.cjs`

- [ ] **Step 1: Write the failing view-helper test**

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const REPO_ROOT = path.resolve(__dirname, "..");

function loadScripts(files) {
  const context = {
    window: {
      GAME_DATA: {},
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

test("renderWeeklyTimetableModalHtml wraps read-only timetable content in modal shell", () => {
  const windowObject = loadScripts(["src/app/info-modal-view.js"]);
  const { renderWeeklyTimetableModalHtml } = windowObject.GAME_RUNTIME;

  const html = renderWeeklyTimetableModalHtml({
    title: "本周完整课表",
    closeLabel: "关闭",
    timetableHtml: '<div class="weekly-timetable-shell"><div class="week-cell fixed">丹器导论</div></div>',
  });

  assert.match(html, /本周完整课表/);
  assert.match(html, /weekly-timetable-modal/);
  assert.match(html, /id="info-close-btn"/);
  assert.match(html, /weekly-timetable-shell/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/info-modal-view.test.cjs`

Expected: FAIL with missing `renderWeeklyTimetableModalHtml`.

- [ ] **Step 3: Add the minimal view helper**

```js
// src/app/info-modal-view.js
(() => {
window.GAME_RUNTIME = window.GAME_RUNTIME || {};

function renderWeeklyTimetableModalHtml(input = {}) {
  return `
    <div class="panel-title">
      <h2>${input.title || ""}</h2>
      <button class="drawer-close" id="info-close-btn" type="button">${input.closeLabel || ""}</button>
    </div>
    <div class="modal-body weekly-timetable-modal">
      ${input.timetableHtml || ""}
    </div>
  `;
}

Object.assign(window.GAME_RUNTIME, {
  renderWeeklyTimetableModalHtml,
});
})();
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/info-modal-view.test.cjs`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/info-modal-view.js tests/info-modal-view.test.cjs
git commit -m "feat: add weekly timetable modal view helper"
```

### Task 2: Add Toolbar Entry And Static Wiring Coverage

**Files:**
- Modify: `index.html`
- Modify: `data/ui.js`
- Modify: `tests/task-config.test.cjs`

- [ ] **Step 1: Write the failing static integration test**

Add this test to `tests/task-config.test.cjs`:

```js
test("index exposes weekly timetable modal entry points", () => {
  const indexHtml = fs.readFileSync(path.join(TEST_ROOT, "index.html"), "utf8");

  assert.match(indexHtml, /id="timetable-toggle-btn"/);
  assert.match(indexHtml, /<script src="\.\/src\/app\/info-modal-view\.js"><\/script>/);
  assert.ok(indexHtml.indexOf('./src/app/info-modal-view.js') < indexHtml.indexOf('./main.js'));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/task-config.test.cjs`

Expected: FAIL because the button id and helper script are not present yet.

- [ ] **Step 3: Add the toolbar button and UI copy**

```html
<!-- index.html -->
<div class="toolbar-actions">
  <button class="ghost-button" id="stats-toggle-btn" type="button">角色状态</button>
  <button class="ghost-button" id="progress-toggle-btn" type="button">日程进度</button>
  <button class="ghost-button" id="feedback-toggle-btn" type="button">最近反馈</button>
  <button class="ghost-button" id="timetable-toggle-btn" type="button">完整课表</button>
</div>
```

```html
<!-- index.html scripts -->
<script src="./src/app/refining-view.js"></script>
<script src="./src/app/info-modal-view.js"></script>
<script src="./src/debug/state-export.js"></script>
<script type="module" src="./main.js"></script>
```

```js
// data/ui.js
toolbar: {
  statsOpen: "角色状态",
  statsClose: "收起状态",
  progress: "日程进度",
  feedback: "最近反馈",
  timetable: "完整课表",
},
infoModal: {
  memoryTitle: "灵块类型",
  memoryIntro: "...",
  memoryRulesTitle: "...",
  memoryRulesBody: "...",
  progressTitle: "当前进展",
  feedbackTitle: "最近反馈",
  timetableTitle: "本周完整课表",
},
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/task-config.test.cjs`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add index.html data/ui.js tests/task-config.test.cjs
git commit -m "feat: add weekly timetable modal entry points"
```

### Task 3: Wire The Modal Into Main Flow And Style It

**Files:**
- Modify: `main.js`
- Modify: `styles.css`
- Test: `tests/info-modal-view.test.cjs`
- Test: `tests/task-config.test.cjs`

- [ ] **Step 1: Write the failing modal helper expectation for timetable-specific wrapper class**

Extend `tests/info-modal-view.test.cjs`:

```js
  assert.match(html, /overlay-modal-timetable/);
  assert.match(html, /weekly-timetable-modal-body/);
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `node --test tests/info-modal-view.test.cjs`

Expected: FAIL because the helper does not yet emit timetable-specific wrapper classes.

- [ ] **Step 3: Update the helper, `main.js`, and CSS with minimal implementation**

```js
// src/app/info-modal-view.js
function renderWeeklyTimetableModalHtml(input = {}) {
  return `
    <div class="panel-title">
      <h2>${input.title || ""}</h2>
      <button class="drawer-close" id="info-close-btn" type="button">${input.closeLabel || ""}</button>
    </div>
    <div class="modal-body weekly-timetable-modal weekly-timetable-modal-body">
      ${input.timetableHtml || ""}
    </div>
  `;
}
```

```js
// main.js top-level DOM refs
const timetableToggleBtn = document.querySelector("#timetable-toggle-btn");
```

```js
// main.js renderInfoModal()
if (kind === "weekly-timetable") {
  infoModal.innerHTML = window.GAME_RUNTIME.renderWeeklyTimetableModalHtml({
    title: UI_TEXT.infoModal.timetableTitle,
    closeLabel: UI_TEXT.common.close,
    timetableHtml: renderWeeklyTimetable(),
  });
  infoModal.classList.add("overlay-modal-timetable");
  infoModal.querySelector("#info-close-btn").addEventListener("click", closeInfoModal);
  return;
}

infoModal.classList.remove("overlay-modal-timetable");
```

```js
// main.js button wiring
timetableToggleBtn?.addEventListener("click", () => {
  state.ui.infoModal = "weekly-timetable";
  syncUi();
});
```

```css
/* styles.css */
.overlay-modal.overlay-modal-timetable {
  width: min(920px, calc(100vw - 24px));
}

.weekly-timetable-modal-body {
  overflow: auto;
}

.weekly-timetable-modal .weekly-timetable-shell {
  min-width: 720px;
}
```

- [ ] **Step 4: Run targeted tests to verify they pass**

Run: `node --test tests/info-modal-view.test.cjs tests/task-config.test.cjs`

Expected: PASS

- [ ] **Step 5: Run broader regression checks**

Run: `node --test tests/task-flow.test.cjs tests/week-cycle.test.cjs tests/course-selection.test.cjs`

Expected: PASS

Run: `node --check main.js`

Expected: no output

- [ ] **Step 6: Commit**

```bash
git add main.js styles.css src/app/info-modal-view.js tests/info-modal-view.test.cjs tests/task-config.test.cjs
git commit -m "feat: add weekly timetable modal"
```

### Task 4: Final Verification

**Files:**
- No new files expected

- [ ] **Step 1: Run the full automated verification set**

Run: `node --test tests/task-config.test.cjs tests/task-system.test.cjs tests/refining-minigame.test.cjs tests/refining-view.test.cjs tests/debug-refining-page.test.cjs tests/task-flow.test.cjs tests/week-cycle.test.cjs tests/course-selection.test.cjs tests/info-modal-view.test.cjs`

Expected: PASS with `0 fail`

Run: `node --check main.js`

Expected: no output

Run: `npm run encoding:check`

Expected: `encoding-guard: OK`

- [ ] **Step 2: Perform manual verification**

Run:

```powershell
cd F:\personal\game_t\xianDemo
npm run dev
```

Verify:
- top toolbar shows a new `完整课表` button
- clicking it opens a modal rather than changing current mode
- modal title is `本周完整课表`
- modal displays the full weekly timetable grid
- timetable inside the modal is read-only
- close button and backdrop both close the modal
- progress/feedback modals still work after opening and closing the timetable modal

- [ ] **Step 3: Commit only if verification requires a fix**

```bash
git add -A
git commit -m "fix: close weekly timetable modal verification gaps"
```

If no fix is required, skip this commit.

## Self-Review

### Spec coverage

- top-toolbar entry: Task 2
- read-only weekly timetable modal: Task 3
- reuse of existing info modal: Task 3
- no state mutation from timetable cells: Task 3 and Task 4
- timetable readability via modal sizing/scrolling: Task 3

### Placeholder scan

- no `TODO` / `TBD`
- each task lists exact files, commands, and expected outputs
- all code steps include concrete snippets

### Type consistency

- modal kind is consistently named `weekly-timetable`
- helper is consistently named `renderWeeklyTimetableModalHtml`
- toolbar button id is consistently named `timetable-toggle-btn`
