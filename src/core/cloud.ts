// Optional remote snapshots. No initialization, polling or network access at module load.
// Adapted from sonnet5-5high's domain-separated AES-GCM codec; a new code format
// uses 128 random bits and a SHA-256 checksum. Codes are never sent to the server.
const encoder=new TextEncoder();
const MAX_BYTES=8_200_000;
const hex=(buffer:ArrayBuffer)=>Array.from(new Uint8Array(buffer),b=>b.toString(16).padStart(2,'0')).join('');
const digest=(text:string)=>crypto.subtle.digest('SHA-256',encoder.encode(text));
function available(){if(!globalThis.crypto?.subtle)throw new Error('Шифрование недоступно в этом браузере или адресе. Используйте JSON-экспорт либо HTTPS/локальный запуск.');}
export async function randomCode(){available();const body=hex(crypto.getRandomValues(new Uint8Array(16)).buffer).toUpperCase();const check=hex(await digest('isobara-code-v2:'+body)).slice(0,4).toUpperCase();return 'ISO2-'+(body+check).match(/.{4}/g)!.join('-');}
export async function deriveIds(input:string){
 available();if(typeof input!=='string'||input.length>100)throw new Error('Некорректный код восстановления.');
 const code=input.trim().toUpperCase().replace(/[\s-]/g,'');
 if(!/^ISO2[0-9A-F]{36}$/.test(code))throw new Error('Нужен полный код ISO2 из девяти групп.');
 const body=code.slice(4,36),check=hex(await digest('isobara-code-v2:'+body)).slice(0,4).toUpperCase();
 if(code.slice(36)!==check)throw new Error('Опечатка в коде восстановления.');
 const id=hex(await digest('isobara-snapshot-id-v2:'+body));
 const key=await crypto.subtle.importKey('raw',await digest('isobara-snapshot-key-v2:'+body),'AES-GCM',false,['encrypt','decrypt']);return {id,key};
}
const b64=(bytes:Uint8Array)=>{let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);};
function unb64(text:unknown,max:number){
 if(typeof text!=='string'||text.length>max||text.length%4!==0||! /^[A-Za-z0-9+/]*={0,2}$/.test(text))throw new Error('Повреждена зашифрованная копия.');
 const bytes=Uint8Array.from(atob(text),c=>c.charCodeAt(0));if(b64(bytes)!==text)throw new Error('Повреждена зашифрованная копия.');return bytes;
}
export interface CloudBlob {version:1;iv:string;data:string}
export async function encryptText(key:CryptoKey,text:string):Promise<CloudBlob>{
 const bytes=encoder.encode(text);if(bytes.length>6_100_000)throw new Error('Копия превышает допустимый размер.');
 const iv=crypto.getRandomValues(new Uint8Array(12)),data=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,bytes));return {version:1,iv:b64(iv),data:b64(data)};
}
export async function decryptText(key:CryptoKey,blob:CloudBlob){
 if(!blob||blob.version!==1)throw new Error('Неизвестный формат зашифрованной копии.');
 const iv=unb64(blob.iv,16),data=unb64(blob.data,MAX_BYTES);if(iv.length!==12||data.length<16)throw new Error('Повреждена зашифрованная копия.');
 try{return new TextDecoder('utf-8',{fatal:true}).decode(await crypto.subtle.decrypt({name:'AES-GCM',iv},key,data));}
 catch{throw new Error('Код не подходит или копия повреждена. Локальное сохранение не изменено.');}
}
export function endpointURL(input:string){
 let url:URL;try{url=new URL(input.trim());}catch{throw new Error('Укажите полный адрес сервиса, например https://backup.example.org.');}
 const local=['127.0.0.1','localhost','[::1]'].includes(url.hostname);
 if((url.protocol!=='https:'&&!(url.protocol==='http:'&&local))||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw new Error('Нужен HTTPS-адрес сервиса без пути и пароля; HTTP разрешён только на localhost.');
 return url.origin;
}
export async function snapshotRequest(endpoint:string,id:string,blob?:CloudBlob){
 if(!/^[0-9a-f]{64}$/.test(id))throw new Error('Некорректный идентификатор копии.');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{
  const response=await fetch(endpointURL(endpoint)+'/snapshots/'+id,{method:blob?'PUT':'GET',body:blob?JSON.stringify(blob):undefined,headers:blob?{'Content-Type':'application/json'}:undefined,signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store',redirect:'error'});
  if(!response.ok){await response.body?.cancel();throw new Error(response.status===404?'Копия не найдена на этом сервере.':response.status===409?'Этот код уже занят. Создайте новую копию.':response.status===507?'Хранилище сервера заполнено.':'Сервис недоступен или отклонил запрос ('+response.status+').');}
  if(Number(response.headers.get('content-length')??0)>MAX_BYTES){await response.body?.cancel();throw new Error('Сервис вернул слишком большой ответ.');}
  const reader=response.body?.getReader();if(!reader)throw new Error('Пустой ответ сервиса.');
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>MAX_BYTES){await reader.cancel();throw new Error('Сервис вернул слишком большой ответ.');}chunks.push(part.value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return JSON.parse(new TextDecoder().decode(bytes));
 }catch(e){if(controller.signal.aborted)throw new Error('Сервис не ответил за 15 секунд. Локальный прогресс сохранён отдельно.');throw e;}
 finally{clearTimeout(timer);}
}
