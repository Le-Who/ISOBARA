import test from 'node:test';import assert from 'node:assert/strict';
import {newGame,stats,levelInfo,makeItem,craftFamily,enemyNumbers,xpNeeded,compareItem,favorite,salvage,equipItem} from '../.test-build/core/progression.js';
import {World,generateChunk} from '../.test-build/world/world.js';
import {NPC_SPOTS,fixedEncounters,SAFE_RADIUS,unitPositions} from '../.test-build/world/encounters.js';
import {Simulation} from '../.test-build/core/simulation.js';
import {envelope,unpack,validateState} from '../.test-build/core/validation.js';
import {migrate,convertXp} from '../.test-build/core/migrate.js';
import {talk,choose} from '../.test-build/core/dialogue.js';
import {FAMILIES,ALT_FAMILY,BASE_FAMILY,itemIcon,SKILLS} from '../.test-build/core/weapons.js';
import {RANKS,rankDef} from '../.test-build/core/ranks.js';
import {Kit} from '../.test-build/render/models.js';
import {dist} from '../.test-build/core/math.js';
const IN={mx:0,mz:0,ax:0,az:-1,attack:false,skill:false,burst:false,dash:false,heal:false};
const spawnNear=(sim,x,z)=>{sim.p.x=x;sim.p.z=z;sim.tick(1/60,IN);};
const clone=x=>JSON.parse(JSON.stringify(x));
const road=sim=>sim.worldEnemies.filter(e=>e.id.startsWith('enc:road:'));
test('Alternative instruments and skills have distinct art, including imported v2 items',()=>{
 for(const cls of ['lineman','harvester','aerologist']){
  const alt=ALT_FAMILY[cls],base=BASE_FAMILY[cls];
  assert.notEqual(FAMILIES[alt].icon,FAMILIES[base].icon);
  assert.notEqual(SKILLS[cls].alt.icon,SKILLS[cls].default.icon);
  const item=makeItem(27,2,cls,`visual:${cls}`,{family:alt,slot:'instrument'});
  assert.equal(item.icon,FAMILIES[alt].icon);
  const old=clone(newGame(27,cls));old.inventory[0].family=alt;
  assert.doesNotThrow(()=>validateState(clone(old)));
  assert.equal(itemIcon(old.inventory[0]),FAMILIES[alt].icon);
 }
});
test('Alternate tools, NPCs and encounter marks construct as distinct 3D models',()=>{
 const kit=new Kit();
 for(const [cls,base,alt] of [['lineman','impulser','inductor'],['harvester','tuning','strippers'],['aerologist','sower','discs']]){
  const a=kit.player(cls,base),b=kit.player(cls,alt);
  assert.notEqual(a.userData.tool.children.length,b.userData.tool.children.length,`${cls}: distinct equipped shape`);
  kit.release(a);kit.release(b);
 }
 for(const id of ['irma','sa7','lea']){const actor=kit.npc(id);assert.ok(actor.children.length>5,id);kit.release(actor);}
 for(const kind of ['patrol','meteo','named']){const mark=kit.beacon(kind);assert.ok(mark.userData.lamp,kind);kit.release(mark);}
 const elite=kit.enemy('ram',undefined,true);assert.ok(elite.children.length>5);kit.release(elite);kit.dispose();
});
test('Save migration leaves the source untouched and rejects unknown generator and rules versions',()=>{
 const current=newGame(42,'lineman');
 const old=clone(current);old.version=1;old.generator=1;delete old.rules;
 for(const key of ['encounters','npcs','loadout','blueprints','rank'])delete old[key];
 old.player.xp=145;
 const before=clone(old),converted=validateState(old);
 assert.deepEqual(old,before,'a successful import must not mutate the source');
 assert.equal(converted.version,3);
 assert.equal(converted.generator,2);
 assert.equal(converted.rules,2);
 assert.equal(levelInfo(converted.player.xp).level,2);
 const archived=clone(current);archived.version=2;archived.generator=1;delete archived.rules;const archivedBefore=clone(archived);
 assert.equal(validateState(archived).generator,2,'the other candidate release remains importable');
 assert.deepEqual(archived,archivedBefore,'archived import is not changed in place');
 for(const patch of [{generator:99},{rules:99},{version:99}]){
  const bad={...clone(current),...patch},original=clone(bad);
  assert.throws(()=>validateState(bad));
  assert.deepEqual(bad,original,'an incompatible source must remain intact');
 }
 const capped=clone(old);capped.player.xp=20_000_000;
 assert.equal(validateState(capped).player.xp,20_000_000,'maximum valid legacy XP remains importable');
});
test('Encounter records must belong to the seed and match their immutable roster',()=>{
 const s=newGame(5,'lineman');
 s.encounters['e:8:8']={done:true,disabled:false,hp:[]};
 assert.throws(()=>validateState(clone(s)));
 delete s.encounters['e:8:8'];
 s.encounters.road={done:false,disabled:false,hp:[1]};
 assert.throws(()=>validateState(clone(s)));
});
test('A named elite at its rounded maximum health remains a valid saved encounter',()=>{
 const seed=19,world=new World(seed),s=newGame(seed,'lineman');let found;
 for(let cx=-5;cx<=5&&!found;cx++)for(let cz=-5;cz<=5&&!found;cz++){
  found=world.chunk(cx,cz).encounters.find(e=>e.kind==='named'&&[1,3].includes(enemyNumbers(e.units[0],e.tier).hp%5));
 }
 assert.ok(found,'test seed must include an elite whose multiplier rounds upward');
 s.encounters[found.id]={done:false,disabled:false,hp:found.units.map((u,i)=>i===0?Math.round(enemyNumbers(u,found.tier).hp*2.6):enemyNumbers(u,found.tier).hp)};
 assert.doesNotThrow(()=>validateState(clone(s)));
});
test('v1 save migrates to current format: level, items and progress preserved; new fields defaulted',()=>{
 const s=clone(newGame(7,'harvester'));s.player.xp=1200;const level=levelInfo(1200).level;s.seals=[1];
 // build a v1 document as the previous release wrote it
 const v1=clone(s);v1.version=1;v1.generator=1;delete v1.rules;for(const k of ['encounters','npcs','loadout','blueprints','rank'])delete v1[k];
 const old=(l)=>60+l*35;let lv=1,left=1200;while(lv<20&&left>=old(lv)){left-=old(lv);lv++;}v1.player.xp=1200;
 const migrated=validateState(clone(v1));assert.equal(migrated.version,3);assert.deepEqual(migrated.encounters,{});assert.equal(migrated.loadout.skill,'default');
 assert.equal(levelInfo(migrated.player.xp).level,lv,'level is kept');assert.deepEqual(migrated.seals,[1]);assert.equal(migrated.inventory.length,1);
 const again=validateState(clone(migrated));assert.equal(levelInfo(again.player.xp).level,lv,'migration is idempotent');
 assert.ok(convertXp(0)===0);
 const packed=envelope(migrated);assert.equal(unpack(packed).version,3);
});
test('BAL: early levels arrive faster, middle levels slower than v1',()=>{
 assert.ok(xpNeeded(1)<95&&xpNeeded(5)<235);assert.equal(xpNeeded(6),270);assert.ok(xpNeeded(12)>60+12*35);
 let last=0;for(let l=1;l<20;l++){assert.ok(xpNeeded(l)>=last);last=xpNeeded(l);}
});
test('Fixed encounter, device, NPC spots are walkable and outside the safe zone; chunk generation stays deterministic',()=>{
 for(let seed=0;seed<60;seed++){const w=new World(seed),e=fixedEncounters(seed)[0];
  assert.ok(dist(e,{x:0,z:0})>SAFE_RADIUS+3);assert.ok(w.canWalk(e.device.x,e.device.z,.5),'device reachable seed '+seed);
  for(const p of unitPositions(e,(x,z,r)=>w.canWalk(x,z,r)))assert.ok(w.canWalk(p.x,p.z,.6),'unit spot walkable seed '+seed);
  for(const [id,p] of Object.entries(NPC_SPOTS))assert.ok(w.canWalk(p.x,p.z,.6),`npc ${id} walkable seed ${seed}`);
  assert.deepEqual(generateChunk(seed,1,-1),generateChunk(seed,1,-1));assert.ok(w.encounter('road'));
  assert.ok(dist(e,{x:14,z:5})<.1);
 }
 // random encounters exist and are distributed away from the station
 let count=0,kinds=new Set();for(let cx=-6;cx<=6;cx++)for(let cz=-6;cz<=6;cz++)for(const e of generateChunk(11,cx,cz).encounters){if(!e.fixed){count++;kinds.add(e.kind);assert.ok(Math.hypot(e.x,e.z)>=38);assert.equal(new World(11).encounter(e.id).id,e.id);}}
 assert.ok(count>=15,'enough encounters: '+count);assert.ok(kinds.size>=2);
});
test('Generated patrol switches remain reachable across chunk boundaries',()=>{
 for(let seed=0;seed<40;seed++){
  const world=new World(seed);
  for(let cx=-7;cx<=7;cx++)for(let cz=-7;cz<=7;cz++)for(const enc of world.chunk(cx,cz).encounters){
   if(enc.device)assert.ok(world.canWalk(enc.device.x,enc.device.z,.5),`blocked switch in ${enc.id}, seed ${seed}`);
  }
 }
});
test('Overworld combat: sleeping patrol wakes, fights, is defeated once and rewards are not duplicated',()=>{
 const s=newGame(19320422,'lineman'),sim=new Simulation(s);spawnNear(sim,14,20);
 assert.equal(road(sim).length,3,'road patrol instantiated');assert.ok(!sim.inCombat(),'far away: asleep');
 spawnNear(sim,14,12.4);assert.ok(road(sim).some(e=>sim.awake.has(e.id)),'aggro when close');assert.ok(sim.inCombat());
 assert.equal(sim.goHome(),false,'no free teleport under attack');
 sim.p.hp=sim.st.hp;const shardsBefore=s.shards;
 for(const e of road(sim))sim.hitEnemy(e,99999,true);
 assert.ok(s.encounters.road.done&&!s.encounters.road.disabled);assert.equal(s.shards,shardsBefore+12);
 const inv=s.inventory.length+s.mailbox.length,shards=s.shards;
 sim.completeEncounter(sim.spawned.get('road'),'kill');sim.completeEncounter(sim.spawned.get('road'),'disable');
 assert.equal(s.shards,shards);assert.equal(s.inventory.length+s.mailbox.length,inv);
 sim.releaseWorldEnemies();spawnNear(sim,14,20);assert.equal(road(sim).length,0,'finished encounter never respawns');
 validateState(clone(s));
});
test('Power node disables a patrol peacefully, once',()=>{
 const s=newGame(5,'aerologist'),sim=new Simulation(s);spawnNear(sim,20,30);assert.equal(road(sim).length,3);
 assert.equal(sim.useDevice('road'),false,'must be near the node');
 sim.p.x=6;sim.p.z=13;sim.tick(1/60,IN);const t=sim.interactable();assert.equal(t?.kind,'device');
 assert.ok(sim.useDevice('road'));assert.ok(s.encounters.road.disabled&&s.encounters.road.done);assert.equal(s.shards,6);assert.ok(road(sim).every(e=>e.dead));
 assert.equal(sim.useDevice('road'),false);assert.equal(s.shards,6);validateState(clone(s));
});
test('Damage progress in an encounter survives save/load; leash retreat resets it',()=>{
 const s=newGame(9,'harvester'),sim=new Simulation(s);spawnNear(sim,14,20);const first=road(sim)[0];sim.hitEnemy(first,first.maxHp*.5,true);
 const hp=first.hp;sim.flushEncounters();assert.ok(s.encounters.road&&s.encounters.road.hp[0]===Math.round(hp),'live damage mirrored to the save');
 const loaded=new Simulation(unpack(envelope(s)));loaded.p.x=14;loaded.p.z=22;loaded.tick(1/60,IN);
 assert.equal(Math.round(road(loaded)[0].hp),Math.round(hp),'damage retained after reload');assert.equal(road(loaded).length,3);
 sim.p.x=-120;sim.p.z=0;for(let i=0;i<40;i++)sim.tick(1/60,IN);
 assert.equal(road(sim).length,0,'unloaded far away');assert.equal(s.encounters.road,undefined,'retreat resets the encounter');
});
test('A nearly defeated living world enemy remains alive after saving',()=>{
 const s=newGame(15,'lineman'),sim=new Simulation(s);
 spawnNear(sim,14,20);
 const enemy=road(sim)[0];enemy.hp=.4;
 sim.flushEncounters();
 assert.equal(s.encounters.road.hp[0],1);
 const restored=new Simulation(unpack(envelope(s)));
 spawnNear(restored,14,20);
 assert.ok(road(restored)[0].hp>0);
});
test('Favorited equipment survives save and cannot be salvaged until unmarked',()=>{
 const s=newGame(77,'lineman'),item=makeItem(8,2,'lineman','keep',{slot:'shell'});
 s.inventory.push(item);
 assert.ok(favorite(s,item.id));
 assert.equal(item.fav,true);
 assert.equal(salvage(s,item.id),false);
 const loaded=unpack(envelope(s));
 assert.equal(loaded.inventory.find(i=>i.id===item.id).fav,true);
 assert.ok(favorite(loaded,item.id));
 assert.ok(salvage(loaded,item.id));
 assert.ok(!loaded.inventory.some(i=>i.id===item.id));
 const invalid=clone(s);invalid.inventory.find(i=>i.id===item.id).fav='yes';
 assert.throws(()=>validateState(invalid));
});
test('Equipment preview matches actual totals, including mailbox items and shared effects',()=>{
 const s=newGame(88,'harvester'),equipped=makeItem(1,2,'harvester','worn',{slot:'shell'});
 equipped.effect='battery';equipped.rarity=3;
 s.inventory.push(equipped);assert.ok(equipItem(s,equipped.id));
 const relic=makeItem(2,2,'harvester','relic',{slot:'relic'});relic.effect='battery';relic.rarity=3;
 s.inventory.push(relic);assert.ok(equipItem(s,relic.id));
 const candidate=makeItem(3,3,'harvester','stored',{slot:'shell'});
 candidate.effect='barrier';candidate.rarity=3;s.mailbox.push(candidate);
 const before=stats(s),preview=compareItem(s,candidate);
 assert.equal(preview.lost,null,'battery remains active through the relic');
 assert.equal(preview.gained,'barrier');
 s.inventory.push(s.mailbox.shift());assert.ok(equipItem(s,candidate.id));
 const after=stats(s);
 for(const [label,actual] of [['Урон',after.damage-before.damage],['Здоровье',after.hp-before.hp],['Броня',(after.armor-before.armor)*100],['Крит',(after.crit-before.crit)*100],['Дальность',after.range-before.range],['Скорость',after.speed-before.speed],['Заряд',after.energyRegen-before.energyRegen]]){
  const row=preview.rows.find(r=>r.label===label);
  if(Math.abs(actual)>1e-9)assert.ok(row&&Math.abs(row.delta-actual)<1e-9,`${label} differs from actual equip`);
 }
});
test('World death returns to the station, keeps progress, and never creates a run-less dead phase',()=>{
 const s=newGame(3,'lineman'),sim=new Simulation(s);spawnNear(sim,14,12.4);const xp=s.player.xp;s.player.xp+=10;
 sim.damagePlayer(1e6,{x:14,z:10});
 assert.equal(s.phase,'world');assert.equal(s.stats.deaths,1);assert.ok(dist(sim.p,{x:0,z:0})<6);assert.ok(sim.p.hp>0);assert.equal(s.player.xp,xp+10);
 assert.ok(!sim.inCombat(),'encounter reset');assert.ok(sim.worldEnemies.every(e=>!e.dead&&e.hp===e.maxHp));validateState(clone(s));
});
test('Safe zone: nothing attacks or wakes near the station',()=>{
 const s=newGame(4,'lineman'),sim=new Simulation(s);spawnNear(sim,14,12.4);spawnNear(sim,2,4);
 for(let i=0;i<120;i++)sim.tick(1/60,IN);assert.ok(!sim.inCombat());const hp=sim.p.hp;sim.damagePlayer(50,{x:2,z:4});assert.equal(sim.p.hp,hp);
});
test('Entering a rift is refused under attack and suspends encounters otherwise',()=>{
 const s=newGame(6,'lineman'),sim=new Simulation(s),portal=sim.world.getPortal('main:1');
 spawnNear(sim,14,12.4);sim.p.x=portal.x-1;sim.p.z=portal.z+3;sim.p.lastDamage=s.stats.seconds+.01;
 assert.equal(sim.portalEnter(portal),false);s.stats.seconds+=6;
 sim.awake.clear();assert.ok(sim.portalEnter(portal));assert.equal(sim.worldEnemies.length,0);assert.equal(s.phase,'expedition');validateState(clone(s),false);
});
const arena=(seed)=>{const w=new World(seed);for(let x=30;x<120;x+=3)for(let z=-100;z<-30;z+=3){let ok=true;for(let dz=0;dz<=12&&ok;dz+=.5)for(const dx of [-1.5,0,1.5])if(!w.canWalk(x+dx,z-dz,.7))ok=false;if(ok&&Math.hypot(x,z)>60)return {x,z:z};}throw new Error('no arena');};
const dummy=(id,x,z,kind='mite')=>({id,kind,room:0,x,z,hp:9e4,maxHp:9e4,timer:99,windup:0,pattern:0,tx:0,tz:0,dx:0,dz:1,stun:0,charge:0,dead:false,homeX:x,homeZ:z});
const place=(sim,seed)=>{const a=arena(seed);sim.p.x=a.x;sim.p.z=a.z;sim.p.faceX=0;sim.p.faceZ=-1;sim.tick(1/60,IN);sim.worldEnemies.length=0;return a;};
test('Weapon families: alt instruments change the attack shape for every class',()=>{
 for(const [cls,fam] of Object.entries(ALT_FAMILY)){
  const s=newGame(21,cls),sim=new Simulation(s);s.blueprints.push(fam);
  const item=makeItem(1,1,cls,'t:fam',{slot:'instrument',family:fam});s.inventory.push(item);s.equipment.instrument=item.id;assert.equal(stats(s).family,fam);
  assert.notEqual(stats(s).attackTime,stats({...s,equipment:{}}).attackTime);validateState(clone(s));
  const a=place(sim,21),target=dummy('dummy',a.x,a.z-(cls==='lineman'?3:cls==='harvester'?1.8:9));sim.worldEnemies.push(target);
  for(let i=0;i<240&&target.hp===9e4;i++)sim.tick(1/60,{...IN,ax:0,az:-1,attack:true});
  assert.ok(target.hp<9e4,`${fam} hit the target`);
 }
 assert.throws(()=>{const s=newGame(1,'lineman');s.inventory.push(makeItem(1,1,'lineman','x',{slot:'instrument',family:'discs'}));validateState(clone(s));});
});
test('Strippers combo: third strike is a finisher with stun; discs return and hit twice',()=>{
 let s=newGame(8,'harvester'),sim=new Simulation(s);let it=makeItem(2,1,'harvester','t:s',{slot:'instrument',family:'strippers'});s.inventory.push(it);s.equipment.instrument=it.id;
 let a=place(sim,8);const t=dummy('w1',a.x,a.z-1.6,'warden');sim.worldEnemies.push(t);const hits=[];let prev=t.hp,swings=0,stun=0;
 for(let i=0;i<600&&swings<3;i++){sim.tick(1/60,{...IN,attack:true,az:-1});if(t.hp<prev){hits.push(prev-t.hp);prev=t.hp;swings++;stun=Math.max(stun,t.stun);}}
 assert.equal(hits.length,3);assert.ok(hits[2]>hits[0]*2,'finisher is much stronger');assert.ok(stun>0.2);assert.ok(sim.drain().some(e=>e.visual==='finisher'));
 s=newGame(8,'aerologist');sim=new Simulation(s);it=makeItem(2,1,'aerologist','t:d',{slot:'instrument',family:'discs'});s.inventory.push(it);s.equipment.instrument=it.id;
 a=place(sim,8);const d=dummy('d1',a.x,a.z-8);sim.worldEnemies.push(d);let count=0;prev=d.hp;
 sim.tick(1/60,{...IN,attack:true,az:-1});for(let i=0;i<260;i++){sim.tick(1/60,IN);if(d.hp<prev){count++;prev=d.hp;}}
 assert.ok(count>=2,'disc hit outbound and on return: '+count);
});
test('Alternative skills exist for each class and require teaching',()=>{
 for(const cls of ['lineman','harvester','aerologist']){
  const s=newGame(30,cls),sim=new Simulation(s);s.loadout.skill='alt';const a=place(sim,30);const t=dummy('s1',a.x,a.z-6,'warden');sim.worldEnemies.push(t);
  const lineHazard=()=>sim.hazards.some(h=>h.kind==='line'&&!h.enemy);
  sim.tick(1/60,{...IN,skill:true});assert.ok(!lineHazard(),`${cls}: alt skill is locked until taught`);for(let i=0;i<40;i++)sim.tick(1/60,IN);assert.equal(t.z,a.z-6);
  sim.drain();s.npcs.irma={met:true,heard:['taught']};sim.p.cooldowns.skill=0;sim.p.energy=100;sim.tick(1/60,{...IN,skill:true});
  assert.ok(sim.drain().some(e=>e.visual===({lineman:'lance',harvester:'anchor',aerologist:'gust'})[cls]),`${cls}: unique skill visual`);
  if(cls==='harvester')assert.ok(t.z>a.z-6,'anchor pulls the enemy closer');else assert.ok(lineHazard(),`${cls} alt skill is a line`);
  for(let i=0;i<40;i++)sim.tick(1/60,IN);assert.ok(t.hp<9e4,`${cls} alt skill damaged the target`);validateState(clone(s));
 }
});
test('NPC dialogue: state-driven, rewards are one-time, memory persists in saves',()=>{
 const s=newGame(12,'lineman');let v=talk(s,'irma');assert.ok(v.lines.length>=2&&s.npcs.irma.met);
 assert.ok(v.choices.find(c=>c.id==='blueprint').disabled,'blueprint needs the patrol repaired');
 choose(s,'irma','blueprint');assert.equal(s.blueprints.length,0);
 s.encounters.road={done:true,disabled:true,hp:[]};v=talk(s,'irma');assert.ok(!v.choices.find(c=>c.id==='blueprint').disabled);
 const before=s.inventory.length;v=choose(s,'irma','blueprint');assert.deepEqual(s.blueprints,['inductor']);assert.equal(s.inventory.length,before+1);assert.equal(s.inventory.at(-1).family,'inductor');
 choose(s,'irma','blueprint');assert.equal(s.inventory.length,before+1,'no second item');
 assert.ok(talk(s,'irma').choices.find(c=>c.id==='teach').disabled,'level 3 needed');s.player.xp=400;choose(s,'irma','teach');assert.ok(s.npcs.irma.heard.includes('taught'));
 const sh=s.shards;choose(s,'sa7','gift');choose(s,'sa7','gift');assert.equal(s.shards,sh+15);
 choose(s,'lea','record');assert.equal(s.shards,sh+15,'needs a seal');s.seals=[1];choose(s,'lea','record');choose(s,'lea','record');assert.equal(s.shards,sh+25);
 for(let i=0;i<12;i++)choose(s,'lea','lore');assert.ok(s.npcs.lea.heard.length<=40);
 validateState(clone(s));assert.equal(unpack(envelope(s)).npcs.irma.heard.includes('taught'),true);
 const fam=craftFamily(s,'inductor');assert.equal(fam,null,'workshop needs the hero at home and shards');s.shards=200;s.player.x=1.5;s.player.z=4;const item=craftFamily(s,'inductor');assert.equal(item.family,'inductor');assert.equal(craftFamily(s,'impulser'),null);
});
test('Forecast ranks: unlocked only after the final, scale enemies and rewards, validated',()=>{
 const s=newGame(40,'lineman'),sim=new Simulation(s);assert.equal(sim.setRank(2),false);assert.equal(sim.allowedRank(),0);
 s.finalCleared=true;assert.ok(sim.setRank(1));assert.equal(s.rank.selected,1);assert.equal(sim.setRank(3),true);assert.equal(s.rank.selected,1,'cannot skip ranks');
 assert.ok(enemyNumbers('mite',3,undefined,2).hp>enemyNumbers('mite',3).hp);assert.ok(enemyNumbers('boss',2,'herdsman',5).damage>enemyNumbers('boss',2,'herdsman').damage);
 assert.equal(rankDef(99).name,RANKS.at(-1).name);
 const portal=sim.world.getPortal('main:1');sim.p.x=portal.x;sim.p.z=portal.z+3;assert.ok(sim.portalEnter(portal));assert.equal(s.run.rank,1);
 const e=s.run.enemies[0];assert.equal(e.maxHp,enemyNumbers(e.kind,1,e.boss,1).hp);validateState(clone(s),true);
 const bad=clone(s);bad.rank.selected=5;assert.throws(()=>validateState(bad));
});
test('Momentum: consecutive kills speed up attacks and refund energy',()=>{
 const s=newGame(50,'lineman'),sim=new Simulation(s);spawnNear(sim,14,20);s.player.energy=10;sim.p.energy=10;
 for(const e of road(sim).slice(0,2))sim.hitEnemy(e,99999,true);assert.equal(sim.momentum,2);assert.ok(sim.p.energy>=20);
});
