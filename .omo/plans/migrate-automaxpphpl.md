# migrate-automaxpphpl - Work Plan

## TL;DR (For humans)
<!-- Fill this LAST, after the detailed plan below is written, so it summarizes the REAL plan. -->
<!-- Plain English for a non-engineer: NO file paths, NO todo numbers, NO wave/agent/tool names. -->

**What you'll get:** The entire AutoMaxPPHPL userscript feature set rebuilt as maintainable SimComps Little Tools components: profit/forecast calculators, executive tools, settings, data refresh, map/chat utilities, and userscript delivery metadata. Each verified layer is committed and pushed to one new development branch.

**Why this approach:** The source is a 12,757-line single IIFE with 24 numbered feature groups, 186 functions, workers, storage, and browser hooks. Splitting it behind the current component lifecycle preserves behavior while preventing duplicate page observers and makes each layer independently reversible.

**What it will NOT do:** It will not paste the old monolith into the project, retain the old updater or unneeded privileged APIs, add a backend, or touch `main`.

**Effort:** XL
**Risk:** High - source behavior depends on a changing third-party SPA, cached API data, generated Workers, and many overlapping DOM controls.
**Decisions to sanity-check:** Combined distribution carries AGPL-3.0 attribution; legacy user settings import once but stale response caches do not; only the proven GM/VWAP permission is retained.

Your next move: execution starts on the dedicated development branch; the plan requires an independent review and browser proof before completion. Full execution detail follows below.

---

> TL;DR (machine): XL/high-risk full 24-module userscript migration, executed as 14 verified and individually pushed layers on `codex/dev-bench-automaxpphpl`.

## Scope
### Must have
- Reimplement every behavior grouped by source modules 1-24 as maintainable CommonJS services and self-registering `BaseComponent` modules; source line boundaries are the behavioral specification.
- Preserve all source-visible settings, calculations, observers, data refresh behavior, Workers, page routing, and ancillary accessibility utilities in the current SimComps Little Tools distribution.
- Use one new branch, `codex/dev-bench-automaxpphpl`, from `main`; every completed migration layer must have its own verified commit and successful `git push -u origin` / `git push`.
- Preserve existing target behavior by merging overlap into the existing component or one new authoritative component, never run two observers that perform the same UI mutation.
- Release the combined distribution as AGPL-3.0 with source attribution; generate a userscript metadata block that includes `GM_xmlhttpRequest` and `@connect api.simcotools.com` for the only cross-origin source requirement.
### Must NOT have (guardrails, anti-slop, scope boundaries)
- Do not copy the 12,757-line source IIFE wholesale, retain its legacy updater, or load its remote executable script.
- Do not rewrite `main`, force-push, add a backend/proxy, import stale source API caches, or expose an unrequested new public endpoint.
- Do not silently delete current project behavior; resolve duplicate controls by preserving the union of observable functionality and one authoritative DOM owner.
- Do not introduce privileged GM APIs beyond `GM_xmlhttpRequest`, nor retain `unsafeWindow` or `GM_registerMenuCommand` when target settings/front UI can provide the same function.

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: tests-after. Add Node built-in `node:test` characterization/behavior tests for pure calculation, storage, parser, routing, and worker-message helpers; use `npm run build` for the production bundle.
- Evidence: `.omo/evidence/migrate-automaxpphpl/task-<N>-<name>.{log,json,png}`. Each layer records its command output, parsed userscript header, and a browser/manual-QA result; no test-only claim is enough for DOM-facing behavior.
- Browser QA: use the built userscript on a real SimCompanies page through the installed browser-control surface. If an authenticated page is unavailable, run the matching page fixture plus a manual DOM/Worker smoke harness and record the limitation before proceeding.
- Adversarial checks: every task explicitly probes stale persisted data, repeated observers/initialization, malformed cache/API input, and generated-bundle freshness; external-fetch tasks also exercise timeout/error fallback.

## Execution strategy
### Parallel execution waves
> Target 5-8 todos per wave. Fewer than 3 (except the final) means you under-split.

