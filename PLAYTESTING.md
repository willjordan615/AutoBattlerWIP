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
