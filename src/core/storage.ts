import type {GameState,Settings} from './types.js';
import {envelope,unpack,validateSettings,SaveEnvelope} from './validation.js';
export class SaveStore {
 private db:IDBDatabase|null=null;private release:(()=>void)|null=null;private heartbeat:number|undefined;
 private owner=crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random()}`;
 private webLock=false;private tail:Promise<void>=Promise.resolve();readOnly=false;lastSaved=0;onLost:(()=>void)|null=null;
 async open(){
  if(!('indexedDB' in window))throw new Error('Браузер не предоставляет IndexedDB. Откройте игру в обычном окне Chrome, Edge или Firefox.');
  this.db=await new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open('isobara-game-v1',1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('slots'))req.result.createObjectStore('slots');};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error??new Error('Не удалось открыть хранилище.'));req.onblocked=()=>reject(new Error('Хранилище занято старой вкладкой. Закройте её и обновите игру.'));});
  this.db.onversionchange=()=>{this.db?.close();this.loseLock();};
  if(navigator.locks){this.webLock=true;await new Promise<void>((resolve,reject)=>{navigator.locks.request('isobara-writer-v1',{ifAvailable:true},async lock=>{if(!lock){this.readOnly=true;resolve();return;}resolve();await new Promise<void>(r=>this.release=r);}).catch(reject);});}
  else {await this.claimLease();if(!this.readOnly)this.heartbeat=window.setInterval(()=>this.renewLease().catch(()=>this.loseLock()),5000);}
 }
 private loseLock(){this.readOnly=true;this.onLost?.();}
 private async claimLease(){if(!this.db)return;await new Promise<void>((resolve,reject)=>{const tx=this.db!.transaction('slots','readwrite'),os=tx.objectStore('slots'),get=os.get('lease');get.onsuccess=()=>{const old=get.result;if(old&&old.expires>Date.now()&&old.owner!==this.owner)this.readOnly=true;else os.put({owner:this.owner,expires:Date.now()+16000},'lease');};tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}
 private async renewLease(){if(this.webLock||!this.db)return;await new Promise<void>((resolve,reject)=>{const tx=this.db!.transaction('slots','readwrite'),os=tx.objectStore('slots'),get=os.get('lease');get.onsuccess=()=>{if(get.result?.owner!==this.owner){this.loseLock();return;}os.put({owner:this.owner,expires:Date.now()+16000},'lease');};tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}
 private get(key:string){return new Promise<any>((resolve,reject)=>{if(!this.db){reject(new Error('Хранилище не открыто.'));return;}const tx=this.db.transaction('slots','readonly'),q=tx.objectStore('slots').get(key);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});}
 async load(){const raw=await this.get('main'),backup=await this.get('backup');let backupState:GameState|null=null;try{if(backup)backupState=unpack(backup);}catch{/* An invalid backup is never silently promoted. */}
  if(!raw)return {state:null,backup:backupState,error:null};try{return {state:unpack(raw),backup:backupState,error:null};}catch(error){return {state:null,backup:backupState,error:(error as Error).message};}}
 write(state:GameState):Promise<void>{
  if(this.readOnly)return Promise.reject(new Error('Игра уже открыта в другой вкладке. Эта вкладка не может записывать сохранение.'));
  const data=envelope(state);const task=this.tail.catch(()=>{}).then(()=>this.transaction(data));this.tail=task;return task;
 }
 private transaction(data:SaveEnvelope){return new Promise<void>((resolve,reject)=>{
  if(this.readOnly||!this.db){reject(new Error('Запись недоступна. Экспортируйте сохранение, прежде чем закрывать вкладку.'));return;}
  const tx=this.db.transaction('slots','readwrite'),os=tx.objectStore('slots');
  const store=()=>{const q=os.get('main');q.onsuccess=()=>{if(q.result){try{unpack(q.result,false);os.put(q.result,'backup');}catch{/* Keep the last known valid backup. */}}os.put(data,'main');};};
  if(this.webLock)store();else{const q=os.get('lease');q.onsuccess=()=>{if(q.result?.owner!==this.owner){tx.abort();this.loseLock();return;}os.put({owner:this.owner,expires:Date.now()+16000},'lease');store();};}
  tx.oncomplete=()=>{this.lastSaved=Date.now();resolve();};tx.onerror=tx.onabort=()=>reject(tx.error??new Error('Сохранение не записано. Проверьте свободное место и разрешения браузера.'));
 });}
 async settings():Promise<Settings>{try{return validateSettings(await this.get('settings'));}catch{return validateSettings(null);}}
 async saveSettings(settings:Settings){if(this.readOnly||!this.db)return;const data=validateSettings(settings);await new Promise<void>((resolve,reject)=>{const tx=this.db!.transaction('slots','readwrite');tx.objectStore('slots').put(data,'settings');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}
 async backupState(){const raw=await this.get('backup');return raw?unpack(raw):null;}
 close(){if(this.heartbeat)clearInterval(this.heartbeat);this.release?.();this.db?.close();this.db=null;}
}
