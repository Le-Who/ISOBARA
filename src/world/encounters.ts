// WORLD-04/05: deterministic catalogue of short overworld adventures. Composition is immutable;
// progress (done/disabled/remaining hp) lives in GameState.encounters.
import {RNG,hash,clamp} from '../core/math.js';
import type {Encounter,EnemyKind,Vec} from '../core/types.js';
export const SAFE_RADIUS=10;        // around the station nothing may attack the hero
export const AGGRO_RADIUS=8.5;      // sleeping machines notice the hero from here
export const LEASH_RADIUS=30;       // pursuit is abandoned beyond this distance from the encounter
export const SPAWN_RADIUS=58;       // encounters closer than this are instantiated
export const NPC_SPOTS:Record<string,Vec>={irma:{x:4.2,z:7.4},sa7:{x:5.2,z:-6.8},lea:{x:-9.2,z:11.2}};
export function fixedEncounters(seed:number):Encounter[]{
 return [{id:'road',kind:'patrol',title:'Неисправный сервисный патруль',x:14,z:5,tier:1,seed:hash(seed,'enc','road'),units:['mite','mite','sentry'],device:{x:6,z:14},fixed:true}];
}
const NAMED=['Старший уплотнитель «Тихий шаг»','Барометр-ветеран «Пролив»','Заслонщик «Вечерняя смена»','Прививщик «Последний обход»'];
export function encounterTier(x:number,z:number){return clamp(Math.floor(Math.hypot(x,z)/52)+1,1,5);}
export function rollEncounter(seed:number,cx:number,cz:number,avoid:Vec[],roadDistance:(x:number,z:number)=>number):Encounter|null{
 const rng=new RNG(hash(seed,'enc',cx,cz)),x=cx*32+rng.range(5,27),z=cz*32+rng.range(5,27),d=Math.hypot(x,z);
 if(rng.next()>=.4||d<38||d>214||avoid.some(p=>Math.hypot(p.x-x,p.z-z)<13))return null;
 const tier=encounterTier(x,z),u=rng.next();
 const kind:Encounter['kind']=d<70?(u<.9?'patrol':'named'):(u<.5?'patrol':u<.88?'meteo':'named');
 if(kind==='patrol'&&roadDistance(x,z)<9)return null;
 let units:EnemyKind[];let device:Vec|undefined,title:string;
 if(kind==='patrol'){
  const pool:EnemyKind[]=['mite','mite','sentry','mender'];
  units=Array.from({length:2+(tier>=3?1:0)+(tier>=5?1:0)},()=>rng.pick(pool));
  title='Неисправный сервисный патруль';
  const angle=rng.range(0,Math.PI*2);
  for(let i=0;i<24;i++){
   const a=angle+i*Math.PI/12,candidate={x:x+Math.cos(a)*11.5,z:z+Math.sin(a)*11.5};
   if(candidate.x<cx*32+6.5||candidate.x>cx*32+25.5||candidate.z<cz*32+6.5||candidate.z>cz*32+25.5)continue;
   if(Math.hypot(candidate.x,candidate.z)>225||avoid.some(p=>Math.hypot(p.x-candidate.x,p.z-candidate.z)<7))continue;
   device=candidate;break;
  }
 }
 else if(kind==='meteo'){units=['mortar',rng.pick<EnemyKind>(['warden','ram']),'sentry'];if(tier>=3)units.push('mender');title='Аварийный метеоузел';}
 else{units=[rng.pick<EnemyKind>(['ram','warden','mortar']),'mender'];title=rng.pick(NAMED);}
 return {id:`e:${cx}:${cz}`,kind,title,x,z,tier,seed:hash(seed,'enc-content',cx,cz),units,device};
}
export function unitPositions(enc:Encounter,walk:(x:number,z:number,r:number)=>boolean):Vec[]{
 return enc.units.map((_,i)=>{const n=enc.units.length,base=enc.seed%7;for(const rad of [2.6,1.6,.6,0]){const a=base+i*Math.PI*2/n,x=enc.x+Math.cos(a)*rad,z=enc.z+Math.sin(a)*rad;if(walk(x,z,.65))return {x,z};}return {x:enc.x,z:enc.z};});
}
export const ENCOUNTER_INFO:Record<Encounter['kind'],{label:string;hint:string}>={
 patrol:{label:'ПАТРУЛЬ',hint:'Можно обойти, победить или отключить питание у щитка неподалёку.'},
 meteo:{label:'МЕТЕОУЗЕЛ',hint:'Охраняемый узел: победа возвращает детали и добычу.'},
 named:{label:'ИМЕННАЯ МАШИНА',hint:'Добровольный трудный бой: гарантированная добыча и чертёж-заготовка.'}
};
