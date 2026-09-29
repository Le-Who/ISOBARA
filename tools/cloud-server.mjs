// Independently launched optional snapshot companion. The game never starts it.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const MAX_BODY=8_200_000;
const ID=/^[0-9a-f]{64}$/;
const canonicalBase64=(v,max)=>typeof v==='string'&&v.length<=max&&v.length%4===0&&/^[A-Za-z0-9+/]*={0,2}$/.test(v)&&Buffer.from(v,'base64').toString('base64')===v;
const validBlob=b=>b&&typeof b==='object'&&!Array.isArray(b)&&b.version===1&&canonicalBase64(b.iv,16)&&Buffer.from(b.iv,'base64').length===12&&canonicalBase64(b.data,MAX_BODY-100)&&Buffer.from(b.data,'base64').length>=16;
export async function createCompanion({directory,maxFiles=100,maxBytes=128*1024*1024,origins=[]}={}){
 if(!directory)throw new Error('A dedicated snapshot directory is required.');
 await fs.mkdir(directory,{recursive:true});const root=await fs.realpath(directory);
 let writes=Promise.resolve(),active=0;
 const server=http.createServer(async(req,res)=>{
  const reply=(status,data)=>{if(!res.headersSent){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}};
  const origin=req.headers.origin;
  if(origin&&!origins.includes(origin)){reply(403,{error:'Origin not allowed'});req.resume();return;}
  if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
  res.setHeader('Access-Control-Allow-Methods','GET, PUT, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS'){reply(204,{});return;}
  const match=/^\/snapshots\/([0-9a-f]{64})$/.exec(req.url??'');
  if(!match||!ID.test(match[1])){reply(404,{error:'Not found'});req.resume();return;}
  if(!['GET','PUT'].includes(req.method)){reply(405,{error:'Snapshots are immutable'});req.resume();return;}
  if(active>=4){reply(429,{error:'Busy'});req.resume();return;}active++;
  try{
   const file=path.join(root,match[1]+'.json');
   if(req.method==='GET'){
    try{const stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>MAX_BODY)throw new Error('Invalid snapshot');const blob=JSON.parse(await fs.readFile(file,'utf8'));if(!validBlob(blob))throw new Error('Invalid snapshot');reply(200,blob);}catch(e){reply(e.code==='ENOENT'?404:500,{error:'Snapshot unavailable'});}return;
   }
   if(!req.headers['content-type']?.startsWith('application/json')){reply(415,{error:'JSON required'});req.resume();return;}
   if(Number(req.headers['content-length']??0)>MAX_BODY){reply(413,{error:'Too large'});req.resume();return;}
   const chunks=[];let length=0,oversize=false;
   for await(const chunk of req){length+=chunk.length;if(length>MAX_BODY){oversize=true;break;}chunks.push(chunk);}
   if(oversize){reply(413,{error:'Too large'});return;}
   let blob;try{blob=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{reply(400,{error:'Invalid JSON'});return;}
   if(!validBlob(blob)){reply(400,{error:'Invalid encrypted snapshot'});return;}
   const text=JSON.stringify({version:1,iv:blob.iv,data:blob.data}),size=Buffer.byteLength(text);
   // Serialize admission and exclusive creation: parallel writes cannot exceed quotas.
   const commit=async()=>{
    try{await fs.lstat(file);reply(409,{error:'Already exists'});return;}catch(e){if(e.code!=='ENOENT')throw e;}
    const files=(await fs.readdir(root)).filter(n=>/^[0-9a-f]{64}\.json$/.test(n));
    let used=0;for(const name of files)used+=(await fs.lstat(path.join(root,name))).size;
    if(files.length>=maxFiles||used+size>maxBytes){reply(507,{error:'Storage full'});return;}
    const handle=await fs.open(file,'wx',0o600);
    try{await handle.writeFile(text);await handle.sync();}finally{await handle.close();}
    reply(201,{ok:true});
   };
   const pending=writes.then(commit);writes=pending.catch(()=>{});await pending;
  }catch(e){reply(e.code==='EEXIST'?409:500,{error:'Snapshot operation failed'});}
  finally{active--;}
 });
 server.requestTimeout=20000;server.headersTimeout=10000;server.timeout=20000;server.keepAliveTimeout=2000;
 return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const directory=process.env.ISOBARA_CLOUD_DIR??path.resolve('output/cloud-snapshots');
 const origins=process.env.ISOBARA_CLOUD_ORIGINS?.split(',').map(s=>s.trim()).filter(Boolean)??['http://127.0.0.1:4175',...Array.from({length:31},(_,i)=>`http://127.0.0.1:${8765+i}`)];
 const server=await createCompanion({directory,origins});
 server.listen(Number(process.env.ISOBARA_CLOUD_PORT??8787),process.env.ISOBARA_CLOUD_HOST??'127.0.0.1',()=>console.log('Optional snapshot service listening on',server.address(),'; storage:',directory));
}
