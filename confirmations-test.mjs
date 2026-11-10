import assert from 'node:assert/strict';
import {CONFIRMATION_ACTIONS,createConfirmationPreferences,attachActionConfirmation} from './ui/action-confirmations.js';
class Element extends EventTarget{checked=false;textContent='';open=false;focus(){}close(){this.open=false;this.dispatchEvent(new Event('close'));}}
const saved=new Map(),storage={getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value)};
let preferences=createConfirmationPreferences(storage);
const dialog=new Element(),title=new Element(),message=new Element(),confirmButton=new Element(),cancelButton=new Element(),skipCheckbox=new Element();
let shown=0;
const confirm=attachActionConfirmation({dialog,title,message,confirmButton,cancelButton,skipCheckbox,preferences,
  show:el=>{shown++;el.open=true;},close:el=>el.close()});
const details={title:'Confirm action',message:'Keep this data until confirmed.',button:'Confirm'};
for(const {id} of CONFIRMATION_ACTIONS){
  assert(preferences.shouldAsk(id));
  let result=confirm(id,details);assert(dialog.open);skipCheckbox.checked=true;
  cancelButton.dispatchEvent(new Event('click'));assert.equal(await result,false);assert(preferences.shouldAsk(id),'cancel must not remember suppression');
  result=confirm(id,details);assert.equal(skipCheckbox.checked,false);
  dialog.close();assert.equal(await result,false,'Escape/backdrop/X close cancels');
  result=confirm(id,details);confirmButton.dispatchEvent(new Event('click'));assert.equal(await result,true);assert(preferences.shouldAsk(id));
  result=confirm(id,details);skipCheckbox.checked=true;confirmButton.dispatchEvent(new Event('click'));assert.equal(await result,true);
  assert(!preferences.shouldAsk(id));const previousShown=shown;assert.equal(await confirm(id,details),true);assert.equal(shown,previousShown);
  for(const other of CONFIRMATION_ACTIONS.filter(action=>action.id!==id))preferences.setAsk(other.id,true);
  const reloaded=createConfirmationPreferences(storage);assert(!reloaded.shouldAsk(id));
  preferences.setAsk(id,true);result=confirm(id,details);assert(dialog.open);dialog.close();assert.equal(await result,false);
}
let pending=confirm('delete-location',details);assert.equal(await confirm('archive-pair',details),false,'overlapping confirmation must not approve a second action');dialog.close();assert.equal(await pending,false);
const unavailable=createConfirmationPreferences({getItem(){throw new Error('Unavailable');},setItem(){throw new Error('Unavailable');}});
assert(unavailable.shouldAsk('archive-pair'));unavailable.setAsk('archive-pair',false);assert(!unavailable.shouldAsk('archive-pair'));
const corrupt=createConfirmationPreferences({getItem:()=>'{broken'});assert(corrupt.shouldAsk('archive-pair'));
console.log('PASS: all delete/photo/archive actions ask by default; Cancel/Escape/X/backdrop never approve or suppress; Do not show again persists per action; settings can restore prompts; unavailable/corrupt storage stays safe.');
