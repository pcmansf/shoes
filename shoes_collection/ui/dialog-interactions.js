const outside=(event,rect)=>event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom;

export function attachBackdropClose(dialog,close){
  let press=null;
  dialog.addEventListener('pointerdown',event=>{
    press=event.button===0&&event.isPrimary!==false&&event.target===dialog&&outside(event,dialog.getBoundingClientRect())
      ? {id:event.pointerId,x:event.clientX,y:event.clientY}:null;
  });
  dialog.addEventListener('pointerup',event=>{
    const start=press;press=null;
    if(start&&event.pointerId===start.id&&event.target===dialog&&outside(event,dialog.getBoundingClientRect())
      &&Math.hypot(event.clientX-start.x,event.clientY-start.y)<6)close(dialog);
  });
  dialog.addEventListener('pointercancel',()=>press=null);
  dialog.addEventListener('close',()=>press=null);
}

export function attachShoeCard(card,{preview,edit}){
  card.addEventListener('click',event=>{
    const button=event.target.closest?.('[data-edit]');
    if(button&&card.contains(button)){
      event.preventDefault();event.stopPropagation();edit(button.dataset.edit);return;
    }
    preview(card.dataset.id);
  });
  card.addEventListener('keydown',event=>{
    if(event.target===card&&(event.key==='Enter'||event.key===' ')){
      event.preventDefault();preview(card.dataset.id);
    }
  });
}

export function fitDialogRect(rect,viewport){
  const gap=12,maxWidth=Math.max(1,viewport.width-gap*2),maxHeight=Math.max(1,viewport.height-gap*2);
  const width=Math.min(maxWidth,Math.max(Math.min(480,maxWidth),rect.width));
  const height=Math.min(maxHeight,Math.max(Math.min(380,maxHeight),rect.height));
  return {left:Math.max(gap,Math.min(rect.left,viewport.width-gap-width)),top:Math.max(gap,Math.min(rect.top,viewport.height-gap-height)),width,height};
}

export function attachDialogResize(dialog,handle,{windowTarget=window}={}){
  let drag=null;
  const viewport=()=>({width:windowTarget.innerWidth,height:windowTarget.innerHeight});
  function paint(rect){
    const {left,top,width,height}=fitDialogRect(rect,viewport());
    Object.assign(dialog.style,{position:'fixed',margin:'0',left:left+'px',top:top+'px',width:width+'px',height:height+'px'});
  }
  function finish(){
    const id=drag?.id;drag=null;
    dialog.classList.remove('is-resizing');
    if(id!==undefined&&handle.hasPointerCapture?.(id))handle.releasePointerCapture(id);
  }
  function sized(rect,dx,dy){
    // Keep the top-left corner stationary while dragging the lower-right handle.
    const size=viewport();
    return {...rect,width:Math.min(rect.width+dx,size.width-12-rect.left),height:Math.min(rect.height+dy,size.height-12-rect.top)};
  }
  handle.addEventListener('pointerdown',event=>{
    if(event.button!==0||event.isPrimary===false)return;
    event.preventDefault();event.stopPropagation();
    paint(dialog.getBoundingClientRect());
    const rect=dialog.getBoundingClientRect();
    drag={id:event.pointerId,x:event.clientX,y:event.clientY,rect};
    handle.setPointerCapture(event.pointerId);dialog.classList.add('is-resizing');
  });
  handle.addEventListener('pointermove',event=>{
    if(!drag||event.pointerId!==drag.id)return;
    event.preventDefault();paint(sized(drag.rect,event.clientX-drag.x,event.clientY-drag.y));
  });
  handle.addEventListener('pointerup',event=>{
    if(event.pointerId!==drag?.id)return;
    event.preventDefault();event.stopPropagation();finish();
  });
  handle.addEventListener('pointercancel',finish);
  handle.addEventListener('lostpointercapture',finish);
  handle.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();});
  handle.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
    event.preventDefault();event.stopPropagation();
    const step=event.shiftKey?64:24;
    paint(sized(dialog.getBoundingClientRect(),event.key==='ArrowRight'?step:event.key==='ArrowLeft'?-step:0,event.key==='ArrowDown'?step:event.key==='ArrowUp'?-step:0));
  });
  dialog.addEventListener('close',finish);
  windowTarget.addEventListener('resize',()=>{if(dialog.open){finish();paint(dialog.getBoundingClientRect());}});
  return {refresh(){if(dialog.open)paint(dialog.getBoundingClientRect());}};
}
