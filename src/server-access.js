import {createHash,timingSafeEqual} from 'node:crypto';

const digest=value=>createHash('sha256').update(value).digest();
const reject=(message,status,headers={})=>new Response(message,{
  status,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store',...headers}
});

export function createAccessPolicy({host='127.0.0.1',port=5173,origins=[],username='',password=''}={}) {
  const local=['127.0.0.1','::1','localhost'].includes(host);
  if(!Number.isInteger(port)||port<0||port>65535)throw new Error('SHOES_PORT must be a valid port.');
  if((username&&!password)||(!username&&password))throw new Error('Set both SHOES_USERNAME and SHOES_PASSWORD.');
  if(username.includes(':')||/[\r\n]/.test(username+password))throw new Error('Invalid login configuration.');
  if(!local&&(!username||password.length<16))throw new Error('Network hosting requires a username and a password of at least 16 characters.');
  if(!local&&!origins.length)throw new Error('Network hosting requires SHOES_ORIGINS, such as http://raspberrypi.local:3000.');
  const allowed=new Map();
  for(const text of origins){
    const url=new URL(text);
    if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error('SHOES_ORIGINS must contain only HTTP(S) origins.');
    if(allowed.has(url.host)&&allowed.get(url.host)!==url.origin)throw new Error('Each hostname must have a single configured scheme.');
    allowed.set(url.host,url.origin);
  }
  const credential=username?digest(username+':'+password):null;
  return {
    local,
    check(request,actualPort=port){
      const incoming=new URL(request.url);
      const hostHeader=request.headers.get('host');
      if(hostHeader&&hostHeader.toLowerCase()!==incoming.host.toLowerCase())return {response:reject('Invalid host',403)};
      let origin=allowed.get(incoming.host);
      if(!origin&&local&&['127.0.0.1','localhost','[::1]'].some(name=>incoming.host===name+':'+actualPort))origin=incoming.origin;
      if(!origin)return {response:reject('This hostname is not configured for Shoes.',403)};
      if(credential){
        const auth=request.headers.get('authorization')||'';
        const match=/^Basic ([A-Za-z0-9+/]+=*)$/i.exec(auth);
        const supplied=match?Buffer.from(match[1],'base64').toString('utf8'):'';
        if(!match||!timingSafeEqual(digest(supplied),credential))return {
          response:reject('Sign in to your shoe collection.',401,{'WWW-Authenticate':'Basic realm="Shoes", charset="UTF-8"'})
        };
      }
      return {url:origin+incoming.pathname+incoming.search};
    }
  };
}
