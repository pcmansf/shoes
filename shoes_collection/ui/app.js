import {STORAGE_STATUSES,storageStatusOf,storageLabel,storageIcon,filterCollection} from './storage-status.js';
import {CONFIRMATION_ACTIONS,createConfirmationPreferences,attachActionConfirmation} from './action-confirmations.js';
import {attachBackdropClose,attachDialogResize,attachShoeCard} from './dialog-interactions.js';
import {LOCATION_ICONS,locationIcon,locationIconLabel,iconForLocation} from './location-icons.js';
import {attachEditorGuard} from './editor-guard.js';
import {SEASONS,seasonOf,matchesSeason,seasonIcon} from './seasons.js';
import {isDriveImportMessage} from './drive-common.js';
import {savePair} from './save-pair.js';
import {attachPhotoZoom} from './photo-zoom.js';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const paths={location:'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',list:'M8 5h13 M8 12h13 M8 19h13 M3 5h.01 M3 12h.01 M3 19h.01',plus:'M12 5v14 M5 12h14',close:'m6 6 12 12 M6 18 18 6',check:'M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',archive:'M3 3h18v5H3z M5 8v13h14V8 M10 12h4',lock:'M6 10h12v11H6z M8 10V6a4 4 0 0 1 8 0v4',download:'M12 3v12 m-5-5 5 5 5-5 M4 15v6h16v-6',upload:'M12 16V4 m-5 5 5-5 5 5 M4 16v5h16v-5',shoe:'M4 5h6l1 6 5 3 4 1a2 2 0 0 1 2 2v3H2v-5l2-10Z M2 17h20 M11 11l-2 2 M14 13l-2 2',box:'m3 7 9-4 9 4v11l-9 4-9-4V7Z M3 7l9 4 9-4 M12 11v11 M7 5l9 4',image:'M3 3h18v18H3z m0 13 6-6 5 5 3-3 4 4 M16 7h.01',camera:'M3 7h4l2-3h6l2 3h4v14H3V7Z M16 13a4 4 0 1 0-8 0 4 4 0 0 0 8 0Z',search:'M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z m-2 5 7 7',edit:'m15 4 5 5 M4 20l5-1L21 7l-5-5L4 14v6Z',arrow:'M5 12h14 m-6-6 6 6-6 6'};
const icon=n=>`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[n]||paths.shoe}"/></svg>`;
function icons(root=document){root.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));}icons();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let locations=[],locationsBusy=false;
let shoes=[],view='collection',filter='All pairs',seasonFilter='Any season',locationFilter='all',storageFilter='all',sort='id',selected=null,draft=null,photos={},busy=false,toastTimer;
const categories=['All pairs','Boots','Heels','Flats','Sneakers','Sandals','Other'];
const pendingPhotoUploads=new Map();
async function deleteUnused(photos){
  for(let offset=0;offset<photos.length;offset+=100){
    await api('/photos',{method:'DELETE',body:JSON.stringify({photos:photos.slice(offset,offset+100)}),keepalive:true}).catch(()=>{});
  }
}
function discardPendingUploads(){
  const uploads=[...pendingPhotoUploads.values()];pendingPhotoUploads.clear();
  void deleteUnused(uploads);
}
function retirePendingPhoto(photo){
  if(!photo||!pendingPhotoUploads.has(photo.url)||Object.values(photos).some(p=>p?.url===photo.url))return;
  pendingPhotoUploads.delete(photo.url);void deleteUnused([photo]);
}
window.addEventListener('pagehide',discardPendingUploads);
$('#seasonChoices').innerHTML=SEASONS.map(season=>`<label class="season-option"><input type="radio" name="season" value="${season}" ${season==='All-season'?'checked':''}><span>${seasonIcon(season)}${season}</span></label>`).join('');
$('#storageChoices').innerHTML=STORAGE_STATUSES.map(status=>`<label class="storage-option"><input type="radio" name="storageStatus" value="${status}" ${status==='stored'?'checked':''}><span>${storageIcon(status)}${status==='out'?'Taken out':'Stored'}</span></label>`).join('');
async function api(path,options={}){const r=await fetch('/api'+path,{...options,headers:{...(options.body&&typeof options.body==='string'?{'Content-Type':'application/json'}:{}),...options.headers}});let data;try{data=await r.json()}catch{throw new Error('The database did not respond. Please try again.')}if(!r.ok)throw Object.assign(new Error(data.error||'Something went wrong. Please try again.'),{status:r.status});return data;}
function toast(message,undo){clearTimeout(toastTimer);const t=$('#toast');t.textContent=message;if(undo){const b=document.createElement('button');b.textContent='Undo';b.onclick=undo;t.appendChild(b)}t.hidden=false;toastTimer=setTimeout(()=>t.hidden=true,undo?10000:4500);}
function error(message){$('#errorBanner').textContent=message;$('#errorBanner').hidden=!message;}
function placeholder(kind='shoe'){return `<div class="placeholder">${icon(kind)}<span>${kind==='box'?'Add a box photo':'A photo belongs here'}</span></div>`;}
function photoHtml(photo,alt,kind='shoe'){if(!photo?.url)return placeholder(kind);const safe=photo.url.startsWith('/api/photos/')||photo.url.startsWith('blob:')||/^data:image\/(jpeg|png|webp|gif);base64,/.test(photo.url);if(!safe)return placeholder(kind);if(photo.crop){const [x,y,w,h]=photo.crop;return `<svg class="photo-view" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(alt)}" preserveAspectRatio="xMidYMid meet"><svg width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}" overflow="hidden"><image href="${esc(photo.url)}" x="0" y="0" width="2048" height="976" preserveAspectRatio="none"/></svg></svg>`}return `<img class="photo-view" loading="lazy" src="${esc(photo.url)}" alt="${esc(alt)}">`;}
async function load(){try{error('');const d=await api('/shoes');shoes=d.shoes;locations=d.locations||[];$('#saveState').textContent=d.mode==='local'?'Saved on this computer':d.mode==='server'?'Saved on your server':'Saved online';$('#storageMode').textContent=d.mode==='local'?'Private · on this computer':d.mode==='server'?'Private · home server':'Private · saved online';$('#footerStorage').textContent=d.mode==='local'?'Saved on this computer. Export a backup to keep a copy.':d.mode==='server'?'Saved on your server. Export a backup to keep a copy.':'Your edits are saved online.';render();}catch(e){error(e.message);$('#saveState').textContent='Connection unavailable';$('#shoeGrid').innerHTML=`<div class="empty-state">${icon('box')}<h2>Let’s reconnect your collection.</h2><p>${esc(e.message)}</p><button class="secondary" id="retryBtn">Try again</button></div>`;$('#retryBtn').onclick=load;}}
function base(){return shoes.filter(s=>view==='archived'?s.archived:!s.archived&&(view!=='review'||!s.reviewed));}
function filteredPairs(overrides={}){
  return filterCollection(base(),{category:filter,season:seasonFilter,location:locationFilter,status:storageFilter,search:$('#search').value,...overrides},locations);
}
function hasActiveFilters(){return !!$('#search').value.trim()||filter!=='All pairs'||seasonFilter!=='Any season'||locationFilter!=='all'||storageFilter!=='all';}
function clearCollectionFilters(){
  $('#search').value='';filter='All pairs';seasonFilter='Any season';locationFilter='all';storageFilter='all';render();
}
function renderLocationFilter(){
  if(locationFilter!=='all'&&locationFilter!=='none'&&!locations.some(item=>'location:'+item.id===locationFilter))locationFilter='all';
  $('#locationFilter').innerHTML='<option value="all">All locations</option><option value="none">No location</option>'+locations.map(item=>`<option value="location:${item.id}">${esc(item.name)}</option>`).join('');
  $('#locationFilter').value=locationFilter;
}
function renderStorageFilters(){
  const rows=filteredPairs({status:'all'});
  $('#storageFilters').innerHTML=[['all','Show both'],['stored','Stored'],['out','Taken out']].map(([status,label])=>`<button type="button" data-storage-filter="${status}" class="${storageFilter===status?'active':''}" aria-pressed="${storageFilter===status}">${status==='all'?'':storageIcon(status)}${label}<span>${status==='all'?rows.length:rows.filter(pair=>storageStatusOf(pair)===status).length}</span></button>`).join('');
  $$('[data-storage-filter]').forEach(button=>button.onclick=()=>{storageFilter=button.dataset.storageFilter;render();});
}
$('#locationFilter').onchange=event=>{locationFilter=event.target.value;render();};
$('#clearCollectionFilters').onclick=clearCollectionFilters;
function renderSeasons(){
  const rows=filteredPairs({season:'Any season'});
  $('#seasonFilters').innerHTML=['Any season',...SEASONS].map(season=>`<button type="button" class="${season===seasonFilter?'active':''}" data-season="${season}" aria-pressed="${season===seasonFilter}">${season==='Any season'?'':seasonIcon(season)}${season}<span>${rows.filter(shoe=>matchesSeason(shoe,season)).length}</span></button>`).join('');
  $('#seasonFilters').querySelectorAll('button').forEach(button=>button.onclick=()=>{seasonFilter=button.dataset.season;render();});
}
function render(){renderLocationFilter();const active=shoes.filter(s=>!s.archived);$('#navCount').textContent=active.length;$('#totalCount').textContent=active.length;$('#reviewCount').textContent=active.filter(s=>!s.reviewed).length;$('#archiveCount').textContent=shoes.length-active.length;$('#photoCount').textContent=active.filter(s=>s.shoePhoto&&s.boxPhoto).length;$('#readyCount').textContent=active.filter(s=>s.reviewed).length;$('#pageTitle').innerHTML=({collection:'Your collection',review:'A second look',archived:'Archived pairs'}[view])+ '<span>.</span>';$('#pageSubtitle').textContent=({collection:'Less searching through boxes. More finding your favorites.',review:'Check each name and make sure the shoe and box belong together.',archived:'Pairs you’ve set aside. Restore them whenever you like.'}[view]);$$('.nav-item[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));$('#sourceBanner').hidden=view!=='collection'||sessionStorage.getItem('hidePhotoTip')==='1'||!active.some(s=>s.seeded&&!s.shoePhoto);$('#filters').innerHTML=categories.map(c=>{const count=filteredPairs({category:c}).length;return `<button class="${c===filter?'active':''}" data-filter="${c}">${c}<span>${count}</span></button>`}).join('');$('#filters').querySelectorAll('button').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;render()});renderSeasons();renderStorageFilters();$('#clearCollectionFilters').hidden=!hasActiveFilters();let rows=filteredPairs();rows.sort((a,b)=>sort==='name'?a.name.localeCompare(b.name):sort==='newest'?b.createdAt.localeCompare(a.createdAt):a.shoeId.localeCompare(b.shoeId,undefined,{numeric:true,sensitivity:'base'}));$('#resultCount').textContent=`${rows.length} ${rows.length===1?'pair':'pairs'}`;$('#shoeGrid').innerHTML=rows.length?rows.map(s=>`<article class="shoe-card${storageStatusOf(s)==='out'?' is-taken-out':''}" tabindex="0" role="button" aria-label="Open ${esc(s.name)}, box ${esc(s.shoeId)}, ${storageLabel(s)}" data-id="${s.id}"><div class="card-photo">${photoHtml(s.shoePhoto,s.name)}<span class="id-pill"># ${esc(s.shoeId.padStart(2,'0'))}</span>${!s.reviewed?'<span class="review-dot"><i></i>To review</span>':''}${storageStatusOf(s)==='out'?`<span class="storage-badge">${storageIcon('out')}Taken out</span>`:''}<div class="box-thumb">${photoHtml(s.boxPhoto,'Box '+s.shoeId,'box')}</div></div><div class="card-info"><div class="card-labels"><div class="card-category">${esc(s.category)}</div><span class="season-badge">${seasonIcon(seasonOf(s))}${seasonOf(s)}</span></div><h3>${esc(s.name)}</h3><div class="card-meta">${s.brand?`<span class="card-brand">${esc(s.brand)}</span>`:''}${s.location?`<span class="card-location">${locationIcon(iconForLocation(locations,s.location))}${esc(s.location)}</span>`:''}</div><div class="card-bottom"><span class="photo-status">${icon('image')}${s.shoePhoto&&s.boxPhoto?'Shoe + box':s.shoePhoto||s.boxPhoto?'1 of 2 photos':'Photos to add'}</span><button class="card-edit" data-edit="${s.id}" aria-label="Edit ${esc(s.name)}">${icon('edit')}Edit</button></div></div></article>`).join(''):`<div class="empty-state">${icon('search')}<h2>${hasActiveFilters()?'No pairs found.':view==='archived'?'No archived pairs.':view==='review'?'All caught up.':'No pairs found.'}</h2><p>${hasActiveFilters()?'Try another search or filter.':view==='review'?'Every pair has been reviewed.':view==='archived'?'Archived shoes will appear here.':'Add your first pair to get started.'}</p><button class="secondary" id="emptyAction">${hasActiveFilters()?'Clear filters':'Add a pair'}</button></div>`;$$('.shoe-card').forEach(card=>attachShoeCard(card,{preview:openDetail,edit:openEditor}));if($('#emptyAction'))$('#emptyAction').onclick=()=>{if(hasActiveFilters()){$('#search').value='';filter='All pairs';seasonFilter='Any season';locationFilter='all';storageFilter='all';render()}else openEditor()};}
function showDialog(d){if(!d.open)d.showModal();document.body.classList.add('modal-open');}
function syncModalState(){document.body.classList.toggle('modal-open',!!$('dialog[open]'));}
function closeDialog(d){
  if(d.id==='editor')return editorGuard.requestClose();
  if(d.id==='locationsDialog')return locationsGuard.requestClose();
  d.close();syncModalState();
}
$$('dialog').forEach(d=>{d.addEventListener('close',syncModalState);attachBackdropClose(d,closeDialog);});
const detailResize=attachDialogResize($('#detail'),$('#resizeDetail'));
const confirmationPreferences=createConfirmationPreferences(localStorage);
const confirmAction=attachActionConfirmation({
  dialog:$('#actionConfirmDialog'),title:$('#actionConfirmTitle'),message:$('#actionConfirmMessage'),
  confirmButton:$('#acceptActionConfirm'),cancelButton:$('#cancelActionConfirm'),skipCheckbox:$('#skipActionConfirm'),
  show:showDialog,close:closeDialog,preferences:confirmationPreferences
});
$('#closeActionConfirm').onclick=()=>closeDialog($('#actionConfirmDialog'));
$('#confirmationSettingsBtn').onclick=()=>{
  $('#confirmationOptions').innerHTML=CONFIRMATION_ACTIONS.map(action=>`<label class="checkbox-row"><input type="checkbox" data-confirm-action="${action.id}" ${confirmationPreferences.shouldAsk(action.id)?'checked':''}><span>${action.label}</span></label>`).join('');
  $$('[data-confirm-action]').forEach(input=>input.onchange=()=>confirmationPreferences.setAsk(input.dataset.confirmAction,input.checked));
  showDialog($('#confirmationSettingsDialog'));
};
for(const id of ['closeConfirmationSettings','doneConfirmationSettings'])$('#'+id).onclick=()=>closeDialog($('#confirmationSettingsDialog'));
function confirmArchive(pair){return confirmAction('archive-pair',{title:'Archive this pair?',message:pair.name+' (box '+pair.shoeId+') will move to Archived. Its information and photos will be kept, and you can restore it later.',button:'Archive pair'});}

function openEditor(id){if(busy)return;draft=id?shoes.find(s=>s.id===id):null;photos={shoe:draft?.shoePhoto||null,box:draft?.boxPhoto||null};$('#shoeForm').reset();$('#formError').hidden=true;$('#editorTitle').textContent=draft?'Edit pair':'Add a pair';$('#shoeId').value=draft?.shoeId||String(Math.max(0,...shoes.map(s=>/^\d+$/.test(s.shoeId)?Number(s.shoeId):0))+1);$('#shoeName').value=draft?.name||'';$('#category').value=draft?.category||'Other';$$('input[name="season"]').forEach(input=>input.checked=input.value===seasonOf(draft));$$('input[name="storageStatus"]').forEach(input=>input.checked=input.value===storageStatusOf(draft));$('#brand').value=draft?.brand||'';renderLocationOptions(draft?.location||'');$('#notes').value=draft?.notes||'';$('#reviewed').checked=draft?!!draft.reviewed:true;$('#archiveBtn').hidden=!draft;$('#archiveBtn').textContent=draft?.archived?'Restore pair':'Archive pair';cancelDrivePicker();for(const kind of ['shoe','box'])$('#'+kind+'DriveStatus').textContent='';renderPhotos();editorGuard.reset();showDialog($('#editor'));setTimeout(()=>$('#shoeName').focus(),30);}
function renderPhotos(){for(const kind of ['shoe','box']){$('#'+kind+'Preview').innerHTML=photos[kind]?photoHtml(photos[kind],kind+' photo',kind):'';$('#'+kind+'Picker').classList.toggle('has-photo',!!photos[kind]);$(`[data-remove="${kind}"]`).hidden=!photos[kind];}}
async function compress(file,maxDimension=1800){if(!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type))throw new Error('Please choose a JPG, PNG, WebP, or GIF photo.');if(file.size>20*1024*1024)throw new Error('Choose a photo smaller than 20 MB.');const bitmap=await createImageBitmap(file).catch(()=>{throw new Error('This image could not be opened. Try saving it as a JPG or PNG.')});const scale=Math.min(1,maxDimension/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);const ctx=canvas.getContext('2d');ctx.fillStyle='#f5f5ef';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();return await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.88));}
async function upload(file,maxDimension){const blob=await compress(file,maxDimension);return await api('/photos',{method:'POST',headers:{'Content-Type':blob.type},body:blob});}

