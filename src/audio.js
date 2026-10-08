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
  function tone(freq,length=.15,level=.13,delay=0,end=freq,shape='sine',attack=.008) {
    if(voices.size>=48)return;
    const source=context.createOscillator(),start=context.currentTime+delay;
    source.type=shape;source.frequency.setValueAtTime(freq,start);
    source.frequency.exponentialRampToValueAtTime(Math.max(20,end),start+length);
    voice(source,[],delay,length,level,attack);
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
  // ---- Foley building blocks. Each is a few short voices; none touches game state or the simulation RNG. ----
  function wood(delay=0){noise(.12,.22,delay,750);tone(jitter(170),.12,.18,delay,65,'triangle');}          // dull log thud
  function chop(delay=0){noise(.07,.26,delay,1500,'bandpass',500);tone(jitter(260),.09,.2,delay,110,'triangle',.003);} // axe biting wood
  function crack(delay=0){noise(.05,.2,delay,3200,'highpass');noise(.22,.12,delay+.04,1200,'bandpass',300);tone(jitter(520),.12,.06,delay,180,'sawtooth',.003);} // wood splitting
  function knock(delay=0){tone(jitter(310),.1,.15,delay,190,'triangle',.003);noise(.04,.12,delay,1100,'bandpass');}  // hollow wood
  function hammer(delay=0){noise(.05,.2,delay,2200,'bandpass',900);tone(jitter(430),.07,.15,delay,270,'triangle',.003);tone(jitter(190),.1,.12,delay,90,'triangle',.003);}
  function creak(delay=0){tone(jitter(130),.22,.045,delay,190,'sawtooth',.03);}
  function stone(delay=0){noise(.06,.12,delay,2900,'highpass');tone(jitter(1450),.22,.10,delay,1100,'triangle');tone(jitter(2360),.14,.045,delay,2050);}
  function flake(delay=0){noise(.025,.2,delay,4500,'highpass');tone(jitter(1900),.06,.06,delay,1500,'sine',.002);} // stone chip being knapped
  function pebbles(delay=0){taps(6,.045,t=>noise(.02,.08,delay+t,jitter(3400),'highpass'));}
  function rustle(delay=0){noise(.28,.2,delay,jitter(2000),'bandpass',650);}
  function leaf(delay=0){noise(.14,.1,delay,jitter(3000),'bandpass',1800);}                                  // soft foliage
  function rip(delay=0,length=.26){noise(length,.2,delay,4200,'highpass',1500);taps(4,length/5,t=>noise(.02,.12,delay+t,jitter(2800),'highpass'));} // fibre or cloth tearing
  function scrape(delay=0,length=.2){noise(length,.14,delay,1600,'bandpass',3400);}                          // whittling
  function grind(delay=0,length=.38){noise(length,.16,delay,700,'bandpass',480);tone(95,length,.05,delay,80,'triangle',.05);}
  function pluck(delay=0){tone(jitter(1100),.05,.05,delay,1500,'sine',.002);noise(.03,.06,delay,3600,'highpass');}
  function droplet(delay=0,freq=470){tone(jitter(freq),.11,.12,delay,freq*1.7);}
  function splash(delay=0){noise(.22,.2,delay,2200,'bandpass',700);droplet(delay+.05,520);droplet(delay+.12,430);}
  function whoosh(delay=0,from=600,to=2600,length=.22){noise(length,.16,delay,from,'bandpass',to);}
  function crunch(delay=0,level=.18){noise(.06,level,delay,2800,'highpass');noise(.1,level*.8,delay+.01,900,'bandpass');}
  function squelch(delay=0){noise(.1,.16,delay,520,'lowpass',260);tone(jitter(150),.1,.08,delay,80,'triangle',.01);}
  function gulp(delay=0){tone(jitter(190),.09,.1,delay,120,'sine',.01);droplet(delay,330);}
  function step(delay=0,surface='grass'){
    if(surface==='gravel'){noise(.09,.22,delay,3200,'highpass',1200);noise(.12,.12,delay+.01,900,'bandpass');tone(85,.08,.07,delay,50);}
    else if(surface==='water'){noise(.14,.18,delay,1800,'bandpass',700);droplet(delay+.04,520);tone(80,.08,.07,delay,50);}
    else if(surface==='leaf'){noise(.15,.2,delay,1900,'bandpass',900);noise(.08,.1,delay+.03,3200,'highpass');tone(85,.09,.08,delay,50);}
    else {noise(.15,.24,delay,650);noise(.10,.09,delay+.025,2100,'bandpass');tone(85,.10,.09,delay,48);}
  }
  const surfaceAt=site=>({forest:'leaf',valley:'leaf',river:'water',rocks:'gravel',ruins:'gravel',ridge:'gravel'})[site]||'grass';
  // Bell timbre: a fundamental plus quickly fading upper partials. Plain sine beeps sound like system errors; these sound finished.
  function bell(freq,delay=0,level=.14,length=.55){
    tone(freq,length,level,delay,freq,'sine',.004);
    tone(freq*2.76,length*.45,level*.3,delay,freq*2.76,'sine',.002);
    tone(freq*5.4,length*.2,level*.1,delay,freq*5.4,'sine',.002);
  }
  function chime(notes,delay=0,gap=.13,level=.14,length=.55){notes.forEach((f,i)=>bell(f,delay+i*gap,level,length));}
  function clink(delay=0,freq=2300){bell(freq,delay,.07,.3);noise(.012,.1,delay,5000,'highpass');}              // metal on metal

  // What building each thing sounds like: the work first, then a finishing flourish that fits what was made.
  const crafts={
    shelter:()=>{taps(3,.15,t=>wood(t));rip(.45);taps(3,.1,t=>leaf(.75+t));creak(.8);chime([262,392,523],1,.08,.12,.6);},
    firepit:()=>{taps(4,.13,t=>stone(t));scrape(.55,.18);taps(5,.05,t=>noise(.02,.1,.78+t,jitter(2600),'highpass'));chime([330,392],.95,.12,.11,.55);},
    bed:()=>{taps(5,.11,t=>leaf(t));rustle(.3);tone(220,.7,.05,.5,220,'sine',.25);chime([392],.75,.1,.08,.6);},
    collector:()=>{knock(0);knock(.14);clink(.3);taps(3,.1,t=>droplet(.5+t,380+t*400));chime([523,784],.85,.1,.1,.5);},
    rack:()=>{taps(3,.13,t=>knock(t));rip(.42,.2);creak(.62);chime([440,554],.8,.1,.11,.5);},
    axe:()=>{taps(5,.09,t=>flake(t));scrape(.5,.16);rip(.7,.2);chime([523,659,784],.95,.08,.12,.55);clink(1.15);},
    spear:()=>{taps(3,.2,t=>scrape(t,.17));rip(.65,.2);whoosh(.9,500,2600,.18);chime([523,659,880],1.05,.08,.12,.5);},
    rod:()=>{rip(0,.16);clink(.2);tone(2400,.1,.05,.32,3300,'sine',.01);droplet(.5);chime([659,784,988],.7,.08,.11,.5);},
    coat:()=>{rip(0,.3);rustle(.3);rip(.55,.3);chime([392,494,587],.95,.1,.1,.5);},
    pack:()=>{rustle(0);rustle(.22);clink(.5);clink(.58,3000);wood(.72);chime([440,554,659],.9,.09,.11,.5);},
    medicine:()=>{grind(0,.4);droplet(.45,560);droplet(.55,640);chime([659,784],.7,.14,.09,.6);},
    bandage:()=>{rip(0,.2);rustle(.3);leaf(.6);leaf(.72);chime([587,740],.85,.12,.09,.5);}
  };
  const eats={
    water:()=>taps(3,.18,t=>{gulp(t);noise(.1,.08,t,850);}),
    dirty:()=>{taps(3,.2,t=>gulp(t));noise(.5,.06,.1,420,'lowpass',250);},
    berries:()=>taps(3,.15,t=>{pluck(t);crunch(t+.03,.1);squelch(t+.06);}),
    cooked:()=>{rip(0,.14);taps(3,.15,t=>crunch(.2+t,.16));},
    dried:()=>taps(4,.2,t=>{crunch(t,.22);creak(t+.05);}),
    ration:()=>{taps(3,.16,t=>crunch(t,.2));rustle(.5);},
    raw:()=>taps(3,.18,t=>{squelch(t);noise(.05,.1,t+.04,2400,'highpass');}),
    medicine:()=>{gulp(0);rustle(.2);chime([440,554,659],.38,.11,.11);},
    bandage:()=>{rip(0,.2);rustle(.28);leaf(.5);chime([587],.6,.1,.09,.5);}
  };

  function play(action,detail={}) {
    if(!enabled||!context||context.state==='closed')return;
    switch(action) {
      case 'wood':taps(3,.2,t=>chop(t));crack(.62);rustle(.82);break;
      case 'stone':taps(3,.15,t=>stone(t));pebbles(.5);break;
      case 'fiber':rip(0,.22);rip(.3,.22);rustle(.6);break;
      case 'forage':leaf(0);pluck(.15);pluck(.3);leaf(.42);pluck(.58);break;
      case 'water':noise(.7,.23,0,1800,'lowpass',850);taps(5,.10,t=>droplet(t+.10));break;
      case 'filter':noise(.55,.1,0,500,'lowpass',250);taps(6,.09,(t,i)=>droplet(.25+t,300+i*35));chime([659],.85,.1,.08,.5);break;
      case 'fish':whoosh(0,600,3200,.2);splash(.24);taps(5,.05,t=>noise(.012,.12,.6+t,5000,'highpass'));break;
      case 'hunt':whoosh(0,500,2400,.22);if(detail.gained){wood(.26);rustle(.42);}else{rustle(.3);whoosh(.5,2000,500,.14);}break;
      case 'explore':taps(3,.22,t=>step(t,surfaceAt(detail.site)));leaf(.62);rustle(.72);break;
      case 'travel':taps(5,.18,t=>step(t,surfaceAt(detail.site)));break;
      case 'craft':{
        const build=crafts[detail.recipe];
        if(build)build();
        else {taps(4,.15,hammer);chime([523,659,784,1047],.66,.075,.12,.7);}
        break;}
      case 'repair':taps(3,.16,hammer);rip(.5,.16);creak(.65);chime([440,523],.8,.1,.1,.5);break;
      case 'reinforce':taps(3,.17,t=>wood(t));creak(.2);creak(.45);knock(.62);chime([330,392],.8,.12,.1,.55);break;
      case 'clear':taps(3,.18,t=>chop(t));crack(.56);creak(.62);wood(.9);rustle(1);break;
      case 'dismantle':creak(0);crack(.16);crack(.34);taps(4,.07,t=>wood(.55+t));noise(.35,.18,.7,500);break;
      case 'fire':
        taps(2,.09,t=>stone(t));noise(.3,.1,.14,3600,'highpass');noise(.48,.25,.3,650,'lowpass',2100);
        taps(6,.08,t=>noise(.025,.13,t+.45,jitter(2600),'highpass'));break;
      case 'boil':noise(.68,.14,0,1300);taps(7,.085,(t,i)=>droplet(t,290+i*47));break;
      case 'cook':noise(.85,.16,0,3400,'highpass',1700);taps(6,.09,t=>noise(.035,.1,t+.05,2600));break;
      case 'dry':noise(.9,.07,0,1600,'bandpass',900);taps(4,.2,t=>noise(.03,.1,t+.1,jitter(2400),'highpass'));creak(.5);break;
      case 'consume':{
        const eat=eats[detail.item]||(detail.itemType==='water'?eats.water:detail.itemType==='medical'?eats.medicine:eats.cooked);
        eat();break;}
      case 'stash':rustle();knock(.16);wood(.3);break;
      case 'take':creak(0);rustle(.1);tone(700,.08,.05,.3,900,'sine',.004);break;
      case 'drop':whoosh(0,1800,400,.12);wood(.12);pebbles(.22);break;
      case 'rest':noise(.6,.09,0,470,'lowpass',220);chime([330,392],.15,.16,.09,.7);break;
      case 'sleep':tone(220,1.1,.06,0,220,'sine',.35);tone(330,1.1,.045,0,330,'sine',.4);noise(.85,.06,.1,500,'lowpass',180);chime([392,523],.5,.35,.07,.8);break;
      case 'signal':noise(.6,.09,0,2400,'bandpass');taps(3,.17,t=>tone(880,.075,.12,t+.10));chime([523,659,784],.66,.13,.12);break;
      case 'encounter':rustle();chime([293,311],.25,.13,.1,.5);break;
      case 'choice':if(detail.hurt){wood();tone(150,.25,.10,.07,85);}else chime([392,523],0,.13,.12);break;
      case 'error':noise(.07,.16,0,380,'lowpass');tone(150,.12,.11,0,95,'triangle',.004);tone(118,.14,.08,.1,76,'triangle',.004);break;
      case 'win':chime([392,523,659,784],0,.12,.13);[523,659,784].forEach(f=>bell(f,.58,.09,1));break;
      case 'lose':chime([294,247,196],0,.18,.1,.7);noise(.6,.09,.25,400,'lowpass',100);break;
      case 'preview':wood();droplet(.2);chime([523,659],.4,.13,.1);break;
      case 'tab':noise(.03,.07,0,3200,'highpass');tone(jitter(880),.05,.04,0,700,'sine',.002);break;
    }
  }
  return {attach,setEnabled,setVolume,play};
}

