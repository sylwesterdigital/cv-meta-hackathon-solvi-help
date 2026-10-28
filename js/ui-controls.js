// Browser-local responsive controls: icons remain decorative, native button names stay accessible.
import {applyPreferences,readPreferences,resolvedLabelMode,isCompactDevice} from './preferences.js';
const iconIds={
 chatButton:'chat',mobileMenuButton:'more',createRoom:'rooms',addObjectButton:'add',avatarsButton:'avatar-3d',objectsButton:'cube',devLogButton:'history',xrButton:'avatar-3d',callButton:'video',messagesToggleButton:'chat',settingsButton:'config',profileButton:'profile',
 cameraFlyButton:'camera',importModelButton:'cube',faceButton:'avatar-maker',poseButton:'users',diagnosticsButton:'transcript',worldSettingsButton:'config',quickModelImport:'cube',chatModeButton:'window',cameraFollowButton:'change-camera',toolboxMinimize:'sidebar-in',
 captionsButton:'captions',voiceWavesButton:'sound-on',recordAudio:'mic',recordVideo:'video',robotVision:'eye',sendChat:'send',composerToolsButton:'more',
 captureBrainsEye:'camera',describeBrainsEye:'brain',analyzeBrainsEye:'eye',showBrainChat:'chat',expandBrainsEye:'fullscreen',closeBrainsEyeLightbox:'close',saveRobotBrains:'check',suggestBrainsScenario:'brain',
 generateTheme:'render',resetUiPreferences:'change-camera',closeSettings:'close',saveMetaKey:'check',clearMetaKey:'delete',refreshMetaUsage:'history',
 exportChatSettings:'download',exportChatSettingsJson:'download',openAdminSettings:'config',closeWorldSettings:'close',saveWorldSettings:'check',
 closeAvatarGallery:'close',closeRobotBrains:'close',closeDiagnostics:'close',refreshDiagnostics:'history',analyzeDiagnostics:'brain',closeProperties:'close',minimizeScenePanel:'sidebar-in',closeScenePanel:'close',
 closeLog:'close',continueButton:'play',closeCall:'close',joinAudio:'mic',joinVideo:'video',leaveCall:'stop',closeProfile:'close',saveProfile:'check',
 transformTranslate:'edit',deleteObject:'delete',transformRotate:'change-camera',transformScale:'full',reloadScene:'history',saveScene:'check',
 saveSceneButton:'check',textureUploadButton:'photo',chatFile:'file',adminButton:'config',adminLogin:'check',adminRefresh:'history',
 exportChatButton:'download',closeAdmin:'close',roomSelect:'rooms',robotAvatar:'avatar-3d',uploadRobotAvatar:'avatar-maker',
};
const words=[
 [/cube|box|3d model|add object|surface|geometry|sphere|cylinder|plane|torus|curve|points/i,'cube'],
 [/brain|scenario|suggest|analyse|analyze|intelligence/i,'brain'],[/caption|\bcc\b|transcri/i,'captions'],
 [/mic|audio|speech|sound|voice/i,'mic'],[/avatar|robot|character/i,'avatar-3d'],
 [/room|realm/i,'rooms'],[/camera|capture|photo|eye|vision/i,'camera'],
 [/chat|message|send/i,'chat'],[/download|export|save as/i,'download'],
 [/delete|remove|clear/i,'delete'],[/stop|leave|exit/i,'stop'],
 [/start|play|enter|enable/i,'play'],[/close|cancel|×|✕/i,'close'],
 [/add|create|new|\+/i,'add'],[/save|apply|confirm|done|check/i,'check'],
 [/edit|move|position|translate/i,'edit'],[/fullscreen|full-size|expand/i,'fullscreen'],
 [/settings|config|setup|theme|palette/i,'config'],[/log|history|refresh|reload/i,'history'],
 [/more|options|tools/i,'more'],[/copy|duplicate/i,'copy'],[/share|link/i,'share']
];
const fileIcons=new Set('add config chat rooms avatar-3d render download fullscreen captions mic sound-on sound-mute video camera photo eye brain send close x more profile users edit delete stop play pause copy window sidebar-in sidebar-out history preview file stream link check plus share drawing game chat-3d-orbit change-camera transcript background bottom exit media full grab cancel swap speak avatar-maker chat-3d-capture cube'.split(' '));
export function iconForButton(button){
 if(button.classList.contains('theme-swatch')||button.classList.contains('theme-preset')||(button.closest?.('.scene-item-row')&&!button.classList.contains('scene-item-delete')))return null;
 const hint=[button.id||'',button.title||'',button.getAttribute('aria-label')||'',button.textContent||''].join(' ');
 const camel=(button.id||'').replace(/[A-Z]/g,c=>' '+c.toLowerCase());
 let icon=iconIds[button.id]||words.find(([pattern])=>pattern.test(camel+' '+hint))?.[1];
 return icon&&fileIcons.has(icon)?icon:null;
}
export function decorateButtons(root=document){
 const nodes=[];if(root.matches?.('button'))nodes.push(root);
 if(root.querySelectorAll)nodes.push(...root.querySelectorAll('button, label.icon-btn'));
 for(const b of nodes){if(b.classList.contains('theme-swatch')||b.classList.contains('theme-preset'))continue;
  const name=iconForButton(b);if(!name)continue;
  if(!b.title){const label=(b.getAttribute('aria-label')||b.textContent||'').trim();if(label)b.title=label.slice(0,140);}
  b.dataset.uiIcon=name;
  b.style.setProperty('--ui-button-icon',`url("./assets/ui-icons/${name}.svg")`);
 }
}
export function setupResponsiveUI(){
 const nav=document.getElementById('toolNav'),menu=document.getElementById('mobileMenuButton');
 const mobile=window.matchMedia('(max-width: 750px)');
 const updateDevice=()=>{const prefs=readPreferences();if(prefs.labelMode==='auto')applyPreferences(prefs);};
 mobile.addEventListener?.('change',updateDevice);
 menu?.addEventListener('click',()=>{const expanded=nav.classList.toggle('nav-expanded');menu.setAttribute('aria-expanded',String(expanded));menu.title=expanded?'Hide additional world tools':'Show additional world tools';});
 document.addEventListener('pointerdown',event=>{if(nav&&!nav.contains(event.target)){nav.classList.remove('nav-expanded');menu?.setAttribute('aria-expanded','false');}});
 if(mobile.matches)document.getElementById('editorToolbox')?.classList.add('minimized');
 decorateButtons();
 const observer=new MutationObserver(records=>{const nodes=new Set();for(const rec of records){
  if(rec.type==='childList'){
   if(rec.target.closest?.('button'))nodes.add(rec.target.closest('button'));
   for(const node of rec.addedNodes)if(node.nodeType===1)nodes.add(node);
  }
 }for(const node of nodes)decorateButtons(node);});
 observer.observe(document.body,{subtree:true,childList:true});
 window.addEventListener('solvi:prefs-changed',()=>{document.body.dataset.compactUi=String(isCompactDevice());});
}
