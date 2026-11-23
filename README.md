# Modular Arena Autobattler — Prototype 2.12

**Current playable iteration: Prototype 2.12 — Emergent Collision Physics.** Fighters now gain positional stability from maximum HP, their actual movement over the previous half-second and an emergent low-movement *brace*. Ordinary collisions remain mostly cooperative; Follow Through claims occupied space using stronger stability-weighted contact resolution. Its attack impact starts a 0.5-second committed advance at fighter movement speed rather than teleporting. Extra stacks give +12% advance speed; ranged and melee use the same rule. Deepest successfully hit target and one activation per attack/volley remain unchanged. Follow Through followed by Disengage performs both movement windows sequentially. Actual collision-adjusted advance is visible in round results. Previous: Prototype 2.11.1 — Bounded Follow Through. Follow Through now moves a melee attacker **at most 72 arena units**, or a ranged fighter **at most 18**, with +8 units per extra stack. A melee attacker only crosses the target if the entire move fits within its budget; otherwise it approaches the near side without teleporting. Multi-target attacks choose the deepest successfully struck target along the original attack direction, with one movement per full melee release or projectile volley. Previous: Prototype 2.11 — Impact and Aftermath Reclassification. Taunt, Sunder, Disruption and Expose are persistent Aftermath effects, while Knockback and Follow Through are immediate Impact effects. Follow Through and Disengage are now attack modules, not utility-slot abilities. Follow Through moves a melee attacker beyond the first struck target or nudges a ranged attacker closer upon a projectile hit, respecting collisions and an internal cooldown; extra stacks increase travel. Disengage forces a safety-first retreat for 0.5 seconds after an attack is released, then re-evaluates targets; extra stacks improve retreat speed. Previous: Prototype 2.10 — Composable Attack Classification. Every attack module now has an explicit mechanical stage (shape, impact, aftermath, condition or targeting). Burning and Hazardous each have an independent one-second per-chassis activation limit, while all targets of the same attack or projectile volley remain eligible. Shape modifiers and conditional damage continue working on every attack; modules still combine freely. Module categories appear on draft cards. No base damage, DoT rate or squad-size values changed. Previous: Prototype 2.9.1 — Module Damage Telemetry. The engine now reports actual damage attributable to Precision, Momentum, Expose, Sunder, Retaliation, Chain, Burning and Hazardous, and separately identifies hits enabled by Multishot, Piercing, Area and Range. Module-enabled hits are overlapping categories, not additive bonus damage; non-damaging behavior and positioning effects are intentionally not assigned guessed values. The round report, browser summary and repeatable build-audit script include the new telemetry. Previous: Prototype 2.9 — Contextual Bot Drafting. Bots now score available upgrades against existing modules, targeting weights, team composition, utility replacements and diminishing marginal value, with stable seeded tactical preferences. Draft history records explainable scores and reasons. Combat rules remain unchanged. Previous: Prototype 2.8.1 — Module Text Audit. Draft cards now have a unified source for short labels and detailed descriptions, reviewed against the active combat/targeting/utility code. All 37 cards are covered; no gameplay behavior was changed. Previous: Prototype 2.8 — Progressive Squad Scaling. Each additional fighter reduces base HP and damage of all chassis in that squad by 15%: solo 100%, duo 85%, trio 70%. Additive module bonuses, defense, movement and attack timing remain unchanged. Recruiting recalculates the whole squad on the next combat spawn; bot drafting now weighs recruiting against upgrading. Prototype 2.7.1 — Fractional DoT Readouts. Burning and hazard damage was correctly applied at 30Hz but displayed as -0 because of whole-number rounding. The renderer now groups DoT damage into readable fractional numbers every 0.4 seconds. Gameplay damage is unchanged. Prototype 2.7 — Composable Attack Profiles. Adds Range (+8), Sunder, Precision, Expose, Disruption, Momentum, Chain, Burning, Hazardous and Restless Attack modules, plus Retaliation in a Utility slot. Secondary damage is bounded, environmental damage does not recursively trigger attack effects, and target switching uses the existing scoring system. Attack timing remains at Prototype 2.6 values. Earlier changes: Prototype 2.6.1 — Draft Clarity. Player-facing draft categories now consistently identify all shared-slot upgrades as Utility, while attack modifiers and targeting weights have explicit Attack and Targeting labels. This is a display-only update over Prototype 2.6 — Melee Chassis Tuning. Bruiser damage increases from 13 to 16 and its attack arc narrows from 110° to 95°. Rogue windup/recovery lengthen from .14/.10s to .18/.12s. Movement speeds and attack module interactions are unchanged; Bruiser does not gain inherent cleave. Prototype 2.5 introduced the translucent white attack commitment cues, retained here. See `AGENTS.md` for release-by-release implementation notes. The original GDD remains v0.1; it is a document version, not the prototype number.

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
- `src/game.js` is a browser-only adapter. It imports the shared draft and match lifecycle from `src/headless.js`, rather than maintaining a second rules engine.

