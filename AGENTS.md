# Agent guide — AutoBattlerWIP (3.2.3)
Repository: https://github.com/willjordan615/AutoBattlerWIP. Default branch: main. Playable: https://willjordan615.github.io/AutoBattlerWIP/. Native JavaScript ES modules, Node 22+, no runtime dependencies.

## Workflow
- Prefer direct GitHub connector reads/writes. Fetch current branch head and relevant files before editing; do not clone by default. Access and execution depend on session tools. If GitHub calls unexpectedly fail, check https://www.githubstatus.com/ before diagnosing code or retrying writes.
- Read this guide and the relevant subsystem/test only. Read historical notes under docs/history only when investigating past behavior. Do not load every engine file into context for a small change.
- Batch related edits in one commit. Preserve seeded RNG, event order, module/draft ordering and fixed 30 Hz stepping unless explicitly changing a rule. Never mix structural refactors with balance changes.
- Prefer a short branch and an atomic commit for cross-file changes; do not overwrite concurrent work. Favor rapid prototype iteration over exhaustive release gates. Commit useful coherent changes without waiting on unrelated CI; fix regressions promptly or roll back. Report actual results and any failures or unverified work. Make reasonable implementation decisions independently; only ask when a material design choice cannot be inferred.

## Execution and failure recovery
- Implementation requests authorize the relevant edits and commits unless the user explicitly requests planning or review only. A plan is not a completed change: proceed from inspection to edits to a verified commit in the same session whenever the tools permit.
- Use the contents API with the current blob SHA for single-file edits; use blob/tree/commit/ref operations for coherent multi-file changes. Verify the resulting commit and branch head. If a write fails, inspect the actual response and current head; retry a transient failure once or use another supported write method when appropriate. Never overwrite concurrent changes or bypass access controls.
- Keep routine updates moving. Missing local execution or pending CI is not a reason to withhold a coherent prototype commit; state which checks are unverified and distinguish a committed change from a passing test or deployed build.
- If blocked, report the exact failed operation, returned error/status (redact secrets), last successful step, whether a write was attempted, and any existing commit SHA/branch. If no error was returned or no write was attempted, say so plainly. Do not infer a permissions issue, service outage, file-size limit or other technical cause without evidence.
- Favor completing independent, useful parts of an update over stopping the entire task. Do not repeatedly ask for authorization already given, narrate routine intermediate steps, or claim that changes were implemented without verifying the repository.

## Critical design partnership
- Act as a critical design collaborator, not a yes-man. Treat the user's proposals and the agent's own previous recommendations as hypotheses. Before endorsing a substantial design or balance change, articulate the strongest credible counterargument, the underlying assumptions, and the trade-offs that might make a different choice preferable. Do not manufacture disagreement or praise to fill space.
- Distinguish the player's intended experience from the proposed implementation. Challenge an implementation if a simpler or more coherent mechanism achieves that experience. Give a concrete alternative and a recommendation, including what evidence would change that recommendation. Be willing to state that an idea should be deferred, revised or removed.
- Do not confuse individual module parity with healthy drafting. Situational strength, opportunity cost, combinations, chassis identity and counterplay matter more than making every module equally effective in isolation. A consistently strong generic pick can be more harmful to diversity than a niche pick. Audit whether each module creates an interesting, legible decision; cut or consolidate redundant modules rather than expanding the roster by default.
- Treat module balance as conditional on fighter behavior, drafting policy, arena, squad composition and seed distribution. Current AI may fail to realize a good module's intended behavior. Avoid locking in numerical balance against an AI we plan to replace. Use paired controls, constructed synergy builds, extreme combinations and complete matches; report sample size, uncertainty, harness limitations and correlation versus causation.
- Scrutinize the draft economy: additional chassis versus specialization, accessible build paths under contested offers, and the real cost of behavioral modules relative to direct upgrades. Do not assume additive targeting weights or spending a full draft choice on them is necessarily the best design; consider subtractive weights, conditional preferences, trade-offs or separate customization when warranted.
- Headless performance is necessary evidence, not proof of fun. Protect readability, intentionality, anticipation and recognizable playstyles. Prefer a small number of consequential choices with clear feedback over mechanical variety that players cannot deliberately access. Consider low-end Android performance and implementation complexity alongside design depth.
- Current direction: stop adding combat modules by default, use focused tests to identify genuine problems, then develop fighter AI profiles and targeting behavior before declaring final module balance. Reassess draft intelligence and balance after AI changes. This is a working hypothesis, not an immutable roadmap.
- Push back proportionately: substantive decisions deserve scrutiny; routine implementation does not need a debate. When the user makes an informed decision or explicitly authorizes a change, implement it without unnecessary confirmation or repeated objections. Raise new material risks when evidence changes. Preserve the result-first workflow above.

