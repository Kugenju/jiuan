# Classical CSS Visual Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the UI from dark sci-fi styling to a light-paper, xianxia-cool visual system across all major surfaces while keeping gameplay behavior unchanged.

**Architecture:** Keep existing selectors and layout structure intact, then migrate style behavior through a token-first refresh in `:root` plus targeted component remapping in `styles.css`. Guard the change with a lightweight CSS contract test (`node:test`) that checks required theme tokens/selectors and catches accidental regressions.

**Tech Stack:** Plain CSS, Node.js `node:test`, existing static HTML/JS rendering flow

---

## File Structure And Responsibilities

- `styles.css` (modify): implement the complete visual refresh (global tokens, backgrounds, cards, controls, status, overlay, memory tuning, responsive adjustments).
- `tests/classical-css-theme.test.cjs` (create/modify): verify critical CSS contract (new token set and key selector rules for readability/state clarity).
- `docs/superpowers/specs/2026-04-03-classical-css-visual-refresh-design.md` (reference only): source of truth for style requirements.

### Task 1: Build Theme Contract Test + Token Foundation

**Files:**
- Create: `tests/classical-css-theme.test.cjs`
- Modify: `styles.css`
- Test: `tests/classical-css-theme.test.cjs`

- [ ] **Step 1: Write the failing test**

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const cssPath = path.join(__dirname, "..", "styles.css");
const css = fs.readFileSync(cssPath, "utf8");

function expectContains(fragment, message) {
  assert.equal(css.includes(fragment), true, message);
}

test("classical theme defines light-paper xianxia token system", () => {
  expectContains("--paper-bg-top:", "missing paper top background token");
  expectContains("--paper-bg-bottom:", "missing paper bottom background token");
  expectContains("--ink-strong:", "missing ink strong token");
  expectContains("--ink-muted:", "missing ink muted token");
  expectContains("--accent-daiqing:", "missing primary accent token");
  expectContains("--accent-gold-soft:", "missing gold accent token");
});

test("global shell switches to light paper background", () => {
  expectContains("background: linear-gradient(160deg, var(--paper-bg-top)", "body should use paper gradient");
  expectContains("color: var(--ink-strong);", "global text should use ink strong token");
});