// Continuous weather ambience shares the context with action effects, but has
// its own volume control. Nothing starts until the player enables sound.
function createNatureAudio() {
  let context, output, windGain, rainGain, rumble, enabled=false, volume=.65;
  function attach(audioContext) {
    if(context===audioContext)return;
    context=audioContext;
    output=context.createGain();output.gain.value=0;output.connect(context.destination);
    const windBuffer=context.createBuffer(1,context.sampleRate*4,context.sampleRate);
    const windData=windBuffer.getChannelData(0);
    let last=0;
    for(let i=0;i<windData.length;i++){last=(last+(Math.random()*2-1)*.02)/1.02;windData[i]=last*3.5;}
    rumble=windBuffer;
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
  // Occasional wildlife and weather accents. The scheduler in game.js calls ambient() every few seconds;
  // it picks what fits the time and weather. Individual voices are exposed so they can be tested directly.
  function pan(value){
    if(!context.createStereoPanner)return output;
    const node=context.createStereoPanner();node.pan.value=value;node.connect(output);return node;
  }
  function chirp(start,notes,length,level,dest){
    const osc=context.createOscillator(),gain=context.createGain();
    osc.type='sine';
    osc.frequency.setValueAtTime(notes[0],start);
    notes.slice(1).forEach((f,i)=>osc.frequency.exponentialRampToValueAtTime(f,start+length*(i+1)/(notes.length-1)));
    gain.gain.setValueAtTime(.0001,start);
    gain.gain.exponentialRampToValueAtTime(level,start+.02);
    gain.gain.exponentialRampToValueAtTime(.0001,start+length);
    osc.connect(gain);gain.connect(dest);
    osc.onended=()=>{osc.disconnect();gain.disconnect();};
    osc.start(start);osc.stop(start+length+.02);
  }
  const birdCalls=[
    {notes:[1900,3100,1750,2800],length:.36,repeat:[1,2]},      // two-note whistle
    {notes:[2500,3500,2700],length:.18,repeat:[3,5],gap:.15},   // quick trill
    {notes:[1500,2300,1600],length:.3,repeat:[2,3],gap:.4,level:.07}      // slow, lower song
  ];
  function bird(which=Math.floor(Math.random()*birdCalls.length)){
    const call=birdCalls[which%birdCalls.length];
    const count=call.repeat[0]+Math.floor(Math.random()*(call.repeat[1]-call.repeat[0]+1));
    const dest=pan(Math.random()*1.6-.8),base=context.currentTime+.02,shift=1+(Math.random()*.16-.08);
    for(let i=0;i<count;i++)chirp(base+i*(call.gap||.32),call.notes.map(f=>f*shift),call.length,call.level||.06,dest);
  }
  function cricket(){
    const dest=pan(Math.random()*1.6-.8),start=context.currentTime+.02,osc=context.createOscillator(),gain=context.createGain();
    osc.type='sine';osc.frequency.value=4100+Math.random()*500;
    gain.gain.setValueAtTime(.0001,start);
    const groups=2+Math.floor(Math.random()*2);
    let t=start;
    for(let g=0;g<groups;g++){
      for(let i=0;i<4;i++){
        gain.gain.linearRampToValueAtTime(.018,t+.012);
        gain.gain.linearRampToValueAtTime(.0001,t+.04);
        t+=.06;
      }
      t+=.22;
    }
    osc.connect(gain);gain.connect(dest);
    osc.onended=()=>{osc.disconnect();gain.disconnect();};
    osc.start(start);osc.stop(t+.05);
  }
  function thunder(){
    const start=context.currentTime+.02,source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();
    source.buffer=rumble;source.loop=true;
    filter.type='lowpass';
    filter.frequency.setValueAtTime(260,start);
    filter.frequency.exponentialRampToValueAtTime(70,start+2.6);
    gain.gain.setValueAtTime(.0001,start);
    gain.gain.linearRampToValueAtTime(.8,start+.25);
    gain.gain.exponentialRampToValueAtTime(.0001,start+2.8);
    source.connect(filter);filter.connect(gain);gain.connect(output);
    source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
    source.start(start);source.stop(start+2.85);
  }
  function ambient(state){
    if(!enabled||!context||context.state!=='running'||volume===0)return;
    if(state.weather==='storm'){if(Math.random()<.55)thunder();return;}
    if(state.weather==='rain')return;
    if(state.time>=1140)cricket();else bird();
  }
  return {attach,setEnabled,setVolume,update,ambient,bird,cricket,thunder};
}
