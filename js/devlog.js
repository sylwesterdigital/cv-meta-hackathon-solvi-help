const byId = id => document.getElementById(id);
export async function initDevLog(){
  const backdrop=byId('devBackdrop');
  function open(){backdrop.hidden=false;backdrop.classList.add('open');}
  function close(){backdrop.hidden=true;backdrop.classList.remove('open');}
  byId('devLogButton').addEventListener('click',open);
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
      const date=document.createElement('time');date.textContent=(release.publishedAt||'').slice(0,10)||'Initial release';
      header.append(title,date);section.append(header);
      const ul=document.createElement('ul');
      for(const text of release.changes||[]){const li=document.createElement('li');li.textContent=text;ul.append(li);}
      section.append(ul);entries.append(section);
    }
    byId('buildDetails').textContent='Latest release: v'+data.currentVersion;
  } catch(error){byId('logEntries').textContent='Release history unavailable: '+error.message;}
}