Wave 0 establishes the branch and source-compatible release/foundation contracts. Wave 1 builds shared data, storage, request interception, worker, router, and settings seams. Wave 2 fans out independent calculation suites once that foundation is stable. Wave 3 migrates executive and utility suites in parallel. Wave 4 performs end-to-end integration, packaging, visual QA, and release evidence.

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1 | none | 2-14 | none |
| 2 | 1 | 3-14 | none |
| 3 | 2 | 4-12 | 4 |
| 4 | 2 | 5-12 | 3 |
| 5 | 3,4 | 6-10 | 11,12 |
| 6 | 3,4,5 | 13,14 | 7,8,9,10 |
| 7 | 3,4,5 | 13,14 | 6,8,9,10 |
| 8 | 3,4,5 | 13,14 | 6,7,9,10 |
| 9 | 3,4,5 | 13,14 | 6,7,8,10 |
| 10 | 3,4,5 | 13,14 | 6,7,8,9 |
| 11 | 3,4 | 13,14 | 5-10,12 |
| 12 | 3,4 | 13,14 | 5-11 |
| 13 | 6-12 | 14,F1-F4 | none |
| 14 | 13 | F1-F4 | none |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->
- [x] 1. Create the task-owned development branch and source-compatible release contract
  What to do / Must NOT do: Create and switch to `codex/dev-bench-automaxpphpl` from the verified current `main`; add AGPL-3.0 licensing/attribution for the imported behavior; update `package.json` and `postBuild.js` metadata to use the target release mechanism, `GM_xmlhttpRequest`, and `@connect api.simcotools.com`. Do not retain source update URLs, `unsafeWindow`, or `GM_registerMenuCommand`; do not change `main`.
  Parallelization: Wave 0 | Blocked by: none | Blocks: 2-14
  References (executor has NO interview context - be exhaustive): `autoMaxPPHPL (4).user.js:1-16,9799-9827,12712-12757`; `package.json:1-25`; `postBuild.js:1-42`; `.omo/drafts/migrate-automaxpphpl.md` decisions.
  Acceptance criteria (agent-executable): `git branch --show-current` prints `codex/dev-bench-automaxpphpl`; `npm run build`; parse `dist/build.user.js` and assert AGPL attribution, one `@match`, `@grant GM_xmlhttpRequest`, `@connect api.simcotools.com`, and no source update URL/unsafe grants.
  QA scenarios (name the exact tool + invocation): happy: `node scripts/verify-userscript.mjs dist/build.user.js`; failure: invoke it with a fixture missing the required metadata and assert non-zero; evidence `.omo/evidence/migrate-automaxpphpl/task-1-release.log`.
  Commit: Y | `feat(release): prepare automax migration branch and metadata`

- [x] 2. Add the isolated AutoMax service and test foundation
  What to do / Must NOT do: Add `tools/automax/` CommonJS modules and `test/automax/` Node-test conventions for pure logic; establish typed-by-contract result/error shapes, a Worker factory with Blob URL cleanup, and a test command. Do not change UI components or duplicate target `tools` helpers.
  Parallelization: Wave 1 | Blocked by: 1 | Blocks: 3-14
  References (executor has NO interview context - be exhaustive): `tools/tools.js:1-302,411-642`; `tools/baseComponent.js:31-94`; source Worker sites `autoMaxPPHPL (4).user.js:3695,4160,5424,5630,7495,7605,7715,7821,8745,10938`.
  Acceptance criteria (agent-executable): `npm test -- --test-name-pattern='automax foundation'` passes; a controlled Worker error and a normal message both revoke Blob URLs and settle once; current target components still import/build unchanged.
  QA scenarios (name the exact tool + invocation): happy: `node --test test/automax/foundation.test.js`; failure: mock a malformed Worker message and assert an explicit error result rather than a thrown unhandled exception; evidence `.omo/evidence/migrate-automaxpphpl/task-2-foundation.log`.
  Commit: Y | `feat(automax): add shared migration foundation`

- [x] 3. Migrate data, cache, and constants services for source modules 1-4
  What to do / Must NOT do: Implement source-equivalent request JSON/text retry, region data aggregation, namespaced IndexedDB-backed user settings/data cache, building and warehouse response handlers, and live constants parser under `tools/automax/`. Import only user-authored legacy localStorage settings once; never import stale API caches as authoritative data.
  Parallelization: Wave 1 | Blocked by: 2 | Blocks: 5-12
  References (executor has NO interview context - be exhaustive): source modules 1-4 `autoMaxPPHPL (4).user.js:1050-1728`; target request/storage seams `tools/tools.js:257-302,411-642`; target initialization `index.js:27-59`.
  Acceptance criteria (agent-executable): characterization tests cover successful JSON/text fetch, three-retry failure, malformed persisted JSON, stale cache rejection, realm-key isolation, building active-slot merge, warehouse merge, and constants parser failure; `npm run build` passes.
  QA scenarios (name the exact tool + invocation): happy: `node --test test/automax/data-services.test.js`; failure: serve malformed bundle text with a local fixture and assert a recoverable no-data result; evidence `.omo/evidence/migrate-automaxpphpl/task-3-data-services.log`.
  Commit: Y | `feat(automax): migrate data and cache services`

