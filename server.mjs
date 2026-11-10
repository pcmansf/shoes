import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {mkdir,readFile,writeFile,stat,unlink,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {migrateLocations} from './src/locations.js';
import {handle} from './src/worker.js';
import {pruneAbandonedPhotos} from './src/photo-cleanup.js';
import {createAccessPolicy} from './src/server-access.js';
import {readDriveConfig,drivePageHeaders} from './src/drive-config.js';
const root=path.dirname(fileURLToPath(import.meta.url));
export async function createEnvironment({dataDirectory=path.join(root,'data'),mode='local'}={}){
await mkdir(dataDirectory,{recursive:true});
const db=new DatabaseSync(path.join(dataDirectory,'shoes.sqlite'));db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
db.exec(await readFile(path.join(root,'drizzle','0000_shoe_collection.sql'),'utf8'));
migrateLocations(db);
const wrap=(sql,values=[])=>({bind(...v){return wrap(sql,v)},async first(){return db.prepare(sql).get(...values)||null},async all(){return {results:db.prepare(sql).all(...values)}},async run(){const r=db.prepare(sql).run(...values);return {meta:{changes:Number(r.changes)}}},sql,values});
const DB={prepare:sql=>wrap(sql),async batch(commands){db.exec('BEGIN IMMEDIATE');try{const results=commands.map(c=>{const r=db.prepare(c.sql).run(...c.values);return {meta:{changes:Number(r.changes)}}});db.exec('COMMIT');return results}catch(e){db.exec('ROLLBACK');throw e}}};
const filePath=key=>{if(!/^[a-f0-9]{32}\/[a-f0-9-]{36}\.(jpg|png|gif|webp)$/.test(key))throw new Error('Invalid image key');return path.join(dataDirectory,'photos',...key.split('/'))};
const BUCKET={
async delete(key){try{await unlink(filePath(key));}catch(error){if(error.code!=='ENOENT')throw error;}},
async list({prefix,cursor='',limit=500}){
  if(!/^[a-f0-9]{32}\/$/.test(prefix))throw new Error('Invalid photo folder');
  const directory=path.join(dataDirectory,'photos',prefix.slice(0,-1));
  let entries;try{entries=await readdir(directory,{withFileTypes:true});}catch(error){if(error.code==='ENOENT')return {objects:[],truncated:false};throw error;}
  const names=entries.filter(e=>e.isFile()&&/^[a-f0-9-]{36}\.(jpg|png|webp|gif)$/.test(e.name)&&e.name>cursor).map(e=>e.name).sort();
  const page=names.slice(0,limit),objects=[];
  for(const name of page){try{const info=await stat(filePath(prefix+name));objects.push({key:prefix+name,uploaded:info.mtime});}catch(error){if(error.code!=='ENOENT')throw error;}}
  return {objects,truncated:names.length>limit,cursor:page.at(-1)};
},async put(key,bytes){const p=filePath(key);await mkdir(path.dirname(p),{recursive:true});await writeFile(p,bytes)},async head(key){try{await stat(filePath(key));return {key}}catch{return null}},async get(key){try{const bytes=await readFile(filePath(key));return {body:bytes,httpMetadata:{contentType:{jpg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif'}[key.split('.').pop()]}}}catch{return null}}};
const assets={};for(const [name,type] of [['index.html','text/html; charset=utf-8'],['app.js','text/javascript; charset=utf-8'],['save-pair.js','text/javascript; charset=utf-8'],['photo-zoom.js','text/javascript; charset=utf-8'],['seasons.js','text/javascript; charset=utf-8'],['storage-status.js','text/javascript; charset=utf-8'],['editor-guard.js','text/javascript; charset=utf-8'],['action-confirmations.js','text/javascript; charset=utf-8'],['dialog-interactions.js','text/javascript; charset=utf-8'],['location-icons.js','text/javascript; charset=utf-8'],['style.css','text/css; charset=utf-8'],['drive-import.html','text/html; charset=utf-8'],['drive-setup.html','text/html; charset=utf-8'],['drive-popup.js','text/javascript; charset=utf-8'],['drive-common.js','text/javascript; charset=utf-8'],['drive-style.css','text/css; charset=utf-8'],['drive-config.example.json','application/json']])assets['/'+name]={type,body:await readFile(path.join(root,'ui',name),'utf8')};
let mutations=Promise.resolve();
const withMutationLock=task=>{const result=mutations.then(task);mutations=result.catch(()=>{});return result;};
const env={DB,BUCKET,LOCAL_MODE:mode==='local',STORAGE_MODE:mode,withMutationLock};
const prunePhotos=()=>withMutationLock(()=>pruneAbandonedPhotos(env,'local-owner'));
await prunePhotos().catch(error=>console.warn('Photo cleanup postponed:',error.message));
return {env,assets,db,prunePhotos,idle:()=>mutations,getDriveConfig:()=>readDriveConfig(dataDirectory),close(){db.close()}};
}
export async function handleServerRequest(request,runtime,policy,actualPort){
  const result=policy.check(request,actualPort);
  if(result.response)return result.response;
  const headers=new Headers(request.headers);
  // A self-hosted collection has one household owner. Client-supplied identity is never trusted.
  headers.delete('authorization');
  headers.delete('oai-authenticated-user-email');
  headers.set('oai-authenticated-user-id','local-owner');
  const route=new URL(result.url).pathname;
  if(route==='/api/drive/config'){
    if(request.method!=='GET')return new Response('Method not allowed',{status:405});
    return new Response(JSON.stringify(await runtime.getDriveConfig()),{
      headers:{'Content-Type':'application/json','Cache-Control':'no-store'}
    });
  }
  if(route==='/drive-import.html'&&['GET','HEAD'].includes(request.method)){
    return new Response(request.method==='HEAD'?null:runtime.assets[route].body,{headers:drivePageHeaders()});
  }
  const options={method:request.method,headers};
  if(!['GET','HEAD'].includes(request.method))options.body=await request.arrayBuffer();
  const response=await handle(new Request(result.url,options),runtime.env,runtime.assets);
  response.headers.set('Cross-Origin-Opener-Policy','same-origin-allow-popups');
  return response;
}

export async function createServer({
  port=5173,host='127.0.0.1',origins=[],username='',password='',requireLogin=true,
  dataDirectory=path.join(root,'data')
}={}){
  const policy=createAccessPolicy({host,port,origins,username,password,requireLogin});
  const runtime=await createEnvironment({dataDirectory,mode:policy.local?'local':'server'});
  const send=async(res,response)=>{
    res.writeHead(response.status,Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  };
  const server=http.createServer(async(req,res)=>{
    try{
      if(!req.headers.host||!req.url.startsWith('/')||req.url.startsWith('//')){
        res.writeHead(400);res.end('Invalid request');return;
      }
      const headers=new Headers();
      for(const[k,v]of Object.entries(req.headers))if(v!=null)headers.set(k,Array.isArray(v)?v.join(','):v);
      const address='http://'+req.headers.host+req.url;
      const check=policy.check(new Request(address,{headers}),server.address().port);
      if(check.response){await send(res,check.response);return;}
      const chunks=[];let size=0;
      for await(const chunk of req){
        size+=chunk.length;
        if(size>12*1024*1024){res.writeHead(413);res.end('File too large.');return;}
        chunks.push(chunk);
      }
      const options={method:req.method,headers};
      if(!['GET','HEAD'].includes(req.method))options.body=Buffer.concat(chunks);
      await send(res,await handleServerRequest(new Request(address,options),runtime,policy,server.address().port));
    }catch(error){
      console.error('Request failed:',error.message);
      if(!res.headersSent)res.writeHead(500,{'Content-Type':'application/json'});
      res.end(JSON.stringify({error:'The app could not complete this request.'}));
    }
  });
  server.requestTimeout=30000;
  server.headersTimeout=15000;
  try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve)});}
  catch(error){runtime.close();throw error;}
  const cleanupTimer=setInterval(()=>runtime.prunePhotos().catch(error=>console.warn('Photo cleanup postponed:',error.message)),60*60*1000);
  cleanupTimer.unref();
  return {
    server,db:runtime.db,url:origins[0]||'http://'+(host.includes(':')?'['+host+']':host)+':'+server.address().port,
    async close(){clearInterval(cleanupTimer);await new Promise(resolve=>server.close(resolve));await runtime.idle();runtime.close();}
  };
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const dataDirectory=process.env.SHOES_DATA_DIR||path.join(root,'data');
  const app=await createServer({
    port:Number(process.env.SHOES_PORT||5173),
    host:process.env.SHOES_HOST||'127.0.0.1',
    origins:(process.env.SHOES_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean),
    username:process.env.SHOES_USERNAME||'',password:process.env.SHOES_PASSWORD||'',dataDirectory
  });
  console.log('Shoes is ready at '+app.url);
  console.log('Records and photos are saved in '+dataDirectory);
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await app.close();process.exit(0)});
}
