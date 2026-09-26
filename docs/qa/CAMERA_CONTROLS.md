# Camera and direct commands — 2026-09-26

## Verified in the actual browser

- The updated production bundle is served at http://localhost:5177/ .
- Blue starts in the foreground, red in the background.
- Camera pan by drag, zoom buttons, rotation buttons, and reset were exercised in the earlier build. The buttons were removed in the next UI revision; drag, wheel/pinch zoom, and right/two-finger rotation remain.
- Direct taps on blue Bots open a compact panel (280 px wide); bottom Bot cards and bridge selector are absent.
- In the QA preview, normal simulation confirmed mining → own bridge construction → march → one enemy castle hit and return, with automatic targets. Clearing the own bridge was also confirmed after a CPU embankment.
- Selecting embankment without a bridge selector started work on the enemy bridge. That manual match ended before the embankment completed.
- Android/iOS hardware is not connected. The user will check from the local URL; hardware verification remains pending.

## Automated verification limits

The current `npm test` run failed before executing tests: Vitest could not start either worker (`Timeout waiting for worker to respond`). This is not a passing test run. Dependency/source reads on this host have repeatedly stalled, including the TypeScript build and Playwright startup. Previous test successes in VALIDATION.md do not establish success for this change.

Added `tests/intent.test.ts` for own/enemy/central targeting and camera/mobile gesture coverage in `tests/e2e/game.spec.ts`. These must be rerun once the local runner is responsive.

The running production preview uses the generated portable bundle in `/tmp/infra-rush-camera-release`, preloaded by `scripts/serve-preview.py`. Source changes remain in the repository. Recreate it with the documented portable build script when restarting; `/tmp` is not permanent storage.

A standalone Node assertion run against the actual bundled engine and target resolver passed all 17 checks (both teams, construction, sabotage, central ownership and reset to default target). This bypassed Vitest's failing worker startup; it does not replace the full suite.

Latest results: desktop camera E2E passed (1.3 minutes, including pan/zoom/rotation/reset/direct Bot tap/panel bounds). The mobile worker, normal TypeScript build and ESLint did not finish after prolonged file/dependency stalls and were interrupted; they are not marked as passed. Production compilation via the portable esbuild bundle succeeded, and the actual production browser loaded all models and the new UI.

The current LAN address is http://192.168.11.11:5177/ (HTTP 200 verified from the Mac). The previous 172.20.10.2 address no longer responded. Phone access still requires the same network and a user check.
