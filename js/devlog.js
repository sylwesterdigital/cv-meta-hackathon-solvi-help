const byId = id => document.getElementById(id);
export async function initDevLog(){
  const backdrop=byId('devBackdrop'); let autoClose=0;
  function open(){clearTimeout(autoClose);backdrop.hidden=false;backdrop.classList.add('open');}
  function close(){clearTimeout(autoClose);backdrop.hidden=true;backdrop.classList.remove('open');}
  byId('devLogButton').addEventListener('click',open); autoClose=setTimeout(close,3000);
  byId('closeLog').addEventListener('click',close);
  byId('continueButton').addEventListener('click',close);
  document.addEventListener('keydown',(e)=>{if(e.key==='Escape'&&!backdrop.hidden)close();});
  try {
    const response=await fetch('./releases.json',{cache:'no-store'});
    if(!response.ok)throw new Error('HTTP '+response.status);
    const data=await response.json();
    byId('version').textContent='v'+data.currentVersion;
    const entries=byId('logEntries'); entries.replaceChildren();
    for(const release of data.releases || []){
      const section=document.createElement('article');section.className='release';
      const header=document.createElement('div');header.className='release-head';
      const title=document.createElement('strong');title.textContent='v'+release.version;
      const date=document.createElement('time');const moment=new Date(release.publishedAt||'');date.dateTime=release.publishedAt||'';date.textContent=Number.isFinite(+moment)?moment.toLocaleString([], {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}):'Initial release';
      header.append(title,date);section.append(header);
      const ul=document.createElement('ul');
      for(const text of release.changes||[]){const li=document.createElement('li');li.textContent=text;ul.append(li);}
      section.append(ul);entries.append(section);
    }
    byId('buildDetails').textContent='Latest release: v'+data.currentVersion;
  } catch(error){byId('logEntries').textContent='Release history unavailable: '+error.message;}
  // Static deployments are detected from the authoritative release manifest.
  // A changed published version reloads the application with its new modules and styles.
  let activeVersion=byId('version').textContent.trim().replace(/^v/,'');
  let checking=false;
  async function checkVersion(){
    if(checking||document.hidden)return;checking=true;
    try{
      const r=await fetch('/releases.json?poll='+Date.now(),{cache:'no-store'});
      if(r.ok){const next=(await r.json()).currentVersion;
        if(next&&activeVersion&&next!==activeVersion){
          const key='solvi-reloaded-'+next;
          if(sessionStorage.getItem(key)!=='1'){
            sessionStorage.setItem(key,'1');location.reload();
          }
        }
      }
    }catch{}finally{checking=false;}
  }
  window.setInterval(checkVersion,12000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkVersion();});
}
