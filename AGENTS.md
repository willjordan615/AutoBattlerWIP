# Agent development and testing guide

Repository: https://github.com/willjordan615/AutoBattlerWIP
Playable GitHub Pages build: https://willjordan615.github.io/AutoBattlerWIP/
Default branch: main. JavaScript ES modules, Node.js 22+.

## Access and changes
Prefer the connected GitHub integration to read and edit files **directly**. Fetch the latest file and SHA before updating it. Do not clone the repository by default; ask before cloning if direct access is unavailable. Connector permissions are session-specific: this document does not grant tool access.

## Testing without cloning
- The deterministic, DOM-free combat engine is in `src/simulation.js`.
- Drafting, full-match orchestration, persistent HP and combat lifecycle are in `src/headless.js`.
- Bot draft decisions are in `src/draft-ai.js`.
- Browser UI is in `src/game.js`.
- Automated agent-vs-bots playtesting: `node scripts/agent-playtest.js 12 1` (matches, seed).
- Full test suite: `npm test` (GitHub Actions workflow: `.github/workflows/tests.yml`).
- Balance baseline: `npm run balance:report -- 100 strategic 1`; random baseline: `npm run balance:report -- 100 random 1`.

If Node cannot access the repository locally, use the GitHub connector to fetch relevant source files, resolve imports and exports in an isolated JavaScript execution environment, and run deterministic smoke tests. Clearly label such checks as *isolated smoke tests*, not the complete Node test suite. The permanent agent-playtest script is the reproducible reference implementation and should be run in a real Node environment or CI when possible.

## What the playtest harness does
`scripts/agent-playtest.js` controls seat 0 with the strategic drafting policy, plays against three strategic drafting bots, advances the full deterministic match, and records combat duration, timeouts, ranking, draft picks and selected unit configuration. It is a headless scripted agent, **not** a browser-clicking or language-model-driven player. Use custom seeded combat scenarios to inspect tactical movement and interception; match completion alone does not validate AI movement quality.

## After gameplay changes
1. Add focused regression tests for the altered behavior.
2. Run `npm test` and the agent playtest when execution is available.
3. Report actual commands, seed counts, failures, timeouts, and unverified behavior.
4. Update the visible prototype label in `index.html`, the version in `build.json`, and module import cache identifiers when shipping a new playable version.
5. Commit and provide the GitHub commit link. GitHub Pages may deploy asynchronously; don't claim the live page has updated without verifying.

## Collaboration preferences
Make sensible implementation decisions without frequent interruptions. Batch related work. Prefer reproducible seeded tests and root-cause fixes. Preserve performance on low-end Android devices. Do not claim tests passed unless they executed.

## Navigation and timeout diagnostics
Run `npm run diagnose:navigation -- 8 1` for seeded strategic matches plus fixed terrain scenarios. Add `--json` for per-unit movement traces and timeout classifications. The combat engine's opt-in `battle.diagnostics={units:{}}` collects idle frames, blocked frames, path replans, waypoint changes, stuck events, reversals, collision displacement loss, attack opportunities, shots, damage, and sampled positions. Diagnostics are disabled in normal gameplay. Treat timeout classifications as hypotheses, not proven causes. Use the fixed Central Barrier bruiser scenario as a known regression until it clears reliably.

Navigation regression gates: `npm run diagnose:navigation -- 8 1` exits unsuccessfully when a pursuer remains physically immobilized for 3 simulated seconds or any stationary-target fixture fails to find an attack position. Prioritize the obstacle collision shell regression test: obstacle resolution must only correct actual overlaps, never pull a valid unit backwards within an arbitrary near-wall buffer. Tests use combat line of sight plus attack range, not padded navigation line of sight, to determine objective completion. Timeout totals alone are not a failure: defensive combat may legitimately last 30 seconds.

## Physical projectile combat (Prototype 2.0)
Ranged attacks now create projectiles in `battle.projectiles` with deterministic fixed-step travel and swept segment collision. `advanceProjectiles(state, dt, attacks)` resolves earliest collisions against expanded obstacle rectangles, the arena boundary, and the first hostile chassis encountered, rather than applying hit damage at launch. Friendlies do not intercept. Piercing permits one additional enemy per stack but never ignores walls; multishot has independent spread shots sharing a per-volley hit set. Projectile `area` increases collision radius. Only actual impacts generate damage/impact events. The browser renders live state projectiles, not timed cosmetic tracers. Keep projectile physics in `src/simulation.js` and verify with the dedicated projectile regression tests in `tests/simulation.test.js`. Melee remains immediate.
