# Classical CSS Visual Refresh Design

## Goal

Refresh the current webpage visual style with a Chinese classical direction focused on:

- xianxia-cool mood
- light paper base instead of dark sci-fi background
- medium ornament density (subtle patterns and separators, not heavy decoration)
- full-page consistency across stage, panels, cards, buttons, overlays, and responsive states

This pass is CSS-focused and does not change existing gameplay behavior, data, or interaction flow.

## Context

Current style language is predominantly dark and tech-like:

- deep blue-black global background
- glassmorphism-heavy cards and overlays
- neon-like borders and hover glows
- cool sci-fi tone that conflicts with the intended xianxia atmosphere

The page has broad component coverage in `styles.css`, so the best path is a token-first refresh that cascades across existing selectors.

## User Intent

Confirmed user preferences:

- visual direction: xianxia-cool
- base theme: light paper
- scope: all major UI areas, not a partial patch
- decoration density: medium
- approach choice: balanced system refresh (not minimal tweak, not theatrical heavy style)

## Approach Options

### Option A: Minimal palette pass

Replace colors and shadows while keeping most structural aesthetics unchanged.

Pros:

- quickest delivery
- lowest regression risk

Cons:

- classical identity remains weak
- still reads as adapted sci-fi UI

### Option B: Balanced token + component refresh (Chosen)

Rebuild visual tokens and remap all key components to a coherent paper/xianxia system with restrained ornaments.

Pros:

- clear stylistic shift with good readability
- consistent interaction language across components
- maintainable with centralized variables

Cons:

- medium change surface
- requires careful verification for contrast and state clarity

### Option C: Heavy decorative redesign

Add strong frame ornaments, seal-style accents, and dense motif usage.

Pros:

- strongest visual memory

Cons:

- higher readability risk in data-dense panels
- higher maintenance and tuning cost

## Chosen Approach

Use Option B.

Design principle: prioritize legibility and interaction clarity first, then add restrained classical atmosphere through color, texture, and motif rhythm.

## Visual System Design

### Global tokens

Introduce a paper-first token set in `:root`:

- background: warm off-white and pale blue-gray blend
- surface: paper card tones (soft ivory variants)
- ink text: deep ink for body, muted blue-gray for secondary text
- primary accent: dark cyan-green (`daiqing`) for interactive states
- secondary accent: desaturated gold for highlights/status emphasis
- danger/warn: softened cinnabar tone
- border/shadow: low-contrast contour and short soft shadow

### Background language

Global background becomes layered but subtle:

- light gradient base
- low-opacity paper grain/noise impression
- restrained cloud/mist radial overlays

No heavy pattern tiling, no high-frequency texture.

### Surface language

Cards and containers (`.panel-card` and card-like blocks) become:

- light paper surfaces
- refined thin borders
- low-lift shadows
- reduced blur/glass effect

Result should feel like stacked paper panels rather than floating neon glass.

### Interaction language

Buttons and selectable cards move from glow feedback to print-like feedback:

- hover: slight raise + border deepening + subtle tint shift
- active/selected: clear border + gentle fill tint
- focus-visible: high-contrast ring that fits the new palette

State signaling uses dual channels (border + background), not brightness alone.

## Component Mapping

### Stage and shell

Targets:

- `html`, `body`, `.app-shell`, `.game-layout`, `#game-canvas`, `.memory-stage`

Changes:

- replace dark sci-fi base with paper landscape base
- lighten stage frame treatment
- keep structure and spacing unchanged

### Panels and cards

Targets:

- `.panel-card`, `.story-card`, `.metric`, `.slot-card`, `.activity-card`, `.choice-card`, `.log-entry`, related grid cards

Changes:

- unify card face, border, shadow, text hierarchy
- preserve semantic variants while reducing saturation noise

### Buttons and controls

Targets:

- `.ghost-button`, `.action-row button`, `.drawer-close`, stateful button variants

Changes:

- unified button baseline
- primary uses restrained cyan gradient
- warning uses softened cinnabar with clear contrast

### Status and highlights

Targets:

- `.badge`, `.phase-card.current`, `.phase-card.done`, `.task-round-pill`, `.week-cell.current-day`, similar status classes

Changes:

- consistent accent assignment (primary cyan / soft gold)
- remove inconsistent blue-purple leftovers where not semantically required

### Overlay and modal

Targets:

- `.overlay-backdrop`, `.overlay-drawer`, `.overlay-modal`, `.modal-rule`

Changes:

- fog-like backdrop instead of deep dark mask
- paper modal surfaces with stronger contour separation

### Memory area policy

Targets:

- `memory-*` sections

Changes:

- preserve gameplay semantic color logic
- reduce over-saturation and hard contrast where possible
- keep interaction affordance priority over thematic purity

## Responsive And Accessibility Considerations

- keep existing breakpoints and layout flow unchanged
- increase border opacity on small screens where light theme can feel too soft
- ensure text contrast remains readable for `small`, disabled, and meta text
- keep focus-visible states explicit and keyboard-discernible

## Risks And Mitigations

### Risk: Reduced readability on light theme

Mitigation:

- enforce dark ink body text and sufficient secondary contrast
- avoid low-contrast decorative overlays in content-heavy regions

### Risk: State visibility weakens after removing glow

Mitigation:

- use border + tint + slight motion for state feedback
- validate hover/active/selected/focus on key interactive components

### Risk: Browser inconsistency for modern color functions

Mitigation:

- keep hardcoded fallback values for critical colors
- treat advanced mixing functions as optional enhancement

## Validation Plan

Manual checks after CSS changes:

- first screen reads as "light xianxia" immediately
- cards/buttons/statuses look like one coherent system
- readability of long text blocks and small helper text remains acceptable
- overlays stay visually distinct over the light background
- mobile breakpoints remain usable and not washed out

## File Impact

Primary file:

- `styles.css`

No expected behavior code changes in:

- `main.js`
- domain/app scripts

## Non-Goals

- no gameplay logic changes
- no copy/content rewrite
- no component structure refactor in HTML/JS
- no new theme switcher system in this pass

## Acceptance Criteria

- global look shifts from dark sci-fi to light classical xianxia
- major surfaces share unified paper-card language
- interactions remain clear without neon-glow dependency
- all selected scope areas reflect the new system consistently
- responsive behavior remains intact

