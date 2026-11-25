# Agent guide — AutoBattlerWIP (3.2)
Repository: https://github.com/willjordan615/AutoBattlerWIP. Default branch: main. Playable: https://willjordan615.github.io/AutoBattlerWIP/. Native JavaScript ES modules, Node 22+, no runtime dependencies.

## Workflow
- Prefer direct GitHub connector reads/writes. Fetch current branch head and relevant files before editing; do not clone by default. Access and execution depend on session tools. If GitHub calls unexpectedly fail, check https://www.githubstatus.com/ before diagnosing code or retrying writes.
- Read this guide and the relevant subsystem/test only. Read historical notes under docs/history only when investigating past behavior. Do not load every engine file into context for a small change.
- Batch related edits in one commit. Preserve seeded RNG, event order, module/draft ordering and fixed 30 Hz stepping unless explicitly changing a rule. Never mix structural refactors with balance changes.
- Prefer a short branch and an atomic commit for cross-file changes; do not overwrite concurrent work. Verify CI before merging. Report actual results and any failures or unverified work.

## File ownership and focused tests
| Concern | Source | Tests (under tests/) |
| --- | --- | --- |
| Stable public API | src/simulation.js (reexports only) | all engine tests |
| Constants, base stats, chassis | src/engine/config.js, stats.js | engine-core.test.js |
| Draft categories and attack stages | src/engine/module-registry.js | engine-draft.test.js, module-expansion.test.js |
| Geometry and navigation | src/engine/geometry.js, navigation.js | engine-navigation.test.js, work-profiles.test.js |
| Collision and stability | src/engine/collision.js | engine-displacement.test.js |
| Targeting, movement, holding/support | src/engine/targeting.js, positioning.js, movement.js | engine-navigation.test.js, engine-cooperation.test.js |
| Attack cycle and projectiles | src/engine/combat.js, projectiles.js | engine-attack-cycle.test.js, engine-projectiles.test.js |
| Utilities and reactions | src/engine/utilities.js | engine-reactions.test.js |
| Attack effects and follow-through | src/engine/effects.js, followthrough.js | engine-modules.test.js, engine-displacement.test.js, ricochet-*.test.js |
| Tick ordering, per-unit passives, damage application | src/engine/loop.js | engine-core.test.js, engine-modules.test.js |
| Spawn and ranking primitives | src/engine/round.js | engine-core.test.js |
| Optional counters | src/engine/telemetry.js | engine-module-telemetry.test.js, module-telemetry.test.js |
| Draft/match lifecycle | src/headless.js | headless.test.js, engine-draft.test.js |
| Bot decisions | src/draft-ai.js | headless.test.js, playtest-harness.test.js |
| Card text and player UI | src/module-info.js, src/game.js, src/mobility-visual.js, style.css | browser.test.js, mobility-visual.test.js |

Engine modules import their direct dependencies, never the facade. Keep new files focused and aim for 10–15 KB per subsystem. Config and registry are low-level; avoid import cycles. Keep card wording synchronized with mechanics, and preserve ordered lists because draft RNG depends on order. Add focused tests in the existing owning suite. The facade retains the historical public exports for both Node and browser consumers.

## Design invariants
- Deterministic, DOM-free engine; browser is an adapter to the same match rules. Four-player FFA, shared draft before first combat and every subsequent round, active players + 2 offers; duplicated offers remain contested. Maximum three chassis per squad. Winner takes no persistent HP loss. Ties use shared headless ranking rules.
- Fixed 30 Hz, 30-second rounds. Legitimate holding, survival and timeouts are valid. No forced aggression timer. Movement should remain purposeful and terrain-aware. Navigation regression gates flag physically stuck pursuers and failed stationary-target fixtures, not every timeout.
- Utility/passive slots remain limited; duplicate movement utility copies improve cooldown not travel, nonstacking passives remain unique. Preserve ability and module cooldown semantics. Optional diagnostics and telemetry must not consume RNG or change outcomes.
- Low-end Android: no runtime dependencies or heavy assets; measure CPU and allocations before optimizing. Do not minify maintained source. Keep historical details in docs/history, current behavior in code and tests.

## Verification
- Focused: node --test tests/engine-navigation.test.js (choose owning suite).
- Full: npm test (Node 22+, GitHub Actions). Agent-vs-bots: node scripts/agent-playtest.js 12 1; this is strategic scripted seat 0, not a browser-driving LLM.
- Balance: npm run balance:report -- 100 strategic 1; random: npm run balance:report -- 100 random 1. Navigation: npm run diagnose:navigation -- 8 1 (add --json for per-unit traces). Report match counts, seeds, timeouts, failures and actual commands.
- Structural parity: npm run verify:parity -- <baseline commit SHA> (requires accessible Git history; no extra dependency). Compare full seeded round state, not just winners.
- If only isolated JavaScript evaluation is possible, call it isolated smoke/parity testing, not Node CI. Never claim tests ran when they did not.
- On a playable release, update the visible prototype label, build.json and all browser module/cache query versions together; do not claim Pages is live without verification.

Historical design decisions and previous test limitations: docs/history/AGENTS-through-3.1.2.md and docs/history/README-through-3.1.2.md. See PLAYTESTING.md for harness usage.
