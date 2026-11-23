# Prototype 2.9 — Contextual drafting build audit
**Date:** 2026-11-23  
**Engine:** Prototype 2.9, GitHub main at the time of the test  
**Reproduction:** `node scripts/build-audit.js 12 2101 --json`

## Method and limitations
- **12 seeded full matches**, seeds **2101–2112**, all four players using contextual `chooseCpuDraft`. The initial chassis rotation follows the audit harness.
- Each match ran real 30 Hz deterministic simulation, combat ranking, draft progression and player eliminations, up to 60 rounds (none reached the cap).
- The measurements were executed by evaluating the source files in an isolated JavaScript harness connected to GitHub, in three four-seed batches; **the Node CLI and full test suite were not executed** in this pass.
- Performance is based on actual `unit.combatStats.damage`, aggregated across a fighter's combat appearances and divided by total combat duration. This is **damage per elapsed combat second**, not attack DPS against a dummy.
- Standout entries require at least three combat appearances; the displayed loadout is the fighter's **highest-DPS round snapshot**, not necessarily its final build.
- These are **observational, non-randomized build comparisons**. Longer-lived players have more opportunities to draft, so win correlations do not establish a module's causal strength. Samples for combinations are small.

## Summary
| Metric | Observed |
|---|---:|
| Matches completed | **12/12** |
| Combat rounds | **141** |
| Average rounds per match | **11.75** |
| 30-second combat timeouts | **0 / 141** |
| Winning team final roster | **12 / 12 had 2 chassis** |
| Winner starting archetype | Bruiser **6**, Rogue **3**, Ranged **3** |

### Draft choices
Across all bots and rounds, **472 picks** were recorded:

| Card kind | Picks | Share |
|---|---:|---:|
| Attack modifiers | 187 | 39.6% |
| Targeting upgrades | 98 | 20.8% |
| Movement utilities | 84 | 17.8% |
| Utility-slot passives | 63 | 13.3% |
| New chassis | 40 | 8.5% |

The nonuniform selection is expected: scores, contested cards and unequal catalog sizes all matter. This distribution does not by itself prove that the AI plans ahead.

### Fighter damage output by chassis
This summarizes **fighter appearances lasting at least three combats**, counting their actual damage divided by total elapsed combat seconds in this audit. It is not a controlled comparison of equivalent upgrades or matchups.

| Chassis | Aggregate damage | Aggregate combat seconds | Weighted damage/sec |
|---|---:|---:|---:|
| Rogue | 34,134.98 | 4,613.14 | **7.40** |
| Bruiser | 21,618.44 | 4,014.67 | **5.38** |
| Ranged | 14,731.16 | 3,344.07 | **4.41** |

**Watch item:** Rogues substantially outperformed other chassis on this observational per-fighter damage metric. This may reflect rate of attack, positioning, selection bias, or module opportunities. It is worth following in a larger balanced sample rather than adjusting base stats immediately.

## Individual standouts
These are examples of **observed fighters**, not recommended solved builds. Average DPS includes all the recorded combat rounds for that fighter.

| Match seed | Fighter | Total damage | Average DPS | Combat rounds | Team won? | Peak-round build |
|---|---|---:|---:|---:|---|---|
| **2110**, seat 3 | Solo Rogue | 929.37 | **13.39** | 7 | No | Momentum ×2 |
| **2108**, seat 1 | Solo Rogue | 1,160.62 | **12.36** | 8 | No | Burning; Flank |
| **2105**, seat 0, slot 1 | Rogue in duo | 1,537.85 | **10.28** | 11 | **Yes** | Momentum ×2; Burning; Dash; Focus |
| **2111**, seat 0, slot 1 | Rogue in duo | 1,370.57 | **9.79** | 11 | **Yes** | Burning; Restless; Follow Through |
| **2103**, seat 0, slot 1 | Rogue in duo | 1,680.54 | **9.14** | 13 | **Yes** | Disruption; Momentum; Follow Through; Haste |
| **2108**, seat 3, slot 0 | Bruiser in duo | 1,177.30 | **8.06** | 13 | **Yes** | Range; Multishot; Precision; Momentum; Burning; Backstep; Haste |
| **2110**, seat 1, slot 0 | Ranged in duo | 775.20 | **7.86** | 11 | No | Multishot; Piercing; Taunt; Hazardous; Backstep; Dodge |

The solo Rogue on seed 2110 led the damage leaderboard but **did not win**; high output alone is not the same as strategic success. The Momentum/Burning/Dash/Focus Rogue from seed 2105 is the standout *successful layered build* from this sample.

## Recognizable multi-module interactions
Occurrences count **individual fighters** whose final configuration included the named pair (not entire teams or rounds). The right column counts fighters belonging to match-winning players. Very small sample sizes: **do not treat the percentages as robust win rates.**

| Interaction | Fighter occurrences | On winning teams |
|---|---:|---:|
| Burning + Restless | 8 | 1 |
| Hazardous + Disruption | 7 | 2 |
| Burning + Range | 7 | 1 |
| Momentum + Haste | 6 | 3 |
| Multishot + Piercing | 5 | 1 |
| Chain + Area | 5 | 1 |
| Momentum + Dash | 3 | 2 |
| Momentum + Flank | 3 | 2 |
| Restless + Expose | 2 | 0 |

**Observations:** The bots are choosing cross-module pairings rather than always taking individually high-ranked effects. Mobility-plus-Momentum occurred on winning squads, although samples are far too small to establish causality. Burning + Restless was relatively frequent but rarely occurred on a winning team; the actual design interaction deserves follow-up before changing either module. Expose + Restless remains rare.

## What to test next
1. More seeds and **within-seed counterfactual drafts** to separate module effects from bot and match luck.
2. Equalized, mirrored chassis matchups to isolate Rogue performance without selection and exposure biases.
3. Paired evaluation of contextual vs legacy draft scoring on identical offers and starting conditions.
4. Track module effect **activations and realized value**, not only whether a module was equipped: Chain secondary damage, Expose consumption, Hazardous zone damage, Restless switches, utility activations.
5. Track target-weight and personality outcomes to determine whether a soft tactical preference genuinely influences combat, not only draft selection.

**No numerical balance or combat engine changes were made during this audit.**
