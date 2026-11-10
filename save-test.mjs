import {seedTestCollection} from './tests/fixture-collection.mjs';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createEnvironment,handleServerRequest} from './server.mjs';
import {createAccessPolicy} from './src/server-access.js';
import {savePair} from './ui/save-pair.js';

const directory=await mkdtemp(path.join(os.tmpdir(),'shoes-save-test-'));
let runtime=await createEnvironment({dataDirectory:directory});
seedTestCollection(runtime);
const policy=createAccessPolicy();
const calls=[];
async function api(route,options={}){
  calls.push([options.method||'GET',route]);
  const response=await handleServerRequest(new Request('http://localhost:5173/api'+route,{
    ...options,headers:{Origin:'http://localhost:5173',...options.headers}
  }),runtime,policy,5173);
  const data=await response.json();
  if(!response.ok)throw Object.assign(new Error(data.error),{status:response.status});
  return data;
}
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6JqsAAAAASUVORK5CYII=','base64');
try{
  const module=await handleServerRequest(new Request('http://localhost:5173/save-pair.js'),runtime,policy,5173);
  assert.equal(module.status,200);
  assert.match(module.headers.get('Content-Type'),/javascript/);
  let {shoes}=await api('/shoes');
  const first=shoes.find(s=>s.shoeId==='1');
  const second=shoes.find(s=>s.shoeId==='2');
  const third=shoes.find(s=>s.shoeId==='3');
  const fourth=shoes.find(s=>s.shoeId==='4');
  const fifth=shoes.find(s=>s.shoeId==='5');
  assert.equal(first.reviewed,false);
  const shoePhoto=await api('/photos',{method:'POST',headers:{'Content-Type':'image/png'},body:png});
  const boxPhoto=await api('/photos',{method:'POST',headers:{'Content-Type':'image/png'},body:png});
  // Match the editor's body: no database ID, no confirmation, two uploaded photos.
  const {id,revision,createdAt,updatedAt,...fields}=first;
  const saved=await savePair(api,first,{...fields,shoePhoto,boxPhoto,location:'Bedroom',reviewed:false});
  assert.equal(saved.shoe.id,first.id);
  assert.equal(saved.shoe.reviewed,false);
  assert.deepEqual(saved.shoe.shoePhoto,shoePhoto);
  assert.deepEqual(saved.shoe.boxPhoto,boxPhoto);
  console.log('PASS: unconfirmed starter pair saves both uploaded photos and edited fields.');

  // A browser can hold the prior database ID after the collection was replaced.
  // Contents are unchanged, so the user's pending edit is still safe to apply.
  const newId=crypto.randomUUID();
  runtime.db.prepare('UPDATE shoes SET id=? WHERE id=?').run(newId,second.id);
  const changes={...second,shoeId:'22',shoePhoto,boxPhoto,location:'Bedroom',reviewed:false};
  const recovered=await savePair(api,second,changes);
  assert.equal(recovered.shoe.id,newId);
  assert.equal(recovered.shoe.shoeId,'22');
  assert.equal(recovered.shoe.reviewed,false);
  assert.deepEqual(recovered.shoe.shoePhoto,shoePhoto);
  assert.deepEqual(recovered.shoe.boxPhoto,boxPhoto);
  console.log('PASS: outdated database reference recovers without confirming a match.');

  // Never apply a stale draft over changed or missing contents.
  const replacementId=crypto.randomUUID();
  runtime.db.prepare('UPDATE shoes SET id=?,data=? WHERE id=?').run(replacementId,JSON.stringify({...third,name:'Newer pair name'}),third.id);
  await assert.rejects(()=>savePair(api,third,{...third,name:'Stale editor name'}),/changed|replaced/i);
  let current=(await api('/shoes')).shoes.find(s=>s.id===replacementId);
  assert.equal(current.name,'Newer pair name');
  runtime.db.prepare('DELETE FROM shoes WHERE id=?').run(fourth.id);
  await assert.rejects(()=>savePair(api,fourth,{...fourth,shoePhoto}),/no longer|not found/i);
  assert.equal((await api('/shoes')).shoes.some(s=>s.shoeId===fourth.shoeId),false);
  const before=calls.length;
  await assert.rejects(()=>savePair(api,first,{...first,location:'Stale edit'}),/another window/i);
  assert.equal(calls.length-before,1,'revision conflicts must not retry');
  const racingId=crypto.randomUUID();
  runtime.db.prepare('UPDATE shoes SET id=? WHERE id=?').run(racingId,fifth.id);
  const racingApi=async(route,options)=>{
    const response=await api(route,options);
    if(route==='/shoes')runtime.db.prepare('UPDATE shoes SET revision=revision+1,data=? WHERE id=?').run(JSON.stringify({...fifth,location:'Other window'}),racingId);
    return response;
  };
  await assert.rejects(()=>savePair(racingApi,fifth,{...fifth,location:'Unsaved editor'}),/another window/i);
  assert.equal((await api('/shoes')).shoes.find(s=>s.id===racingId).location,'Other window');
  console.log('PASS: missing pairs, changed replacements, and concurrent edits are not overwritten.');

  const confirmed=await savePair(api,saved.shoe,{...saved.shoe,reviewed:true});
  assert.equal(confirmed.shoe.reviewed,true);
  assert.deepEqual(confirmed.shoe.shoePhoto,shoePhoto);
  assert.deepEqual(confirmed.shoe.boxPhoto,boxPhoto);
  runtime.close();
  runtime=await createEnvironment({dataDirectory:directory});
  current=(await api('/shoes')).shoes.find(s=>s.id===newId);
  assert.equal(current.reviewed,false);
  assert.equal(current.location,'Bedroom');
  assert.deepEqual(current.shoePhoto,shoePhoto);
  assert.deepEqual(current.boxPhoto,boxPhoto);
  assert.equal((await api('/shoes')).shoes.length,13);
  console.log('PASS: confirmation remains optional and saved unconfirmed photos survive restart.');
}finally{runtime.close();await rm(directory,{recursive:true,force:true});}