let driveSession=null;
function cancelDrivePicker(){
  if(driveSession?.popup&&!driveSession.popup.closed)driveSession.popup.close();
  driveSession=null;
}
async function addPhotoFile(kind,file){
  if(busy)return;
  setBusy(true);
  $('#formError').hidden=true;
  $('#'+kind+'DriveStatus').textContent='Adding photo…';
  try{
    const previous=photos[kind];
    photos[kind]=await upload(file);
    pendingPhotoUploads.set(photos[kind].url,photos[kind]);
    retirePendingPhoto(previous);
    renderPhotos();
    $('#'+kind+'DriveStatus').textContent='Photo added. Save the pair to keep it.';
    toast('Photo added. Save the pair to keep this change.');
  }catch(reason){
    $('#'+kind+'DriveStatus').textContent=reason.message;
    formError(reason.message);
  }finally{setBusy(false);}
}
function openDrivePicker(kind){
  if(busy)return;
  cancelDrivePicker();
  const requestId=Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');
  const popup=window.open('/drive-import.html#'+requestId,'shoes-drive-picker','popup,width=900,height=760');
  if(!popup){formError('Allow pop-ups for this site, then choose Google Drive again.');return;}
  driveSession={popup,requestId,kind};
  $('#'+kind+'DriveStatus').textContent='Choose a photo in the Google Drive window.';
}
window.addEventListener('message',async event=>{
  if(!driveSession||!isDriveImportMessage(event,{origin:location.origin,...driveSession}))return;
  const kind=driveSession.kind;
  if(!$('#editor').open||busy){cancelDrivePicker();return;}
  const file=new File([event.data.image],event.data.name||'drive-photo',{type:event.data.image.type});
  cancelDrivePicker();
  await addPhotoFile(kind,file);
});
$('#editor').addEventListener('close',()=>{cancelDrivePicker();discardPendingUploads();});
for(const kind of ['shoe','box']){
  $('#'+kind+'Upload').onchange=async e=>{
    const file=e.target.files[0];
    if(file)await addPhotoFile(kind,file);
    e.target.value='';
  };
  const picker=$('#'+kind+'Picker');
  picker.addEventListener('dragover',e=>e.preventDefault());
  picker.addEventListener('drop',async e=>{
    e.preventDefault();
    const file=e.dataTransfer.files[0];
    if(file)await addPhotoFile(kind,file);
  });
  $('[data-drive-photo="'+kind+'"]').onclick=()=>openDrivePicker(kind);
  $('[data-remove="'+kind+'"]').onclick=async()=>{
    if(busy||!photos[kind])return;
    const previous=photos[kind];
    if(!await confirmAction('remove-photo',{title:'Remove this photo?',message:'Remove the '+kind+' photo from this pair? Save the pair to apply the removal.',button:'Remove photo'}))return;
    if(busy||photos[kind]!==previous)return;
    photos[kind]=null;retirePendingPhoto(previous);renderPhotos();
  };
}
function setBusy(value){
  busy=value;
  $$('#shoeForm input,#shoeForm select,#shoeForm textarea').forEach(input=>input.disabled=value);
  $('#saveBtn').disabled=value;
  $('#saveBtn').textContent=value?'Saving…':'Save pair';
  for(const selector of ['#shoeUpload','#boxUpload','#archiveBtn','#closeEditor','#cancelEditor','#manageLocations'])$(selector).disabled=value;
  $$('[data-drive-photo],[data-remove]').forEach(button=>button.disabled=value);
}

