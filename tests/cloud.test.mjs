import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('Cloud codec rejects typos and corrupt ciphertext and validates decrypted saves',async()=>{
 const C=await import('../.test-build/core/cloud.js');
 const {newGame}=await import('../.test-build/core/progression.js');
 const {envelope,importText}=await import('../.test-build/core/validation.js');
 const code=await C.randomCode(),keys=await C.deriveIds(code);
 assert.match(code,/^ISO2-(?:[0-9A-F]{4}-){8}[0-9A-F]{4}$/);
 const text=JSON.stringify(envelope(newGame(27,'lineman'))),blob=await C.encryptText(keys.key,text);
 assert.equal(importText(await C.decryptText(keys.key,blob)).seed,27);
 const other=await C.deriveIds(await C.randomCode());await assert.rejects(C.decryptText(other.key,blob));
 await assert.rejects(C.decryptText(keys.key,{...blob,data:blob.data.slice(0,-4)+'AAAA'}));
 await assert.rejects(C.decryptText(keys.key,{...blob,version:99}));
 await assert.rejects(C.deriveIds('weak'));
 // Fixed vector: a 16-bit checksum can collide, so random negative vectors are inappropriate.
 const compact='0'.repeat(32)+'3C2D';
 for(let n=0;n<compact.length;n++){const chars=[...compact];chars[n]=chars[n]==='A'?'B':'A';await assert.rejects(C.deriveIds('ISO2-'+chars.join('')));}
 assert.equal(C.endpointURL('http://127.0.0.1:8787/'),'http://127.0.0.1:8787');
 assert.throws(()=>C.endpointURL('http://example.com'));assert.throws(()=>C.endpointURL('https://name:password@example.com'));
});

test('Optional companion stores immutable encrypted snapshots with bounded admission',async()=>{
 const {createCompanion}=await import('../tools/cloud-server.mjs');
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'isobara-cloud-'));
 const server=await createCompanion({directory:dir,maxFiles:2,maxBytes:20000,origins:['http://127.0.0.1:4175']});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const url=`http://127.0.0.1:${server.address().port}/snapshots/`,id='a'.repeat(64);
  const blob={version:1,iv:Buffer.alloc(12).toString('base64'),data:Buffer.alloc(32).toString('base64')};
  const put=(id,body=blob,origin='http://127.0.0.1:4175')=>fetch(url+id,{method:'PUT',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});
  const simultaneous=await Promise.all([put(id),put(id)]);assert.deepEqual(simultaneous.map(r=>r.status).sort(),[201,409]);
  assert.deepEqual(await (await fetch(url+id)).json(),blob);
  assert.equal((await fetch(url+id,{method:'DELETE'})).status,405);
  assert.equal((await put('b'.repeat(64),null)).status,400);
  assert.equal((await put('b'.repeat(64),{...blob,iv:'A'})).status,400);
  assert.equal((await put('b'.repeat(64),blob,'https://unlisted.invalid')).status,403);
  const capacity=await Promise.all([put('b'.repeat(64)),put('c'.repeat(64))]);assert.deepEqual(capacity.map(r=>r.status).sort(),[201,507]);
  assert.equal((await put('d'.repeat(64),{...blob,data:'A'.repeat(8_200_001)})).status,413);
  assert.equal((await fetch(url+'f'.repeat(64))).status,404);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep+'isobara-cloud-'));await fs.rm(dir,{recursive:true,force:true});}
});
