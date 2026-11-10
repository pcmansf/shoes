import assert from 'node:assert/strict';
import {attachBackdropClose,attachDialogResize,attachShoeCard,fitDialogRect} from './ui/dialog-interactions.js';
import {attachEditorGuard} from './ui/editor-guard.js';
import {LOCATION_ICONS,locationIcon,iconForLocation} from './ui/location-icons.js';

class Element extends EventTarget{
  style={};dataset={};captured=null;open=true;
  classList={add(){},remove(){}};
  getBoundingClientRect(){
    const left=parseFloat(this.style.left)||100,top=parseFloat(this.style.top)||100;
    const width=parseFloat(this.style.width)||600,height=parseFloat(this.style.height)||500;
    return {left,top,width,height,right:left+width,bottom:top+height};
  }
  close(){this.open=false;this.dispatchEvent(new Event('close'));}
  setPointerCapture(id){this.captured=id;}
  hasPointerCapture(id){return this.captured===id;}
  releasePointerCapture(){this.captured=null;}
}
function send(target,type,properties={}){
  const event=new Event(type,{cancelable:true});
  for(const [key,value] of Object.entries(properties))Object.defineProperty(event,key,{value});
  target.dispatchEvent(event);return event;
}
const point=(x,y,extra={})=>({clientX:x,clientY:y,button:0,pointerId:1,isPrimary:true,...extra});
const win=new EventTarget();win.innerWidth=1200;win.innerHeight=900;
const dialog=new Element(),handle=new Element();let closed=0;
attachBackdropClose(dialog,()=>{closed++;dialog.close();});
const resize=attachDialogResize(dialog,handle,{windowTarget:win});
resize.refresh();
// Original regression: start inside, finish outside changed bounds, followed by a click.
send(dialog,'pointerdown',point(695,595));
send(dialog,'pointerup',point(800,700));send(dialog,'click',point(800,700));
assert.equal(closed,0);assert(dialog.open);
send(handle,'pointerdown',point(695,595));assert.equal(handle.captured,1);
send(handle,'pointermove',point(895,745));
assert.equal(dialog.getBoundingClientRect().width,800);assert.equal(dialog.getBoundingClientRect().height,650);
assert.equal(dialog.getBoundingClientRect().left,100);assert.equal(dialog.getBoundingClientRect().top,100);
send(handle,'pointerup',point(895,745));send(handle,'click',point(895,745));
assert.equal(handle.captured,null);assert(dialog.open);assert.equal(closed,0);
send(handle,'pointerdown',point(895,745));send(handle,'pointermove',point(520,400));send(handle,'pointerup',point(520,400));
assert.equal(dialog.getBoundingClientRect().width,480);assert.equal(dialog.getBoundingClientRect().height,380);assert(dialog.open);
send(handle,'keydown',{key:'ArrowRight',shiftKey:true});assert.equal(dialog.getBoundingClientRect().width,544);
send(handle,'pointerdown',point(640,475));send(handle,'pointermove',point(4000,3000));send(handle,'pointercancel');
assert.equal(handle.captured,null);assert(dialog.getBoundingClientRect().right<=1188);assert(dialog.getBoundingClientRect().bottom<=888);
win.innerWidth=390;win.innerHeight=640;win.dispatchEvent(new Event('resize'));
const mobile=dialog.getBoundingClientRect();assert(mobile.left>=12&&mobile.right<=378&&mobile.bottom<=628);
assert(dialog.open);assert.equal(closed,0);
const extreme=fitDialogRect({left:900,top:500,width:2000,height:1500},{width:320,height:240});
assert.deepEqual(extreme,{left:12,top:12,width:296,height:216});
// Drags and canceled/mismatched pointers are never outside clicks.
send(dialog,'pointerdown',point(1,1));send(dialog,'pointerup',point(1,50));assert.equal(closed,0);
send(dialog,'pointerdown',point(1,1));send(dialog,'pointerup',point(1,1,{pointerId:2}));assert.equal(closed,0);
send(dialog,'pointerdown',point(1,1));send(dialog,'pointercancel');send(dialog,'pointerup',point(1,1));assert.equal(closed,0);
send(dialog,'pointerdown',point(1,1));send(dialog,'pointerup',point(2,2));assert.equal(closed,1);

// Outside close continues through the editor's unsaved-changes check.
const editor=new Element();let state={name:'Boots'},prompts=0,discard=false;
const guard=attachEditorGuard(editor,{windowTarget:win,readState:()=>state,isBusy:()=>false,confirmDiscard:()=>{prompts++;return discard;}});
guard.reset();state.name='Edited';attachBackdropClose(editor,()=>guard.requestClose());
send(editor,'pointerdown',point(1,1));send(editor,'pointerup',point(1,1));assert(editor.open);assert.equal(prompts,1);
discard=true;send(editor,'pointerdown',point(1,1));send(editor,'pointerup',point(1,1));assert(!editor.open);
console.log('PASS: resize drags grow/shrink without dismissal, stay anchored and in bounds, support keyboard/cancel, and preserve genuine outside-click and unsaved-edit behavior.');

const card=new Element(),button=new Element(),svg=new Element();
card.dataset.id='pair';button.dataset.edit='pair';
button.closest=()=>button;svg.closest=()=>button;card.closest=()=>null;
card.contains=element=>element===button||element===svg;
let previews=0,edits=0;
attachShoeCard(card,{preview:id=>{assert.equal(id,'pair');previews++;},edit:id=>{assert.equal(id,'pair');edits++;}});
for(const target of [button,svg]){send(card,'click',{target});assert.equal(previews,0);}
send(card,'keydown',{target:button,key:'Enter'});assert.equal(previews,0);
send(card,'click',{target:button,detail:0});assert.equal(edits,3);
send(card,'click',{target:card});assert.equal(previews,1);
send(card,'keydown',{target:card,key:'Enter'});send(card,'keydown',{target:card,key:' '});assert.equal(previews,3);
assert.equal(LOCATION_ICONS.length,37);assert.equal(new Set(LOCATION_ICONS.map(icon=>icon.id)).size,37);
assert.equal(iconForLocation([{name:'Bedroom',icon:'bedroom'}],'bedroom'),'bedroom');
assert.equal(locationIcon('invalid'),locationIcon('pin'));
for(const icon of LOCATION_ICONS){assert(locationIcon(icon.id).includes(icon.svg));assert(!/script|onload|href/.test(icon.svg));}
console.log('PASS: Edit clicks (including its icon and keyboard activation) only edit; the rest of a card previews; all 37 icon choices render safely.');
