# Agent playtesting harness

The deterministic playtesting API lives in `scripts/playtest-harness.js`. It uses the same headless simulation, draft rules, and strategic CPU opponents as the browser game. It does not need a browser, server, or AI API.

## Interactive session

```js
import {createPlaytest,cpuPolicy} from './scripts/playtest-harness.js';

const game=createPlaytest({seed:20261121,types:['rogue','bruiser','ranged','bruiser']});
let observation=game.state(); // public squads, all weights, draft offers and legal choices
const decision=cpuPolicy(observation); // replace with an agent's own decision
observation=game.pick(decision.uid,decision.slot,decision.passiveSlot);
const {report,state}=game.fight({trace:true});
console.log(report.ranking,report.frames,game.history());
```

The agent can inspect `state().draft.choices` and choose any legal `{uid,slot,passiveSlot}`. Other players draft using `chooseCpuDraft`. `fight({trace:true})` returns one-second position/HP/target/weight/cooldown snapshots (configurable via `traceInterval`), elimination events, arena, combat duration, ranking and persistent player damage. `fight({trace:false})` skips snapshots for faster repeated trials.

`game.run(policy,{maxRounds:250,trace:false})` runs a full match; the policy receives a fresh public observation for each controlled draft. The supplied `cpuPolicy` is a baseline, not an intelligent learner.

`playBatch({matches:20,seed:12345,policy:cpuPolicy})` runs repeatable matches and returns win rate, per-match results, draft history and timeout counts. Starting chassis rotate across matches. This is a *playtesting* API; the AI model's weights are not trained or updated automatically. Save and compare results across different policies and seeds.

## Reproducibility and limitations

A session's seed, draft history, and battle reports are accessible with `state()`, `history()`, and `battles()`. The initial draft is processed in seat order, so bots preceding the controlled seat may already have picked before the first observation. All unit stats and AI weights are visible. The engine still has its own 30-second combat limit. Trace frames are sampled rather than a full per-tick replay, and `run` uses the current game mechanics without modifying the browser UI.

## Strategy comparison and combat diagnostics

```js
import {comparePolicies,POLICIES,createPlaytest} from './scripts/playtest-harness.js';
console.log(comparePolicies({matches:40,seed:20261121}));
const game=createPlaytest({seed:20261121});
const choice=POLICIES.balanced(game.state());
game.pick(choice.uid,choice.slot,choice.passiveSlot);
const {report}=game.fight({trace:false});
console.log(report.telemetry,report.telemetry.byOwner);
```

The four exported deterministic policies are `balanced`, `aggressive`, `defensive`, and `tactical`. `comparePolicies` runs each against the existing strategic CPU with the same sequence of seeds. This is an initial comparison, not a full four-policy round robin.

Each combat report now includes per-owner and total `targetSwitches`, `blockedUnitTicks`, `stationaryUnitTicks`, `aliveUnitTicks`, `travelDistance`, and `damageTaken`. The movement counters sample every simulation tick, including when full frame tracing is disabled.

**Navigation experiment note (2026-11-21):** A destination-search prototype increased timeouts in a 12-match trial, so it was reverted. The existing obstacle waypoint system remains in production. Don't infer a navigation fix from the new diagnostics alone.

## Persistent navigation update (2026-11-21)

The combat engine now uses persistent visibility-graph routes around obstacle corners. Route-following is deterministic and independent of the player's tactical weights while a direct route is obstructed. Routes are recalculated when the target changes, moves materially, or a waypoint becomes inaccessible; corners may be skipped once later waypoints become visible. When an agent begins near a wall's inflated clearance boundary and no graph route exists, it slides toward a reachable obstacle corner instead of remaining motionless. The endpoint is projected outside inflated walls when the enemy's center is inaccessible to the moving chassis. The route stores coordinate copies, not references to live units.

Regression tests cover both the previously observed Twin Pillars and Central Barrier deadlock positions. All 47 headless/simulation/harness tests passed in an in-process JavaScript test evaluation.

**Matched 32-match harness run** (seed 20261121, `playBatch`): 392 rounds, 12 timeouts (3.1%), compared with 37/393 (9.4%) in the intermediate pre-fix build using the same harness configuration. A separate 32-match seat-zero CPU-policy run produced 20 timeouts across 392 rounds (5.1%); these are different test setups and should not be conflated. In that run, stationary time was 4.2% of live unit ticks overall and 10.1% within timeout battles. Timeout rules are unchanged.

The `navigationBlocked` flag means direct line of sight with chassis clearance is obstructed; it does **not** mean the agent is physically stuck. Use stationary movement and route tracing to diagnose actual stalls.
