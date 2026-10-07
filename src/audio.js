'use strict';
// Short, locally synthesized foley. Uses its own mix bus in the ambience context.
// No game RNG is used: sound variations cannot change survival outcomes.
function createActionAudio() {
  let context, output, limiter, noiseBuffer, enabled=false, volume=.65;
  const voices=new Set();
  const jitter=(value,amount=.08)=>value*(1+(Math.random()*2-1)*amount);

  function attach(audioContext) {
    if(context===audioContext)return;
    context=audioContext;
    output=context.createGain();
    output.gain.value=enabled?volume:0;
    limiter=context.createDynamicsCompressor();
    limiter.threshold.value=-14;
    limiter.knee.value=12;
    limiter.ratio.value=5;
    limiter.attack.value=.003;
    limiter.release.value=.12;
    output.connect(limiter);limiter.connect(context.destination);
    noiseBuffer=context.createBuffer(1,context.sampleRate,context.sampleRate);
    const data=noiseBuffer.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
  }
  function setEnabled(value) {
    enabled=Boolean(value);
    if(!context)return;
    output.gain.cancelScheduledValues(context.currentTime);
    output.gain.setTargetAtTime(enabled?volume:0,context.currentTime,.012);
    if(!enabled)for(const source of voices)source.stop(context.currentTime+.035);
  }
  function setVolume(value) {
    if(!Number.isFinite(value))return;
    volume=Math.max(0,Math.min(1,value));
    if(context&&enabled)output.gain.setTargetAtTime(volume,context.currentTime,.03);
  }
  function voice(source,nodes,delay,length,level,attack=.008) {
    if(voices.size>=48)return; // Bound overlapping sounds when actions are clicked quickly.
    const start=context.currentTime+delay, envelope=context.createGain();
    envelope.gain.setValueAtTime(0,start);
    envelope.gain.linearRampToValueAtTime(level,start+attack);
    envelope.gain.exponentialRampToValueAtTime(.0001,start+length);
    let tail=source;
    for(const node of nodes){tail.connect(node);tail=node;}
    tail.connect(envelope);envelope.connect(output);voices.add(source);
    source.onended=()=>{voices.delete(source);source.disconnect();nodes.forEach(n=>n.disconnect());envelope.disconnect();};
    source.start(start);source.stop(start+length+.015);
  }
  function tone(freq,length=.15,level=.13,delay=0,end=freq,shape='sine') {
    if(voices.size>=48)return;
    const source=context.createOscillator(),start=context.currentTime+delay;
    source.type=shape;source.frequency.setValueAtTime(freq,start);
    source.frequency.exponentialRampToValueAtTime(Math.max(20,end),start+length);
    voice(source,[],delay,length,level);
  }
  function noise(length=.15,level=.15,delay=0,freq=1200,kind='lowpass',end=freq) {
    if(voices.size>=48)return;
    const source=context.createBufferSource(),filter=context.createBiquadFilter();
    source.buffer=noiseBuffer;source.loop=true;filter.type=kind;filter.Q.value=.7;
    filter.frequency.setValueAtTime(freq,context.currentTime+delay);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40,end),context.currentTime+delay+length);
    voice(source,[filter],delay,length,level,length>.4?.04:.008);
  }
  const taps=(count,spacing,fn)=>{for(let i=0;i<count;i++)fn(i*spacing,i);};
  function wood(delay=0){noise(.12,.22,delay,750);tone(jitter(170),.12,.18,delay,65,'triangle');}
  function stone(delay=0){noise(.06,.12,delay,2900,'highpass');tone(jitter(1450),.22,.10,delay,1100,'triangle');tone(jitter(2360),.14,.045,delay,2050);}
  function rustle(delay=0){noise(.28,.2,delay,jitter(2000),'bandpass',650);}
  function droplet(delay=0,freq=470){tone(jitter(freq),.11,.12,delay,freq*1.7);}
  function step(delay=0){noise(.15,.24,delay,650);noise(.10,.09,delay+.025,2100,'bandpass');tone(85,.10,.09,delay,48);}
  function chime(notes,delay=0){notes.forEach((f,i)=>tone(f,.32,.10,delay+i*.13,f));}

  function play(action,detail={}) {
    if(!enabled||!context||context.state==='closed')return;
    switch(action) {
      case 'wood':taps(3,.18,wood);break;
      case 'stone':taps(3,.15,stone);break;
      case 'fiber':case 'forage':taps(3,.12,rustle);break;
      case 'water':noise(.7,.23,0,1800,'lowpass',850);taps(5,.10,t=>droplet(t+.10));break;
      case 'fish':noise(.2,.12,0,2400,'bandpass',600);noise(.36,.23,.22,1500);taps(3,.10,t=>droplet(t+.27));break;
      case 'hunt':noise(.26,.18,0,2400,'bandpass',300);if(detail.gained)wood(.29);else rustle(.34);break;
      case 'explore':taps(3,.22,step);rustle(.62);break;
      case 'travel':taps(5,.18,step);break;
      case 'craft':
        if(detail.camp)taps(4,.17,wood);
        else if(detail.medical)taps(2,.14,rustle);
        else {stone(0);wood(.16);stone(.32);}
        chime([523,659],.62);break;
      case 'dismantle':wood();rustle(.14);wood(.32);noise(.35,.18,.45,500);break;
      case 'fire':
        noise(.08,.12,0,3600,'highpass');noise(.48,.25,.1,650,'lowpass',2100);
        taps(6,.08,t=>noise(.025,.13,t+.25,jitter(2600),'highpass'));break;
      case 'boil':noise(.68,.14,0,1300);taps(7,.085,(t,i)=>droplet(t,290+i*47));break;
      case 'cook':case 'dry':noise(.85,.16,0,3400,'highpass',1700);taps(6,.09,t=>noise(.035,.1,t+.05,2600));break;
      case 'consume':
        if(detail.itemType==='water'){taps(3,.18,t=>{droplet(t,260);noise(.10,.1,t,850);});}
        else if(detail.itemType==='medical'){rustle();chime([440,554,659],.22);}
        else {taps(3,.16,t=>{noise(.09,.18,t,1500);tone(jitter(120),.08,.08,t,65);});}
        break;
      case 'stash':case 'take':case 'drop':rustle();wood(.14);break;
      case 'rest':noise(.6,.09,0,470,'lowpass',220);chime([330,392],.15);break;
      case 'sleep':chime([392,330,262]);noise(.85,.08,.12,500,'lowpass',180);break;
      case 'signal':noise(.6,.09,0,2400,'bandpass');taps(3,.17,t=>tone(880,.075,.12,t+.10));chime([523,659,784],.66);break;
      case 'encounter':rustle();chime([293,311],.25);break;
      case 'choice':if(detail.hurt){wood();tone(150,.25,.10,.07,85);}else chime([392,523]);break;
      case 'error':tone(160,.10,.085,0,130);tone(130,.13,.06,.12,105);break;
      case 'win':chime([392,523,659,784]);tone(523,.8,.07,.4);break;
      case 'lose':chime([294,247,196]);noise(.6,.09,.25,400,'lowpass',100);break;
      case 'preview':wood();droplet(.2);chime([523,659],.4);break;
    }
  }
  return {attach,setEnabled,setVolume,play};
}

