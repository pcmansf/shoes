import {seedTestCollection} from './tests/fixture-collection.mjs';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createEnvironment} from './server.mjs';
import {handle} from './src/worker.js';

const directory=await mkdtemp(path.join(os.tmpdir(),'shoes-locations-test-'));
let app=await createEnvironment({dataDirectory:directory});
seedTestCollection(app);
async function request(route,method='GET',body,owner='local-owner'){
  const response=await handle(new Request('http://localhost/api'+route,{
    method,headers:{Origin:'http://localhost','oai-authenticated-user-id':owner},
    body:body===undefined?undefined:JSON.stringify(body)
  }),app.env,app.assets);
  return {status:response.status,data:await response.json()};
}
async function ok(route,method='GET',body,owner){const r=await request(route,method,body,owner);assert(r.status<300,JSON.stringify(r));return r.data;}
async function create(shoeId,fields={}){return (await ok('/shoes','POST',{shoeId,category:'Boots',...fields})).shoe;}
try{
  const seeded=await ok('/shoes');
  // Simulate a previous-version database: no registry table and existing free-text locations.
  const original=app.db.prepare('SELECT * FROM shoes WHERE id=?').get(seeded.shoes[0].id);
  const legacy={...JSON.parse(original.data),location:'Bedroom',customMetadata:{keep:true}};
  app.db.prepare('UPDATE shoes SET data=? WHERE id=?').run(JSON.stringify(legacy),original.id);
  const before=app.db.prepare('SELECT * FROM shoes ORDER BY id').all();
  app.db.exec('DROP TABLE locations');app.close();
  app=await createEnvironment({dataDirectory:directory});
  assert.deepEqual(app.db.prepare('SELECT * FROM shoes ORDER BY id').all(),before,'migration must not change any shoe data');
  let locations=(await ok('/locations')).locations;
  let bedroom=locations.find(item=>item.name==='Bedroom');assert(bedroom);assert.equal(bedroom.count,1);
  const shoe=(await ok('/shoes')).shoes.find(shoe=>shoe.id===original.id);
  const archived=await create('80',{location:'bedroom',archived:true,notes:'Keep my notes',brand:'Example'});
  bedroom=(await ok('/locations')).locations.find(item=>item.id===bedroom.id);assert.equal(bedroom.count,2);
  assert.equal((await request('/locations','POST',{name:' BEDROOM '})).status,409);
  assert.equal((await request('/locations','POST',{name:'  '})).status,400);
  assert.equal((await request('/locations/'+bedroom.id,'DELETE',{revision:bedroom.revision})).status,409);
  assert.equal((await request('/locations/'+bedroom.id,'PUT',{revision:0,name:'Hall'})).status,409);
  await ok('/locations','POST',{name:'Garage'});
  const beforeConflict=app.db.prepare('SELECT * FROM shoes ORDER BY id').all();
  assert.equal((await request('/locations/'+bedroom.id,'PUT',{revision:bedroom.revision,name:'Garage'})).status,409);
  assert.deepEqual(app.db.prepare('SELECT * FROM shoes ORDER BY id').all(),beforeConflict,'rename conflict must roll back all shoe changes');
  const renamed=await ok('/locations/'+bedroom.id,'PUT',{revision:bedroom.revision,name:'Bedroom closet'});
  assert.equal(renamed.updates.length,2);
  for(const old of [shoe,archived]){
    const fresh=renamed.shoes.find(item=>item.id===old.id);
    assert.equal(fresh.revision,old.revision+1);assert.equal(fresh.location,'Bedroom closet');
    const {revision,updatedAt,location,...rest}=fresh;
    const {revision:oldRevision,updatedAt:oldTime,location:oldLocation,...oldRest}=old;
    assert.deepEqual(rest,oldRest,'rename preserves every other field');
  }
  assert.equal((await request('/shoes/'+shoe.id,'PUT',{...shoe,name:'stale'})).status,409,'old editor cannot overwrite rename');
  assert.equal((await request('/locations/'+bedroom.id,'DELETE',{revision:bedroom.revision})).status,409);
  const foreign=await request('/locations/'+bedroom.id,'PUT',{revision:2,name:'Foreign'},'other-owner');assert.equal(foreign.status,404);
  await ok('/locations','POST',{name:'Bedroom closet'},'other-owner');
  assert.equal((await ok('/locations','GET',undefined,'other-owner')).locations.length,1);
  const garage=renamed.locations.find(item=>item.name==='Garage');
  await ok('/locations/'+garage.id,'DELETE',{revision:garage.revision});
  assert(!(await ok('/locations')).locations.some(item=>item.name==='Garage'));
  const updated=renamed.shoes.find(item=>item.id===shoe.id);
  await ok('/shoes/'+updated.id,'PUT',{...updated,location:'Hall'});
  assert((await ok('/locations')).locations.some(item=>item.name==='Hall'),'old clients can still save free-text locations');
  assert.equal((await request('/locations/'+bedroom.id,'DELETE',{revision:2})).status,409,'archived pair protects its location');
  await ok('/import','POST',{shoes:[{shoeId:'90',category:'Other',location:'Attic'}],locations:['Shed','Attic']});
  locations=(await ok('/locations')).locations;
  assert(locations.some(item=>item.name==='Shed'&&item.count===0));assert(locations.some(item=>item.name==='Attic'&&item.count===1));
  await ok('/import','POST',{shoes:[{shoeId:'91',category:'Other',location:'Legacy backup'}]});
  const unchanged=app.db.prepare('SELECT * FROM shoes ORDER BY id').all();
  assert.equal((await request('/import','POST',{shoes:[{shoeId:'92',category:'Other'}],locations:[4]})).status,400);
  assert.equal((await request('/import','POST',{shoes:[{shoeId:'90',category:'Other'}],locations:['Should not appear']})).status,409);
  assert.deepEqual(app.db.prepare('SELECT * FROM shoes ORDER BY id').all(),unchanged);
  assert(!(await ok('/locations')).locations.some(item=>item.name==='Should not appear'));
  const finalLocations=(await ok('/locations')).locations;
  app.close();app=await createEnvironment({dataDirectory:directory});
  assert.deepEqual((await ok('/locations')).locations,finalLocations);
  assert.deepEqual(app.db.prepare('SELECT * FROM shoes ORDER BY id').all(),unchanged);
  console.log('PASS: additive migration preserves all rows; existing locations, dropdown registry, atomic rename, archived references, duplicates, revision conflicts, owner isolation, old clients/backups, unused backup locations, and restart persistence.');
}finally{await app.idle();app.close();await rm(directory,{recursive:true,force:true});}
