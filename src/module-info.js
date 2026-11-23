import {ATTACK_STAGES} from './simulation.js?v=attack-pipeline-210';
// Player-facing catalog copy. The combat engine in simulation.js is authoritative.
// Keep short summaries and expanded descriptions together to avoid drift.
export const DETAILS={
 'unit:bruiser':'Recruit a durable melee Bruiser (maximum three fighters per squad). Each additional fighter reduces EVERY squad member\'s base HP and damage by 15% from the next combat round.',
 'unit:rogue':'Recruit a fast melee Rogue (maximum three fighters per squad). Each additional fighter reduces EVERY squad member\'s base HP and damage by 15% from the next combat round.',
 'unit:ranged':'Recruit a long-range projectile fighter (maximum three fighters per squad). Each additional fighter reduces EVERY squad member\'s base HP and damage by 15% from the next combat round.',
 'utility:dash':'Burst toward a favorable attack position when approaching an enemy. Base cooldown: 5 seconds.',
 'utility:dodge':'When an incoming projectile or committed melee swing threatens this fighter, roll sideways toward a safer position and briefly evade attacks. Base cooldown: 5 seconds; may interrupt an unfinished attack windup.',
 'utility:backstep':'Burst away from the selected enemy when nearby threats make retreat useful. Base cooldown: 4.5 seconds.',
 'utility:flank':'Burst toward a better angle beside the selected enemy when approaching a useful position. Base cooldown: 4 seconds.',
 'utility:intercept':'Burst toward an opponent threatening an ally, when that ally needs protection. Base cooldown: 5 seconds.',
 'attack:projectiles':'Add one attack lane per stack, spreading attacks across additional directions. Ranged fighters fire extra projectiles; melee fighters gain additional attack lanes. Each enemy can be hit only once per ranged volley or melee release.',
 'attack:piercing':'Each stack allows a projectile to pass through one more enemy, or a melee attack to hit one additional enemy within its committed footprint. Terrain still stops projectiles; each enemy can be hit only once per release.',
 'attack:area':'Each stack adds 9 units of melee reach and 12° of melee arc, or 3 units of projectile collision radius for ranged attacks. It does not increase projectile travel distance.',
 'attack:knockback':'Each stack pushes an enemy 4 arena units away from the attacker on a landed hit, subject to walls and arena boundaries.',
 'attack:taunt':'A landed hit forces a surviving target to focus this fighter for 0.25 seconds per stack. Further hits refresh the effect; it ends early if the attacker is defeated.',
 'attack:range':'Each stack adds 8 units of attack range or projectile travel distance. It does not widen melee arcs or projectiles.',
 'attack:sunder':'A landed hit reduces the target\'s defense against subsequent attacks for 2 seconds, by 1 per stack (maximum 3). New hits refresh the effect rather than stacking beyond the cap; the applying hit does not benefit.',
 'attack:precision':'Attacks against enemies above 75% HP gain 2 raw damage per stack. It is an opening-hit bonus, not a reward for repeatedly attacking the same enemy.',
 'attack:expose':'A landed hit marks its target for 1.5 seconds. A hit from a DIFFERENT fighter on the same team consumes the mark for 2 bonus raw damage per stack (maximum 4 stacks). Your own follow-up attack cannot consume your mark.',
 'attack:disruption':'A landed hit slows the target\'s movement speed for 0.6 seconds: 8% per stack, up to 45%. Further hits refresh the slow. Attack speed is unaffected.',
 'attack:momentum':'Each attack gains up to 2 raw damage per stack, based on distance actually traveled over the previous 2 seconds (up to 100 units). Sideways movement and retreat count; no specific target or consecutive hits are required.',
 'attack:chain':'Redistribute 20% of the primary hit\'s damage per stack (up to 60%) toward the nearest additional enemy within 95 units and clear of obstacles. The primary hit loses that share even if no secondary target exists. The second target applies its own defense; the secondary hit cannot chain again or apply other on-hit effects.',
 'attack:burning':'On a qualifying landed attack, apply a 2-second burn dealing 2 damage per second per stack (maximum 12 DPS), ignoring defense. Each fighter can activate Burning once per second; all eligible targets struck by that attack receive it, including later impacts from the same volley. Hits while the activation is on cooldown do not refresh the burn. Burn ticks cannot trigger on-hit effects.',
 'attack:hazardous':'On a qualifying landed attack, leave a damaging patch at each struck enemy\'s position for 2.5 seconds. Each fighter can activate Hazardous once per second; all eligible targets of the same attack can create a patch, including later impacts from that volley. Enemies standing in patches take 2 damage per second per stack (maximum 10 DPS), ignoring defense. Each fighter can maintain up to two patches, and overlapping patches can both deal damage. Patch damage cannot trigger on-hit effects.',
 'attack:restless':'For 3 seconds after landing a hit, lower the priority of targeting that same enemy again. Stacks strengthen this preference for switching; other targeting weights can counteract it.',
 'attack:followthrough':'On the first qualifying melee impact per attack, move through the struck target and land just beyond it, briefly ignoring only that target\'s body blocking. Respects terrain and other fighters. Internal cooldown: 0.75 seconds. Stacks do not increase displacement.',
 'attack:disengage':'After each committed attack releases, heavily prioritize personal safety and retreat away from nearby enemies for 0.5 seconds. The fighter then re-evaluates its target normally. Works on melee and ranged attacks; extra stacks do not extend the retreat.',
 'target:executioner':'Increase Kill Opportunity targeting weight by 1. Prefer enemies with a smaller percentage of HP remaining.',
 'target:guardian':'Increase Ally Protection targeting weight by 1. Prefer enemies currently targeting your teammates.',
 'target:skirmisher':'Increase Preferred Range targeting weight by 1. Prefer enemies near this fighter\'s effective attack range.',
 'target:coward':'Increase Personal Safety targeting weight by 1. Prefer safer, more distant engagements; depending on other weights, this can also encourage retreat.',
 'target:duelist':'Increase Target Isolation targeting weight by 1. Prefer enemies farther from their own teammates.',
 'target:hunter':'Increase Target Distance targeting weight by 1. Prefer enemies that are physically closer.',
 'target:aggressor':'Increase Damage Opportunity targeting weight by 1. Prefer enemies against whom the fighter\'s damage represents a larger share of remaining HP.',
 'passive:regen':'Occupies one of two shared Utility slots. Passively restore 2 HP per second, up to this fighter\'s maximum HP. Unique per fighter.',
 'passive:bulwark':'Occupies one of two shared Utility slots. When a substantial hit is imminent or at least two enemies are nearby, gain 5 defense for 2 seconds. Cooldown: 6 seconds. Unique per fighter.',
 'passive:haste':'Occupies one of two shared Utility slots. When pursuing an enemy or retreating under threat, gain 40% movement speed for 1.5 seconds. Cooldown: 5 seconds. Unique per fighter.',
 'passive:focus':'Occupies one of two shared Utility slots. When multiple attacks could finish an enemy soon, attack 35% faster for 1.5 seconds. Does not activate for a trivial one-hit finish. Cooldown: 6 seconds. Unique per fighter.',
 'passive:retaliation':'Occupies one of two shared Utility slots. After receiving a direct melee hit, the next attack made within 4 seconds gains 4 raw damage. Does not affect attack timing. Unique per fighter.'
};
export const SUMMARIES={
 'unit:bruiser':'Recruit Bruiser · each extra fighter lowers squad base HP/damage by 15%',
 'unit:rogue':'Recruit Rogue · each extra fighter lowers squad base HP/damage by 15%',
 'unit:ranged':'Recruit Ranged · each extra fighter lowers squad base HP/damage by 15%',
 'utility:dash':'Approach burst · 5s cooldown',
 'utility:dodge':'Reactive sideways dodge · brief evasion · 5s cooldown',
 'utility:backstep':'Retreat burst · 4.5s cooldown',
 'utility:flank':'Move to a better side angle · 4s cooldown',
 'utility:intercept':'Move toward an ally\'s attacker · 5s cooldown',
 'attack:projectiles':'+1 spread attack lane · each enemy hit once per release',
 'attack:piercing':'+1 enemy hit through the attack footprint',
 'attack:area':'Melee: +9 reach, +12° arc · Ranged: +3 hit radius',
 'attack:knockback':'Push struck enemies +4 units per stack',
 'attack:taunt':'Force struck enemy to target you · +0.25s per stack',
 'attack:range':'+8 reach or projectile travel per stack',
 'attack:sunder':'Lower defense for subsequent hits · max −3',
 'attack:precision':'+2 damage per stack against enemies above 75% HP',
 'attack:expose':'Mark enemy for bonus damage from a different ally',
 'attack:disruption':'Slow target movement by 8% per stack · max 45%',
 'attack:momentum':'More distance traveled in last 2s → bonus attack damage',
 'attack:chain':'Redirect 20% damage per stack to another nearby enemy',
 'attack:burning':'Apply 2-second burn · 1s activation cooldown per fighter',
 'attack:hazardous':'Create damaging ground · 1s activation cooldown · max 2 patches',
 'attack:restless':'Recently hit enemies become lower-priority targets',
 'attack:followthrough':'Melee hit moves attacker through target · 0.75s cooldown',
 'attack:disengage':'After attacking, retreat for 0.5s then retarget',
 'target:executioner':'Kill Opportunity +1 · favor weakened enemies',
 'target:guardian':'Ally Protection +1 · favor threats to teammates',
 'target:skirmisher':'Preferred Range +1 · favor targets at ideal distance',
 'target:coward':'Personal Safety +1 · favor safer engagements',
 'target:duelist':'Target Isolation +1 · favor separated enemies',
 'target:hunter':'Target Distance +1 · favor closer enemies',
 'target:aggressor':'Damage Opportunity +1 · favor vulnerable enemies',
 'passive:regen':'Utility slot · restore 2 HP/s',
 'passive:bulwark':'Utility slot · reactive +5 defense',
 'passive:haste':'Utility slot · reactive +40% movement speed',
 'passive:focus':'Utility slot · reactive faster attacks',
 'passive:retaliation':'Utility slot · next attack after receiving a melee hit gains +4 damage'
};
export function cardDetail(card){
 const key=card.kind+':'+card.key;
 const detail=DETAILS[key]||card.name;
 return card.kind==='utility'?detail+' A second copy on the same fighter halves the cooldown without using another slot (maximum two copies).':
  card.kind==='attack'&&ATTACK_STAGES[card.key]?detail+' Category: '+ATTACK_STAGES[card.key].stage+'.':detail;
}
export function cardSummary(card){
 const key=card.kind+':'+card.key;
 const summary=SUMMARIES[key]||card.name;
 return card.kind==='utility'?'Utility · one of 2 slots · '+summary+(summary.includes('cooldown')?' · second copy halves cooldown':''):
  card.kind==='passive'?'Utility · '+summary.replace(/^Utility slot · /,''):
  card.kind==='target'?'Targeting · '+summary:
  card.kind==='attack'?'Attack · '+(ATTACK_STAGES[card.key]?.stage||'effect')+' · '+summary:summary;
}
