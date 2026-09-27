export const ASSETS:Record<string,string>=__ASSETS__;
export function icon(name:string){return ASSETS[name]??ASSETS.gauge;}
export const escapeHTML=(v:unknown)=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function keyLabel(code:string){if(code==='Space')return 'Пробел';if(code==='Mouse0')return 'ЛКМ';if(code==='Mouse1')return 'СКМ';if(code==='Mouse2')return 'ПКМ';if(code.startsWith('Key'))return code.slice(3);if(code.startsWith('Digit'))return code.slice(5);return ({ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→',ShiftLeft:'Shift',ShiftRight:'Shift',ControlLeft:'Ctrl',ControlRight:'Ctrl'} as Record<string,string>)[code]??code;}
