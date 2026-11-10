import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {readDriveConfig,drivePageHeaders} from './src/drive-config.js';
import {driveOriginSupported,isDriveImportMessage,downloadDriveImage,MAX_DRIVE_BYTES} from './ui/drive-common.js';
import {createEnvironment,handleServerRequest} from './server.mjs';
import {createAccessPolicy} from './src/server-access.js';

const directory=await mkdtemp(path.join(os.tmpdir(),'shoes-drive-test-'));
const config={clientId:'1234567890-example.apps.googleusercontent.com',apiKey:'AIza'+'x'.repeat(35),appId:'1234567890'};
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6JqsAAAAASUVORK5CYII=','base64');
const fileId='exampleImageFile123';
let runtime;
try{
  assert.deepEqual(await readDriveConfig(directory,{}),{configured:false});
  await writeFile(path.join(directory,'google-drive.json'),JSON.stringify({...config,clientSecret:'must-not-be-exposed'}));
  assert.deepEqual(await readDriveConfig(directory,{}),{configured:true,...config});
  await writeFile(path.join(directory,'google-drive.json'),'\uFEFF'+JSON.stringify(config));
  assert.deepEqual(await readDriveConfig(directory,{}),{configured:true,...config});
  assert.deepEqual(await readDriveConfig(directory,{SHOES_GOOGLE_CLIENT_ID:config.clientId,SHOES_GOOGLE_API_KEY:config.apiKey,SHOES_GOOGLE_APP_ID:config.appId}),{configured:true,...config});
  await writeFile(path.join(directory,'google-drive.json'),'invalid');
  assert.equal((await readDriveConfig(directory,{})).configured,false);
  await writeFile(path.join(directory,'google-drive.json'),JSON.stringify(config));

  assert(driveOriginSupported('http://localhost:5173'));
  assert(driveOriginSupported('http://127.0.0.1:5173'));
  assert(driveOriginSupported('https://shoes.example.com'));
  assert.equal(driveOriginSupported('http://raspberrypi.local:3000'),false);
  assert.equal(driveOriginSupported('http://192.168.1.50:3000'),false);
  const popup={};
  const expected={origin:'http://localhost:5173',popup,requestId:'nonce'};
  const event={origin:expected.origin,source:popup,data:{
    type:'shoes-drive-image',requestId:'nonce',image:new Blob([png],{type:'image/png'}),name:'shoe.png'
  }};
  assert(isDriveImportMessage(event,expected));
  assert.equal(isDriveImportMessage({...event,origin:'https://evil.example'},expected),false);
  assert.equal(isDriveImportMessage({...event,source:{}},expected),false);
  assert.equal(isDriveImportMessage({...event,data:{...event.data,requestId:'wrong'}},expected),false);
  assert.equal(isDriveImportMessage({...event,data:{...event.data,image:new Blob(['<svg/>'],{type:'image/svg+xml'})}},expected),false);

  const requests=[];
  const fetcher=async(url,options)=>{
    requests.push({url,options});
    return url.includes('alt=media')?new Response(png):Response.json({
      id:fileId,name:'private-shoe.png',mimeType:'image/png',size:String(png.length),capabilities:{canDownload:true}
    });
  };
  const imported=await downloadDriveImage('temporary-test-token',{id:fileId},fetcher);
  assert.deepEqual(Buffer.from(await imported.image.arrayBuffer()),png);
  assert.equal(imported.name,'private-shoe.png');
  assert.equal(requests.length,2);
  for(const {url,options} of requests){
    assert(url.startsWith('https://www.googleapis.com/drive/v3/files/'+fileId+'?'));
    assert.equal(options.headers.Authorization,'Bearer temporary-test-token');
    assert.equal(options.credentials,'omit');
    assert.equal(options.method,undefined); // Native fetch defaults to GET.
  }
  await assert.rejects(()=>downloadDriveImage('test',{id:'../../other-host'},fetcher),/Choose an image/);
  await assert.rejects(()=>downloadDriveImage('test',{id:fileId},async()=>new Response('',{status:401})),/expired/);
  await assert.rejects(()=>downloadDriveImage('test',{id:fileId},async()=>Response.json({mimeType:'image/png',capabilities:{canDownload:false}})),/disabled/);
  await assert.rejects(()=>downloadDriveImage('test',{id:fileId},async()=>Response.json({mimeType:'image/heic',capabilities:{canDownload:true}})),/HEIC/);
  await assert.rejects(()=>downloadDriveImage('test',{id:fileId},async()=>Response.json({mimeType:'image/png',size:String(MAX_DRIVE_BYTES+1),capabilities:{canDownload:true}})),/20 MB/);

  runtime=await createEnvironment({dataDirectory:directory,mode:'server'});
  runtime.getDriveConfig=()=>readDriveConfig(directory,{});
  const policy=createAccessPolicy({
    host:'0.0.0.0',port:3000,origins:['http://raspberrypi.local:3000'],
    username:'shoes',password:'test-password-not-for-deployment'
  });
  const authorization='Basic '+Buffer.from('shoes:test-password-not-for-deployment').toString('base64');
  const send=(route,options={})=>handleServerRequest(new Request('http://raspberrypi.local:3000'+route,options),runtime,policy,3000);
  assert.equal((await send('/api/drive/config')).status,401);
  assert.equal((await send('/drive-import.html')).status,401);
  const configuration=await(await send('/api/drive/config',{headers:{authorization}})).json();
  assert.deepEqual(configuration,{configured:true,...config});
  const page=await send('/drive-import.html',{headers:{authorization}});
  assert.equal(page.status,200);
  assert.equal(page.headers.get('cross-origin-opener-policy'),'same-origin-allow-popups');
  assert.equal((await send('/',{headers:{authorization}})).headers.get('cross-origin-opener-policy'),'same-origin-allow-popups');
  assert(drivePageHeaders()['Content-Security-Policy'].includes('https://docs.google.com'));
  assert.equal((await send('/drive-common.js',{headers:{authorization}})).status,200);
  const photoResponse=await send('/api/photos',{method:'POST',headers:{authorization,'Content-Type':imported.image.type},body:await imported.image.arrayBuffer()});
  assert.equal(photoResponse.status,201);
  const photo=await photoResponse.json();
  const pair=await send('/api/shoes',{method:'POST',headers:{authorization,'Content-Type':'application/json'},body:JSON.stringify({
    shoeId:'25',name:'Drive import test',category:'Sneakers',shoePhoto:photo
  })});
  assert.equal(pair.status,201);
  runtime.close();
  runtime=await createEnvironment({dataDirectory:directory,mode:'server'});
  assert.deepEqual(Buffer.from(await(await send(photo.url,{headers:{authorization}})).arrayBuffer()),png);
  console.log('PASS: Drive configuration, origin requirements, popup-message verification, authenticated image download fixtures, file/size checks, protected routes, photo storage and restart persistence.');
}finally{if(runtime)runtime.close();await rm(directory,{recursive:true,force:true});}
