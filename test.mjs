import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createEnvironment} from './server.mjs';
import {handle} from './src/worker.js';
const directory=await mkdtemp(path.join(os.tmpdir(),'shoes-test-'));
let app=await createEnvironment({dataDirectory:directory});
async function fetchLocal(url,options={}){const {method='GET',body,headers={}}=options;return handle(new Request('http://localhost:5173'+url,{method,headers:{'oai-authenticated-user-id':'local-owner',...headers},body}),app.env,app.assets)}
async function req(url,method='GET',body,headers={}){const r=await fetchLocal(url,{method,headers:{...(typeof body==='string'?{'Content-Type':'application/json'}:{}),...headers},body});return {status:r.status,body:await r.json()}}
try{
assert.equal((await fetchLocal('/')).status,200);
assert.equal((await fetchLocal('/photo-zoom.js')).status,200);
assert.equal((await fetchLocal('/seasons.js')).status,200);
let r=await req('/api/shoes');assert.equal(r.body.shoes.length,14);assert.equal(r.body.mode,'local');assert.equal(r.body.shoes.every(s=>!s.reviewed),true);
const item={shoeId:'15',name:'Test pair',category:'Sneakers',brand:'Test',location:'Shelf',notes:'A note',reviewed:true};
r=await req('/api/shoes','POST',JSON.stringify(item));assert.equal(r.status,201);let saved=r.body.shoe;
assert.equal((await req('/api/shoes','POST',JSON.stringify(item))).status,409);
assert.equal((await req('/api/shoes','POST',JSON.stringify({...item,shoeId:'16'}),{Origin:'https://malicious.example'})).status,403);
r=await req('/api/shoes/'+saved.id,'PUT',JSON.stringify({...saved,name:'Updated pair'}));assert.equal(r.status,200);assert.equal(r.body.shoe.revision,2);
assert.equal((await req('/api/shoes/'+saved.id,'PUT',JSON.stringify(saved))).status,409);saved=r.body.shoe;
r=await req('/api/shoes/'+saved.id,'PUT',JSON.stringify({...saved,archived:true}));assert.equal(r.body.shoe.archived,true);saved=r.body.shoe;
r=await req('/api/shoes/'+saved.id,'PUT',JSON.stringify({...saved,archived:false}));assert.equal(r.body.shoe.archived,false);
assert.equal((await req('/api/photos','POST',Buffer.from('not an image'),{'Content-Type':'image/jpeg'})).status,400);
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6JqsAAAAASUVORK5CYII=','base64');
r=await req('/api/photos','POST',png,{'Content-Type':'image/png'});assert.equal(r.status,201);const photo=r.body;assert.equal((await fetchLocal(photo.url)).status,200);
r=await req('/api/collage','POST',JSON.stringify({photo}));assert.equal(r.status,200);assert.equal(r.body.shoes.filter(s=>s.shoePhoto&&s.boxPhoto).length,14);
assert.equal((await req('/api/shoes','POST',JSON.stringify({...item,shoeId:'16',shoePhoto:{url:'https://example.com/evil'}}))).status,400);
r=await req('/api/import','POST',JSON.stringify({shoes:[{...item,shoeId:'16'},{...item,shoeId:'15'}]}));assert.equal(r.status,409);assert.equal((await req('/api/shoes')).body.shoes.some(s=>s.shoeId==='16'),false);
r=await req('/api/import','POST',JSON.stringify({shoes:[{...item,shoeId:'16',shoePhoto:photo}]}));assert.equal(r.status,201);
const anonymous=await handle(new Request('https://shoes.example/api/shoes'),{},{});assert.equal(anonymous.status,401);
r=await req('/api/import','POST',JSON.stringify({overwrite:true,shoes:[{...item,shoeId:'15',name:'Updated pair',notes:'Recovered from backup'}]}));assert.equal(r.status,201);assert.equal(r.body.shoes.find(s=>s.shoeId==='15').notes,'Recovered from backup');assert.equal(r.body.shoes.length,16);
const otherOwner=await handle(new Request('https://shoes.example'+photo.url,{headers:{'oai-authenticated-user-id':'another-user'}}),app.env,app.assets);assert.equal(otherOwner.status,404);
await app.close();app=await createEnvironment({dataDirectory:directory});r=await req('/api/shoes');assert.equal(r.body.shoes.length,16);assert.equal(r.body.shoes.find(s=>s.shoeId==='15').name,'Updated pair');assert.equal((await fetchLocal(photo.url)).status,200);
console.log('PASS: startup, seed, create, edit, duplicate IDs, stale edits, archive/restore, photo validation, upload/retrieval, collage fill, atomic backup import, auth, origin protection, restart persistence.');
}finally{await app.close();await rm(directory,{recursive:true,force:true});}
