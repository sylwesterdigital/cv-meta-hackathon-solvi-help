import {CHARACTER_SCHEMA,CHARACTER_PRESETS,TRAIT_DESCRIPTORS,makeCharacter,normalizeCharacter,traitBand,characterSummary,characterPolicy,characterExport,characterImport} from './robot-character-core.js';
const $=id=>document.getElementById(id);
export function initCharacterEditor({getRobot,canEdit,save,toast,api,room}){
 const host=$('brainsCharacterCategories'),summary=$('brainsCharacterSummary');
 let current=makeCharacter(),previousRobotId='',search='';
 const liveRobot=()=>getRobot();
 const writable=()=>!!liveRobot()&&canEdit(liveRobot());
 const label=(d,val)=>val<34?d.low:val>66?d.high:`${d.low} ↔ ${d.high}`;
 const describe=()=>{
  summary.textContent=characterSummary(current);
  $('brainsCharacterPolicies').textContent=Object.entries(characterPolicy(current)).map(([key,value])=>`${key.replace(/([A-Z])/g,' $1')}: ${value}`).join(' · ');
  $('brainsCharacterPreset').value=Object.hasOwn(CHARACTER_PRESETS,current.preset)?current.preset:'custom';
 };
 function draw(){
  host.replaceChildren();const query=search.toLowerCase();
  for(const category of CHARACTER_SCHEMA.categories){
   const found=category.traits.filter(t=>(t.low+' '+t.high+' '+t.id+' '+category.label).toLowerCase().includes(query));
   if(!found.length)continue;
   const section=document.createElement('details');section.className='character-category';section.open=Boolean(query)||category.id==='personality';
   const heading=document.createElement('summary');heading.textContent=`${category.label} · ${found.length} spectrums`;section.append(heading);
   const rows=document.createElement('div');rows.className='character-traits';
   for(const trait of found){
    const row=document.createElement('label');row.className='character-trait';row.dataset.trait=trait.id;
    const heading=document.createElement('span');heading.className='character-trait-head';
    const name=document.createElement('strong');name.textContent=label(trait,current.traits[trait.id]);
    const value=document.createElement('output');value.textContent=String(current.traits[trait.id]);
    heading.append(name,value);
    const slider=document.createElement('input');slider.type='range';slider.min='0';slider.max='100';slider.step='1';slider.value=String(current.traits[trait.id]);slider.disabled=!writable();
    slider.setAttribute('aria-label',`${category.label}: ${trait.low} to ${trait.high}`);
    const captions=document.createElement('span');captions.className='character-trait-ends';
    const a=document.createElement('span');a.textContent=trait.low;const b=document.createElement('span');b.textContent=trait.high;captions.append(a,b);
    slider.addEventListener('input',()=>{
     current.traits[trait.id]=Number(slider.value);current.preset='custom';name.textContent=label(trait,current.traits[trait.id]);value.textContent=slider.value;describe();
     $('brainsCharacterDirty').textContent='Unsaved changes';
    });
    row.append(heading,slider,captions);rows.append(row);
   }
   section.append(rows);host.append(section);
  }
  describe();
 }
 function setRobot(robot){
  previousRobotId=robot?.userData?.editorId||'';
  current=normalizeCharacter(robot?.userData?.robotBrain?.character);
  $('brainsCharacterDirty').textContent=robot?.userData?.robotBrain?.character?'Saved in shared robot identity':'Default profile · save to persist';
  $('brainsCharacterSave').disabled=!writable();$('brainsCharacterImport').disabled=!writable();$('brainsCharacterPreset').disabled=!writable();
  $('brainsCharacterSearch').value='';search='';draw();
 }
 $('brainsCharacterSearch').addEventListener('input',e=>{search=e.target.value||'';draw();});
 const picker=$('brainsCharacterPreset');for(const [id,p] of Object.entries(CHARACTER_PRESETS))picker.add(new Option(p.label,id));picker.add(new Option('Custom (edited)','custom'));
 picker.onchange=()=>{if(!writable()||picker.value==='custom')return;current=makeCharacter(picker.value);draw();$('brainsCharacterDirty').textContent='Preset selected · unsaved';};
 $('brainsCharacterSave').onclick=()=>{
  if(!writable())return toast('Character is read-only');
  // All 96 values are preserved even when a search hides some sliders.
  save(normalizeCharacter(current));$('brainsCharacterDirty').textContent='Saved in shared robot identity';
  toast(liveRobot().name+' character profile saved to the realm');
 };
 $('brainsCharacterExport').onclick=()=>{
  const content=characterExport(liveRobot()?.name,current),blob=new Blob([content],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=(liveRobot()?.name||'robot').replace(/[^a-z0-9_-]+/gi,'-')+'-character.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
 };
 $('brainsCharacterImport').onclick=()=>$('brainsCharacterFile').click();
 $('brainsCharacterFile').onchange=async e=>{
  const file=e.target.files?.[0];e.target.value='';if(!file||!writable())return;
  try{if(file.size>128000)throw Error('Character JSON exceeds 128 KB');current=characterImport(await file.text());draw();$('brainsCharacterDirty').textContent='Imported · unsaved — press Save character';}
  catch(error){toast('Import refused: '+error.message);}
 };
 async function refreshRelationships(){
  const node=$('brainsCharacterRelationships'),robot=liveRobot();
  if(!robot)return;
  node.textContent='Loading observed interactions…';
  if(!api.online||!api.auth()){node.textContent='Connect and sign in to see saved robot interactions.';return;}
  const id=robot.userData.editorId;
  try{const response=await api.req('/api/robots/relationships?room='+encodeURIComponent(room())+'&id='+encodeURIComponent(id));
   if(liveRobot()?.userData.editorId!==id)return;
   node.replaceChildren();const items=response.relationships||[];
   if(!items.length){node.textContent='No recorded peer exchanges yet. Relationship entries appear after actual robot-to-robot messages.';return;}
   for(const item of items){const line=document.createElement('div');line.className='character-relation';
    const title=document.createElement('strong');title.textContent=item.name+' · '+item.interactions+' observed exchange(s)';
    const detail=document.createElement('small');detail.textContent=item.last_event+' · '+item.updated;
    line.append(title,detail);node.append(line);}
  }catch(error){node.textContent='Relationship evidence unavailable: '+error.message;}
 }
 $('brainsCharacterRefreshRelations').onclick=refreshRelationships;
 window.addEventListener('solvi:character-profile-refresh',e=>{if(!e.detail?.robot)return;setRobot(e.detail.robot);});
 window.addEventListener('solvi:character-relations-refresh',refreshRelationships);
 return {setRobot,refreshRelationships};
}
