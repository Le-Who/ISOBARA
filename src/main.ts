import {regionAt} from './world/world.js';
import {randomCode,deriveIds,encryptText,decryptText,snapshotRequest,endpointURL} from './core/cloud.js';
import {GameUI} from './ui/ui.js';
import {GameView} from './render/view.js';
import {Simulation} from './core/simulation.js';
import {Input} from './core/input.js';
import {AudioSystem} from './core/audio.js';
import {SaveStore} from './core/storage.js';
import {newGame,equipItem,salvage,favorite,respec,spendRespec,craftItem,craftFamily,restorePlayer,salvageValue,craftSlot,refitItem,retuneItem,salvageBulk,type BulkPreview,type InventoryFilter,hasItemSpace} from './core/progression.js';
import {DEFAULT_SETTINGS,CLASSES,ACTION_NAMES,VERSION} from './core/content.js';
import {envelope,importText,validateSettings} from './core/validation.js';
import {keyLabel} from './ui/assets.js';
import {hash,clamp} from './core/math.js';
import type {GameState,Settings,Action,Portal,Poi,GameEvent,InputFrame} from './core/types.js';
class App {
 private pendingBulk:BulkPreview|null=null;private cloudEndpoint='';private cloudBusy=false;
 ui=new GameUI();store=new SaveStore();settings:Settings=structuredClone(DEFAULT_SETTINGS);view!:GameView;sim!:Simulation;input!:Input;audio=new AudioSystem(this.settings);
 saved:GameState|null=null;backup:GameState|null=null;active=false;busy=false;volatile=false;contextLost=false;pendingImport:GameState|null=null;
 private now=0;private accumulator=0;private lastRender=0;private lastHud=0;private lastSave=0;private saveRequested=false;private saving=false;private lastError=0;private fpsFrames=0;private fpsTime=0;private lastFoot={x:0,z:0};private queued={skill:false,burst:false,dash:false,heal:false};
 constructor(){this.ui.onAction=(action,element,event)=>{void this.action(action,element,event).catch(e=>this.error(e));};}
 async init(){
  let storageError:string|null=null,corruptError:string|null=null;
  try{await this.store.open();this.settings=await this.store.settings();const data=await this.store.load();this.saved=data.state;this.backup=data.backup;corruptError=data.error;}
  catch(e){storageError=(e as Error).message;}
  try{this.view=new GameView(document.getElementById('viewport')!,this.settings);}catch(e){document.getElementById('loading')?.remove();this.ui.message('Не удалось открыть трёхмерный мир','Нужен настольный браузер с WebGL2. Включите аппаратное ускорение браузера, обновите видеодрайвер и откройте файл повторно.\n\n'+(e as Error).message,[{label:'Перезагрузить',action:'reload'},{label:'О проекте',action:'credits',style:'secondary'}],true);return;}
  const canvas=this.view.renderer.domElement as HTMLCanvasElement;this.input=new Input(this.settings,canvas);this.applySettings();
  this.sim=new Simulation(newGame(19320422,'lineman'));this.view.setSimulation(this.sim);this.view.menu=true;this.ui.showTitle(!!this.saved,this.saved);this.ui.updateDock(this.sim.state,this.settings);
  document.getElementById('loading')?.remove();
  this.store.onLost=()=>{this.ui.banner('Эта вкладка потеряла право записи. Остановитесь и экспортируйте прогресс.');this.autoPause('Другая вкладка получила доступ к сохранению.');};
  window.addEventListener('blur',()=>this.autoPause('Игра приостановлена при потере фокуса.'));
  document.addEventListener('visibilitychange',()=>{if(document.hidden){this.autoPause('Вкладка была скрыта.');void this.persist(true);}});
  window.addEventListener('pagehide',()=>{if(this.active&&!this.volatile&&!this.store.readOnly)void this.store.write(this.sim.state).catch(()=>{});});
  canvas.addEventListener('wheel',e=>{if(this.active&&!this.ui.modal&&!this.busy){e.preventDefault();this.view.distance=clamp(this.view.distance+Math.sign(e.deltaY)*1.4,21,40);}},{passive:false});
  window.addEventListener('error',e=>{if(!(e instanceof ErrorEvent))return;this.audio.pause(true);this.input.reset();this.ui.message('Прогноз остановлен', 'Произошла ошибка выполнения. Экспортируйте текущее состояние и перезагрузите игру.\n\n'+e.message,[{label:'Экспорт прогресса',action:'export'},{label:'Перезагрузить',action:'reload',style:'secondary'}],true);void this.persist(true);});
  window.addEventListener('isobara-context-lost',()=>{this.contextLost=true;this.autoPause('Графический контекст потерян. Прогресс можно экспортировать.');this.ui.banner('Графика временно недоступна. Сохраните прогресс и перезагрузите игру.');void this.persist(true);});
  window.addEventListener('isobara-context-restored',()=>{this.contextLost=false;this.ui.toast('Графический контекст восстановлен.');});
  if(__DEV__)window.__isobara=Object.freeze({snapshot:()=>structuredClone(this.sim.snapshot()),project:(x:number,z:number,y=1.5)=>this.view.project(x,z,y),pathTo:(target:{x:number;z:number})=>this.sim.navigationPath(target),camera:()=>({yaw:this.view.yaw,distance:this.view.distance}),metrics:()=>({...this.view.metrics,worldCache:(this.sim.world as any).cache?.size??null,enemyViews:this.view.enemyViews.size,particles:this.view.particleData.length,hazards:this.view.hazardViews.size,fx:this.view.fx.length,modal:this.ui.modal,busy:this.busy,saveReadOnly:this.store.readOnly,audio:this.audio.status()}),version:VERSION});
  requestAnimationFrame(t=>this.loop(t));
  if(this.store.readOnly)this.ui.message('Игра уже открыта','Другая вкладка владеет этим сохранением. Здесь запись заблокирована, чтобы вкладки не перезаписали друг друга. Закройте другую вкладку и перезагрузите эту.',[{label:'Перезагрузить',action:'reload'}],true);
  else if(storageError)this.ui.message('Хранилище недоступно',storageError+'\n\nВременный сеанс не сохраняется автоматически. Его можно экспортировать вручную.',[{label:'Перезагрузить',action:'reload'},{label:'Временный сеанс',action:'volatile',style:'secondary'}],true);
  else if(corruptError)this.ui.message('Сохранение требует восстановления',corruptError+'\n\nПовреждённый слот не заменён новым автоматически.',[...(this.backup?[{label:'Восстановить резервную копию',action:'restore-backup'}]:[]),{label:'Импорт из файла',action:'import',style:'secondary'},{label:'Начать новый путь',action:'discard-corrupt',style:'danger'}],true);
 }
 private paused(){return !this.active||!!this.ui.modal||this.busy||document.hidden||this.contextLost;}
 private loop(now:number){
  const dt=Math.min(.10,Math.max(0,(now-(this.now||now))/1000));this.now=now;
  this.handleKeys();const paused=this.paused();
  if(!paused){
   const b=this.settings.bindings;if(this.input.held.has(b.cameraLeft))this.view.yaw-=dt*1.35*this.settings.camera;if(this.input.held.has(b.cameraRight))this.view.yaw+=dt*1.35*this.settings.camera;
   const frame=this.input.frame(this.view.yaw,this.view.aim(this.input.mouse.x,this.input.mouse.y));for(const k of ['skill','burst','dash','heal'] as const)this.queued[k] ||= frame[k];this.accumulator=Math.min(.12,this.accumulator+dt);let first=true;
   while(this.accumulator>=1/60){const f=first?{...frame,...this.queued}:{...frame,skill:false,burst:false,dash:false,heal:false};this.sim.tick(1/60,f);if(first)this.queued={skill:false,burst:false,dash:false,heal:false};first=false;this.accumulator-=1/60;if(!['world','expedition'].includes(this.sim.state.phase))break;}
   if(Math.hypot(this.sim.p.x-this.lastFoot.x,this.sim.p.z-this.lastFoot.z)>1.8){this.audio.sfx('step');this.lastFoot={x:this.sim.p.x,z:this.sim.p.z};}
  }else{this.accumulator=0;this.queued={skill:false,burst:false,dash:false,heal:false};}
  if(!this.busy)this.processEvents();
  if(this.active&&!this.busy&&!this.saving&&!this.store.readOnly&&(this.saveRequested&&now-this.lastSave>400||now-this.lastSave>3000)){this.saveRequested=false;void this.persist();}
  const renderInterval=1000/this.settings.fps;
  if(!document.hidden&&!this.contextLost&&(now-this.lastRender>=renderInterval-1||!this.lastRender)){
   const renderDt=Math.min(.1,(now-(this.lastRender||now))/1000)||1/60;this.lastRender=now;
   this.view.update(renderDt);this.view.render();this.ui.animation(renderDt,(x,z,y)=>this.view.project(x,z,y),this.input.mouse);this.fpsFrames++;this.fpsTime+=renderDt;
   if(this.fpsTime>1){this.view.metrics.fps=this.fpsFrames/this.fpsTime;this.fpsFrames=0;this.fpsTime=0;}
  }
  if(this.active&&now-this.lastHud>95){this.ui.update(this.sim,this.settings);this.lastHud=now;}
  if(!paused){const threat=this.sim.state.run?this.sim.enemies().some(e=>!e.dead&&Math.hypot(e.x-this.sim.p.x,e.z-this.sim.p.z)<22&&(e.kind!=='boss'||!this.sim.bossLocked())):this.sim.inCombat();this.audio.tick(threat,this.sim.layout?.theme??regionAt(this.sim.p.x,this.sim.p.z),this.sim.state.seals.length);}this.input.endFrame();requestAnimationFrame(t=>this.loop(t));
 }
 private handleKeys(){
  if(this.input.take('Escape')){if(this.ui.modal){if(this.ui.closable)this.closeModal();}else if(this.active)this.openPause();}
  if(!this.active||this.busy||this.ui.modal&&!this.ui.closable)return;
  for(const key of ['inventory','map','journal'] as Action[])if(this.input.action(key)){if(this.ui.modal===key)this.closeModal();else void this.action(key,this.ui.root);return;}
  if(!this.ui.modal&&this.input.action('interact'))void this.action('interact',this.ui.root);
 }
 private processEvents(){const events=this.sim.drain();let phase:string|undefined;for(const event of events){if(event.type==='save')this.saveRequested=true;else if(event.type==='phase')phase=event.text;else{this.view.event(event);this.ui.event(event);if(event.type!=='warning'||event.value!==undefined)this.audio.sfx(event.type);}}
  if(phase)void this.phaseChanged(phase).catch(e=>this.error(e));
 }
 private async phaseChanged(phase:string){this.input.reset();this.audio.pause(true);this.busy=true;this.saveRequested=false;
  try{await this.persist(true);
   if(phase==='reward'){this.ui.selectedReward=-1;this.ui.showReward(this.sim.state);}
   else if(phase==='dead')this.ui.showDeath(this.sim.state);
   else if(phase==='epilogue'){this.view.rebuild();this.ui.showEpilogue(this.sim.state);this.audio.pause(false);this.audio.sfx('level');this.audio.pause(true);}
   else{this.view.rebuild();this.ui.forceClose();this.ui.updateDock(this.sim.state,this.settings);this.audio.pause(false);}
  }finally{this.busy=false;}
 }
 private openPause(reason=''){if(!this.active||this.ui.modal&&!this.ui.closable)return;this.input.reset();this.ui.showPause(this.sim.state,reason);this.audio.pause(true);void this.persist(true);}
 private autoPause(reason:string){if(this.active&&!this.ui.modal&&['world','expedition'].includes(this.sim.state.phase))this.openPause(reason);else this.audio.pause(true);}
 private closeModal(){if(this.ui.close()){this.input.reset();this.audio.pause(!this.active);if(this.active)void this.audio.start();}}
 private applySettings(){document.documentElement.style.fontSize=`${14*this.settings.uiScale}px`;document.documentElement.classList.toggle('no-motion',!this.settings.shake);this.audio.apply(this.settings);if(this.input)this.input.settings=this.settings;if(this.view)this.view.applySettings(this.settings);if(this.sim)this.ui.updateDock(this.sim.state,this.settings);}
 private async persist(force=false):Promise<boolean>{
  if(!this.active)return true;if(this.volatile){this.saved=structuredClone(this.sim.state);this.ui.saveStatus('Временный сеанс · экспортируйте прогресс',true);return true;}if(this.store.readOnly)return false;
  if(this.saving&&!force){this.saveRequested=true;return true;}this.saving=true;this.ui.saveStatus('Сохраняем…');const state=this.sim.state;
  try{await this.store.write(state);this.saved=structuredClone(state);this.lastSave=performance.now();this.ui.saveStatus('Сохранено на этом устройстве');this.ui.banner(null);return true;}
  catch(e){this.ui.saveStatus('Не сохранено · доступен экспорт',true);this.ui.banner('Не удалось записать прогресс. Не закрывайте игру без экспорта.');if(performance.now()-this.lastError>5000){this.lastError=performance.now();this.ui.toast((e as Error).message,true);}return false;}
  finally{this.saving=false;}
 }
 private async startPlaying(state:GameState,resuming=false){
  this.busy=true;this.ui.transition(true,resuming?'Возвращаем сохранённый прогноз…':'Первый день нового прогноза…');this.input.reset();
  await new Promise<void>(r=>requestAnimationFrame(()=>r()));this.sim=new Simulation(state);this.view.menu=false;this.view.setSimulation(this.sim);this.active=true;this.ui.forceClose();this.ui.hideTitle();this.ui.updateDock(state,this.settings);this.lastSave=performance.now();this.lastFoot={x:state.player.x,z:state.player.z};
  this.ui.transition(false);this.busy=false;await this.audio.start();
  if(state.phase==='reward'){this.ui.selectedReward=-1;this.ui.showReward(state);this.audio.pause(true);}
  else if(state.phase==='dead'){this.ui.showDeath(state);this.audio.pause(true);}
  else if(state.phase==='epilogue'){this.ui.showEpilogue(state);this.audio.pause(true);}
  else if(resuming&&state.phase==='expedition')this.openPause('Экспедиция восстановлена. Противники, здоровье и накопленный опыт сохранены.');
  else if(!resuming){this.ui.message('Ваш первый прогноз','Первый разлом виден недалеко от станции. Следуйте к светящейся арке; подойдите и нажмите '+keyLabel(this.settings.bindings.interact)+'.\n\n'+keyLabel(this.settings.bindings.attack)+' — атака. '+keyLabel(this.settings.bindings.skill)+' и '+keyLabel(this.settings.bindings.burst)+' — способности. '+keyLabel(this.settings.bindings.dash)+' — рывок, '+keyLabel(this.settings.bindings.heal)+' — лечение.\n\nВ журнале есть цель путешествия, а на карте — главный сигнал.',[{label:'Выйти в сады',action:'close'},{label:'Руководство',action:'help',style:'secondary'}]);this.audio.pause(true);}
 }
 private async action(action:string,el:HTMLElement,event?:Event){
  if(action==='reload'){location.reload();return;}
  if(action==='credits'){this.ui.showCredits();return;}
  if(action==='close'){this.closeModal();return;}
  if(action==='help'){this.input?.reset();this.ui.showHelp(this.settings);this.audio.pause(true);return;}
  if(action==='volatile'){this.volatile=true;this.ui.forceClose();this.ui.toast('Временный сеанс: не забудьте экспортировать сохранение.');return;}
  if(action==='discard-corrupt'){this.ui.forceClose();this.saved=null;this.ui.showNewGame(false);return;}
  if(action==='restore-backup'&&this.backup){await this.store.write(this.backup);this.saved=structuredClone(this.backup);this.ui.forceClose();this.ui.showTitle(true,this.saved);this.ui.toast('Резервная копия восстановлена.');return;}
  if(action==='settings'){this.input?.reset();this.ui.showSettings(this.settings);this.audio.pause(true);return;}
  if(action==='setting'){const input=el as HTMLInputElement,key=input.dataset.setting!;const val=input.type==='checkbox'?input.checked:key==='quality'?input.value:Number(input.value);this.settings=validateSettings({...this.settings,[key]:val});const label=document.getElementById('label-'+key);if(label)label.textContent=key==='camera'?Number(val).toFixed(1)+'×':Math.round(Number(val)*100)+'%';this.applySettings();if(!this.volatile)await this.store.saveSettings(this.settings);return;}
  if(action.startsWith('bind:')){const key=action.slice(5) as Action;el.classList.add('listening');el.textContent='Нажмите…';this.input.reset();this.input.capture=code=>{if(code){const proposed={...this.settings.bindings},old=proposed[key],other=(Object.keys(proposed) as Action[]).find(k=>proposed[k]===code);if(other)proposed[other]=old;proposed[key]=code;const next=validateSettings({...this.settings,bindings:proposed});if(next.bindings[key]!==code)this.ui.toast('Эта клавиша зарезервирована браузером или не поддерживается.');this.settings=next;this.applySettings();void this.store.saveSettings(this.settings).catch(()=>{});}this.ui.showSettings(this.settings);};return;}
  if(action==='reset-bindings'){this.settings.bindings=structuredClone(DEFAULT_SETTINGS.bindings);this.applySettings();this.ui.showSettings(this.settings);if(!this.volatile)await this.store.saveSettings(this.settings);return;}
  if(action==='cloud'){if(this.cloudBusy)return;this.input?.reset();this.audio.pause(true);this.ui.showCloud(this.cloudEndpoint,!!(this.active||this.saved||this.backup));return;}
  if(action==='cloud-upload'||action==='cloud-download'){
   if(this.cloudBusy)return;let endpoint:string;try{endpoint=endpointURL((document.getElementById('cloud-endpoint') as HTMLInputElement).value);}catch(e){this.ui.toast((e as Error).message,true);return;}
   const enteredCode=(document.getElementById('cloud-code') as HTMLInputElement).value;this.cloudEndpoint=endpoint;this.cloudBusy=true;
   this.ui.message('Связываемся с сервисом','Локальный слот не заменяется. Ожидание — до 15 секунд.',[],true);
   try{
    if(action==='cloud-upload'){
     const state=this.active?this.sim.state:this.saved??this.backup;if(!state)throw new Error('Нет прогресса для копирования.');
     if(this.active)this.sim.flushEncounters();const text=JSON.stringify(envelope(state));
     const code=await randomCode(),{id,key}=await deriveIds(code),blob=await encryptText(key,text);
     const result=await snapshotRequest(endpoint,id,blob);if(result?.ok!==true)throw new Error('Сервис не подтвердил запись копии.');this.ui.showCloudReceipt(endpoint,code);
    }else{
     const {id,key}=await deriveIds(enteredCode),blob=await snapshotRequest(endpoint,id),state=importText(await decryptText(key,blob));
     this.pendingImport=state;this.ui.message('Заменить локальный прогноз?',`${CLASSES[state.player.classId].name} · контуры ${state.seals.length}/5 · мир ${state.seed}.\n\nКопия расшифрована и проверена. Сначала можно экспортировать текущий слот.`,[{label:'Загрузить эту копию',action:'apply-import'},{label:'Экспорт текущего',action:'export',style:'secondary'},{label:'Отмена',action:'close',style:'quiet'}]);
    }
   }catch(e){this.ui.showCloud(endpoint,!!(this.active||this.saved||this.backup));this.ui.toast((e as Error).message,true);}finally{this.cloudBusy=false;}return;
  }
  if(action==='export'){const state=this.active?this.sim.state:this.saved??this.backup;if(!state){this.ui.toast('Сначала начните путь или загрузите сохранение.');return;}const blob=new Blob([JSON.stringify(envelope(state),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`Isobara-save-${state.seed}-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);this.ui.toast('Файл сохранения подготовлен.');return;}
  if(action==='import'){const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.onchange=async()=>{const file=input.files?.[0];if(!file)return;try{if(file.size>6_100_000)throw new Error('Сохранение превышает 6 МБ.');const state=importText(await file.text());this.pendingImport=state;this.input.reset();this.ui.message('Заменить сохранение?',`${CLASSES[state.player.classId].name} · контуры ${state.seals.length}/5 · мир ${state.seed}.\n\nТекущий слот будет заменён проверенным файлом. Перед заменой можно экспортировать текущую игру.`,[{label:'Загрузить этот прогноз',action:'apply-import'},{label:'Экспорт текущего',action:'export',style:'secondary'},{label:'Отмена',action:'close',style:'quiet'}]);this.audio.pause(true);}catch(e){this.ui.toast('Импорт отменён: '+(e as Error).message,true);}};input.click();return;}
  if(action==='apply-import'&&this.pendingImport){if(this.active)await this.persist(true);if(!this.volatile)await this.store.write(this.pendingImport);const s=this.pendingImport;this.pendingImport=null;this.saved=structuredClone(s);await this.startPlaying(s,true);return;}
  if(this.busy)return;
  if(action==='new'){if(this.store.readOnly)return;this.input.reset();this.ui.seedText='';this.ui.showNewGame(!!this.saved);return;}
  if(action.startsWith('class:')){const seed=(document.getElementById('world-seed') as HTMLInputElement)?.value;const mode=(document.getElementById('new-mode') as HTMLSelectElement)?.value;if(seed!==undefined)this.ui.seedText=seed;if(mode)this.ui.newMode=mode as any;const id=action.slice(6) as keyof typeof CLASSES;if(CLASSES[id])this.ui.selectedClass=id;this.ui.showNewGame(!!this.saved);return;}
  if(action==='start-new'){if(this.store.readOnly)return;this.busy=true;const value=(document.getElementById('world-seed') as HTMLInputElement).value.trim(),mode=(document.getElementById('new-mode') as HTMLSelectElement).value as 'standard'|'explorer';const seed=value?(/^\d+$/.test(value)?Number(value)>>>0:hash(value)):crypto.getRandomValues(new Uint32Array(1))[0];const state=newGame(seed,this.ui.selectedClass,mode);if(!this.volatile)await this.store.write(state);this.saved=structuredClone(state);await this.startPlaying(state);return;}
  if(action==='resume'&&this.saved){if(this.store.readOnly)return;await this.startPlaying(structuredClone(this.saved),true);return;}
  if(!this.active)return;
  this.audio.sfx('ui');
  if(action==='pause'){this.openPause();return;}
  if(action==='menu'){if(!await this.persist(true))return;this.input.reset();this.active=false;this.view.menu=true;this.ui.forceClose();this.ui.showTitle(true,this.sim.state);this.audio.pause(true);return;}
  if(action==='inventory'){this.input.reset();this.ui.showInventory(this.sim.state);this.audio.pause(true);return;}
  if(action==='map'){this.input.reset();this.ui.showMap(this.sim);this.audio.pause(true);return;}
  if(action==='journal'){this.input.reset();this.ui.showJournal(this.sim.state);this.audio.pause(true);return;}
  if(action.startsWith('journal-topic:')){this.ui.journalTopic=action.slice(14);this.ui.showJournal(this.sim.state);return;}
  if(action==='upgrades'){this.input.reset();this.ui.showUpgrades(this.sim.state);this.audio.pause(true);return;}
  if(action==='station'){this.input.reset();this.ui.showStation(this.sim.state);this.audio.pause(true);return;}
  if(action.startsWith('item:')){this.ui.selectedItem=action.slice(5);this.ui.showInventory(this.sim.state);return;}
  if(action.startsWith('bag-tab:')){this.ui.inventoryTab=action.slice(8) as 'bag'|'mail';this.ui.showInventory(this.sim.state);return;}
  if(action.startsWith('sort:')){const sort=action.slice(5);if(sort==='new'||sort==='tier'||sort==='rarity'){this.ui.inventorySort=sort;this.ui.showInventory(this.sim.state);}return;}
  if(action.startsWith('filter:')){const slot=action.slice(7);if(['all','instrument','shell','relic'].includes(slot)){this.ui.inventoryFilter=slot as InventoryFilter;this.ui.selectedItem='';this.ui.showInventory(this.sim.state);}return;}
  if(action.startsWith('bulk-preview:')){if(this.sim.inCombat()){this.ui.toast('Разбор недоступен под ударом.',true);return;}this.pendingBulk=this.ui.showBulk(this.sim.state,Number(action.slice(13)));return;}
  if(action==='bulk-confirm'){const preview=this.pendingBulk;this.pendingBulk=null;if(!preview||this.sim.inCombat())return;const result=salvageBulk(this.sim.state,preview);if(result){await this.persist(true);this.ui.toast(`Разобрано: ${result.count}. Получено деталей: ${result.shards}.`);}else this.ui.toast('Список вещей изменился. Откройте предпросмотр снова.');this.ui.selectedItem='';this.ui.showInventory(this.sim.state);return;}
  if(action.startsWith('craft-slot:')){if(this.sim.inCombat())return;const item=craftSlot(this.sim.state,action.slice(11) as any);if(item){await this.persist(true);this.ui.selectedItem=item.id;this.ui.showInventory(this.sim.state);this.ui.toast('Собран предмет: '+item.name);}return;}
  if(action.startsWith('refit:')||action.startsWith('retune:')){if(this.sim.inCombat())return;const item=action.startsWith('refit:')?refitItem(this.sim.state,action.slice(6)):retuneItem(this.sim.state,action.slice(7),el.dataset.effect as any);if(item){await this.persist(true);this.ui.showInventory(this.sim.state);}return;}
  if(action.startsWith('fav:')){if(favorite(this.sim.state,action.slice(4))){await this.persist(true);this.ui.showInventory(this.sim.state);}return;}
  if(action.startsWith('equip:')){if(this.sim.inCombat()){this.ui.toast('Смена снаряжения невозможна под ударом.',true);return;}if(equipItem(this.sim.state,action.slice(6))){await this.persist(true);this.ui.showInventory(this.sim.state);}return;}
  if(action.startsWith('salvage-confirm:')){const id=action.slice(16),item=[...this.sim.state.inventory,...this.sim.state.mailbox].find(i=>i.id===id);if(this.sim.inCombat()){this.ui.toast('Разбор недоступен под ударом.',true);return;}if(item&&!item.fav)this.ui.message('Разобрать предмет?',`${item.name}\n\nВы получите ${salvageValue(item)} деталей. Разбор необратим. Экипированный и избранный предмет разобрать нельзя.`,[{label:'Разобрать',action:'salvage:'+id,style:'danger'},{label:'Оставить',action:'inventory',style:'secondary'}]);return;}
  if(action.startsWith('salvage:')){if(this.sim.inCombat()){this.ui.toast('Разбор недоступен под ударом.',true);return;}if(salvage(this.sim.state,action.slice(8))){this.ui.selectedItem='';await this.persist(true);}this.ui.showInventory(this.sim.state);return;}
  if(action==='respec-confirm'){this.ui.message('Перенастроить профиль?','Все вложенные ранги вернутся точками настройки. Потратить их можно на доступные вашей специализации улучшения. Опыт и снаряжение не изменятся.',[{label:'Перенастроить',action:'respec'},{label:'Оставить как есть',action:'upgrades',style:'secondary'}]);return;}
  if(action==='respec'){if(respec(this.sim.state))await this.persist(true);this.ui.showUpgrades(this.sim.state);return;}
  if(action.startsWith('spend:')){if(spendRespec(this.sim.state,action.slice(6)))await this.persist(true);this.ui.showUpgrades(this.sim.state);return;}
  if(action.startsWith('craft-family:')){const item=craftFamily(this.sim.state,action.slice(13));if(item){await this.persist(true);this.ui.selectedItem=item.id;this.ui.toast('Собран предмет: '+item.name);this.ui.showInventory(this.sim.state);}return;}
  if(action.startsWith('loadout:')){const k=action.slice(8),st=this.sim.state;if((k==='default'||k==='alt')&&st.phase==='world'&&!this.sim.inCombat()&&Math.hypot(st.player.x,st.player.z)<12&&(k==='default'||st.npcs.irma?.heard.includes('taught'))){st.loadout.skill=k;await this.persist(true);this.ui.updateDock(st,this.settings);this.ui.showStation(st);}return;}
  if(action.startsWith('dialogue:')){const [,id,choice]=action.split(':'),v=this.sim.dialogueChoice(id,choice);if(v){await this.persist(true);this.ui.updateDock(this.sim.state,this.settings);this.ui.showDialogue(v);}return;}
  if(action.startsWith('rank:')){const parts=action.split(':'),portal=this.sim.world.getPortal(parts.slice(2).join(':'));if(portal&&this.sim.setRank(Number(parts[1]))){await this.persist(true);this.ui.showPortal(this.sim.state,portal);}return;}
  if(action==='craft'){const item=craftItem(this.sim.state);if(item){await this.persist(true);this.ui.selectedItem=item.id;this.ui.toast('Собран предмет: '+item.name);this.ui.showInventory(this.sim.state);}return;}
  if(action.startsWith('ability:')){if(!this.ui.modal)this.input.pulse(action.slice(8) as Action);return;}
  if(action==='interact'){if(this.ui.modal)return;const target=this.sim.interactable();if(!target)return;this.input.reset();this.audio.pause(true);
   if(target.kind==='portal')this.ui.showPortal(this.sim.state,target.data as Portal);
   else if(target.kind==='exit')this.ui.message('Отступить из экспедиции?','Опыт за уже побеждённые механизмы останется. Награда за завершение не выдаётся. Следующий вход создаст новую попытку.',[{label:'Отступить',action:'abandon',style:'danger'},{label:'Продолжить экспедицию',action:'close',style:'secondary'}]);
   else if(target.kind==='rest'){this.sim.rest((target.data as any).id);this.audio.pause(false);}
   else if(target.kind==='npc'){const v=this.sim.talkTo(target.data.id);if(v)this.ui.showDialogue(v);else this.audio.pause(false);}
   else if(target.kind==='device'){this.sim.useDevice(target.data.id);this.audio.pause(false);}
   else{const poi=target.data as Poi,text=this.sim.usePoi(poi);if(poi.id==='home')this.ui.showStation(this.sim.state);else if(text)this.ui.message(poi.title,text);}
   return;
  }
  if(action.startsWith('enter:')){const id=action.slice(6),portal=this.sim.world.getPortal(id);if(!portal)return;this.busy=true;this.ui.transition(true,'Собираем фрагменты станции…');this.input.reset();const previous=structuredClone(this.sim.state);
   try{await new Promise<void>(r=>requestAnimationFrame(()=>r()));this.sim.refusal='';if(!this.sim.portalEnter(portal))throw new Error(this.sim.refusal||'Подойдите ближе к разлому.');if(!await this.persist(true)&&!this.volatile){this.sim=new Simulation(previous);this.view.setSimulation(this.sim);throw new Error('Вход отменён: не удалось записать контрольную точку.');}this.sim.drain();this.view.rebuild();this.ui.forceClose();this.ui.updateDock(this.sim.state,this.settings);this.audio.pause(false);this.audio.sfx('portal');}
   finally{this.ui.transition(false);this.busy=false;}return;
  }
  if(action.startsWith('reward-select:')){this.ui.selectedReward=Number(action.slice(14));this.ui.showReward(this.sim.state);return;}
  if(action.startsWith('claim:')){const index=Number(action.slice(6)),previous=structuredClone(this.sim.state);this.busy=true;try{if(!this.sim.claim(index))return;if(!await this.persist(true)&&!this.volatile){this.sim=new Simulation(previous);this.view.setSimulation(this.sim);this.ui.showReward(previous);return;}const phase=this.sim.state.phase;this.sim.drain();this.view.rebuild();this.ui.updateDock(this.sim.state,this.settings);if(phase==='epilogue')this.ui.showEpilogue(this.sim.state);else{this.ui.forceClose();this.audio.pause(false);this.audio.sfx(this.sim.state.seals.length>previous.seals.length?'restore':'level');this.ui.toast(hasItemSpace(previous)?'Улучшение закреплено. Не забудьте экипировать добычу.':'Улучшение закреплено. Хранилище заполнено: за предмет получены детали.');}}finally{this.busy=false;}return;}
  if(action==='respawn'){this.sim.respawn();return;}
  if(action==='continue-ending'){this.sim.continueAfterEnding();return;}
  if(action==='home'){this.sim.goHome();return;}
  if(action.startsWith('travel:')){this.sim.travel(action.slice(7));return;}
  if(action==='abandon-confirm'){this.ui.message('Оставить незавершённый прогноз?','Вы вернётесь к разлому. Опыт сохранится, но награда за завершение этой попытки не выдаётся.',[{label:'Отступить',action:'abandon',style:'danger'},{label:'Остаться',action:'close',style:'secondary'}]);return;}
  if(action==='abandon'){this.sim.abandon();return;}
 }
 private error(e:unknown){console.error(e);this.ui.transition(false);this.busy=false;this.ui.toast((e as Error)?.message??String(e),true);}
}
const app=new App();void app.init().catch(error=>{console.error(error);document.getElementById('loading')?.remove();app.ui.message('Прогноз не запустился',(error as Error).message,[{label:'Перезагрузить',action:'reload'}],true);});
