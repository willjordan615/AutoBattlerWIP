# Agent guide — AutoBattlerWIP

Mobile-first deterministic JavaScript ES modules; Node 22+, no runtime dependencies. Repository: https://github.com/willjordan615/AutoBattlerWIP. Playable: https://quick-play-production-4fff294f.up.railway.app/.

## Workflow
- Read this guide and the relevant subsystem/test; fetch current branch head before editing. Prefer the GitHub connector; no clone by default. Check githubstatus.com on unexpected service errors. Batch related changes, verify writes and branch heads, and never overwrite concurrent work.
- Implementation requests authorize relevant edits and commits. Proceed independently unless a material design choice cannot be inferred. Favor rapid iteration; do not block routine work on unrelated CI. Report actual results, failures, and unverified checks; do not promise later work or diagnose an error without evidence.
- Keep only current rules, working instructions, active experiments and useful executable tests in the working tree. No accumulated release diaries, obsolete reports, archived handoffs or historical result dumps. Git history and Actions artifacts hold previous versions. Remove superseded docs and one-off workflows when replacing them. Prefer short current-state documentation over append-only histories.
- Preserve seeded RNG, ordering and fixed timestep unless deliberately changing a rule. Separate structural refactors from balance changes. On playable releases synchronize label, build.json and all browser import/cache identifiers; verify deployment independently.

## Design priorities
- Be a critical collaborator. Treat proposed changes as hypotheses; measure real gameplay instead of rewarding paper synergy. Situational strength, opportunity cost, counterplay and readable choices matter more than identical module win rates. Preserve intentional variety; do not add mechanics just to increase quantity.
- Bots should have a range of competence and playstyles, not universally optimal decisions. Use empirical valuation as a baseline; maintain seeded persistent preferences and imperfect selection. Never use fighter-stat handicaps for difficulty or silently change player-drafted targeting weights. Calibrate skill with matched games, not just score gaps. See docs/bot-profiles.md.
- Team cooperation, holding and outlasting are legitimate. Do not enforce constant aggression. Distinguish physical navigation stalls from strategic waiting. Target threat/position evaluation and Damage Opportunity are distinct; preserve engagement awareness and additive draft weights.
- Prioritize low-end Android performance, readability and responsiveness. No new runtime dependencies or combat rollouts during normal draft selection. Keep files focused; measure before optimizing.

## Quick Play
- Main is the canonical release source for both modes. Launch menu: Solo, Quick Play, Ranked (disabled), Options (disabled). Railway serves the single game URL; the legacy public Pages URL redirects there.
- No hosted/private rooms. Solo is local and untimed; Quick Play has a single 120-second queue, then fills seats with bots. Four humans launch immediately. Human clocks are 20+4 seconds, max bank 30, active turn only; expired turns auto-draft and grant four seconds. Server owns state and results; browser replays only. No custom names or chat. Keep backend lightweight and use same engine. See docs/quick-play.md.

## Current rules
- Four-player FFA, 30 Hz, 30-second rounds. Active squads spawn around a centered regular polygon (four: square, three: equilateral triangle, two: opposite positions); center each squad and validate all fighter positions against terrain. Rogue base attack interval is 0.82 seconds. Shared draft before each round; active players + 2 offers, duplicates contested; maximum three chassis. Winner takes no persistent HP loss. Use shared headless ranking and placement rules.
- Morphology is unique (-1, 0, +1), opposite cards replace; no utility slot. Duplicate movement utilities shorten cooldown, not travel distance; other passives are unique. Coordinated is a unique utility with +10% HP, damage, speed, attack frequency and reach only while another teammate lives; expiry preserves current HP fraction; no squad-penalty change. Resolve is a unique attack module: 80% slow resistance, +2 defense. Flat defense capped at 10 before Sunder.
- Duelist adds 4.5 base speed and Guardian adds 5 base HP per copy in addition to their targeting preference. Aggressor has no flat damage bonus. Current values live in the engine; synchronize player-facing card text. Diagnostics must not change outcomes or RNG.

## Ownership
| Concern | Source | Focused tests (tests/) |
| --- | --- | --- |
| Public API | src/simulation.js (reexports only) | engine tests |
| Constants, chassis, stats | src/engine/config.js, stats.js | engine-core, engine-coordinated |
| Module categories | src/engine/module-registry.js | engine-draft, module-expansion |
| Navigation/collision | src/engine/geometry.js, navigation.js, collision.js | engine-navigation, engine-displacement |
| Targeting and movement | src/engine/targeting.js, positioning.js, movement.js | engine-cooperation, engine-navigation, engine-33-production |
| Attack cycle/projectiles | src/engine/combat.js, projectiles.js | engine-attack-cycle, engine-projectiles |
| Utilities/reactions | src/engine/utilities.js | engine-reactions |
| Effects/follow-through | src/engine/effects.js, followthrough.js | engine-modules, engine-displacement, ricochet-* |
| Tick/round/telemetry | src/engine/loop.js, round.js, telemetry.js | engine-core, engine-module-telemetry |
| Draft/match lifecycle | src/headless.js | headless, engine-draft |
| Bot choices | src/draft-ai.js, bot-profiles.js, draft-empirical*.js, draft-policy.js | bot-profiles, draft-empirical, draft-model-release, headless |
| Browser/card text | src/game.js, module-info.js, mobility-visual.js, style.css | browser, mobility-visual |

Engine modules import direct dependencies, not the facade. Preserve ordered registries and avoid cycles. Add focused tests in owning suites.

## Verification
- Run smallest relevant tests for ordinary changes; npm test for milestones. Balance: npm run balance:report -- 100 strategic 1 (or random). Navigation: npm run diagnose:navigation -- 8 1. Scripted player: node scripts/agent-playtest.js 12 1 (see PLAYTESTING.md). This is a policy harness, not human or browser play.
- For major changes use matched seeds, varied chassis and roster situations, and complete matches; parallelize by condition. Report completed samples, timeouts, uncertainty and causal limitations. Structural parity only for behavior-preserving refactors: npm run verify:parity -- <commit SHA>.
- Refit the empirical model after material combat-rule changes using the manual empirical audit; validate on independent seeds before adopting coefficients. See docs/empirical-draft.md. Reusable final-balance workflow is manual only. Ordinary pushes run standard tests, plus an explicitly active experiment if needed.
