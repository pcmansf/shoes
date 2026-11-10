import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {startAddon,settingsFromOptions} from './run.mjs';

const root=await mkdtemp(path.join(os.tmpdir(),'shoes-login-test-'));
const settings={username:'shoes',password:'test8pwd',origins:['http://shoes.test:8099']};
const authorization='Basic '+Buffer.from(settings.username+':'+settings.password).toString('base64');
let app;
async function restart(options){
  if(app){await app.close();app=null;}
  await writeFile(path.join(root,'options.json'),JSON.stringify(options));
  app=await startAddon({dataRoot:root,port:0});
}
async function request(route,{method='GET',body,login=false,headers={}}={}){
  const data=body===undefined?undefined:Buffer.isBuffer(body)?body:Buffer.from(JSON.stringify(body));
  return new Promise((resolve,reject)=>{
    const req=http.request({hostname:'127.0.0.1',port:app.server.address().port,path:route,method,
      headers:{Host:'shoes.test:8099',Origin:settings.origins[0],...(login?{Authorization:authorization}:{}),
        ...(data?{'Content-Type':'application/json','Content-Length':data.length}:{}),...headers}},res=>{
      const chunks=[];res.on('data',b=>chunks.push(b));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));
    });req.on('error',reject);req.end(data);
  });
}
async function json(route,options){const r=await request(route,options);assert(r.status>=200&&r.status<300,r.body.toString());return JSON.parse(r.body);}
try{
  for(const value of [null,0,1,'false','true',[],{}])assert.throws(()=>settingsFromOptions({...settings,require_login:value}),/true or false/);
  assert.equal(settingsFromOptions(settings).requireLogin,true,'upgrades without the new key keep authentication');
  assert.throws(()=>settingsFromOptions({origins:settings.origins}),/Password/);
  assert.throws(()=>settingsFromOptions({...settings,password:'1234567'}),/8 characters/);
  assert.equal(settingsFromOptions({...settings,password:'12345678'}).password,'12345678');
  assert.throws(()=>settingsFromOptions({...settings,require_login:false,origins:[]}),/non-empty/);
  assert.equal(settingsFromOptions({require_login:false,origins:settings.origins}).requireLogin,false);

  await restart(settings); // A saved configuration from the previous version.
  for(const route of ['/','/app.js','/api/shoes','/api/drive/config'])assert.equal((await request(route)).status,401);
  assert.equal((await request('/',{headers:{Authorization:'Basic '+Buffer.from('shoes:wrong').toString('base64')}})).status,401);
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6JqsAAAAASUVORK5CYII=','base64');
  const photo=await json('/api/photos',{method:'POST',login:true,body:png,headers:{'Content-Type':'image/png'}});
  let pair=(await json('/api/shoes',{method:'POST',login:true,body:{shoeId:'LOGIN99',category:'Boots',location:'Closet',shoePhoto:photo,boxPhoto:photo}})).shoe;
  const saved=(await json('/api/shoes',{login:true})).shoes;

  await restart({...settings,require_login:false}); // Saved credentials remain but are ignored.
  assert.deepEqual((await json('/api/shoes')).shoes,saved);
  for(const route of ['/','/app.js','/api/drive/config',photo.url]){
    const r=await request(route);assert.equal(r.status,200);assert.equal(r.headers['www-authenticate'],undefined);
  }
  assert.equal((await request('/',{headers:{Authorization:'Basic invalid'}})).status,200);
  assert.deepEqual((await request(photo.url)).body,png);
  assert.equal((await request('/',{headers:{Host:'unconfigured.example'}})).status,403);
  assert.equal((await request('/api/shoes',{method:'POST',body:{},headers:{Origin:'http://evil.example'}})).status,403);
  assert.equal((await request('/api/photos',{method:'POST',body:png,headers:{'Content-Type':'image/png','Sec-Fetch-Site':'cross-site'}})).status,403);
  pair=(await json('/api/shoes/'+pair.id,{method:'PUT',body:{...pair,storageStatus:'out',notes:'Edited with login off'},headers:{'oai-authenticated-user-id':'forged-owner'}})).shoe;
  assert.equal(app.db.prepare("SELECT count(*) AS n FROM shoes WHERE owner='forged-owner'").get().n,0);
  assert.equal((await request('/options.json')).status,404);

  await restart({require_login:false,origins:settings.origins}); // No password needed when off.
  assert.deepEqual((await json('/api/shoes')).shoes.find(s=>s.id===pair.id),pair);
  assert.deepEqual((await request(photo.url)).body,png);

  await restart({...settings,require_login:true});
  for(const route of ['/','/api/shoes','/api/drive/config',photo.url])assert.equal((await request(route)).status,401);
  assert.deepEqual((await json('/api/shoes',{login:true})).shoes.find(s=>s.id===pair.id),pair);
  assert.deepEqual((await request(photo.url,{login:true})).body,png);
  assert.equal(JSON.parse(await readFile(path.join(root,'options.json'),'utf8')).password,settings.password);
  console.log('PASS: 8-character password works, 7 characters rejected, login defaults on, off works with or without saved credentials, login can be restored, records/photos survive switches, and host/origin/identity checks remain active.');
}finally{
  if(app)await app.close();
  assert(root.startsWith(path.resolve(os.tmpdir())+path.sep));
  await rm(root,{recursive:true,force:true});
}
