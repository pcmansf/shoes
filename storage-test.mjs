import {seedTestCollection} from './tests/fixture-collection.mjs';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createEnvironment,handleServerRequest} from './server.mjs';
import {createAccessPolicy} from './src/server-access.js';
import {savePair} from './ui/save-pair.js';
import {storageStatusOf,filterCollection} from './ui/storage-status.js';
const directory=await mkdtemp(path.join(os.tmpdir(),'shoes-storage-test-'));
let app=await createEnvironment({dataDirectory:directory});
seedTestCollection(app);
const policy=createAccessPolicy();
async function request(route,method='GET',body,headers={}){
  const response=await handleServerRequest(new Request('http://localhost:5173/api'+route,{method,headers:{Origin:'http://localhost:5173',...headers},body:body===undefined?undefined:Buffer.isBuffer(body)?body:JSON.stringify(body)}),app,policy,5173);
  return {status:response.status,data:await response.json()};
}
async function ok(route,method='GET',body,headers){const r=await request(route,method,body,headers);assert(r.status<300,JSON.stringify(r));return r.data;}
const api=async(route,options={})=>{const r=await request(route,options.method||'GET',options.body?JSON.parse(options.body):undefined);if(r.status>=400)throw Object.assign(new Error(r.data.error),{status:r.status});return r.data;};
try{
  const initial=(await ok('/shoes')).shoes;assert(initial.every(pair=>pair.storageStatus==='stored'));
  const old=app.db.prepare('SELECT * FROM shoes WHERE id=?').get(initial[0].id),data=JSON.parse(old.data);delete data.storageStatus;
  app.db.prepare('UPDATE shoes SET data=? WHERE id=?').run(JSON.stringify(data),old.id);
  const before=app.db.prepare('SELECT * FROM shoes WHERE id=?').get(old.id);
  assert.equal((await ok('/shoes')).shoes.find(pair=>pair.id===old.id).storageStatus,'stored');
  assert.deepEqual(app.db.prepare('SELECT * FROM shoes WHERE id=?').get(old.id),before,'reading legacy status must not modify data');
  const photo=await ok('/photos','POST',Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6JqsAAAAASUVORK5CYII=','base64'),{'Content-Type':'image/png'});
  let pair=(await ok('/shoes','POST',{shoeId:'80',name:'Fixture boots',category:'Boots',season:'Winter',location:'Bedroom',notes:'Keep me',shoePhoto:photo,boxPhoto:photo})).shoe;
  assert.equal(pair.storageStatus,'stored');const original=structuredClone(pair);
  pair=(await savePair(api,pair,{...pair,storageStatus:'out'})).shoe;
  assert.equal(pair.storageStatus,'out');assert.equal(pair.location,'Bedroom');assert.deepEqual(pair.shoePhoto,photo);assert.deepEqual(pair.boxPhoto,photo);assert.equal(pair.notes,'Keep me');
  const {storageStatus,...legacyClient}=pair;
  pair=(await ok('/shoes/'+pair.id,'PUT',{...legacyClient,name:'New name'})).shoe;assert.equal(pair.storageStatus,'out');
  for(const invalid of ['Stored','taken-out','',null,2,false]){
    assert.equal((await request('/shoes/'+pair.id,'PUT',{...pair,storageStatus:invalid})).status,400);
    assert.equal((await request('/shoes','POST',{shoeId:'invalid',category:'Other',storageStatus:invalid})).status,400);
  }
  pair=(await savePair(api,pair,{...pair,archived:true,reviewed:true})).shoe;assert.equal(pair.storageStatus,'out');
  pair=(await savePair(api,pair,{...pair,archived:false})).shoe;assert.equal(pair.storageStatus,'out');
  assert.equal((await request('/shoes/'+pair.id,'PUT',{...original,storageStatus:'stored'})).status,409);
  assert.equal((await ok('/shoes')).shoes.find(item=>item.id===pair.id).storageStatus,'out');
  pair=(await savePair(api,pair,{...pair,storageStatus:'stored'})).shoe;assert.equal(pair.storageStatus,'stored');
  // The stale-ID recovery must include status in its unchanged-record comparison.
  const replacedId=crypto.randomUUID();
  app.db.prepare('UPDATE shoes SET id=?,data=? WHERE id=?').run(replacedId,JSON.stringify({...pair,storageStatus:'out'}),pair.id);
  await assert.rejects(()=>savePair(api,pair,{...pair,storageStatus:'stored'}),/changed|replaced/);
  pair=(await ok('/shoes')).shoes.find(item=>item.id===replacedId);
  await ok('/import','POST',{shoes:[{shoeId:'81',category:'Other',storageStatus:'out',location:'Garage'},{shoeId:'82',category:'Other'}]});
  let all=(await ok('/shoes')).shoes;assert.equal(all.find(item=>item.shoeId==='81').storageStatus,'out');assert.equal(all.find(item=>item.shoeId==='82').storageStatus,'stored');
  const snapshot=app.db.prepare('SELECT * FROM shoes ORDER BY id').all();
  assert.equal((await request('/import','POST',{shoes:[{shoeId:'83',category:'Other'},{shoeId:'84',category:'Other',storageStatus:'bad'}]})).status,400);
  assert.deepEqual(app.db.prepare('SELECT * FROM shoes ORDER BY id').all(),snapshot);
  assert(await app.env.BUCKET.head(photo.url.slice('/api/photos/'.length)),'status and archive operations must retain photos');
  app.close();app=await createEnvironment({dataDirectory:directory});
  assert.deepEqual(app.db.prepare('SELECT * FROM shoes ORDER BY id').all(),snapshot);
  all=(await ok('/shoes')).shoes;assert.equal(all.find(item=>item.id===pair.id).storageStatus,'out');
  const module=await handleServerRequest(new Request('http://localhost:5173/storage-status.js'),app,policy,5173);assert.equal(module.status,200);
  console.log('PASS: legacy/default Stored, status save and restart, original locations/photos preserved, old-client writes, archive/review, stale-ID/revision protection, backup compatibility, and atomic validation.');

  const places=[{id:'bed',name:'Bedroom'},{id:'garage',name:'Garage'}];
  const fixtures=[
    {shoeId:'1',name:'Boots',category:'Boots',season:'Winter',location:'Bedroom',storageStatus:'stored'},
    {shoeId:'2',name:'Boots',category:'Boots',season:'Winter',location:'bedroom',storageStatus:'out'},
    {shoeId:'3',name:'Sneakers',category:'Sneakers',season:'Summer',location:'Garage',storageStatus:'out'},
    {shoeId:'4',name:'Flats',category:'Flats',location:''},
    {shoeId:'5',name:'Boots',category:'Boots',season:'Winter',location:'Garage',storageStatus:'stored'}
  ];
  const ids=options=>filterCollection(fixtures,options,places).map(pair=>pair.shoeId);
  assert.deepEqual(ids({status:'all'}),['1','2','3','4','5']);assert.deepEqual(ids({status:'stored'}),['1','4','5']);assert.deepEqual(ids({status:'out'}),['2','3']);
  assert.deepEqual(ids({location:'location:bed'}),['1','2']);assert.deepEqual(ids({location:'location:bed',status:'out'}),['2']);
  assert.deepEqual(ids({location:'location:garage',status:'out',season:'Summer',category:'Sneakers'}),['3']);
  assert.deepEqual(ids({location:'location:garage',status:'stored',season:'Winter',category:'Boots'}),['5']);
  assert.deepEqual(ids({location:'none',status:'stored'}),['4']);assert.deepEqual(ids({location:'none',status:'out'}),[]);
  assert.deepEqual(ids({search:'# 2',status:'out'}),['2']);assert.deepEqual(ids({search:'boots',season:'Summer'}),[]);
  assert.equal(storageStatusOf({}), 'stored');assert.equal(storageStatusOf({storageStatus:'out'}),'out');
  fixtures[0].location=fixtures[1].location='Main bedroom';places[0].name='Main bedroom';assert.deepEqual(ids({location:'location:bed'}),['1','2']);
  console.log('PASS: combined location/status/category/season/search filtering, no-location pairs, renamed locations, and clear defaults.');
}finally{await app.idle();app.close();await rm(directory,{recursive:true,force:true});}
