// Browser-local responsive controls: icons remain decorative, native button names stay accessible.
import {applyPreferences,readPreferences,resolvedLabelMode,isCompactDevice} from './preferences.js';
const iconIds={
 chatButton:'chat',realmGalleryButton:'rooms',devLogNavButton:'history',closeRealmGallery:'close',newRealmFromGallery:'add',cancelModelDrop:'close',toolsToggleButton:'window',minimapButton:'map',minimapClose:'close',minimapMinimize:'minified',minimapReset:'reset',profileLogout:'exit',takeAvatarPhoto:'camera',recordIntro:'video',profileCameraCancel:'close',mobileMenuButton:'more',createRoom:'rooms',addObjectButton:'add',avatarsButton:'avatar-3d',assetsButton:'cube',replaceModelGallery:'cube',replaceModelFile:'upload',objectsButton:'list-objects',devLogButton:'history',xrButton:'avatar-3d',callButton:'video',settingsButton:'config',profileButton:'profile',
 cameraFlyButton:'camera',importModelButton:'model',faceButton:'avatar-maker',poseButton:'users',diagnosticsButton:'transcript',worldSettingsButton:'config',quickModelImport:'model',chatModeButton:'window',cameraFollowButton:'change-camera',toolboxMinimize:'minified',
 attachmentButton:'attach',attachMediaOption:'attach',attachAudioOption:'mic',attachVideoOption:'video',attachRobotOption:'eye',webcamButton:'webcam',closeWebcam:'close',facePreviewToggle:'avatar-maker',posePreviewToggle:'users',wavesPreviewToggle:'sound-on',sceneDeleteSelected:'delete',sceneDeleteAll:'delete',sceneBulkToggle:'check',composerFloat:'window',composerMinimize:'minified',captionsButton:'captions',voiceWavesButton:'sound-on',recordAudio:'mic',recordVideo:'video',robotVision:'eye',sendChat:'send',composerToolsButton:'more',
 captureBrainsEye:'camera',describeBrainsEye:'brain',analyzeBrainsEye:'eye',showBrainChat:'chat',expandBrainsEye:'fullscreen',closeBrainsEyeLightbox:'close',saveRobotBrains:'check',suggestBrainsScenario:'brain',
 generateTheme:'render',resetUiPreferences:'reset',useSystemFont:'reset',browseLocalFonts:'file',closeSettings:'close',saveMetaKey:'check',clearMetaKey:'delete',refreshMetaUsage:'history',
 exportChatSettings:'download',exportChatSettingsJson:'download',openAdminSettings:'config',closeWorldSettings:'close',resetWorldEnvironment:'reset',
 closeAvatarGallery:'close',closeAssetGallery:'close',refreshAssetGallery:'history',closeRobotBrains:'close',closeDiagnostics:'close',refreshDiagnostics:'history',analyzeDiagnostics:'brain',closeProperties:'close',minimizeScenePanel:'minified',closeScenePanel:'close',
 closeLog:'close',continueButton:'play',closeCall:'close',joinAudio:'mic',joinVideo:'video',leaveCall:'stop',closeProfile:'close',saveProfile:'check',
 'transform-translate':'move','transform-rotate':'rotate','transform-scale':'scale',robotEyeFront:'eye',robotEye180:'eye',robotEye360:'eye',openRobotBrains:'brain',openAvatarGallery:'avatar-3d',deleteObject:'delete',reloadScene:'history',saveScene:'check',
 saveSceneButton:'check',textureUploadButton:'photo',chatFile:'file',adminLogin:'check',adminRefresh:'history',
 closeAdmin:'close',roomSelect:'rooms',robotAvatar:'avatar-3d',uploadRobotAvatar:'avatar-maker',
};
// One semantic pictogram per type; never treat every geometry as a cube.
export const objectKindIcons=Object.freeze({
 cube:'cube',sphere:'sphere',cylinder:'cylinder',plane:'plane',torus:'torus',
 curve:'curve',surface:'surface',text:'text-object',points:'points',
 light:'light',robot:'avatar-3d',model:'model',wall:'square',
 'walls':'square','add 3d model':'model','point light':'light','spot light':'light',
 'directional light':'light','ambient light':'light','hemisphere light':'light'
});
export function iconForObjectKind(kind){return objectKindIcons[String(kind||'').trim().toLowerCase()]||'model';}
const words=[
 [/\b(?:sphere)\b/i,'sphere'],[/\b(?:cylinder)\b/i,'cylinder'],[/\b(?:torus)\b/i,'torus'],
 [/\b(?:plane)\b/i,'plane'],[/\b(?:curve)\b/i,'curve'],[/\b(?:surface)\b/i,'surface'],
 [/\b(?:points)\b/i,'points'],[/\b(?:text object)\b/i,'text-object'],
 [/\b(?:cube|box|geometry)\b/i,'cube'],[/\b(?:3d model|import model)\b/i,'model'],
 [/\b(?:light|lighting)\b/i,'light'],
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
const fileIcons=new Set('map attach opened minified reset move rotate scale add config chat rooms avatar-3d render download fullscreen captions mic sound-on sound-mute video camera photo eye brain send close x more profile users edit delete stop play pause copy window sidebar-in sidebar-out history preview file stream link check plus share drawing game chat-3d-orbit change-camera transcript background bottom exit media full grab cancel swap speak avatar-maker chat-3d-capture cube sphere cylinder torus plane curve surface text-object points light model list-objects collapse lock unlock upload webcam'.split(' '));
const utilityIconOnly=new Set(['webcamButton','minimizeScenePanel','toolboxMinimize','composerMinimize','composerFloat','minimapMinimize','minimapClose']);
// Header close controls have an accessible name but no extra visible x or text.
export function shouldUseIconOnlyControl(button){return /^(?:close[A-Z]|close$)/.test(button.id||'')||utilityIconOnly.has(button.id||'')||button.classList.contains('scene-item-delete')||button.classList.contains('scene-item-lock');}
export function iconForButton(button){
 if(button.id==='profileButton')return null;
 if(button.classList.contains('avatar-card')||button.classList.contains('asset-card'))return null; // Initials/avatar are the profile symbol.
 if(/^close[A-Z]/.test(button.id||''))return 'close';
 if(button.classList.contains('theme-swatch')||button.classList.contains('theme-preset'))return null;
 if(button.dataset?.uiIcon&&fileIcons.has(button.dataset.uiIcon))return button.dataset.uiIcon;
 const kind=button.dataset?.objectKind;
 if(kind)return iconForObjectKind(kind);
 if(button.closest?.('.scene-item-row')&&!button.classList.contains('scene-item-delete'))return null;
 const hint=[button.id||'',button.title||'',button.getAttribute('aria-label')||'',button.textContent||''].join(' ');
 const camel=(button.id||'').replace(/[A-Z]/g,c=>' '+c.toLowerCase());
 const icon=iconIds[button.id]||words.find(([pattern])=>pattern.test(camel+' '+hint))?.[1];
 return icon&&fileIcons.has(icon)?icon:null;
}
export function decorateButtons(root=document){
 const nodes=[];if(root.matches?.('button'))nodes.push(root);
 if(root.querySelectorAll)nodes.push(...root.querySelectorAll('button, label.icon-btn'));
 for(const b of nodes){if(b.id==='composerMove'||b.closest?.('.chat-attachment')||b.classList.contains('avatar-card')||b.classList.contains('asset-card'))continue;if(b.classList.contains('theme-swatch')||b.classList.contains('theme-preset'))continue;
  const name=(b.id==='minimizeScenePanel'?(document.getElementById('scenePanel')?.classList.contains('minimized')?'opened':'minified'):b.id==='toolboxMinimize'?(document.getElementById('editorToolbox')?.classList.contains('minimized')?'opened':'minified'):iconForButton(b));if(!name)continue;
  const label=(b.getAttribute('aria-label')||b.title||b.textContent||'').trim();
  if(!b.title&&label)b.title=label.slice(0,140);
  if(b.id==='settingsButton' && /^⚙\uFE0F?$/u.test(b.textContent.trim())){b.textContent='';b.classList.add('ui-icon-utility');}
  if(b.id==='composerToolsButton'){b.setAttribute('aria-label','More chat tools');b.textContent='';b.classList.add('ui-icon-utility');}
  if(shouldUseIconOnlyControl(b)){
   // Remove the original raw X / panel glyph; never show two close icons.
   if(!b.getAttribute('aria-label'))b.setAttribute('aria-label',label||'Close');
   b.textContent='';b.classList.add('ui-icon-utility');
  }else if(/^[×✕✖✗▣]$/.test((b.textContent||'').trim())){
   if(!b.getAttribute('aria-label'))b.setAttribute('aria-label',label||'Close');
   b.textContent='';b.classList.add('ui-icon-utility');
  }
  // Limit visible labels to two readable lines without altering button actions.
  if(!b.classList.contains('ui-icon-utility') && b.id!=='profileButton' &&
     !b.querySelector('.ui-button-label') && [...b.childNodes].every(n=>n.nodeType===3)){
   const raw=b.textContent.trim();
   if(raw){const labelSpan=document.createElement('span');labelSpan.className='ui-button-label';
    labelSpan.textContent=raw.replace(/^[+＋]\s*/u,'').replace(/\s*↗$/u,'');b.replaceChildren(labelSpan);}
  }
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
