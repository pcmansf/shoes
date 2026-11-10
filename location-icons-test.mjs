import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createEnvironment} from './server.mjs';
import {handle} from './src/worker.js';
import {LOCATION_ICONS} from './ui/location-icons.js';
const directory=await mkdtemp(path.join(os.tmpdir(),'shoes-location-icons-test-'));
let app=await createEnvironment({dataDirectory:directory});
async function request(route,method='GET',body){
  const response=await handle(new Request('http://localhost/api'+route,{method,headers:{Origin:'http://localhost','oai-authenticated-user-id':'local-owner'},body:body===undefined?undefined:JSON.stringify(body)}),app.env,app.assets);
  return {status:response.status,data:await response.json()};
}
async function ok(route,method='GET',body){const r=await request(route,method,body);assert(r.status<300,JSON.stringify(r));return r.data;}
try{
  await ok('/shoes');
  const pair=(await ok('/shoes','POST',{shoeId:'80',name:'Keep my pair',category:'Boots',location:'Bedroom',notes:'Keep my notes'})).shoe;
  await ok('/locations','POST',{name:'Unused place'});
  const beforeShoes=app.db.prepare('SELECT * FROM shoes ORDER BY id').all();
  const beforeLocations=app.db.prepare('SELECT id,owner,name,revision FROM locations ORDER BY id').all();
  app.db.exec('ALTER TABLE locations DROP COLUMN icon');app.close();
  app=await createEnvironment({dataDirectory:directory});
  assert.deepEqual(app.db.prepare('SELECT * FROM shoes ORDER BY id').all(),beforeShoes);
  assert.deepEqual(app.db.prepare('SELECT id,owner,name,revision FROM locations ORDER BY id').all(),beforeLocations);
  let choices=(await ok('/locations')).locations;assert(choices.every(item=>item.icon==='pin'));
  let bedroom=choices.find(item=>item.name==='Bedroom');
  let result=await ok('/locations/'+bedroom.id,'PUT',{icon:'bedroom',revision:bedroom.revision});
  bedroom=result.locations.find(item=>item.id===bedroom.id);assert.equal(bedroom.icon,'bedroom');assert.equal(bedroom.revision,2);
  assert.deepEqual(app.db.prepare('SELECT * FROM shoes ORDER BY id').all(),beforeShoes,'icon-only changes must not change any pair or its revision');
  assert.equal((await request('/locations/'+bedroom.id,'PUT',{icon:'garage',revision:1})).status,409);
  assert.equal((await request('/locations/'+bedroom.id,'PUT',{name:'Lost name',icon:'<svg onload=alert(1)>',revision:2})).status,400);
  assert.equal((await request('/locations','POST',{name:'Bad icon',icon:'made-up'})).status,400);
  result=await ok('/locations/'+bedroom.id,'PUT',{name:'Main bedroom',revision:bedroom.revision});
  bedroom=result.locations.find(item=>item.id===bedroom.id);assert.equal(bedroom.icon,'bedroom','old clients preserve selected icons');
  let updated=result.shoes.find(item=>item.id===pair.id);assert.equal(updated.location,'Main bedroom');assert.equal(updated.revision,pair.revision+1);
  for(const icon of LOCATION_ICONS){
    const created=await ok('/locations','POST',{name:'Icon '+icon.label,icon:icon.id});
    assert.equal(created.locations.find(item=>item.name==='Icon '+icon.label).icon,icon.id);
  }
  await ok('/import','POST',{overwrite:true,shoes:[updated],locations:['Main bedroom']});
  bedroom=(await ok('/locations')).locations.find(item=>item.id===bedroom.id);assert.equal(bedroom.icon,'bedroom','old backup names must preserve selected icons');
  updated=(await ok('/shoes')).shoes.find(item=>item.id===pair.id);
  await ok('/import','POST',{overwrite:true,shoes:[updated],locations:[{name:'Main bedroom',icon:'guest-room'},{name:'Backup shed',icon:'garden'}]});
  choices=(await ok('/locations')).locations;
  assert.equal(choices.find(item=>item.id===bedroom.id).icon,'guest-room');assert.equal(choices.find(item=>item.name==='Backup shed').icon,'garden');
  const safeRows=app.db.prepare('SELECT * FROM shoes ORDER BY id').all(),safeLocations=await ok('/locations');
  assert.equal((await request('/import','POST',{overwrite:true,shoes:[{...updated,name:'Invalid restore'}],locations:[{name:'Oops',icon:'not-an-icon'}]})).status,400);
  assert.deepEqual(app.db.prepare('SELECT * FROM shoes ORDER BY id').all(),safeRows);assert.deepEqual(await ok('/locations'),safeLocations);
  app.close();app=await createEnvironment({dataDirectory:directory});
  assert.deepEqual(app.db.prepare('SELECT * FROM shoes ORDER BY id').all(),safeRows);assert.deepEqual(await ok('/locations'),safeLocations);
  console.log('PASS: v1.4 migration preserves every shoe and location, all 37 icons save, icon-only edits preserve pair revisions, stale/invalid updates are rejected, legacy clients/backups retain icons, icon backups restore atomically, and choices survive restart.');
}finally{await app.idle();app.close();await rm(directory,{recursive:true,force:true});}