function formError(message){$('#formError').textContent=message;$('#formError').hidden=false;}
const editorGuard=attachEditorGuard($('#editor'),{
  readState:()=>({
    shoeId:$('#shoeId').value,name:$('#shoeName').value,category:$('#category').value,
    season:$('input[name="season"]:checked')?.value||'All-season',storageStatus:$('input[name="storageStatus"]:checked')?.value||'stored',brand:$('#brand').value,
    location:$('#location').value,notes:$('#notes').value,reviewed:$('#reviewed').checked,
    shoePhoto:photos.shoe,boxPhoto:photos.box
  }),
  isBusy:()=>busy,
  confirmDiscard:()=>window.confirm('Discard your unsaved changes to this pair? Choose Cancel to keep editing.')
});
function rememberSavedPair(shoe,previousId){shoes=shoes.filter(pair=>pair.id!==previousId&&pair.id!==shoe.id);shoes.push(shoe);}
$('#shoeForm').onsubmit=async e=>{
  e.preventDefault();if(busy)return;
  const original=draft;
  const record={shoeId:$('#shoeId').value.trim(),name:$('#shoeName').value.trim()||'Shoes',category:$('#category').value,season:$('input[name="season"]:checked')?.value||'All-season',storageStatus:$('input[name="storageStatus"]:checked')?.value||'stored',brand:$('#brand').value.trim(),location:$('#location').value.trim(),notes:$('#notes').value.trim(),reviewed:$('#reviewed').checked,shoePhoto:photos.shoe,boxPhoto:photos.box,archived:!!original?.archived};
  setBusy(true);$('#formError').hidden=true;
  try{
    const saved=await savePair(api,original,record);
    rememberSavedPair(saved.shoe,original?.id);
    setBusy(false);editorGuard.savedClose();render();
    toast(original?'Pair updated.':'A new pair, in its place.');
  }catch(e){formError(e.message);}
  finally{setBusy(false);}
};
const detailZoom={shoe:attachPhotoZoom($('#detailShoe')),box:attachPhotoZoom($('#detailBox'))};
$('#detail').addEventListener('close',()=>Object.values(detailZoom).forEach(zoom=>zoom.reset()));
function openDetail(id){selected=shoes.find(s=>s.id===id);if(!selected)return;$('#detailId').textContent='# '+selected.shoeId;$('#detailTitle').textContent=selected.name;$('#detailCategory').textContent=selected.category;$('#detailShoe').innerHTML=photoHtml(selected.shoePhoto,selected.name);$('#detailBox').innerHTML=photoHtml(selected.boxPhoto,'Box '+selected.shoeId,'box');detailZoom.shoe.refresh('Shoe photo: '+selected.name);detailZoom.box.refresh('Box photo: '+selected.shoeId);const date=value=>value?new Date(value).toLocaleString():'';
const details=[['Category',selected.category],['Season',seasonOf(selected)],['Brand',selected.brand],['Storage location',selected.location||'Not set'],['Storage status',storageLabel(selected)],['Match',selected.reviewed?'Confirmed':'Needs review'],['Collection',selected.archived?'Archived':'Active'],['Added',date(selected.createdAt)],['Updated',date(selected.updatedAt)]];
$('#detailMeta').innerHTML=details.filter(([,value])=>value).map(([label,value])=>`<div><dt>${label}</dt><dd>${label==='Season'?seasonIcon(seasonOf(selected)):label==='Storage location'?locationIcon(iconForLocation(locations,selected.location)):label==='Storage status'?storageIcon(storageStatusOf(selected)):''}${esc(value)}</dd></div>`).join('');
$('#detailNotes').textContent=selected.notes;$('#detailNotes').hidden=!selected.notes;$('#detailReview').textContent=selected.reviewed?'Shoe and box match confirmed.':'Check the shoe and box photo pairing before confirming.';$('#detailReview').hidden=!!selected.reviewed;$('#detailReviewBtn').hidden=!!selected.reviewed||!!selected.archived;$('#detailStorageBtn').innerHTML=storageIcon(storageStatusOf(selected)==='out'?'stored':'out')+(storageStatusOf(selected)==='out'?'Put back':'Take out');showDialog($('#detail'));detailResize.refresh();}
async function updateRecord(record,changes){const d=await savePair(api,record,{...record,...changes});rememberSavedPair(d.shoe,record.id);render();return d.shoe;}
$('#detailStorageBtn').onclick=async()=>{
  const original=selected;if(!original)return;
  const controls=['#detailStorageBtn','#detailEdit','#detailReviewBtn'].map($);
  if(controls[0].disabled)return;
  controls.forEach(button=>button.disabled=true);
  try{
    const storageStatus=storageStatusOf(original)==='out'?'stored':'out';
    const saved=await updateRecord(original,{storageStatus});
    if($('#detail').open&&selected?.id===original.id)openDetail(saved.id);
    toast(storageStatus==='out'?'Marked as taken out.':'Put back in storage.');
  }catch(error){toast(error.message);}
  finally{controls.forEach(button=>button.disabled=false);}
};
$('#detailReviewBtn').onclick=async()=>{const b=$('#detailReviewBtn');b.disabled=true;try{await updateRecord(selected,{reviewed:true});closeDialog($('#detail'));toast('Match confirmed.')}catch(e){toast(e.message)}finally{b.disabled=false}};
$('#archiveBtn').onclick=async()=>{if(!draft||busy||!editorGuard.mayDiscard())return;if(!draft.archived&&!await confirmArchive(draft))return;setBusy(true);try{const archived=!draft.archived;const saved=await updateRecord(draft,{archived});setBusy(false);editorGuard.savedClose();toast(archived?'Pair archived.':'Pair restored.',async()=>{try{if(!archived&&!await confirmArchive(saved))return;await updateRecord(saved,{archived:!archived});toast('Change undone.')}catch(e){toast(e.message)}})}catch(e){formError(e.message)}finally{setBusy(false)}};
$('#detailEdit').onclick=()=>{closeDialog($('#detail'));openEditor(selected.id)};$('#closeDetail').onclick=()=>closeDialog($('#detail'));for(const id of ['closeEditor','cancelEditor'])$('#'+id).onclick=()=>{if(!busy)closeDialog($('#editor'))};$('#addBtn').onclick=()=>openEditor();$$('.nav-item[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;filter='All pairs';seasonFilter='Any season';locationFilter='all';storageFilter='all';render()});$('#search').oninput=render;$('#sort').onchange=e=>{sort=e.target.value;render()};$('#gridBtn').onclick=()=>setView(false);$('#listBtn').onclick=()=>setView(true);function setView(list){$('#shoeGrid').classList.toggle('list-view',list);$('#gridBtn').classList.toggle('active',!list);$('#listBtn').classList.toggle('active',list);localStorage.setItem('shoeView',list?'list':'grid')}setView(localStorage.getItem('shoeView')==='list');document.addEventListener('keydown',e=>{if(e.key==='/'&&!/input|textarea|select/i.test(e.target.tagName)&&!$('dialog[open]')){e.preventDefault();$('#search').focus()}});$('#dismissBanner').onclick=()=>{sessionStorage.setItem('hidePhotoTip','1');$('#sourceBanner').hidden=true};$('#collageBtn').onclick=()=>showDialog($('#collageDialog'));$('#closeCollage').onclick=()=>{if(!busy)closeDialog($('#collageDialog'))};
$('#collageUpload').onchange=async e=>{const file=e.target.files[0];if(!file||busy)return;let uploaded=null;busy=true;e.target.disabled=true;$('#collageStatus').textContent='Adding the collage to your starter pairs…';try{const pic=await createImageBitmap(file);const ratio=pic.width/pic.height;pic.close();if(Math.abs(ratio-2048/976)>.09)throw new Error('This layout does not match the shared collage. Choose the same wide image, or add individual photos in each pair.');const photo=uploaded=await upload(file,2400);const d=await api('/collage',{method:'POST',body:JSON.stringify({photo})});shoes=d.shoes;render();closeDialog($('#collageDialog'));toast('Collage added. Review each shoe and box pairing.');}catch(e){$('#collageStatus').textContent=e.message}finally{if(uploaded)void deleteUnused([uploaded]);busy=false;e.target.disabled=false;e.target.value=''}};
function downloadJSON(data,name){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$('#backupBtn').onclick=async()=>{const b=$('#backupBtn');b.disabled=true;toast('Preparing your backup, including photos…');try{const current=await api('/shoes');const snapshot=structuredClone(current.shoes),locationChoices=current.locations.map(({name,icon})=>({name,icon})),urls=[...new Set(snapshot.flatMap(s=>[s.shoePhoto?.url,s.boxPhoto?.url]).filter(Boolean))],images={};for(const url of urls){const r=await fetch(url);if(!r.ok)throw new Error('A photo could not be included. Please try again.');const blob=await r.blob();images[url]=await new Promise((resolve,reject)=>{const f=new FileReader();f.onload=()=>resolve(f.result);f.onerror=reject;f.readAsDataURL(blob)})}downloadJSON({format:'shoes-backup',version:1,exportedAt:new Date().toISOString(),shoes:snapshot,locations:locationChoices,images},'shoes-backup-'+new Date().toISOString().slice(0,10)+'.json');toast('Backup downloaded, with photos.')}catch(e){toast(e.message)}finally{b.disabled=false}};
$('#restoreBtn').onclick=()=>$('#backupFile').click();$('#backupFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;const b=$('#restoreBtn');b.disabled=true;const uploads=[];try{if(file.size>100*1024*1024)throw new Error('This backup is too large. Choose one under 100 MB.');const backup=JSON.parse(await file.text());if(backup.format!=='shoes-backup'||backup.version!==1||!Array.isArray(backup.shoes))throw new Error('Choose a backup exported by this shoe app.');const conflicts=backup.shoes.filter(s=>shoes.some(t=>t.shoeId.toLowerCase()===String(s.shoeId).toLowerCase()));const overwrite=conflicts.length>0;if(overwrite&&!window.confirm('This backup contains '+conflicts.length+' existing IDs. Restore will replace those pairs with the backup versions and keep other pairs. Continue?'))return;const mapping={};for(const [old,data] of Object.entries(backup.images||{})){if(!/^data:image\/(jpeg|png|webp|gif);base64,/.test(data))throw new Error('Backup contains an unsupported image.');const blob=await(await fetch(data)).blob();mapping[old]=await api('/photos',{method:'POST',headers:{'Content-Type':blob.type},body:blob});uploads.push(mapping[old])}const records=backup.shoes.map(s=>{const copy={...s};for(const key of ['shoePhoto','boxPhoto']){if(copy[key]?.url){if(!mapping[copy[key].url])throw new Error('The backup is missing a photo.');copy[key]={...copy[key],url:mapping[copy[key].url].url}}}return copy});const d=await api('/import',{method:'POST',body:JSON.stringify({shoes:records,locations:backup.locations,overwrite})});shoes=d.shoes;locations=d.locations||[];render();toast('Backup restored.')}catch(e){toast(e.message)}finally{void deleteUnused(uploads);b.disabled=false;e.target.value=''}};
let iconPickerTarget=null;
function iconChoiceButton(id='pin'){
  return `<button type="button" class="icon-picker-trigger" data-pick-location-icon data-location-icon="${esc(id)}" aria-label="Change location icon: ${locationIconLabel(id)}" title="Change icon: ${locationIconLabel(id)}">${locationIcon(id)}</button>`;
}
function setIconChoice(button,id){
  button.dataset.locationIcon=id;button.innerHTML=locationIcon(id);
  button.setAttribute('aria-label','Change location icon: '+locationIconLabel(id));
  button.title='Change icon: '+locationIconLabel(id);
}
function openIconPicker(button){
  if(locationsBusy)return;
  iconPickerTarget=button;
  $('#locationIconGrid').innerHTML=LOCATION_ICONS.map(item=>`<button type="button" data-icon-choice="${item.id}" class="location-icon-choice" aria-label="${item.label}" aria-pressed="${item.id===button.dataset.locationIcon}">${locationIcon(item.id)}</button>`).join('');
  $$('[data-icon-choice]').forEach(choice=>choice.onclick=()=>{
    if(iconPickerTarget?.isConnected)setIconChoice(iconPickerTarget,choice.dataset.iconChoice);
    closeDialog($('#locationIconsDialog'));
  });
  showDialog($('#locationIconsDialog'));
  $('#locationIconGrid [aria-pressed="true"]')?.focus();
}
function refreshSelectedLocationIcon(){
  $('#selectedLocationIcon').innerHTML=$('#location').value?locationIcon(iconForLocation(locations,$('#location').value)):'';
}
$('#location').addEventListener('change',refreshSelectedLocationIcon);
$('#newLocationIcon').onclick=()=>openIconPicker($('#newLocationIcon'));
setIconChoice($('#newLocationIcon'),'pin');
$('#closeLocationIcons').onclick=()=>closeDialog($('#locationIconsDialog'));
$('#locationIconsDialog').addEventListener('close',()=>iconPickerTarget=null);
function renderLocationOptions(value=''){
  const names=locations.map(item=>item.name);
  const match=names.find(name=>name.toLowerCase()===value.toLowerCase());
  if(value&&!match)names.push(value);
  $('#location').innerHTML='<option value="">Not set</option>'+names.map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join('');
  $('#location').value=match||value;refreshSelectedLocationIcon();
}
function setLocationsBusy(value){
  locationsBusy=value;
  $$('#locationsDialog input,#locationsDialog button').forEach(control=>control.disabled=value||control.dataset.inUse==='true');
}
function renderLocations(){
  $('#locationList').innerHTML=locations.length?locations.map(item=>`
    <form class="location-row" data-location="${item.id}" data-revision="${item.revision}">
      ${iconChoiceButton(item.icon)}
      <label><span class="sr-only">Location name</span><input name="name" aria-label="Rename ${esc(item.name)}" value="${esc(item.name)}" required maxlength="120" autocomplete="off"><small>${item.count} ${item.count===1?'pair':'pairs'}</small></label>
      <button type="submit" class="secondary">Save</button>
      <button type="button" class="text-btn danger" data-delete-location="${item.id}" data-in-use="${item.count>0}" ${item.count?'disabled title="Move all pairs out of this location before deleting it."':''}>Delete</button>
    </form>`).join(''):'<p class="locations-empty">No locations yet. Add your first storage place above.</p>';
  $$('#locationList [data-pick-location-icon]').forEach(button=>button.onclick=()=>openIconPicker(button));
  $$('#locationList form').forEach(form=>form.onsubmit=async event=>{
    event.preventDefault();
    const item=locations.find(item=>item.id===form.dataset.location);
    await mutateLocation('/'+item.id,'PUT',{name:form.elements.name.value,icon:form.querySelector('[data-pick-location-icon]').dataset.locationIcon,revision:Number(form.dataset.revision)});
  });
  $$('[data-delete-location]').forEach(button=>button.onclick=async()=>{
    const item=locations.find(item=>item.id===button.dataset.deleteLocation);
    if(locationsBusy||!await confirmAction('delete-location',{title:'Delete this location?',message:'Delete '+item.name+' from your location choices? This cannot be undone.',button:'Delete location'}))return;
    await mutateLocation('/'+item.id,'DELETE',{revision:item.revision});
  });
}
function locationError(message){$('#locationError').textContent=message;$('#locationError').hidden=!message;}
function locationRowsInForm(){
  return $$('#locationList .location-row').map(form=>({
    id:form.dataset.location,name:form.elements.name.value,
    icon:form.querySelector('[data-pick-location-icon]').dataset.locationIcon
  })).sort((a,b)=>a.id.localeCompare(b.id));
}
function savedLocationsState(){
  return {newName:'',newIcon:'pin',rows:locations.map(({id,name,icon})=>({id,name,icon:icon||'pin'})).sort((a,b)=>a.id.localeCompare(b.id))};
}
const locationsGuard=attachEditorGuard($('#locationsDialog'),{
  readState:()=>({newName:$('#newLocation').value,newIcon:$('#newLocationIcon').dataset.locationIcon,rows:locationRowsInForm()}),
  isBusy:()=>locationsBusy,
  confirmDiscard:()=>window.confirm('Discard your unsaved location changes? Choose Cancel to keep editing.')
});
async function openLocations(){
  if(busy||locationsBusy)return;
  $('#addLocationForm').reset();setIconChoice($('#newLocationIcon'),'pin');locationError('');renderLocations();locationsGuard.reset();showDialog($('#locationsDialog'));setLocationsBusy(true);
  try{const data=await api('/locations');locations=data.locations;renderLocations();locationsGuard.reset();}
  catch(error){locationError(error.message);}
  finally{setLocationsBusy(false);}
}
async function mutateLocation(path,method,input){
  if(locationsBusy)return;
  const pendingRows=locationRowsInForm().filter(row=>{
    const saved=locations.find(item=>item.id===row.id);
    return row.id!==path.slice(1)&&saved&&(row.name!==saved.name||row.icon!==(saved.icon||'pin'));
  }).map(row=>({...row,revision:$('#locationList [data-location="'+row.id+'"]').dataset.revision}));
  setLocationsBusy(true);locationError('');
  try{
    const data=await api('/locations'+path,{method,body:JSON.stringify(input)});
    let chosen=$('#location').value;
    if(data.renamed){
      const {from,to}=data.renamed;
      if(chosen.toLowerCase()===from.toLowerCase())chosen=to;
      editorGuard.renameLocation(from,to);
      const update=data.updates.find(item=>item.id===draft?.id);
      const fresh=data.shoes.find(item=>item.id===draft?.id);
      // Advance the editor's revision only when this rename is its sole intervening change.
      if(update&&draft.revision===update.previousRevision&&fresh?.revision===update.previousRevision+1){
        draft={...draft,location:fresh.location,revision:fresh.revision,updatedAt:fresh.updatedAt};
      }
    }
    locations=data.locations;shoes=data.shoes;
    if(!locations.some(item=>item.name.toLowerCase()===chosen.toLowerCase()))chosen='';
    renderLocationOptions(chosen);renderLocations();render();
    for(const pending of pendingRows){
      const form=$('#locationList [data-location="'+pending.id+'"]');
      if(form){form.elements.name.value=pending.name;setIconChoice(form.querySelector('[data-pick-location-icon]'),pending.icon);form.dataset.revision=pending.revision;}
    }
    if(method==='POST'){$('#newLocation').value='';setIconChoice($('#newLocationIcon'),'pin');}
    locationsGuard.reset(savedLocationsState());
    toast(method==='POST'?'Location added.':method==='PUT'?'Location updated.':'Location deleted.');
  }catch(error){locationError(error.message);}
  finally{setLocationsBusy(false);}
}
$('#locationsBtn').onclick=openLocations;
$('#manageLocations').onclick=openLocations;
$('#closeLocations').onclick=()=>closeDialog($('#locationsDialog'));
$('#addLocationForm').onsubmit=async event=>{
  event.preventDefault();await mutateLocation('','POST',{name:$('#newLocation').value,icon:$('#newLocationIcon').dataset.locationIcon});
};
load();
