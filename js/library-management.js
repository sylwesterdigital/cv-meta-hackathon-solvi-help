// Deliberately distinguish hiding bundled avatars from deleting user uploads.
export const libraryIdentifier = item=>typeof item?.id==='string'&&/^[0-9a-f]{32}$/.test(item.id)?item.id:null;
export function filterLibrary(items,query='',hidden=[]){
 const q=String(query).trim().toLocaleLowerCase();const skipped=new Set(hidden);
 return (Array.isArray(items)?items:[]).filter(item=>!skipped.has(item.url)&&(!q||[item.label,item.ownerName,item.genderPresentation,item.format].some(field=>String(field||'').toLocaleLowerCase().includes(q))));
}
export function hiddenAvatarStorageKey(uid){return 'solvi-hidden-bundled-avatars-'+String(uid||'guest').replace(/[^a-z0-9_-]/gi,'');}
export function ownedOrBundled(item){return !!item?.bundled||item?.canManage===true;}
export async function downloadLibrarySelection(kind,items){
 const auth=window.solviAPI?.auth();if(!auth)throw Error('Sign in to export library files');
 const ids=items.map(libraryIdentifier).filter(Boolean);
 const bundled=kind==='avatars'?items.filter(a=>a.bundled===true).map(a=>a.id):[];
 if(!ids.length&&!bundled.length)throw Error('Select models first');
 const response=await fetch('/api/library/export',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+auth.token,'X-Solvi-Tab':auth.tab},body:JSON.stringify({kind,ids,bundled})});
 if(!response.ok){const error=await response.json().catch(()=>({}));throw Error(error.error||'Cannot export selection');}
 const url=URL.createObjectURL(await response.blob());
 try{const a=document.createElement('a');a.href=url;a.download='solvi-'+kind+'-'+new Date().toISOString().slice(0,10)+'.zip';document.body.append(a);a.click();a.remove();}finally{setTimeout(()=>URL.revokeObjectURL(url),60000);}
}
export async function deleteLibrarySelection(kind,items){
 const ids=items.map(libraryIdentifier).filter(Boolean);
 if(!ids.length)return {deleted:[]};
 return window.solviAPI.req('/api/library/delete',{method:'POST',body:JSON.stringify({kind,ids,confirm:true})});
}
export function selectionPrompt(items,kind){
 const count=items.length;return `Delete ${count} selected ${kind==='avatars'?'avatar':'asset'}${count===1?'':'s'}?\n\nUploaded files will be permanently deleted if you own them and they are unused in every realm. Bundled avatars will only be hidden from your personal gallery.\n\nThis cannot be undone for uploaded files.`;
}
