// Persistent previews avoid re-downloading and decoding entire GLBs every time
// a visitor opens the gallery. CacheStorage is best-effort; memory is fallback.
const memory=new Map();
const CACHE_NAME='solvi-3d-thumbnails-055';
export function thumbnailCacheKey(source,version='portrait-416x544-v1'){
 const base=typeof location!=='undefined'?location.href:'https://solvi.invalid/';
 const url=new URL(source,base);
 url.searchParams.set('_solvi_preview',version);
 return url.href;
}
export async function readThumbnail(source){
 const key=thumbnailCacheKey(source);
 if(memory.has(key))return memory.get(key);
 if(typeof caches==='undefined')return null;
 try{
  const cache=await caches.open(CACHE_NAME),response=await cache.match(key);
  if(response?.ok){const value=await response.text();if(/^data:image\/(?:webp|png|jpeg);base64,/.test(value)){memory.set(key,value);return value;}}
 }catch{/* cache may be unavailable in private browsing */}
 return null;
}
export async function writeThumbnail(source,value){
 if(typeof value!=='string'||!/^data:image\/(?:webp|png|jpeg);base64,/.test(value))return;
 const key=thumbnailCacheKey(source);
 memory.set(key,value);
 if(typeof caches==='undefined')return;
 try{const cache=await caches.open(CACHE_NAME);await cache.put(key,new Response(value,{headers:{'Content-Type':'text/plain; charset=utf-8'}}));}catch{/* memory cache still works */}
}
