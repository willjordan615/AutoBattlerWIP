# Modular Arena Autobattler — Prototype 3.4

Mobile-first, deterministic, four-player arena autobattler. Native ES modules with zero runtime npm dependencies. Prototype 3.4 adopts empirically calibrated bot drafting and corrects Coordinated's living-ally condition.

## Run
- Browser: serve the repository statically or open the GitHub Pages build. Do not open via file://.
- Node 22+: npm test; npm run balance:report -- 100 strategic 1; npm run diagnose:navigation -- 8 1.
- Scripted player harness: node scripts/agent-playtest.js 12 1. See PLAYTESTING.md.
- Headless API: import {simulate} from './src/headless.js'; const match = simulate(12345).

## Architecture
src/simulation.js is the stable public facade; implementation lives in src/engine/. The browser and headless orchestration share the same deterministic 30 Hz engine. Engine modules import directly from their owning subsystem. Ordered module categories and mechanical stage metadata live in engine/module-registry.js; display text lives in module-info.js. The tests are split by subsystem. See AGENTS.md for the file ownership and test map.

## Game rules
- Shared draft before first combat and between rounds, active players + 2 offers, maximum three chassis per player. Three initial chassis: Bruiser, Rogue, Ranged. Extra chassis and upgrades are draft choices.
- Continuous 2D movement, obstacle navigation, targeting weights, deterministic attack cycles, cooperative positioning, and 30-second rounds. Player HP is depleted by placement, with streak scaling; last surviving player wins.
- Current balance values and module behavior are defined in the engine and tests. Historical release notes and original design decisions are preserved under docs/history/.

- Morphology: unique Growth (+30% HP) or Shrink (-15% HP); opposite cards replace. Shrink increases movement and attack frequency by 15% and reduces attack phase duration by 15%. Growth retains its 10% speed penalties. Both retain size, reach and damage trade-offs.
- Follow Through moves to an adjacent legal destination and grants a bonus release only on far-side arrival, at most once per second, never twice consecutively against the same target. Chain preserves primary damage and adds 15% auxiliary damage per stack (cap 60%). Bulwark grants +3 defense, Retaliation +3 raw damage, Inspiration radius 220. Coordinated is now a unique utility: +10% HP, damage, movement speed, attack frequency and reach, with relaxed formation preference. Independent is removed from draft. Total flat defense capped at 10 before Sunder. Resolve is unique per fighter, with 80% slow resistance and +2 defense; no utility slot.

## Verification
The structural parity command compares complete seeded matches and current engine state against a selected Git commit: npm run verify:parity -- <baseline SHA>. The original 3.1.2 baseline is 9416d7c130a7e40838822f5594800caaeb47dff4. CI and device performance must be checked independently; a structural move does not imply faster runtime or improved balance. See AGENTS.md for exact checks and reporting requirements.

Release verification (commit 5c0b9c6): 180/180 tests, four combat fixtures and eight full-match parity checks (seeds 1–4, random and strategic; 96 total match rounds), 12/12 scripted player matches (5/138 timeouts), and navigation diagnostics (4/96 timeouts). Routine CI now runs standard tests only; extended harnesses are opt-in. 3.2.3 final audit: 41/41 jobs passed, 6,312 paired module comparisons, 600 completed matches, 1.47% ordinary round timeouts. Tested engine baseline: 36610a735b2f2a8e9177714b982be9a741216779. The 3.2.3 baseline remains the historical control. See [3.3 hand-off](docs/3.3-handoff.md), [reusable final audit](docs/final-balance-audit.md), and [archived results](docs/history/3.2-final-audit-summary.json).

## 3.3 release
- Engagement-aware Damage Opportunity is separate from Kill Opportunity; positional pressure is damage-independent with short movement forecasts. Safety and preferred-range preferences are retained. Duelist adds 4.5 base movement speed and Guardian adds 5 base maximum HP per copy; no slot changes. Aggressor has no flat stat bonus.
- Candidate `266448890e9169ababf05dd860afa7fac56683dd`: [209/209 tests](https://github.com/willjordan615/AutoBattlerWIP/actions/runs/45853054238), [192 strategic comparison matches](https://github.com/willjordan615/AutoBattlerWIP/actions/runs/45853054509), [128 drafted matches and four scripted player games](https://github.com/willjordan615/AutoBattlerWIP/actions/runs/45851850231). Current candidate strategic sample: 64 matches, 747 rounds, 20 timeouts; starting chassis wins 17/96 Bruiser, 26/80 Rogue, 21/80 Ranged. Guardian association remains a small-sample observation, not a causal balance finding. No device/visual performance claim.
- Next: human playtesting and strategic diversity; position-only is historical, not a candidate. See docs/3.3-provisional-implementation.md and docs/3.3-decision-followup.md.

## 3.4 release
- Adopt the empirical draft scorer trained under corrected Coordinated mechanics. Model: 394 boards, 2,065 training options, 567 fitted coefficients. [Validated audit](https://github.com/willjordan615/AutoBattlerWIP/actions/runs/46059454958): 7,130 counterfactual simulations including holdout, 128 completed matches, 39–25 empirical wins in 64 mixed-policy games; held-out placement utility 65.3% vs 63.3%. [Pre-release regression](https://github.com/willjordan615/AutoBattlerWIP/actions/runs/46059455080): 231/231. Exact fitted scorer retains seeded personality and choice noise; no claim of optimal play or calibrated skill levels.
- Coordinated grants its unique +10% package only while another teammate lives; expiry preserves HP fraction. Original squad-size penalty remains. No other fighter mechanics changed.
- Bot goal: a range of competence and playstyles, not universal optimality. Preserve distinct personalities and imperfect decisions. Future skill calibration should vary judgment predictably per bot, not simply make all bots maximize win probability. See docs/3.4-empirical-draft.md and docs/coordinated-correction.md.
