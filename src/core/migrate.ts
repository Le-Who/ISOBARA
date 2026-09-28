// Data, world generation, and combat rules are versioned separately. Migrations
// never change their input, so a failed import cannot damage a loaded snapshot.
export const DATA_VERSION=2;
export const GENERATOR_VERSION=2;
export const RULES_VERSION=2;

const oldNeeded=(level:number)=>60+level*35;
const newNeeded=(level:number)=>level<=5?[70,90,115,150,195][level-1]:60+level*35+Math.max(0,level-8)*16;

export function convertXp(xp:number){
 let level=1,left=xp;
 while(level<20&&left>=oldNeeded(level)){left-=oldNeeded(level);level++;}
 let total=0;
 for(let l=1;l<level;l++)total+=newNeeded(l);
 return Math.min(20_000_000,level===20?total+Math.max(0,left):total+Math.min(left,newNeeded(level)-1));
}

export function migrate(input:any):any{
 if(!input||typeof input!=='object'||Array.isArray(input))return input;
 if(input.version===DATA_VERSION&&input.generator===GENERATOR_VERSION&&input.rules===RULES_VERSION)return input;
 const legacy=input.version===1&&input.generator===1&&(input.rules===undefined||input.rules===1);
 const candidate=input.version===2&&input.generator===1&&input.rules===undefined;
 if(!legacy&&!candidate)throw new Error('Версия сохранения не поддерживается этой сборкой. Исходный файл не изменён.');
 const copy=structuredClone(input);
 if(legacy){
  if(copy.player&&typeof copy.player.xp==='number'&&Number.isFinite(copy.player.xp)&&copy.player.xp>=0)copy.player.xp=convertXp(copy.player.xp);
  copy.encounters={};copy.npcs={};copy.loadout={skill:'default'};copy.blueprints=[];copy.rank={selected:0,best:0};
 }
 copy.version=DATA_VERSION;
 copy.generator=GENERATOR_VERSION;
 copy.rules=RULES_VERSION;
 return copy;
}