- [x] 4. Add safe fetch/XHR capture, routing, and refresh scheduling
  What to do / Must NOT do: Extend the target lifecycle with idempotent fetch and XHR response capture registered through AutoMax services; add route matching and TTL refresh scheduling for source modules 2-1, 2-2, 9, and 10. Do not globally replace browser APIs more than once or break existing XHR `netFuncList` dispatch.
  Parallelization: Wave 1 | Blocked by: 2 | Blocks: 5-12
  References (executor has NO interview context - be exhaustive): `autoMaxPPHPL (4).user.js:1266-1445,7084-7399`; `index.js:63-87`; `tools/tools.js:846-951`; target source hook behavior must coexist with existing `window.XMLHttpRequest` wrapper.
  Acceptance criteria (agent-executable): tests prove one capture per request, preserved original fetch/XHR behavior, route changes invoke only matching handler, stale TTL refresh occurs once, and duplicate initialization does not double-observe; production build succeeds.
  QA scenarios (name the exact tool + invocation): happy: `node --test test/automax/interception-router.test.js`; failure: initialize twice and feed a 500/malformed JSON response, assert no cache mutation and one logged recoverable failure; evidence `.omo/evidence/migrate-automaxpphpl/task-4-routing.log`.
  Commit: Y | `feat(automax): add capture routing and refresh lifecycle`

- [ ] 5. Migrate the control panel, legacy settings import, and page-action configuration
  What to do / Must NOT do: Implement the source module 5 shell as target `BaseComponent` setting/front UI using target CSS/tokens and IndexedDB persistence; port drag-safe panel state, toggles, page-action configuration, and saturation data access. Do not copy source inline styles wholesale or expose a separate GM menu.
  Parallelization: Wave 2 | Blocked by: 3,4 | Blocks: 6-12
  References (executor has NO interview context - be exhaustive): `autoMaxPPHPL (4).user.js:1730-2963,3517-3547`; `components/exampleComponent.js:8-110`; `components/basisCPT.js:441-700`; `tools/tools.js:79-93,657-818`.
  Acceptance criteria (agent-executable): settings render once, persist/reload through IndexedDB, legacy user-setting import is idempotent, panel position remains in viewport, toggles drive page actions, and the target build has no duplicate IDs.
  QA scenarios (name the exact tool + invocation): happy: browser-control open a SimCompanies page, open the plugin settings, toggle a visible AutoMax setting, reload, and verify the persisted state; failure: seed malformed legacy settings and verify defaults render without a crash; evidence `.omo/evidence/migrate-automaxpphpl/task-5-panel.png` plus `.log`.
  Commit: Y | `feat(automax): add control panel and settings migration`

- [ ] 6. Migrate runtime-duration controls and saturation table behaviors
  What to do / Must NOT do: Port source modules 5-1 and 5-2 into focused AutoMax components using the foundation data and page-action configuration; preserve calculation input semantics and sortable saturation display. Do not modify unrelated target quantity controls without characterizing their existing behavior first.
  Parallelization: Wave 2 | Blocked by: 3,4,5 | Blocks: 13
  References (executor has NO interview context - be exhaustive): `autoMaxPPHPL (4).user.js:2964-3516`; existing controls `components/customQuantityButton.js`, `components/warehouseCustomQuantitySelect.js`, `components/retailDisplayProfit.js`.
  Acceptance criteria (agent-executable): unit tests cover runtime input normalization and saturation sorting; on matching DOM fixtures the components inject exactly one control/table, react to route changes, and honor the page-action toggle.
  QA scenarios (name the exact tool + invocation): happy: `node --test test/automax/runtime-saturation.test.js`; failure: inject invalid duration/empty constants fixture and assert control presents a validation state without mutating page form values; evidence `.omo/evidence/migrate-automaxpphpl/task-6-runtime.log`.
  Commit: Y | `feat(automax): migrate runtime and saturation controls`