## GDD mechanics implemented

- Three chassis (Bruiser, Rogue, Ranged) with independent base attack, defense, movement, radius and ten initial utility weights.
- Ten universal utility metrics: Kill Opportunity, Damage Opportunity, Enemy Threat, Target Distance, Ally Proximity, Personal Safety, Ally Protection, Ability Opportunity, Target Isolation and Preferred Range.
- Additive targeting mutations; ten-metric weighted target evaluation with commitment.
- Single composable attack per chassis with cumulative damage, speed, range, multishot, piercing/cleave, area and knockback mutations. No arbitrary gameplay stack caps (a technical per-tick multishot safeguard is present).
- Two passive slots per chassis, with permanent replacement; basic regeneration, bulwark, haste and focus effects.
- Collision with units, walls and rectangular obstacles; line-of-sight blocking and waypoint routing around obstacles; three curated arenas.
- Fixed-step deterministic simulation with simultaneous attack-damage resolution and seeded random starting attack timing.
- 30-second combat, early end on sole survivor, elimination-order placement, damage dealt by surviving teams at timeout (team HP percentage breaks damage ties), survivor-over-eliminated priority.
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
- Obstacle navigation is a visibility-graph shortest-path steering approximation, not a dynamic navmesh. Complex mazes may trap units.
- The utility AI is a practical initial approximation. Ability Opportunity has no independent active ability system yet; passives are basic.
- The browser UI lacks an in-browser seed/replay inspector. The browser AI draft policy is independent of the headless random-pick policy, but both use the same draft legality and assignment rules.
- The per-tick multishot safeguard caps attack execution at 64 projectiles, though modules themselves are uncapped.
- Online multiplayer, accounts, rankings and production art are outside prototype scope.

## Verification

- Tests in `tests/simulation.test.js`, `tests/headless.test.js` and `tests/browser.test.js` cover combat geometry, utility weights, simultaneous elimination, timeout, placement, loss streaks, drafting, passive replacement and seeded full-match replay.
- The simulation suite (18 tests) and headless suite (8 tests) were exercised in a JavaScript test harness; full GitHub Actions status has not been verified.
- A 30-seed headless match sweep finished with a single survivor in every seed (rounds 9–16), providing a smoke test rather than balance proof.

## Next work

1. Validate the browser integration test in GitHub Actions and conduct a real-device playtest.
2. Implement projectile travel and spatial effects with deterministic events.
3. Improve obstacle-aware navigation and cooperative ally movement.
4. Provide replay export, inspectable AI decisions, and automated balance reports.
5. Tune balance values using the GDD's validation goals and mobile profiling.

## Headless balance diagnostics

Run `npm run balance:report -- 100 strategic 1` for 100 matches with the same heuristic draft AI as the browser bots. Run `npm run balance:report -- 100 random 1` for a random-draft baseline, or `npm run balance:random` for the default random sample. Add `--json` for full machine-readable output. The three positional arguments are match count, drafting mode, and reproducible integer seed. This script runs in Node and does not require a browser.

The report measures starting chassis win rates (with rotating starting seats), seat bias, match lengths, 30-second combat timeouts, arena frequency, average persistent HP damage by placement, draft offer and pick rates, module association with match wins, first-pick outcomes, and heuristic warning flags. Chassis samples are not perfectly equal in small batches because a four-player game has three chassis types; the repeated archetype rotates between matches. All four seats use the same chosen drafting strategy, so the report is a mirror-policy baseline, not a human-vs-bot benchmark.

**Interpretation:** module win rates are correlations and can be heavily confounded by chassis, draft order, and other modules. The warning thresholds (10 percentage points for chassis/seat win rates, 15 points for module correlations with at least 30 exposures, and 20% timeout rate) are screening heuristics, not significance tests. Run hundreds of matches and compare both drafting modes before adjusting stats. The current engine's deterministic seed allows reproducing suspicious outcomes.

## Build performance logging

Run `node scripts/build-audit.js 12 2101 --json` for a reproducible seeded contextual-draft audit. It records draft category usage, squad sizes, match completion, timeout frequency, module pair occurrences, aggregate damage per chassis and the highest-output individual fighters (including peak-round module/utility configurations). The initial 12-match audit is preserved in [reports/build-audit-2026-11-23.md](reports/build-audit-2026-11-23.md). These are observational results, not controlled estimates of module strength; do not tune balance from a single high-output fighter.
