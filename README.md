# Modular Arena Autobattler — Prototype 3.2

Mobile-first, deterministic, four-player arena autobattler. Native ES modules with zero runtime npm dependencies. The 3.2 refactor preserves 3.1.2 gameplay and balance; the release candidate is verified before promotion.

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

## Verification
The structural parity command compares complete seeded matches and current engine state against a selected Git commit: npm run verify:parity -- <baseline SHA>. The original 3.1.2 baseline is 9416d7c130a7e40838822f5594800caaeb47dff4. CI and device performance must be checked independently; a structural move does not imply faster runtime or improved balance. See AGENTS.md for exact checks and reporting requirements.
