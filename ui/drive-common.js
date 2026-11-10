export const DRIVE_SCOPE='https://www.googleapis.com/auth/drive.file';
export const MAX_DRIVE_BYTES=20*1024*1024;
export const DRIVE_IMAGE_TYPES=['image/jpeg','image/png','image/webp','image/gif'];

export function driveOriginSupported(value){
  try{
    const url=new URL(value);
    return url.protocol==='https:'||
      (url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname));
  }catch{return false;}
}

export function isDriveImportMessage(event,{origin,popup,requestId}){
  return event.origin===origin&&event.source===popup&&
    event.data?.type==='shoes-drive-image'&&event.data.requestId===requestId&&
    event.data.image instanceof Blob&&DRIVE_IMAGE_TYPES.includes(event.data.image.type)&&
    event.data.image.size>0&&event.data.image.size<=MAX_DRIVE_BYTES&&
    typeof event.data.name==='string'&&event.data.name.length<=1000;
}

export async function downloadDriveImage(token,selection,fetcher=fetch){
  if(!token||typeof selection?.id!=='string'||!/^[A-Za-z0-9_-]{10,200}$/.test(selection.id)){
    throw new Error('Choose an image from Google Drive again.');
  }
  const endpoint='https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(selection.id);
  const headers={Authorization:'Bearer '+token};
  if(selection.resourceKey){
    if(!/^[A-Za-z0-9_-]+$/.test(selection.resourceKey))throw new Error('This Drive resource key is invalid.');
    headers['X-Goog-Drive-Resource-Keys']=selection.id+'/'+selection.resourceKey;
  }
  const signal=AbortSignal.timeout(30000);
  async function get(url){
    const response=await fetcher(url,{headers,signal,credentials:'omit',referrerPolicy:'no-referrer'});
    if(!response.ok){
      if(response.status===401)throw new Error('Your Google session expired. Sign in and select the image again.');
      if(response.status===403)throw new Error('Google Drive did not allow this download. Check the file permissions or select another image.');
      throw new Error('Google Drive could not provide that image. Please try again.');
    }
    return response;
  }
  const metadata=await(await get(endpoint+'?fields=id,name,mimeType,size,capabilities(canDownload)&supportsAllDrives=true')).json();
  if(metadata.capabilities?.canDownload===false)throw new Error('Downloading is disabled for this Drive file.');
  if(!DRIVE_IMAGE_TYPES.includes(metadata.mimeType))throw new Error('Choose a JPG, PNG, WebP or GIF image. Convert HEIC to JPG first.');
  if(Number(metadata.size)>MAX_DRIVE_BYTES)throw new Error('Choose an image smaller than 20 MB.');
  const response=await get(endpoint+'?alt=media&supportsAllDrives=true');
  if(Number(response.headers.get('content-length'))>MAX_DRIVE_BYTES)throw new Error('Choose an image smaller than 20 MB.');
  const chunks=[];
  let size=0;
  const reader=response.body.getReader();
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>MAX_DRIVE_BYTES)throw new Error('Choose an image smaller than 20 MB.');
      chunks.push(value);
    }
  }catch(error){await reader.cancel().catch(()=>{});throw error;}
  if(!size)throw new Error('This Drive image is empty.');
  return {image:new Blob(chunks,{type:metadata.mimeType}),name:metadata.name||'drive-photo'};
}
