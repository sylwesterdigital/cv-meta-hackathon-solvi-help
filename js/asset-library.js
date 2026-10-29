// Shared-scene asset identifiers are server-generated; reject arbitrary URLs.
export const validAssetURL=url=>typeof url==='string'&&/^\/api\/scene\/models\/[0-9a-f]{32}\.(glb|fbx)$/.test(url);
export function visibleAssets(models,query=''){
 const q=String(query).trim().toLocaleLowerCase();
 return (Array.isArray(models)?models:[]).filter(asset=>validAssetURL(asset?.url)&&typeof asset.label==='string'&&(!q||asset.label.toLocaleLowerCase().includes(q)||String(asset.format||'').includes(q))).slice(0,100);
}
export function validAssetFile(file,limitMiB=20){
 return !!file&&/\.(glb|fbx)$/i.test(String(file.name||''))&&Number.isFinite(file.size)&&file.size>=20&&file.size<=Math.min(20,Math.max(.1,limitMiB))*1024*1024;
}
