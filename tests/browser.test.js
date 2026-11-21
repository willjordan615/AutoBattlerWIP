import test from 'node:test';
import assert from 'node:assert/strict';
class FakeNode{
 constructor(id=''){this.id=id;this.children=[];this.style={};this.value='1';this.textContent='';this.disabled=false;this.className='';this.classList={add:(name)=>{this.className+=' '+name}}}
 setAttribute(name,value){this[name]=value}
 append(...children){this.children.push(...children)}
 replaceChildren(...children){this.children=children}
 prepend(child){this.children.unshift(child)}
 remove(){this.children=[]}
 get lastChild(){return this.children.at(-1)}
 getContext(){return new Proxy({},{get:()=>()=>{}})}
}
test('browser adapter shares headless draft and combat lifecycle',async()=>{
 const nodes=new Map();
 globalThis.document={getElementById(id){if(!nodes.has(id))nodes.set(id,new FakeNode(id));return nodes.get(id)},createElement:tag=>new FakeNode(tag)};
 globalThis.requestAnimationFrame=()=>1;
 globalThis.cancelAnimationFrame=()=>{};
 globalThis.performance={now:()=>1000};
 await import('../src/game.js');
 const $=id=>document.getElementById(id);
 assert.equal($('phaseTitle').textContent,'Choose your starting chassis');
 $('choices').children[0].onclick();
 assert.match($('phaseTitle').textContent,/draft/);
 assert.equal($('choices').children.length>=4,true);
 const choice=$('choices').children.find(x=>x.onclick);
 choice.onclick();
 assert.ok($('choices').children.some(x=>x.className==='draft-detail'));
 $('advance').onclick();
 assert.equal($('phaseTitle').textContent,'Combat in progress');
 for(let i=0;i<901&&$('phaseTitle').textContent==='Combat in progress';i++)$('step').onclick();
 assert.match($('phaseTitle').textContent,/complete/);
 assert.match($('results').textContent,/#1/);
 $('advance').onclick();
 assert.match($('phaseTitle').textContent,/draft/);
 const cards=$('choices').children.filter(x=>x.className.includes('draft-card'));
 assert.equal(cards.length,6);
 const claimed=cards.filter(x=>x.className.includes('claimed'));
 assert.ok(claimed.length>0,'Bots who pick before you should remain visible');
 for(const card of claimed){assert.equal(card.disabled,true);assert.ok(card.children.some(child=>child.className==='draft-owner'&&/^Bot [123]$/.test(child.textContent)),'Claimed card has a bot superscript')}
});
