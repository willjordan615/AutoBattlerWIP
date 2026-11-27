# Modular Arena Autobattler

Mobile-first, deterministic four-player autobattler with shared drafting, continuous movement and independently controlled fighters. Native JavaScript ES modules, zero runtime dependencies.

## Play and develop

- [Playable build](https://willjordan615.github.io/AutoBattlerWIP/) — version shown in the game.
- Serve the repository statically for local browser play; do not open via file://.
- Multiplayer server: `npm start` (Node 22+); open its URL for Solo and Quick Play. See [Quick Play](docs/quick-play.md).
- Node 22+: `npm test`, `npm run balance:report -- 100 strategic 1`, `npm run diagnose:navigation -- 8 1`.
- Scripted player harness: `node scripts/agent-playtest.js 12 1`. See [PLAYTESTING.md](PLAYTESTING.md).
- Headless API: `import {simulate} from './src/headless.js'; const match=simulate(12345);`

## Game and architecture

Shared draft before each 30-second round, three initial chassis, maximum three fighters per squad. Draft modules and targeting preferences are composable; round placements deplete player HP, with the winner taking no loss. Last remaining player wins.

The browser and headless harness share the deterministic 30 Hz engine in src/engine/. The simulation.js facade exposes engine APIs, headless.js owns match and draft orchestration, and module-info.js supplies card text. Current stats and effects are defined in source and regression tests.

Bot drafts use learned marginal valuations rather than predetermined builds. Style and competence vary through persistent seeded profiles; no combat stat changes or extra simulation during drafting. See [current profile calibration](docs/bot-profiles.md) and [model calibration](docs/empirical-draft.md).

See [AGENTS.md](AGENTS.md) for current design rules, ownership and verification. Old releases and superseded experiments are available through Git history, not accumulated in the working tree.
