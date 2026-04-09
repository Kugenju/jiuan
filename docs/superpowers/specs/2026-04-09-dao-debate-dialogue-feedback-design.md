# Dao Debate Dialogue Feedback Design

## Goal

Improve the `dao_debate` minigame feedback loop so a card choice feels like a spoken exchange instead of an abstract score update.

After the player chooses a debate card:

- the left panel first shows the player's spoken line for that card
- after a short delay, the left panel reveals Miao Zai'ou's reply for the current follow-up type
- earlier completed rounds are available from a history button that opens an overlay modal

This change should preserve the current task structure, scoring rules, and right-panel card selection flow.

## Current Context

The current dao debate implementation already has the right structural boundaries:

- `data/tasks.js` owns debate topics, cards, and follow-up definitions
- `src/domain/dao-debate-minigame.js` owns session creation and per-card resolution
- `src/app/dao-debate-view.js` builds the right-panel task UI
- `main.js` renders the left panel, task panel, and the shared overlay modal channel via `state.ui.infoModal`

The left panel currently shows only prompt and score summary during dao debate. It does not surface the player's chosen line or the opponent's response, which makes each round read as a mechanical score transaction.

## Non-Goals

- no rewrite of the scoring matrix or round-count rules
- no branching replies per individual card beyond the player line itself
- no new global modal system
- no persistent transcript outside the active task runtime
- no extra confirmation click between player line and reply

## Proposed Experience

### Round Feedback

Each round resolves as a short two-beat exchange:

1. Player clicks a debate card.
2. Left panel immediately shows the player's line for that card.
3. Debate controls become temporarily unavailable.
4. After a short delay, the same left-panel card reveals Miao Zai'ou's reply.
5. Debate controls unlock again, unless the task has already ended.

This keeps the cadence readable without adding a permanent extra click to all three rounds.

### History Access

The left panel includes a `查看前几轮` button once at least two exchanges exist.

Clicking it opens the existing shared overlay modal and lists prior completed exchanges in round order:

- round label
- player line
- Miao Zai'ou reply
- optional small metadata line for the played card label

The latest exchange remains exclusive to the left panel so the modal stays focused on previous rounds rather than duplicating what is already on screen.

## Content Design

### Player Lines

Each debate card gets a dedicated spoken line in `data/tasks.js`.

Example shape:

```js
uphold_principle: {
  id: "uphold_principle",
  label: "守其本义",
  tag: "principle",
  line: "我不是在回避代价，而是在说有些底线一旦先退，后面的万种便利都会失了凭依。",
}
```

This keeps the authored voice attached to the card definition that already owns the card's label and tag.

### Miao Zai'ou Replies

Replies are authored per follow-up type, not per card.

Example shape:

```js
press_principle: {
  id: "press_principle",
  label: "逼问义理",
  prompt: "逼问义理：若此理当真能立住，为何到了眼前这一案就能例外？",
  reply: "你说守义，可若义理只能在顺手时成立，它到底是准绳，还是你替自己留的台阶？",
}
```

This keeps the response model aligned with the current debate engine, which already routes the next pressure by follow-up type.

## Architecture

### Data Layer

`data/tasks.js`

- add `line` to each entry in `DAO_DEBATE_CARDS`
- add `reply` to each entry in `DAO_DEBATE_FOLLOWUPS`

No separate copy table is needed because this content is tightly coupled to the debate card/follow-up definitions already stored here.

### Domain Layer

`src/domain/dao-debate-minigame.js`

Extend round resolution to build a normalized exchange record:

```js
{
  roundIndex: 1,
  cardId: "uphold_principle",
  cardLabel: "守其本义",
  playerLine: "...",
  replyLine: "...",
  promptType: "opening",
  nextFollowupType: "press_principle",
  scoreType: "strong",
}
```

Session state should include:

```js
{
  history: [],
  latestExchange: null,
}
```

Rules:

- `history` stores every completed exchange, newest last
- `latestExchange` points to the newest item for left-panel rendering
- domain logic owns content assembly, not `main.js`
- settlement logic stays unchanged

### Presentation State

`main.js`

Add a lightweight task-runtime presentation state for debate:

