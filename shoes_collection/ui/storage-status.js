import {matchesSeason,seasonOf} from './seasons.js';

export const STORAGE_STATUSES=['stored','out'];
export const storageStatusOf=pair=>pair?.storageStatus==='out'?'out':'stored';
export const storageLabel=pair=>storageStatusOf(pair)==='out'?'Taken out':'Stored';
export function storageIcon(status){
  const drawing=status==='out'
    ? 'M4 13v8h16v-8 M9 17V3 m-4 4 4-4 4 4 M15 10h5'
    : 'm3 7 9-4 9 4v11l-9 4-9-4V7Z M3 7l9 4 9-4 M12 11v11';
  return `<svg class="icon storage-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${drawing}"/></svg>`;
}
const normalized=value=>String(value||'').trim().toLowerCase();
export function matchesLocation(pair,filter='all',locations=[]){
  if(filter==='all')return true;
  if(filter==='none')return !normalized(pair.location);
  const place=locations.find(item=>'location:'+item.id===filter);
  return !!place&&normalized(pair.location)===normalized(place.name);
}
export function filterCollection(pairs,{category='All pairs',season='Any season',location='all',status='all',search=''}={},locations=[]){
  const query=normalized(search).replace(/^#\s*/,'');
  return pairs.filter(pair=>(category==='All pairs'||pair.category===category)
    &&matchesSeason(pair,season)&&matchesLocation(pair,location,locations)
    &&(status==='all'||storageStatusOf(pair)===status)
    &&(!query||[pair.shoeId,pair.name,pair.brand,pair.location,pair.notes,seasonOf(pair),storageLabel(pair)]
      .some(value=>normalized(value).includes(query))));
}
