# Classical Canvas And Event Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the main gameplay canvas, random-event modal, and key right-panel controls into a consistent light Chinese-classical visual language.

**Architecture:** Keep the existing DOM and runtime flow intact, and focus on presentation-layer changes in `main.js`, `styles.css`, and targeted snapshot-style tests. The canvas should move from abstract blocks toward a courtyard/screen composition, while the modal and action area adopt the same paper, seal, and ink hierarchy.

**Tech Stack:** Vanilla JS canvas rendering, HTML/CSS overlays, Node built-in test runner.

---

### Task 1: Re-art direct visual targets

**Files:**
- Modify: `main.js`
- Modify: `styles.css`
- Test: `tests/canvas-theme.test.cjs`
- Test: `tests/classical-css-theme.test.cjs`

- [ ] Define a single visual thesis for the canvas, modal, and side controls
- [ ] Update failing tests so they assert the new motif hooks instead of only the earlier paper baseline
- [ ] Run targeted tests to confirm the new expectations fail before implementation

### Task 2: Rebuild the main canvas composition

**Files:**
- Modify: `main.js`
- Test: `tests/canvas-theme.test.cjs`

- [ ] Add new canvas theme tokens for mist, lattice, eaves, and courtyard accents
- [ ] Replace the current menu / planning / resolving backdrop treatment with a more scene-led composition
- [ ] Keep existing gameplay information readable and preserve current interaction logic
- [ ] Run focused canvas tests, then full test suite

### Task 3: Restyle random-event modal and right-side action emphasis

**Files:**
- Modify: `styles.css`
- Modify: `src/app/random-event-view.js`
- Test: `tests/classical-css-theme.test.cjs`
- Test: `tests/random-event-view.test.cjs`

- [ ] Turn the modal into a centered desk-scroll composition with stronger title, divider, and choice hierarchy
- [ ] Bring the main CTA / action area closer to the same classical system with less generic card chrome
- [ ] Verify prompt/result markup still supports keyboard flow and existing runtime behavior
- [ ] Run focused modal tests, then full test suite
