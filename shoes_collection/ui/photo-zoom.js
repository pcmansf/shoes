const clamp=value=>Math.max(0,Math.min(1,value));

export function fitPhoto(width,height,imageWidth,imageHeight){
  if(![width,height,imageWidth,imageHeight].every(n=>Number.isFinite(n)&&n>0))return null;
  const scale=Math.min(width/imageWidth,height/imageHeight);
  const w=imageWidth*scale,h=imageHeight*scale;
  return {width:w,height:h,left:(width-w)/2,top:(height-h)/2};
}

export function zoomPhoto(width,height,fit,x,y,scale=2.5){
  // Keep short dimensions centered. Pan long dimensions all the way to each
  // edge, accounting for the margins around a contained portrait/landscape.
  const w=fit.width*scale,h=fit.height*scale;
  const left=w<=width?(width-w)/2:-(w-width)*clamp(x);
  const top=h<=height?(height-h)/2:-(h-height)*clamp(y);
  return {scale,x:left-fit.left*scale,y:top-fit.top*scale};
}

export function attachPhotoZoom(container){
  let pointer=null,keyboard=false,x=.5,y=.5;
  const image=()=>container.querySelector('.photo-view');
  function geometry(photo){
    const rect=container.getBoundingClientRect();
    const size=photo.localName==='svg'?photo.viewBox.baseVal:{width:photo.naturalWidth,height:photo.naturalHeight};
    return {rect,fit:fitPhoto(rect.width,rect.height,size.width,size.height)};
  }
  function draw(){
    const photo=image();
    if(!photo){container.classList.remove('is-zoomed');return;}
    if(!pointer&&!keyboard){photo.style.transform='';container.classList.remove('is-zoomed');return;}
    const {rect,fit}=geometry(photo);
    if(!fit)return;
    if(pointer){
      x=clamp((pointer.x-rect.left-fit.left)/fit.width);
      y=clamp((pointer.y-rect.top-fit.top)/fit.height);
    }
    const transform=zoomPhoto(rect.width,rect.height,fit,x,y);
    photo.style.transform=`matrix(${transform.scale},0,0,${transform.scale},${transform.x},${transform.y})`;
    container.classList.add('is-zoomed');
  }
  function reset(){pointer=null;keyboard=false;x=.5;y=.5;draw();}
  function point(event){
    if(event.pointerType!=='mouse')return;
    pointer={x:event.clientX,y:event.clientY};keyboard=false;draw();
  }
  container.addEventListener('pointerenter',point);
  container.addEventListener('pointermove',point);
  container.addEventListener('pointerleave',()=>{pointer=null;draw();});
  container.addEventListener('pointercancel',reset);
  container.addEventListener('load',draw,true);
  container.addEventListener('focus',()=>{
    if(container.matches(':focus-visible')){keyboard=true;x=.5;y=.5;draw();}
  });
  container.addEventListener('blur',()=>{keyboard=false;draw();});
  container.addEventListener('keydown',event=>{
    if(!image())return;
    if(event.key==='Escape'&&(keyboard||pointer)){
      event.preventDefault();event.stopPropagation();reset();return;
    }
    if(['Enter',' ','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){
      event.preventDefault();pointer=null;keyboard=true;
      x=clamp(x+(event.key==='ArrowRight'?.1:event.key==='ArrowLeft'?-.1:0));
      y=clamp(y+(event.key==='ArrowDown'?.1:event.key==='ArrowUp'?-.1:0));
      draw();
    }
  });
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(draw).observe(container);
  return {
    reset,
    refresh(label){
      reset();
      const available=!!image();
      container.classList.toggle('zoomable',available);
      container.tabIndex=available?0:-1;
      container.setAttribute('role','group');
      container.setAttribute('aria-label',label);
      if(available)container.setAttribute('aria-describedby','photoZoomHelp');
      else container.removeAttribute('aria-describedby');
    }
  };
}