- [ ] 7. Migrate shop, market, and incoming-contract maximum-profit calculations
  What to do / Must NOT do: Port source modules 6-8 to worker-backed calculation services plus one DOM owner per page; preserve high-price configuration and page setting behavior. Merge or delegate from existing `retailDisplayProfit`, `sellProfitDisplay`, and contract components instead of producing competing labels.
  Parallelization: Wave 2 | Blocked by: 3,4,5 | Blocks: 13
  References (executor has NO interview context - be exhaustive): `autoMaxPPHPL (4).user.js:3548-7083`; `components/retailDisplayProfit.js`; `components/sellProfitDisplay.js`; `components/ACCAutomaticInquiry.js`; foundation Worker contract from todo 2.
  Acceptance criteria (agent-executable): fixture tests cover representative valid calculations, zero/negative/missing price inputs, Worker error fallback, high-price setting persistence, and idempotent card annotations; `npm run build` passes.
  QA scenarios (name the exact tool + invocation): happy: `node --test test/automax/profit-pages.test.js`; failure: dispatch malformed market/contract response and verify stale labels are removed rather than retained; evidence `.omo/evidence/migrate-automaxpphpl/task-7-profit-pages.log`.
  Commit: Y | `feat(automax): migrate shop market and contract profit tools`

- [ ] 8. Migrate forecast calculation, result viewing, and page refresh integration
  What to do / Must NOT do: Port source modules 10-12 into AutoMax worker tasks and a target component panel; preserve inventory/market/incoming/outgoing forecast boundaries and cache freshness semantics. Do not trust missing or stale cache records as a forecast result.
  Parallelization: Wave 2 | Blocked by: 3,4,5 | Blocks: 13
  References (executor has NO interview context - be exhaustive): `autoMaxPPHPL (4).user.js:7208-8577`; `components/warehouseChangeRecords.js:1-180`; `tools/tools.js:293-301`.
  Acceptance criteria (agent-executable): deterministic fixture tests cover each forecast source, expiry refresh, normal result panel rendering, and Worker cleanup; an empty inventory/market/contracts fixture renders an explicit empty state.
  QA scenarios (name the exact tool + invocation): happy: `node --test test/automax/forecast.test.js`; failure: return one rejected API promise and assert the prior forecast is not displayed as current; evidence `.omo/evidence/migrate-automaxpphpl/task-8-forecast.log`.
  Commit: Y | `feat(automax): migrate forecast calculations and viewer`

- [ ] 9. Migrate MP percentage, outgoing-contract, and warehouse-retail calculation suites
  What to do / Must NOT do: Port modules 13, 18, and 19; implement cross-origin VWAP via the authorized GM request with safe same-origin fallback, TTL cache, quality/preset handling, worker calculations, and page-specific rendering. Do not issue duplicate VWAP requests or expose secret headers/tokens.
  Parallelization: Wave 2 | Blocked by: 3,4,5 | Blocks: 13
  References (executor has NO interview context - be exhaustive): `autoMaxPPHPL (4).user.js:8578-8830,9777-11304`; `components/chatMPDisplay.js`; `components/warehouseACCmpOffest.js`; `components/warehousePriceCount.js`; userscript grants from todo 1.
  Acceptance criteria (agent-executable): tests cover valid/invalid quality, preset serialization, cached/fresh/timeout VWAP, zero market rows, and worker cleanup; metadata test confirms the GM grant before a GM call is enabled.
  QA scenarios (name the exact tool + invocation): happy: `node --test test/automax/mp-warehouse.test.js`; failure: mock GM failure and CORS-like fetch rejection, assert explicit unavailable state without uncaught rejection; evidence `.omo/evidence/migrate-automaxpphpl/task-9-mp.log`.
  Commit: Y | `feat(automax): migrate MP and warehouse calculation tools`