test("panel baseline uses paper surface style", () => {
  expectContains(".panel-card {", "panel-card rule missing");
  expectContains("background: var(--paper-panel-strong);", "panel-card should use paper panel background");
  expectContains("border: 1px solid var(--line-soft);", "panel-card should use soft contour line");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/classical-css-theme.test.cjs`  
Expected: FAIL with missing token/assertion messages because the current CSS is still dark sci-fi.

- [ ] **Step 3: Write minimal implementation in `styles.css` (token + shell foundation)**

```css
:root {
  --paper-bg-top: #f4efe3;
  --paper-bg-mid: #eef1ea;
  --paper-bg-bottom: #e6ece8;
  --paper-panel: rgba(252, 249, 241, 0.74);
  --paper-panel-strong: rgba(250, 246, 236, 0.92);
  --line-soft: rgba(71, 98, 93, 0.22);
  --line-strong: rgba(55, 84, 78, 0.34);
  --ink-strong: #1e2a2a;
  --ink-muted: #5d6f6c;
  --accent-daiqing: #2f6b66;
  --accent-daiqing-soft: rgba(47, 107, 102, 0.14);
  --accent-gold-soft: #b79556;
  --accent-cinnabar-soft: #9a5b4f;
  --shadow-soft: 0 16px 32px rgba(45, 56, 54, 0.12);
  --shadow-card: 0 8px 22px rgba(44, 56, 53, 0.1);

  /* Compatibility aliases for existing selectors before full migration */
  --bg: var(--paper-bg-bottom);
  --bg-soft: var(--paper-bg-mid);
  --panel: var(--paper-panel);
  --panel-strong: var(--paper-panel-strong);
  --line: var(--line-soft);
  --text: var(--ink-strong);
  --muted: var(--ink-muted);
  --gold: var(--accent-gold-soft);
  --jade: var(--accent-daiqing);
  --rose: var(--accent-cinnabar-soft);
  --sky: #6a8a84;
  --shadow: var(--shadow-soft);
}

html,
body {
  color: var(--ink-strong);
  background: linear-gradient(
    160deg,
    var(--paper-bg-top) 0%,
    var(--paper-bg-mid) 48%,
    var(--paper-bg-bottom) 100%
  );
}

body::before {
  opacity: 0.11;
  background-image:
    radial-gradient(circle at 20% 16%, rgba(154, 170, 161, 0.14), transparent 42%),
    radial-gradient(circle at 82% 74%, rgba(141, 167, 160, 0.11), transparent 40%),
    linear-gradient(rgba(88, 110, 103, 0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(88, 110, 103, 0.04) 1px, transparent 1px);
}

.panel-card {
  background: var(--paper-panel-strong);
  border: 1px solid var(--line-soft);
  box-shadow: var(--shadow-card);
  backdrop-filter: blur(3px);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/classical-css-theme.test.cjs`  
Expected: PASS for all Task 1 tests.

- [ ] **Step 5: Commit**

```bash
git add styles.css tests/classical-css-theme.test.cjs
git commit -m "feat(css): add classical light-paper theme tokens and baseline"
```

### Task 2: Refresh Cards, Buttons, and Interaction States

**Files:**
- Modify: `styles.css`
- Modify: `tests/classical-css-theme.test.cjs`
- Test: `tests/classical-css-theme.test.cjs`

- [ ] **Step 1: Extend failing test for interaction and component language**

```js
test("interactive cards use daiqing tint instead of neon glow", () => {
  expectContains(".slot-card.active,", "active card selector missing");
  expectContains("background: var(--accent-daiqing-soft);", "active card should use daiqing soft tint");
  expectContains("border-color: rgba(47, 107, 102, 0.56);", "active card border should use restrained daiqing");
});

test("buttons use paper baseline and readable hover/primary states", () => {
  expectContains(".action-row button,\n.ghost-button {", "button baseline selector missing");
  expectContains("background: rgba(250, 246, 236, 0.9);", "button baseline should be paper-like");
  expectContains(".action-row button.primary,", "primary selector missing");
  expectContains("linear-gradient(135deg, rgba(47, 107, 102, 0.22), rgba(96, 132, 121, 0.14))", "primary button gradient missing");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/classical-css-theme.test.cjs`  
Expected: FAIL for new interaction assertions.

- [ ] **Step 3: Update component and button styling**

```css
.metric,
.slot-card,
.activity-card,
.choice-card,
.memory-cell,
.memory-piece,
.log-entry,
.story-card {
  border: 1px solid rgba(77, 103, 96, 0.2);
  background: rgba(252, 249, 241, 0.72);
}

.slot-card:hover,
.activity-card:hover,
.choice-card:hover,
.memory-piece:hover,
.memory-cell:hover,
.action-row button:hover {
  transform: translateY(-1px);
  border-color: rgba(47, 107, 102, 0.46);
  background: rgba(246, 242, 232, 0.94);
}

.slot-card.active,
.activity-card.active,
.choice-card.active,
.memory-piece.active,
.memory-cell.active {
  border-color: rgba(47, 107, 102, 0.56);
  background: var(--accent-daiqing-soft);
}

.action-row button,
.ghost-button {
  border: 1px solid rgba(67, 99, 93, 0.38);
  background: rgba(250, 246, 236, 0.9);
  color: var(--ink-strong);
}

.action-row button.primary,
.ghost-button.primary {
  background: linear-gradient(
    135deg,
    rgba(47, 107, 102, 0.22),
    rgba(96, 132, 121, 0.14)
  );
  border-color: rgba(47, 107, 102, 0.52);
}

.action-row button.warn {
  background: rgba(154, 91, 79, 0.12);
  border-color: rgba(154, 91, 79, 0.38);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/classical-css-theme.test.cjs`  
Expected: PASS for token + component + interaction tests.

- [ ] **Step 5: Commit**

```bash
git add styles.css tests/classical-css-theme.test.cjs
git commit -m "feat(css): remap cards and controls to classical interaction style"
```

### Task 3: Refresh Status, Overlay, Memory Section, and Mobile Softness Fixes

**Files:**
- Modify: `styles.css`
- Modify: `tests/classical-css-theme.test.cjs`
- Test: `tests/classical-css-theme.test.cjs`

- [ ] **Step 1: Extend failing test for status/overlay/responsive rules**

```js
test("status and highlight components use consistent classical accents", () => {
  expectContains(".badge {", "badge selector missing");
  expectContains("color: var(--accent-gold-soft);", "badge should use soft gold accent");
  expectContains(".phase-card.current {", "current phase selector missing");
  expectContains("border-color: rgba(47, 107, 102, 0.5);", "current phase should use daiqing border");
});

test("overlay uses mist-style backdrop and paper modal", () => {
  expectContains(".overlay-backdrop {", "overlay backdrop selector missing");
  expectContains("background: rgba(64, 79, 76, 0.24);", "overlay backdrop should be light mist");
  expectContains(".modal-rule {", "modal-rule selector missing");
  expectContains("background: rgba(252, 248, 238, 0.82);", "modal-rule should use paper tone");
});

test("mobile breakpoint reinforces contour contrast for light theme", () => {
  expectContains("@media (max-width: 720px)", "mobile breakpoint missing");
  expectContains("border-color: rgba(67, 99, 93, 0.42);", "mobile contour reinforcement missing");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/classical-css-theme.test.cjs`  
Expected: FAIL for newly added status/overlay/mobile assertions.

- [ ] **Step 3: Implement status, overlay, memory tuning, and mobile adjustments**

```css
.badge {
  background: rgba(183, 149, 86, 0.14);
  border: 1px solid rgba(183, 149, 86, 0.28);
  color: var(--accent-gold-soft);
}

.phase-card.current {
  border-color: rgba(47, 107, 102, 0.5);
  background: rgba(47, 107, 102, 0.12);
}

.phase-card.done {
  border-color: rgba(183, 149, 86, 0.46);
  background: rgba(183, 149, 86, 0.11);
}

.overlay-backdrop {
  background: rgba(64, 79, 76, 0.24);
  backdrop-filter: blur(3px);
}

.modal-rule {
  border: 1px solid rgba(77, 103, 96, 0.22);
  background: rgba(252, 248, 238, 0.82);
}

.memory-stage,
.memory-hex-board,
.memory-fragment-field {
  border-color: rgba(77, 103, 96, 0.24);
  box-shadow: 0 10px 24px rgba(45, 56, 54, 0.09);
}

@media (max-width: 720px) {
  .panel-card,
  .slot-card,
  .activity-card,
  .choice-card,
  .week-cell,
  .week-day-head {
    border-color: rgba(67, 99, 93, 0.42);
  }
}
```

- [ ] **Step 4: Run full test pass**

Run: `node --test tests/classical-css-theme.test.cjs`  
Expected: PASS across all theme contract tests.

- [ ] **Step 5: Commit**

```bash
git add styles.css tests/classical-css-theme.test.cjs
git commit -m "feat(css): complete classical status overlay memory and mobile tuning"
```

### Task 4: End-to-End Verification and Final Cleanup

**Files:**
- Modify: `styles.css` (only if defects found during verification)
- Test: `tests/classical-css-theme.test.cjs`

- [ ] **Step 1: Run existing focused tests to ensure no obvious UI rendering regressions**

Run:

```bash
node --test tests/refining-view.test.cjs
node --test tests/info-modal-view.test.cjs
node --test tests/debug-refining-page.test.cjs
```

Expected: PASS for all listed tests.

- [ ] **Step 2: Run CSS contract tests again**

Run: `node --test tests/classical-css-theme.test.cjs`  
Expected: PASS.

- [ ] **Step 3: Manual smoke check in browser/electron**

Run one local launch path:

```bash
npm run dev
```

Manual checklist:
- home view reads as light-paper xianxia style immediately
- panel/card/button states are coherent and readable
- overlay/modal remain distinct over light background
- mobile width simulation still keeps borders and hierarchy legible

- [ ] **Step 4: Apply only necessary polish fixes from manual findings**

If fixes are required, update `styles.css` with minimal scoped changes and rerun:

```bash
node --test tests/classical-css-theme.test.cjs
```

Expected: PASS after each polish tweak.

- [ ] **Step 5: Commit**

```bash
git add styles.css tests/classical-css-theme.test.cjs
git commit -m "chore(css): finalize classical visual refresh verification polish"
```

## Spec Coverage Check (Self-Review)

- xianxia-cool + light-paper base: covered in Task 1 tokens/background.
- medium ornament density: covered via restrained texture/surface rules in Tasks 1-3.
- full-page scope: covered across stage/panel/card/button/status/overlay/memory/mobile tasks.
- readability and state clarity constraints: covered via explicit interaction/state assertions in test contract.

No placeholders (`TBD`, `TODO`, vague "appropriate handling") remain in this plan.

