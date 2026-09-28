import type {GameState,Item,Settings} from './types.js';
import {CLASSES,UPGRADE_BY_ID,DEFAULT_SETTINGS} from './content.js';
import {hash} from './math.js';
import {World} from '../world/world.js';
import {generateDungeon} from '../world/dungeon.js';
import {enemyNumbers} from './progression.js';
import {migrate,DATA_VERSION,GENERATOR_VERSION,RULES_VERSION} from './migrate.js';
import {FAMILIES,ALT_FAMILY} from './weapons.js';
import {NPCS} from './dialogue.js';
const fail=(s:string):never=>{throw new Error(s);};
const object=(x:any,name:string)=>{if(!x||typeof x!=='object'||Array.isArray(x))fail(`Повреждён объект «${name}».`);return x;};
const number=(x:any,min:number,max:number,name:string,integer=false)=>{if(typeof x!=='number'||!Number.isFinite(x)||x<min||x>max||(integer&&!Number.isInteger(x)))fail(`Некорректное число: ${name}.`);};
const text=(x:any,max:number,name:string)=>{if(typeof x!=='string'||x.length>max)fail(`Некорректный текст: ${name}.`);};
const list=(x:any,max:number,name:string)=>{if(!Array.isArray(x)||x.length>max)fail(`Некорректный список: ${name}.`);return x as any[];};
function dangerous(x:any,depth=0){if(depth>16)fail('Слишком глубокая структура сохранения.');if(x&&typeof x==='object')for(const key of Object.keys(x)){if(key==='__proto__'||key==='constructor'||key==='prototype')fail('Недопустимый ключ в сохранении.');dangerous(x[key],depth+1);}}
function item(x:any,classId?:string){object(x,'предмет');if(x.family!==undefined){if(typeof x.family!=='string'||!FAMILIES[x.family]||x.slot!=='instrument'||(classId&&FAMILIES[x.family].classId!==classId))fail('Неизвестное семейство инструмента.');}if(x.fav!==undefined&&typeof x.fav!=='boolean')fail('Повреждена отметка избранного.');text(x.id,180,'ID предмета');text(x.name,120,'название предмета');if(!['instrument','shell','relic'].includes(x.slot))fail('Неизвестный слот предмета.');if(!['fork','vest','orb','gauge','coil','furnace','tonic','prism','cloak','rotor','seed','void','inductor','strippers','discs'].includes(x.icon))fail('Неизвестная иллюстрация.');number(x.tier,1,5,'уровень предмета',true);number(x.rarity,1,4,'редкость',true);for(const key of ['damage','hp','armor','crit','haste'])number(x[key],0,1000,key);if(!['none','first','barrier','battery','siphon'].includes(x.effect))fail('Неизвестное свойство предмета.');}
export function validateState(input:any,geometry=false):GameState {
 dangerous(input);input=migrate(input);const s=object(input,'сохранение');if(s.version!==DATA_VERSION||s.generator!==GENERATOR_VERSION||s.rules!==RULES_VERSION)fail('Версия сохранения не поддерживается этой сборкой. Исходный файл не изменён.');
 number(s.seed,0,4294967295,'зерно мира',true);if(!['world','expedition','reward','dead','epilogue'].includes(s.phase))fail('Неизвестное состояние игры.');if(!['standard','explorer'].includes(s.mode))fail('Неизвестный режим сложности.');
 const p=object(s.player,'персонаж');if(!CLASSES[p.classId as keyof typeof CLASSES])fail('Неизвестная специализация.');
 for(const k of ['x','z'])number(p[k],-2048,2048,k);for(const k of ['faceX','faceZ','dashX','dashZ'])number(p[k],-1.01,1.01,k);
 number(p.hp,0,10000,'здоровье');number(p.energy,0,100,'энергия');number(p.xp,0,2e7,'опыт');number(p.potions,0,10,'ремкомплекты',true);
 for(const k of ['invuln','dashTime','guard'])number(p[k],0,20,k);number(p.shield,0,1000,'щит');number(p.lastDamage,0,1e9,'время урона');
 object(p.cooldowns,'перезарядки');for(const k of ['attack','skill','burst','dash','heal'])number(p.cooldowns[k],0,120,k);
 const inventory=list(s.inventory,24,'инвентарь'),mail=list(s.mailbox,2000,'хранилище');for(const x of [...inventory,...mail])item(x,p.classId);const ids=[...inventory,...mail].map(x=>x.id);if(new Set(ids).size!==ids.length)fail('Повторяющиеся экземпляры предметов.');
 object(s.equipment,'экипировка');for(const [slot,id] of Object.entries(s.equipment)){if(!['instrument','shell','relic'].includes(slot)||!inventory.some(i=>i.id===id&&i.slot===slot))fail('Экипирован отсутствующий предмет.');}
 object(s.upgrades,'улучшения');for(const [id,r] of Object.entries(s.upgrades)){const def=UPGRADE_BY_ID[id];if(!def||def.classId&&def.classId!==p.classId)fail('Неизвестное или несовместимое улучшение.');number(r,0,def.max,id,true);}
 for(const k of ['shards','respecPoints','crafts','attempts','rareMisses'])number(s[k],0,k==='respecPoints'?500:1e8,k,true);
 for(const k of ['discovered','explored','collected','journal'])for(const value of list(s[k],k==='journal'?100:3000,k))text(value,120,k);
 list(s.seals,5,'контуры');for(const v of s.seals)number(v,1,5,'контур',true);if(new Set(s.seals).size!==s.seals.length)fail('Повторяющийся контур.');
 object(s.completions,'завершённые порталы');if(Object.keys(s.completions).length>1500)fail('Слишком много порталов.');for(const n of Object.values(s.completions))number(n,0,1e7,'прохождения',true);
 object(s.stats,'статистика');for(const k of ['kills','portals','deaths','seconds'])number(s.stats[k],0,1e9,k);number(s.stats.bestTier,0,5,'лучший уровень',true);
 object(s.mastery,'мастерство');for(const k of ['health','energy','fortune'])number(s.mastery[k],0,1e7,k,true);
 if(typeof s.finalCleared!=='boolean')fail('Повреждён статус финала.');
 object(s.encounters,'встречи');const encKeys=Object.keys(s.encounters);if(encKeys.length>600)fail('Слишком много встреч.');
 const world=new World(s.seed);
 for(const key of encKeys){
  if(!/^(road|e:-?\d{1,2}:-?\d{1,2})$/.test(key))fail('Неизвестная встреча.');
  const def=world.encounter(key)??fail('Встреча не существует в этом мире.');
  const e=object(s.encounters[key],'встреча');
  if(typeof e.done!=='boolean'||typeof e.disabled!=='boolean'||e.disabled&&!e.done)fail('Повреждена встреча.');
  const hp=list(e.hp,8,'здоровье встречи');
  if(e.done&&hp.length!==0||!e.done&&hp.length!==def.units.length)fail('Состав встречи не соответствует миру.');
  hp.forEach((value,i)=>number(value,0,def.kind==='named'&&i===0?Math.round(enemyNumbers(def.units[i],def.tier).hp*2.6):enemyNumbers(def.units[i],def.tier).hp,'здоровье встречи',true));
  if(!e.done&&!hp.some(value=>value>0))fail('Незавершённая встреча не может состоять из побеждённых целей.');
 }
 object(s.npcs,'персонажи');for(const [id,n] of Object.entries<any>(s.npcs)){if(!NPCS[id])fail('Неизвестный персонаж.');object(n,'персонаж');if(typeof n.met!=='boolean')fail('Повреждён персонаж.');for(const h of list(n.heard,40,'реплики'))text(h,40,'реплика');}
 object(s.loadout,'набор умений');if(!['default','alt'].includes(s.loadout.skill))fail('Неизвестное умение.');
 for(const b of list(s.blueprints,6,'чертежи'))if(b!==ALT_FAMILY[p.classId as keyof typeof ALT_FAMILY])fail('Недопустимый чертёж.');
 object(s.rank,'ранг прогноза');number(s.rank.selected,0,5,'выбранный ранг',true);number(s.rank.best,0,5,'лучший ранг',true);if(s.rank.selected>s.rank.best+1)fail('Недоступный ранг прогноза.');number(s.updated,0,1e15,'время сохранения');
 const needsRun=['expedition','reward','dead'].includes(s.phase);if(needsRun!==!!s.run)fail('Несогласованное состояние экспедиции.');
 if(s.run){const r=object(s.run,'экспедиция');text(r.id,180,'ID попытки');number(r.seed,0,4294967295,'зерно экспедиции',true);number(r.serial,1,1e8,'номер попытки',true);number(r.elapsed,0,1e9,'время экспедиции');number(r.rng,0,4294967295,'генератор боя',true);
  if(r.rank!==undefined)number(r.rank,0,5,'ранг экспедиции',true);object(r.returnPos,'позиция возврата');number(r.returnPos.x,-240,240,'возврат X');number(r.returnPos.z,-240,240,'возврат Z');object(r.boons,'резервы');for(const k of ['health','energy','fortune'])if(typeof r.boons[k]!=='boolean')fail('Повреждён резерв.');
  object(r.portal,'портал');const canonical=new World(s.seed).getPortal(r.portal.id);if(!canonical)throw new Error('Параметры портала не соответствуют миру.');if(['id','x','z','seed','tier','theme','title','main','final'].some(k=>(canonical as any)[k]!==(r.portal as any)[k])||JSON.stringify(canonical.mods)!==JSON.stringify(r.portal.mods))fail('Параметры портала не соответствуют миру.');
  const enemies=list(r.enemies,60,'противники');if(enemies.length<5)fail('Недостаточно целей экспедиции.');if(new Set(enemies.map(e=>e.id)).size!==enemies.length)fail('Повторяющиеся цели.');
  for(const e of enemies){object(e,'противник');text(e.id,80,'ID противника');if(!['mite','sentry','ram','mender','mortar','warden','boss'].includes(e.kind))fail('Неизвестный противник.');if(e.kind==='boss'&&!['gardener','herdsman','stoker','archivist','collector','front'].includes(e.boss))fail('Неизвестный босс.');
   const n=enemyNumbers(e.kind,canonical.tier,e.boss,r.rank??0);number(e.hp,0,n.hp,'здоровье противника');if(e.maxHp!==n.hp)fail('Неверное максимальное здоровье противника.');if(typeof e.dead!=='boolean'||e.dead!==(e.hp===0))fail('Несогласованная цель.');number(e.room,0,11,'комната',true);
   for(const k of ['x','z','tx','tz','homeX','homeZ'])number(e[k],-1024,1024,k);for(const k of ['dx','dz'])number(e[k],-1.01,1.01,k);number(e.timer,-100000,100,'таймер противника');number(e.windup,-.051,10,'подготовка');number(e.pattern,0,1e7,'паттерн',true);number(e.stun,0,10,'оглушение');number(e.charge,-2,2,'рывок противника');
  }
  if(enemies.filter(e=>e.kind==='boss').length!==1)fail('В экспедиции должен быть ровно один босс.');
  for(const k of ['restUsed','clearedRooms'])for(const id of list(r[k],12,k))number(id,0,11,k,true);
  if(geometry){const l=generateDungeon(canonical,r.seed);if(l.spawns.length!==enemies.length||l.spawns.some(sp=>!enemies.some(e=>e.id===sp.id&&e.kind===sp.kind&&e.room===sp.room&&e.homeX===sp.x&&e.homeZ===sp.z)))fail('Состав экспедиции не соответствует её зерну.');}
 }
 if(s.phase==='reward'){
  const reward=object(s.reward,'награда');if(reward.runId!==s.run.id||!s.run.enemies.every((e:any)=>e.dead))fail('Награда не относится к завершённой экспедиции.');number(reward.tier,1,5,'уровень награды',true);if(reward.tier!==s.run.portal.tier||typeof reward.firstSeal!=='boolean'||typeof reward.final!=='boolean'||reward.final!==s.run.portal.final)fail('Повреждён профиль награды.');item(reward.item,p.classId);if(ids.includes(reward.item.id))fail('Награда уже выдана.');
  const offers=list(reward.offers,3,'варианты награды');if(offers.length!==3||new Set(offers.map(o=>o.id)).size!==3)fail('Нужно три различных варианта награды.');
  for(const o of offers){if(o.supply){if(!['health','energy','fortune'].includes(o.supply)||o.id!==`mastery:${o.supply}`||o.from!==s.mastery[o.supply]||o.to!==o.from+1)fail('Повреждена награда мастерства.');}else{const d=UPGRADE_BY_ID[o.id];if(!d||d.minTier>reward.tier||d.classId&&d.classId!==p.classId||o.from!==(s.upgrades[o.id]??0))fail('Недопустимое улучшение.');number(o.to,o.from+1,d.max,'новый ранг',true);}}
 }else if(s.reward!==null)fail('Награда находится вне экрана выбора.');
 return s as GameState;
}
export interface SaveEnvelope {format:'isobara-save';schema:1;payload:string;checksum:string}
export function envelope(s:GameState):SaveEnvelope {const copy=JSON.parse(JSON.stringify(s));copy.updated=Date.now();validateState(copy);const payload=JSON.stringify(copy);return {format:'isobara-save',schema:1,payload,checksum:hash(payload).toString(16)};}
export function unpack(input:any,geometry=true):GameState {const e=object(input,'файл');if(e.format!=='isobara-save'||e.schema!==1||typeof e.payload!=='string'||e.payload.length>6_000_000)fail('Это не совместимое сохранение «Изобары».');if(e.checksum!==hash(e.payload).toString(16))fail('Контрольная сумма не совпала. Файл мог быть повреждён.');return validateState(JSON.parse(e.payload),geometry);}
export function importText(text:string){if(text.length>6_100_000)fail('Размер файла превышает 6 МБ.');return unpack(JSON.parse(text));}
export function validateSettings(raw:any):Settings{
 const s=structuredClone(DEFAULT_SETTINGS);if(!raw||typeof raw!=='object')return s;
 if(['low','medium','high'].includes(raw.quality))s.quality=raw.quality;if(raw.fps===30||raw.fps===60)s.fps=raw.fps;
 for(const key of ['scale','uiScale','music','sound','camera'] as const){const v=raw[key];if(typeof v==='number'&&Number.isFinite(v))s[key]=Math.max(key==='music'||key==='sound'?0:.5,Math.min(key==='camera'?2:key==='uiScale'?1.3:1,v));}
 for(const key of ['shake','particles'] as const)if(typeof raw[key]==='boolean')s[key]=raw[key];
 if(raw.bindings&&typeof raw.bindings==='object'){const bindings={...s.bindings};for(const key of Object.keys(bindings) as (keyof typeof bindings)[]){const val=raw.bindings[key];if(typeof val==='string'&&/^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Space|Shift(Left|Right)|Control(Left|Right)|Mouse[012]|Tab)$/.test(val))bindings[key]=val;}if(new Set(Object.values(bindings)).size===Object.keys(bindings).length)s.bindings=bindings;}
 return s;
}