- [ ] 10. Migrate boardroom and executive information/calculation tools
  What to do / Must NOT do: Port the initial boardroom calculator plus source modules 14-17 into components/services for training history, former executive details, custom-data button, COO calculation, and target-style modals. Merge with `customExecutivesIcon` without losing its existing avatar behavior.
  Parallelization: Wave 3 | Blocked by: 3,4,5 | Blocks: 13
  References (executor has NO interview context - be exhaustive): `autoMaxPPHPL (4).user.js:147-994,8831-9776`; `components/customExecutivesIcon.js:1-150`; target modal/message helpers `tools/tools.js:657-818`.
  Acceptance criteria (agent-executable): fixtures prove executive API capture and route isolation, slot drag/drop state persistence, stable history de-duplication, former-detail empty state, COO calculation input validation, and one injected button per page.
  QA scenarios (name the exact tool + invocation): happy: `node --test test/automax/executives.test.js`; failure: provide malformed executive payload and assert no malformed DOM/uncaught error; evidence `.omo/evidence/migrate-automaxpphpl/task-10-executives.log`.
  Commit: Y | `feat(automax): migrate executive calculation and history tools`

- [ ] 11. Migrate chat, map, PA-answer, Snipboard, and input-expander utilities
  What to do / Must NOT do: Port source modules 20-24 while merging into `chatFilter`, `chatHelper`, `chatBiggerTextarea`, and `unBusyHighLight` where their responsibilities overlap; retain PA one-hour data cache and a documented unavailable-data state. Do not retain source updater polling or duplicate mutation observers.
  Parallelization: Wave 3 | Blocked by: 3,4 | Blocks: 13
  References (executor has NO interview context - be exhaustive): `autoMaxPPHPL (4).user.js:11305-12757`; `components/chatFilter.js`; `components/chatHelper.js`; `components/chatBiggerTextarea.js`; `components/unBusyHighLight.js`; source PA URL `autoMaxPPHPL (4).user.js:11624-11666`.
  Acceptance criteria (agent-executable): DOM tests prove each utility is idempotent; emoji labels, idle-map highlight, PA answer rendering/cache expiry, Snipboard image preview sanitization, and textarea growth work; existing component behavior remains characterized and passing.
  QA scenarios (name the exact tool + invocation): happy: `node --test test/automax/utilities.test.js`; failure: supply unavailable PA response, hostile image URL, and repeated mutation batch, assert safe placeholder/no duplicate nodes; evidence `.omo/evidence/migrate-automaxpphpl/task-11-utilities.log`.
  Commit: Y | `feat(automax): migrate accessibility and chat utilities`

- [ ] 12. Reconcile all target overlap and source update-feedback behavior
  What to do / Must NOT do: Audit the new and existing components for duplicate selectors, repeated network capture, duplicate controls, or settings conflicts; preserve the union of source/current behavior; implement target-owned version/update feedback without source URL polling. Do not delete a current behavior unless the new implementation demonstrably covers it.
  Parallelization: Wave 3 | Blocked by: 3,4 | Blocks: 13
  References (executor has NO interview context - be exhaustive): source overlap modules `autoMaxPPHPL (4).user.js:3548-4016,8578-8830,11305-12757`; target `components/retailDisplayProfit.js`, `components/sellProfitDisplay.js`, `components/chatMPDisplay.js`, `components/unBusyHighLight.js`, `components/chatBiggerTextarea.js`, `components/customExecutivesIcon.js`; `postBuild.js:1-42`.
  Acceptance criteria (agent-executable): a component inventory test finds one owner for each migrated selector/route and one capture wrapper; bundle has no source updater host; old component characterization tests remain passing.
  QA scenarios (name the exact tool + invocation): happy: `node --test test/automax/overlap-audit.test.js`; failure: intentionally load two matching component fixtures and assert only one control/annotation appears; evidence `.omo/evidence/migrate-automaxpphpl/task-12-overlap.log`.
  Commit: Y | `refactor(automax): consolidate migrated feature ownership`

- [ ] 13. Build, package, and execute full browser-facing integration verification
  What to do / Must NOT do: Run every automated test, production build, generated-userscript inspection, and full browser fixture/live-page QA across every migrated source group; fix any discovered migration defect before proceeding. Do not claim a feature complete from grep or source review alone.
  Parallelization: Wave 4 | Blocked by: 6-12 | Blocks: 14,F1-F4
  References (executor has NO interview context - be exhaustive): all task evidence; `package.json:6-10`; `webpack.config.js:1-68`; `postBuild.js:1-42`; source route/module matrix `autoMaxPPHPL (4).user.js:1050-12757`.
  Acceptance criteria (agent-executable): `npm test`, `npm run build`, userscript metadata verifier, and an end-to-end component fixture run all pass; no uncommitted generated artifact is silently omitted; all 24 source module groups are marked in the migration matrix.
  QA scenarios (name the exact tool + invocation): happy: browser-control load a matching page/fixture, open settings, exercise each category, inspect component DOM and console errors; failure: repeat initialization and offline remote-response fixture, assert clear fallback UI/no duplicate observers; evidence `.omo/evidence/migrate-automaxpphpl/task-13-integration.{png,log,json}`.
  Commit: Y | `test(automax): verify complete userscript migration`

