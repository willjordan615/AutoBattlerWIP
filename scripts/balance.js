import {simulate} from '../src/headless.js';
const count=Math.max(1,Math.min(1000,Number(process.argv[2]||100)));
const wins=[0,0,0,0],rounds=[],finishCounts=new Map();
for(let seed=1;seed<=count;seed++){const match=simulate(seed,250);if(match.phase!=='finished')throw Error('Seed '+seed+' did not finish');const winner=match.players.findIndex(p=>p.hp>0);wins[winner]++;rounds.push(match.round);finishCounts.set(match.round,(finishCounts.get(match.round)||0)+1)}
const average=rounds.reduce((a,b)=>a+b,0)/count;
console.log(JSON.stringify({matches:count,winsByStartingSeat:wins,averageRounds:Number(average.toFixed(2)),shortest:Math.min(...rounds),longest:Math.max(...rounds),roundDistribution:Object.fromEntries([...finishCounts].sort((a,b)=>a[0]-b[0]))},null,2));
