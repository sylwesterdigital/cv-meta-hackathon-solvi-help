// Keyboard help derives combat bindings from the avatar's actual settings.
import {combatSettings} from './robot-combat.js';
export const ROBOT_KEY_ACTIONS=Object.freeze({KeyI:'pickup-drop',KeyO:'throw',KeyJ:'sit-stand',KeyB:'inventory',KeyU:'use-equipped-tool'});
export const ROBOT_SHORTCUTS=Object.freeze([
 ['Movement','↑ / ↓','Move forward / reverse'],['Movement','← / →','Steer / sidestep when stopped'],
 ['Movement','Shift + ↑','Run (also automatically after holding forward)'],['Movement','Space','Jump / release ladder'],
 ['Actions','I','Hold / pick up nearby item or drop held tool (no inventory needed)'],['Inventory','Shift + I','Put held item in equipped backpack / open backpack'],['Actions','O','Throw held object'],
 ['Actions','J','Sit / stand'],['Actions','U','Use held item (shovel: dig; can/bottle: drink)'],['Inventory','B','Toggle inventory (open / close)'],
 ['Navigation','Shift + A','Add object menu'],['Help','⌘ + /','Show / hide these shortcuts']]);
export function robotShortcutRows(robot){const rows=ROBOT_SHORTCUTS.map(r=>[...r]);
 const combat=combatSettings(robot?.userData?.robotCombat);for(const [kind,item] of Object.entries(combat)){if(item.key)rows.push(['Combat',item.key.replace(/^Key/,'').replace(/^Digit/,'Number '),kind[0].toUpperCase()+kind.slice(1)]);}return rows;}
export function bindRobotShortcutHelp(getRobot){
 const overlay=document.createElement('div');overlay.id='robotShortcutsBackdrop';overlay.hidden=true;overlay.className='robot-shortcuts-backdrop';
 const panel=document.createElement('section');panel.className='robot-shortcuts-dialog';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','Robot keyboard shortcuts');
 const head=document.createElement('div');head.className='robot-shortcuts-head';const title=document.createElement('strong');title.textContent='Robot keyboard shortcuts';
 const close=document.createElement('button');close.type='button';close.title='Close shortcuts';close.textContent='×';close.setAttribute('aria-label','Close shortcuts');head.append(title,close);
 const table=document.createElement('table');table.className='robot-shortcuts-table';
 const closeOverlay=()=>{overlay.hidden=true;};
 const open=()=>{table.replaceChildren();let section='';for(const [group,key,label] of robotShortcutRows(getRobot())){
  if(group!==section){section=group;const header=document.createElement('tr');header.className='robot-shortcuts-section';const th=document.createElement('th');th.colSpan=2;th.textContent=group;header.append(th);table.append(header);}
  const row=document.createElement('tr');const k=document.createElement('td');const code=document.createElement('kbd');code.textContent=key;k.append(code);const d=document.createElement('td');d.textContent=label;row.append(k,d);table.append(row);
 }overlay.hidden=false;};
 close.onclick=closeOverlay;overlay.onclick=e=>{if(e.target===overlay)closeOverlay();};panel.append(head,table);overlay.append(panel);document.body.append(overlay);
 window.addEventListener('keydown',e=>{const target=e.target;if((e.metaKey||e.ctrlKey)&&(e.key==='/'||e.code==='Slash')&&!e.altKey){e.preventDefault();e.stopImmediatePropagation();overlay.hidden?open():closeOverlay();return;}
 if(e.key==='Escape'&&!overlay.hidden){e.preventDefault();e.stopImmediatePropagation();closeOverlay();}},true);
 return {open,close:closeOverlay};
}
