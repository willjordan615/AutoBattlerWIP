import test from 'node:test';
import assert from 'node:assert/strict';
class FakeNode{
 constructor(id=''){this.id=id;this.children=[];this.style={};this.value='0';this.textContent='';this.disabled=false;this.className='';this.classList={add:(name)=>{this.className+=' '+name}}}
 setAttribute(name,value){this[name]=value}
 append(...children){this.children.push(...children)}
 replaceChildren(...children){this.children=children}
 prepend(child){this.children.unshift(child)}
 remove(){this.children=[]}
 get lastChild(){return this.children.at(-1)}
 addEventListener(){}
 scrollIntoView(options){this.scrollOptions=options}
 getContext(){return new Proxy({},{get:()=>()=>{}})}
}
test('browser adapter shares headless draft and combat lifecycle',async()=>{
 const nodes=new Map();
 const find=(node,id)=>node.id===id?node:node.children.map(child=>find(child,id)).find(Boolean);
 globalThis.document={getElementById(id){for(const node of nodes.values()){const found=find(node,id);if(found)return found}if(!nodes.has(id))nodes.set(id,new FakeNode(id));return nodes.get(id)},createElement:tag=>new FakeNode(tag)};
 const callbacks=[];globalThis.requestAnimationFrame=fn=>{callbacks.push(fn);return callbacks.length};
 globalThis.cancelAnimationFrame=()=>{};
 globalThis.performance={now:()=>1000};
 Object.defineProperty(globalThis,'crypto',{configurable:true,value:{getRandomValues(values){values[0]=20261121;return values}}});
 await import('../src/game.js');
 const $=id=>document.getElementById(id);
 assert.equal($('phaseTitle').textContent,'Play');
 assert.equal($('layout')['data-phase'],'mode');
 const menu=$('choices').children;assert.deepEqual(menu.map(b=>b.children[0].textContent),['Solo','Quick Play','Ranked','Options']);assert.deepEqual(menu.map(b=>b.disabled),[false,false,true,false]);assert.equal(menu[2].onclick,null);menu[3].onclick();assert.equal($('layout')['data-phase'],'options');$('restart').onclick();assert.equal($('layout')['data-phase'],'mode');
 menu[1].onclick();assert.equal($('layout')['data-phase'],'start');assert.match($('phaseInfo').textContent,/Quick Play/);$('restart').onclick();assert.equal($('layout')['data-phase'],'mode');
 $('choices').children[0].onclick();
 assert.equal($('phaseTitle').textContent,'Choose your starting chassis');
 assert.equal($('layout')['data-phase'],'start');
 $('choices').children[0].onclick();
 assert.match($('phaseTitle').textContent,/draft/);
 const fighter=$('squad').children[1];const slots=fighter.children.find(x=>x.className==='fighter-slots');assert.equal(slots.children.length,3);assert.equal(slots.children[1].textContent,'Empty');assert.equal(slots.children[2].textContent,'Empty');
 assert.equal($('choices').children.length>=4,true);
 const choice=$('choices').children.find(x=>x.onclick);
 choice.onclick();
 assert.ok($('choices').children.some(x=>x.className==='draft-detail'));
 $('advance').onclick();
 assert.equal($('phaseTitle').textContent,'Combat in progress');
 assert.equal($('layout')['data-phase'],'fight');
 assert.equal($('fighterInfo').open,false);
 callbacks.at(-1)();
 assert.equal($('arena').scrollOptions.block,'start');
 assert.equal($('exportMatch').disabled,false);
 const during=$('choices').children.filter(x=>x.className.includes('draft-card'));
 assert.equal(during.length,6);
 assert.equal(during.filter(x=>x.className.includes('claimed')).length,4);
 for(const card of during.filter(x=>x.className.includes('claimed'))){assert.equal(card.disabled,true);assert.ok(card.children.some(x=>x.className==='draft-owner'&&x.style.color));}
 for(let i=0;i<901&&$('phaseTitle').textContent==='Combat in progress';i++)$('step').onclick();
 assert.match($('phaseTitle').textContent,/complete/);
 assert.match($('results').children[0].children[0].textContent,/#1/);
 assert.equal($('layout')['data-phase'],'results');
 assert.match($('resultHeadline').children[0].textContent,/place/);
 $('advance').onclick();
 assert.match($('phaseTitle').textContent,/draft/);
 const cards=$('choices').children.filter(x=>x.className.includes('draft-card'));
 assert.equal(cards.length,6);
 const claimed=cards.filter(x=>x.className.includes('claimed'));
 // The winner drafts last; a last-place human can legitimately have zero prior claims.
 assert.equal(claimed.length,cards.filter(x=>x['data-owner']!==undefined).length);
 for(const card of claimed){assert.equal(card.disabled,true);assert.ok(card.children.some(child=>child.className==='draft-owner'&&/^Bot [123]$/.test(child.textContent)),'Claimed card has a bot superscript')}
});
