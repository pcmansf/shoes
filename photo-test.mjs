import assert from 'node:assert/strict';
import {fitPhoto,zoomPhoto,attachPhotoZoom} from './ui/photo-zoom.js';

const near=(actual,expected)=>assert(Math.abs(actual-expected)<.000001,`${actual} != ${expected}`);
for(const [width,height,imageWidth,imageHeight] of [
  [317,260,1080,2400], // tall boot photo
  [317,260,2400,1080], // wide box photo
  [150,190,1080,1920], // phone-sized detail panel
  [317,260,91,149],    // original collage crop
  [260,260,800,800]
]){
  const fit=fitPhoto(width,height,imageWidth,imageHeight);
  assert(fit.width<=width&&fit.height<=height);
  near(fit.width/fit.height,imageWidth/imageHeight);
  near(fit.left*2+fit.width,width);
  near(fit.top*2+fit.height,height);
  for(const position of [0,.5,1]){
    const zoom=zoomPhoto(width,height,fit,position,position);
    const left=fit.left*zoom.scale+zoom.x,top=fit.top*zoom.scale+zoom.y;
    const w=fit.width*zoom.scale,h=fit.height*zoom.scale;
    if(w<=width)near(left,(width-w)/2);
    else{assert(left<=.000001&&left+w>=width-.000001);if(position===0)near(left,0);if(position===1)near(left+w,width);}
    if(h<=height)near(top,(height-h)/2);
    else{assert(top<=.000001&&top+h>=height-.000001);if(position===0)near(top,0);if(position===1)near(top+h,height);}
  }
}
assert.equal(fitPhoto(0,260,1080,1920),null);
assert.equal(fitPhoto(317,260,0,0),null);
console.log('PASS: full-image fit and edge-to-edge hover panning for portrait, landscape, square, mobile, and collage dimensions.');

// Exercise the browser controller with pointer/focus events, without requiring
// a browser or third-party dependencies on the Pi.
const events=new Map(),classes=new Set(),attributes=new Map();
let photo={localName:'img',naturalWidth:1080,naturalHeight:2400,style:{transform:''}};
let keyboardFocus=false;
const container={
  querySelector:()=>photo,
  getBoundingClientRect:()=>({left:100,top:50,width:317,height:260}),
  classList:{add:name=>classes.add(name),remove:name=>classes.delete(name),toggle:(name,value)=>value?classes.add(name):classes.delete(name)},
  addEventListener:(type,handler)=>events.set(type,handler),
  matches:()=>keyboardFocus,
  setAttribute:(name,value)=>attributes.set(name,value),
  removeAttribute:name=>attributes.delete(name)
};
const zoom=attachPhotoZoom(container);
zoom.refresh('Shoe photo');
assert.equal(container.tabIndex,0);
events.get('pointerenter')({pointerType:'mouse',clientX:258.5,clientY:180});
assert(classes.has('is-zoomed'));
assert.match(photo.style.transform,/^matrix\(2\.5,/);
const centered=photo.style.transform;
events.get('pointermove')({pointerType:'mouse',clientX:300,clientY:300});
assert.notEqual(photo.style.transform,centered);
events.get('pointerleave')();
assert.equal(photo.style.transform,'');
assert(!classes.has('is-zoomed'));
events.get('pointerenter')({pointerType:'touch',clientX:258.5,clientY:180});
assert.equal(photo.style.transform,'','touch scrolling must not trigger hover zoom');
keyboardFocus=true;
events.get('focus')();
assert(classes.has('is-zoomed'));
events.get('keydown')({key:'ArrowDown',preventDefault(){}});
assert.notEqual(photo.style.transform,centered);
let escaped=false;
events.get('keydown')({key:'Escape',preventDefault(){},stopPropagation(){escaped=true;}});
assert(escaped);
assert.equal(photo.style.transform,'');
photo={localName:'svg',viewBox:{baseVal:{width:91,height:149}},style:{transform:''}};
zoom.refresh('Collage photo');
events.get('pointerenter')({pointerType:'mouse',clientX:258.5,clientY:180});
assert.match(photo.style.transform,/^matrix\(2\.5,/);
zoom.reset();
assert.equal(photo.style.transform,'');
photo=null;
zoom.refresh('No photo');
assert.equal(container.tabIndex,-1);
assert(!classes.has('zoomable'));
assert(!classes.has('is-zoomed'));
console.log('PASS: hover starts zoom without a click; leaving, Escape, and switching photos reset it; touch and empty placeholders stay unchanged.');
