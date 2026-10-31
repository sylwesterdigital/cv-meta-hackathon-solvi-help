// Server-backed library export and permanent deletion; no local-only hiding.
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
 const ids=items.filter(a=>!a.bundled).map(libraryIdentifier).filter(Boolean);
 const bundled=kind==='avatars'?items.filter(a=>a.bundled).map(a=>a.id):[];
 if(!ids.length&&!bundled.length)return {deleted:[],bundledDeleted:[]};
 const admin=window.solviLibraryAdminToken?.();
 if(bundled.length&&!admin)throw Error('Unlock the Admin dashboard before deleting server-bundled avatars.');
 const headers=admin?{'X-Solvi-Admin':admin}:{};
 return window.solviAPI.req('/api/library/delete',{method:'POST',headers,body:JSON.stringify({kind,ids,bundled,confirm:true})});
}
export function selectionPrompt(items,kind){
 const count=items.length;
 return `Permanently delete ${count} selected ${kind==='avatars'?'avatar':'asset'}${count===1?'':'s'} FROM THE SERVER?\n\nFiles and catalog entries will be removed. Robots using a deleted avatar keep their name, position and settings, and automatically use the protected default SOLVI avatar. Bundled avatars require an unlocked Admin dashboard.\n\nThis cannot be undone. Export a backup first if needed.`;
}
