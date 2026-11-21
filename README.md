# Modular Arena Autobattler — GDD v0.1 implementation

Mobile-first, deterministic, four-player free-for-all autobattler. Source of truth: the uploaded 45-page **Modular Arena Autobattler — Game Design Document v0.1**, plus subsequent user decisions:

1. **There is a shared draft before the first combat round.**
2. **Only the first chassis is selected freely. All additional chassis are cards in the shared modular draft pool.**
3. **The draft pool is freshly regenerated each round.**
4. **Each player may control at most three chassis.**

## Running

- Browser prototype: open `index.html` through a static server or GitHub Pages.
- Headless test suite: `npm test` (Node 22+).
- Headless API: `import {simulate} from './src/headless.js'; const match = simulate(12345)`.
- `src/simulation.js` is independent of DOM/Canvas and runs a fixed 30 Hz combat simulation.
- `src/headless.js` runs drafting, full matches, tiebreakers and persistent HP without rendering.
- `src/game.js` remains the browser UI adapter; some draft/match orchestration is duplicated pending consolidation.

## GDD mechanics implemented

- Three chassis (Bruiser, Rogue, Ranged) with independent base attack, defense, movement, radius and ten initial utility weights.
- Ten universal utility metrics: Kill Opportunity, Damage Opportunity, Enemy Threat, Target Distance, Ally Proximity, Personal Safety, Ally Protection, Ability Opportunity, Target Isolation and Preferred Range.
- Additive targeting mutations; ten-metric weighted target evaluation with commitment.
- Single composable attack per chassis with cumulative damage, speed, range, multishot, piercing/cleave, area and knockback mutations. No arbitrary gameplay stack caps (a technical per-tick multishot safeguard is present).
- Two passive slots per chassis, with permanent replacement; basic regeneration, bulwark, haste and focus effects.
- Collision with units, walls and rectangular obstacles; line-of-sight blocking and waypoint routing around obstacles; three curated arenas.
- Fixed-step deterministic simulation with simultaneous attack-damage resolution and seeded random starting attack timing.
- 30-second combat, early end on sole survivor, elimination-order placement, remaining team HP percentage at timeout, survivor-over-eliminated priority.
- Full-roster 1v1 tiebreakers; pairwise deterministic tournament for multiway ties.
- Persistent player HP, escalating placement damage, loss-streak bonus only for bottom-half finishes, elimination and victory.
- Shared N+2 draft with duplicate cards, loser-first order after the first combat, no category quotas apart from legal-selection safeguarding, fresh pool each round, max three chassis.
- Headless seeded complete-match simulation and regression tests.

## Provisional / limitations (not established GDD rules)

- Exact numerical chassis stats, module catalog and increments, HP damage formula, and AI feature scales are balancing defaults.
- Initial draft order is player index order, since no prior placement exists.
- Multiway tiebreaks use pairwise full-roster duels and a deterministic player-index fallback if scores still tie. The GDD explicitly leaves the tournament procedure unresolved.
- The pool generator ensures at least N non-chassis cards to guarantee that even three-chassis players can draft regardless of earlier picks. This technical legal-selection constraint should be revisited for variety.
- Projectile delivery currently resolves hits instantly after line-of-sight checking; there is no traveling projectile entity.
- Obstacle navigation is corner-waypoint steering, not full pathfinding. Complex mazes may trap units.
- The utility AI is a practical initial approximation. Ability Opportunity has no independent active ability system yet; passives are basic.
- The browser UI still duplicates some match logic and lacks an in-browser seed/replay inspector.
- The per-tick multishot safeguard caps attack execution at 64 projectiles, though modules themselves are uncapped.
- Online multiplayer, accounts, rankings and production art are outside prototype scope.

## Verification

- Tests in `tests/simulation.test.js` and `tests/headless.test.js` cover combat geometry, utility weights, simultaneous elimination, timeout, placement, loss streaks, drafting, passive replacement and seeded full-match replay.
- The simulation suite (14 tests) and headless suite (8 tests) were exercised in a JavaScript test harness; full GitHub Actions status has not been verified.
- A 30-seed headless match sweep finished with a single survivor in every seed (rounds 9–16), providing a smoke test rather than balance proof.

## Next work

1. Consolidate the browser adapter onto `src/headless.js` to eliminate duplicated orchestration.
2. Implement projectile travel and spatial effects with deterministic events.
3. Improve obstacle-aware navigation and cooperative ally movement.
4. Provide replay export, inspectable AI decisions, and automated balance reports.
5. Tune balance values using the GDD's validation goals and mobile profiling.
