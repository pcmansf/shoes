// Compare actual form values and photo references, so reverting an edit clears the warning.
export function attachEditorGuard(dialog,{readState,isBusy,confirmDiscard,windowTarget=window}){
  let baseline=null;
  const reset=(state=readState())=>{baseline=structuredClone(state);};
  const dirty=()=>dialog.open&&baseline!==null&&JSON.stringify(readState())!==JSON.stringify(baseline);
  const mayDiscard=()=>!isBusy()&&(!dirty()||confirmDiscard());
  const requestClose=()=>{if(mayDiscard()){dialog.close();return true;}return false;};
  dialog.addEventListener('cancel',event=>{event.preventDefault();requestClose();});
  windowTarget.addEventListener('beforeunload',event=>{
    if(dialog.open&&(dirty()||isBusy())){event.preventDefault();event.returnValue='';}
  });
  return {
    reset,dirty,mayDiscard,requestClose,
    savedClose(){reset();dialog.close();},
    renameLocation(from,to){
      if(baseline&&baseline.location.toLowerCase()===from.toLowerCase())baseline.location=to;
    }
  };
}
