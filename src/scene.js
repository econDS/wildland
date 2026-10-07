'use strict';
// Locally rendered landscape. No external textures, fonts or network required.
// Layers: cached sky → animated sky life (sun/moon, stars, clouds, birds) → cached land → animated effects.
const Landscape=(()=>{
let canvas,ctx,sky,land,scratch,noise,grain,state,lastKey='',frame=0,lastPaint=0,reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let pal,phase=1,clouds=[],stars=[],fogSprite,glowSprite;
const W=1200,H=580,TAU=Math.PI*2;
const PALETTES=[
{top:'#5f7092',hor:'#f0b98f',far:'#a3949a',mid:'#5d6d64',near:'#2d4739',dark:'#152a21',sun:'#ffd9a8',cloud:'#f6d2b8',shade:'#8a7c8e',fog:'#ecd6c4',water:'#ffe0c0'},
{top:'#7fa9b0',hor:'#e7dfbd',far:'#9fb39c',mid:'#4f7359',near:'#2c553d',dark:'#163827',sun:'#fff6d6',cloud:'#fbf8ec',shade:'#b3beb6',fog:'#e4e6d3',water:'#eef4e0'},
{top:'#4b5474',hor:'#eaa465',far:'#8e7c77',mid:'#4a584a',near:'#283c2f',dark:'#13251c',sun:'#ffc07a',cloud:'#f1b489',shade:'#6e5f6e',fog:'#e5b891',water:'#ffcf98'},
{top:'#08121d',hor:'#1f3440',far:'#2a4145',mid:'#1a3030',near:'#112423',dark:'#091817',sun:'#e2e9d9',cloud:'#34464f',shade:'#141e25',fog:'#3f5559',water:'#a8c4c8'}];
const WEATHER_TINT={clear:null,cloudy:['#8e9791',.3],rain:['#6d7b77',.45],storm:['#434e4d',.58]};
const SITE_TINT={forest:['#1d4a2c',.22],river:['#3a7771',.18],rocks:['#6c6f67',.25],ruins:['#7b6848',.18],valley:['#88a295',.16],ridge:['#5a7387',.2]};
const AMBIENT=[['#ffb090',.05],null,['#ff9a50',.08],['#06121c',.4]];
function rand(seed){let n=seed>>>0;return ()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
function rgb(h){const n=parseInt(h.slice(1),16);return [n>>16,n>>8&255,n&255];}
function mix(a,b,t){const x=rgb(a),y=rgb(b);return '#'+x.map((v,i)=>Math.round(v+(y[i]-v)*t).toString(16).padStart(2,'0')).join('');}
function alpha(hex,a){return hex+Math.round(Math.max(0,Math.min(1,a))*255).toString(16).padStart(2,'0');}
function polygon(c,points,fill){c.fillStyle=fill;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();}
function surface(w,h){const cv=document.createElement('canvas');cv.width=w;cv.height=h;return cv;}
function phaseOf(s){return s.time>=1140?3:s.time>=990?2:s.time<540?0:1;}
function sunAt(time){const f=Math.max(0,Math.min(1,(time-360)/820));return [W*(.12+.76*f),H*(.3-.2*Math.sin(Math.PI*f))+(f>.8?(f-.8)*H*.9:0)];}
function moonAt(time){const f=Math.max(0,Math.min(1,(time-1140)/180));return [W*(.24+.2*f),H*(.22-.05*f)];}
function palette(s){
const p={...PALETTES[phaseOf(s)]},w=WEATHER_TINT[s.weather],site=SITE_TINT[s.location],night=phaseOf(s)===3;
if(w){const k=night?w[1]*.45:w[1];['top','hor','far','mid','sun','cloud','fog','water'].forEach(x=>p[x]=mix(p[x],w[0],x==='top'||x==='hor'?k*1.15:k));p.shade=mix(p.shade,w[0],.3);}
if(site)['far','mid','near'].forEach(x=>p[x]=mix(p[x],site[0],site[1]));
return p;}
function pine(c,x,y,h,color,r){
c.fillStyle=color;c.fillRect(x-h*.013,y-h,h*.026,h);const width=h*(.15+r()*.08);
for(let i=0;i<9;i++){const t=(i+1)/10,yy=y-h+h*t*.84,ww=width*t;const pts=[[x,y-h-h*.035],[x+ww*.8,yy-h*.035]];
for(let j=0;j<4;j++)pts.push([x+ww*(1-j*.15)+(r()-.5)*ww*.2,yy+j*h*.019]);
pts.push([x,yy+h*.06],[x-ww,yy+h*.04],[x-ww*.6,yy-h*.04]);polygon(c,pts,color);}
}
function cloudSprite(r,col,shade){
const w=360,h=140,cv=surface(w,h),g=cv.getContext('2d');
for(let i=0;i<15;i++){const x=w*.14+r()*w*.72,lift=Math.abs(x-w/2)<w*.22?h*.14:0,y=h*.5+r()*h*.22-lift,rad=h*(.17+r()*.2);const gr=g.createRadialGradient(x,y-rad*.25,0,x,y,rad);gr.addColorStop(0,alpha(col,.9));gr.addColorStop(.62,alpha(col,.55));gr.addColorStop(1,alpha(col,0));g.fillStyle=gr;g.beginPath();g.arc(x,y,rad,0,TAU);g.fill();}
g.globalCompositeOperation='source-atop';const sh=g.createLinearGradient(0,h*.3,0,h*.85);sh.addColorStop(0,alpha(shade,0));sh.addColorStop(1,alpha(shade,.85));g.fillStyle=sh;g.fillRect(0,0,w,h);return cv;}
function softSprite(w,h,col,a){const cv=surface(w,h),g=cv.getContext('2d'),gr=g.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);gr.addColorStop(0,alpha(col,a));gr.addColorStop(.5,alpha(col,a*.45));gr.addColorStop(1,alpha(col,0));g.setTransform(1,0,0,h/w,0,0);g.fillStyle=gr;g.fillRect(0,0,w,w);return cv;}
// Each forest band is drawn alone so light and depth shading only touch that band.
function band(c,draw,top,p,sx,night){
const g=scratch.getContext('2d');g.globalCompositeOperation='source-over';g.clearRect(0,0,W,H);draw(g);g.globalCompositeOperation='source-atop';
const light=g.createLinearGradient(0,top-170,0,top+110);light.addColorStop(0,alpha(p.sun,night?.06:.22));light.addColorStop(1,alpha(p.sun,0));g.fillStyle=light;g.fillRect(0,0,W,H);
const side=g.createLinearGradient(sx,0,sx<W/2?W:0,0);side.addColorStop(0,alpha(p.sun,night?.02:.1));side.addColorStop(1,alpha(p.sun,0));g.fillStyle=side;g.fillRect(0,0,W,H);
const foot=g.createLinearGradient(0,top+40,0,H);foot.addColorStop(0,alpha(p.dark,0));foot.addColorStop(1,alpha(p.dark,.35));g.fillStyle=foot;g.fillRect(0,0,W,H);
c.drawImage(scratch,0,0);}
function build(){
const s=state,sd=WILD.sites.find(x=>x.id===s.location),idx=WILD.sites.indexOf(sd),r=rand(320+idx*170);
phase=phaseOf(s);pal=palette(s);const p=pal,night=phase===3,rain=['rain','storm'].includes(s.weather),storm=s.weather==='storm',[sx]=night?moonAt(s.time):sunAt(s.time);
// Sky
const k=sky.getContext('2d'),grad=k.createLinearGradient(0,0,0,H*.75);grad.addColorStop(0,p.top);grad.addColorStop(.55,mix(p.top,p.hor,.55));grad.addColorStop(1,p.hor);k.fillStyle=grad;k.fillRect(0,0,W,H);
stars=[];if(night&&!rain){const sr=rand(99+idx);for(let i=0;i<150;i++)stars.push({x:sr()*W,y:sr()*H*.45,a:.15+sr()*.6,z:sr()<.08?2:1,sp:.5+sr()*1.5,ph:sr()*TAU});}
const cr=rand(711+idx*13),count={clear:4,cloudy:8,rain:10,storm:11}[s.weather]||5,cloudCol=storm?mix(p.cloud,'#3a4443',.5):p.cloud;
const sprites=[0,1,2].map(()=>cloudSprite(cr,cloudCol,p.shade));
clouds=Array.from({length:count},(_,i)=>{const z=cr();return {img:sprites[i%3],x:cr()*(W+400),y:10+z*150,scale:.55+z*.9,speed:(.004+cr()*.006)*(storm?2.2:rain?1.5:1),a:(s.weather==='clear'?.55:rain?.92:.8)*(night?.75:1)};}).sort((a,b)=>a.scale-b.scale);
fogSprite=softSprite(640,130,p.fog,night?.35:.55);
// Land
const c=land.getContext('2d');c.globalCompositeOperation='source-over';c.clearRect(0,0,W,H);
const lift=s.location==='ridge'?-42:s.location==='valley'?14:0;
for(let layer=0;layer<4;layer++){
const y=150+layer*38+lift,col=mix(p.hor,p.far,.5+layer*.17),pts=[[0,H],[0,y+40]];
for(let x=0;x<=W+20;x+=16)pts.push([x,y+Math.sin(x*.007+layer*2)*48+Math.sin(x*.018+layer)*18+Math.sin(x*.061+layer*4)*5+(r()-.5)*9]);
pts.push([W,H]);polygon(c,pts,col);
c.strokeStyle=alpha(mix(p.sun,p.hor,.3),night?.12:.35-layer*.06);c.lineWidth=1.4;c.beginPath();pts.slice(1,-1).forEach(([x,yy],i)=>i?c.lineTo(x,yy):c.moveTo(x,yy));c.stroke();
const haze=c.createLinearGradient(0,y+20,0,y+120);haze.addColorStop(0,alpha(p.hor,0));haze.addColorStop(.5,alpha(p.hor,.22));haze.addColorStop(1,alpha(p.hor,0));c.fillStyle=haze;c.fillRect(0,y+20,W,100);
}
const bands=[mix(p.far,p.mid,.45),p.mid,mix(p.mid,p.near,.5),p.near,p.dark];
for(let layer=0;layer<5;layer++){
const colr=bands[layer],y=260+layer*51,density=s.location==='forest'?.75:1;
band(c,g=>{const pts=[[0,H]];for(let x=0;x<=W+30;x+=30)pts.push([x,y+Math.sin(x*.005+layer*1.7)*38]);pts.push([W,H]);polygon(g,pts,colr);
for(let x=-20;x<W+50;x+=(11+layer*9)*density){const yy=y+Math.sin(x*.005+layer*1.7)*38;const h=35+layer*23+r()*(25+layer*23);if(layer>=3&&x>W*.3&&x<W*.78)continue;pine(g,x+(r()-.5)*25,yy+15,h,colr,r);}},y-60,p,sx,night);
if(layer<3){const mist=c.createLinearGradient(0,y-20,0,y+90);mist.addColorStop(0,alpha(p.fog,0));mist.addColorStop(.4,alpha(p.fog,.13));mist.addColorStop(1,alpha(p.fog,0));c.fillStyle=mist;c.fillRect(0,y-20,W,110);}
}
// A winding trail (or creek) leads the eye into the scene.
const creek=sd.water;c.beginPath();c.moveTo(635,290);c.bezierCurveTo(580,360,900,385,620,455);c.bezierCurveTo(490,490,450,520,340,580);c.lineTo(640,580);c.bezierCurveTo(690,490,815,495,800,451);c.bezierCurveTo(815,375,610,370,647,290);c.closePath();
if(creek){const wg=c.createLinearGradient(0,290,0,580);wg.addColorStop(0,alpha(mix(p.hor,'#7fa7a0',.5),.75));wg.addColorStop(1,alpha(mix(p.near,'#3d6f6a',.5),.85));c.fillStyle=wg;c.fill();c.strokeStyle=alpha(p.water,.25);c.lineWidth=1.5;c.stroke();}
else{c.fillStyle=alpha(mix(p.mid,'#8c8a6a',.5),.35);c.fill();}
const cc=s.camps[s.location];
// Flood water and landmark silhouettes respond to expedition progress.
if(WorldRules.flooded(s)){c.fillStyle='#7faaa34a';c.beginPath();c.ellipse(640,520,390,82,0,0,TAU);c.fill();}
if(s.world.discovered.includes(s.location)){
if(s.location==='river'){c.strokeStyle='#c4e0cc85';c.lineWidth=12;c.beginPath();c.moveTo(665,250);c.bezierCurveTo(680,300,658,330,690,364);c.stroke();}
if(s.location==='rocks'){polygon(c,[[650,449],[660,363],[708,338],[760,394],[775,449]],'#52614d');c.fillStyle='#0a1914';c.beginPath();c.ellipse(710,419,29,35,0,Math.PI,TAU);c.fill();c.fillRect(681,418,58,28);}
if(s.location==='valley'){polygon(c,[[560,435],[650,407],[787,427],[788,436],[654,429]],'#9da79a');polygon(c,[[647,422],[602,382],[625,379],[703,430]],'#768c81');}
}
// Camps appear in the landscape when built.
if(cc.structures.includes('shelter')){
c.fillStyle='#0b1a1250';c.beginPath();c.ellipse(838,440,98,10,0,0,TAU);c.fill();
polygon(c,[[755,433],[842,337],[917,432]],'#718063');polygon(c,[[755,433],[842,337],[825,437]],'#a09c70');polygon(c,[[826,435],[845,361],[877,434]],'#18271d');c.strokeStyle='#c0b88c';c.lineWidth=2;c.beginPath();c.moveTo(842,337);c.lineTo(842,438);c.moveTo(751,439);c.lineTo(842,337);c.lineTo(920,438);c.stroke();c.strokeStyle='#a1ac8155';c.beginPath();c.moveTo(842,337);c.lineTo(957,451);c.moveTo(842,337);c.lineTo(701,451);c.stroke();
}
if(s.location==='ruins'){polygon(c,[[525,381],[525,318],[620,303],[667,332],[667,384]],'#344538');polygon(c,[[509,321],[586,281],[683,322],[620,307]],'#77806b');c.fillStyle='#17271f';c.fillRect(590,331,23,50);c.fillRect(632,337,18,21);}
if(s.location==='ridge'){c.strokeStyle='#899786';c.lineWidth=3;c.beginPath();c.moveTo(843,429);c.lineTo(828,198);c.lineTo(812,429);c.moveTo(819,260);c.lineTo(840,260);c.moveTo(815,302);c.lineTo(846,302);c.stroke();c.lineWidth=1;c.beginPath();c.moveTo(828,198);c.lineTo(728,433);c.moveTo(828,198);c.lineTo(906,433);c.stroke();}
if(cc.structures.includes('firepit')){for(let i=0;i<9;i++){const a=i/9*TAU;c.fillStyle=i%2?'#76806a':'#485b47';c.beginPath();c.ellipse(711+Math.cos(a)*22,454+Math.sin(a)*7,7,4,0,0,TAU);c.fill();}c.strokeStyle='#3a2f20';c.lineWidth=5;c.beginPath();c.moveTo(698,455);c.lineTo(725,449);c.moveTo(700,448);c.lineTo(723,456);c.stroke();}
if(cc.structures.includes('collector')){c.fillStyle='#657a65';c.fillRect(930,420,24,27);c.fillStyle='#99a78a';c.beginPath();c.ellipse(942,420,12,4,0,0,TAU);c.fill();}
if(cc.structures.includes('rack')){c.strokeStyle='#8b9676';c.lineWidth=3;c.beginPath();c.moveTo(982,455);c.lineTo(992,396);c.lineTo(1040,396);c.lineTo(1051,455);c.moveTo(989,414);c.lineTo(1043,414);c.stroke();}
// Foreground ground, grass, stones and wildflowers.
const ground=c.createLinearGradient(0,470,0,H);ground.addColorStop(0,alpha(p.dark,0));ground.addColorStop(1,alpha(mix(p.dark,'#000000',.35),.9));c.fillStyle=ground;c.fillRect(0,470,W,H-470);
for(let i=0;i<14;i++){const x=r()*W,y=520+r()*55,w=6+r()*14;c.fillStyle=alpha(mix(p.far,p.dark,.55),.8);c.beginPath();c.ellipse(x,y,w,w*.45,0,Math.PI,TAU);c.fill();}
for(let i=0;i<260;i++){const x=r()*W,y=486+r()*96;c.strokeStyle=r()>.5?alpha(mix(p.sun,p.mid,.6),.16):alpha(p.dark,.6);c.lineWidth=1+r();c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x-4,y-11,x-10+r()*20,y-8-r()*22);c.stroke();}
if(!night&&!rain){const flowers=['#e8d58a','#e4a898','#d9dcc8'];for(let i=0;i<40;i++){const x=r()*W,y=500+r()*75;if(x>330&&x<660)continue;c.fillStyle=alpha(flowers[i%3],.55+r()*.3);c.beginPath();c.arc(x,y,1+r()*1.3,0,TAU);c.fill();}}
const edge=mix(p.dark,'#000000',.3);pine(c,48,604,465,alpha(edge,.93),r);pine(c,1160,597,505,alpha(edge,.93),r);pine(c,112,595,290,alpha(mix(edge,p.near,.3),.85),r);
// Time-of-day and weather grading applied to the land only, then a soft vignette over everything.
const amb=storm?['#1c2626',.25]:rain?['#2a3a38',.14]:AMBIENT[phase];
if(amb){c.globalCompositeOperation='source-atop';c.fillStyle=alpha(amb[0],amb[1]);c.fillRect(0,0,W,H);if(storm&&night){c.fillStyle='#06121c55';c.fillRect(0,0,W,H);}c.globalCompositeOperation='source-over';}
const vignette=c.createRadialGradient(650,230,120,600,280,700);vignette.addColorStop(0,'#071a0f00');vignette.addColorStop(1,'#071a0f8a');c.fillStyle=vignette;c.fillRect(0,0,W,H);
}
function drawSun(t){
const s=state,night=phase===3,rain=['rain','storm'].includes(s.weather),overcast=rain?.2:s.weather==='cloudy'?.55:1;
if(night){const [x,y]=moonAt(s.time),g=ctx.createRadialGradient(x,y,0,x,y,170);g.addColorStop(0,alpha(pal.sun,.22*overcast));g.addColorStop(.12,alpha(pal.sun,.07*overcast));g.addColorStop(1,alpha(pal.sun,0));ctx.fillStyle=g;ctx.fillRect(x-170,y-170,340,340);
ctx.globalAlpha=Math.max(.15,overcast)*.9;ctx.fillStyle='#e7eddc';ctx.beginPath();ctx.arc(x,y,14,0,TAU);ctx.fill();ctx.fillStyle='#b8c2ae';ctx.globalAlpha*=.35;[[-4,-3,3.5],[5,3,2.4],[-1,6,1.8],[4,-6,1.5]].forEach(([a,b,rr])=>{ctx.beginPath();ctx.arc(x+a,y+b,rr,0,TAU);ctx.fill();});ctx.globalAlpha=1;return;}
const [x,y]=sunAt(s.time),low=phase!==1,halo=ctx.createRadialGradient(x,y,0,x,y,low?420:300);
halo.addColorStop(0,alpha(pal.sun,.75*overcast));halo.addColorStop(.1,alpha(pal.sun,.32*overcast));halo.addColorStop(.45,alpha(pal.hor,.12*overcast));halo.addColorStop(1,alpha(pal.hor,0));ctx.fillStyle=halo;ctx.fillRect(0,0,W,H);
ctx.globalAlpha=overcast*.85;ctx.fillStyle=mix(pal.sun,'#ffffff',.35);ctx.beginPath();ctx.arc(x,y,low?22:16,0,TAU);ctx.fill();ctx.globalAlpha=1;}
function drawSkyLife(t){
const s=state,night=phase===3,rain=['rain','storm'].includes(s.weather);
if(stars.length){for(const st of stars){ctx.fillStyle=`rgba(226,236,224,${st.a*(.55+.45*Math.sin(t*.002*st.sp+st.ph))})`;ctx.fillRect(st.x,st.y,st.z,st.z);}
const cyc=11000,lt=t%cyc;if(!reduced&&lt<650){const sr=rand(Math.floor(t/cyc)),x0=200+sr()*700,y0=30+sr()*80,k=lt/650;ctx.strokeStyle=`rgba(236,242,230,${.7*(1-k)})`;ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(x0+k*220,y0+k*70);ctx.lineTo(x0+k*220-60,y0+k*70-19);ctx.stroke();}}
if(s.weather==='storm'&&!reduced){const cyc=8000,lt=t%cyc;if(lt<160||(lt>220&&lt<300)){const br=rand(Math.floor(t/cyc)+7);let x=250+br()*700,y=40;ctx.strokeStyle='#eef3ffd0';ctx.lineWidth=2;ctx.shadowColor='#cfe0ff';ctx.shadowBlur=14;ctx.beginPath();ctx.moveTo(x,y);while(y<230){x+=(br()-.5)*44;y+=14+br()*18;ctx.lineTo(x,y);}ctx.stroke();ctx.shadowBlur=0;}}
for(const cl of clouds){const w=360*cl.scale,x=(cl.x+(reduced?0:t*cl.speed))%(W+w+200)-w-100;ctx.globalAlpha=cl.a;ctx.drawImage(cl.img,x,cl.y,w,140*cl.scale);}ctx.globalAlpha=1;
if(!night&&!rain){ctx.strokeStyle=phase===1?'#27372ea0':'#2a2530b0';ctx.lineWidth=1.3;ctx.beginPath();for(let i=0;i<7;i++){const flock=i<4?0:1,sp=.018+flock*.006,x=(t*sp+(i%4)*21+flock*640)%(W+300)-150,y=100+flock*48+(i%4)*8+(i%2)*6+Math.sin(t*.0009+i)*5,f=Math.sin(t*.013+i*1.9)*4;ctx.moveTo(x-6,y-f);ctx.quadraticCurveTo(x-3,y-2,x,y);ctx.quadraticCurveTo(x+3,y-2,x+6,y-f);}ctx.stroke();}}
let beams,beamKey='';
function beamLayer(s){const key=s.time+s.weather;if(key===beamKey)return beams;beamKey=key;beams=beams||surface(W,H);const g=beams.getContext('2d'),[x,y]=sunAt(s.time);g.clearRect(0,0,W,H);g.filter='blur(14px)';
for(let i=0;i<4;i++){const dx=(i-1.5)*46,bx=x+(600-x)*.4+dx*4,bg=g.createLinearGradient(x,y,bx,H);bg.addColorStop(0,alpha(pal.sun,.16));bg.addColorStop(.55,alpha(pal.sun,.07));bg.addColorStop(1,alpha(pal.sun,0));polygon(g,[[x+dx-14,y+26],[x+dx+14,y+26],[bx+50+i*12,H],[bx-40,H]],bg);}
g.filter='none';return beams;}
function drawEffects(t){
const s=state,night=phase===3,rain=['rain','storm'].includes(s.weather),sd=WILD.sites.find(x=>x.id===s.location);
if(phase===1&&!rain&&sunAt(s.time)[1]<H*.3){ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=(s.weather==='cloudy'?.5:1)*(.75+.25*Math.sin(t*.0006));ctx.drawImage(beamLayer(s),0,0);ctx.restore();}
if(sd.water){ctx.strokeStyle=alpha(pal.water,1);ctx.lineWidth=1.2;for(let i=0;i<28;i++){const off=((i*37+(reduced?0:t*.018))%250),yy=318+off,xx=600+Math.sin(yy*.025)*70+((i*53)%60-30),len=8+(i%4)*7;ctx.globalAlpha=Math.sin(off/250*Math.PI)*(night?.22:.38);ctx.beginPath();ctx.moveTo(xx,yy);ctx.lineTo(xx+len,yy);ctx.stroke();}ctx.globalAlpha=1;}
const fogK=(s.location==='valley'?1:0)+(phase===0?.45:0)+(rain?.5:0)+(s.weather==='cloudy'?.25:0)+(s.location==='river'?.25:0);
if(fogK>0){for(let i=0;i<4;i++){const x=((i*380+(reduced?0:t*(.006+i*.002)))%(W+700))-640,y=300+i*42;ctx.globalAlpha=Math.min(.5,fogK*.2);ctx.drawImage(fogSprite,x,y,760,130+i*10);ctx.drawImage(fogSprite,x+W*.75,y+18,640,110);}ctx.globalAlpha=1;}
if(s.camps[s.location].fire>0){
const fl=reduced?1:1+Math.sin(t*.013)*.1+Math.sin(t*.031+1)*.06;
ctx.save();ctx.globalCompositeOperation='lighter';const glow=ctx.createRadialGradient(711,445,2,711,445,(night?210:150)*fl);glow.addColorStop(0,night?'#ffa45a70':'#ffad5850');glow.addColorStop(.35,night?'#ff8a3a26':'#ff8a3a14');glow.addColorStop(1,'#ff6a2000');ctx.fillStyle=glow;ctx.fillRect(480,230,470,330);ctx.restore();
for(let i=0;i<3;i++){const h=(24-i*6)*fl+(reduced?0:Math.sin(t*.02+i*2)*3),x=705+i*6,g=ctx.createLinearGradient(0,452-h,0,452);g.addColorStop(0,'#f6c26a00');g.addColorStop(.35,i===1?'#fff1b8':'#f7b458');g.addColorStop(1,i===1?'#f4c060':'#d8672d');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(x-7+i,452);ctx.quadraticCurveTo(x-8,452-h*.55,x+(reduced?0:Math.sin(t*.017+i)*2.5),452-h);ctx.quadraticCurveTo(x+8,452-h*.5,x+7-i,452);ctx.closePath();ctx.fill();}
for(let i=0;i<7;i++){const n=((reduced?150:t*.035)+i*13)%80;ctx.fillStyle=`rgba(255,196,110,${1-n/80})`;ctx.fillRect(710+Math.sin(n*.1+i)*9,440-n,1.6,1.6);}
for(let i=0;i<10;i++){const n=((reduced?60:t*.018)+i*14.7)%147,k=n/147;ctx.fillStyle=`rgba(190,190,176,${(1-k)*.07*Math.min(1,k*6)})`;ctx.beginPath();ctx.arc(711+Math.sin(n*.045+i)*7+n*.3,426-n*1.1,4+n*.14,0,TAU);ctx.fill();}}
if(phase>=2&&!rain){ctx.save();ctx.globalCompositeOperation='lighter';for(let i=0;i<22;i++){const x=(i*211)%W+Math.sin(t*.0006+i*3)*34,y=392+(i*53)%160+Math.cos(t*.0008+i*2)*18,a=.5+.5*Math.sin(t*.003+i*1.3);ctx.globalAlpha=a*(phase===3?.95:.55);ctx.drawImage(glowSprite,x-9,y-9,18,18);}ctx.restore();}
if(rain){const storm=s.weather==='storm',slant=storm?13:7;ctx.lineWidth=1;
ctx.strokeStyle=storm?'#d0dfcd30':'#d0dfcd1e';ctx.beginPath();for(let i=0;i<(storm?110:80);i++){const x=(i*197+(reduced?0:t*.03))%W,y=(i*73+(reduced?0:t*.26))%H;ctx.moveTo(x,y);ctx.lineTo(x-slant*.5,y+12);}ctx.stroke();
ctx.strokeStyle=storm?'#dce8d850':'#dce8d836';ctx.lineWidth=1.3;ctx.beginPath();for(let i=0;i<(storm?70:50);i++){const x=(i*263+(reduced?0:t*.06))%W,y=(i*131+(reduced?0:t*.55))%H;ctx.moveTo(x,y);ctx.lineTo(x-slant,y+26);}ctx.stroke();
ctx.strokeStyle='#dce8d8';ctx.lineWidth=1;for(let i=0;i<26;i++){const k=((reduced?.5:t*.0018)+i*.37)%1;ctx.globalAlpha=(1-k)*.3;ctx.beginPath();ctx.ellipse((i*157)%W,500+(i*29)%75,1+k*7,.5+k*2,0,0,TAU);ctx.stroke();}ctx.globalAlpha=1;}
if(!reduced&&!night&&!rain){ctx.fillStyle=alpha(pal.sun,.35);for(let i=0;i<14;i++){const x=(i*137+t*.009)%W,y=140+(i*43)%320+Math.sin(t*.0004+i)*12;ctx.fillRect(x,y,1.5,1.5);}}
if(s.weather==='storm'&&!reduced){const lt=t%8000;if(lt<400){ctx.save();ctx.globalCompositeOperation='screen';ctx.fillStyle=`rgba(207,216,232,${.2*(1-lt/400)})`;ctx.fillRect(0,0,W,H);ctx.restore();}}}
function paint(t=0){if(!ctx||!state)return;ctx.clearRect(0,0,canvas.width,canvas.height);const scale=Math.max(canvas.width/W,canvas.height/H);ctx.save();ctx.translate((canvas.width-W*scale)/2,(canvas.height-H*scale)/2);ctx.scale(scale,scale);
ctx.drawImage(sky,0,0);drawSun(t);drawSkyLife(t);ctx.drawImage(land,0,0);drawEffects(t);ctx.restore();
if(grain){ctx.globalCompositeOperation='overlay';ctx.globalAlpha=.045;ctx.fillStyle=grain;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';}}
function tick(t){frame=requestAnimationFrame(tick);if(document.hidden||reduced||t-lastPaint<45)return;lastPaint=t;paint(t);}
function update(s){state=s;const key=[s.location,s.weather,phaseOf(s),s.camps[s.location].structures.join(','),s.world.discovered.includes(s.location),WorldRules.flooded(s)].join('|');if(key!==lastKey){lastKey=key;beamKey='';build();}paint(performance.now());}
function init(el,s){canvas=el;ctx=canvas.getContext('2d');sky=surface(W,H);land=surface(W,H);scratch=surface(W,H);glowSprite=softSprite(32,32,'#f4f1a0',1);
noise=surface(128,128);const ng=noise.getContext('2d'),img=ng.createImageData(128,128),nr=rand(7);for(let i=0;i<img.data.length;i+=4){const v=nr()*255|0;img.data[i]=img.data[i+1]=img.data[i+2]=v;img.data[i+3]=255;}ng.putImageData(img,0,0);grain=ctx.createPattern(noise,'repeat');
state=s;const resize=()=>{const rect=canvas.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(rect.width*ratio);canvas.height=Math.round(rect.height*ratio);paint(performance.now());};new ResizeObserver(resize).observe(canvas);update(s);resize();tick(0);matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',e=>{reduced=e.matches;paint(0);});}
return {init,update};
})();
