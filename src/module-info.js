// Profile 2: player-facing, source-of-truth card descriptions.
// Values match the current prototype's simulation formulas.
export const DETAILS={
 'utility:dash':'Uses one of two shared passive/utility slots. Offers a speed-scaled approach burst when weighted positioning favors it. Cooldown 5 seconds; repeat drafts strengthen the equipped utility.',
 'utility:dodge':'Uses one of two shared passive/utility slots. Offers a sideways evasive roll when the weighted movement policy favors it. Cooldown 5 seconds; stacks extend movement and evasion.',
 'utility:backstep':'Uses one of two shared passive/utility slots. Offers a backward burst when weighted positioning favors distance. Cooldown 4.5 seconds.',
 'utility:flank':'Uses one of two shared passive/utility slots. Offers an angled approach when the position evaluator favors it. Cooldown 4 seconds; stacks extend movement.',
 'utility:disengage':'Uses one of two shared passive/utility slots. Offers an escape burst when enemies crowd the chassis and weights favor retreat. Cooldown 6 seconds; stacks extend retreat.',
 'utility:intercept':'Uses one of two shared passive/utility slots. Offers a burst toward an enemy targeting or threatening an ally, evaluated using the existing ten weights. Cooldown 5 seconds.',
 'utility:followthrough':'Uses one of two shared passive/utility slots. Offers a burst past the selected enemy when weighted positioning favors it, ignoring only that enemy’s body block. Terrain and other units still block. Cooldown 6 seconds; stacks extend travel.',
 'unit:bruiser':'Recruit a durable melee fighter. Adds one Bruiser chassis to your squad (maximum 3).',
 'unit:rogue':'Recruit a fast melee fighter. Adds one Rogue chassis to your squad (maximum 3).',
 'unit:ranged':'Recruit a long-range fighter. Adds one Ranged chassis to your squad (maximum 3).',
 'attack:projectiles':'Adds a frontal attack lane per stack, alternating to either side of the aimed target. Ranged lanes launch separate physical shots blocked by walls and enemies; melee lanes strike immediately. Each enemy can be damaged only once per volley.',
 'attack:piercing':'Ranged shots pass through one extra enemy per stack, stopping at walls; melee attacks cleave one additional target per stack. No enemy takes repeat damage from one volley.',
 'attack:area':'Melee attack width increases by 8 arena units per stack and extends secondary-target reach by 15. Ranged projectile radius increases by 3 per stack, widening physical collision.',
 'attack:knockback':'Push targets 4 arena units farther per stack when struck.',
 'attack:taunt':'On hit, force the struck enemy to target this chassis for 0.25 seconds per stack. Repeated hits refresh the duration; expires early if the attacker is defeated.',
 'target:executioner':'Targeting: Kill Opportunity weight +1. Prefer enemies near defeat.',
 'target:guardian':'Targeting: Ally Protection weight +1. Prefer enemies threatening teammates.',
 'target:skirmisher':'Targeting: Preferred Range weight +1. Favor targets at effective attack range.',
 'target:coward':'Targeting: Personal Safety weight +1. Prefer safer engagements; may retreat.',
 'target:duelist':'Targeting: Target Isolation weight +1. Prefer enemies separated from their team.',
 'target:hunter':'Targeting: Target Distance weight +1. Prefer nearer enemies.',
 'target:aggressor':'Targeting: Damage Opportunity weight +1. Prefer targets vulnerable to damage.',
 'passive:regen':'Passive slot: regenerate 2 chassis HP per second. Unique per chassis; shares two slots with utilities.',
 'passive:bulwark':'Passive slot: +3 defense. Unique per chassis; shares two slots with utilities.', reducing damage taken from each attack. Maximum two passives.',
 'passive:haste':'Passive slot: +25% movement speed. Unique per chassis; shares two slots with utilities.', this scales with existing movement upgrades.',
 'passive:focus':'Passive slot: attack cooldown divided by 1.15 (about 15% more attacks). Unique per chassis; occupies one of two passive/utility slots.'
};
export function cardDetail(card){const detail=DETAILS[card.kind+':'+card.key]||card.name;return card.kind==='utility'?detail+' A second copy on the same chassis halves its cooldown (maximum two copies); it does not consume another slot.':detail}
