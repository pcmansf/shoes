import {seedTestCollection} from './tests/fixture-collection.mjs';
import assert from 'node:assert/strict';
import {mkdtemp,rm,utimes,writeFile,access} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createEnvironment,handleServerRequest} from './server.mjs';
import {createAccessPolicy} from './src/server-access.js';
import {SEASONS,seasonOf,matchesSeason} from './ui/seasons.js';
import {savePair} from './ui/save-pair.js';

const directory=await mkdtemp(path.join(os.tmpdir(),'shoes-collection-test-'));
let app=await createEnvironment({dataDirectory:directory});
seedTestCollection(app);
const policy=createAccessPolicy();
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6JqsAAAAASUVORK5CYII=','base64');
async function request(route,method='GET',body,headers={}){
  const response=await handleServerRequest(new Request('http://localhost:5173/api'+route,{
    method,headers:{Origin:'http://localhost:5173',...headers},body:body===undefined?undefined:typeof body==='object'&&!Buffer.isBuffer(body)?JSON.stringify(body):body
  }),app,policy,5173);
  return {status:response.status,data:await response.json()};
}
async function upload(){const r=await request('/photos','POST',png,{'Content-Type':'image/png'});assert.equal(r.status,201);return r.data;}
async function create(shoeId,fields={}){const r=await request('/shoes','POST',{shoeId,category:'Other',...fields});assert.equal(r.status,201);return r.data.shoe;}
async function update(shoe,fields){const r=await request('/shoes/'+shoe.id,'PUT',{...shoe,...fields});assert.equal(r.status,200,JSON.stringify(r.data));return r.data.shoe;}
const key=photo=>photo.url.slice('/api/photos/'.length);
const exists=async photo=>!!await app.env.BUCKET.head(key(photo));
const storedPath=photo=>path.join(directory,'photos',...key(photo).split('/'));
try{
  const seeded=(await request('/shoes')).data.shoes;
  assert(seeded.every(shoe=>shoe.season==='All-season'));
  // Older stored records do not need a destructive data migration.
  const legacy={...seeded[0]};delete legacy.season;
  app.db.prepare('UPDATE shoes SET data=? WHERE id=?').run(JSON.stringify(legacy),legacy.id);
  assert.equal((await request('/shoes')).data.shoes.find(s=>s.id===legacy.id).season,'All-season');
  let pair=await create('30',{name:'   '});
  assert.equal(pair.name,'Shoes');assert.equal(pair.season,'All-season');
  for(const season of SEASONS){pair=await update(pair,{season,name:''});assert.equal(pair.season,season);assert.equal(pair.name,'Shoes');}
  const {season,...oldClient}=pair;
  let r=await request('/shoes/'+pair.id,'PUT',{...oldClient,location:'Closet'});
  assert.equal(r.status,200);pair=r.data.shoe;assert.equal(pair.season,'Winter');
  assert.equal((await request('/shoes/'+pair.id,'PUT',{...pair,season:'Rainy'})).status,400);
  assert.equal((await request('/shoes','POST',{shoeId:'31',category:'Other',name:42})).status,400);
  assert.equal((await create('31')).name,'Shoes');
  const api=async(route,options)=>{
    const result=await request(route,options.method,JSON.parse(options.body));
    if(result.status>=400)throw Object.assign(new Error(result.data.error),{status:result.status});
    return result.data;
  };
  pair=(await savePair(api,pair,{...pair,season:'Summer',reviewed:true})).shoe;
  assert.equal(pair.season,'Summer');
  assert(matchesSeason(pair,'Summer'));assert(!matchesSeason(pair,'Winter'));
  assert(matchesSeason(pair,'Any season'));assert(matchesSeason({},'All-season'));
  assert.equal(seasonOf(legacy),'All-season');
  console.log('PASS: season defaults, old records/clients, all season values, filtering, optional names, and shared save path.');

  const first=await upload(),second=await upload(),third=await upload();
  pair=await update(pair,{shoePhoto:first,boxPhoto:first});
  pair=await update(pair,{shoePhoto:second});
  assert(await exists(first),'box still uses first photo');
  pair=await update(pair,{boxPhoto:second});
  assert(!await exists(first),'replaced photo should be removed');
  let shared=await create('32',{shoePhoto:second,archived:true});
  pair=await update(pair,{shoePhoto:third,boxPhoto:third});
  assert(await exists(second),'archived pairs retain their photos');
  shared=await update(shared,{shoePhoto:null});
  assert(!await exists(second),'last reference removed');
  const pending=await upload();
  r=await request('/shoes/'+pair.id,'PUT',{...pair,shoePhoto:pending,revision:0});
  assert.equal(r.status,409);assert(await exists(third));assert(await exists(pending));
  r=await request('/shoes/'+pair.id,'PUT',{...pair,shoeId:'31',shoePhoto:pending,boxPhoto:pending});
  assert.equal(r.status,409);assert(await exists(third));
  r=await request('/photos','DELETE',{photos:[pending,third]});
  assert.equal(r.status,200);assert(!await exists(pending));assert(await exists(third));
  assert.equal((await request('/photos','DELETE',{photos:[{url:'/api/photos/'+'0'.repeat(32)+'/'+crypto.randomUUID()+'.png'}]})).status,400);
  console.log('PASS: replacement/removal frees files only after commit; shared and archived photos survive; failed saves retain originals.');

  const restored=await upload();
  r=await request('/import','POST',{overwrite:true,shoes:[{shoeId:'30',category:'Other',name:'',season:'Fall',shoePhoto:restored,boxPhoto:restored}]});
  assert.equal(r.status,201);assert(!await exists(third));assert(await exists(restored));
  pair=r.data.shoes.find(s=>s.shoeId==='30');
  assert.equal(pair.name,'Shoes');assert.equal(pair.season,'Fall');
  // Simulate an older backup without season/name.
  r=await request('/import','POST',{shoes:[{shoeId:'33',category:'Other',shoePhoto:restored}]});
  assert.equal(r.status,201);
  assert.equal(r.data.shoes.find(s=>s.shoeId==='33').season,'All-season');

  // Deleting an unused upload must wait for a concurrent save that attaches it.
  const racing=await upload(),originalHead=app.env.BUCKET.head;
  let entered,release;
  const entering=new Promise(resolve=>entered=resolve),gate=new Promise(resolve=>release=resolve);
  app.env.BUCKET.head=async candidate=>{if(candidate===key(racing)){entered();await gate;}return originalHead(candidate);};
  const saving=create('34',{shoePhoto:racing});
  await entering;
  const removing=request('/photos','DELETE',{photos:[racing]});
  release();await saving;await removing;
  app.env.BUCKET.head=originalHead;
  assert(await exists(racing));
  console.log('PASS: backup replacement cleanup, legacy backup defaults, and serialized save/delete races.');

  const abandoned=await upload(),fresh=await upload();
  const old=new Date(Date.now()-48*60*60*1000);
  await utimes(storedPath(abandoned),old,old);
  await utimes(storedPath(restored),old,old);
  const otherFile=path.join(path.dirname(storedPath(abandoned)),'keep.txt');
  await writeFile(otherFile,'Not an app-managed photo');
  await app.prunePhotos();
  assert(!await exists(abandoned));assert(await exists(fresh));assert(await exists(restored));await access(otherFile);
  const startupAbandoned=await upload();await utimes(storedPath(startupAbandoned),old,old);
  app.close();app=await createEnvironment({dataDirectory:directory});
  assert(!await exists(startupAbandoned));assert(await exists(restored));assert(await exists(racing));
  pair=(await request('/shoes')).data.shoes.find(s=>s.shoeId==='30');
  assert.equal(pair.name,'Shoes');assert.equal(pair.season,'Fall');
  console.log('PASS: abandoned uploads age out; recent uploads, referenced photos and other files remain; seasons survive restart.');
}finally{app.close();await rm(directory,{recursive:true,force:true});}
