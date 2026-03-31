# Refining Multi-Round Attempt Design

## Goal

Extend the current `artifact_refining` minigame from a single settlement into a configurable multi-round task flow.

The intended player experience is:

- one scheduled refining task can continue inside the same scene across multiple rounds
- each round produces a score
- round scores accumulate toward the task target
- the task ends immediately once the cumulative score reaches the target
- if the target is not reached, the player can continue until the configured round limit is exhausted

This change must remain reusable for future minigames and must not hardcode the round count in runtime logic.

## Confirmed Rules

The user confirmed the following rules for the first version:

- the same refining scene can be restarted up to a configured number of rounds
- scores from each round accumulate
- once the cumulative score reaches the target, the task succeeds immediately
- the round count must come from task configuration, not hardcoded constants
- after a round ends:
  - unrevealed and revealed-but-unused cards remain in place
  - revealed state on unused cards is preserved
  - used cards are replaced with newly generated random cards
- triangle slots are cleared before the next round begins

## Context

The current implementation already supports:

- weekly task unlock after the final `craft` course
- a scheduled `artifact_refining_task`
- a left-stage refining interaction flow
- one refine-and-settle cycle per scheduled task
- standalone refining debugging through `debug-refining.html`

What is missing is the notion of persistent progress across rounds inside a single task attempt.

## Approach Options

### Option A: Task-level cumulative rounds with partial board refresh

Store cumulative score and round index on the task runtime. After each settlement:

- add the round score to cumulative total
- check success immediately
- if not complete, refresh only used-card positions and keep the rest of the board state

Pros:

- directly matches the requested experience
- preserves player knowledge across rounds
- scales cleanly to other minigames with configurable round caps

Cons:

- task runtime becomes more stateful
- requires careful refresh logic to avoid mutating preserved cards incorrectly

### Option B: Full board reset each round with cumulative score

Keep cumulative score, but rebuild the entire 3x3 board after every round.

Pros:

- simpler state transition
- easier to reason about than partial replacement

Cons:

- contradicts the requested "preserve unused revealed cards" rule
- weakens the information-retention strategy

### Option C: Single board for all rounds without card replacement

Keep one board for the full task and do not replace used cards. The player just keeps consuming remaining cards until rounds end.

Pros:

- minimal refresh logic
- strong planning puzzle

Cons:

- eventually starves the board of options
- does not match the requested "used cards add random new cards" rule

## Chosen Approach

Use Option A.

This is the only option that satisfies all confirmed rules while keeping the design extensible.

## Data Design

### Task definition config

Add round-based config to the task definition in `data/tasks.js`.

For `artifact_refining`, introduce explicit fields such as:

- `rounds.maxRounds`
- `rounds.refreshMode`
- `rounds.refreshPool`

First version behavior:

- `maxRounds` controls the allowed number of rounds for the task
- `refreshMode` is `replace_used_only`
- `refreshPool` uses the standard refining base deck distribution and allows repeated draws across rounds

This keeps the round system configurable per task and avoids hardcoding `3`.

### Task runtime state

Extend active refining runtime state so one scheduled task can persist across rounds.

Required state:

- `roundIndex`
- `maxRounds`
- `totalScore`
- `roundResults`
- `attempt`

Where:

- `roundIndex` is 1-based for player-facing display
- `maxRounds` is copied from task definition config when the task starts
- `totalScore` is cumulative across settled rounds
- `roundResults` stores score and recipe data for each finished round
- `attempt` remains the live board state for the current round

## Round Flow

### Task entry

When the refining task scene starts:

- initialize cumulative round state from task definition config
- create the initial refining attempt board as usual
- start at round 1 with `totalScore = 0`

### Round settlement

When the player confirms a full triangle:

1. resolve the current round score
2. append that result to `roundResults`
3. add the score to `totalScore`
4. if `totalScore >= objective.scoreTarget`, finish task as success immediately
5. else if `roundIndex >= maxRounds`, finish task as failure
6. else rebuild only the used-card positions and begin the next round in the same scene

### Round transition

On a non-final round transition:

