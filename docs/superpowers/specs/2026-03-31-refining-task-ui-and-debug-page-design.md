# Refining Task UI And Debug Page Design

## Goal

Improve the first playable `artifact_refining` minigame so the interaction matches the intended feel:

- the left stage becomes the primary play surface
- card flipping, card selection, and triangle placement happen on the left stage
- the right panel becomes a result and control panel rather than the main interaction surface
- add an isolated `debug-refining.html` page so the refining minigame can be tested without playing through a full week

This design keeps the existing task lifecycle, unlock timing, retry behavior, and scoring rules unchanged.

## Context

The current implementation already supports:

- weekly unlock after the last `craft` course resolves
- a timed schedulable `artifact_refining_task`
- a one-attempt triangle-based refining minigame
- one shared rule engine in `src/domain/refining-minigame.js`

The current UX mismatch is structural:

- the left canvas draws a refining board preview, but it is not the actual control surface
- the right panel renders the clickable card grid and slot buttons, so the player must operate in the side panel
- there is no isolated page for fast iteration on refining interactions

## User Intent

The intended player experience is:

- "play on the left, read on the right"
- left stage is the obvious and only main interaction area
- right panel is a compact assistant surface for state, requirements, and confirmation
- developers and designers can test refining directly from an isolated page

## Approach Options

### Option A: Left stage full interaction, right panel summary-only

Move all core interactions to the stage:

- click unrevealed cards on the left to reveal
- click revealed cards on the left to select or deselect
- click triangle slots on the left to place selected cards
- keep the right panel for requirements, selected card, placement summary, and confirm

Pros:

- aligns with intended player mental model
- clean separation of "play surface" vs "support panel"
- easiest direction to extend to future minigames

Cons:

- requires canvas hit-testing and stage interaction state
- requires removing most right-panel interaction affordances

### Option B: Left reveal, right placement

Only move reveal and selection to the stage, but keep slot placement in the right panel.

Pros:

- smaller change set
- less canvas interaction work

Cons:

- interaction remains split across two areas
- still feels compromised versus intended design

### Option C: Left full interaction plus richer right-side debug inspector

Same as Option A, but formalize the right panel as a deeper debug/analysis surface in both game and standalone page.

Pros:

- best for internal debugging
- easy to inspect score, recipe key, and state transitions

Cons:

- heavier than needed for the player-facing version
- risks overfilling the right panel

## Chosen Approach

Use Option A for the in-game task experience, and combine it with a limited debug control surface on a standalone page.

This keeps the player-facing layout disciplined while still giving the team a fast refinement loop through a separate page.

## Interaction Design

### In-game task layout

#### Left stage

The left stage becomes the only primary interaction area for refining:

- render the 3x3 card board as the dominant visual region
- render the triangle placement area on the same stage
- show clear selection state for the active card
- show clear used state for placed cards
- show valid placement emphasis when a revealed card is selected

Player input on the stage:

- click unrevealed card: reveal
- click revealed unused card: select or deselect
- click empty triangle slot while a card is selected: place card

Unsupported in first version:

- no dragging
- no swapping cards between slots
- no taking cards back out after placement

This keeps the first stage-interaction version predictable and low-risk.

#### Right panel

The right panel becomes a compact result and control surface:

- task name
- remaining days
- objective name
- target score
- material requirements
- current selected card
- current triangle slot contents summary
- current status text
- confirm button

The right panel does not render the 3x3 clickable card grid.

### Keyboard behavior

Keep keyboard support, but align it with the new stage-first layout:

- focus order should map to stage elements before the confirm button
- confirm remains accessible after all three slots are filled

Keyboard support does not need a redesign beyond matching the new interactive surface.

## Rendering And Input Architecture

### Shared refining presentation state

Add a thin shared presentation layer for refining task UI state. It should not own rules. It should only derive renderable and clickable regions from the attempt state.

Responsibilities:

- produce stage card rectangles
- produce triangle slot rectangles
- expose which card is selected
- expose which cards are revealed or used
- expose which stage elements are interactive

This layer should be reusable by:

- the main game task mode
- the standalone debug page

### Main game integration

Update task-mode rendering so:

- `drawTaskScene()` becomes the real refining play surface
- stage click handling routes to the same reveal, select, and place functions already used by the game
- `renderTaskPanel()` becomes an information panel rather than a duplicate interaction surface

### Standalone debug page

Add `debug-refining.html` as an isolated page that boots directly into a refining attempt.

The page should:

- load shared game data and refining runtime modules
- create a local refining attempt state
- render the same stage-first interaction model as the main game
- include lightweight debug controls on the right

## Debug Page Design

### Core behavior

`debug-refining.html` should not require weekly progression, task unlocks, or the full game shell.

On load it should:

- create an `artifact_refining` task definition context
- start a refining attempt immediately
- render the board and triangle slots

### Debug controls

The right-side debug control area should include:

- seed input
- "restart by seed" action
- four preset layout buttons:
  - stable success
  - stable failure
  - guanxing case
  - lingduan case

### Debug output

The page should show enough debugging detail to validate rules quickly:

- current selected card
- current slot contents
- resolved recipe key after confirmation
- score
- success or failure

The debug page can be more explicit than the in-game UI because its audience is internal.

## Preset Scope

The first version of the standalone page will support exactly four presets:

- stable success
- stable failure
- guanxing case
- lingduan case

No broader preset editor is required in this pass.

## Testing Strategy

### Automated

Add or extend tests to cover:

- stage-first refining interaction state derivation where practical
- main flow regression: unlocking still works and task mode still resolves correctly
- standalone page existence and script loading
- debug page seed restart behavior
- debug page preset switching behavior

### Manual

Manual verification should cover two lanes:

#### Main game lane

- complete a week with the final `craft` course
- confirm unlock prompt appears immediately after final course resolution
- schedule the refining task
- perform reveal, select, and place interactions on the left stage
- confirm right panel only handles summary and confirmation

#### Standalone debug lane

- open `debug-refining.html`
- start directly in a playable attempt
- restart by seed
- switch between the four presets
- complete a resolve and inspect score output

## File Impact

Expected touched areas:

- `main.js`
- `styles.css`
- `data/ui.js`
- potentially `data/copy.js` for task-mode phrasing polish
- a new shared refining view or interaction helper under `src/app/` or `src/domain/`
- `debug-refining.html`
- new or updated tests for task flow and standalone page coverage

## Non-Goals

This pass does not include:

- changing recipe values
- adding card drag-and-drop
- allowing placed cards to be removed
- redesigning other minigames
- adding a generalized standalone test page system for all minigames

## Risks

### Canvas interaction drift

If the main game and debug page implement hit-testing separately, they will drift. The design avoids this by requiring a shared presentation/interaction helper.

### Duplicate rule logic

The debug page must not fork refining rules. It should always call the existing refining domain functions.

### Overfilling the right panel

The in-game panel should remain a summary surface. Detailed diagnostics belong in the standalone page.

## Acceptance Criteria

- in the main game, card flipping, selection, and triangle placement all happen on the left stage
- in the main game, the right panel no longer serves as the main interaction surface for card operations
- the refining task still unlocks after the last weekly `craft` course
- task resolution still returns to the normal resolving flow
- `debug-refining.html` exists and opens directly into a refining attempt
- `debug-refining.html` supports random start, seed restart, and the four agreed presets
- both the main game and standalone page use the same refining rules
