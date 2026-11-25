// Engine subsystem: config. See AGENTS.md for ownership and test routes.


// Deterministic, renderer-independent combat backend. Values are provisional balance defaults.
export const CHASSIS={
 bruiser:{name:'Bruiser',hp:155,damage:16,range:58,speed:48,rate:1.25,defense:4,radius:15,delivery:'melee',fill:'#eeb878',desc:'Durable melee frontliner'},
 rogue:{name:'Rogue',hp:105,damage:18,range:60,speed:95.45,rate:.78,defense:1,radius:11,delivery:'melee',fill:'#c2a1fa',desc:'Fast opportunistic melee'},
 ranged:{name:'Ranged',hp:80,damage:14,range:160,speed:62,rate:1.12,defense:0,radius:11,delivery:'projectile',fill:'#8ce7bd',desc:'Long-range projectile attacker'}
};
export const METRICS=['kill','damage','threat','distance','allyProximity','safety','protection','ability','isolation','preferredRange','coordinated','independent','opportunist','pursuer','challenger'];
export const BASE_WEIGHTS={
 bruiser:[.8,1,1.1,1.1,.9,.3,1.2,.5,.3,.7],
 rogue:[1.4,1.1,.5,.9,.2,.8,.1,.6,1.1,1],
 ranged:[.9,1,.5,.6,.2,1.4,.2,.5,.5,1.7]
};
export const ARENAS=[
 {name:'Open Arena',obstacles:[]},
 {name:'Twin Pillars',obstacles:[{x:278,y:172,w:40,h:85},{x:402,y:263,w:40,h:85}]},
 {name:'Central Barrier',obstacles:[{x:335,y:155,w:50,h:115},{x:335,y:310,w:50,h:55}]}
];

export const WIDTH=720,HEIGHT=520,STEP=1/30,DURATION=30;
export const ATTACK_TIMING={bruiser:{windup:.30,recovery:.22,lock:.5,windupMove:.18,recoveryMove:.55,arc:95},rogue:{windup:.18,recovery:.12,lock:.5,windupMove:.3,recoveryMove:.75,arc:35},ranged:{windup:.24,recovery:.18,lock:.5,windupMove:.22,recoveryMove:.55,arc:0}};

// Utility movement only; attack-driven Follow Through remains unchanged.
export const UTILITY_MOVE_SCALE=1.3;
export const PROJECTILE_SPEED=320;
export const PROJECTILE_RADIUS=3;

// Signed size tier, shared by the physical and derived-stat systems.
export function morphologyTier(unit){const m=(unit.chassis||unit).mods||{};return Math.max(-3,Math.min(3,(m.growth||0)-(m.shrink||0)));}
export function radiusOf(unit){return CHASSIS[unit.type].radius*(1+.12*morphologyTier(unit));}
export function attackTimeScale(unit){return 1+.10*morphologyTier(unit);}
