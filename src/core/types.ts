export interface Vec { x:number; z:number }
export type ClassId='lineman'|'harvester'|'aerologist';
export type Theme='garden'|'foundry'|'archive';
export type Modifier='echo'|'storm'|'famine';
export type Slot='instrument'|'shell'|'relic';
export type EnemyKind='mite'|'sentry'|'ram'|'mender'|'mortar'|'warden'|'boss';
export type BossId='gardener'|'herdsman'|'stoker'|'archivist'|'collector'|'front';
export type Phase='world'|'expedition'|'reward'|'dead'|'epilogue';
export interface Rect { x:number; z:number; w:number; d:number }
export interface Obstacle extends Vec { r:number; kind:'rock'|'tree'|'machine'|'pillar' }
export interface Portal extends Vec {
 id:string; seed:number; tier:number; theme:Theme; mods:Modifier[]; title:string;
 main:boolean; final:boolean;
}
export interface Poi extends Vec { id:string; kind:'camp'|'archive'|'cache'; seed:number; title:string }
export interface Prop extends Vec { kind:'tree'|'rock'|'grass'|'reed'|'flower'|'machine'; scale:number; rot:number; color:number }
export interface Chunk { id:string; cx:number; cz:number; props:Prop[]; obstacles:Obstacle[]; portals:Portal[]; pois:Poi[] }
export interface Room extends Vec {
 id:number; gx:number; gz:number; module:string; w:number; d:number; shape:'rect'|'octagon'|'cross';
 role:'entry'|'combat'|'boss'|'rest'; rotation:number; obstacles:Obstacle[]; spawns:Vec[];
}
export interface Corridor extends Rect { from:number; to:number }
export interface Spawn extends Vec { id:string; kind:EnemyKind; room:number; boss?:BossId }
export interface Layout {
 seed:number; tier:number; theme:Theme; rooms:Room[]; corridors:Corridor[]; spawns:Spawn[];
 entry:Vec; bossRoom:number; fallback:boolean; nav?:NavGrid;
}
export interface NavGrid { x0:number; z0:number; w:number; h:number; cell:number; walk:Uint8Array; count:number }
export interface Enemy extends Spawn {
 hp:number; maxHp:number; timer:number; windup:number; pattern:number; tx:number; tz:number;
 dx:number; dz:number; stun:number; charge:number; dead:boolean; homeX:number; homeZ:number;
}
export interface Cooldowns { attack:number; skill:number; burst:number; dash:number; heal:number }
export interface Player extends Vec {
 classId:ClassId; hp:number; energy:number; xp:number; potions:number; faceX:number; faceZ:number;
 cooldowns:Cooldowns; invuln:number; dashTime:number; dashX:number; dashZ:number;
 shield:number; guard:number; lastDamage:number;
}
export interface Item {
 id:string; name:string; slot:Slot; tier:number; rarity:1|2|3|4; icon:string;
 damage:number; hp:number; armor:number; crit:number; haste:number;
 effect:'none'|'first'|'barrier'|'battery'|'siphon';
}
export interface UpgradeOffer { id:string; from:number; to:number; supply?:'health'|'energy'|'fortune' }
export interface PendingReward { runId:string; offers:UpgradeOffer[]; item:Item; tier:number; firstSeal:boolean; final:boolean }
export interface RunState {
 id:string; portal:Portal; seed:number; enemies:Enemy[]; elapsed:number; restUsed:number[];
 clearedRooms:number[]; rng:number; returnPos:Vec; serial:number; boons:{health:boolean;energy:boolean;fortune:boolean};
}
export interface Statistics { kills:number; portals:number; deaths:number; seconds:number; bestTier:number }
export interface GameState {
 version:1; generator:1; seed:number; phase:Phase; mode:'standard'|'explorer'; player:Player;
 inventory:Item[]; equipment:Partial<Record<Slot,string>>; mailbox:Item[]; upgrades:Record<string,number>;
 shards:number; respecPoints:number; crafts:number; discovered:string[]; explored:string[]; collected:string[]; seals:number[];
 completions:Record<string,number>; attempts:number; rareMisses:number; finalCleared:boolean;
 run:RunState|null; reward:PendingReward|null; stats:Statistics; journal:string[];
 mastery:{health:number;energy:number;fortune:number}; updated:number;
}
export interface Stats {
 level:number; hp:number; damage:number; speed:number; attackTime:number; range:number; armor:number;
 crit:number; energyRegen:number; skillPower:number; cooldown:number; potionCount:number; healPower:number;
 siphon:number; reach:number; dashCooldown:number; chain:number; pierce:number; pellets:number; slow:number;
 effects:string[];
}
export interface InputFrame { mx:number; mz:number; ax:number; az:number; aimDistance?:number; attack:boolean; skill:boolean; burst:boolean; dash:boolean; heal:boolean }
export interface Projectile extends Vec { id:number; vx:number; vz:number; radius:number; damage:number; ttl:number; enemy:boolean; pierce:number; hit:string[]; color:number; source?:string }
export interface Hazard extends Vec { id:number; kind:'circle'|'line'|'field'|'ring'; radius:number; delay:number; ttl:number; damage:number; enemy:boolean; dx:number; dz:number; length:number; tick:number; source?:string }
export interface GameEvent extends Vec { type:'hit'|'kill'|'shot'|'slash'|'cast'|'dash'|'heal'|'level'|'room'|'toast'|'save'|'phase'|'warning'|'loot'; value?:number; text?:string; color?:number; dx?:number; dz?:number; radius?:number }
export type Action='up'|'down'|'left'|'right'|'attack'|'skill'|'burst'|'dash'|'heal'|'interact'|'inventory'|'map'|'journal'|'cameraLeft'|'cameraRight';
export interface Settings { quality:'low'|'medium'|'high'; fps:30|60; scale:number; shake:boolean; particles:boolean; uiScale:number; music:number; sound:number; camera:number; bindings:Record<Action,string> }
