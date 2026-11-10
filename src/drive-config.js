import {readFile} from 'node:fs/promises';
import path from 'node:path';

export async function readDriveConfig(directory,environment=process.env){
  let file={};
  try{
    file=JSON.parse((await readFile(path.join(directory,'google-drive.json'),'utf8')).replace(/^\uFEFF/,''));
    if(!file||typeof file!=='object')throw new Error();
  }catch(error){
    if(error.code!=='ENOENT')return {configured:false,error:'The Google Drive configuration file is not valid JSON.'};
  }
  const clientId=environment.SHOES_GOOGLE_CLIENT_ID||file.clientId||'';
  const apiKey=environment.SHOES_GOOGLE_API_KEY||file.apiKey||'';
  const appId=environment.SHOES_GOOGLE_APP_ID||file.appId||'';
  if(!clientId&&!apiKey&&!appId)return {configured:false};
  if(typeof clientId!=='string'||!/^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(clientId)||
     typeof apiKey!=='string'||!/^AIza[A-Za-z0-9_-]{20,}$/.test(apiKey)||
     typeof appId!=='string'||!/^\d+$/.test(appId)){
    return {configured:false,error:'Add a Web OAuth client ID, a Google API key, and the numeric project number.'};
  }
  // Only browser configuration is returned. No client secrets or unrelated settings are exposed.
  return {configured:true,clientId,apiKey,appId};
}

export function drivePageHeaders(){
  return {
    'Content-Type':'text/html; charset=utf-8',
    'Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff',
    'Referrer-Policy':'strict-origin-when-cross-origin',
    'Cross-Origin-Opener-Policy':'same-origin-allow-popups',
    'Content-Security-Policy':[
      "default-src 'self'",
      "script-src 'self' https://apis.google.com https://accounts.google.com/gsi/client https://www.gstatic.com https://ssl.gstatic.com",
      "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
      "img-src 'self' data: blob: https://*.googleusercontent.com https://*.gstatic.com https://*.google.com",
      "connect-src 'self' https://www.googleapis.com https://accounts.google.com https://apis.google.com",
      "frame-src https://docs.google.com https://drive.google.com https://accounts.google.com",
      "object-src 'none'","base-uri 'self'","frame-ancestors 'self'"
    ].join('; ')
  };
}
