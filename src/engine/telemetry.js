// Engine subsystem: telemetry. See AGENTS.md for ownership and test routes.


// Opt-in counters: no RNG calls or changes to combat decisions.
export function measure(state,u,key,metric,value=1){if(!state.moduleTelemetry||!Number.isFinite(value)||value===0)return;const rows=state.moduleTelemetry[u.id]||=(Object.create(null));const row=rows[key]||=(Object.create(null));row[metric]=(row[metric]||0)+value;}
