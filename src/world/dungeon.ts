import type {Layout,Portal,Room,Spawn,EnemyKind,Vec} from '../core/types.js';
import {RNG,hash,dist} from '../core/math.js';
import {TIER_BOSSES} from '../core/content.js';
import {canWalk,buildNav,flowField,nearestIndex,inRoom,lineClear} from './navigation.js';
export interface ModuleDef {id:string;name:string;w:number;d:number;shape:Room['shape'];obstacles:[number,number,number][];connectors:{direction:string;x:number;z:number;width:number;height:number}[]}
const defineModule=(id:string,name:string,w:number,d:number,shape:Room['shape'],obstacles:[number,number,number][]):ModuleDef=>({id,name,w,d,shape,obstacles,connectors:[{direction:'E',x:w/2,z:0,width:6,height:8},{direction:'W',x:-w/2,z:0,width:6,height:8},{direction:'S',x:0,z:d/2,width:6,height:8},{direction:'N',x:0,z:-d/2,width:6,height:8}]});
export const MODULES:ModuleDef[]=[
 defineModule('dock','Приёмный причал',18,18,'rect',[]),
 defineModule('glasshouse','Стеклянный сад',22,18,'rect',[[-7,-5,1.2],[7,5,1.2]]),
 defineModule('cistern','Восьмигранный водосбор',22,22,'octagon',[[-5,5,1.2],[5,-5,1.2]]),
 defineModule('cross','Распределительный узел',24,24,'cross',[]),
 defineModule('gallery','Сервисная галерея',26,14,'rect',[[-8,-4,1],[8,4,1]]),
 defineModule('boiler','Теплообменная камера',20,20,'rect',[[-6,-6,1.6],[6,6,1.6]]),
 defineModule('turbine','Турбинный зал',24,24,'octagon',[[-6,-6,1.1],[6,-6,1.1],[-6,6,1.1],[6,6,1.1]]),
 defineModule('archive','Палата отсчёта',26,18,'rect',[[-8,-5,1.1],[8,5,1.1]]),
 defineModule('lens','Перекрёсток линз',24,24,'cross',[]),
 defineModule('crown','Зал центральной короны',28,28,'octagon',[]),
 defineModule('terrace','Тихая терраса',16,16,'rect',[[5,5,1]])
];
export const MODULE_BY_ID=Object.fromEntries(MODULES.map(m=>[m.id,m]));
const POOLS={garden:['glasshouse','cistern','cross','gallery'],foundry:['boiler','turbine','gallery','cross'],archive:['archive','lens','cistern','gallery']};
const SPACING=36;
function makeRoom(id:number,gx:number,gz:number,moduleId:string,role:Room['role'],rotation:number):Room {
 const m=MODULE_BY_ID[moduleId],rot=(x:number,z:number):Vec=>rotation===0?{x,z}:rotation===1?{x:-z,z:x}:rotation===2?{x:-x,z:-z}:{x:z,z:-x};
 const w=rotation%2?m.d:m.w,d=rotation%2?m.w:m.d;
 return {id,gx,gz,x:gx*SPACING,z:gz*SPACING,module:moduleId,w,d,shape:m.shape,role,rotation,obstacles:m.obstacles.map(([x,z,r])=>{const p=rot(x,z);return {x:p.x+gx*SPACING,z:p.z+gz*SPACING,r,kind:'pillar'};}),spawns:[]};
}
function assemble(portal:Portal,seed:number,fallback=false):Layout {
 const rng=new RNG(hash(seed,'layout')),count=4+Math.ceil(portal.tier/2)+(portal.final?1:0),coords:[[number,number]]|[number,number][]=[[0,0]],used=new Set(['0,0']);
 for(let i=1;i<count;i++){
  const [x,z]=coords[coords.length-1];const dirs=fallback?[[1,0]]:rng.shuffle([[1,0],[1,0],[0,-1],[0,1],[-1,0]]);
  const next=dirs.map(([dx,dz])=>[x+dx,z+dz]).find(([nx,nz])=>!used.has(`${nx},${nz}`));
  if(!next)throw new Error('Walk exhausted');coords.push([next[0],next[1]]);used.add(next.join(','));
 }
 const rooms:Room[]=coords.map(([x,z],i)=>makeRoom(i,x,z,i===0?'dock':i===count-1?'crown':rng.pick(POOLS[portal.theme]),i===0?'entry':i===count-1?'boss':'combat',rng.int(0,3)));
 const edges:[number,number][]=[];for(let i=1;i<count;i++)edges.push([i-1,i]);
 for(let j=0;j<(portal.tier>=3?2:1);j++){
  const parent=rng.int(1,count-2),r=rooms[parent];const next=rng.shuffle([[1,0],[0,-1],[0,1],[-1,0]]).map(([dx,dz])=>[r.gx+dx,r.gz+dz]).find(([x,z])=>!used.has(`${x},${z}`));
  if(next){const id=rooms.length;rooms.push(makeRoom(id,next[0],next[1],'terrace','rest',0));edges.push([parent,id]);used.add(next.join(','));}
 }
 const corridors=edges.map(([a,b])=>{const r=rooms[a],s=rooms[b];return {from:a,to:b,x:(r.x+s.x)/2,z:(r.z+s.z)/2,w:r.x===s.x?6:SPACING,d:r.z===s.z?6:SPACING};});
 const l:Layout={seed,tier:portal.tier,theme:portal.theme,rooms,corridors,spawns:[],entry:{x:0,z:0},bossRoom:count-1,fallback};
 const erng=new RNG(hash(seed,'encounters'));
 for(const r of rooms){
  if(r.role!=='combat'&&r.role!=='boss')continue;
  const amount=r.role==='boss'?1:Math.min(6,3+Math.floor(portal.tier/2)+(r.id%2));
  let candidates:Vec[]=[];
  for(let x=-7;x<=7;x+=3.5)for(let z=-7;z<=7;z+=3.5){const p={x:r.x+x,z:r.z+z};if(canWalk(l,p.x,p.z,.82)&&inRoom(r,p.x,p.z,2.5)&&Math.hypot(x,z)>3)candidates.push(p);}
  candidates=erng.shuffle(candidates);
  if(r.role==='boss')candidates=[{x:r.x,z:r.z}];
  if(candidates.length<amount)throw new Error('Insufficient spawn space');
  const roster:EnemyKind[]=portal.tier===1?['mite','mite','sentry']:portal.tier===2?['mite','sentry','ram']:portal.tier===3?['sentry','ram','mender','mite']:['sentry','ram','mender','mortar','warden','mite'];
  let menders=0;for(let i=0;i<amount;i++){
   const p=candidates[i];let kind:EnemyKind=r.role==='boss'?'boss':erng.pick(roster);if(kind==='mender'){if(menders)kind='mite';else menders++;}
   r.spawns.push(p);l.spawns.push({id:`e:${r.id}:${i}`,kind,room:r.id,x:p.x,z:p.z,...(kind==='boss'?{boss:portal.final?'front' as const:TIER_BOSSES[portal.tier]}:{})});
  }
 }
 return l;
}
export function validateLayout(l:Layout):{valid:boolean;reason:string;reachable:number} {
 if(l.rooms.length<5||l.rooms.length>12||l.spawns.length>60)return {valid:false,reason:'Size budget',reachable:0};
 for(const r of l.rooms){if(!MODULE_BY_ID[r.module])return {valid:false,reason:'Unknown module',reachable:0};for(const s of l.rooms)if(r.id<s.id&&Math.abs(r.x-s.x)<(r.w+s.w)/2&&Math.abs(r.z-s.z)<(r.d+s.d)/2)return {valid:false,reason:'Module overlap',reachable:0};}
 const nav=buildNav(l),flow=flowField(nav,l.entry);l.nav=nav;
 for(const p of [...l.rooms,...l.spawns]){const idx=nearestIndex(nav,p);if(idx<0||flow[idx]<0||!canWalk(l,p.x,p.z,.46))return {valid:false,reason:`Unreachable ${'id' in p?p.id:'target'}`,reachable:0};}
 for(const c of l.corridors)if(!lineClear(l,l.rooms[c.from],l.rooms[c.to],.55))return {valid:false,reason:'Blocked connector',reachable:0};
 const reachable=flow.reduce((n,v)=>n+(v>=0?1:0),0);
 if(reachable!==nav.count)return {valid:false,reason:'Isolated navigable pocket',reachable};
 return {valid:true,reason:'OK',reachable};
}
export function generateDungeon(portal:Portal,seed:number,forceFallback=false):Layout {
 if(!Number.isInteger(portal.tier)||portal.tier<1||portal.tier>5)throw new Error('Unsupported portal tier');
 if(!forceFallback)for(let i=0;i<4;i++){try{const l=assemble(portal,hash(seed,i));if(validateLayout(l).valid)return l;}catch{/* bounded retry, followed by deterministic safe layout */}}
 // The safe template still uses all room themes, a boss, combat and rewards.
 const l=assemble(portal,hash(seed,'safe'),true),v=validateLayout(l);
 if(!v.valid)throw new Error(`Fallback layout invalid: ${v.reason}`);
 return l;
}
