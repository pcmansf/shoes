import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createEnvironment,handleServerRequest} from '../server.mjs';
import {createAccessPolicy} from '../src/server-access.js';
import {seedRows} from '../src/seed.js';
assert.deepEqual(seedRows,[]);
const directory=await mkdtemp(path.join(os.tmpdir(),'shoes-empty-test-'));
let app=await createEnvironment({dataDirectory:directory});
const policy=createAccessPolicy();
async function call(route,body){
  const r=await handleServerRequest(new Request('http://localhost:5173/api'+route,{method:body?'POST':'GET',headers:{Origin:'http://localhost:5173','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined}),app,policy,5173);
  assert(r.ok);return r.json();
}
try{
  assert.deepEqual((await call('/shoes')).shoes,[]);
  const item=(await call('/shoes',{shoeId:'1',category:'Other',name:'My pair'})).shoe;
  app.close();app=await createEnvironment({dataDirectory:directory});
  assert.deepEqual((await call('/shoes')).shoes,[item]);
  assert.deepEqual((await call('/locations')).locations,[]);
  console.log('PASS: fresh installs start empty; existing records survive initialization and restart.');
}finally{app.close();await rm(directory,{recursive:true,force:true});}
