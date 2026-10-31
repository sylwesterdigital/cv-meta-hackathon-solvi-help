// Reusable, accessible library card sizing; only grid dimensions change.
export const GALLERY_SIZES=Object.freeze({s:120,m:158,l:226});
export function setupLibraryCardSize(backdrop,grid,key){
 const buttons=[...backdrop.querySelectorAll('[data-gallery-size]')];
 const apply=size=>{const mode=Object.hasOwn(GALLERY_SIZES,size)?size:'l';grid.dataset.cardSize=mode;
  for(const button of buttons)button.setAttribute('aria-pressed',String(button.dataset.gallerySize===mode));
  try{localStorage.setItem('solvi-library-card-size-'+key,mode);}catch{}
 };
 for(const button of buttons)button.addEventListener('click',()=>apply(button.dataset.gallerySize));
 let remembered='l';try{remembered=localStorage.getItem('solvi-library-card-size-'+key)||'l';}catch{}
 apply(remembered);return apply;
}
