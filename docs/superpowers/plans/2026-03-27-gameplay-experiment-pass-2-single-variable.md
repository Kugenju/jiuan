# Gameplay Experiment Pass 2 Single-Variable Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run a second gameplay experiment pass that fixes the same archetype and weekly course selection, then compares four different free-time schedule templates.

**Architecture:** Keep the weekly timetable constant so only the daytime free-slot template changes. Reuse the same Playwright + `window.render_game_to_text()` workflow from pass 1, then write a dedicated pass-2 report focused on schedule tradeoffs rather than build divergence.

**Tech Stack:** Markdown, Playwright, existing browser selectors, existing debug export

---

### Task 1: Fix the experiment baseline

**Files:**
- Read: `玩法实验记录-首轮.md`
- Read: `玩法验证清单.md`
- Create: `docs/superpowers/plans/2026-03-27-gameplay-experiment-pass-2-single-variable.md`

- [ ] Step 1: Fix one baseline archetype and one elective choice for all pass-2 runs
- [ ] Step 2: Define four free-slot templates that represent study, money, recovery/body, and balanced play
- [ ] Step 3: Record the control conditions so only the schedule template changes

### Task 2: Run the pass-2 experiments

**Files:**
- Read: `main.js`
- Read: `src/debug/state-export.js`
- Read: `data/schedules.js`
- Read: `data/activities.js`

- [ ] Step 1: Run four full weekly samples with the same archetype and elective
- [ ] Step 2: Record final rank, resources, best skill, fatigue, buildings, bridges, and key relationship changes
- [ ] Step 3: Record day 1 / day 3 / day 5 / day 7 observations for each template

### Task 3: Write the pass-2 findings

**Files:**
- Create: `玩法实验记录-第二轮-单变量.md`

- [ ] Step 1: Explain why this pass fixes the same weekly timetable
- [ ] Step 2: Summarize the four schedule-template outcomes in one comparison table
- [ ] Step 3: Call out whether homework is overtuned, whether fatigue pressure is strong enough, and whether any route is clearly non-viable

### Task 4: Verify and hand off

**Files:**
- Create: `玩法实验记录-第二轮-单变量.md`
- Create: `docs/superpowers/plans/2026-03-27-gameplay-experiment-pass-2-single-variable.md`

- [ ] Step 1: Re-read the new markdown for placeholders or contradictions
- [ ] Step 2: Re-run a compact verification of the key final metrics if needed
- [ ] Step 3: Check `git status --short` before reporting completion