```js
taskRuntime.debatePresentation = {
  stage: "idle" | "player_only" | "full",
  revealTimerId: null,
}
```

Responsibilities:

- set `player_only` immediately after a card is resolved
- schedule a short delayed transition to `full`
- while stage is `player_only`, debate card buttons are disabled
- clear any pending timer when leaving task mode or settling the task

This keeps authored content in the domain object while keeping timing concerns in the app layer where timers already belong.

### Left Panel Rendering

`main.js`

The dao debate branch of `renderLeftPanel()` should render three conceptual blocks:

1. current task summary
2. latest exchange card
3. debate status block

Latest exchange card states:

- before any round: show current prompt and a short hint such as `请先择一论点回应`
- `player_only`: show player line only, with a small pending label
- `full`: show player line and reply

The prompt title should still remain visible somewhere in the left panel so the player retains context for what this exchange answered.

### Modal Rendering

Reuse `state.ui.infoModal` with a new modal kind such as `dao-debate-history`.

Implementation shape:

- `openInfoModal("dao-debate-history")`
- `renderInfoModal()` gets a new branch for dao debate history
- modal HTML can be rendered inline in `main.js` or moved into a dedicated helper if it grows beyond a small template

Modal content source:

- read from `state.taskRuntime.debate.history`
- omit the last item when it matches `latestExchange`
- if no prior rounds exist, the history button should not render

## Interaction Flow

### Non-Terminal Round

1. Player clicks card.
2. Domain resolves score and appends exchange to history.
3. Runtime stores updated session and sets presentation stage to `player_only`.
4. UI re-renders with only the player line visible.
5. Short timer expires.
6. Presentation stage becomes `full`.
7. UI re-renders with Miao Zai'ou's reply visible.
8. Card controls become available for the next round.

### Final Round

1. Player clicks card.
2. Domain resolves final exchange and settlement result.
3. Left panel still runs through the same two-beat reveal.
4. After reply reveal, existing success/failure handoff runs.
5. Task runtime resets as it does today.

This preserves the dramatic beat on the final round instead of skipping straight to result copy.

## Error Handling And Edge Cases

- invalid card id remains a no-op
- if `line` or `reply` is missing, fall back to an empty string rather than crash
- history modal must not open when task mode is not active or when no prior exchanges exist
- any pending reveal timer must be cleared when:
  - task ends
  - player leaves task mode
  - a new dao debate session starts
- repeated clicks during `player_only` must be ignored so rounds cannot overlap

## Testing

### Domain Tests

Update `tests/dao-debate-minigame.test.cjs` to verify:

- selected card contributes `playerLine`
- follow-up definition contributes `replyLine`
- completed exchange is appended to `history`
- `latestExchange` mirrors the last resolved round

### Flow Tests

Update `tests/task-flow.test.cjs` to verify:

- after choosing a card, left panel shows the player line first
- during the reveal delay, debate controls are disabled
- after the reveal delay, the reply appears
- history button appears once prior rounds exist
- opening the history modal shows earlier rounds and excludes the latest exchange
- final-round success/failure still resumes resolving flow only after the reply beat completes

### View Tests

If modal markup is extracted into a helper, add a focused test for:

- escaped dialogue text
- round labels
- omission of the latest exchange from history content

## Trade-Offs

### Why Auto-Reveal Instead Of Manual Continue

Auto-reveal adds dramatic timing without increasing the click count of every debate attempt. A manual continue step would create a stronger stage-play rhythm but would slow a three-round minigame enough to become friction.

### Why Put Card Lines In `data/tasks.js`

The card definition already owns label, tag, and unlock rules. Adding spoken line content there keeps each card self-contained and avoids splitting one concept across multiple files.

### Why Reuse `infoModal`

The project already has a working overlay path and backdrop coordination. Reusing it reduces risk and keeps dao debate history behavior consistent with existing timetable, feedback, and memory overlays.

## Implementation Outline

1. Extend dao debate card and follow-up data with spoken lines and replies.
2. Extend debate domain state to assemble and store exchange records.
3. Add presentation timing state and locking in task flow.
4. Rework the left panel dao debate branch to show the latest exchange.
5. Add a dao debate history modal branch to the shared overlay renderer.
6. Update tests around domain, flow, and modal rendering.
