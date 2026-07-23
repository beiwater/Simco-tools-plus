# Task 3 evidence: data and cache services

- Commit: `1db5f84` (`feat(automax): migrate data and cache services`).
- Failing-first proof: `node --test test/automax/data-services.test.js` initially
  failed with missing service modules, then passed 7/7 after implementation.
- Full `npm test` passed 12/12; `npm run build` and
  `npm run verify:userscript` passed.
- Tests cover request retry/exhaustion, academy/bank calculations, realm cache
  isolation and expiry, warehouse merge preservation, safe constants extraction,
  and malformed bundle failure.
- The constants parser extracts literal fields only and does not evaluate fetched
  bundle text.
- Push: `1db5f84` reached `origin/codex/dev-bench-automaxpphpl`.
