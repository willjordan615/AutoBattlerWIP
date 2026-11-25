# Development work profiles — November 2026

These are independent workstreams. The game design document governs rules; numerical values are prototype defaults.

## Profile 1 — Combat AI & Navigation
**Owns:** `src/engine/navigation.js`, `src/engine/movement.js`, `src/engine/positioning.js`, `src/engine/collision.js`.

**Problem:** Allies chase the same target, push into each other, and treat post-movement collision separation as their only avoidance.

**Implemented:** Local candidate-heading scoring with teammate separation, predicted ally movement, and continued obstacle pathfinding. Fixed-step deterministic behavior preserved.

**Acceptance:** Teammates avoid occupied paths before contact; avoid persistent wall pinning and traffic jams; maintain useful engagement; remain inside arena; test with 1–3 chassis per team and 4–12 active units.

**Further work:** Reciprocal velocity obstacles or reservation-based formation slots, better handling of narrow obstacle passages, quantitative jam-duration benchmarks, Android performance profiling.

## Profile 2 — Module Design & UI
**Owns:** `src/engine/module-registry.js`, `src/module-info.js`, draft-card rendering in `src/game.js`.

**Problem:** Card names conceal mechanics; Speed, Haste, and HP are ambiguous.

**Implemented:** Exact effect descriptions with units, percentages, and distinctions between chassis combat HP and persistent player HP. Card details are keyed to the shared draft catalog.

**Acceptance:** Every draft card explains what changes, by how much, and whether the effect stacks, uses a passive slot, or recruits a chassis.

**Further work:** Before/after stat comparison for selected chassis; tooltip for targeting metrics; mobile card layout and readability checks.

## Profile 3 — CPU Draft Strategy
**Owns:** `src/draft-ai.js`, bot selection call in `src/game.js`.

**Problem:** Bots select modules with little regard for chassis or synergy.

**Implemented:** Scoring per legal card, per recipient chassis and passive slot; role-dependent priorities; multishot/piercing synergy; modest seeded variation. Draft assignment remains controlled by the shared engine.

**Acceptance:** No illegal selections, meaningful variation, sensible early recruitment, stronger preference for complementary modules, reproducible choices with the same seed.

**Further work:** Team-wide tactical scoring, opponent counters, late-game survival priorities, score transparency in debug view, and headless AI-vs-random balance experiments.

## Verification
- `tests/work-profiles.test.js`: five new acceptance checks.
- Existing 26 simulation/headless checks passed in the JavaScript harness after changes.
- Live Android visual and performance playtesting is still needed; avoidance is an initial improvement, not a solved crowd-navigation system.
