// Profile 2: player-facing, source-of-truth card descriptions.
// Values match the current prototype's simulation formulas.
export const DETAILS={
 'unit:bruiser':'Recruit a durable melee fighter. Adds one Bruiser chassis to your squad (maximum 3).',
 'unit:rogue':'Recruit a fast melee fighter. Adds one Rogue chassis to your squad (maximum 3).',
 'unit:ranged':'Recruit a long-range fighter. Adds one Ranged chassis to your squad (maximum 3).',
 'attack:damage':'Attack damage +2 per hit. Permanent chassis upgrade; stacks.',
 'attack:rate':'Attack cooldown reduced by dividing it by 1 + 0.15 per stack. Attacks happen more often; does not affect movement.',
 'attack:range':'Attack reach +20 arena units per stack. Works on melee and ranged chassis.',
 'attack:projectiles':'Adds a frontal attack lane per stack, alternating to either side of the aimed target. Each enemy can be hit only once per attack cycle; combines with Pierce for depth. Works with melee and ranged.',
 'attack:piercing':'Each attack can also hit one additional enemy in its path per stack (cleave for melee).',
 'attack:area':'Attack width increases by 8 arena units per stack; extends secondary-target reach by 15.',
 'attack:knockback':'Push targets 4 arena units farther per stack when struck.',
 'attack:taunt':'On hit, force the struck enemy to target this chassis for 0.25 seconds per stack. Repeated hits refresh the duration; expires early if the attacker is defeated.',
 'attack:speed':'Movement speed +18 arena units/second per stack. Permanent chassis stat; not attack speed.',
 'attack:hp':'Chassis combat maximum HP +20 per stack. Not the player’s persistent match HP.',
 'target:executioner':'Targeting: Kill Opportunity weight +1. Prefer enemies near defeat.',
 'target:guardian':'Targeting: Ally Protection weight +1. Prefer enemies threatening teammates.',
 'target:skirmisher':'Targeting: Preferred Range weight +1. Favor targets at effective attack range.',
 'target:coward':'Targeting: Personal Safety weight +1. Prefer safer engagements; may retreat.',
 'target:duelist':'Targeting: Target Isolation weight +1. Prefer enemies separated from their team.',
 'target:hunter':'Targeting: Target Distance weight +1. Prefer nearer enemies.',
 'target:aggressor':'Targeting: Damage Opportunity weight +1. Prefer targets vulnerable to damage.',
 'passive:regen':'Passive slot: regenerate 2 chassis combat HP per second while alive. Maximum two passives.',
 'passive:bulwark':'Passive slot: +3 defense, reducing damage taken from each attack. Maximum two passives.',
 'passive:haste':'Passive slot: movement speed multiplied by 1.25 (+25%). Unlike Speed +18, this scales with existing movement upgrades.',
 'passive:focus':'Passive slot: attack cooldown divided by 1.15 (about 15% more attacks). Maximum two passives.'
};
export function cardDetail(card){return DETAILS[card.kind+':'+card.key]||card.name}
