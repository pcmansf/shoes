import {storageStatusOf} from './storage-status.js';
import {seasonOf} from './seasons.js';
const fields=['shoeId','name','category','season','storageStatus','brand','location','notes','reviewed','archived','shoePhoto','boxPhoto'];
function snapshot(pair){
  return fields.map(field=>{
    if(field==='season')return seasonOf(pair);
    if(field==='storageStatus')return storageStatusOf(pair);
    if(field==='reviewed'||field==='archived')return pair[field]===true;
    if(field==='shoePhoto'||field==='boxPhoto'){
      const photo=pair[field];
      return photo?[photo.url,photo.crop||null]:null;
    }
    return pair[field]||'';
  });
}

// Save and Confirm match use identical record identity/revision handling.
// Review status is ordinary data, never a prerequisite for saving photos.
export async function savePair(api,original,changes){
  const body=Object.fromEntries(fields.map(field=>[field,changes[field]]));
  const send=pair=>api(pair?'/shoes/'+pair.id:'/shoes',{
    method:pair?'PUT':'POST',
    body:JSON.stringify({...body,...(pair?{revision:pair.revision}:{})})
  });
  try{return await send(original);}
  catch(error){
    if(!original||error.status!==404)throw error;
    const {shoes}=await api('/shoes');
    const candidates=shoes.filter(pair=>pair.shoeId.toLowerCase()===original.shoeId.toLowerCase());
    if(candidates.length!==1)throw new Error('This pair is no longer in the collection. Your unsaved changes are still in this editor.');
    const current=candidates[0];
    // Only reconnect an unchanged pair. A changed/replaced pair needs review;
    // normal revision checks also protect the retry from concurrent writes.
    if(JSON.stringify(snapshot(current))!==JSON.stringify(snapshot(original))){
      throw new Error('This pair was replaced or changed. Your unsaved changes are still in this editor; reopen the current pair before saving.');
    }
    return send(current);
  }
}
