// NPC-01: three characters with memory of the hero's actions. State is compact (met + heard ids);
// a read line never replaces completing the game task, and every reward is guarded by a persistent flag.
import type {GameState,NpcState} from './types.js';
import {levelInfo,makeItem,giveItem,salvageValue} from './progression.js';
import {ALT_FAMILY,FAMILIES} from './weapons.js';
import {LORE} from './content.js';
import {hash} from './math.js';
export interface NpcDef {id:string;name:string;role:string;model:'harvester'|'aerologist'|'lineman'|'mender';color:number}
export const NPCS:Record<string,NpcDef>={
 irma:{id:'irma',name:'Ирма Валь',role:'Мастер станции',model:'harvester',color:0xefc07a},
 sa7:{id:'sa7',name:'СА-7 «Дорожный»',role:'Сервисный автомат',model:'mender',color:0x9fe3c8},
 lea:{id:'lea',name:'Лея Мороз',role:'Архивистка',model:'aerologist',color:0xc4afe8}
};
export interface Choice {id:string;label:string;disabled?:boolean;hint?:string}
export interface DialogueView {npc:NpcDef;lines:string[];choices:Choice[];toast?:string}
export const npcState=(s:GameState,id:string):NpcState=>s.npcs[id]??(s.npcs[id]={met:false,heard:[]});
const heard=(s:GameState,id:string,flag:string)=>!!s.npcs[id]?.heard.includes(flag);
const mark=(s:GameState,id:string,flag:string)=>{const n=npcState(s,id);if(!n.heard.includes(flag)&&n.heard.length<40)n.heard.push(flag);};
const roadDone=(s:GameState)=>!!s.encounters.road?.done;
export function talk(s:GameState,id:string):DialogueView|null{
 const npc=NPCS[id];if(!npc)return null;const n=npcState(s,id),first=!n.met;n.met=true;const lines:string[]=[],choices:Choice[]=[];
 const alt=ALT_FAMILY[s.player.classId],altName=FAMILIES[alt].name,lvl=levelInfo(s.player.xp).level;
 if(id==='irma'){
  lines.push(first?'Ирма поднимает голову от верстака: «Ты новый ремонтник? Хорошо. Инструмент здесь не украшение — у каждого своя манера удара. Покажу, как это работает.»':'«Слушаю. Что нужно станции?»');
  if(!roadDone(s))lines.push('«Сервисная группа на восточной тропе ушла в сбой. Её щиток стоит севернее патруля. Можно подкрасться и отключить питание, можно сломать группу силой — тропа станет спокойной в обоих случаях.»');
  else lines.push('«Тропа снова тихая. Значит, у меня есть чертёж, который я обещала.»');
  if(s.seals.length>=1)lines.push(`«Контуров восстановлено: ${s.seals.length}. Слышно даже в мастерской: кран перестал стучать.»`);
  if(s.finalCleared)lines.push('«Прогноз закончился, но небо теперь требует внимания. Если хочешь серьёзной проверки — выбирай ранги прогноза у любого разлома.»');
  const has=s.blueprints.includes(alt);
  choices.push({id:'blueprint',label:`Чертёж: ${altName}`,disabled:has||!roadDone(s),hint:has?'Чертёж уже у вас. Собирайте инструмент в мастерской.':!roadDone(s)?'Сначала успокойте патруль на тропе.':`Второе семейство вашего класса: ${FAMILIES[alt].desc}`});
  const taught=heard(s,'irma','taught');
  choices.push({id:'teach',label:'Освоить второе умение',disabled:taught||lvl<3,hint:taught?'Умения переключаются в мастерской.':lvl<3?'Вернитесь на 3 уровне: сначала привыкните к базовому набору.':'Откроет альтернативную способность вашего класса.'});
  choices.push({id:'about',label:'Расскажите о станции'});
 }else if(id==='sa7'){
  lines.push(first?'Автомат поворачивает линзу: «Приветствие принято. Я — СА-7. Обслуживаю дорогу, пока дорога помнит, что её надо обслуживать.»':'«СА-7 на связи.»');
  if(!roadDone(s))lines.push('«Патруль на востоке от дороги не в себе. Слышит на восемь с половиной метров. Щиток отключения — на северо-востоке, в обход. Дорогу они не охраняют — только свой квадрат.»');
  else lines.push('«Питание восстановлено, группа успокоена. Путь свободен. Моя благодарность равна нулю измерений, но это самое большое число, которое я умею произносить.»');
  choices.push({id:'gift',label:'Принять запасные детали',disabled:!roadDone(s)||heard(s,'sa7','gift'),hint:heard(s,'sa7','gift')?'Детали уже получены.':!roadDone(s)?'Дорога ещё не безопасна.':'+15 деталей'});
  choices.push({id:'hint',label:'Где сейчас опасно?'});
 }else{
  lines.push(first?'Лея закрывает тетрадь: «Ты — из тех, кто чинит. Я — из тех, кто записывает, что именно сломалось. Полезное сочетание.»':'«Что ты видел?»');
  lines.push(s.seals.length?`«Ты вернул ${s.seals.length} из 5 контуров. В записях это уже другая погода — без повторов.»`:'«Пока ни один контур не вернулся. Записывать нечего: одни повторы.»');
  choices.push({id:'record',label:'Передать наблюдение',disabled:!s.seals.length||heard(s,'lea','record'),hint:heard(s,'lea','record')?'Наблюдение уже записано.':!s.seals.length?'Нужен хотя бы один восстановленный контур.':'+30 опыта, +10 деталей'});
  choices.push({id:'lore',label:'Прочесть страницу из архива'});
 }
 return {npc,lines,choices};
}
export function choose(s:GameState,id:string,choice:string):DialogueView|null{
 const before=talk(s,id);if(!before)return null;const c=before.choices.find(x=>x.id===choice);if(!c||c.disabled)return before;
 let toast:string|undefined,extra:string|undefined;
 if(id==='irma'&&choice==='blueprint'){const alt=ALT_FAMILY[s.player.classId];if(!s.blueprints.includes(alt)){s.blueprints.push(alt);const item=makeItem(hash(s.seed,'blueprint',alt),Math.max(1,s.stats.bestTier),s.player.classId,`bp:${s.seed}:${alt}`,{slot:'instrument',family:alt,bonus:8});item.rarity=Math.max(2,item.rarity) as 2|3|4;const delivery=giveItem(s,item);toast=`Чертёж получен: ${FAMILIES[alt].name}. ${delivery==='shards'?`Хранилище заполнено: за инструмент получено ${salvageValue(item)} деталей.`:delivery==='mail'?'Инструмент добавлен в хранилище.':'Инструмент добавлен в снаряжение.'}`;extra=`«Держи. ${FAMILIES[alt].tradeoff} Если сломаешь — собери новый в мастерской: чертёж остаётся у тебя.»`;}}
 else if(id==='irma'&&choice==='teach'){mark(s,'irma','taught');toast='Открыто второе умение. Переключать умения можно в мастерской станции.';extra='«Умение — это не ещё одна кнопка, а другой способ решать бой. Пробуй обе, пока не поймёшь, какая твоя.»';}
 else if(id==='irma'&&choice==='about')extra='«Станция «Изобара» — последний прибор, который не забыл про завтра. Пока в мастерской горит лампа, в мире есть кому чинить погоду.»';
 else if(id==='sa7'&&choice==='gift'){mark(s,'sa7','gift');s.shards+=15;toast='+15 деталей от СА-7.';}
 else if(id==='sa7'&&choice==='hint')extra=Object.values(s.encounters).some(e=>!e.done)||!roadDone(s)?'«Красные метки на карте — мои неисправные коллеги. Они спят, пока вы далеко. Не бегите от них через всю карту: они не гонятся дальше тридцати метров.»':'«Тропа чиста. Дальше дороги ведут к машинам без хозяев — берегите ремкомплекты.»';
 else if(id==='lea'&&choice==='record'){mark(s,'lea','record');s.shards+=10;s.player.xp+=30;toast='Наблюдение записано: +30 опыта, +10 деталей.';}
 else if(id==='lea'&&choice==='lore'){const n=npcState(s,'lea'),unread=LORE.map((_,k)=>k).filter(k=>!n.heard.includes(`read:${k}`)),i=unread.length?unread[hash(s.seed,'lea-lore',unread.length)%unread.length]:hash(s.seed,'lea-lore',n.heard.length)%LORE.length;if(unread.length)mark(s,'lea',`read:${i}`);extra=`«${LORE[i][0]}. ${LORE[i][1]}»`;}
 const view=talk(s,id)!;if(extra)view.lines=[extra];view.toast=toast;return view;
}
