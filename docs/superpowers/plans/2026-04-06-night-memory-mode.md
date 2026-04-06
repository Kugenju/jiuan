# Night Memory Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle night mode into a darker "night academy" presentation with a brighter lamp-lit main stage transition and a memory board that matches the overall classical world.

**Architecture:** Keep the existing night-mode state and DOM structure intact, and drive the change mostly through `styles.css` plus small state-aware presentation hooks already exposed by `body.memory-mode`. Tighten CSS tests first, then update the memory-stage, memory-board, and right-panel night surfaces to share one coherent palette and hierarchy.

**Tech Stack:** Vanilla HTML/CSS, existing JS state toggles in `main.js`, Node built-in test runner.

---

### Task 1: Lock the new night-mode visual contract with tests

**Files:**
- Modify: `tests/classical-css-theme.test.cjs`
- Modify: `styles.css`
- Test: `tests/classical-css-theme.test.cjs`

- [ ] Add or update assertions for `body.memory-mode`, `.memory-stage`, `.memory-hex-board`, and night-mode right-panel surfaces so they reflect the chosen "night academy" direction.
- [ ] Run `node --test tests/classical-css-theme.test.cjs` and confirm the new assertions fail before implementation.
- [ ] Implement only the minimal CSS needed to make the new assertions pass.
- [ ] Re-run `node --test tests/classical-css-theme.test.cjs` and confirm it passes.

### Task 2: Rebuild the night memory chamber presentation

**Files:**
- Modify: `styles.css`
- Test: `tests/classical-css-theme.test.cjs`

- [ ] Darken the global `body.memory-mode` shell and add a lamp-lit transition so the main stage remains visibly brighter than the surrounding night UI.
- [ ] Replace the current blue-purple memory chamber treatment with darker ink, wood, gold, and jade accents that feel classical rather than sci-fi.
- [ ] Tighten node, edge, chip, fragment field, and card surfaces so the whole night phase reads as one environment.
- [ ] Re-run `node --test tests/classical-css-theme.test.cjs` after each coherent batch until all night-mode assertions are green.

### Task 3: Verify full night-mode integration

**Files:**
- Modify: `styles.css`
- Test: `npm test`

- [ ] Review the resulting night-mode CSS for consistency between left stage, memory board, and right panel.
- [ ] Run `npm test` to verify the full suite still passes.
- [ ] Check `git diff --stat` / `git status --short` so the changed surface is understood before reporting back.
