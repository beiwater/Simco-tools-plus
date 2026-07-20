# Task 1 evidence: release contract

- Branch: `codex/dev-bench-automaxpphpl` from `main` base
  `884a64e0edf262383c625db794b26ab7dac428cc`.
- Commit: `76119beb6ff2cc06a88a4e9850f22f9c3cc8fc58`
  (`feat(release): prepare automax migration branch and metadata`).
- `npm test` passed: 2 tests, 0 failures.
- `npm run build` passed. Webpack reported only its pre-existing 283 KiB
  performance-budget warnings.
- `npm run verify:userscript` passed against the generated `dist/build.user.js`.
- Manual generated-artifact inspection confirmed exactly one SimCompanies match,
  AGPL attribution, `GM_xmlhttpRequest`, and `@connect api.simcotools.com`.
- `git push -u origin codex/dev-bench-automaxpphpl` completed successfully.

Adversarial results: malformed fixture without the GM grant is rejected by the
new verifier; stale output was rejected before rebuilding; no secrets, headers,
or browser state were recorded. No temporary service or browser process was
created.
