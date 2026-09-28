import {RNG,hash,noise,clamp,dist,segmentDistance} from '../core/math.js';
import type {Vec,Theme,Portal,Poi,Chunk,Modifier,Obstacle,Encounter} from '../core/types.js';
import {fixedEncounters,rollEncounter,NPC_SPOTS} from './encounters.js';
export const CHUNK=32, WORLD_RADIUS=232;
export function regionAt(x:number,z:number):Theme { const r=Math.hypot(x,z);return r<72?'garden':r<146?'foundry':'archive'; }
export function mainPortals(seed:number):Portal[] {
 const pos=[[21,-12],[57,-35],[100,-70],[142,-108],[191,-91]];
 const names=['Контур воды','Контур ветра','Контур тепла','Контур памяти','Контур грозы'];
 return pos.map(([x,z],i)=>({id:`main:${i+1}`,x,z,seed:hash(seed,'main',i+1),tier:i+1,theme:regionAt(x,z),mods:i===3?['echo']:i===4?['storm']:[],title:names[i],main:true,final:false}));
}
export function finalPortal(seed:number):Portal {return {id:'final',x:-8,z:-10,seed:hash(seed,'final'),tier:5,theme:'archive',mods:[],title:'Нулевой фронт',main:true,final:true};}
export function rawHeight(x:number,z:number,seed:number){return 2.4+noise(x*.019,z*.019,seed)*2.1+noise(x*.065,z*.065,seed^71)*.62+noise(x*.16,z*.16,seed^381)*.16;}
export function heightAt(x:number,z:number,seed:number){const r=Math.hypot(x,z);let h=rawHeight(x,z,seed);const f=clamp((r-6)/9,0,1);h=2.4+(h-2.4)*f;const coast=clamp((r-225)/24,0,1);return h*(1-coast)-3.4*coast;}
export function portalTier(distance:number,rng:RNG){
 if(distance<38)return 1;
 const mean=clamp(.6+distance/47,1,5);
 return rng.weighted([1,2,3,4,5],[1,2,3,4,5].map(t=>Math.exp(-((t-mean)**2)/1.28)));
}
export function portalMods(distance:number,rng:RNG):Modifier[]{
 if(distance<44||rng.next()>clamp((distance-35)/245,.08,.72))return [];
 const a=rng.pick<Modifier>(['echo','storm','famine']);
 if(distance>168&&a!=='famine'&&rng.next()<.18)return [a,'famine'];
 return [a];
}
export function roadDistance(x:number,z:number,seed:number){const pts:Vec[]=[{x:0,z:0},...mainPortals(seed)];let d=Infinity;for(let i=1;i<pts.length;i++)d=Math.min(d,segmentDistance({x,z},pts[i-1],pts[i]));return d;}
export function generateChunk(seed:number,cx:number,cz:number):Chunk {
 const id=`${cx},${cz}`,rng=new RNG(hash(seed,'props',cx,cz)),pRng=new RNG(hash(seed,'portals',cx,cz));
 const x0=cx*CHUNK,z0=cz*CHUNK;
 const mains=mainPortals(seed).filter(p=>Math.floor(p.x/CHUNK)===cx&&Math.floor(p.z/CHUNK)===cz);
 const portals:Portal[]=[...mains];
 const px=x0+pRng.range(8,24),pz=z0+pRng.range(8,24),d=Math.hypot(px,pz);
 if(pRng.next()<.47&&d>40&&d<218&&mainPortals(seed).every(p=>dist(p,{x:px,z:pz})>15)){
  const theme=regionAt(px,pz),tier=portalTier(d,pRng),mods=portalMods(d,pRng);
  const labels={garden:['Забытый водосбор','Стеклянная оранжерея','Островок росы'],foundry:['Спящий теплообменник','Медный коллектор','Дежурная котельная'],archive:['Осколок прогноза','Неоконченный оттепельник','Архив тишины']};
  portals.push({id:`p:${cx}:${cz}`,x:px,z:pz,seed:hash(seed,'portal-content',cx,cz),tier,theme,mods,title:pRng.pick(labels[theme]),main:false,final:false});
 }
 const pois:Poi[]=[];
 const pr=new RNG(hash(seed,'poi',cx,cz)),qx=x0+pr.range(6,26),qz=z0+pr.range(6,26);
 if(pr.next()<.40&&Math.hypot(qx,qz)>26&&Math.hypot(qx,qz)<216&&portals.every(p=>dist(p,{x:qx,z:qz})>11)){
  const kind=pr.pick<'archive'|'cache'|'camp'>(['archive','archive','cache','camp']);
  pois.push({id:`poi:${cx}:${cz}`,x:qx,z:qz,kind,seed:hash(seed,'poi-content',cx,cz),title:kind==='archive'?'Полевой архив':kind==='camp'?'Тихая стоянка':'Сервисный ящик'});
 }
 if(cx===0&&cz===0)pois.push({id:'home',kind:'camp',x:0,z:3,seed,title:'Станция «Изобара»'});
 const encounters:Encounter[]=fixedEncounters(seed).filter(e=>Math.floor(e.x/CHUNK)===cx&&Math.floor(e.z/CHUNK)===cz);
 {const avoid=[...portals,...pois,...mainPortals(seed),finalPortal(seed),{x:0,z:0},...fixedEncounters(seed),...Object.values(NPC_SPOTS)];
  const e=rollEncounter(seed,cx,cz,avoid,(x,z)=>roadDistance(x,z,seed));if(e)encounters.push(e);}
 const protect=[...mainPortals(seed),finalPortal(seed),...portals,...pois,{x:0,z:0},...Object.values(NPC_SPOTS),...encounters.flatMap(e=>e.device?[e,e.device]:[e])];
 const props:Chunk['props']=[],obstacles:Obstacle[]=[];
 for(let i=0;i<70;i++){
  const x=x0+rng.range(1,31),z=z0+rng.range(1,31),r=Math.hypot(x,z);
  if(r>233||r<10||protect.some(p=>dist(p,{x,z})<6.5)||roadDistance(x,z,seed)<3.2)continue;
  const u=rng.next(),kind=u<.16?'tree':u<.28?'rock':u<.34?'machine':u<.72?'grass':u<.92?'reed':'flower';
  const scale=rng.range(.65,1.5),rot=rng.range(0,Math.PI*2),color=rng.int(0,3);
  if((kind==='tree'||kind==='rock'||kind==='machine')&&obstacles.some(p=>dist(p,{x,z})<3.5))continue;
  props.push({x,z,kind,scale,rot,color});
  if(kind==='tree'||kind==='rock'||kind==='machine')obstacles.push({x,z,r:(kind==='rock'?.9:kind==='machine'?.9:.5)*scale,kind});
 }
 return {id,cx,cz,props,obstacles,portals,pois,encounters};
}
export class World {
 readonly seed:number;private chunks=new Map<string,Chunk>();readonly main:Portal[];
 constructor(seed:number){this.seed=seed;this.main=mainPortals(seed);}
 chunk(cx:number,cz:number){const key=`${cx},${cz}`;let c=this.chunks.get(key);if(!c){c=generateChunk(this.seed,cx,cz);this.chunks.set(key,c);if(this.chunks.size>64){const first=this.chunks.keys().next().value;if(first!==undefined)this.chunks.delete(first);}}return c;}
 nearby(pos:Vec,r=1){const cx=Math.floor(pos.x/CHUNK),cz=Math.floor(pos.z/CHUNK),a:Chunk[]=[];for(let x=cx-r;x<=cx+r;x++)for(let z=cz-r;z<=cz+r;z++)a.push(this.chunk(x,z));return a;}
 portals(pos:Vec,r=1,final=false){const a=this.nearby(pos,r).flatMap(c=>c.portals);if(final)a.push(finalPortal(this.seed));return a;}
 pois(pos:Vec,r=1){return this.nearby(pos,r).flatMap(c=>c.pois);}
 encounters(pos:Vec,r=1){return this.nearby(pos,r).flatMap(c=>c.encounters);}
 encounter(id:string):Encounter|null{if(id==='road')return fixedEncounters(this.seed)[0];const p=id.split(':');if(p.length===3&&p[0]==='e'){const cx=Number(p[1]),cz=Number(p[2]);if(Number.isInteger(cx)&&Number.isInteger(cz)&&Math.abs(cx)<9&&Math.abs(cz)<9)return this.chunk(cx,cz).encounters.find(e=>e.id===id)??null;}return null;}
 getPortal(id:string):Portal|null {if(id==='final')return finalPortal(this.seed);if(id.startsWith('main:'))return this.main[Number(id.slice(5))-1]??null;const parts=id.split(':');if(parts.length===3&&parts[0]==='p'){const cx=Number(parts[1]),cz=Number(parts[2]);if(Number.isInteger(cx)&&Number.isInteger(cz)&&Math.abs(cx)<9&&Math.abs(cz)<9)return this.chunk(cx,cz).portals.find(p=>p.id===id)??null;}return null;}
 canWalk(x:number,z:number,r=.46){if(Math.hypot(x,z)>WORLD_RADIUS-r||Math.hypot(x+3,z+2)<r+1.3)return false;for(const c of this.nearby({x,z},1))for(const o of c.obstacles)if(Math.hypot(x-o.x,z-o.z)<r+o.r)return false;return true;}
 cacheSize(){return this.chunks.size;}
}
