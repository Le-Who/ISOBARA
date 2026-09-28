import type {GameState,Stats,Item,Slot,ClassId,UpgradeOffer,Portal,Enemy,Spawn,PendingReward} from './types.js';
import {CLASSES,ENEMIES,UPGRADES,UPGRADE_BY_ID,SLOTS,EFFECTS} from './content.js';
import {FAMILIES,ALT_FAMILY,BASE_FAMILY,familyId,WORKSHOP_COST} from './weapons.js';
import {rankDef} from './ranks.js';
import {DATA_VERSION,GENERATOR_VERSION,RULES_VERSION} from './migrate.js';
import {RNG,clamp,hash,unique} from './math.js';
// BAL-02/03: quick early growth (levels 1-5), old curve through level 8, then slower gains every level.
export const xpNeeded=(level:number)=>level<=5?[70,90,115,150,195][level-1]:60+level*35+Math.max(0,level-8)*16;
export function levelInfo(xp:number){let level=1,left=xp;while(level<20&&left>=xpNeeded(level)){left-=xpNeeded(level);level++;}return {level,current:left,needed:level===20?0:xpNeeded(level)};}
export function stats(s:GameState):Stats {
 const c=CLASSES[s.player.classId],r=(id:string)=>s.upgrades[id]??0,level=levelInfo(s.player.xp).level;
 const equipped=Object.values(s.equipment).map(id=>s.inventory.find(i=>i.id===id)).filter((i):i is Item=>!!i);
 const sum=(key:'damage'|'hp'|'armor'|'crit'|'haste')=>equipped.reduce((a,b)=>a+b[key],0),effects=unique(equipped.map(i=>i.effect).filter(e=>e!=='none'));
 const fam=FAMILIES[familyId(equipped.find(i=>i.slot==='instrument'),s.player.classId)];
 return {family:fam.id,weaponMul:fam.damageMul,baseRange:c.range*(1+r('reach')*.05),level,hp:Math.round(c.hp+(level-1)*10+r('health')*14+sum('hp')),damage:(c.damage+sum('damage'))*(1+(level-1)*.065+r('power')*.04),speed:c.speed*(1+r('speed')*.03),attackTime:c.attackTime*fam.attackMul/clamp(1+r('haste')*.04+sum('haste'),1,1.8),range:c.range*fam.rangeMul*(1+r('reach')*.05),armor:clamp((s.player.classId==='harvester'?.10:.03)+r('armor')*.03+sum('armor'),0,.55),crit:clamp(.05+r('crit')*.03+sum('crit'),0,.55),energyRegen:9+r('energy')*1.5+(effects.includes('battery')?3:0),skillPower:1+r('skillPower')*.07,cooldown:clamp(1-r('cooldown')*.04,.6,1),potionCount:3+r('capacity'),healPower:1+r('healing')*.06,siphon:r('siphon')*2+(effects.includes('siphon')?4:0),reach:r('reach'),dashCooldown:1.35*(1-r('dash')*.08),chain:3+r('chain'),pierce:r('pierce'),pellets:3+r('pellets'),slow:.42,effects};
}
export function itemName(slot:Slot,tier:number,rarity:number,rng:RNG,classId:ClassId,family:string=BASE_FAMILY[classId]){
 const tools=FAMILIES[family].tools;
 const bases=slot==='instrument'?tools:slot==='shell'?['Керамическая оболочка','Плащ метеоролога','Полевой нагрудник']:['Резонатор росы','Архивный барометр','Тихое ядро','Капсула оттепели'];
 const suffix=rarity===4?' «Завтра»':rarity===3?' «Рассвет»':rarity===2?' · настроенный':'';
 return rng.pick(bases)+suffix;
}
export function makeItem(seed:number,tier:number,classId:ClassId,id:string,options:{slot?:Slot;bonus?:number;pity?:boolean;family?:string;altChance?:number}={}):Item {
 const rng=new RNG(seed),weights=tier===1?[65,35,0,0]:tier===2?[32,57,11,0]:tier===3?[20,51,26,3]:tier===4?[10,40,39,11]:[5,25,45,25];
 if(options.bonus){weights[0]=Math.max(0,weights[0]-options.bonus);weights[2]+=options.bonus;}
 const rarity=options.pity&&tier>=2?3:rng.weighted<1|2|3|4>([1,2,3,4],weights);
 const slot=options.slot??rng.pick<Slot>(['instrument','shell','relic']);
 const effect=rarity>=3?rng.pick<Item['effect']>(['first','barrier','battery','siphon']):'none';
 const alt=ALT_FAMILY[classId],family=slot!=='instrument'?undefined:options.family??((options.altChance??0)>0&&rng.next()<options.altChance!?alt:BASE_FAMILY[classId]);
 return {...(family&&family!==BASE_FAMILY[classId]?{family}:{}),id,name:itemName(slot,tier,rarity,rng,classId,family??BASE_FAMILY[classId]),slot,tier,rarity,icon:slot==='instrument'?FAMILIES[family??BASE_FAMILY[classId]].icon:slot==='shell'?(rarity>=3?'cloak':'vest'):rng.pick(['gauge','orb','prism','seed']),damage:slot==='instrument'?5+tier*5+(rarity-1)*3:slot==='relic'?2+tier*2:0,hp:slot==='shell'?14+tier*10+(rarity-1)*7:slot==='relic'?tier*4:0,armor:slot==='shell'?tier*.013+(rarity-1)*.009:0,crit:slot==='relic'?tier*.011+(rarity-1)*.014:0,haste:rarity>=2?.015*tier:0,effect};
}
export function equippedItems(s:GameState){return Object.fromEntries(Object.entries(s.equipment).map(([k,id])=>[k,s.inventory.find(i=>i.id===id)]));}
export function equipItem(s:GameState,id:string){if(s.phase!=='world')return false;const item=s.inventory.find(i=>i.id===id);if(!item)return false;s.equipment[item.slot]=id;s.player.hp=Math.min(s.player.hp,stats(s).hp);return true;}
export function salvage(s:GameState,id:string){if(s.phase!=='world'||Object.values(s.equipment).includes(id))return false;const index=s.inventory.findIndex(i=>i.id===id),mailIndex=s.mailbox.findIndex(i=>i.id===id);const item=index>=0?s.inventory[index]:mailIndex>=0?s.mailbox[mailIndex]:null;if(!item||item.fav)return false;s.shards+=3*item.rarity*item.tier;if(index>=0)s.inventory.splice(index,1);else s.mailbox.splice(mailIndex,1);transferMailbox(s);return true;}
export function favorite(s:GameState,id:string){const item=[...s.inventory,...s.mailbox].find(i=>i.id===id);if(!item)return false;item.fav=!item.fav;return true;}
export function transferMailbox(s:GameState){while(s.inventory.length<24&&s.mailbox.length)s.inventory.push(s.mailbox.shift()!);}
export function giveItem(s:GameState,item:Item){if(s.inventory.some(i=>i.id===item.id)||s.mailbox.some(i=>i.id===item.id))return false;if(s.inventory.length<24)s.inventory.push(item);else s.mailbox.push(item);return true;}
export function craftItem(s:GameState){if(s.phase!=='world'||Math.hypot(s.player.x,s.player.z)>12)return null;const tier=Math.max(1,s.stats.bestTier),cost=35+20*tier;if(s.shards<cost)return null;s.shards-=cost;s.crafts++;const item=makeItem(hash(s.seed,'craft',s.crafts),tier,s.player.classId,`craft:${s.seed}:${s.crafts}`,{bonus:15,altChance:s.blueprints.includes(ALT_FAMILY[s.player.classId])?.35:0});giveItem(s,item);return item;}
export function craftFamily(s:GameState,family:string){const def=FAMILIES[family];if(!def||s.phase!=='world'||Math.hypot(s.player.x,s.player.z)>12||def.classId!==s.player.classId||family===BASE_FAMILY[def.classId]||!s.blueprints.includes(family))return null;const tier=Math.max(1,s.stats.bestTier),cost=WORKSHOP_COST(tier);if(s.shards<cost)return null;s.shards-=cost;s.crafts++;const item=makeItem(hash(s.seed,'craft-family',s.crafts),tier,s.player.classId,`craft:${s.seed}:${s.crafts}`,{slot:'instrument',bonus:15,family});giveItem(s,item);return item;}
export function respec(s:GameState){if(s.phase!=='world'||Math.hypot(s.player.x,s.player.z)>12)return false;s.respecPoints+=Object.values(s.upgrades).reduce((a,b)=>a+b,0);s.upgrades={};s.player.hp=Math.min(s.player.hp,stats(s).hp);return true;}
export function spendRespec(s:GameState,id:string){const d=UPGRADE_BY_ID[id];if(s.phase!=='world'||Math.hypot(s.player.x,s.player.z)>12||!d||s.respecPoints<=0||d.minTier>Math.max(1,s.stats.bestTier)||(d.classId&&d.classId!==s.player.classId)||(s.upgrades[id]??0)>=d.max)return false;s.respecPoints--;s.upgrades[id]=(s.upgrades[id]??0)+1;return true;}
export function offerUpgrades(s:GameState,tier:number,seed:number):UpgradeOffer[]{
 const rng=new RNG(seed),eligible=UPGRADES.filter(u=>u.minTier<=tier&&(!u.classId||u.classId===s.player.classId)&&(s.upgrades[u.id]??0)<u.max);
 let chosen=eligible.length>=3?rng.shuffle(eligible).slice(0,3):rng.shuffle(eligible);
 // Make a stat/skill decision visible whenever both valid families exist.
 if(chosen.length===3&&!chosen.some(u=>u.kind==='skill')){const skills=eligible.filter(u=>u.kind==='skill');if(skills.length)chosen[2]=rng.pick(skills);}
 if(chosen.length===3&&!chosen.some(u=>u.kind==='stat')){const general=eligible.filter(u=>u.kind==='stat');if(general.length)chosen[2]=rng.pick(general);}
 const offers:UpgradeOffer[]=chosen.map(u=>({id:u.id,from:s.upgrades[u.id]??0,to:Math.min(u.max,(s.upgrades[u.id]??0)+(tier>=4?2:1))}));
 for(const supply of ['health','energy','fortune'] as const){if(offers.length>=3)break;offers.push({id:`mastery:${supply}`,from:s.mastery[supply],to:s.mastery[supply]+1,supply});}
 return offers;
}
export function offerText(o:UpgradeOffer):{name:string;detail:string;change:string;icon:string;kind:string}{
 if(o.supply){const data={health:{name:'Резерв прочности',detail:'Освоенный контур. Один следующий поход начинается со щитом на 45 единиц.',icon:'vest'},energy:{name:'Запасённый заряд',detail:'Освоенный контур. +5 энергии в секунду в одном следующем походе.',icon:'furnace'},fortune:{name:'Точный прогноз',detail:'Освоенный контур. Повышает шанс штучной добычи в одном следующем походе.',icon:'gauge'}}[o.supply];return {...data,change:`Запас: ${o.from} → ${o.to}`,kind:'МАСТЕРСТВО'};}
 const d=UPGRADE_BY_ID[o.id];const fmt=(x:number)=>Number(x.toFixed(1)).toLocaleString('ru-RU');
 return {name:d.name,detail:d.desc,change:d.max===1?'Открыть новый эффект':`${fmt(o.from*d.amount)}${d.unit} → ${fmt(o.to*d.amount)}${d.unit}`,icon:d.icon,kind:d.kind==='skill'?'СПОСОБНОСТЬ':'ХАРАКТЕРИСТИКИ'};
}
export function createReward(s:GameState):PendingReward {
 if(!s.run)throw new Error('No active expedition');const {portal,id}=s.run,firstSeal=!s.seals.includes(portal.tier);
 const slot=(['instrument','shell','relic'] as Slot[])[s.stats.portals%3];
 const item=makeItem(hash(s.run.seed,'boss-drop'),portal.tier,s.player.classId,`${id}:boss-loot`,{slot,bonus:portal.mods.length*8+(s.run.boons.fortune?15:0)+rankDef(s.run.rank).bonus,pity:s.rareMisses>=3,altChance:s.blueprints.includes(ALT_FAMILY[s.player.classId])?.3:0});
 return {runId:id,offers:offerUpgrades(s,portal.tier,hash(s.run.seed,'upgrade-offer')),item,tier:portal.tier,firstSeal,final:portal.final};
}
export function applyReward(s:GameState,index:number){
 if(s.phase!=='reward'||!s.run||!s.reward||s.reward.runId!==s.run.id||!Number.isInteger(index)||index<0||index>=3)return false;
 const reward=s.reward,o=reward.offers[index];if(!o)return false;
 if(o.supply)s.mastery[o.supply]++;else{const d=UPGRADE_BY_ID[o.id];if(!d||o.to<=o.from||o.to>d.max||(s.upgrades[o.id]??0)!==o.from)return false;s.upgrades[o.id]=o.to;}
 giveItem(s,reward.item);s.rareMisses=reward.item.rarity>=3?0:s.rareMisses+1;s.shards+=Math.round(reward.tier*10*rankDef(s.run.rank).shards);if(s.run.rank)s.rank.best=Math.max(s.rank.best,s.run.rank);
 s.stats.portals++;s.stats.bestTier=Math.max(s.stats.bestTier,reward.tier);s.completions[s.run.portal.id]=(s.completions[s.run.portal.id]??0)+1;
 if(!s.run.portal.final&&!s.seals.includes(reward.tier)){s.seals.push(reward.tier);s.seals.sort();const next=[1,2,3,4,5].find(t=>!s.seals.includes(t));if(next&&!s.discovered.includes(`main:${next}`))s.discovered.push(`main:${next}`);const j=`seal:${reward.tier}`;if(!s.journal.includes(j))s.journal.push(j);}
 if(s.seals.length===5&&!s.discovered.includes('final'))s.discovered.push('final');
 if(reward.final)s.finalCleared=true;
 s.player.x=s.run.returnPos.x;s.player.z=s.run.returnPos.z+4;s.run=null;s.reward=null;
 s.phase=reward.final?'epilogue':'world';restorePlayer(s);return true;
}
export function restorePlayer(s:GameState){const st=stats(s);s.player.hp=st.hp;s.player.energy=100;s.player.potions=st.potionCount;s.player.invuln=0;s.player.guard=0;s.player.shield=0;s.player.dashTime=0;s.player.cooldowns={attack:0,skill:0,burst:0,dash:0,heal:0};}
export function enemyNumbers(kind:Enemy['kind'],tier:number,boss?:Enemy['boss'],rank=0){const R=rankDef(rank);if(kind==='boss')return {hp:Math.round(430*1.56**(tier-1)*(boss==='front'?1.5:1)*R.hp),damage:19*1.29**(tier-1)*R.damage,speed:1.5,range:14,cooldown:2.5,xp:Math.round((65+tier*36)*R.xp)};const c=ENEMIES[kind];return {...c,hp:Math.round(c.hp*(1+(tier-1)*.53)*R.hp),damage:c.damage*(1+(tier-1)*.24)*R.damage,xp:Math.round(c.xp*(1+(tier-1)*.48)*R.xp)};}
export function instantiateEnemies(spawns:Spawn[],tier:number,rank=0):Enemy[]{return spawns.map((e,i)=>{const n=enemyNumbers(e.kind,tier,e.boss,rank);return {...e,hp:n.hp,maxHp:n.hp,timer:.8+(i%3)*.25,windup:0,pattern:0,tx:e.x,tz:e.z,dx:0,dz:1,stun:0,charge:0,dead:false,homeX:e.x,homeZ:e.z};});}
export function newGame(seed:number,classId:ClassId,mode:'standard'|'explorer'='standard'):GameState {
 if(!CLASSES[classId])throw new Error('Unknown class');
 const starter:Item={id:`starter:${seed}`,name:classId==='lineman'?'Старый импульсник':classId==='harvester'?'Полевой камертон':'Сеятель росы',slot:'instrument',tier:1,rarity:1,icon:CLASSES[classId].icon,damage:0,hp:0,armor:0,crit:0,haste:0,effect:'none'};
 const s:GameState={version:DATA_VERSION,generator:GENERATOR_VERSION,rules:RULES_VERSION,seed:seed>>>0,phase:'world',mode,player:{classId,x:1.5,z:4,hp:CLASSES[classId].hp,energy:100,xp:0,potions:3,faceX:0,faceZ:-1,cooldowns:{attack:0,skill:0,burst:0,dash:0,heal:0},invuln:0,dashTime:0,dashX:0,dashZ:0,shield:0,guard:0,lastDamage:0},inventory:[starter],equipment:{instrument:starter.id},mailbox:[],upgrades:{},shards:0,respecPoints:0,crafts:0,discovered:['main:1'],explored:['0,0'],collected:[],seals:[],completions:{},attempts:0,rareMisses:0,finalCleared:false,run:null,reward:null,stats:{kills:0,portals:0,deaths:0,seconds:0,bestTier:0},journal:['intro'],mastery:{health:0,energy:0,fortune:0},updated:Date.now(),encounters:{},npcs:{},loadout:{skill:'default'},blueprints:[],rank:{selected:0,best:0}};
 return s;
}
export function itemLines(i:Item){const a:string[]=[];if(i.family&&FAMILIES[i.family])a.push(`Семейство: ${FAMILIES[i.family].name}. ${FAMILIES[i.family].tradeoff}`);if(i.damage)a.push(`+${i.damage} к урону`);if(i.hp)a.push(`+${i.hp} к здоровью`);if(i.armor)a.push(`−${(i.armor*100).toFixed(1)}% получаемого урона`);if(i.crit)a.push(`+${(i.crit*100).toFixed(1)}% критического шанса`);if(i.haste)a.push(`+${(i.haste*100).toFixed(1)}% скорости атаки`);if(i.effect!=='none')a.push(EFFECTS[i.effect]);return a;}
export function compareItem(s:GameState,candidate:Item){
 const current=s.inventory.find(i=>i.id===s.equipment[candidate.slot])??null;
 const before=stats(s);
 const inventory=s.inventory.some(i=>i.id===candidate.id)?s.inventory:[...s.inventory,candidate];
 const after=stats({...s,inventory,equipment:{...s.equipment,[candidate.slot]:candidate.id}});
 const rows:{label:string;delta:number;text:string}[]=[];
 const add=(label:string,delta:number,digits:number,suffix='')=>{if(Math.abs(delta)>1e-9)rows.push({label,delta,text:`${delta>0?'+':''}${delta.toFixed(digits)}${suffix}`});};
 add('Урон',after.damage-before.damage,1);
 add('Здоровье',after.hp-before.hp,0);
 add('Броня',(after.armor-before.armor)*100,1,' п.п.');
 add('Крит',(after.crit-before.crit)*100,1,' п.п.');
 add('Темп атаки',(before.attackTime-after.attackTime)/before.attackTime*100,1,'%');
 add('Дальность',after.range-before.range,1,' м');
 add('Скорость',after.speed-before.speed,1,' м/с');
 add('Заряд',after.energyRegen-before.energyRegen,1,'/с');
 return {rows,lost:before.effects.find(effect=>!after.effects.includes(effect))??null,gained:after.effects.find(effect=>!before.effects.includes(effect))??null,current};
}
