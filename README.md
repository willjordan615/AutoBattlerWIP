# AutoBattler WIP — implementation baseline

Mobile-first, browser-hosted deterministic four-player free-for-all autobattler. This repository is a playable prototype, not a complete realization of the original bespoke game design document.

## Confirmed game rules

- Four players (one human, three CPU in this prototype).
- Starting choice: Bruiser, Rogue, or Ranged chassis.
- Maximum three chassis per player. Chassis builds persist; individual combat HP resets each round.
- Before the first combat and after every subsequent combat round, players use one **shared** pool of **N + 2** draft options (six with four active players). Each player chooses one; chosen options are removed. Remaining options are discarded; the next round draws a new pool.
- Draft choices are new chassis, upgrades assigned to one specific chassis, or targeting/passive modules assigned to one specific chassis.
- Targeting preferences accumulate as weighted modifiers, rather than replacing the entire targeting system.
- Each chassis holds at most two active passives; drafting a third replaces the oldest active passive (temporary prototype replacement rule).
- All four squads fight automatically in a bounded arena. The winner of each round takes no persistent player-HP damage; other placements lose progressively more player HP as rounds advance. The last player with player HP wins.

## Current prototype implementation

- No dependencies; open `index.html` locally or host with GitHub Pages.
- Canvas rendering, fixed-step (30 Hz) seeded simulation, arena wall clamping, pairwise collision separation, commitment-based weighted targeting, and simultaneous attack damage within each simulation tick.
- Drafting is sequential from the **same** shared pool: initial draft uses provisional player order 0→3; subsequent drafts run in reverse of the most recent combat placement. CPU picks automatically resolve before or after the human turn as appropriate. Duplicate cards are allowed.
- CPU decisions are deliberately basic.
- Combat ends when only one team has living units or after a 75-second timeout. Timeout and simultaneous elimination currently use remaining normalized unit HP for ranking.
- No pathfinding around obstacles, projectile visuals, full attack-modifier system, equipment sprites, or 1v1 tiebreaker implementation yet.
- No fixed match-round cap. The current combat timeout remains provisional and still needs to be reduced to the GDD's 30 seconds.

## Next implementation priorities

1. Make the shared draft UI show each CPU pick and the six-option depletion explicitly.
2. Replace timeout/simultaneous-elimination fallback with the specified 1v1 tiebreaker system.
3. Separate pure simulation logic from rendering/UI and add seeded replay tests.
4. Implement full combat utility scoring and movement/obstruction rules from the earlier headless prototype.
5. Introduce attack modifiers and richer modular slots; improve mobile combat readability.

This file distinguishes implemented behavior from confirmed design rules to avoid treating provisional mechanics as final.
