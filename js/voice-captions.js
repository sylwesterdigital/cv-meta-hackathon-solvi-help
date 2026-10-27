// Opt-in browser speech recognition and microphone activity: no raw audio is uploaded.
// Some browsers implement SpeechRecognition with remote transcription services.
export function setupVoiceCaptions(world){
  const captionButton=document.getElementById('captionsButton');
  const status=document.getElementById('captionStatus');
  const waveButton=document.getElementById('voiceWavesButton');
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  let recognition=null,recognizing=false,enabled=false,stream=null,ctx=null,analyser=null,source=null,tickId=0;
  const setStatus=text=>{if(status)status.textContent=text;};
  const stopMic=()=>{cancelAnimationFrame(tickId);stream?.getTracks().forEach(t=>t.stop());stream=null;source?.disconnect();analyser?.disconnect();ctx?.close().catch(()=>{});ctx=null;world.localVoiceLevel=0;world.localVoiceBands=[0,0,0];};
  async function startMic(){
    stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
    ctx=new AudioContext();source=ctx.createMediaStreamSource(stream);analyser=ctx.createAnalyser();analyser.fftSize=512;source.connect(analyser);
    const bytes=new Uint8Array(analyser.fftSize);const freqs=new Uint8Array(analyser.frequencyBinCount);
    let last=0;
    const sample=now=>{
      if(!stream)return;
      if(now-last>75){last=now;analyser.getByteTimeDomainData(bytes);let sum=0;for(let i=0;i<bytes.length;i++){const v=(bytes[i]-128)/128;sum+=v*v;}
        const rms=Math.sqrt(sum/bytes.length);world.localVoiceLevel=Math.min(1,Math.max(0,(rms-.02)*12));
        analyser.getByteFrequencyData(freqs);
        const hz=ctx.sampleRate/analyser.fftSize;
        const energy=(low,high)=>{let total=0,n=0;for(let j=Math.max(0,Math.floor(low/hz));j<Math.min(freqs.length,Math.ceil(high/hz));j++){total+=freqs[j];n++;}return n?Math.min(1,Math.max(0,((total/n)/255-.08)*2)):0;};
        world.localVoiceBands=[energy(90,360),energy(360,1600),energy(1600,7000)].map(v=>+v.toFixed(3));}

      tickId=requestAnimationFrame(sample);
    };tickId=requestAnimationFrame(sample);
  }
  function stopRecognition(){enabled=false;if(recognition){recognition.onend=null;try{recognition.stop();}catch{}}recognizing=false;recognition=null;captionButton.textContent='CC off';}
  captionButton?.addEventListener('click',()=>{
    if(enabled){stopRecognition();setStatus('Captions stopped');return;}
    if(!SpeechRecognition){setStatus('Live captions unavailable in this browser. Use Mic to attach audio.');return;}
    recognition=new SpeechRecognition();recognition.lang=navigator.language||'en-GB';recognition.continuous=true;recognition.interimResults=true;enabled=true;
    recognition.onresult=event=>{
      let interim='';
      for(let i=event.resultIndex;i<event.results.length;i++){
        const result=event.results[i],text=result[0]?.transcript?.trim()||'';if(!text)continue;
        if(result.isFinal){window.solviPublishCaption?.(text);}else interim+=text+' ';
      }
      if(interim)setStatus('Listening · '+interim.slice(-100));
    };
    recognition.onerror=event=>{setStatus('CC: '+event.error);if(['not-allowed','service-not-allowed','audio-capture'].includes(event.error))stopRecognition();};
    recognition.onend=()=>{recognizing=false;if(enabled){try{recognition.start();recognizing=true;}catch{enabled=false;captionButton.textContent='CC off';}}};
    try{recognition.start();recognizing=true;captionButton.textContent='CC on';setStatus('Live captions on · final speech appears in room chat');}
    catch(error){stopRecognition();setStatus(error.message);}
  });
  waveButton?.addEventListener('click',async()=>{
    if(stream){stopMic();waveButton.textContent='Voice waves';setStatus('Microphone activity off');return;}
    try{await startMic();waveButton.textContent='Waves on';setStatus('Microphone amplitude shared as numbers, not audio');}
    catch(error){stopMic();setStatus('Microphone: '+error.message);}
  });
  window.addEventListener('pagehide',()=>{stopRecognition();stopMic();});
}