- keep all unused cards in place
- preserve each unused card's `revealed` flag
- replace each used card object with a newly generated random card
- clear `used` markers as part of the replacement
- clear all triangle slots
- clear `selectedCardId`
- clear per-round settlement result on the live attempt
- increment `roundIndex`

The player remains inside task mode instead of returning to day flow.

## Refresh Rules

### Preserved cards

Cards are preserved if they were not placed into a triangle slot during the settled round.

This includes:

- revealed unused cards
- unrevealed unused cards

### Replaced cards

Cards are replaced if they were used in the settled round.

Replacement rules for the first version:

- generate the replacement from the configured refining base pool
- allow repeated draws
- do not track a diminishing master deck across rounds

This rule is intentionally simple and configurable so future tasks can switch to stricter pool behavior later if desired.

## UI And Feedback

### Main game task panel

Add cumulative-progress summary to the right panel:

- current round and max rounds
- cumulative score
- target score
- recent round results

The right panel remains summary-and-confirm only.

### Main stage

Keep the current left-stage interaction model.

Add compact on-stage feedback for:

- current round
- cumulative score
- whether the last settlement advanced to the next round or ended the task

### Standalone debug page

Update `debug-refining.html` to expose the same multi-round behavior:

- current round
- cumulative score
- target
- round history
- repeated settlement within one sandbox run

This page should remain useful for validating refresh behavior across rounds.

## Failure And Success Semantics

### Success

The task succeeds immediately once cumulative score reaches or exceeds the configured target.

The player should not be forced to consume all remaining rounds after meeting the goal.

### Failure

The task fails only when:

- the cumulative score is still below target
- and the configured round limit has been exhausted

This failure still follows the previously agreed task lifecycle behavior outside the minigame:

- if the timed task later reappears under the existing rules, it can be attempted again as a new task occurrence

## Testing Strategy

### Automated

Add or extend tests to cover:

- task config exposes configurable round count
- entering refining task seeds runtime with cumulative round state
- round score accumulates into `totalScore`
- success ends early before all rounds are used
- failure occurs at configured round limit if target is not reached
- unused revealed cards preserve reveal state between rounds
- used cards are replaced with new random cards
- triangle slots clear between rounds
- standalone sandbox can run multiple rounds in one session

### Manual

Manual verification should cover:

- a refining task that succeeds on round 1 or 2 and exits immediately
- a refining task that continues into later rounds while preserving unused revealed cards
- a refining task that reaches final round without enough cumulative score and fails
- debug page showing the same cumulative behavior

## File Impact

Expected touched areas:

- `data/tasks.js`
- `src/domain/refining-minigame.js`
- `main.js`
- `src/app/refining-view.js`
- `src/debug/refining-sandbox.js`
- `data/ui.js`
- refining-related tests

## Non-Goals

This pass does not include:

- changing current recipe score values
- introducing a finite cross-round master deck
- adding drag-and-drop or slot removal
- redesigning the timed task unlock rules
- changing unrelated minigames yet

## Risks

### Hidden state drift

If round transition logic lives partly in `main.js` and partly in domain code, preserved-card behavior may drift. The round transition should be implemented through shared refining runtime helpers rather than duplicated UI logic.

### Config bypass

If `maxRounds` is copied incompletely or fallback defaults are inconsistent, later tasks may accidentally reintroduce hardcoded round counts. Runtime initialization should always derive round count from task definition config.

### Debug/main behavior mismatch

If the sandbox controller manages rounds differently from the main game, manual balancing will become misleading. Both should share the same round-transition and settlement helpers.

## Acceptance Criteria

- refining task round count is read from task configuration, not hardcoded in runtime logic
- one scheduled refining task can continue through multiple rounds in the same scene
- scores accumulate across rounds
- success ends immediately once cumulative score reaches the target
- failure happens only after the configured round cap is exhausted without reaching the target
- unused cards remain on the board between rounds
- revealed state of unused cards is preserved between rounds
- used cards are replaced with newly generated random cards
- triangle slots reset between rounds
- standalone debug page supports the same multi-round behavior
