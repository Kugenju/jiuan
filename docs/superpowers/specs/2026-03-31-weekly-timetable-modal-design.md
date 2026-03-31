# Weekly Timetable Modal Design

## Goal

Add a read-only "complete weekly timetable" entry in the top toolbar so the player can open a modal and inspect the full fixed timetable at any time without leaving the current flow.

## Scope

This change only adds a read-only viewing surface for the existing weekly timetable.

Included:
- top-toolbar button entry
- modal rendering branch
- read-only weekly timetable content inside the modal
- minor modal sizing and scrolling adjustments for timetable readability
- automated regression coverage for the new modal branch

Excluded:
- timetable editing from the modal
- clicking timetable cells to navigate or mutate state
- new data model changes
- changes to daily planning logic

## Existing Context

The project already has:
- a top toolbar with global information buttons
- a shared `info-modal` overlay
- a reusable `renderWeeklyTimetable()` helper that renders the weekly timetable grid

That means the feature should be implemented by wiring an additional modal kind into the existing overlay system rather than introducing a new overlay stack.

## Approach Options

### Option 1: Reuse `info-modal` with a new modal kind

Add a new toolbar button, set `state.ui.infoModal = "weekly-timetable"`, and render timetable content through the existing modal system.

Pros:
- minimal code movement
- consistent with existing progress/feedback/info overlays
- low regression risk

Cons:
- needs a width/scroll adjustment for timetable readability

### Option 2: Add a dedicated timetable overlay

Create a separate modal node and its own render logic.

Pros:
- more isolated future extension surface

Cons:
- duplicates existing modal behavior
- higher maintenance cost for a simple read-only viewer

### Option 3: Convert toolbar overlays into a multi-tab inspector

Bundle progress, feedback, and timetable into one broader overlay surface.

Pros:
- centralized information access

Cons:
- broader UX change than needed
- risks unrelated regressions

## Chosen Design

Use Option 1.

The timetable modal is global information, so the top toolbar is the correct entry point. The content remains read-only and uses the already existing timetable renderer to avoid duplicated markup and styling logic.

## UX

### Entry

Add a toolbar button labeled along the lines of "完整课表".

Placement:
- same toolbar action row as stats, progress, and feedback

Behavior:
- clicking the button opens the info modal with timetable content
- opening the timetable modal closes no other game state and does not alter selection
- clicking the modal close button or overlay backdrop closes it

### Modal Content

The modal shows:
- title: "本周完整课表"
- current week/day badge if already available from the existing timetable renderer
- the full weekly timetable grid

The grid is read-only:
- no hover affordance suggesting editability
- no click handlers on cells
- no state mutation when opened

### Layout

The timetable grid is wider than the existing info cards, so the modal should:
- use a timetable-specific width larger than the default info modal
- allow internal scrolling when the grid overflows vertically or horizontally

The modal must remain usable on smaller screens:
- modal width should still clamp to viewport width
- timetable area should scroll rather than compress into unreadable cells

## State Model

No new domain data is needed.

UI state change only:
- add a new `infoModal` kind value: `"weekly-timetable"`

## Rendering Flow

1. User clicks the toolbar timetable button.
2. Click handler sets the modal kind to `"weekly-timetable"`.
3. `renderInfoModal()` branches on that kind.
4. Modal body renders the existing weekly timetable markup.
5. Close interactions clear `state.ui.infoModal`.

## Testing

Add targeted coverage for:
- toolbar button text/render presence
- weekly timetable modal branch rendering
- modal content containing the timetable shell/grid
- no regressions to existing modal branches

Manual verification should cover:
- opening the timetable modal from the toolbar in planning mode
- opening it during other major modes where the toolbar remains available
- confirming the modal is read-only
- confirming large timetable content remains scrollable and readable

## Risks

### Modal width too narrow

Mitigation:
- add a timetable-specific modal class and constrained wider width

### Reusing timetable HTML introduces nested scrolling awkwardness

Mitigation:
- keep the timetable renderer unchanged and tune only the modal wrapper scroll behavior

### Confusing editability signals

Mitigation:
- keep cells non-interactive and avoid button styling inside the modal

## Acceptance Criteria

- a new top-toolbar button opens a read-only weekly timetable modal
- the modal uses the existing overlay system
- the timetable is readable without leaving the current scene
- no timetable cell in the modal mutates game state
- existing modal types still work
