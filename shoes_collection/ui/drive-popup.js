import {DRIVE_SCOPE,DRIVE_IMAGE_TYPES,driveOriginSupported,downloadDriveImage} from './drive-common.js';
const status=document.querySelector('#driveStatus');
const choose=document.querySelector('#chooseDrive');
const requestId=location.hash.slice(1);
let tokenClient,accessToken='',picker,working=false;
function message(text,error=false){status.textContent=text;status.classList.toggle('error',error);}
function close(){accessToken='';if(picker)picker.setVisible(false);window.close();}
document.querySelector('#cancelDrive').onclick=close;
document.querySelector('#closeTop').onclick=event=>{event.preventDefault();close();};
window.addEventListener('pagehide',()=>{accessToken='';});

function loadScript(src){
  return new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    const timeout=setTimeout(()=>reject(new Error('Google could not be loaded. Check your connection and reopen this window.')),15000);
    script.src=src;script.async=true;
    script.onload=()=>{clearTimeout(timeout);resolve();};
    script.onerror=()=>{clearTimeout(timeout);reject(new Error('Google could not be loaded. Check your connection and browser settings.'));};
    document.head.appendChild(script);
  });
}

async function picked(data){
  if(data.action===google.picker.Action.CANCEL){
    accessToken='';
    message('No photo selected. You can choose another image or close this window.');
    choose.disabled=false;
    return;
  }
  if(data.action!==google.picker.Action.PICKED||working)return;
  const doc=data.docs?.[0];
  if(!doc)return;
  working=true;choose.disabled=true;
  message('Downloading your selected photo…');
  try{
    const selected=await downloadDriveImage(accessToken,doc);
    if(!window.opener||window.opener.closed)throw new Error('The shoe editor was closed. Open it and choose your photo again.');
    window.opener.postMessage({type:'shoes-drive-image',requestId,...selected},location.origin);
    accessToken='';
    message('Photo sent to your shoe editor. Save the pair to keep it.');
    // The parent closes this window after accepting the matching selection.
  }catch(error){
    working=false;choose.disabled=false;
    message(error.name==='TimeoutError'?'Google Drive took too long to respond. Please try again.':error.message,true);
  }
}

async function boot(){
  if(!window.opener||!/^[a-f0-9]{32}$/.test(requestId)){
    message('Open this window using Choose from Google Drive in the shoe editor.',true);
    return;
  }
  const response=await fetch('/api/drive/config',{cache:'no-store'});
  if(!response.ok)throw new Error('Could not read the Drive configuration. Reopen the shoe app and sign in.');
  const config=await response.json();
  if(!config.configured){
    document.querySelector('#setupNotice').hidden=false;
    message(config.error||'Google Drive has not been configured for this app yet.');
    return;
  }
  if(!driveOriginSupported(location.origin)){
    document.querySelector('#originNotice').hidden=false;
    message('Google requires HTTPS, except for localhost testing.',true);
    return;
  }
  await Promise.all([
    loadScript('https://accounts.google.com/gsi/client'),
    loadScript('https://apis.google.com/js/api.js')
  ]);
  await new Promise((resolve,reject)=>gapi.load('picker',{
    callback:resolve,onerror:()=>reject(new Error('Google Drive picker could not load.')),
    timeout:15000,ontimeout:()=>reject(new Error('Google Drive picker timed out.'))
  }));
  tokenClient=google.accounts.oauth2.initTokenClient({
    client_id:config.clientId,
    scope:DRIVE_SCOPE,
    include_granted_scopes:false,
    callback:token=>{
      if(token.error||!token.access_token){
        message('Google sign-in was not completed. Try again when ready.',true);
        choose.disabled=false;return;
      }
      if(!google.accounts.oauth2.hasGrantedAllScopes(token,DRIVE_SCOPE)){
        message('Allow access to the files you select to import a Drive photo.',true);
        choose.disabled=false;return;
      }
      try{
      accessToken=token.access_token;
      const view=new google.picker.DocsView(google.picker.ViewId.DOCS)
        .setIncludeFolders(true).setSelectFolderEnabled(false)
        .setMimeTypes(DRIVE_IMAGE_TYPES.join(','));
      picker=new google.picker.PickerBuilder()
        .setAppId(config.appId).setDeveloperKey(config.apiKey)
        .setOAuthToken(accessToken).setOrigin(location.origin)
        .addView(view).setTitle('Choose a shoe or box photo')
        .setCallback(picked).build();
      picker.setVisible(true);
      message('Choose a photo from your Drive.');
      }catch{
        accessToken='';choose.disabled=false;
        message('The Drive picker could not open. Check the Google configuration and try again.',true);
      }
    },
    error_callback:()=>{
      accessToken='';
      message('The sign-in window was closed or blocked. Allow pop-ups for this site and try again.',true);
      choose.disabled=false;
    }
  });
  choose.onclick=()=>{
    if(working)return;
    choose.disabled=true;
    message('Waiting for Google sign-in…');
    try{tokenClient.requestAccessToken({prompt:'select_account'});}
    catch{choose.disabled=false;message('Google sign-in could not open. Allow pop-ups and try again.',true);}
  };
  choose.disabled=false;
  message('Ready. Sign in to select a JPG, PNG, WebP or GIF photo.');
}
boot().catch(error=>message(error.message,true));
