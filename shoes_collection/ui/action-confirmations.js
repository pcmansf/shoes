export const CONFIRMATION_ACTIONS=[
  {id:'delete-location',label:'Delete locations'},
  {id:'remove-photo',label:'Remove photos'},
  {id:'archive-pair',label:'Archive pairs'}
];
const key='shoes-action-confirmations-v1';
export function createConfirmationPreferences(storage){
  let values={};
  function check(action){if(!CONFIRMATION_ACTIONS.some(item=>item.id===action))throw new Error('Unknown confirmation action.');}
  function read(){
    try{const raw=storage.getItem(key);if(raw){const parsed=JSON.parse(raw);if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))values=parsed;}}catch{}
  }
  return {
    shouldAsk(action){check(action);read();return values[action]!==false;},
    setAsk(action,ask){check(action);read();values[action]=!!ask;try{storage.setItem(key,JSON.stringify(values));}catch{}},
  };
}

export function attachActionConfirmation({dialog,title,message,confirmButton,cancelButton,skipCheckbox,show,close,preferences}){
  let pending=null;
  dialog.addEventListener('close',()=>{
    const action=pending;pending=null;if(action)action.resolve(action.accepted);
  });
  cancelButton.addEventListener('click',()=>close(dialog));
  confirmButton.addEventListener('click',()=>{
    if(!pending)return;
    pending.accepted=true;
    if(skipCheckbox.checked)preferences.setAsk(pending.kind,false);
    close(dialog);
  });
  return function confirm(kind,details){
    if(pending)return Promise.resolve(false);
    if(!preferences.shouldAsk(kind))return Promise.resolve(true);
    return new Promise(resolve=>{
      pending={kind,resolve,accepted:false};
      title.textContent=details.title;message.textContent=details.message;
      confirmButton.textContent=details.button;skipCheckbox.checked=false;
      show(dialog);cancelButton.focus();
    });
  };
}
