// Native dialog-based confirmations work even if a browser suppresses window.confirm/prompt.
// No HTML is parsed from user supplied titles, body text, or responses.
let pendingDialog=null;
export function askUser({title='Confirm action',message='',confirmLabel='Confirm',cancelLabel='Cancel',expected=null,danger=false,input=false,initialValue='' }={}){
 if(typeof document==='undefined')return Promise.resolve(null);
 if(pendingDialog)return Promise.resolve(null);
 return new Promise(resolve=>{
  const dialog=document.createElement('dialog');dialog.className='solvi-action-dialog';
  dialog.setAttribute('aria-label',title);
  const form=document.createElement('form');form.method='dialog';form.className='solvi-action-card';
  const heading=document.createElement('h2');heading.textContent=title;
  const text=document.createElement('p');text.textContent=message;
  const field=(expected===null&&!input)?null:document.createElement('input');
  if(field){field.type='text';field.autocomplete='off';field.spellcheck=false;field.value=String(initialValue);field.placeholder=expected===null?'Enter a name':'Type: '+expected;field.setAttribute('aria-label',expected===null?'Enter a name':'Type the exact name to confirm');}
  const buttons=document.createElement('div');buttons.className='solvi-action-buttons';
  const cancel=document.createElement('button');cancel.type='button';cancel.textContent=cancelLabel;
  const ok=document.createElement('button');ok.type='submit';ok.textContent=confirmLabel;ok.className=danger?'solvi-danger-button':'solvi-primary-button';
  const validate=()=>{ok.disabled=!!field&&(expected===null?!field.value.trim():field.value!==expected);};
  if(field){field.addEventListener('input',validate);validate();}
  buttons.append(cancel,ok);form.append(heading,text);if(field)form.append(field);form.append(buttons);dialog.append(form);document.body.append(dialog);
  let settled=false;const finish=value=>{if(settled)return;settled=true;pendingDialog=null;dialog.close?.();dialog.remove();resolve(value);};
  cancel.addEventListener('click',()=>finish(null));
  form.addEventListener('submit',e=>{e.preventDefault();if(field&&(expected===null?!field.value.trim():field.value!==expected))return;finish(field?field.value:true);});
  dialog.addEventListener('cancel',e=>{e.preventDefault();finish(null);});
  dialog.addEventListener('click',e=>{if(e.target===dialog)finish(null);});
  pendingDialog=dialog;try{dialog.showModal();}catch{dialog.setAttribute('open','');}
  (field||cancel).focus();
 });
}
export async function confirmAction(message,options={}){return (await askUser({message,...options}))===true;}
export async function exactNameAction(message,name,options={}){return (await askUser({message,expected:name,danger:true,...options}))===name;}

export async function textEntry(title,initialValue='',options={}){const result=await askUser({title,message:'',confirmLabel:'Save',input:true,initialValue,...options});return typeof result==='string'?result:null;}
