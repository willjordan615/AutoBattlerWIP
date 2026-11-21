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
