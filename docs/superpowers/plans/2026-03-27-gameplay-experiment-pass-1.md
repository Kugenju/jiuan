# Gameplay Experiment Pass 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reusable gameplay experiment template and produce a first-pass experiment record that verifies whether current weekly builds diverge in meaningful ways.

**Architecture:** Keep this pass document-driven. Reuse the current debug export and browser automation hooks to run three controlled week-long experiments, then distill the outcome into a reusable template plus a first-pass findings report.

**Tech Stack:** Markdown, Playwright, existing `window.render_game_to_text()` export, existing UI selectors

---

### Task 1: Fix the experiment scope

**Files:**
- Modify: `玩法验证清单.md`
- Create: `docs/superpowers/plans/2026-03-27-gameplay-experiment-pass-1.md`

- [ ] Step 1: Confirm this pass is a divergence check, not a balance pass
- [ ] Step 2: Fix the first-pass sample matrix to three strongly different weekly builds
- [ ] Step 3: Record control conditions, especially seed, random-event state, and night-placement policy

### Task 2: Add the reusable template

**Files:**
- Create: `玩法实验记录模板.md`

- [ ] Step 1: Extract the core fields from `玩法验证清单.md`
- [ ] Step 2: Expand the template with control conditions, daily logs, weekly outcome, and next-iteration notes
- [ ] Step 3: Keep the template short enough for repeated use across many runs

### Task 3: Run the first experiment pass

**Files:**
- Read: `main.js`
- Read: `src/debug/state-export.js`
- Read: `data/schedules.js`

- [ ] Step 1: Use the existing selectors and debug export to run 3 full weekly samples
- [ ] Step 2: Record final resources, best skill, key secondary skills, memory buildings, and bridges
- [ ] Step 3: Record day 1 / day 3 / day 5 / day 7 observations for each sample

### Task 4: Write the findings report

**Files:**
- Create: `玩法实验记录-首轮.md`

- [ ] Step 1: Write the control setup and the three experimental groups
- [ ] Step 2: Summarize weekly outcomes in a compact comparison table
- [ ] Step 3: Call out the main confirmed differences, the main design risks, and the next pass to run

### Task 5: Verify the artifacts

**Files:**
- Create: `玩法实验记录模板.md`
- Create: `玩法实验记录-首轮.md`
- Create: `docs/superpowers/plans/2026-03-27-gameplay-experiment-pass-1.md`

- [ ] Step 1: Re-read each new markdown file for missing placeholders and contradictions
- [ ] Step 2: Check `git status --short`
- [ ] Step 3: If needed, rerun one sample or re-check the exported values before claiming the pass is complete
