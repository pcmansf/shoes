const photoPattern=/^\/api\/photos\/([a-f0-9]{32}\/[a-f0-9-]{36}\.(?:jpg|png|webp|gif))$/;
export const photoUrls=shoe=>[shoe?.shoePhoto?.url,shoe?.boxPhoto?.url].filter(Boolean);
export const photoPrefix=async owner=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(owner)))].map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,32);

async function references(env,owner){
  const rows=await env.DB.prepare('SELECT data FROM shoes WHERE owner = ?').bind(owner).all();
  return new Set(rows.results.flatMap(row=>photoUrls(JSON.parse(row.data))));
}

// Call inside the same mutation queue as saves: checking references and deleting
// must not interleave with another request attaching an image.
export async function removeUnusedPhotos(env,owner,prefix,urls){
  if(!env.BUCKET.delete)return 0;
  const used=await references(env,owner);
  let removed=0;
  for(const url of new Set(urls)){
    const key=typeof url==='string'?photoPattern.exec(url)?.[1]:null;
    if(!key||!key.startsWith(prefix+'/')||used.has(url))continue;
    try{await env.BUCKET.delete(key);removed++;}
    catch(error){console.warn('Photo cleanup will retry later:',error.message);}
  }
  return removed;
}

export async function pruneAbandonedPhotos(env,owner,now=Date.now()){
  if(!env.BUCKET.list||!env.BUCKET.delete)return 0;
  const prefix=await photoPrefix(owner),used=await references(env,owner);
  let cursor,removed=0;
  do{
    const page=await env.BUCKET.list({prefix:prefix+'/',cursor,limit:500});
    for(const object of page.objects){
      const age=now-new Date(object.uploaded).getTime();
      const url='/api/photos/'+object.key;
      if(!photoPattern.test(url)||!object.key.startsWith(prefix+'/')||!Number.isFinite(age)||age<24*60*60*1000||used.has(url))continue;
      try{await env.BUCKET.delete(object.key);removed++;}
      catch(error){console.warn('Photo cleanup will retry later:',error.message);}
    }
    cursor=page.truncated?page.cursor:undefined;
  }while(cursor);
  return removed;
}
