// BAL-01: reproducible power-curve report. Uses the real Simulation with normal input frames only.
// For every class × tier × gear scenario it measures one combat node and the guardian of that tier:
// time to clear, damage taken, potions used and whether the bot died. Output: evidence/balance/integration-2.1/report.{json,md}.
// Run: node tools/build.mjs --test && node tools/balance-report.mjs
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {Simulation} from '../.test-build/core/simulation.js';
import {newGame,makeItem,equipItem,xpNeeded,stats} from '../.test-build/core/progression.js';
import {refitItem as tuneItem} from '../.test-build/core/progression.js';
import {FAMILIES,BASE_FAMILY,ALT_FAMILY} from '../.test-build/core/weapons.js';
import {canWalk,pathTo} from '../.test-build/world/navigation.js';
import {createHash} from 'node:crypto';
import os from 'node:os';
import {UPGRADES} from '../.test-build/core/content.js';
import {VERSION} from '../.test-build/core/content.js';
import {norm,dist} from '../.test-build/core/math.js';
import {lineClear} from '../.test-build/world/navigation.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dt=1/60,SEED=19320422;
const CLASSES=['lineman','harvester','aerologist'],TIERS=[1,2,3,4,5],SCENARIOS=['minimum','typical','strong'];
const xpForLevel=l=>{let x=0;for(let i=1;i<l;i++)x+=xpNeeded(i);return x;};
function prepare(cls,tier,scenario,family){
 const s=newGame(SEED,cls);s.player.xp=xpForLevel(Math.min(20,tier*2+(scenario==='strong'?2:scenario==='typical'?1:0)));s.stats.bestTier=tier;s.seals=[1,2,3,4,5].slice(0,tier-1);s.shards=5000;s.phase='world';s.inventory[0].family=family;
 if(scenario!=='minimum'){for(const slot of ['instrument','shell','relic']){const item=makeItem(tier*31+slot.length,tier,cls,`bal:${slot}`,{slot,family,bonus:scenario==='strong'?60:15,pity:scenario==='strong'});s.inventory.push(item);equipItem(s,item.id);if(scenario==='strong')for(let i=0;i<3;i++)tuneItem(s,item.id);}}
 const points=scenario==='minimum'?0:scenario==='typical'?tier*2:tier*3+2;const pool=UPGRADES.filter(u=>u.minTier<=tier&&(!u.classId||u.classId===cls)&&u.kind==='stat');let k=0;
 for(let i=0;i<points;i++){for(let tries=0;tries<pool.length;tries++){const u=pool[(k++)%pool.length];if((s.upgrades[u.id]??0)<u.max){s.upgrades[u.id]=(s.upgrades[u.id]??0)+1;break;}}}
 return s;
}
function bot(sim,targets,maxSeconds){
 let damage=0,potions=0,t=0,hits=0,activeTicks=0,basicAttempts=0,outOfRangeAttempts=0;const p=sim.p,initialPatterns=targets.reduce((sum,e)=>sum+e.pattern,0);
 for(;t<maxSeconds;t+=dt){
  const alive=targets.filter(e=>!e.dead);if(!alive.length)break;if(sim.state.phase!=='expedition')break;
  const target=alive.sort((a,b)=>dist(p,a)-dist(p,b))[0],d=dist(p,target),st=sim.st,desired=Math.max(.8,Math.min(p.classId==='harvester'?2.4:8.5,st.range*.7));
  const aim=norm(target.x-p.x,target.z-p.z);let direction={x:0,z:0},dash=false;
  if(d>desired+.5)direction=aim;else if(d<desired-.5)direction={x:-aim.x,z:-aim.z};else{const sign=Math.floor(t/6)%2?1:-1;direction={x:-aim.z*sign,z:aim.x*sign};}
  for(const h of sim.hazards){if(!h.enemy||h.damage===0||h.delay>.4)continue;let danger=false,avoid=null;
   if(h.kind==='line'){const a={x:p.x-h.x,z:p.z-h.z},along=a.x*h.dx+a.z*h.dz,side=a.x*(-h.dz)+a.z*h.dx;if(along>-1&&along<h.length+1&&Math.abs(side)<h.radius+1){danger=true;avoid={x:-h.dz*(side>=0?1:-1),z:h.dx*(side>=0?1:-1)};}}
   else if(h.kind==='ring'){if(h.delay<=0&&Math.abs(dist(p,h)-h.radius)<2){danger=true;avoid=norm(p.x-h.x,p.z-h.z);}}
   else if(dist(p,h)<h.radius+1){danger=true;avoid=norm(p.x-h.x,p.z-h.z);if(!avoid.x&&!avoid.z)avoid={x:-aim.x,z:-aim.z};}
   if(danger){direction=avoid;dash=h.delay<.18;break;}}
  if(target.windup>0&&target.windup<.25&&d<3.5){direction={x:-aim.x,z:-aim.z};dash=true;}
  const visible=lineClear(sim.layout,p,target,.14);if(!lineClear(sim.layout,p,target,.55)){const route=pathTo(sim.layout.nav,p,target);const point=route.find(v=>dist(v,p)>.65);if(point)direction=norm(point.x-p.x,point.z-p.z);}
  if(alive.some(e=>dist(e,p)<25))activeTicks++;
  const frame={mx:direction.x,mz:direction.z,ax:aim.x,az:aim.z,aimDistance:Math.min(d,11),attack:visible,skill:visible&&p.energy>=25&&p.cooldowns.skill<=0,burst:visible&&p.energy>=45&&p.cooldowns.burst<=0&&d<9,dash,heal:p.hp/st.hp<.5&&p.potions>0};
  // Accepted input requests, including the cooldown decrement at the start of tick.
  // Outside nominal range is not a proven miss (projectiles and targets can move).
  if(frame.attack&&p.cooldowns.attack<=dt){basicAttempts++;if(d>st.range)outOfRangeAttempts++;}
  const pot=p.potions;sim.tick(dt,frame);for(const e of sim.drain()){if(e.type==='warning'&&e.value)damage+=e.value;if(e.type==='hit')hits++;}if(p.potions<pot)potions++;
 }
 return {activeTicks,basicAttempts,outOfRangeAttempts,bossPatterns:targets.reduce((sum,e)=>sum+e.pattern,0)-initialPatterns,seconds:Number(t.toFixed(1)),damage:Math.round(damage),potions,hits,dead:sim.state.phase==='dead',cleared:targets.every(e=>e.dead)};
}
function measure(cls,tier,scenario,family){
 const s=prepare(cls,tier,scenario,family),sim=new Simulation(s),portal=sim.world.getPortal(`main:${tier}`);sim.p.x=portal.x;sim.p.z=portal.z;if(!sim.portalEnter(portal))throw new Error('portal');sim.drain();
 const run=s.run,l=sim.layout,st=stats(s);
 // Node: the first required combat room, isolated (other machines already stabilized).
 const room=l.rooms.filter(r=>r.role==='combat').sort((a,b)=>a.id-b.id)[0],node=run.enemies.filter(e=>e.room===room.id);
 for(const e of run.enemies)if(e.kind!=='boss'&&e.room!==room.id){e.dead=true;e.hp=0;}
 const candidates=[];for(let x=room.x-room.w/2+2;x<room.x+room.w/2-2;x+=1)for(let z=room.z-room.d/2+2;z<room.z+room.d/2-2;z+=1)if(canWalk(l,x,z,.46)&&node.every(e=>dist(e,{x,z})>=3))candidates.push({x,z});const start=candidates.sort((a,b)=>dist(a,l.entry)-dist(b,l.entry))[0];if(!start)throw new Error('No separated node start');if(!canWalk(l,start.x,start.z,.46))throw new Error('Unwalkable fixture');sim.p.x=start.x;sim.p.z=start.z;const nodeResult=bot(sim,node,120);
 // Guardian: same hero, restored, all objectives done.
 const s2=prepare(cls,tier,scenario,family),sim2=new Simulation(s2);sim2.p.x=portal.x;sim2.p.z=portal.z;sim2.portalEnter(portal);sim2.drain();
 for(const e of s2.run.enemies)if(e.kind!=='boss'){e.dead=true;e.hp=0;}
 const boss=s2.run.enemies.find(e=>e.kind==='boss'),arena=sim2.layout.rooms[boss.room];sim2.p.x=arena.x-9;sim2.p.z=arena.z;if(!canWalk(sim2.layout,sim2.p.x,sim2.p.z,.46))throw new Error('Unwalkable boss fixture');const bossResult=bot(sim2,[boss],300);if(!nodeResult.activeTicks||!bossResult.activeTicks)throw new Error('Inactive workload');
 return {classId:cls,family,tier,scenario,level:st.level,damage:Number(st.damage.toFixed(1)),hp:st.hp,armor:Number(st.armor.toFixed(3)),attacksPerSecond:Number((1/st.attackTime).toFixed(2)),nodeSize:node.length,nodeKinds:node.map(e=>e.kind).join('+'),node:nodeResult,boss:{...bossResult,name:boss.boss}};
}
const rows=[];for(const cls of CLASSES)for(const tier of TIERS)for(const scenario of SCENARIOS)for(const family of [BASE_FAMILY[cls],ALT_FAMILY[cls]]){const r=measure(cls,tier,scenario,family);rows.push(r);console.log(`${cls}/${family} T${tier} ${scenario}: node ${r.node.seconds}s (dmg ${r.node.damage}, ${r.node.dead?'DEAD':r.node.cleared?'ok':'timeout'}) · boss ${r.boss.seconds}s (dmg ${r.boss.damage}, ${r.boss.dead?'DEAD':r.boss.cleared?'ok':'timeout'})`);}
const sourceFiles=['src/core/simulation.ts','src/core/progression.ts','src/core/content.ts','src/core/weapons.ts','src/world/dungeon.ts','tools/balance-report.mjs'];
const summary={environment:{node:process.version,os:os.platform(),arch:os.arch(),cpu:os.cpus()[0]?.model},sourceSHA256:Object.fromEntries(sourceFiles.map(p=>[p,createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex')])),compiledSHA256:Object.fromEntries(sourceFiles.filter(p=>p.startsWith('src/')).map(p=>{const file=p.replace('src/','.test-build/').replace('.ts','.js');return [file,createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')];})),version:VERSION,seed:SEED,generated:new Date().toISOString(),method:'Synthetic controlled fixtures (not earned campaign builds); explicit placement and removal of other enemies before trial; normal input frames only during each trial, fixed 60 Hz step; node = first required combat room in isolation; guardian = arena with all objectives done. Bot skill is limited: numbers describe a baseline, not optimal play.',scenarios:{minimum:'starter instrument, no upgrades, level 2×tier',typical:'three crafted items of the tier (+15 rarity bonus), 2×tier stat ranks, level 2×tier+1',strong:'three generated items (+60 rarity bonus / rare pity), refit ×3; actual rarity is not overwritten, 3×tier+2 stat ranks, level 2×tier+2'},rows};
fs.mkdirSync(path.join(root,'evidence/balance/integration-2.1'),{recursive:true});fs.writeFileSync(path.join(root,'evidence/balance/integration-2.1/report.json'),JSON.stringify(summary,null,1));
const md=['# Отчёт баланса (BAL-01) · ИЗОБАРА '+VERSION,'',`Сгенерировано: ${summary.generated}. Зерно ${SEED}. ${summary.method}`,'','| Класс / семейство | Ранг | Сценарий | Ур. | Урон | HP | Узел (с) | Урон получен | Смерть | Хранитель (с) | Урон получен | Смерть |','|---|---|---|---|---|---|---|---|---|---|---|---|',...rows.map(r=>`| ${r.classId} / ${r.family} | ${r.tier} | ${r.scenario} | ${r.level} | ${r.damage} | ${r.hp} | ${r.node.cleared?r.node.seconds:'—'} | ${r.node.damage} | ${r.node.dead?'да':'нет'} | ${r.boss.cleared?r.boss.seconds:'—'} | ${r.boss.damage} | ${r.boss.dead?'да':'нет'} |`),'','Сценарии: '+Object.entries(summary.scenarios).map(([k,v])=>`**${k}** — ${v}`).join('; ')+'.',''].join('\n');
fs.writeFileSync(path.join(root,'evidence/balance/integration-2.1/report.md'),md);console.log('Written evidence/balance/integration-2.1/report.json and report.md');
