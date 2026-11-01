// Account-local mode switch for the whole application. Exploration is the default.
const storageKey=()=>{
 let id='guest';
 try{id=window.solviAPI?.auth?.()?.profile?.id||JSON.parse(localStorage.getItem('solvi-profile')||'null')?.id||'guest';}catch{}
 return 'solvi-edit-mode-v1-'+id;
};
export function readEditMode(storage=localStorage,key=storageKey()){
 try{return storage.getItem(key)==='1';}catch{return false;}
}
export function applyEditMode(enabled,{persist=false}={}){
 const state=enabled===true;
 document.documentElement.classList.toggle('solvi-edit-mode',state);
 document.documentElement.dataset.solviMode=state?'edit':'explore';
 const toggle=document.getElementById('profileEditMode');
 if(toggle){toggle.checked=state;toggle.setAttribute('aria-checked',String(state));}
 if(persist)try{localStorage.setItem(storageKey(),state?'1':'0');}catch{}
 if(!state){
  for(const id of ['propertiesPanel','scenePanel','wallPanel','addMenu','editorToolbox']){
   const panel=document.getElementById(id);if(panel)panel.hidden=true;
  }
 }
 window.dispatchEvent(new CustomEvent('solvi:edit-mode-changed',{detail:{enabled:state}}));
 return state;
}
export function isEditMode(){return document.documentElement.classList.contains('solvi-edit-mode');}
export function initEditMode(){
 applyEditMode(readEditMode());
 const toggle=document.getElementById('profileEditMode');
 toggle?.addEventListener('change',()=>applyEditMode(toggle.checked,{persist:true}));
 window.addEventListener('solvi:authenticated',()=>applyEditMode(readEditMode()));
 window.addEventListener('solvi:session-lost',()=>applyEditMode(readEditMode()));
}
