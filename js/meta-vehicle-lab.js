import {VEHICLE_PRESETS,cleanVehicleBlueprint,vehiclePartBlueprint} from './vehicle-blueprint.js';
const STORAGE_KEY='solvi-vehicle-lab-blueprints-v1';
const numberField=(key,label,min,max,step)=>`<label>${label}<input data-blueprint="${key}" type="number" min="${min}" max="${max}" step="${step}"></label>`;
const colourField=(key,label)=>`<label>${label}<input data-blueprint="${key}" type="color"></label>`;
// The dialog uses SOLVI's existing scene and physics: there is no second renderer.
export function installVehicleLab(editor){
 let panel=document.getElementById('metaVehicleLab');if(panel)return {open:()=>{panel.hidden=false;}};
 panel=document.createElement('section');panel.id='metaVehicleLab';panel.className='vehicle-lab-window';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Meta Vehicle Lab');
 panel.innerHTML=`<header class="vehicle-lab-header"><strong>Meta Vehicle Lab</strong><button type="button" data-action="close" aria-label="Close vehicle lab">×</button></header>
 <div class="vehicle-lab-body"><label>Vehicle preset<select id="vehicleLabPreset"></select></label>
 <div class="vehicle-lab-fields"><label>Blueprint name<input data-blueprint="name" maxlength="72"></label>
 ${numberField('length','Chassis length (m)',1.5,12,.1)}${numberField('width','Width (m)',.7,5,.1)}${numberField('height','Chassis height (m)',.22,4,.05)}
 ${numberField('wheelRadius','Wheel radius (m)',.12,1.5,.05)}${numberField('wheelOffset','Axle distance from centre (m)',.35,5,.05)}
 <label>Number of wheels<select data-blueprint="wheels"><option>4</option><option>6</option><option>8</option></select></label>
 ${colourField('paint','Chassis colour')}${colourField('wheelColor','Wheel colour')}</div>
 <label>Optional chassis GLB<select id="vehicleLabModel"><option value="">Procedural cube chassis</option></select></label>
 <svg id="vehicleLabSketch" viewBox="0 0 360 158" role="img" aria-label="Schematic top view of the vehicle"></svg>
 <p class="vehicle-lab-status" id="vehicleLabStatus" role="status">A real collection is created only after choosing Add to realm.</p>
 <div class="vehicle-lab-actions"><button type="button" data-action="save">Save blueprint locally</button><button type="button" data-action="export">Export JSON</button><button type="button" data-action="create">Add to realm</button></div>
 <p class="vehicle-lab-notice">SOLVI v0.2.252: independently editable wheel and body colliders, no motor/suspension simulation yet. Import GLBs in Assets first; replacing chassis visuals preserves its collision envelope.</p></div>`;
 document.body.append(panel);
 const preset=panel.querySelector('#vehicleLabPreset'),model=panel.querySelector('#vehicleLabModel'),status=panel.querySelector('#vehicleLabStatus');let value=cleanVehicleBlueprint();
 const options=()=>{let saved=[];try{saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');}catch{}return [...Object.entries(VEHICLE_PRESETS).map(([name,p])=>({name,p})),...saved.filter(p=>p&&p.name&&p.blueprint).map(p=>({name:'Saved · '+p.name,p:p.blueprint}))];};
 function draw(){const {blueprint:p,parts}=vehiclePartBlueprint(value),svg=panel.querySelector('#vehicleLabSketch');const sx=340/Math.max(6,p.length+1),sy=118/Math.max(3,p.width+1),cx=180,cy=79;
  svg.replaceChildren();const el=(tag,attrs)=>{const node=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,val] of Object.entries(attrs))node.setAttribute(key,String(val));svg.append(node);return node;};
  el('rect',{x:0,y:0,width:360,height:158,fill:'#142333',rx:10});
  el('rect',{x:cx-p.length*sx/2,y:cy-p.width*sy/2,width:p.length*sx,height:p.width*sy,rx:12,fill:p.paint,stroke:'#ffffff','stroke-width':2});
  el('rect',{x:cx-p.length*sx*.22,y:cy-p.width*sy*.37,width:p.length*sx*.43,height:p.width*sy*.74,rx:7,fill:'#365164',stroke:'#c5d5de'});
  for(const part of parts.filter(o=>o.name.startsWith('Wheel')))el('rect',{x:cx+part.z*sx-p.wheelRadius*sx*.78,y:cy+part.x*sy-p.wheelRadius*sy*.44,width:p.wheelRadius*sx*1.56,height:p.wheelRadius*sy*.88,fill:p.wheelColor,rx:3});
  const caption=el('text',{x:12,y:150,fill:'#dce7f5','font-size':11});caption.textContent=`${p.name} · ${p.wheels} wheels · ${p.length.toFixed(1)} m`;
 }
 function read(){const obj={};for(const control of panel.querySelectorAll('[data-blueprint]'))obj[control.dataset.blueprint]=control.value;obj.chassisModel=model.value;value=cleanVehicleBlueprint(obj);draw();}
 function sync(){for(const control of panel.querySelectorAll('[data-blueprint]'))control.value=value[control.dataset.blueprint];model.value=value.chassisModel||'';draw();}
 function refreshOptions(){const entries=options();preset.replaceChildren(...entries.map(({name})=>new Option(name,name)));return entries;}
 function refreshModels(){const previous=value.chassisModel||'';model.replaceChildren(new Option('Procedural cube chassis',''));const urls=new Set();for(const item of editor.items)if(item.userData.editorKind==='model'&&item.userData.modelUrl){const url=item.userData.modelUrl;if(urls.has(url))continue;urls.add(url);model.add(new Option(item.name,url));}if(urls.has(previous))model.value=previous;else value.chassisModel='';}
 panel.querySelectorAll('[data-blueprint]').forEach(el=>el.addEventListener('input',read));model.addEventListener('change',read);
 preset.addEventListener('change',()=>{const entry=options().find(o=>o.name===preset.value);if(entry){value=cleanVehicleBlueprint(entry.p);sync();}});
 const download=(name,content)=>{const url=URL.createObjectURL(new Blob([content],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);};
 panel.addEventListener('click',async event=>{const button=event.target.closest('button[data-action]');if(!button)return;
  const action=button.dataset.action;if(action==='close'){panel.hidden=true;return;}
  if(action==='save'){const saved=options().filter(x=>x.name.startsWith('Saved · ')).map(x=>({name:x.name.slice(8),blueprint:x.p}));saved.push({name:value.name,blueprint:value});localStorage.setItem(STORAGE_KEY,JSON.stringify(saved.slice(-24)));refreshOptions();status.textContent='Blueprint saved in this browser; does not modify the realm.';return;}
  if(action==='export'){download('solvi-vehicle-'+value.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.json',JSON.stringify({schema:'solvi-vehicle-lab-v1',blueprint:value},null,2));status.textContent='Portable blueprint exported.';return;}
  if(action==='create'){
   button.disabled=true;try{const result=editor.addVehicleBlueprint(value);status.textContent=result?`${result.length} collidable scene components added as one collection; scene save queued.`:'No collision-safe placement was found; aim at open ground and retry.';}catch(error){status.textContent='Vehicle placement failed: '+error.message;}finally{button.disabled=false;}
  }
 });
 let dragging=null;panel.querySelector('.vehicle-lab-header').addEventListener('pointerdown',event=>{if(event.target.closest('button'))return;dragging={x:event.clientX,y:event.clientY,left:panel.offsetLeft,top:panel.offsetTop};panel.setPointerCapture(event.pointerId);});
 panel.addEventListener('pointermove',event=>{if(!dragging)return;panel.style.left=Math.max(0,Math.min(innerWidth-panel.offsetWidth,dragging.left+event.clientX-dragging.x))+'px';panel.style.top=Math.max(0,Math.min(innerHeight-panel.offsetHeight,dragging.top+event.clientY-dragging.y))+'px';panel.style.right='auto';});
 panel.addEventListener('pointerup',()=>{dragging=null;});
 return {open:()=>{refreshOptions();refreshModels();sync();panel.hidden=false;}};
}