## File ownership and focused tests
| Concern | Source | Tests (under tests/) |
| --- | --- | --- |
| Stable public API | src/simulation.js (reexports only) | all engine tests |
| Constants, base stats, chassis | src/engine/config.js, stats.js | engine-core.test.js |
| Draft categories and attack stages | src/engine/module-registry.js | engine-draft.test.js, module-expansion.test.js |
| Geometry and navigation | src/engine/geometry.js, navigation.js | engine-navigation.test.js, work-profiles.test.js |
| Collision and stability | src/engine/collision.js | engine-displacement.test.js |
| Targeting, movement, holding/support | src/engine/targeting.js, positioning.js, movement.js | engine-navigation.test.js, engine-cooperation.test.js |
| Attack cycle and projectiles | src/engine/combat.js, projectiles.js | engine-attack-cycle.test.js, engine-projectiles.test.js |
| Utilities and reactions | src/engine/utilities.js | engine-reactions.test.js |
| Attack effects and follow-through | src/engine/effects.js, followthrough.js | engine-modules.test.js, engine-displacement.test.js, ricochet-*.test.js |
| Tick ordering, per-unit passives, damage application | src/engine/loop.js | engine-core.test.js, engine-modules.test.js |
| Spawn and ranking primitives | src/engine/round.js | engine-core.test.js |
| Optional counters | src/engine/telemetry.js | engine-module-telemetry.test.js, module-telemetry.test.js |
| Draft/match lifecycle | src/headless.js | headless.test.js, engine-draft.test.js |
| Bot decisions | src/draft-ai.js | headless.test.js, playtest-harness.test.js |
| Card text and player UI | src/module-info.js, src/game.js, src/mobility-visual.js, style.css | browser.test.js, mobility-visual.test.js |

Engine modules import their direct dependencies, never the facade. Keep new files focused and aim for 10–15 KB per subsystem. Config and registry are low-level; avoid import cycles. Keep card wording synchronized with mechanics, and preserve ordered lists because draft RNG depends on order. Add focused tests in the existing owning suite. The facade retains the historical public exports for both Node and browser consumers.

## Design invariants
- Deterministic, DOM-free engine; browser is an adapter to the same match rules. Four-player FFA, shared draft before first combat and every subsequent round, active players + 2 offers; duplicated offers remain contested. Maximum three chassis per squad. Winner takes no persistent HP loss. Ties use shared headless ranking rules.
- Fixed 30 Hz, 30-second rounds. Legitimate holding, survival and timeouts are valid. No forced aggression timer. Movement should remain purposeful and terrain-aware. Navigation regression gates flag physically stuck pursuers and failed stationary-target fixtures, not every timeout.
- Morphology is a unique specialization (-1, 0, +1); opposite cards replace and duplicates are illegal. It does not occupy utility slots. Use radiusOf and attackTimeScale consistently.
- Utility/passive slots remain limited; duplicate movement utility copies improve cooldown not travel, nonstacking passives remain unique. Coordinated is a unique utility granting its holder +10% HP, damage, movement speed, attack frequency and reach; relaxed formation yields to productive engagement. Resolve is a unique attack module: 80% slow resistance and +2 defense, no utility slot. Total flat defense is capped at 10 before Sunder. Preserve ability and module cooldown semantics. Optional diagnostics and telemetry must not consume RNG or change outcomes.
- Low-end Android: no runtime dependencies or heavy assets; measure CPU and allocations before optimizing. Do not minify maintained source. Keep historical details in docs/history, current behavior in code and tests.

## Verification
- For large audits, parallelize by experimental condition rather than only by subject; use identical seed sets and matched controls across conditions. Local mechanics need focused regression tests; module tuning can shard by chassis/build; foundational stat or combat-rule changes should fan out widely across conditions and, if needed, seed ranges. AI audits should separate profiles, navigation, synergy and full-match outcomes. Keep aggregate sample size and coverage intact while reducing per-job duration; aggregate results only after checking shard completion, missing/duplicate cases and actual sample counts. Keep diagnostic branches separate from production and respect runner concurrency limits.
- Default: run the smallest relevant check when execution is available. For module/behavior changes use the owning suite (e.g. node --test tests/engine-navigation.test.js); for UI changes use browser tests. For balance changes use a small headless sample and report seeds. Do not block routine iteration on exhaustive testing.
- Milestones and substantial changes: npm test (Node 22+, GitHub Actions). Routine CI runs the standard tests only, not parity, playtest or navigation batches. Agent-vs-bots: node scripts/agent-playtest.js 12 1; this is strategic scripted seat 0, not a browser-driving LLM.
- Balance baseline or deliberate audit: npm run balance:report -- 100 strategic 1; random: npm run balance:report -- 100 random 1. Use smaller batches for ordinary tuning. Navigation: npm run diagnose:navigation -- 8 1 (add --json for per-unit traces). Report match counts, seeds, timeouts, failures and actual commands.
- Structural parity (opt-in for major refactors, not routine CI): npm run verify:parity -- <baseline commit SHA> (requires accessible Git history; no extra dependency). Compare seeded round and full-match state, not just winners. Only require parity for changes intended to preserve behavior.
- If only isolated JavaScript evaluation is possible, call it isolated smoke/parity testing, not Node CI. Never claim tests ran when they did not.
- On a playable release, update the visible prototype label, build.json and all browser module/cache query versions together; do not claim Pages is live without verification.

3.2.3 closes the module-development phase; 3.3 focuses on fighter AI profiles and targeting/positioning, not new combat modules. Defense audit completed: caps 8–10 barely changed defensive stress-build wins; removing all four Resolve copies reduced Reactive Defender wins from 13/24 to 5/24. Resolve is now unique; these ablations do not isolate the slow-resistance and defense effects.

Historical design decisions and previous test limitations: docs/history/AGENTS-through-3.1.2.md and docs/history/README-through-3.1.2.md. See PLAYTESTING.md for harness usage.
