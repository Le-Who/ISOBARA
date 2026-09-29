import type {GameState,Portal,Vec,InputFrame,Stats,Enemy,Layout,Projectile,Hazard,GameEvent,Poi,Encounter} from './types.js';
import {World,CHUNK} from '../world/world.js';
import {generateDungeon} from '../world/dungeon.js';
import {canWalk,move,lineClear,flowField,nextOnFlow,nearestIndex,navPoint,pathTo} from '../world/navigation.js';
import {stats,levelInfo,restorePlayer,instantiateEnemies,enemyNumbers,createReward,applyReward,makeItem,giveItem,salvageValue} from './progression.js';
import {RNG,hash,clamp,norm,dist,segmentDistance} from './math.js';
import {CLASSES,BOSSES,LORE} from './content.js';
import {SAFE_RADIUS,AGGRO_RADIUS,LEASH_RADIUS,SPAWN_RADIUS,NPC_SPOTS,unitPositions} from '../world/encounters.js';
import {SKILLS,ALT_FAMILY} from './weapons.js';
import {talk,choose,NPCS,type DialogueView} from './dialogue.js';
import {rankDef,MAX_RANK} from './ranks.js';
/** PACE-01: enemy recovery between attacks is 8% shorter; telegraphs (windups) are never shortened. */
const PACE=.92;
type Interact={kind:'portal'|'poi'|'exit'|'rest'|'npc'|'device';data:any;distance:number};
const EMPTY:InputFrame={mx:0,mz:0,ax:0,az:-1,attack:false,skill:false,burst:false,dash:false,heal:false};
export class Simulation {
 state:GameState;world:World;layout:Layout|null=null;events:GameEvent[]=[];projectiles:Projectile[]=[];hazards:Hazard[]=[];
 time=0;private seq=1;private rng:RNG;private attackQueue:{time:number;ax:number;az:number}[]=[];
 worldEnemies:Enemy[]=[];awake=new Set<string>();spawned=new Map<string,Encounter>();momentum=0;private momentumTimer=0;private comboStep=0;private comboTimer=0;private encTimer=0;refusal='';
 private flow:Int32Array|null=null;private flowTimer=0;private exploreTimer=0;private stormTimer=6;private shotCount=0;private aimDistance=10;
 constructor(state:GameState){this.state=state;this.world=new World(state.seed);this.rng=new RNG(state.run?.rng??hash(state.seed,'combat'));if(state.run){this.layout=generateDungeon(state.run.portal,state.run.seed);for(const e of state.run.enemies)if(!e.dead&&(e.windup>0||e.charge!==0)){e.windup=0;e.charge=0;e.timer=Math.max(e.timer,.9);}}}
 get p(){return this.state.player;}
 get st(){return stats(this.state);}
 emit(type:GameEvent['type'],p:Vec=this.p,more:Partial<GameEvent>={}){if(type==='save'&&this.spawned.size)this.flushEncounters();this.events.push({type,x:p.x,z:p.z,...more});if(this.events.length>256)this.events.shift();}
 drain(){return this.events.splice(0);}
 enemies(){return this.state.run?.enemies??this.worldEnemies;}
 remaining(){return this.enemies().filter(e=>!e.dead).length;}
 bossLocked(){return this.enemies().some(e=>!e.dead&&e.kind!=='boss');}
 boss(){return this.enemies().find(e=>e.kind==='boss'&&!e.dead)??null;}
 portalEnter(p:Portal){
  if(this.state.phase!=='world'||dist(this.p,p)>7||p.final&&this.state.seals.length<5)return false;
  if(this.inCombat()){this.refusal='Разлом не откроется под ударом: оторвитесь от преследования.';this.emit('toast',this.p,{text:this.refusal});return false;}
  this.releaseWorldEnemies();
  const canonical=this.world.getPortal(p.id);if(!canonical)return false;
  const serial=this.state.attempts+1,seed=hash(canonical.seed,'run',serial),layout=generateDungeon(canonical,seed);
  this.state.attempts=serial;const boons={health:this.state.mastery.health>0,energy:this.state.mastery.energy>0,fortune:this.state.mastery.fortune>0};
  for(const k of ['health','energy','fortune'] as const)if(boons[k])this.state.mastery[k]--;
  this.state.run={id:`run:${this.state.seed}:${canonical.id}:${serial}`,portal:{...canonical,mods:[...canonical.mods]},seed,enemies:instantiateEnemies(layout.spawns,canonical.tier,this.allowedRank()),elapsed:0,restUsed:[],clearedRooms:[],rng:hash(seed,'combat'),returnPos:{x:canonical.x,z:canonical.z},serial,boons,rank:this.allowedRank()};
  this.layout=layout;this.rng=new RNG(this.state.run.rng);this.state.reward=null;this.state.phase='expedition';restorePlayer(this.state);
  this.p.x=layout.entry.x;this.p.z=layout.entry.z;this.p.faceX=1;this.p.faceZ=0;
  if(boons.health)this.p.shield=45;
  this.clearTransient();this.emit('phase',this.p,{text:'expedition'});this.emit('save');return true;
 }
 private clearTransient(){this.projectiles=[];this.hazards=[];this.attackQueue=[];this.flow=null;this.flowTimer=0;this.stormTimer=6;}
 claim(index:number){if(!applyReward(this.state,index))return false;this.layout=null;this.clearTransient();this.emit('phase',this.p,{text:this.state.phase});this.emit('save');return true;}
 abandon(){if(this.state.phase!=='expedition')return false;const ret=this.state.run!.returnPos;this.state.run=null;this.state.reward=null;this.state.phase='world';this.p.x=ret.x;this.p.z=ret.z+4;restorePlayer(this.state);this.layout=null;this.clearTransient();this.emit('phase',this.p,{text:'world'});this.emit('toast',this.p,{text:'Экспедиция завершена без награды. Полученный опыт сохранён.'});this.emit('save');return true;}
 respawn(){if(this.state.phase!=='dead')return false;this.state.phase='world';this.state.run=null;this.state.reward=null;this.p.x=1.5;this.p.z=4;this.layout=null;restorePlayer(this.state);this.clearTransient();this.emit('phase',this.p,{text:'world'});this.emit('save');return true;}
 continueAfterEnding(){if(this.state.phase!=='epilogue')return false;this.state.phase='world';this.emit('phase',this.p,{text:'world'});this.emit('save');return true;}
 goHome(){if(this.state.phase!=='world')return false;if(this.inCombat()){this.emit('toast',this.p,{text:'Телепорт домой не работает под ударом. Оторвитесь от машин.'});return false;}this.releaseWorldEnemies();this.p.x=1.5;this.p.z=4;restorePlayer(this.state);this.emit('phase',this.p,{text:'world'});this.emit('save');return true;}
 travel(id:string){if(this.state.phase!=='world'||!this.state.completions[id])return false;if(this.inCombat()){this.emit('toast',this.p,{text:'Быстрое перемещение недоступно под ударом.'});return false;}this.releaseWorldEnemies();const portal=this.world.getPortal(id);if(!portal)return false;this.p.x=portal.x;this.p.z=portal.z+4;restorePlayer(this.state);this.emit('phase',this.p,{text:'world'});this.emit('save');return true;}
 interactable():Interact|null {
  const choices:Interact[]=[];
  if(this.state.phase==='world'){
   for(const p of this.world.portals(this.p,1,this.state.seals.length===5)){const d=dist(p,this.p);if(d<6)choices.push({kind:'portal',data:p,distance:d});}
   for(const p of this.world.pois(this.p)){if(this.state.collected.includes(p.id)&&p.kind!=='camp')continue;const d=dist(p,this.p);if(d<4.5)choices.push({kind:'poi',data:p,distance:d});}
   if(!this.inCombat()){
    for(const [id,pos] of Object.entries(NPC_SPOTS)){const d=dist(pos,this.p);if(d<3.6)choices.push({kind:'npc',data:{id,x:pos.x,z:pos.z,title:NPCS[id].name,detail:`${NPCS[id].role} · поговорить`},distance:d});}
    for(const enc of this.spawned.values()){if(!enc.device||this.state.encounters[enc.id]?.done)continue;const d=dist(enc.device,this.p);if(d<3.4)choices.push({kind:'device',data:{id:enc.id,x:enc.device.x,z:enc.device.z,title:'Щиток сервисной группы',detail:'Отключить питание патруля без боя'},distance:d});}
   }
  }else if(this.state.phase==='expedition'&&this.layout&&this.state.run){
   const d=dist(this.p,this.layout.entry);if(d<3.5)choices.push({kind:'exit',data:{id:-1,...this.layout.entry},distance:d});
   for(const r of this.layout.rooms)if(r.role==='rest'&&!this.state.run.restUsed.includes(r.id)&&dist(r,this.p)<4)choices.push({kind:'rest',data:r,distance:dist(r,this.p)});
  }
  return choices.sort((a,b)=>a.distance-b.distance)[0]??null;
 }
 usePoi(p:Poi){
  if(this.state.phase!=='world'||dist(this.p,p)>5)return null;
  if(p.kind==='camp'){if(this.inCombat())return 'Станция не отвечает: рядом идёт бой.';restorePlayer(this.state);this.emit('heal',this.p,{value:this.st.hp});this.emit('save');return 'Станция восстановила здоровье, заряд и ремкомплекты.';}
  if(this.state.collected.includes(p.id))return null;this.state.collected.push(p.id);
  if(p.kind==='archive'){const index=hash(p.seed,'lore')%LORE.length,id=`lore:${index}`;if(!this.state.journal.includes(id))this.state.journal.push(id);this.state.shards+=12;this.grantXp(25);this.emit('loot',p);this.emit('save');return `${LORE[index][0]}\n${LORE[index][1]}`;}
  const tier=clamp(Math.floor(Math.hypot(p.x,p.z)/52)+1,1,Math.min(5,Math.max(1,this.state.stats.bestTier+1)));
  const item=makeItem(hash(p.seed,'cache'),tier,this.p.classId,`${p.id}:item`);const delivery=giveItem(this.state,item);this.state.shards+=6;this.emit('loot',p);this.emit('save');return `Найдено: ${item.name}. ${delivery==='shards'?`Хранилище заполнено: получено ${salvageValue(item)} деталей вместо предмета.`:delivery==='mail'?'Предмет добавлен в хранилище.':'Предмет добавлен в снаряжение.'}`;
 }
 rest(roomId:number){const r=this.layout?.rooms.find(r=>r.id===roomId);if(!r||r.role!=='rest'||!this.state.run||this.state.run.restUsed.includes(roomId)||dist(this.p,r)>4.5)return false;this.state.run.restUsed.push(roomId);this.p.hp=Math.min(this.st.hp,this.p.hp+this.st.hp*.4);this.p.potions=Math.min(this.st.potionCount,this.p.potions+1);this.p.energy=100;this.emit('heal',this.p,{value:Math.round(this.st.hp*.4)});this.emit('toast',this.p,{text:'Тихая терраса: восстановлено здоровье и один ремкомплект.'});this.emit('save');return true;}
 private valid(x:number,z:number,r=.46){return this.layout?canWalk(this.layout,x,z,r):this.world.canWalk(x,z,r);}
 tick(dt:number,input:InputFrame=EMPTY){
  if(this.state.phase!=='world'&&this.state.phase!=='expedition')return;
  if(!Number.isFinite(dt)||dt<=0||dt>.05)return;
  this.time+=dt;this.state.stats.seconds+=dt;const p=this.p,st=this.st;
  for(const k of Object.keys(p.cooldowns) as (keyof typeof p.cooldowns)[])p.cooldowns[k]=Math.max(0,p.cooldowns[k]-dt);
  p.invuln=Math.max(0,p.invuln-dt);p.guard=Math.max(0,p.guard-dt);p.energy=Math.min(100,p.energy+(st.energyRegen+(this.state.run?.boons.energy?5:0))*dt);
  if(Number.isFinite(input.aimDistance))this.aimDistance=clamp(input.aimDistance!,1,22);
  const aim=norm(input.ax,input.az);if(aim.x||aim.z){p.faceX=aim.x;p.faceZ=aim.z;}
  const direction=norm(input.mx,input.mz);
  if(input.dash&&p.cooldowns.dash<=0){p.cooldowns.dash=st.dashCooldown;p.dashTime=.19;p.invuln=.34;const a=direction.x||direction.z?direction:{x:p.faceX,z:p.faceZ};p.dashX=a.x;p.dashZ=a.z;p.shield=Math.max(p.shield,(this.state.upgrades.aegis??0)*10);this.emit('dash',p,{dx:a.x,dz:a.z});}
  if(p.dashTime>0){p.dashTime=Math.max(0,p.dashTime-dt);move(p,p.dashX*st.speed*3*dt,p.dashZ*st.speed*3*dt,(x,z)=>this.valid(x,z));}
  else move(p,direction.x*st.speed*dt,direction.z*st.speed*dt,(x,z)=>this.valid(x,z));
  if(this.momentum>0){this.momentumTimer-=dt;if(this.momentumTimer<=0)this.momentum=0;}if(this.comboStep&&(this.comboTimer-=dt)<=0)this.comboStep=0;
  if(input.attack&&p.cooldowns.attack<=0){p.cooldowns.attack=st.attackTime/(1+this.momentum*.03);this.attackQueue.push({time:this.p.classId==='harvester'?.09:.035,ax:p.faceX,az:p.faceZ});}
  for(const q of this.attackQueue)q.time-=dt;
  for(const q of this.attackQueue.filter(q=>q.time<=0))this.basic(q.ax,q.az,st);
  this.attackQueue=this.attackQueue.filter(q=>q.time>0);
  if(input.skill&&p.cooldowns.skill<=0)this.skill(false,st);
  if(input.burst&&p.cooldowns.burst<=0)this.skill(true,st);
  if(input.heal&&p.cooldowns.heal<=0&&p.potions>0&&p.hp<st.hp){p.potions--;p.cooldowns.heal=1.2;const before=p.hp;p.hp=Math.min(st.hp,p.hp+st.hp*.45*st.healPower*(this.state.run?.portal.mods.includes('famine')?.7:1));this.emit('heal',p,{value:Math.round(p.hp-before)});this.emit('save');}
  if(this.state.phase==='expedition'&&this.state.run&&this.layout){
   const run=this.state.run;run.elapsed+=dt;this.flowTimer-=dt;
   if(this.flowTimer<=0){this.flow=flowField(this.layout.nav!,p);this.flowTimer=.42;}
   for(const e of run.enemies)if(!e.dead)this.updateEnemy(e,dt,st);
   if(run.portal.mods.includes('storm')){this.stormTimer-=dt;if(this.stormTimer<=0){this.stormTimer=5.5;if(run.enemies.some(e=>!e.dead&&dist(e,p)<19))this.addHazard('circle',p,2.7,1.2,.16,15+run.portal.tier*3,true);}}
   run.rng=this.rng.state;
  }
  else if(this.state.phase==='world'){this.encTimer-=dt;if(this.encTimer<=0){this.encTimer=.5;this.syncEncounters();}for(const e of this.worldEnemies)if(!e.dead)this.updateWorldEnemy(e,dt,st);}
  if(this.state.phase!=='world'&&this.state.phase!=='expedition')return;
  this.updateProjectiles(dt,st);this.updateHazards(dt,st);if(this.state.run)this.state.run.rng=this.rng.state;
  this.exploreTimer-=dt;if(this.state.phase==='world'&&this.exploreTimer<=0){this.exploreTimer=.4;const key=`${Math.floor(p.x/CHUNK)},${Math.floor(p.z/CHUNK)}`;if(!this.state.explored.includes(key))this.state.explored.push(key);for(const portal of this.world.portals(p,1,this.state.seals.length===5))if(dist(portal,p)<31&&!this.state.discovered.includes(portal.id)){this.state.discovered.push(portal.id);this.emit('toast',portal,{text:`Обнаружен разлом: ${portal.title}`});this.emit('save');}}
 }
 private basic(ax:number,az:number,st:Stats){
  if(this.state.phase!=='world'&&this.state.phase!=='expedition')return;
  const p=this.p;
  if(st.family==='strippers'){this.strippers(ax,az,st);return;}
  if(st.family==='inductor'){this.inductor(ax,az,st);return;}
  if(st.family==='discs'){this.discs(ax,az,st);return;}
  if(p.classId==='harvester'){
   this.emit('slash',p,{dx:ax,dz:az,radius:st.range});let count=0;
   for(const e of this.enemies().filter(e=>!e.dead).sort((a,b)=>dist(a,p)-dist(b,p))){const d=dist(e,p),v=norm(e.x-p.x,e.z-p.z);if(d<=st.range&&v.x*ax+v.z*az>.20&&(!this.layout||lineClear(this.layout,p,e))){this.hitEnemy(e,st.damage,false);if(++count>=3+(this.state.upgrades.cleave??0)*2)break;}}
  }else{
   const count=p.classId==='aerologist'?st.pellets:1;this.shotCount++;
   for(let i=0;i<count;i++){const spread=(i-(count-1)/2)*.135,c=Math.cos(spread),s=Math.sin(spread),dx=ax*c-az*s,dz=ax*s+az*c;
    this.addProjectile({x:p.x+dx*.7,z:p.z+dz*.7},dx,dz,p.classId==='aerologist'?22:28,st.damage*(p.classId==='aerologist'?.67:1),false,st.range,st.pierce);
   }
   if(p.classId==='lineman'&&this.state.upgrades.double&&this.shotCount%4===0)this.addProjectile({x:p.x-az*.24,z:p.z+ax*.24},ax,az,26,st.damage,false,st.range,st.pierce);
   this.emit('shot',p,{dx:ax,dz:az,color:CLASSES[p.classId].color});
  }
 }
 private skill(burst:boolean,st:Stats){
  const p=this.p,cost=burst?45:25;if(p.energy<cost){this.emit('toast',p,{text:`Недостаточно заряда: нужно ${cost}.`});return;}
  p.energy-=cost;const ax=p.faceX,az=p.faceZ,power=st.damage*st.skillPower;
  if(!burst&&this.state.loadout.skill==='alt'&&this.state.npcs.irma?.heard.includes('taught')){p.cooldowns.skill=SKILLS[p.classId].alt.cooldown*st.cooldown;this.altSkill(ax,az,power,st);return;}
  const aim=this.aimPoint(burst?11:10);
  if(burst){
   p.cooldowns.burst=(p.classId==='lineman'?11:p.classId==='harvester'?12:10)*st.cooldown;
   if(p.classId==='lineman'){this.addHazard('circle',aim,5+(this.state.upgrades.overload??0)*1.3,.25,.13,power*3.2,false);this.emit('cast',aim,{radius:5,color:0x92eddc});}
   if(p.classId==='harvester'){p.guard=3+(this.state.upgrades.bulwark??0);p.invuln=.38;this.areaDamage(p,6,power*2.5);this.emit('cast',p,{radius:6,color:0xf3cb83});}
   if(p.classId==='aerologist'){let hits=0;for(const e of this.enemies())if(!e.dead&&dist(e,p)<8&&this.visible(e,p)){this.hitEnemy(e,power*3,true);const n=norm(e.x-p.x,e.z-p.z);if(!e.dead&&e.kind!=='boss')move(e,n.x*3,n.z*3,(x,z)=>this.valid(x,z,.65));e.stun=.8;hits++;}p.hp=Math.min(st.hp,p.hp+Math.min(hits,6)*(this.state.upgrades.return??0)*12);this.emit('cast',p,{radius:8,color:0xd7bbff});}
  }else{
   p.cooldowns.skill=(p.classId==='lineman'?6:p.classId==='harvester'?5:7)*st.cooldown;
   if(p.classId==='lineman'){
    let origin:Vec=p;const hit=new Set<string>();
    for(let i=0;i<st.chain;i++){const target=this.enemies().filter(e=>!e.dead&&!hit.has(e.id)&&dist(e,origin)<(i?9:st.baseRange)&&this.visible(e,origin)).sort((a,b)=>(i?dist(a,origin)-dist(b,origin):dist(a,aim)-dist(b,aim)))[0];if(!target)break;
     this.emit('cast',origin,{dx:target.x-origin.x,dz:target.z-origin.z,color:0xb4fff0});this.hitEnemy(target,power*1.7*.86**i,true);hit.add(target.id);origin=target;
    }if(!hit.size)this.emit('cast',p,{dx:ax*8,dz:az*8,color:0xb4fff0});
   }
   if(p.classId==='harvester'){
    let hits=0;for(const e of this.enemies()){const v=norm(e.x-p.x,e.z-p.z);if(!e.dead&&dist(e,p)<8.5&&v.x*ax+v.z*az>.1&&this.visible(e,p)){this.hitEnemy(e,power*1.9,true);e.stun=e.kind==='boss'?.2:1.15;hits++;}}
    p.hp=Math.min(st.hp,p.hp+Math.min(hits,4)*(this.state.upgrades.recovery??0)*8);this.emit('slash',p,{dx:ax,dz:az,radius:8,color:0xf6cd85});
    if(this.state.upgrades.aftershock)this.addHazard('circle',{x:p.x+ax*4,z:p.z+az*4},4,.5,.13,power*1.3,false);
   }
   if(p.classId==='aerologist'){this.addHazard('field',aim,4,.1,4+(this.state.upgrades.linger??0),power*.5,false);this.emit('cast',aim,{radius:4,color:0xd4b4f3});}
  }
 }
 private aimPoint(distance:number):Vec{const p=this.p;let result={x:p.x,z:p.z};for(let i=.5;i<=Math.min(distance,this.aimDistance);i+=.5){const x=p.x+p.faceX*i,z=p.z+p.faceZ*i;if(!this.valid(x,z,.1))break;result={x,z};}return result;}
 private visible(a:Vec,b:Vec){if(this.layout)return lineClear(this.layout,a,b,.13);if(this.state.phase!=='world')return true;const d=dist(a,b),n=Math.ceil(d/.9);for(let i=1;i<n;i++){const t=i/n;if(!this.world.canWalk(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t,.05))return false;}return true;}
 private areaDamage(p:Vec,r:number,damage:number){for(const e of this.enemies())if(!e.dead&&dist(e,p)<r&&this.visible(e,p))this.hitEnemy(e,damage,true);}
 private addProjectile(p:Vec,dx:number,dz:number,speed:number,damage:number,enemy:boolean,range:number,pierce=0,source?:string){this.projectiles.push({id:this.seq++,x:p.x,z:p.z,vx:dx*speed,vz:dz*speed,radius:enemy?.25:.18,damage,ttl:range/speed,enemy,pierce,hit:[],color:enemy?0xff9475:CLASSES[this.p.classId].color,source});}
 private addHazard(kind:Hazard['kind'],p:Vec,radius:number,delay:number,ttl:number,damage:number,enemy:boolean,dx=1,dz=0,length=0,source?:string){this.hazards.push({id:this.seq++,kind,x:p.x,z:p.z,radius,delay,ttl,damage,enemy,dx,dz,length,tick:0,source});}
 private hitEnemy(e:Enemy,amount:number,ability:boolean){
  if(e.dead||(this.state.phase!=='expedition'&&this.state.phase!=='world'))return;
  if(!this.state.run){if(dist(this.p,{x:0,z:0})<SAFE_RADIUS)return;this.wake(e);}
  if(e.kind==='boss'&&this.bossLocked()){if(this.time%1.2<.08)this.emit('toast',e,{text:'Корона защищена. Завершите отмеченные на карте встречи.'});return;}
  const st=this.st;let damage=amount;
  if(st.effects.includes('first')&&e.hp>=e.maxHp-.01)damage*=1.25;
  if(e.kind==='warden'&&!ability){const n=norm(this.p.x-e.x,this.p.z-e.z);if(n.x*e.dx+n.z*e.dz>.45)damage*=.35;}
  const crit=this.rng.next()<st.crit;if(crit)damage*=1.65;
  e.hp=Math.max(0,e.hp-damage);this.emit('hit',e,{value:Math.round(damage),color:crit?0xffd992:0xf3f2dc});
  if(e.hp<=0)this.kill(e,st);
 }
 private kill(e:Enemy,st:Stats){
  if(e.dead)return;e.dead=true;e.hp=0;e.windup=0;e.charge=0;this.state.stats.kills++;const codex=`enemy:${e.boss??e.kind}`;if(!this.state.journal.includes(codex))this.state.journal.push(codex);
  this.onKill();
  if(!this.state.run){this.killWorld(e,st);return;}
  const tier=this.state.run.portal.tier;let xp=enemyNumbers(e.kind,tier,e.boss,this.state.run.rank).xp;
  // Old expeditions retain some XP, but never eclipse current-tier progression.
  const expected=tier*2;xp=Math.round(xp*clamp(1-(st.level-expected)*.08,.18,1));this.grantXp(xp);
  this.p.hp=Math.min(this.st.hp,this.p.hp+st.siphon);if(st.effects.includes('barrier'))this.p.shield=Math.max(this.p.shield,12);
  this.emit('kill',e,{color:e.kind==='boss'?0xffd391:0x8bd9c6,value:xp});
  if(this.state.run.portal.mods.includes('echo'))this.addHazard('circle',e,2.3,1.05,.14,12+tier*3,true);
  const room=this.layout?.rooms[e.room];
  if(room&&room.role==='combat'&&!this.state.run.clearedRooms.includes(room.id)&&this.enemies().filter(n=>n.room===room.id).every(n=>n.dead)){
   this.state.run.clearedRooms.push(room.id);this.p.hp=Math.min(this.st.hp,this.p.hp+this.st.hp*.08);this.p.energy=Math.min(100,this.p.energy+22);this.emit('room',room,{text:'Узел стабилизирован · +8% здоровья'});
  }
  if(this.enemies().every(n=>n.dead)){
   this.state.reward=createReward(this.state);this.state.phase='reward';this.projectiles=[];this.hazards=[];this.attackQueue=[];this.emit('phase',this.p,{text:'reward'});
  }
  this.emit('save');
 }
 private grantXp(xp:number){const level=levelInfo(this.p.xp).level;this.p.xp+=xp;const next=levelInfo(this.p.xp).level;if(next>level){this.p.hp=Math.min(this.st.hp,this.p.hp+30);this.emit('level',this.p,{value:next,text:`Уровень ${next} · +здоровье и урон`});}}
 private damagePlayer(amount:number,p:Vec){
  if(this.p.invuln>0||(this.state.phase!=='expedition'&&this.state.phase!=='world'))return;
  if(this.state.phase==='world'&&dist(this.p,{x:0,z:0})<SAFE_RADIUS)return;
  let damage=amount*(1-this.st.armor)*(this.state.mode==='explorer'?.7:1)*(this.p.guard>0?.15:1);
  const shield=Math.min(this.p.shield,damage);this.p.shield-=shield;damage-=shield;
  this.p.hp=Math.max(0,this.p.hp-damage);this.p.invuln=.48;this.p.lastDamage=this.state.stats.seconds;this.emit('warning',this.p,{value:Math.round(damage),color:0xff8069});
  if(this.p.hp<=0&&this.state.phase==='world'){this.worldDeath();return;}
  if(this.p.hp<=0){this.state.phase='dead';this.state.stats.deaths++;this.clearTransient();this.emit('phase',this.p,{text:'dead'});this.emit('save');}
 }
 private updateEnemy(e:Enemy,dt:number,st:Stats){
  const run=this.state.run;
  e.stun=Math.max(0,e.stun-dt);if(e.stun>0)return;
  const d=dist(e,this.p);if(d>33&&dist(e,{x:e.homeX,z:e.homeZ})<1)return;
  if(e.kind==='boss'&&this.bossLocked())return;
  const tier=run?run.portal.tier:(this.encOf(e)?.tier??1),numbers=enemyNumbers(e.kind,tier,e.boss,run?.rank??0);if(e.elite)numbers.damage*=1.3;numbers.cooldown*=PACE;let speed=numbers.speed*(run?.portal.mods.includes('famine')?.85:1);
  for(const h of this.hazards)if(h.kind==='field'&&!h.enemy&&h.delay<=0&&dist(e,h)<h.radius)speed*=st.slow;
  if(e.charge>0){e.charge=Math.max(0,e.charge-dt);move(e,e.dx*19*dt,e.dz*19*dt,(x,z)=>this.valid(x,z,e.kind==='boss'?1.2:.65));if(dist(e,this.p)<(e.kind==='boss'?2.1:1.55))this.damagePlayer(numbers.damage*1.1,e);return;}
  if(e.windup>0){e.windup-=dt;if(e.windup<=0){if(e.charge<0)e.charge=-e.charge;else this.enemyAttack(e,numbers.damage);}return;}
  e.timer-=dt;
  const visible=this.visible(e,this.p),toward=norm(this.p.x-e.x,this.p.z-e.z);
  const f=norm(e.dx+(toward.x-e.dx)*Math.min(1,dt*5),e.dz+(toward.z-e.dz)*Math.min(1,dt*5));e.dx=f.x;e.dz=f.z;
  if(d<numbers.range&&visible&&e.timer<=0){
   e.tx=this.p.x;e.tz=this.p.z;e.dx=toward.x;e.dz=toward.z;e.windup=e.kind==='boss'?.9:e.kind==='ram'?.8:e.kind==='mite'?.42:.65;
   e.timer=numbers.cooldown*(e.kind==='boss'&&e.hp<e.maxHp*.45?.77:1);this.emit('warning',e,{color:0xffb481,text:'windup'});
   if(e.kind==='ram')this.addHazard('line',e,.55,e.windup,.08,0,true,e.dx,e.dz,12,e.id);
   return;
  }
  const ranged=['sentry','mender','mortar'].includes(e.kind),desired=e.kind==='boss'?6:ranged?7:numbers.range*.8;
  let target:Vec=this.p,sign=1;
  if(d>29){target={x:e.homeX,z:e.homeZ};}
  else if(ranged&&d<3.7&&visible){sign=-1;}
  else if(d<desired&&visible)return;
  let dir=toward;
  if(target!==this.p)dir=norm(target.x-e.x,target.z-e.z);
  else if(!visible&&this.layout&&this.flow){const next=nextOnFlow(this.layout.nav!,this.flow,e,this.p);dir=norm(next.x-e.x,next.z-e.z);}
  // Mild local separation prevents mobs stacking in narrow doorways.
  let sx=dir.x*sign,sz=dir.z*sign;
  for(const o of this.enemies())if(o!==e&&!o.dead){const dd=dist(e,o);if(dd>0.02&&dd<1.15){sx+=(e.x-o.x)/dd*.6;sz+=(e.z-o.z)/dd*.6;}}
  const n=norm(sx,sz);move(e,n.x*speed*dt,n.z*speed*dt,(x,z)=>this.valid(x,z,e.kind==='boss'?1.1:.62));
  // Recovery preserves the enemy and its HP, never fakes a kill.
  if(!this.layout&&!this.valid(e.x,e.z,.3)){e.x=e.homeX;e.z=e.homeZ;e.timer=1;}
  else if(this.layout&&!canWalk(this.layout,e.x,e.z,.4)){const idx=nearestIndex(this.layout!.nav!,e);if(idx>=0){const p=navPoint(this.layout!.nav!,idx);e.x=p.x;e.z=p.z;e.timer=1;}}
 }
 private enemyAttack(e:Enemy,damage:number){
  if(e.dead||(this.state.phase!=='expedition'&&this.state.phase!=='world'))return;
  const n=norm(e.tx-e.x,e.tz-e.z);
  if(e.kind==='boss'){this.bossAttack(e,damage);return;}
  if(e.kind==='mite'||e.kind==='warden'){
   if(dist(e,this.p)<(e.kind==='mite'?2:2.8)&&this.visible(e,this.p)){const toward=norm(this.p.x-e.x,this.p.z-e.z);if(toward.x*e.dx+toward.z*e.dz>.2)this.damagePlayer(damage,e);}this.emit('slash',e,{dx:e.dx,dz:e.dz,radius:2,color:0xff9a72});
  }else if(e.kind==='ram'){e.charge=.62;}
  else if(e.kind==='mortar'){this.addHazard('circle',{x:e.tx,z:e.tz},2.1,.9,.12,damage,true);}
  else if(e.kind==='mender'){
   let healed=0;for(const other of this.enemies())if(other!==e&&!other.dead&&other.kind!=='boss'&&dist(e,other)<6&&other.hp<other.maxHp){other.hp=Math.min(other.maxHp,other.hp+other.maxHp*.12);healed++;}
   this.emit('cast',e,{radius:5,color:0xe7bf88});if(!healed)this.addProjectile(e,n.x,n.z,9,damage,true,14,0,e.id);
  }else this.addProjectile(e,n.x,n.z,10.5,damage,true,19,0,e.id);
 }
 private bossAttack(e:Enemy,damage:number){
  const boss=BOSSES[e.boss!],phase=e.hp/e.maxHp<.33?2:e.hp/e.maxHp<.66?1:0,pattern=boss.patterns[e.pattern++%boss.patterns.length];
  const target={x:e.tx,z:e.tz},n=norm(target.x-e.x,target.z-e.z);
  if(pattern==='fan'){const count=5+phase*2;for(let i=0;i<count;i++){const a=(i-(count-1)/2)*.2,c=Math.cos(a),s=Math.sin(a);this.addProjectile(e,n.x*c-n.z*s,n.x*s+n.z*c,9+phase,damage,true,27,0,e.id);}}
  if(pattern==='stomp')this.addHazard('circle',e,6.5,.8,.17,damage*1.3,true);
  if(pattern==='seeds'){for(let i=0;i<3+phase;i++){const a=i*2.4;this.addHazard('circle',{x:target.x+Math.cos(a)*(i?2.6:0),z:target.z+Math.sin(a)*(i?2.6:0)},2.4,.95+i*.22,.13,damage,true);}}
  if(pattern==='charge'){e.dx=n.x;e.dz=n.z;this.addHazard('line',e,.9,.65,.1,0,true,n.x,n.z,17,e.id);e.windup=.65;// Negative charge marks the second, visible preparation before the actual dash.
   e.charge=-.8;}
  if(pattern==='cross'){const angle=phase?Math.PI/4:0;for(let i=0;i<2;i++){const a=angle+i*Math.PI/2,dx=Math.cos(a),dz=Math.sin(a);this.addHazard('line',{x:e.x-dx*12,z:e.z-dz*12},.85,1.15,.13,damage*1.2,true,dx,dz,24,e.id);}}
  if(pattern==='ring')this.addHazard('ring',e,1,.75,1.8,damage,true,1,0,18,e.id);
 }
 private updateProjectiles(dt:number,st:Stats){
  for(const p of this.projectiles){p.ttl-=dt;if(p.ttl<=0)continue;if(p.turn!==undefined){p.turn-=dt;if(p.turn<=0){const sp=Math.hypot(p.vx,p.vz),back=norm(this.p.x-p.x,this.p.z-p.z);p.vx=back.x*sp;p.vz=back.z*sp;p.hit=[];p.turn=undefined;}}const count=Math.max(1,Math.ceil(Math.hypot(p.vx,p.vz)*dt/.24));
   for(let i=0;i<count;i++){
    const from={x:p.x,z:p.z},x=p.x+p.vx*dt/count,z=p.z+p.vz*dt/count;
    if(!this.valid(x,z,.10)){p.ttl=-1;break;}p.x=x;p.z=z;
    if(p.enemy){if(segmentDistance(this.p,from,p)<p.radius+.48){this.damagePlayer(p.damage,p);p.ttl=-1;break;}}
    else for(const e of this.enemies())if(!e.dead&&!p.hit.includes(e.id)&&segmentDistance(e,from,p)<p.radius+(e.kind==='boss'?1.5:.64)){
     p.hit.push(e.id);this.hitEnemy(e,p.damage,false);if(p.pierce--<=0){p.ttl=-1;break;}
    }
    if(p.ttl<=0)break;
   }
  }
  this.projectiles=this.projectiles.filter(p=>p.ttl>0);
 }
 private updateHazards(dt:number,st:Stats){
  for(const h of this.hazards){if(h.delay>0){h.delay-=dt;continue;}h.ttl-=dt;h.tick-=dt;if(h.kind==='ring')h.radius+=9*dt;
   if(h.tick>0)continue;h.tick=h.kind==='field'?.45:h.kind==='ring'?.08:999;
   const inside=(p:Vec)=>h.kind==='line'?segmentDistance(p,h,{x:h.x+h.dx*h.length,z:h.z+h.dz*h.length})<h.radius+.42:h.kind==='ring'?Math.abs(dist(p,h)-h.radius)<.75:dist(p,h)<h.radius+.4;
   if(h.enemy){if(h.damage>0&&inside(this.p))this.damagePlayer(h.damage,h);}
   else{for(const e of this.enemies())if(!e.dead&&inside(e)&&this.visible(h,e))this.hitEnemy(e,h.damage,true);if(h.kind==='field'&&this.state.upgrades.stormEye&&inside(this.p))this.p.hp=Math.min(st.hp,this.p.hp+1.8);}
  }
  this.hazards=this.hazards.filter(h=>h.ttl>0);
 }
 // ---- combat context shared by expeditions and the overworld (WORLD-04) ----
 /** True while awake machines are near or the hero was hit in the last 5 s. Blocks instant heal/teleport/gear swaps. */
 inCombat(){if(this.state.phase!=='world')return false;const seconds=this.state.stats.seconds;if(this.p.lastDamage>0&&seconds-this.p.lastDamage<5)return true;return this.worldEnemies.some(e=>!e.dead&&this.awake.has(e.id)&&dist(e,this.p)<LEASH_RADIUS);}
 allowedRank(){const r=this.state.rank;return this.state.finalCleared?Math.max(0,Math.min(MAX_RANK,r.selected,r.best+1)):0;}
 setRank(rank:number){if(!Number.isInteger(rank)||rank<0||rank>MAX_RANK)return false;if(rank>0&&!this.state.finalCleared)return false;this.state.rank.selected=Math.min(rank,this.state.rank.best+1);this.emit('save');return true;}
 encOf(e:Enemy){return this.spawned.get(e.id.slice(4,e.id.lastIndexOf(':')));}
 private onKill(){this.momentum=Math.min(5,this.momentum+1);this.momentumTimer=4;this.p.energy=Math.min(100,this.p.energy+5);if(this.momentum>=3)this.emit('combo',this.p,{value:this.momentum});}
 private calmedTier(){return Math.max(0,this.state.seals.length-1);}
 private syncEncounters(){
  const s=this.state,p=this.p;
  for(const enc of this.world.encounters(p,2)){
   if(this.spawned.has(enc.id)||dist(enc,p)>SPAWN_RADIUS)continue;
   const st=s.encounters[enc.id];if(st?.done||st?.disabled)continue;
   if(enc.kind!=='named'&&!enc.fixed&&enc.tier<=this.calmedTier())continue; // restoration lowers regional chaos
   this.spawnEncounter(enc,st?.hp);
  }
  for(const [id,enc] of [...this.spawned])if(dist(enc,p)>SPAWN_RADIUS+22)this.despawnEncounter(id);
  this.flushEncounters();
 }
 /** Mirrors live damage into the save state, so a save taken mid-fight never resets the fight. */
 flushEncounters(){for(const [id,enc] of this.spawned){const st=this.state.encounters[id];if(st?.done)continue;const units=this.worldEnemies.filter(e=>this.encOf(e)===enc),damaged=units.some(u=>u.dead||u.hp<u.maxHp-.01);if(damaged&&units.some(u=>!u.dead))this.state.encounters[id]={done:false,disabled:false,hp:units.map(u=>u.dead?0:Math.max(1,Math.ceil(u.hp)))};else if(!damaged&&st)delete this.state.encounters[id];}}
 private spawnEncounter(enc:Encounter,saved?:number[]){
  const spots=unitPositions(enc,(x,z,r)=>this.world.canWalk(x,z,r)),spawns=enc.units.map((kind,i)=>({id:`enc:${enc.id}:${i}`,kind,room:0,x:spots[i].x,z:spots[i].z}));
  const units=instantiateEnemies(spawns,enc.tier);
  units.forEach((u,i)=>{u.dx=0;u.dz=1;if(enc.kind==='named'&&i===0){u.elite=true;u.hp=u.maxHp=Math.round(u.maxHp*2.6);}u.timer=1+i*.3;if(saved&&saved.length===units.length){u.hp=Math.max(0,Math.min(u.maxHp,saved[i]));u.dead=u.hp<=0;}});
  this.worldEnemies.push(...units);this.spawned.set(enc.id,enc);
 }
 private despawnEncounter(id:string){
  const enc=this.spawned.get(id);if(!enc)return;const units=this.worldEnemies.filter(e=>this.encOf(e)===enc),state=this.state.encounters[id];
  if(!state?.done){const damaged=units.some(u=>u.dead||u.hp<u.maxHp-.01);if(damaged&&units.some(u=>!u.dead))this.state.encounters[id]={done:false,disabled:false,hp:units.map(u=>u.dead?0:Math.max(1,Math.ceil(u.hp)))};else if(!damaged)delete this.state.encounters[id];}
  this.worldEnemies=this.worldEnemies.filter(e=>this.encOf(e)!==enc);for(const u of units)this.awake.delete(u.id);this.spawned.delete(id);
 }
 /** Documented policy: entering a rift, teleporting or leaving the area suspends encounters, keeping their damage. */
 releaseWorldEnemies(){for(const id of [...this.spawned.keys()])this.despawnEncounter(id);this.worldEnemies=[];this.awake.clear();this.spawned.clear();}
 private wake(e:Enemy){const enc=this.encOf(e);if(!enc||this.awake.has(e.id))return;let woke=false;for(const u of this.worldEnemies)if(!u.dead&&this.encOf(u)===enc){this.awake.add(u.id);woke=true;}if(woke)this.emit('warning',e,{color:0xffb481,text:'alert'});}
 private calm(enc:Encounter){let was=false;for(const u of this.worldEnemies)if(this.encOf(u)===enc&&!u.dead){if(this.awake.delete(u.id))was=true;u.hp=u.maxHp;u.x=u.homeX;u.z=u.homeZ;u.windup=0;u.charge=0;u.stun=0;}if(was)this.emit('toast',enc,{text:'Машины вернулись на посты.'});}
 private updateWorldEnemy(e:Enemy,dt:number,st:Stats){
  const enc=this.encOf(e);if(!enc)return;const safe=dist(this.p,{x:0,z:0})<SAFE_RADIUS;
  if(!this.awake.has(e.id)){if(!safe&&dist(e,this.p)<AGGRO_RADIUS&&this.visible(e,this.p))this.wake(e);return;}
  if(safe||dist(enc,this.p)>LEASH_RADIUS){this.calm(enc);return;}
  this.updateEnemy(e,dt,st);
 }
 private killWorld(e:Enemy,st:Stats){
  const enc=this.encOf(e),tier=enc?.tier??1;let xp=enemyNumbers(e.kind,tier).xp*(e.elite?2:1);xp=Math.round(xp*clamp(1-(st.level-tier*2)*.1,.15,1));this.grantXp(xp);
  this.p.hp=Math.min(this.st.hp,this.p.hp+st.siphon);if(st.effects.includes('barrier'))this.p.shield=Math.max(this.p.shield,12);this.emit('kill',e,{color:e.elite?0xffd391:0x8bd9c6,value:xp});
  if(enc&&this.worldEnemies.filter(n=>this.encOf(n)===enc).every(n=>n.dead))this.completeEncounter(enc,'kill');
  this.emit('save');
 }
 /** One-shot completion: rewards are guarded by the persistent `done` flag, so re-entry, reload or import cannot duplicate them. */
 completeEncounter(enc:Encounter,how:'kill'|'disable'){
  const s=this.state;if(s.encounters[enc.id]?.done)return;
  s.encounters[enc.id]={done:true,disabled:how==='disable',hp:[]};
  for(const u of this.worldEnemies)if(this.encOf(u)===enc){this.awake.delete(u.id);if(!u.dead){u.dead=true;u.hp=0;}}
  const tier=enc.tier,shards=(how==='disable'?6:enc.kind==='named'?24:12)*tier;s.shards+=shards;let extra='';
  const cls=s.player.classId,alt=s.blueprints.includes(ALT_FAMILY[cls])?.5:0;
  if(how==='kill'&&(enc.kind==='named'||enc.kind==='meteo'||hash(enc.seed,'patrol-loot')%100<40)){
   const item=makeItem(hash(enc.seed,'enc-loot'),enc.kind==='named'?Math.min(5,tier+1):tier,cls,`enc:${s.seed}:${enc.id}:loot`,enc.kind==='named'?{bonus:30,pity:true,slot:'instrument',altChance:alt}:{bonus:6,altChance:alt});
   const delivery=giveItem(s,item);if(delivery)extra=delivery==='shards'?` Хранилище заполнено: ${item.name} превращён в ${salvageValue(item)} деталей.`:` Найдено: ${item.name}.${delivery==='mail'?' Предмет в хранилище.':''}`;
  }
  this.emit('toast',enc,{text:`${enc.title}: ${how==='disable'?'питание отключено':'узел стабилизирован'}. +${shards} деталей.${extra}`});this.emit('loot',enc);this.emit('save');
 }
 useDevice(id:string){
  const enc=this.spawned.get(id);if(!enc?.device||this.state.phase!=='world'||dist(enc.device,this.p)>4||this.inCombat()||this.state.encounters[id]?.done)return false;
  this.completeEncounter(enc,'disable');return true;
 }
 talkTo(id:string):DialogueView|null{if(this.state.phase!=='world'||this.inCombat()||!NPC_SPOTS[id]||dist(NPC_SPOTS[id],this.p)>4.6)return null;const v=talk(this.state,id);this.emit('save');return v;}
 dialogueChoice(id:string,choice:string):DialogueView|null{if(this.state.phase!=='world'||this.inCombat()||!NPC_SPOTS[id]||dist(NPC_SPOTS[id],this.p)>5.5)return null;const v=choose(this.state,id,choice);if(v?.toast)this.emit('toast',this.p,{text:v.toast});this.emit('save');return v;}
 private worldDeath(){
  this.state.stats.deaths++;this.clearTransient();this.momentum=0;for(const enc of this.spawned.values())this.calm(enc);
  this.p.x=1.5;this.p.z=4;this.p.lastDamage=0;restorePlayer(this.state);
  this.emit('toast',this.p,{text:'Сервисная бригада вернула вас на станцию. Опыт и добыча сохранены, встреча не засчитана.'});this.emit('phase',this.p,{text:'world'});this.emit('save');
 }
 // ---- instrument families (WEAPON-01) ----
 private strippers(ax:number,az:number,st:Stats){
  const p=this.p,dmg=st.damage*st.weaponMul;this.comboTimer=1.3;this.comboStep=(this.comboStep+1)%3;
  if(this.comboStep!==0){
   this.emit('slash',p,{dx:ax,dz:az,radius:st.range,color:this.comboStep===1?0xf6cd85:0xffe0a8});let n=0;
   for(const e of this.enemies().filter(e=>!e.dead).sort((a,b)=>dist(a,p)-dist(b,p))){const d=dist(e,p),v=norm(e.x-p.x,e.z-p.z);if(d<=st.range&&v.x*ax+v.z*az>.35&&this.visible(p,e)){this.hitEnemy(e,dmg,false);if(++n>=2)break;}}
   return;
  }
  const length=6.5,end={x:p.x+ax*length,z:p.z+az*length};let hits=0;
  for(const e of this.enemies())if(!e.dead&&segmentDistance(e,p,end)<1.15+(e.kind==='boss'?1.2:0)&&this.visible(p,e)){this.hitEnemy(e,dmg*2.4,true);if(!e.dead)e.stun=Math.max(e.stun,e.kind==='boss'?.1:.5);hits++;}
  this.emit('slash',p,{dx:ax,dz:az,radius:length,color:0xffe9b8});this.emit('combo',p,{value:0,text:'finisher',visual:'finisher',dx:ax*length,dz:az*length,color:0xffe9b8});
  const step=hits?1.8:2.4;move(p,ax*step,az*step,(x,z)=>this.valid(x,z));
 }
 private inductor(ax:number,az:number,st:Stats){
  const p=this.p,targets=this.enemies().filter(e=>{if(e.dead)return false;const d=dist(e,p),v=norm(e.x-p.x,e.z-p.z);return d<=st.range&&v.x*ax+v.z*az>.55&&this.visible(p,e);}).sort((a,b)=>dist(a,p)-dist(b,p)).slice(0,4);
  const mult=1+.12*Math.max(0,targets.length-1),dmg=st.damage*st.weaponMul*mult;
  for(const e of targets){this.emit('cast',p,{dx:e.x-p.x,dz:e.z-p.z,color:0xb4fff0});this.hitEnemy(e,dmg,false);}
  if(!targets.length)this.emit('cast',p,{dx:ax*st.range*.7,dz:az*st.range*.7,color:0xb4fff0});
 }
 private discs(ax:number,az:number,st:Stats){
  const p=this.p,speed=18;this.addProjectile({x:p.x+ax*.7,z:p.z+az*.7},ax,az,speed,st.damage*st.weaponMul,false,st.range*1.25,99);
  const d=this.projectiles[this.projectiles.length-1];d.ttl*=2;d.turn=d.ttl/2;d.radius=.34;d.color=0xd7bbff;this.emit('shot',p,{dx:ax,dz:az,color:0xd7bbff});
 }
 private altSkill(ax:number,az:number,power:number,st:Stats){
  const p=this.p;
  if(p.classId==='lineman'){const length=st.baseRange+3;this.addHazard('line',p,.75,.12,.1,power*2.4,false,ax,az,length);this.emit('cast',p,{dx:ax*length,dz:az*length,color:0xb4fff0,visual:'lance'});}
  else if(p.classId==='harvester'){let hits=0;for(const e of this.enemies()){const d=dist(e,p);if(e.dead||d>9.5||!this.visible(e,p))continue;this.hitEnemy(e,power*1.1,true);if(!e.dead&&e.kind!=='boss'){const n=norm(e.x-p.x,e.z-p.z),pull=Math.min(4,Math.max(0,d-1.7));move(e,-n.x*pull,-n.z*pull,(x,z)=>this.valid(x,z,.65));e.stun=Math.max(e.stun,.9);hits++;}}
   p.hp=Math.min(st.hp,p.hp+Math.min(hits,4)*(this.state.upgrades.recovery??0)*8);this.emit('cast',p,{radius:9.5,color:0xf3cb83,visual:'anchor'});}
  else{p.dashTime=.17;p.dashX=ax;p.dashZ=az;p.invuln=Math.max(p.invuln,.34);this.addHazard('line',p,1.1,.04,.12,power*1.5,false,ax,az,7);this.emit('dash',p,{dx:ax,dz:az});this.emit('cast',p,{dx:ax*7,dz:az*7,color:0xd7bbff,visual:'gust'});}
 }

 snapshot(){return {phase:this.state.phase,player:{...this.p},stats:this.st,seed:this.state.seed,enemies:this.enemies().map(e=>({...e})),portals:this.state.phase==='world'?this.world.portals(this.p,1,this.state.seals.length===5):[],rooms:this.layout?.rooms??[],run:this.state.run?{id:this.state.run.id,tier:this.state.run.portal.tier,returnPos:this.state.run.returnPos,cleared:this.state.run.clearedRooms}:null,reward:this.state.reward,inventory:this.state.inventory,mailbox:this.state.mailbox,equipment:{...this.state.equipment},progress:{...this.state.stats},upgrades:this.state.upgrades,seals:[...this.state.seals],finalCleared:this.state.finalCleared,events:this.events.length,projectiles:this.projectiles.length,hazards:this.hazards.length};}
 navigationPath(to:Vec){if(!this.layout?.nav)return [];return pathTo(this.layout.nav,this.p,to);}
}
