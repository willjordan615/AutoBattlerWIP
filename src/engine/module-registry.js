// Engine subsystem: module-registry. See AGENTS.md for ownership and test routes.
import {distance} from './geometry.js?v=engine-360-r4';

// Attack modules are composed by stage, not treated as interchangeable procs.
// Geometric/conditional effects work per hit; persistent aftermath has an
// independent activation window per chassis, shared by every hit of one release.
export const ATTACK_STAGES={
 projectiles:{stage:'shape',label:'Spread lanes'},
 piercing:{stage:'shape',label:'Extra targets'},
 area:{stage:'shape',label:'Hit footprint'},
 range:{stage:'shape',label:'Reach'},
 chain:{stage:'shape',label:'Additional secondary damage'},
 knockback:{stage:'impact',label:'Displacement'},
 followthrough:{stage:'impact',label:'Follow-through displacement',cooldown:.75},
 taunt:{stage:'aftermath',label:'Target override'},
 sunder:{stage:'aftermath',label:'Defense reduction'},
 expose:{stage:'aftermath',label:'Ally-consumable mark'},
 disruption:{stage:'aftermath',label:'Movement slow'},
 precision:{stage:'condition',label:'Healthy-target damage'},
 momentum:{stage:'condition',label:'Recent movement damage'},
 burning:{stage:'aftermath',label:'Damage over time',cooldown:1},
 hazardous:{stage:'aftermath',label:'Persistent ground',cooldown:1},
 disengage:{stage:'aftermath',label:'Post-attack retreat',duration:.5},
 restless:{stage:'targeting',label:'Recent-hit target avoidance'},
 velocity:{stage:'shape',label:'Delivery timing'},rally:{stage:'aftermath',label:'Ally movement'},resonance:{stage:'condition',label:'Ally hit synergy'},fortify:{stage:'aftermath',label:'Temporary defense'},siphon:{stage:'aftermath',label:'Health recovery'},steadfast:{stage:'aftermath',label:'Displacement resistance'},patience:{stage:'targeting',label:'Hold preference'},resolve:{stage:'condition',label:'Slow resistance and defense'},ricochet:{stage:'shape',label:'Terrain bounce / lateral displacement'}
};

// Ordered draft categories; preserve order for seeded draft reproducibility.
export const ATTACK_MODULES=['projectiles','piercing','area','knockback','taunt','range','sunder','precision','expose','disruption','momentum','chain','burning','hazardous','restless','followthrough','disengage','velocity','rally','resonance','fortify','siphon','steadfast','patience','resolve','ricochet'];
export const UTILITY_MODULES=['dash','dodge','backstep','flank','intercept','coordinated'];
export const TARGET_MODULES={
 executioner:{kill:1},guardian:{protection:1},skirmisher:{preferredRange:1},
 coward:{safety:1},duelist:{isolation:1},hunter:{distance:1},aggressor:{damage:1},opportunist:{opportunist:1},pursuer:{pursuer:1},challenger:{challenger:1}
};
// Stackable fractional increments to existing stat fields, not new draft slots.
export const TARGET_STAT_BONUSES=Object.freeze({
 duelist:Object.freeze({speed:.25}),
 guardian:Object.freeze({hp:.25})
});
export const PASSIVE_MODULES=['regen','bulwark','haste','focus','retaliation','aegis','inspiration','anchor','wake','repulsion'];
export const COOPERATIVE_KEYS=new Set(['expose','guardian','intercept','rally','resonance','aegis','inspiration']);

export const MORPHOLOGY_MODULES=['growth','shrink'];
