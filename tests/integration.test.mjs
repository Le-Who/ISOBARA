import test from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../.test-build/core/progression.js';
import {Simulation} from '../.test-build/core/simulation.js';
import {envelope,unpack,validateState} from '../.test-build/core/validation.js';
import {migrate} from '../.test-build/core/migrate.js';

const home=()=>{const s=P.newGame(19320422,'lineman');s.shards=10000;return s;};
const loot=(s,id,options={})=>{const i=P.makeItem(27,2,'lineman',id,{slot:'instrument',...options});s.inventory.push(i);return i;};
const idle={mx:0,mz:0,ax:1,az:0,attack:false,skill:false,burst:false,dash:false,heal:false};

test('Loading an expedition cancels attacks whose telegraphs were not saved',()=>{
 const s=home(),sim=new Simulation(s),portal=sim.world.getPortal('main:1');
 sim.p.x=portal.x;sim.p.z=portal.z;assert.ok(sim.portalEnter(portal));
 const e=s.run.enemies[0];e.windup=.3;e.charge=-.6;e.timer=.1;
 const e2=s.run.enemies[1];e2.charge=.4;e2.windup=0;
 const loaded=unpack(envelope(s)),hp=loaded.run.enemies.map(e=>e.hp);
 const resumed=new Simulation(loaded);
 assert.equal(loaded.run.enemies[0].windup,0);assert.equal(loaded.run.enemies[0].charge,0);
 assert.equal(loaded.run.enemies[1].charge,0);assert.ok(loaded.run.enemies[0].timer>=.9);
 assert.deepEqual(loaded.run.enemies.map(e=>e.hp),hp);
 assert.equal(resumed.hazards.length,0);assert.doesNotThrow(()=>unpack(envelope(loaded)));
 assert.equal(s.run.enemies[0].windup,.3,'original snapshot is intact');
});

test('V2 saves migrate without losing encounters, equipment, or an active run',()=>{
 const s=home(),sim=new Simulation(s);sim.p.x=14;sim.p.z=5;sim.tick(1/60,idle);
 const enemy=sim.worldEnemies[0];assert.ok(enemy);enemy.hp=Math.max(1,enemy.hp-3);sim.flushEncounters();
 const resumed=new Simulation(s),portal=resumed.world.getPortal('main:1');resumed.p.x=portal.x;resumed.p.z=portal.z;assert.ok(resumed.portalEnter(portal));
 s.version=2;const original=structuredClone(s);assert.ok(Object.keys(s.encounters).length);
 const out=migrate(s);assert.equal(out.version,3);assert.equal(out.generator,2);assert.equal(out.rules,2);
 assert.deepEqual(s,original);assert.deepEqual(out.inventory,s.inventory);
 assert.deepEqual(out.encounters,s.encounters);assert.deepEqual(out.run,s.run);assert.doesNotThrow(()=>validateState(out));
 assert.throws(()=>migrate({...s,version:3,rules:3}),'unrelated revision formats must not be accepted');
});

test('Directed crafting charges once, produces the chosen slot and refuses invalid contexts',()=>{
 assert.equal(typeof P.craftSlot,'function');
 const s=home(),before=s.shards,item=P.craftSlot(s,'shell');
 assert.equal(item.slot,'shell');assert.equal(s.shards,before-P.craftSlotCost(1));
 assert.equal(s.inventory.filter(i=>i.id===item.id).length,1);
 const snap=structuredClone(s);assert.equal(P.craftSlot(s,'unknown'),null);assert.deepEqual(s,snap);
 s.player.x=20;assert.equal(P.craftSlot(s,'relic'),null);
 s.player.x=0;s.shards=0;assert.equal(P.craftSlot(s,'relic'),null);
});

test('Refit previews match paid stat changes, are capped, persist, and protect bulk salvage',()=>{
 assert.equal(typeof P.refitItem,'function');const s=home(),i=loot(s,'craft:19320422:1');i.rarity=1;
 for(let n=0;n<3;n++){
  const preview=P.refitPreview(i),before=i.damage,money=s.shards;
  assert.ok(P.refitItem(s,i.id));assert.equal(i.damage,before+preview.damage);assert.equal(s.shards,money-preview.cost);
 }
 const snap=structuredClone(s);assert.equal(P.refitItem(s,i.id),null);assert.deepEqual(s,snap);
 assert.equal(unpack(envelope(s)).inventory.find(x=>x.id===i.id).refit,3);
 assert.ok(!P.bulkPreview(s,2,'all').items.some(x=>x.id===i.id));
 const bad=structuredClone(s);bad.inventory[1].refit=4;assert.throws(()=>validateState(bad));
});

test('Retuning a rare item validates the effect and never charges for a no-op',()=>{
 assert.equal(typeof P.retuneItem,'function');const s=home(),i=loot(s,'run:19320422:main:2:1:boss-loot');i.rarity=3;i.effect='first';
 assert.ok(P.retuneItem(s,i.id,'battery'));const snap=structuredClone(s);
 assert.equal(P.retuneItem(s,i.id,'battery'),null);assert.equal(P.retuneItem(s,i.id,'constructor'),null);assert.deepEqual(s,snap);
 assert.equal(unpack(envelope(s)).inventory[1].effect,'battery');
});

test('Bulk salvage confirms an exact list across bag and mailbox, with stale preview protection',()=>{
 assert.equal(typeof P.bulkPreview,'function');const s=home();
 const a=loot(s,'craft:1:1');a.rarity=1;
 const b=loot(s,'craft:1:2');b.rarity=2;b.fav=true;
 const c=loot(s,'craft:1:3',{family:'inductor'});c.rarity=1;
 const d=loot(s,'craft:1:4');d.rarity=3;
 const m=P.makeItem(1,1,'lineman','cache:1:2:item',{slot:'shell'});m.rarity=1;s.mailbox.push(m);
 const preview=P.bulkPreview(s,2,'instrument');assert.deepEqual(preview.items.map(i=>i.id),[a.id]);
 a.fav=true;const snapshot=structuredClone(s);
 assert.equal(P.salvageBulk(s,preview),null);assert.deepEqual(s,snapshot);
 a.fav=false;const all=P.bulkPreview(s,2,'all'),money=s.shards;
 assert.deepEqual(new Set(all.items.map(i=>i.id)),new Set([a.id,m.id]));
 const result=P.salvageBulk(s,all);assert.equal(result.count,2);assert.equal(s.shards,money+all.shards);
 assert.equal(P.salvageBulk(s,all),null,'confirming twice must not duplicate parts');
 assert.ok(s.inventory.some(i=>i.id===c.id));assert.ok(s.inventory.some(i=>i.id===b.id));
});

test('A full valid storage cannot grow into an unloadable save or charge for failed crafting',()=>{
 const s=home();while(s.inventory.length<24)loot(s,`bag:${s.inventory.length}`);
 for(let n=0;n<2000;n++)s.mailbox.push(P.makeItem(n,1,'lineman',`mail:${n}`));
 const snap=structuredClone(s);assert.equal(P.craftItem(s),null);assert.deepEqual(s,snap);
 const incoming=P.makeItem(4,2,'lineman','cache:new:item'),money=s.shards;
 assert.equal(P.giveItem(s,incoming),'shards');assert.equal(s.shards,money+P.salvageValue(incoming));
 assert.equal(s.mailbox.length,2000);assert.doesNotThrow(()=>unpack(envelope(s)));
 const money2=s.shards;assert.equal(P.giveItem(s,s.mailbox[0]),false);assert.equal(s.shards,money2);
});
