// BAL-04 / EXP-04: voluntary "forecast ranks" after the final. They only make expeditions harder and better rewarded.
export interface RankDef {name:string;hp:number;damage:number;xp:number;shards:number;bonus:number;note:string}
export const RANKS:RankDef[]=[
 {name:'Ясный прогноз',hp:1,damage:1,xp:1,shards:1,bonus:0,note:'Обычные условия кампании.'},
 {name:'Переменная облачность',hp:1.2,damage:1.1,xp:1.1,shards:1.6,bonus:6,note:'Враги прочнее на 20% и бьют на 10% сильнее.'},
 {name:'Порывистый ветер',hp:1.4,damage:1.2,xp:1.2,shards:2.2,bonus:12,note:'Враги прочнее на 40%, урон +20%.'},
 {name:'Шквал',hp:1.6,damage:1.3,xp:1.3,shards:2.8,bonus:18,note:'Враги прочнее на 60%, урон +30%. Нужна отлаженная сборка.'},
 {name:'Грозовой фронт',hp:1.8,damage:1.4,xp:1.4,shards:3.4,bonus:24,note:'Враги прочнее на 80%, урон +40%.'},
 {name:'Нулевая видимость',hp:2,damage:1.5,xp:1.5,shards:4,bonus:30,note:'Враги вдвое прочнее и бьют на 50% сильнее. Редкая добыча самая частая.'}
];
export const MAX_RANK=RANKS.length-1;
export const rankDef=(r:number|undefined)=>RANKS[Math.max(0,Math.min(MAX_RANK,Math.floor(r??0)))];
