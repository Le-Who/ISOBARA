import type {GameState,Portal,Vec,InputFrame,Stats,Enemy,Layout,Projectile,Hazard,GameEvent,Poi} from './types.js';
import {World,CHUNK} from '../world/world.js';
import {generateDungeon} from '../world/dungeon.js';
import {canWalk,move,lineClear,flowField,nextOnFlow,nearestIndex,navPoint,pathTo} from '../world/navigation.js';
import {stats,levelInfo,restorePlayer,instantiateEnemies,enemyNumbers,createReward,applyReward,makeItem,giveItem} from './progression.js';
import {RNG,hash,clamp,norm,dist,segmentDistance} from './math.js';
import {CLASSES,BOSSES,LORE} from './content.js';
const EMPTY:InputFrame={mx:0,mz:0,ax:0,az:-1,attack:false,skill:false,burst:false,dash:false,heal:false};
export class Simulation {
 state:GameState;world:World;layout:Layout|null=null;events:GameEvent[]=[];projectiles:Projectile[]=[];hazards:Hazard[]=[];
 time=0;private seq=1;private rng:RNG;private attackQueue:{time:number;ax:number;az:number}[]=[];
 private flow:Int32Array|null=null;private flowTimer=0;private exploreTimer=0;private stormTimer=6;private shotCount=0;private aimDistance=10;
 constructor(state:GameState){this.state=state;this.world=new World(state.seed);this.rng=new RNG(state.run?.rng??hash(state.seed,'combat'));if(state.run)this.layout=generateDungeon(state.run.portal,state.run.seed);}
 get p(){return this.state.player;}
 get st(){return stats(this.state);}
 emit(type:GameEvent['type'],p:Vec=this.p,more:Partial<GameEvent>={}){this.events.push({type,x:p.x,z:p.z,...more});if(this.events.length>256)this.events.shift();}
 drain(){return this.events.splice(0);}
 enemies(){return this.state.run?.enemies??[];}
 remaining(){return this.enemies().filter(e=>!e.dead).length;}
 bossLocked(){return this.enemies().some(e=>!e.dead&&e.kind!=='boss');}
 boss(){return this.enemies().find(e=>e.kind==='boss'&&!e.dead)??null;}
 portalEnter(p:Portal){
  if(this.state.phase!=='world'||dist(this.p,p)>7||p.final&&this.state.seals.length<5)return false;
  const canonical=this.world.getPortal(p.id);if(!canonical)return false;
  const serial=this.state.attempts+1,seed=hash(canonical.seed,'run',serial),layout=generateDungeon(canonical,seed);
  this.state.attempts=serial;const boons={health:this.state.mastery.health>0,energy:this.state.mastery.energy>0,fortune:this.state.mastery.fortune>0};
  for(const k of ['health','energy','fortune'] as const)if(boons[k])this.state.mastery[k]--;
  this.state.run={id:`run:${this.state.seed}:${canonical.id}:${serial}`,portal:{...canonical,mods:[...canonical.mods]},seed,enemies:instantiateEnemies(layout.spawns,canonical.tier),elapsed:0,restUsed:[],clearedRooms:[],rng:hash(seed,'combat'),returnPos:{x:canonical.x,z:canonical.z},serial,boons};
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
 goHome(){if(this.state.phase!=='world')return false;this.p.x=1.5;this.p.z=4;restorePlayer(this.state);this.emit('phase',this.p,{text:'world'});this.emit('save');return true;}
 travel(id:string){if(this.state.phase!=='world'||!this.state.completions[id])return false;const portal=this.world.getPortal(id);if(!portal)return false;this.p.x=portal.x;this.p.z=portal.z+4;restorePlayer(this.state);this.emit('phase',this.p,{text:'world'});this.emit('save');return true;}
 interactable():{kind:'portal'|'poi'|'exit'|'rest';data:Portal|Poi|{id:number;x:number;z:number};distance:number}|null {
  const choices:{kind:'portal'|'poi'|'exit'|'rest';data:Portal|Poi|{id:number;x:number;z:number};distance:number}[]=[];
  if(this.state.phase==='world'){
   for(const p of this.world.portals(this.p,1,this.state.seals.length===5)){const d=dist(p,this.p);if(d<6)choices.push({kind:'portal',data:p,distance:d});}
   for(const p of this.world.pois(this.p)){if(this.state.collected.includes(p.id)&&p.kind!=='camp')continue;const d=dist(p,this.p);if(d<4.5)choices.push({kind:'poi',data:p,distance:d});}
  }else if(this.state.phase==='expedition'&&this.layout&&this.state.run){
   const d=dist(this.p,this.layout.entry);if(d<3.5)choices.push({kind:'exit',data:{id:-1,...this.layout.entry},distance:d});
   for(const r of this.layout.rooms)if(r.role==='rest'&&!this.state.run.restUsed.includes(r.id)&&dist(r,this.p)<4)choices.push({kind:'rest',data:r,distance:dist(r,this.p)});
  }
  return choices.sort((a,b)=>a.distance-b.distance)[0]??null;
 }
 usePoi(p:Poi){
  if(this.state.phase!=='world'||dist(this.p,p)>5)return null;
  if(p.kind==='camp'){restorePlayer(this.state);this.emit('heal',this.p,{value:this.st.hp});this.emit('save');return 'Станция восстановила здоровье, заряд и ремкомплекты.';}
  if(this.state.collected.includes(p.id))return null;this.state.collected.push(p.id);
  if(p.kind==='archive'){const index=hash(p.seed,'lore')%LORE.length,id=`lore:${index}`;if(!this.state.journal.includes(id))this.state.journal.push(id);this.state.shards+=12;this.grantXp(25);this.emit('loot',p);this.emit('save');return `${LORE[index][0]}\n${LORE[index][1]}`;}
  const tier=clamp(Math.floor(Math.hypot(p.x,p.z)/52)+1,1,Math.min(5,Math.max(1,this.state.stats.bestTier+1)));
  const item=makeItem(hash(p.seed,'cache'),tier,this.p.classId,`${p.id}:item`);giveItem(this.state,item);this.state.shards+=6;this.emit('loot',p);this.emit('save');return `Найдено: ${item.name}. ${this.state.inventory.length>=24?'Проверьте снаряжение и хранилище.':'Предмет добавлен в снаряжение.'}`;
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
  if(input.attack&&p.cooldowns.attack<=0){p.cooldowns.attack=st.attackTime;this.attackQueue.push({time:this.p.classId==='harvester'?.09:.035,ax:p.faceX,az:p.faceZ});}
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
  if(this.state.phase!=='world'&&this.state.phase!=='expedition')return;
  this.updateProjectiles(dt,st);this.updateHazards(dt,st);if(this.state.run)this.state.run.rng=this.rng.state;
  this.exploreTimer-=dt;if(this.state.phase==='world'&&this.exploreTimer<=0){this.exploreTimer=.4;const key=`${Math.floor(p.x/CHUNK)},${Math.floor(p.z/CHUNK)}`;if(!this.state.explored.includes(key))this.state.explored.push(key);for(const portal of this.world.portals(p,1,this.state.seals.length===5))if(dist(portal,p)<31&&!this.state.discovered.includes(portal.id)){this.state.discovered.push(portal.id);this.emit('toast',portal,{text:`Обнаружен разлом: ${portal.title}`});this.emit('save');}}
 }
 private basic(ax:number,az:number,st:Stats){
  if(this.state.phase!=='world'&&this.state.phase!=='expedition')return;
  const p=this.p;
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
    for(let i=0;i<st.chain;i++){const target=this.enemies().filter(e=>!e.dead&&!hit.has(e.id)&&dist(e,origin)<(i?9:st.range)&&this.visible(e,origin)).sort((a,b)=>(i?dist(a,origin)-dist(b,origin):dist(a,aim)-dist(b,aim)))[0];if(!target)break;
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
 private visible(a:Vec,b:Vec){return !this.layout||lineClear(this.layout,a,b,.13);}
 private areaDamage(p:Vec,r:number,damage:number){for(const e of this.enemies())if(!e.dead&&dist(e,p)<r&&this.visible(e,p))this.hitEnemy(e,damage,true);}
 private addProjectile(p:Vec,dx:number,dz:number,speed:number,damage:number,enemy:boolean,range:number,pierce=0,source?:string){this.projectiles.push({id:this.seq++,x:p.x,z:p.z,vx:dx*speed,vz:dz*speed,radius:enemy?.25:.18,damage,ttl:range/speed,enemy,pierce,hit:[],color:enemy?0xff9475:CLASSES[this.p.classId].color,source});}
 private addHazard(kind:Hazard['kind'],p:Vec,radius:number,delay:number,ttl:number,damage:number,enemy:boolean,dx=1,dz=0,length=0,source?:string){this.hazards.push({id:this.seq++,kind,x:p.x,z:p.z,radius,delay,ttl,damage,enemy,dx,dz,length,tick:0,source});}
 private hitEnemy(e:Enemy,amount:number,ability:boolean){
  if(e.dead||this.state.phase!=='expedition')return;
  if(e.kind==='boss'&&this.bossLocked()){if(this.time%1.2<.08)this.emit('toast',e,{text:'Корона защищена. Завершите отмеченные на карте встречи.'});return;}
  const st=this.st;let damage=amount;
  if(st.effects.includes('first')&&e.hp>=e.maxHp-.01)damage*=1.25;
  if(e.kind==='warden'&&!ability){const n=norm(this.p.x-e.x,this.p.z-e.z);if(n.x*e.dx+n.z*e.dz>.45)damage*=.35;}
  const crit=this.rng.next()<st.crit;if(crit)damage*=1.65;
  e.hp=Math.max(0,e.hp-damage);this.emit('hit',e,{value:Math.round(damage),color:crit?0xffd992:0xf3f2dc});
  if(e.hp<=0)this.kill(e,st);
 }
 private kill(e:Enemy,st:Stats){
  if(e.dead||!this.state.run)return;e.dead=true;e.hp=0;e.windup=0;e.charge=0;this.state.stats.kills++;const codex=`enemy:${e.boss??e.kind}`;if(!this.state.journal.includes(codex))this.state.journal.push(codex);
  const tier=this.state.run.portal.tier;let xp=enemyNumbers(e.kind,tier,e.boss).xp;
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
  if(this.p.invuln>0||this.state.phase!=='expedition')return;
  let damage=amount*(1-this.st.armor)*(this.state.mode==='explorer'?.7:1)*(this.p.guard>0?.15:1);
  const shield=Math.min(this.p.shield,damage);this.p.shield-=shield;damage-=shield;
  this.p.hp=Math.max(0,this.p.hp-damage);this.p.invuln=.48;this.p.lastDamage=this.state.stats.seconds;this.emit('warning',this.p,{value:Math.round(damage),color:0xff8069});
  if(this.p.hp<=0){this.state.phase='dead';this.state.stats.deaths++;this.clearTransient();this.emit('phase',this.p,{text:'dead'});this.emit('save');}
 }
 private updateEnemy(e:Enemy,dt:number,st:Stats){
  const run=this.state.run;if(!run||!this.layout)return;
  e.stun=Math.max(0,e.stun-dt);if(e.stun>0)return;
  const d=dist(e,this.p);if(d>33&&dist(e,{x:e.homeX,z:e.homeZ})<1)return;
  if(e.kind==='boss'&&this.bossLocked())return;
  const numbers=enemyNumbers(e.kind,run.portal.tier,e.boss);let speed=numbers.speed*(run.portal.mods.includes('famine')?.85:1);
  for(const h of this.hazards)if(h.kind==='field'&&!h.enemy&&h.delay<=0&&dist(e,h)<h.radius)speed*=st.slow;
  if(e.charge>0){e.charge=Math.max(0,e.charge-dt);move(e,e.dx*19*dt,e.dz*19*dt,(x,z)=>canWalk(this.layout!,x,z,e.kind==='boss'?1.2:.65));if(dist(e,this.p)<(e.kind==='boss'?2.1:1.55))this.damagePlayer(numbers.damage*1.1,e);return;}
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
  else if(!visible&&this.flow){const next=nextOnFlow(this.layout.nav!,this.flow,e,this.p);dir=norm(next.x-e.x,next.z-e.z);}
  // Mild local separation prevents mobs stacking in narrow doorways.
  let sx=dir.x*sign,sz=dir.z*sign;
  for(const o of this.enemies())if(o!==e&&!o.dead){const dd=dist(e,o);if(dd>0.02&&dd<1.15){sx+=(e.x-o.x)/dd*.6;sz+=(e.z-o.z)/dd*.6;}}
  const n=norm(sx,sz);move(e,n.x*speed*dt,n.z*speed*dt,(x,z)=>canWalk(this.layout!,x,z,e.kind==='boss'?1.1:.62));
  // Recovery preserves the enemy and its HP, never fakes a kill.
  if(!canWalk(this.layout,e.x,e.z,.4)){const idx=nearestIndex(this.layout.nav!,e);if(idx>=0){const p=navPoint(this.layout.nav!,idx);e.x=p.x;e.z=p.z;e.timer=1;}}
 }
 private enemyAttack(e:Enemy,damage:number){
  if(e.dead||this.state.phase!=='expedition')return;
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
  for(const p of this.projectiles){p.ttl-=dt;if(p.ttl<=0)continue;const count=Math.max(1,Math.ceil(Math.hypot(p.vx,p.vz)*dt/.24));
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
 snapshot(){return {phase:this.state.phase,player:{...this.p},stats:this.st,seed:this.state.seed,enemies:this.enemies().map(e=>({...e})),portals:this.state.phase==='world'?this.world.portals(this.p,1,this.state.seals.length===5):[],rooms:this.layout?.rooms??[],run:this.state.run?{id:this.state.run.id,tier:this.state.run.portal.tier,returnPos:this.state.run.returnPos,cleared:this.state.run.clearedRooms}:null,reward:this.state.reward,inventory:this.state.inventory,mailbox:this.state.mailbox,equipment:{...this.state.equipment},progress:{...this.state.stats},upgrades:this.state.upgrades,seals:[...this.state.seals],finalCleared:this.state.finalCleared,events:this.events.length,projectiles:this.projectiles.length,hazards:this.hazards.length};}
 navigationPath(to:Vec){if(!this.layout?.nav)return [];return pathTo(this.layout.nav,this.p,to);}
}
