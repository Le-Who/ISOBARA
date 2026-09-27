// Campaign acceptance at the simulation boundary: only normal input frames and public
// game actions (enter, rest, claim, equip, return home). No teleports, HP edits or kill helpers.
import fs from 'node:fs';
import {Simulation} from '../.test-build/core/simulation.js';
import {newGame,stats,equipItem,craftItem} from '../.test-build/core/progression.js';
import {norm,dist,clamp} from '../.test-build/core/math.js';
import {pathTo,canWalk,lineClear} from '../.test-build/world/navigation.js';
import {envelope,unpack} from '../.test-build/core/validation.js';
const dt=1/60,base={mx:0,mz:0,ax:0,az:1,aimDistance:10,attack:false,skill:false,burst:false,dash:false,heal:false};
function travel(sim,goal,radius=1,maxSeconds=140){let stuck=0;for(let t=0;t<maxSeconds*60;t++){if(dist(sim.p,goal)<radius)return true;const p=sim.p,n=norm(goal.x-p.x,goal.z-p.z);let direction=n;
 if(!sim.world.canWalk(p.x+n.x*1.2,p.z+n.z*1.2,.46)){const options=[Math.PI/3,-Math.PI/3,Math.PI/2,-Math.PI/2,Math.PI].map(a=>({x:n.x*Math.cos(a)-n.z*Math.sin(a),z:n.x*Math.sin(a)+n.z*Math.cos(a)}));direction=options.find(v=>sim.world.canWalk(p.x+v.x*1.3,p.z+v.z*1.3))??{x:0,z:0};}
 const before={x:p.x,z:p.z};sim.tick(dt,{...base,mx:direction.x,mz:direction.z,ax:n.x,az:n.z,dash:dist(p,goal)>8&&sim.p.cooldowns.dash===0});sim.drain();if(dist(p,before)<.001)stuck++;else stuck=0;if(stuck>180)return false;}return false;}
function bestGear(sim){const s=sim.state;for(const slot of ['instrument','shell','relic']){const best=s.inventory.filter(i=>i.slot===slot).sort((a,b)=>score(b)-score(a))[0];if(best)equipItem(s,best.id);}}
function score(i){return i.damage*4+i.hp*.8+i.armor*230+i.crit*150+i.haste*160+(i.effect!=='none'?18:0);}
function claim(sim){const priorities=sim.p.classId==='harvester'?['siphon','recovery','health','armor','power','cleave','haste','reach','bulwark']:sim.p.classId==='aerologist'?['siphon','stormEye','health','pellets','linger','power','skillPower','armor','haste']:['siphon','health','power','pierce','chain','armor','haste','double','skillPower'];
 const offers=sim.state.reward.offers;let index=0,best=-1;offers.forEach((o,i)=>{const rank=priorities.indexOf(o.id),score=rank<0?1:100-rank*6;if(score>best){best=score;index=i;}});const name=offers[index].id;if(!sim.claim(index))throw new Error('Valid reward was rejected');sim.drain();bestGear(sim);return name;}
