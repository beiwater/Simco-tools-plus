# Frontend Design State

## Current Objective

Migrate the AutoMax control-panel shell, one-time legacy settings import, and page-action configuration into the existing SimComps component UI.

## Locked Decisions

- Reuse the existing dark `basisCPT` surface and z-index scale.
- Use IndexedDB for new persisted settings; import user-authored source localStorage settings once only.
- Keep source updater/menu APIs out of the target distribution.

## Design Brief

Primary user: a SimCompanies player who needs quick, reversible access to AutoMax tools without obscuring the game. The panel is operational, compact, Chinese-first, and must prioritize clear status and recoverable settings over decorative styling.

## Inclusive Personas

- Keyboard-first player: opens settings and changes an action without pointer dragging.
- Low-vision player at 200% zoom: reads labels and reaches all toggles without horizontal scrolling.
- Motion-sensitive player: panel state remains understandable with transitions reduced.
- Returning player with malformed legacy storage: sees usable defaults instead of a crash.

## Adaptive Preferences

Respect the existing font-color configuration and `prefers-reduced-motion`; retain the game’s page language rather than adding a competing theme system.

## Verification Matrix

- Node behavior tests for legacy import, page-action defaults, bounded position, and malformed input.
- Built userscript inspection plus a component/browser fixture for mount, open/close, persistence, and repeated initialization.
- Visual QA at narrow, mid, and desktop viewport widths where local userscript injection is available.

## Design Debt Register

| Item | Location | Severity | Affected users | Status |
|---|---|---|---|---|
| Live local-userscript injection depends on the browser manager installation | Browser QA environment | Note | All manual QA users | Record limitation; use fixture until install path is available |