// Continuous weather ambience shares the context with action effects, but has
// its own volume control. Nothing starts until the player enables sound.
function createNatureAudio() {
  let context, output, windGain, rainGain, enabled=false, volume=.65;
  function attach(audioContext) {
    if(context===audioContext)return;
    context=audioContext;
    output=context.createGain();output.gain.value=0;output.connect(context.destination);
    const windBuffer=context.createBuffer(1,context.sampleRate*4,context.sampleRate);
    const windData=windBuffer.getChannelData(0);
    let last=0;
    for(let i=0;i<windData.length;i++){last=(last+(Math.random()*2-1)*.02)/1.02;windData[i]=last*3.5;}
    const wind=context.createBufferSource(),windFilter=context.createBiquadFilter();
    wind.buffer=windBuffer;wind.loop=true;windFilter.type='lowpass';windFilter.frequency.value=600;
    windGain=context.createGain();windGain.gain.value=.12;
    wind.connect(windFilter);windFilter.connect(windGain);windGain.connect(output);wind.start();

    const rainBuffer=context.createBuffer(1,context.sampleRate*3,context.sampleRate);
    const rainData=rainBuffer.getChannelData(0);
    for(let i=0;i<rainData.length;i++)rainData[i]=Math.random()*2-1;
    const rain=context.createBufferSource(),rainFilter=context.createBiquadFilter();
    rain.buffer=rainBuffer;rain.loop=true;rainFilter.type='lowpass';rainFilter.frequency.value=2600;
    rainGain=context.createGain();rainGain.gain.value=0;
    rain.connect(rainFilter);rainFilter.connect(rainGain);rainGain.connect(output);rain.start();
    setEnabled(enabled);
  }
  function setEnabled(value) {
    enabled=Boolean(value);
    if(context)output.gain.setTargetAtTime(enabled?volume:0,context.currentTime,.18);
  }
  function setVolume(value) {
    if(!Number.isFinite(value))return;
    volume=Math.max(0,Math.min(1,value));
    if(context&&enabled)output.gain.setTargetAtTime(volume,context.currentTime,.08);
  }
  function update(weather) {
    if(!context)return;
    windGain.gain.setTargetAtTime(weather==='storm'?.22:weather==='rain'?.14:.12,context.currentTime,.7);
    rainGain.gain.setTargetAtTime(weather==='storm'?.16:weather==='rain'?.09:0,context.currentTime,.7);
  }
  function bird(state) {
    if(!enabled||!context||context.state!=='running'||volume===0||state.time>=1140||state.weather==='rain'||state.weather==='storm')return;
    const start=context.currentTime,osc=context.createOscillator(),gain=context.createGain();
    osc.type='sine';
    osc.frequency.setValueAtTime(1900+Math.random()*300,start);
    osc.frequency.exponentialRampToValueAtTime(3100,start+.08);
    osc.frequency.exponentialRampToValueAtTime(1750,start+.22);
    osc.frequency.exponentialRampToValueAtTime(2800,start+.32);
    gain.gain.setValueAtTime(.0001,start);
    gain.gain.exponentialRampToValueAtTime(.04,start+.025);
    gain.gain.exponentialRampToValueAtTime(.0001,start+.38);
    osc.connect(gain);gain.connect(output);
    osc.onended=()=>{osc.disconnect();gain.disconnect();};
    osc.start(start);osc.stop(start+.4);
  }
  return {attach,setEnabled,setVolume,update,bird};
}
