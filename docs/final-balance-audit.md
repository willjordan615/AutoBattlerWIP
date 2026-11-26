# Reusable 3.2 balance audit

Baseline engine commit: 36610a735b2f2a8e9177714b982be9a741216779. This branch changes only diagnostic scripts and workflow, not production mechanics.

Run `node scripts/final-audit.js <kind> <shard>` with Node 22. Kinds/shards: modules 0–11, synergy 0–7, stress 0–7, cross 0–3, matches 0–7. Each writes a uniquely named JSON record. Collect all records in audit-results and run `node scripts/final-audit-aggregate.js`. The aggregate validates coverage, case counts and duplicate shards. The matrix limits concurrent jobs to 24 and disables fail-fast.

Module comparisons use a clean focal fighter, paired opponent/ally configurations, all three chassis and squad sizes (cooperative cards excluded in solo). Every legal stackable module is tested at up to three copies (utilities at up to two; unique modules one). Eight seeds for single copies, four for additional copies; controls cached per shard. Measured activation is only available where existing telemetry supports it; unchanged outcome signature is a separate indicator, not proof of inactivity. Detected navigation recovery events are not duration of stalls.

Synergy: 8 builds × 2 squad sizes × 6 variants × 36 seeds = 3,456 rounds. Four-copy specialized and random controls; two-copy component and random controls. Stress: 8 × 2 × 3 variants × 36 = 1,728 rounds, with eight-pick specialized, concentrated random and distributed random builds. Opponent draft budget matches the four- or eight-pick experiment; bare/two-pick variants intentionally have less investment. Preset builds bypass offer availability but use ordinary equip legality. Cross-build tournament: 1,440 rounds, balanced appearances and seats, four picks per build; not exhaustive over all four-build subsets. Full matches: 300 random and 300 strategic, identical seed ranges. Match module correlations are not causal effects.

Compare with subsequent AI versions using the same diagnostic code and seed schedule; catalog changes may alter the module case manifest. Do not change rules merely to pass a balance threshold.
