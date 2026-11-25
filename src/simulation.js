// Stable public engine API. Implementation lives in engine/.
// Keep this facade free of rules; browser, headless scripts, and tests share it.
export {CHASSIS,METRICS,BASE_WEIGHTS,ARENAS,WIDTH,ATTACK_TIMING,UTILITY_MOVE_SCALE,PROJECTILE_SPEED,PROJECTILE_RADIUS,HEIGHT,STEP,DURATION} from './engine/config.js?v=engine-320';
export {ATTACK_STAGES} from './engine/module-registry.js?v=engine-320';
export {claimAttackEffect,applyRicochetSlide,resolveAttackModules} from './engine/effects.js?v=engine-320';
export {rng,makeChassis,squadStatMultiplier,resolveResistance,stats} from './engine/stats.js?v=engine-320';
export {distance,bound,clearLine} from './engine/geometry.js?v=engine-320';
export {targetScoreDetails,chooseTarget} from './engine/targeting.js?v=engine-320';
export {steerAroundAllies} from './engine/navigation.js?v=engine-320';
export {recentMovement,collisionStability,resolveCollision} from './engine/collision.js?v=engine-320';
export {teamPercent,spawnSlots,spawn,placementGroups,placementDamage,resolvePlayerHP} from './engine/round.js?v=engine-320';
export {meleeAttackTargets,attackWindup,startAttack,advanceAttack,attackMovementMultiplier} from './engine/combat.js?v=engine-320';
export {measure} from './engine/telemetry.js?v=engine-320';
export {advanceProjectiles} from './engine/projectiles.js?v=engine-320';
export {positionScore,holdingOpportunity,cooperativeEngagement} from './engine/positioning.js?v=engine-320';
export {chooseMovement} from './engine/movement.js?v=engine-320';
export {tacticalAssessment,utilityCooldown,disengageDirection} from './engine/utilities.js?v=engine-320';
export {applyFollowthrough,advanceFollowthrough,followthroughDepth,resolveFollowthroughImpacts} from './engine/followthrough.js?v=engine-320';
export {tick} from './engine/loop.js?v=engine-320';
