import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeMatch,renderMatchSummary} from '../src/match-summary.js';
import {createPlayAnalytics} from '../src/play-analytics.js';
import {createPlaytestSink,validPlaytest} from '../server/playtest.js';
test('final placement follows elimination round and ranking, including simultaneous eliminations',()=>{
 const match={players:[{name:'You',hp:0},{name:'B',hp:15},{name:'C',hp:0},{name:'D',hp:0}],history:[
  {round:1,ranking:[1,0,2,3],remaining:[3,20,0,0],combatReport:[{id:0,owner:0,type:'rogue',damage:30,prevented:4,survived:true,moduleDamage:{chain:3}}]},
  {round:2,ranking:[1,0],remaining:[0,15,0,0],combatReport:[{id:0,owner:0,type:'rogue',damage:20,prevented:2,survived:false,moduleDamage:{chain:2}}]}
 ]};
 const r=summarizeMatch(match,0);assert.deepEqual(r.standings.map(p=>p.seat),[1,0,2,3]);assert.equal(r.placement,2);assert.equal(r.rounds,2);assert.equal(r.totals.damage,50);assert.equal(r.totals.prevented,6);assert.equal(r.squad[0].survived,1);assert.deepEqual(r.moduleDamage,[['chain',5]]);
});
test('optional analytics count foreground time and deduplicate completion',()=>{
 let time=0,shown=true;const sent=[],id='12345678-1234-1234-1234-123456789012';
 const a=createPlayAnalytics({now:()=>time,visible:()=>shown,send:v=>sent.push(v),makeId:()=>id});
 a.update({phase:'draft',mode:'solo',playing:true});assert.equal(sent.length,0);
 a.enable(true);a.update({phase:'draft',mode:'solo',playing:true});time=10000;shown=false;a.visibility();time=60000;shown=true;a.visibility();time=65000;a.update({phase:'fight',mode:'solo',playing:false});time=75000;a.update({phase:'over',mode:'solo'});a.update({phase:'over',mode:'solo'});a.flush();
 assert.equal(sent.at(-1).seconds,15);assert.equal(sent.at(-1).finishes,1);assert.equal(sent.at(-1).starts,1);assert.equal(validPlaytest(sent.at(-1)),true);
 a.enable(false);const n=sent.length;a.flush();assert.equal(sent.length,n);
});
test('server rejects extra identifying fields and invalid counts',()=>{
 const logs=[],sink=createPlaytestSink({write:v=>logs.push(v),now:()=>0}),v={id:'12345678-1234-1234-1234-123456789012',seq:1,seconds:12,soloSeconds:12,quickSeconds:0,starts:1,finishes:0,exits:0};
 assert.equal(sink(v),200);assert.equal(sink({...v,ip:'x'}),400);assert.equal(sink({...v,finishes:2}),400);assert.equal(logs.length,1);assert.equal(logs[0].event,'playtest_session_v1');
});

test('final results offer separate menu and replay actions',()=>{
 const original=globalThis.document;
 class Node{constructor(tag){this.tag=tag;this.children=[];this.style={};}append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;}}
 globalThis.document={createElement:tag=>new Node(tag)};
 try{
  const headline=new Node('div'),results=new Node('div'),summary=new Node('div'),calls=[];
  const match={players:[{name:'You',hp:5},{name:'Bot 1',hp:0},{name:'Bot 2',hp:0},{name:'Bot 3',hp:0}],history:[{round:1,ranking:[0,1,2,3],remaining:[5,0,0,0],combatReport:[]}]};
  renderMatchSummary({headline,results,summary,match,seat:0,colors:['a','b','c','d'],chassis:{},onMenu:()=>calls.push('menu'),onReplay:()=>calls.push('replay')});
  const actions=summary.children.at(-1);assert.equal(actions.className,'match-actions');assert.deepEqual(actions.children.map(b=>b.textContent),['Return to Menu','Play Again']);actions.children[0].onclick();actions.children[1].onclick();assert.deepEqual(calls,['menu','replay']);
 }finally{globalThis.document=original;}
});
