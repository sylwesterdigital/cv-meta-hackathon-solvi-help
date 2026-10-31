import {confirmAction} from './app-dialogs.js';
import {readPreferences,updatePreferences,applyPreferences} from './preferences.js';
const $=id=>document.getElementById(id);
const FIELDS=['accent','theme','opacity','backgrounds','borders','group','sounds','flipHead','labelMode','uiScale','fontTheme','customFont','flatButtons','noShadows','noBlur'];
const sanitizedPrefs=data=>Object.fromEntries(FIELDS.filter(key=>Object.hasOwn(data||{},key)&&['string','boolean','number'].includes(typeof data[key])).map(key=>[key,data[key]]));
function save(name,data){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function initExtendedSettings({api,toast}){
 let presets=[];
 const update=async()=>{const list=$('themeSavedServer');const response=await api.req('/api/theme-presets');presets=response.presets||[];const old=list.value;list.replaceChildren(new Option('Select a saved theme',''),...presets.map(p=>new Option(p.name,p.name)));list.value=old;};
 $('themeSaveServer').onclick=async()=>{try{const name=$('themePresetName').value.trim();if(!name)throw Error('Enter a preset name');await api.req('/api/theme-presets',{method:'POST',body:JSON.stringify({name,theme:sanitizedPrefs(readPreferences())})});await update();$('themeSavedServer').value=name;$('themePresetStatus').textContent='Saved to your account.';}catch(e){$('themePresetStatus').textContent=e.message;}};
 $('themeLoadServer').onclick=()=>{const item=presets.find(p=>p.name===$('themeSavedServer').value);if(!item)return;const theme=sanitizedPrefs(item.theme);updatePreferences(theme);applyPreferences(readPreferences());window.dispatchEvent(new CustomEvent('solvi:prefs-changed',{detail:readPreferences()}));$('themePresetStatus').textContent='Applied saved theme.';};
 $('themeDeleteServer').onclick=async()=>{const name=$('themeSavedServer').value;if(!name)return;if(!await confirmAction(`Delete saved theme “${name}”?`,{title:'Delete theme preset',confirmLabel:'Delete',danger:true}))return;await api.req('/api/theme-presets/'+encodeURIComponent(name),{method:'DELETE'});await update();};
 $('themeExportJson').onclick=()=>save('solvi-theme.json',{format:'solvi-theme-v1',theme:sanitizedPrefs(readPreferences())});
 $('themeImportJson').onchange=async event=>{const file=event.target.files?.[0];event.target.value='';if(!file)return;try{const json=JSON.parse(await file.text());if(json.format!=='solvi-theme-v1'||!json.theme)throw Error('Invalid theme JSON');updatePreferences(sanitizedPrefs(json.theme));applyPreferences(readPreferences());window.dispatchEvent(new CustomEvent('solvi:prefs-changed',{detail:readPreferences()}));$('themePresetStatus').textContent='Imported and applied theme. Use Save theme for server persistence.';}catch(e){$('themePresetStatus').textContent=e.message;}};
 const check=async(provider,key,statusId)=>{const status=$(statusId);status.textContent='Checking account (read-only)…';try{const data=await api.req('/api/integrations/check',{method:'POST',body:JSON.stringify({provider,key})});
  if(provider==='meta')status.textContent=`Meta connected · ${data.models?.length||0} accessible model(s). ${data.balance_note||'Account balance not exposed'}`;
  if(provider==='elevenlabs')status.textContent=`ElevenLabs connected · tier: ${data.tier||'unknown'} · remaining characters/credits (estimate): ${data.remaining_credits??'not disclosed'} · ${data.voices?.length||0} listed voice(s)`;
  if(provider==='tripo')status.textContent=`Tripo3D connected · available: ${data.credits??'unknown'} credits · reserved: ${data.frozen??'unknown'}`;
  return data;
 }catch(error){status.textContent=error.message;return null;}};
 $('testMetaApiKey').onclick=()=>check('meta',$('metaApiKey').value.trim()||sessionStorage.getItem('solvi-meta-session-key'),'metaKeyStatus');
 $('testElevenLabsKey').onclick=()=>check('elevenlabs',$('elevenLabsKey').value.trim()||sessionStorage.getItem('solvi-elevenlabs-key'),'voiceKeyStatus');
 $('saveTripoKey').onclick=async()=>{const key=$('tripoApiKey').value.trim();if(!key){$('tripoKeyStatus').textContent='Enter a key';return;}const result=await check('tripo',key,'tripoKeyStatus');if(result){sessionStorage.setItem('solvi-tripo-key',key);$('tripoApiKey').value='';}};
 $('testTripoKey').onclick=()=>check('tripo',$('tripoApiKey').value.trim()||sessionStorage.getItem('solvi-tripo-key'),'tripoKeyStatus');
 $('testWhisper').onclick=async()=>{const status=$('ccEngineStatus');try{const result=await api.req('/api/integrations/whisper');status.textContent=result.ready?'Whisper ready · executable, model and FFmpeg available.':`Whisper not ready · executable: ${result.binary?'yes':'missing'} · model: ${result.model?'yes':'missing'} · FFmpeg: ${result.ffmpeg?'yes':'missing'}`;}catch(e){status.textContent=e.message;}};
 $('settingsButton')?.addEventListener('click',()=>update().catch(()=>{}));
 return {update};
}
