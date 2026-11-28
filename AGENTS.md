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
- Prioritize low-end Android performance, readability and responsiveness. No new runtime dependencies or combat rollouts during normal draft selection. Rendering preferences are local and never change engine ticks, RNG, server clocks or targeting. Retain essential combat cues at every quality level. Keep files focused; measure before optimizing.

## Shared engine direction
- Treat the autobattler as the first product built on a reusable autonomous, spatial simulation backbone. Future modes and games may include cooperative encounters, persistent character RPGs, asynchronous encounters and roguelike expeditions. These are potential applications, not commitments to build them now.
- Keep simulation mechanics, encounter/game rules, presentation and online services separate. The deterministic engine must remain headless, dependency-free, independent of browser APIs, wall-clock time, graphics, audio, accounts and persistence. Keep game-specific drafting, scoring and progression in the match/rules layer; networking and storage stay outside the engine.
- For 4.0, consume engine snapshots and semantic events through a presentation adapter. Keep artwork, animation, sound, rendering quality and camera decisions independent of simulation state and RNG. Prefer reusable asset descriptors and render interfaces rather than putting game-specific art or UI logic into the engine. Keep the original Classic renderer available during standee experiments. Future miniature collections are cosmetic: distinguish chassis, appearance and collection; allow independently selected chassis appearances when implemented, with reviewed, licensed community contributions, not arbitrary uploads. Defer collection work until after core audio/accounts. Current standees use authored vector shapes (no generated image assets); cache rasterized pieces and stage, preserve readable physical boundaries, and keep any pose math purely cosmetic.
- When a real new mode requires it, introduce explicit configuration for faction vs player ownership, encounter objectives/end conditions, arena bounds, spawn layouts, character definitions and squad scaling. Existing FFA rules remain the default; do not claim these are already generalized. Prefer small tested extensions over speculative abstractions or a large engine rewrite.
- Maintain seeded parity for presentation changes and behavior-preserving refactors. Preserve server-authoritative results and low-end device support. Keep the core API small and document changes at subsystem boundaries; use a second concrete game/mode to validate reuse before extracting a separately versioned library.

## Presentation follow-up (provisional)
- Art and sound are serviceable placeholders, not final art direction. Revisit after core accounts/ranked foundations: original hand-authored or appropriately licensed miniature collections, arena art, cohesive Final Fantasy Tactics-inspired sound design, and warmer fantasy lo-fi music. Preserve interchangeable presentation adapters, classic fallback, lightweight assets, and licensing provenance. Do not treat current presentation as finished production art.

## Quick Play
- Main is the canonical release source for both modes. Launch menu: Solo, Quick Play, Ranked (disabled), Options, and Resume Solo when a checkpoint exists. Keep preferences, history controls, checkpoint discard and privacy controls in Options. Final results offer Return to Menu and Play Again with equal prominence; Solo replay returns to chassis selection; explicit Quick Play replay rejoins the shared FIFO with the prior starting chassis. Never queue without player action. Railway serves the single game URL; the legacy public Pages URL redirects there.
- No hosted/private rooms. Solo is local and untimed; Quick Play has a single 120-second queue, then fills seats with bots. Four humans launch immediately. Human draft clocks start fresh at 20 seconds each round; consecutive expired turns auto-draft and reduce the next allowance by three seconds (floor five seconds). A timely manual pick resets the streak. Server owns state and results; browser replays only. Generated guest nicknames and optional moderated account display names; enforce one active Quick Play seat per guest or account identity and bind bearer tokens to the authenticated identity. Optional accounts use generated high-entropy recovery codes and hashed, revocable sessions; no passwords, emails, fingerprinting or chat. Guest-linked telemetry and private history require separate opt-in. Solo checkpoints stay local; Quick Play history accepts only server outcomes. Keep parameterized queries, strict schemas, origin checks, and textContent; account names use strict server validation, a basic moderation filter, stable server-assigned four-digit tags, and a 24-hour rename cooldown; no additional player-entered text without a security and abuse review. Keep backend lightweight and use same engine. See docs/quick-play.md.

## Current rules
- Four-player FFA, 30 Hz, 30-second rounds. Active squads spawn around a centered regular polygon (four: square, three: equilateral triangle, two: opposite positions); center each squad and validate all fighter positions against terrain. Rogue base HP is 95 and base attack interval is 0.82 seconds. Shared draft before each round; active players + 2 offers, duplicates contested; maximum three chassis. Winner takes no persistent HP loss. Use shared headless ranking and placement rules.
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