function fight(sim,maxSeconds=420){let target=null,route=[],routeTime=0,restGoal=null,totalDamage=0,oldHp=sim.p.hp,ticks=0;
 for(;ticks<maxSeconds*60&&sim.state.phase==='expedition';ticks++){
  const p=sim.p,st=sim.st,l=sim.layout;routeTime-=dt;const alive=sim.enemies().filter(e=>!e.dead),normal=alive.filter(e=>e.kind!=='boss');
  if(!target||target.dead){target=(normal.length?normal:alive).sort((a,b)=>a.room-b.room||dist(p,a)-dist(p,b))[0];route=[];routeTime=0;}
  if(!target)break;
  const heal=p.hp/st.hp<.61&&p.potions>0;
  if(p.hp/st.hp<.64&&p.potions<1&&!restGoal){restGoal=l.rooms.filter(r=>r.role==='rest'&&!sim.state.run.restUsed.includes(r.id)).sort((a,b)=>dist(p,a)-dist(p,b))[0]??null;if(restGoal&&dist(p,restGoal)>70)restGoal=null;}
  if(restGoal&&dist(p,restGoal)<3.5){sim.rest(restGoal.id);restGoal=null;routeTime=0;}
  const goal=restGoal??target,d=dist(p,target),visible=lineClear(l,p,target,.14),walkVisible=lineClear(l,p,goal,.55),desired=p.classId==='harvester'?Math.min(3.0,st.range-.6):p.classId==='lineman'?8.8:7.3;
  let direction={x:0,z:0};
  if(restGoal||!walkVisible||d>desired+1.7){
   if(walkVisible)direction=norm(goal.x-p.x,goal.z-p.z);
   else{if(routeTime<=0||!route.length){route=pathTo(l.nav,p,goal);routeTime=.42;}while(route.length&&dist(p,route[0])<.66)route.shift();if(route.length)direction=norm(route[0].x-p.x,route[0].z-p.z);}
  }else if(d<desired-1.1)direction=norm(p.x-target.x,p.z-target.z);
  else{const n=norm(p.x-target.x,p.z-target.z),sign=Math.floor(sim.time/13)%2?1:-1;direction={x:-n.z*sign,z:n.x*sign};}
  let dash=false;
  for(const h of sim.hazards){if(!h.enemy||h.damage===0||h.delay>.40)continue;let danger=false,avoid;
   if(h.kind==='line'){const a={x:p.x-h.x,z:p.z-h.z},along=a.x*h.dx+a.z*h.dz,side=a.x*(-h.dz)+a.z*h.dx;if(along>-1&&along<h.length+1&&Math.abs(side)<h.radius+1.1){danger=true;avoid={x:-h.dz*(side>=0?1:-1),z:h.dx*(side>=0?1:-1)};}}
   else if(h.kind==='ring'){if(h.delay<=0&&Math.abs(dist(p,h)-h.radius)<2){danger=true;avoid=norm(p.x-h.x,p.z-h.z);}}
   else if(dist(p,h)<h.radius+1){danger=true;avoid=norm(p.x-h.x,p.z-h.z);if(!avoid.x&&!avoid.z)avoid=norm(p.x-target.x,p.z-target.z);}
   if(danger){direction=avoid;dash=h.delay<.18;break;}
  }
  if(target.windup>0&&target.windup<.25&&d<(target.kind==='boss'?4.5:3.2)){direction=norm(p.x-target.x,p.z-target.z);dash=true;}
  for(const shot of sim.projectiles){if(!shot.enemy)continue;const vx=shot.vx,vz=shot.vz,t=clamp(((p.x-shot.x)*vx+(p.z-shot.z)*vz)/(vx*vx+vz*vz),0,.32),future={x:shot.x+vx*t,z:shot.z+vz*t};if(dist(p,future)<1.0){const n=norm(-vz,vx);if(canWalk(l,p.x+n.x*2,p.z+n.z*2,.46))direction=n;else direction={x:-n.x,z:-n.z};if(t<.10)dash=true;break;}}
  if(!canWalk(l,p.x+direction.x*1.0,p.z+direction.z*1.0,.46)){
   const n=direction;direction=[{x:-n.z,z:n.x},{x:n.z,z:-n.x},{x:-n.x,z:-n.z}].find(v=>canWalk(l,p.x+v.x*1.2,p.z+v.z*1.2,.46))??{x:0,z:0};
  }
  const aim=norm(target.x-p.x,target.z-p.z),burst=visible&&d<(p.classId==='harvester'?6.2:11)&&p.energy>=45&&p.cooldowns.burst===0,skill=!burst&&visible&&d<(p.classId==='harvester'?8:14)&&p.energy>=25&&p.cooldowns.skill===0;
  sim.tick(dt,{mx:direction.x,mz:direction.z,ax:aim.x,az:aim.z,aimDistance:d,attack:visible&&d<st.range+1,skill,burst,dash:dash&&p.cooldowns.dash===0,heal});
  if(sim.p.hp<oldHp)totalDamage+=oldHp-sim.p.hp;oldHp=sim.p.hp;sim.drain();
 }
 return {phase:sim.state.phase,ticks,seconds:ticks/60,hp:sim.p.hp,totalDamage,remaining:sim.remaining(),position:{x:sim.p.x,z:sim.p.z},target:target?{id:target.id,x:target.x,z:target.z,hp:target.hp,kind:target.kind}:null};
}
export function campaign(seed,classId){let sim=new Simulation(newGame(seed,classId,'standard'));const records=[],started=performance.now();let deaths=0;
 for(let tier=1;tier<=6;tier++){
  let success=false;
  for(let attempt=0;attempt<4;attempt++){
   if(tier===6||attempt>0){if(sim.state.phase==='dead'){sim.respawn();sim.drain();deaths++;}else if(sim.state.phase==='expedition'){sim.abandon();sim.drain();}sim.goHome();sim.drain();}
   const portal=tier===6?sim.world.getPortal('final'):sim.world.main[tier-1];
   const road=tier===6?[{x:0,z:0},portal]:attempt>0?[{x:0,z:0},...sim.world.main.slice(0,tier)]:tier===1?[{x:0,z:0},portal]:[sim.world.main[tier-2],portal];
   for(let i=0;i<road.length;i++){if(!travel(sim,road[i],i===road.length-1?3.0:.7))return {seed,classId,passed:false,reason:'World route blocked',tier,position:{x:sim.p.x,z:sim.p.z},records,deaths};}
   if(!sim.portalEnter(portal))return {seed,classId,passed:false,reason:'Portal rejected',tier,records,deaths};sim.drain();
   // A normal save/reload checkpoint is exercised once, before combat begins.
   if(tier===2&&attempt===0)sim=new Simulation(unpack(envelope(sim.state)));
   const result=fight(sim);const record={tier,attempt:attempt+1,...result,level:sim.st.level};records.push(record);
   if(sim.state.phase==='reward'){record.upgrade=claim(sim);success=true;break;}
  }
  if(!success)return {seed,classId,passed:false,reason:'Combat or navigation did not finish',tier,records,deaths,wallMs:performance.now()-started};
 }
 return {seed,classId,passed:sim.state.finalCleared&&sim.state.phase==='epilogue',records,deaths,kills:sim.state.stats.kills,portalWins:sim.state.stats.portals,gameSeconds:sim.state.stats.seconds,level:sim.st.level,wallMs:performance.now()-started};
}
const classes=process.argv.includes('--all-seeds')?['lineman','harvester','aerologist']:['lineman','harvester','aerologist'];
const seeds=process.argv.includes('--all-seeds')?[19320422,7342,90017]:[19320422];
const report={method:'Production simulation; normal input frames and legitimate game actions. No state cheats. This is not a browser-rendering or human playtest.',environment:{node:process.version},results:[]};
for(const seed of seeds)for(const classId of classes){const result=campaign(seed,classId);report.results.push(result);console.log(JSON.stringify(result));fs.mkdirSync('evidence',{recursive:true});fs.writeFileSync('evidence/campaign-tests.json',JSON.stringify(report,null,2));}
if(report.results.some(r=>!r.passed))process.exitCode=1;