- [ ] 14. Push every verified migration layer and prove remote branch completeness
  What to do / Must NOT do: Verify that the branch contains one atomic layer commit for todos 1-13, push any unpushed commits to `origin/codex/dev-bench-automaxpphpl`, and compare `main...HEAD`. Do not force-push or include untracked unrelated files.
  Parallelization: Wave 4 | Blocked by: 13 | Blocks: F1-F4
  References (executor has NO interview context - be exhaustive): Git state from each prior task; `git-master` commit safety rules; `.omo/evidence/migrate-automaxpphpl/`.
  Acceptance criteria (agent-executable): `git log --oneline origin/main..HEAD` lists all verified layer commits; `git status --short` has only intentional evidence/plan state; `git ls-remote --heads origin codex/dev-bench-automaxpphpl` equals `HEAD`.
  QA scenarios (name the exact tool + invocation): happy: `git push -u origin codex/dev-bench-automaxpphpl` then `git ls-remote --heads origin codex/dev-bench-automaxpphpl`; failure: simulate no-upstream locally and assert the documented push command establishes it without touching `main`; evidence `.omo/evidence/migrate-automaxpphpl/task-14-push.log`.
  Commit: Y | `chore(automax): record verified migration delivery`

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [ ] F1. Plan compliance audit
  Verify every source module group 1-24 maps to an implemented target service/component, every dependency matrix prerequisite is completed, all layer commits are on the remote development branch, and every acceptance/evidence reference exists. Evidence `.omo/evidence/migrate-automaxpphpl/f1-plan-compliance.json`.
- [ ] F2. Independent code-quality and security review
  Review the final diff for component lifecycle correctness, duplicate observer/interceptor risks, unsafe DOM/image/remote-data handling, GM metadata minimality, license attribution, stale state, and regression risk. Bind the verdict to the exact final commit SHA. Evidence `.omo/evidence/migrate-automaxpphpl/f2-code-review.md`.
- [ ] F3. Real userscript manual QA and visual verification
  Drive the generated userscript through the browser-control surface on a real matching page or documented simulation fixture, at desktop/tablet/mobile viewports; inspect every settings surface and migrated category, capture screenshots, and verify no console errors/duplicate UI. Evidence `.omo/evidence/migrate-automaxpphpl/f3-browser/`.
- [ ] F4. Scope-fidelity and remote-delivery audit
  Compare source module boundaries to the final migration matrix, prove all layer commits reach the named remote branch, prove no source IIFE/legacy updater remains, and verify `main` was not rewritten. Evidence `.omo/evidence/migrate-automaxpphpl/f4-scope-delivery.json`.

## Commit strategy
- Base branch: `main` at `884a64e0edf262383c625db794b26ab7dac428cc`; never commit or push directly to it.
- Task branch: `codex/dev-bench-automaxpphpl`, created from that base before task 1.
- Commit and push after each completed todo 1-13. Before every commit: inspect `git status --short`, `git diff --staged --stat`, and the staged diff; after every commit: verify `git log -1 --oneline`, then `git push` and record the remote SHA.
- Preserve only intentional `.omo/` plan/evidence state; never stage unrelated user changes. Generated `dist/build.user.js` and `dist/version.json` travel with the source layer that regenerates them.
- Todo 14 is the branch audit/push proof, not a force-push or history rewrite.

## Success criteria
- All 24 source module groups have an explicit target mapping and observable test/browser evidence.
- The generated userscript is production-built, contains the approved license/metadata, and loads with no duplicate lifecycle hooks or unhandled errors.
- User-authored legacy settings migrate once; stale source caches are ignored and remotely fetched data fails safely.
- Existing target features that overlap source behavior remain available through one authoritative control per behavior.
- Every migration layer is committed and pushed to `origin/codex/dev-bench-automaxpphpl`; `origin/main` remains unchanged.
- F1-F4 and the required global review/debugging gate pass for the exact final remote commit.
