import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createAccessPolicy} from './src/server-access.js';
import {createEnvironment,handleServerRequest} from './server.mjs';

const dir=await mkdtemp(path.join(os.tmpdir(),'shoes-server-test-'));
const runtime=await createEnvironment({dataDirectory:dir,mode:'server'});
const settings={
  host:'0.0.0.0',port:3000,username:'shoes',password:'test-password-not-for-deployment',
  origins:['http://raspberrypi.local:3000','http://192.168.1.5:3000','https://shoes.example']
};
const policy=createAccessPolicy(settings);
const authorization='Basic '+Buffer.from(settings.username+':'+settings.password).toString('base64');
async function send(url,options={}){
  return handleServerRequest(new Request(url,options),runtime,policy,3000);
}
try{
  assert.throws(()=>createAccessPolicy({host:'0.0.0.0'}),/password/);
  assert.throws(()=>createAccessPolicy({...settings,password:'short'}),/8 characters/);
  assert.throws(()=>createAccessPolicy({...settings,origins:[]}),/ORIGINS/);
  assert.throws(()=>createAccessPolicy({...settings,origins:['https://shoes.example/path']}),/origins/);
  const noLogin=await send('http://raspberrypi.local:3000/');
  assert.equal(noLogin.status,401);
  assert.match(noLogin.headers.get('www-authenticate'),/^Basic/);
  assert.equal((await send('http://raspberrypi.local:3000/api/shoes',{headers:{authorization:'Basic '+Buffer.from('shoes:wrong').toString('base64')}})).status,401);
  assert.equal((await send('http://evil.example:3000/api/shoes',{headers:{authorization}})).status,403);
  assert.equal((await send('http://raspberrypi.local:3000/api/shoes',{headers:{authorization,host:'evil.example'}})).status,403);
  assert.equal((await send('http://192.168.1.5:3000/',{headers:{authorization}})).status,200);
  const listing=await (await send('http://raspberrypi.local:3000/api/shoes',{headers:{authorization}})).json();
  assert.equal(listing.mode,'server');
  assert.equal(listing.shoes.length,0);
  // An HTTPS reverse proxy may connect to the Node server using HTTP.
  const record={shoeId:'99',name:'Pi test pair',category:'Sneakers',reviewed:true};
  const response=await send('http://shoes.example/api/shoes',{
    method:'POST',headers:{authorization,Origin:'https://shoes.example','Content-Type':'application/json','oai-authenticated-user-id':'forged-owner'},
    body:JSON.stringify(record)
  });
  assert.equal(response.status,201);
  const ipListing=await (await send('http://192.168.1.5:3000/api/shoes',{headers:{authorization}})).json();
  assert(ipListing.shoes.some(s=>s.shoeId==='99'));
  assert.equal(runtime.db.prepare("SELECT count(*) AS n FROM shoes WHERE owner='forged-owner'").get().n,0);
  assert.equal((await send('http://shoes.example/api/shoes',{
    method:'POST',headers:{authorization,Origin:'https://evil.example','Content-Type':'application/json'},
    body:JSON.stringify({...record,shoeId:'100'})
  })).status,403);
  assert.equal((await send('http://raspberrypi.local:3000/api/photos/x',{headers:{}})).status,401);
  assert.equal(createAccessPolicy().check(new Request('http://localhost:5173/')).response,undefined);
  console.log('PASS: network configuration, login, host validation, shared collection, trusted HTTPS origin, identity spoofing protection, cross-site rejection, and photo access.');
}finally{runtime.close();await rm(dir,{recursive:true,force:true});}
