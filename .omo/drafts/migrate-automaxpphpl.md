---
slug: migrate-automaxpphpl
status: approved-for-execution
intent: clear
review_required: false
pending-action: execute .omo/plans/migrate-automaxpphpl.md on codex/dev-bench-automaxpphpl
approach: Rebuild the source userscript as cohesive BaseComponent modules, preserve each observable feature, and share target infrastructure rather than copying the 12,757-line IIFE. Deliver every independently verified migration layer as an atomic commit pushed to one new development branch.
---

# Draft: migrate-automaxpphpl

## Components (topology ledger)
<!-- Lock the SHAPE before depth. One row per top-level component that can succeed or fail independently. -->
<!-- id | outcome (one line) | status: active|deferred | evidence path -->
| foundation | Compatible metadata, storage, API/cache, request interception, workers, and shared UI utilities | active | source `autoMaxPPHPL (4).user.js:1-16,1050-1729`; target `tools/baseComponent.js:31-94`, `tools/tools.js:257-302,411-642`, `index.js:27-87` |
| control-shell | Settings/panel, per-page configuration, auto-amount, and saturation controls are exposed through target component settings/front UI | active | source `autoMaxPPHPL (4).user.js:1730-3547`; target `components/exampleComponent.js:8-110` |
| profit-suite | Shop, market, inbound/outbound contract, MP percentage, forecast, and warehouse retail calculations retain their source-visible results | active | source `autoMaxPPHPL (4).user.js:3548-11304` |
| executive-suite | Boardroom calculator, training history, former-executive details, custom controls, and COO calculation work on their target pages | active | source `autoMaxPPHPL (4).user.js:147-994,8831-9776`; target `components/customExecutivesIcon.js` |
| utility-suite | Chat accessibility, map idle highlight, PA answers, Snipboard previews, chat input expansion, and update feedback migrate without duplicate target controls | active | source `autoMaxPPHPL (4).user.js:11305-12757`; target `components/chatFilter.js`, `components/unBusyHighLight.js`, `components/chatBiggerTextarea.js` |
| distribution-and-data | License, userscript permissions, outbound dependencies, and optional legacy settings import are made explicit and safe | active | source `autoMaxPPHPL (4).user.js:1-16,9799-9827,11624-11666`; target `package.json:13`, `postBuild.js:16-22` |

## Open assumptions (announced defaults)
<!-- Record any default you adopt instead of asking, so the user can veto it at the gate. -->
<!-- assumption | adopted default | rationale | reversible? -->
| Architecture | Implement feature groups as target `BaseComponent` modules backed by shared services, never paste the source IIFE wholesale | Gives every feature a lifecycle, setting surface, and testable seam in the existing runtime | yes |
| Scope | The 24 labelled source modules are in scope, including ancillary utilities and update feedback, not only the named hourly-profit calculator | The user explicitly requested every feature | no |
| Test strategy | Add tests after migration for pure calculation/storage helpers; manually exercise every browser-facing flow on a live matching page | The target has no test harness, while DOM/SPA behavior requires real-page QA | yes |
| Existing-feature collisions | Consolidate overlapping behavior into one target control and preserve the union of capabilities rather than display duplicate buttons or observers | Existing project already overlaps chat, map, executive, retail, warehouse, and image-style utilities | yes |

## Findings (cited - path:lines)
- The source is a 12,757-line AGPL-3.0 userscript with GM grants and a SimCompanies-wide match; it is a single IIFE rather than an importable module. `autoMaxPPHPL (4).user.js:1-21`
- Structural AST inventory found 186 function declarations, 10 Blob-worker constructions, and 136 localStorage operations; it has no class declarations. This confirms a functional decomposition is safer than line-by-line copying. `autoMaxPPHPL (4).user.js:62-12588`
- The source explicitly partitions its behavior into modules 1-24: data foundation at lines 1050-1729; UI/auto controls at 1730-3547; profit calculations at 3548-11304; utilities at 11305-12588. `autoMaxPPHPL (4).user.js:1050-12588`
- Cross-origin VWAP uses `GM_xmlhttpRequest` with `@connect api.simcotools.com`; PA answers and the legacy updater use `sc.22-7.top`. `autoMaxPPHPL (4).user.js:10-15,9799-9827,11624-11666,12712-12757`
- The target auto-loads self-registering `BaseComponent` files, persists component state with IndexedDB, and routes click/keydown/mutation/XHR events. `tools/baseComponent.js:31-94`, `index.js:1-87`, `tools/tools.js:411-642,846-951`
- The target package declares ISC and generated script declares MIT with `@grant none`, so direct import of AGPL-derived source code and source GM paths requires an explicit distribution decision. `package.json:13`, `postBuild.js:16-22`
- Existing target modules already cover portions of the source scope (chat, idle maps, executive customization, retail/warehouse, etc.), so a duplicate-component approach would create competing observers and UI. `components/chatFilter.js`, `components/unBusyHighLight.js`, `components/customExecutivesIcon.js`, `components/retailDisplayProfit.js`, `components/warehousePriceCount.js`

## Decisions (with rationale)
- Treat the source script as the behavioral inventory and migrate it by module boundary into the target lifecycle; the source file itself is not a target artifact.
- Maintain a feature-to-component mapping and shared foundation services before moving calculation modules, because their source implementation repeats request interception, cache access, and worker setup.
- Do not silently retain remote executable/update behavior or alter copyright/licensing metadata; these are owner-controlled release decisions.
- Use the recorded default release decision: retain source attribution, make the combined distribution AGPL-3.0, and add only `GM_xmlhttpRequest` plus `@connect api.simcotools.com` for the proven cross-origin VWAP flow.
- Replace source GM menu and `unsafeWindow` integration with the target settings/front UI; retain PA answer data as an explicit remote-data dependency and replace the legacy updater with the target release metadata.
- Import only user-authored legacy settings once, never stale API response caches; use `codex/dev-bench-automaxpphpl` as the one remote development branch and push every verified layer there.

## Scope IN
- All source modules 1-24 and the source update-feedback behavior.
- Target-compatible shared services for source storage, data capture, workers, page routing, settings, and UI.
- Explicit compatibility handling for all target/source feature overlap.
- Build validation plus browser userscript QA of each migrated feature group.
- A new development branch from `main`, with one verified atomic commit and push per completed migration layer.

## Scope OUT (Must NOT have)
- A raw copy of the 12,757-line IIFE inside a component or generated bundle.
- A new backend, proxy service, or unapproved third-party dependency.
- Silent deletion or regression of current-project functionality to make similarly named source features fit.
- Silent reuse of source-hosted update code, remote assets, or licenses without the requested release decision.
- Rewriting, force-pushing, or otherwise modifying `main` or any existing remote branch.

## Open questions
- No unanswered owner decisions remain. The persistent execution objective authorizes the recorded defaults and the layer-by-layer branch workflow.

## Approval gate
status: approved-for-execution
<!-- When exploration is exhausted and unknowns are answered, set status: awaiting-approval. -->
<!-- That durable record is the loop guard: on a later turn read it and resume at the gate instead of re-running exploration. -->
Approach: execute the complete dependency-first plan on `codex/dev-bench-automaxpphpl`, with one verified atomic commit and push for each layer. The persistent execution objective is the start authorization.
