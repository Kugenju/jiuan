# Random Event Choice Modal Design

## Goal

Replace the current auto-resolving random event behavior with a mandatory centered modal flow:

- random events interrupt progression immediately when triggered
- players read event content before making a choice
- players choose from 2-3 options without seeing reward numbers up front
- each choice leads to its own result text
- the result text ends with the actual rewards gained from that choice

This pass changes random-event interaction and presentation, but stays within the existing day flow and event-trigger system.

## Context

Current random events are defined in `data/events.js` and resolved through `src/domain/random-event.js`.

The current behavior is:

- an event matches conditions during day flow
- its effect is applied immediately
- notes/logs/story fragments are pushed directly into the existing resolving flow

This is efficient, but it removes player agency and does not support branch outcomes.

## User Intent

The intended new experience is:

- a triggered random event pauses the normal flow immediately
- a centered modal presents the event title/body and choice buttons
- rewards are hidden before selection
- after selection, the player sees a result panel with branch-specific text
- the result panel ends with a concise reward summary
- most rewards should come from reusable templates, while a minority of events can define custom effects

## Approach Options

### Option A: Minimal patch on top of current auto-resolution

Store event choices in data, but keep most resolution logic in one function and bolt a modal on top.

Pros:

- smallest change set
- fastest to land

Cons:

- prompt/result behavior becomes tangled
- event growth becomes harder to maintain

### Option B: Two-stage random event state machine (Chosen)

Represent random events as an explicit prompt/result flow:

- prompt stage: show event and choices
- result stage: show selected branch text and reward summary
- apply effects only after the player confirms the chosen branch

Pros:

- matches the intended UX cleanly
- keeps state transitions explicit
- supports template rewards and special-case rewards without overengineering

Cons:

- requires new UI state and flow handoff logic

### Option C: Generalized choice-dialog system for all narrative events

Abstract random events, story beats, and other prompts into one generic modal framework.

Pros:

- best long-term unification

Cons:

- too large for this pass
- expands scope beyond the user request

## Chosen Approach

Use Option B.

This gives the user-facing flow they want without forcing a broad narrative-system rewrite.

## Interaction Design

### Stage 1: Prompt modal

When a random event triggers:

- normal day progression pauses immediately
- a centered modal opens over the current UI
- the modal shows:
  - event title
  - event body
  - 2-3 choice buttons

The prompt modal does not show explicit reward numbers or reward categories.

### Stage 2: Result modal

After the player selects a choice:

- the modal switches to a result state
- it shows the selected branch's result text
- the final line summarizes the actual rewards granted
- a single continue button closes the modal and resumes the interrupted flow

Example result structure:

- result body text
- `奖励：悟道点+1`
- `奖励：好友关系+1，灵感+1`

### Control rules

- the event modal blocks other UI interactions while open
- the player cannot skip the event with escape or click-through
- keyboard activation remains supported for buttons

## Data Design

### Event definition format

Update random events in `data/events.js` so each event can define `choices`.

Base event fields stay compatible with the current matcher setup:

- `id`
- `title`
- `timing`
- `chance`
- `oncePerDay`
- `condition`
- event body/story content

New field:

- `choices`

Each choice contains:

- `id`
- `label`
- `resultText`
- `rewardTemplate` or `effect`

### Reward strategy

Most choices should use reusable templates.

Examples:

- `resource_insight_small`
- `relationship_friend_small`
- `stat_memory_small`

Special cases may define direct `effect` payloads when templates are too limiting.

## Runtime Design

### Domain layer

`src/domain/random-event.js` should stop applying event effects immediately on trigger.

Instead it should support two responsibilities:

1. Match and build a `pendingRandomEvent` payload
2. Resolve a selected choice into:
   - concrete effect bundle
   - reward summary text
   - log/story output

This requires a reward resolution helper that can:

- expand reward templates into actual effects
- handle direct per-choice `effect`
- generate final reward summary strings

### App/day-flow layer

`src/app/day-flow.js` should:

- detect when a random event becomes pending
- pause the normal progression
- enter a random-event prompt state
- after a choice is made, enter a random-event result state
- resume normal flow only after result confirmation

### Main UI layer

`main.js` should render the modal using the existing overlay/modal system instead of introducing a second dialog framework.

The modal content needs two render states:

- prompt
- result

The modal must remain centered and visually consistent with the current classical theme work.

## State Model

Add a dedicated UI/runtime state for pending random events.

Minimum needed fields:

- pending event payload
- selected choice id
- modal stage (`prompt` or `result`)
- deferred continuation context so day flow can resume correctly

The player should never end up with an event applied twice or a flow that resumes twice.

## Error Handling

If an event is malformed:

- do not deadlock the flow
- log a safe fallback message
- skip the event and continue progression

If a choice references an unknown reward template:

- treat it as a configuration failure
- avoid partial application
- produce a debug-facing log and continue safely

## Testing Strategy

### Automated

Add tests for:

- trigger creates a pending event instead of applying effect immediately
- selecting a choice applies exactly that branch's reward
- reward templates and custom effects both resolve correctly
- prompt state transitions to result state
- result confirmation resumes day flow correctly
- reward summary text appears in result content

### Regression focus

- non-triggered slots remain unchanged
- existing day progression still works when no random event fires
- task/resolving/story flows continue correctly after event completion

### Manual

Verify at least:

- a random event interrupts immediately
- prompt modal shows title/body/options only
- result modal shows branch-specific text and reward summary
- confirm resumes the original flow correctly

## File Impact

Expected touched files:

- `data/events.js`
- `src/domain/random-event.js`
- `src/app/day-flow.js`
- `main.js`
- related tests under `tests/`
- `data/ui.js` only if the confirm/cancel/result labels are already centralized there

## Non-Goals

This pass does not include:

- converting all story beats to the same modal system
- adding deeply nested multi-step event trees
- exposing reward probabilities before selection
- redesigning the entire resolving flow

## Acceptance Criteria

- random events no longer auto-resolve immediately on trigger
- a triggered event opens a centered modal that blocks progression
- the prompt modal shows event content and options without explicit reward preview
- each option leads to its own result text
- the result text ends with the actual rewards for that selected option
- most events use reward templates, while special events can still define custom effects
- confirming the result resumes the interrupted flow correctly
