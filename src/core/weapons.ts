// WEAPON-01 / SKILL-01: instrument families and selectable active skills.
// Class = professional role, family = shape of the basic attack, item quality = bounded power of an instance.
import type {ClassId,Item} from './types.js';
export interface FamilyDef {id:string;classId:ClassId;name:string;short:string;icon:string;desc:string;tradeoff:string;attackMul:number;rangeMul:number;damageMul:number;tools:string[]}
export const FAMILIES:Record<string,FamilyDef>={
 impulser:{id:'impulser',classId:'lineman',name:'Линейный импульсник',short:'Импульсник',icon:'coil',desc:'Точная линия огня: один сильный заряд, пробивает цели насквозь.',tradeoff:'Лучший для одиночной цели и дистанции.',attackMul:1,rangeMul:1,damageMul:1,tools:['Линейный импульсник','Полевой разрядник','Медная линия']},
 inductor:{id:'inductor',classId:'lineman',name:'Дуговой индуктор',short:'Индуктор',icon:'inductor',desc:'Короткая цепная дуга веером перед героем. Каждая дополнительная цель в дуге усиливает разряд на 12%.',tradeoff:'Меньшая безопасная дистанция и слабее одиночная цель; сильнее против групп.',attackMul:.9,rangeMul:.45,damageMul:.72,tools:['Дуговой индуктор','Катушка-веер','Индуктивная скоба']},
 tuning:{id:'tuning',classId:'harvester',name:'Тяжёлый камертон',short:'Камертон',icon:'fork',desc:'Широкий удар по трём целям перед героем.',tradeoff:'Надёжная зона удара и высокий урон за взмах.',attackMul:1,rangeMul:1,damageMul:1,tools:['Камертон сборщика','Резонансный резак','Двузубый съёмник']},
 strippers:{id:'strippers',classId:'harvester',name:'Парные съёмники',short:'Съёмники',icon:'strippers',desc:'Серия из трёх быстрых ударов. Третий — направленный импульс вперёд с броском героя, игнорирует фронтальную броню и оглушает.',tradeoff:'Меньше ширина и разовый удар, зато легче менять позицию.',attackMul:.66,rangeMul:.76,damageMul:.7,tools:['Парные съёмники','Двойной резак','Шунтовые клешни']},
 sower:{id:'sower',classId:'aerologist',name:'Сеятель оттепели',short:'Сеятель',icon:'rotor',desc:'Веер заряженных семян.',tradeoff:'Покрывает пространство, слабее по каждой цели.',attackMul:1,rangeMul:1,damageMul:1,tools:['Сеятель оттепели','Ветровой коллектор','Веер аэролога']},
 discs:{id:'discs',classId:'aerologist',name:'Возвратные ветровые диски',short:'Диски',icon:'discs',desc:'Диск уходит вперёд, разворачивается и возвращается к герою, поражая цели дважды на обоих проходах.',tradeoff:'Нужно держать линию и позицию, зато повторное попадание можно планировать.',attackMul:1.12,rangeMul:1.05,damageMul:1.25,tools:['Возвратные диски','Кольцевой флюгер','Петля ветра']}
};
export const BASE_FAMILY:Record<ClassId,string>={lineman:'impulser',harvester:'tuning',aerologist:'sower'};
export const ALT_FAMILY:Record<ClassId,string>={lineman:'inductor',harvester:'strippers',aerologist:'discs'};
export function familyId(item:Item|undefined,classId:ClassId){const f=item?.family;return f&&FAMILIES[f]&&FAMILIES[f].classId===classId?f:BASE_FAMILY[classId];}
export function itemIcon(item:Item){return item.slot==='instrument'&&item.family&&FAMILIES[item.family]?.classId?FAMILIES[item.family].icon:item.icon;}
export interface SkillDef {name:string;icon:string;desc:string;cost:number;cooldown:number}
export const SKILLS:Record<ClassId,{default:SkillDef;alt:SkillDef}>={
 lineman:{default:{name:'Цепной разряд',icon:'coil',desc:'Три цели, 170% урона. Прыгает между машинами.',cost:25,cooldown:6},alt:{name:'Копьё тока',icon:'skill-lance',desc:'Прямой луч сквозь всю линию: 240% урона каждой цели на пути. Требует расположить врагов в ряд.',cost:25,cooldown:7}},
 harvester:{default:{name:'Линия разлома',icon:'fork',desc:'Ударная волна: 190% урона, оглушение.',cost:25,cooldown:5},alt:{name:'Якорь давления',icon:'skill-anchor',desc:'Стягивает врагов вокруг героя, наносит 110% урона и оглушает. Собирает группу под купол или широкий удар.',cost:25,cooldown:8}},
 aerologist:{default:{name:'Тихий вихрь',icon:'rotor',desc:'Вихрь на 4 секунды: урон и замедление.',cost:25,cooldown:7},alt:{name:'Порыв',icon:'skill-gust',desc:'Быстрый бросок вперёд с неуязвимостью; на пути остаётся режущая линия ветра, 150% урона.',cost:25,cooldown:6}}
};
export const WORKSHOP_COST=(tier:number)=>30+15*tier;
