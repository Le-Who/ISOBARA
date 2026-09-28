import type {ClassId,Theme,Modifier,EnemyKind,BossId,Settings,Action} from './types.js';
export const VERSION='2.0.0';
export const TITLE='ИЗОБАРА';
export const SUBTITLE='Последний сад погоды';
export const CLASSES:Record<ClassId,{name:string;tag:string;desc:string;icon:string;color:number;hp:number;damage:number;speed:number;attackTime:number;range:number;skill:string;skillDesc:string;burst:string;burstDesc:string}>={
 lineman:{name:'Линейщик',tag:'ДИСТАНЦИЯ · ТОЧНОСТЬ',desc:'Прокладывает ток там, где оборвались линии. Держит дистанцию, пробивает защиту импульсами и связывает цели разрядом.',icon:'coil',color:0x89e2d1,hp:125,damage:25,speed:6.8,attackTime:.43,range:19,skill:'Цепной разряд',skillDesc:'Три цели, 170% урона. 25 энергии · 6 с.',burst:'Грозовой узел',burstDesc:'Импульс в точке прицела: 320% урона по области. 45 энергии · 11 с.'},
 harvester:{name:'Сборщик',tag:'БЛИЖНИЙ БОЙ · ЗАЩИТА',desc:'Возвращает станциям утраченные детали. Широкий удар камертона, ударная волна и короткое защитное поле.',icon:'fork',color:0xefc07a,hp:175,damage:43,speed:6.5,attackTime:.50,range:3.8,skill:'Линия разлома',skillDesc:'Ударная волна: 190% урона, оглушение. 25 энергии · 5 с.',burst:'Защитный купол',burstDesc:'3 секунды защиты и импульс 250% урона. 45 энергии · 12 с.'},
 aerologist:{name:'Аэролог',tag:'ОБЛАСТЬ · МОБИЛЬНОСТЬ',desc:'Читает воздух как партитуру. Разбрасывает заряженные семена, собирает вихри и отталкивает целые группы.',icon:'rotor',color:0xc4afe8,hp:140,damage:19,speed:7.2,attackTime:.62,range:15,skill:'Тихий вихрь',skillDesc:'Вихрь на 4 секунды: урон и замедление. 25 энергии · 7 с.',burst:'Обратный фронт',burstDesc:'Волна вокруг героя: 300% урона и отбрасывание. 45 энергии · 10 с.'}
};
export const THEMES:Record<Theme,{name:string;biome:string;floor:number;edge:number;accent:number;fog:number;description:string}>={
 garden:{name:'Конденсационные сады',biome:'Тихие сады',floor:0x8fae9b,edge:0xd6c8a5,accent:0x7fe9ce,fog:0x243e41,description:'Станции, которые собирали влагу из утреннего воздуха. Теперь их садовники не отличают человека от сорняка.'},
 foundry:{name:'Тепловые станции',biome:'Охряные плато',floor:0xaf8564,edge:0xd3b790,accent:0xffbc75,fog:0x433b45,description:'Котельные продолжают греть давно пустые поселения. Их механизмы защищают накопленное тепло.'},
 archive:{name:'Архивы фронтов',biome:'Стеклянные поля',floor:0x7c829c,edge:0xc1b9cc,accent:0xc6acff,fog:0x282c46,description:'Здесь хранились образцы погоды. Один незавершённый прогноз научился повторять сам себя.'}
};
export const MODIFIERS:Record<Modifier,{name:string;symbol:string;desc:string;reward:string}>={
 echo:{name:'Отложенное эхо',symbol:'◌',desc:'После гибели противник оставляет круг разряда. Через секунду круг взрывается. Не стойте на месте.',reward:'Повышен шанс редкого предмета.'},
 storm:{name:'Грозовой фон',symbol:'ϟ',desc:'Во время боя над отмеченным местом собирается разряд. Уйдите из круга до удара.',reward:'Повышен шанс редкого предмета.'},
 famine:{name:'Сухой воздух',symbol:'◇',desc:'Ремкомплекты лечат на 30% слабее, но противники движутся на 15% медленнее.',reward:'Повышен шанс редкого предмета.'}
};
export const ENEMIES:Record<Exclude<EnemyKind,'boss'>,{name:string;hp:number;damage:number;speed:number;range:number;cooldown:number;xp:number;tip:string}>={
 mite:{name:'Сборщик росы',hp:53,damage:11,speed:3.4,range:1.65,cooldown:1.45,xp:13,tip:'Сближается и кусает. Короткая вспышка предупреждает об ударе.'},
 sentry:{name:'Сигнальщик',hp:72,damage:13,speed:2.25,range:10,cooldown:2.15,xp:17,tip:'Стреляет медленными импульсами. Меняйте направление движения.'},
 ram:{name:'Уплотнитель',hp:122,damage:22,speed:2.1,range:8,cooldown:3.8,xp:24,tip:'Отмечает прямую и делает рывок. Уходите поперёк линии.'},
 mender:{name:'Прививщик',hp:92,damage:10,speed:2.1,range:8,cooldown:3.7,xp:23,tip:'Восстанавливает соседние механизмы. Устраните его первым.'},
 mortar:{name:'Барометр',hp:113,damage:21,speed:1.6,range:13,cooldown:3.1,xp:26,tip:'Отмечает место падения заряда. После предупреждения меняйте позицию.'},
 warden:{name:'Заслонщик',hp:158,damage:19,speed:2.5,range:2.3,cooldown:2.05,xp:28,tip:'Фронтальная броня ослабляет базовые атаки. Обходите с фланга или применяйте способности.'}
};
export const BOSSES:Record<BossId,{name:string;subtitle:string;patterns:readonly string[];tip:string;icon:string}>={
 gardener:{name:'Садовник без сада',subtitle:'ОРОСИТЕЛЬНЫЙ КОНТУР',patterns:['fan','stomp','fan','seeds'],tip:'Между тремя лучами остаются проходы. Когда опускается корона — отойдите от корпуса.',icon:'seed'},
 herdsman:{name:'Пастух ветра',subtitle:'ВЕТРОВОЙ КОНТУР',patterns:['charge','fan','cross','charge'],tip:'Рывок проходит по отмеченной линии. Не убегайте вдоль неё — шагните вбок.',icon:'rotor'},
 stoker:{name:'Котельщик',subtitle:'ТЕПЛОВОЙ КОНТУР',patterns:['seeds','stomp','seeds','fan'],tip:'Три очага возникают последовательно. Сохраняйте место для следующего уклонения.',icon:'furnace'},
 archivist:{name:'Архивариус оттепели',subtitle:'КОНТУР ПАМЯТИ',patterns:['cross','ring','fan','seeds'],tip:'Световые линии пересекают зал. Найдите свободный сектор и не забывайте атаковать.',icon:'gauge'},
 collector:{name:'Сборщик гроз',subtitle:'ГРОЗОВОЙ КОНТУР',patterns:['ring','charge','seeds','cross','fan'],tip:'Перемещается между дальними и ближними атаками. Сберегите рывок для кольца.',icon:'orb'},
 front:{name:'Нулевой фронт',subtitle:'ПРОГНОЗ, КОТОРЫЙ НЕ ЗАКОНЧИЛСЯ',patterns:['cross','ring','seeds','charge','fan','stomp'],tip:'После потери трети здоровья меняет ритм. Красный круг всегда оставляет время для уклонения.',icon:'void'}
};
export const TIER_BOSSES:BossId[]=['gardener','gardener','herdsman','stoker','archivist','collector'];
export interface UpgradeDef {id:string;name:string;desc:string;icon:string;minTier:number;max:number;amount:number;unit:string;classId?:ClassId;stat?:string;kind:'stat'|'skill'}
export const UPGRADES:UpgradeDef[]=[
 {id:'power',name:'Чистый сигнал',desc:'Урон всех атак',icon:'coil',minTier:1,max:6,amount:4,unit:'%',stat:'damage',kind:'stat'},
 {id:'health',name:'Запас прочности',desc:'Максимальное здоровье',icon:'vest',minTier:1,max:6,amount:14,unit:'',stat:'hp',kind:'stat'},
 {id:'haste',name:'Лёгкий затвор',desc:'Скорость базовых атак',icon:'rotor',minTier:1,max:5,amount:4,unit:'%',stat:'haste',kind:'stat'},
 {id:'speed',name:'Попутный ветер',desc:'Скорость передвижения',icon:'cloak',minTier:1,max:4,amount:3,unit:'%',stat:'speed',kind:'stat'},
 {id:'crit',name:'Верный отсчёт',desc:'Вероятность критического удара',icon:'gauge',minTier:1,max:5,amount:3,unit:' п.п.',stat:'crit',kind:'stat'},
 {id:'armor',name:'Керамический слой',desc:'Снижение получаемого урона',icon:'vest',minTier:1,max:5,amount:3,unit:' п.п.',stat:'armor',kind:'stat'},
 {id:'siphon',name:'Сбор конденсата',desc:'Здоровье за побеждённого врага',icon:'tonic',minTier:1,max:4,amount:2,unit:'',stat:'siphon',kind:'stat'},
 {id:'energy',name:'Тихий аккумулятор',desc:'Восстановление энергии в секунду',icon:'furnace',minTier:1,max:5,amount:1.5,unit:'',stat:'energy',kind:'stat'},
 {id:'cooldown',name:'Обратная связь',desc:'Сокращение перезарядки способностей',icon:'gauge',minTier:2,max:5,amount:4,unit:'%',stat:'cooldown',kind:'stat'},
 {id:'skillPower',name:'Глубокий резонанс',desc:'Урон активных способностей',icon:'orb',minTier:2,max:5,amount:7,unit:'%',stat:'skillPower',kind:'stat'},
 {id:'healing',name:'Живая вода',desc:'Эффективность ремкомплектов',icon:'tonic',minTier:1,max:4,amount:6,unit:'%',stat:'healing',kind:'stat'},
 {id:'capacity',name:'Полевая аптечка',desc:'Ремкомплекты на экспедицию',icon:'tonic',minTier:2,max:2,amount:1,unit:'',stat:'capacity',kind:'stat'},
 {id:'reach',name:'Длинная волна',desc:'Дальность атаки',icon:'fork',minTier:1,max:4,amount:5,unit:'%',stat:'reach',kind:'stat'},
 {id:'dash',name:'Между каплями',desc:'Сокращение перезарядки рывка',icon:'cloak',minTier:2,max:4,amount:8,unit:'%',stat:'dash',kind:'skill'},
 {id:'aegis',name:'Встречный барьер',desc:'Щит после рывка',icon:'vest',minTier:3,max:3,amount:10,unit:'',kind:'skill'},
 {id:'pierce',name:'Сквозная линия',desc:'Дополнительные пробиваемые цели',icon:'prism',minTier:2,max:3,amount:1,unit:'',classId:'lineman',kind:'skill'},
 {id:'chain',name:'Соседний провод',desc:'Дополнительные цели цепного разряда',icon:'coil',minTier:2,max:3,amount:1,unit:'',classId:'lineman',kind:'skill'},
 {id:'double',name:'Двойная частота',desc:'Каждый 4-й базовый импульс выпускает второй заряд',icon:'fork',minTier:3,max:1,amount:1,unit:'',classId:'lineman',kind:'skill'},
 {id:'overload',name:'Замкнутая гроза',desc:'Радиус грозового узла',icon:'orb',minTier:4,max:2,amount:1.3,unit:' м',classId:'lineman',kind:'skill'},
 {id:'cleave',name:'Широкий захват',desc:'Дополнительные цели базового взмаха',icon:'fork',minTier:2,max:3,amount:2,unit:'',classId:'harvester',kind:'skill'},
 {id:'aftershock',name:'Вторая волна',desc:'Повторный удар линии разлома через полсекунды',icon:'furnace',minTier:3,max:1,amount:1,unit:'',classId:'harvester',kind:'skill'},
 {id:'recovery',name:'Ремонт на ходу',desc:'Здоровье при попадании линией разлома',icon:'tonic',minTier:2,max:3,amount:8,unit:'',classId:'harvester',kind:'skill'},
 {id:'bulwark',name:'Удержать давление',desc:'Дополнительная длительность защитного купола',icon:'vest',minTier:4,max:2,amount:1,unit:' с',classId:'harvester',kind:'skill'},
 {id:'pellets',name:'Семенной веер',desc:'Дополнительные заряды в базовом веере',icon:'seed',minTier:2,max:2,amount:1,unit:'',classId:'aerologist',kind:'skill'},
 {id:'linger',name:'Долгая оттепель',desc:'Дополнительная длительность вихря',icon:'rotor',minTier:2,max:3,amount:1,unit:' с',classId:'aerologist',kind:'skill'},
 {id:'stormEye',name:'Глаз бури',desc:'Вихрь восстанавливает 4 здоровья в секунду стоящему внутри герою',icon:'orb',minTier:3,max:1,amount:1,unit:'',classId:'aerologist',kind:'skill'},
 {id:'return',name:'Ветер возвращается',desc:'Обратный фронт восстанавливает здоровье за задетую цель',icon:'cloak',minTier:4,max:2,amount:12,unit:'',classId:'aerologist',kind:'skill'}
];
export const UPGRADE_BY_ID=Object.fromEntries(UPGRADES.map(u=>[u.id,u]));
export const RARITIES=['','Серийный','Настроенный','Штучный','Архивный'];
export const SLOTS={instrument:'Инструмент',shell:'Оболочка',relic:'Резонатор'};
export const EFFECTS={none:'',first:'Первый импульс: +25% урона по цели с полным здоровьем.',barrier:'После победы над врагом создаёт щит на 12 единиц.',battery:'Восстанавливает дополнительно 3 энергии в секунду.',siphon:'Победа над врагом восстанавливает 4 здоровья.'};
export const LORE=[
 ['До первого фронта','Мы не управляли погодой. Мы договаривались с ней. Каждая станция хранила одно обещание: дождь для садов, ветер для мельниц, тепло для домов.'],
 ['Ошибка в прогнозе','Нулевой фронт должен был описать один тихий день. Но прогноз не получил команды завершения. С тех пор механизмы повторяют его снова и снова.'],
 ['Садовники','Садовников учили беречь каждую каплю. Теперь они собирают влагу из всего живого. В их памяти нет злости. Есть только неоконченная работа.'],
 ['Место для ветра','Станции стоят там, где раньше жили люди. Мастера оставляли между ними широкие дороги: ветер нельзя было заключать в слишком тесные коридоры.'],
 ['Тепло на потом','Котельщик не потратил ни одного градуса. Все эти годы он хранил тепло для людей, которые не возвращались. Теперь он никому его не отдаёт.'],
 ['Комнаты прогноза','За разломами лежат не другие миры, а фрагменты этого. Память системы снова собирает залы из того, что сумела сохранить.'],
 ['Пять обещаний','Вода. Ветер. Тепло. Память. Гроза. Верни станциям пять контуров, и центральный узел сможет услышать команду завершения.'],
 ['Последний сад','Последний сад не место на карте. Это то, что мы решим вырастить, когда завтра снова станет неизвестным.']
];
export const ACTION_NAMES:Record<Action,string>={up:'Вперёд',down:'Назад',left:'Влево',right:'Вправо',attack:'Базовая атака',skill:'Способность',burst:'Особый приём',dash:'Рывок',heal:'Ремкомплект',interact:'Взаимодействие',inventory:'Снаряжение',map:'Карта',journal:'Полевой журнал',cameraLeft:'Поворот камеры влево',cameraRight:'Поворот камеры вправо'};
export const DEFAULT_SETTINGS:Settings={quality:'high',fps:60,scale:1,shake:true,particles:true,uiScale:1,music:.28,sound:.65,camera:1,bindings:{up:'KeyW',down:'KeyS',left:'KeyA',right:'KeyD',attack:'Mouse0',skill:'Mouse2',burst:'KeyF',dash:'Space',heal:'KeyR',interact:'KeyE',inventory:'KeyI',map:'KeyM',journal:'KeyJ',cameraLeft:'KeyZ',cameraRight:'KeyX'}};
