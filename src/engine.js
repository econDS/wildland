'use strict';
// Pure, seeded simulation: no DOM or browser dependencies.
const Survival = (() => {
const D=typeof WILD!=='undefined'?WILD:require('./data.js');
const World=typeof WorldRules!=='undefined'?WorldRules:require('./world.js');
const clamp=(n,a=0,b=100)=>Math.max(a,Math.min(b,n));
const site=s=>D.sites.find(x=>x.id===s.location), camp=s=>s.camps[s.location], count=(s,id)=>s.inv[id]||0;
const REGIONAL_EVENTS=['riverbank','forest_call','cave_echo','radio_static','fog_signal','ridge_beacon','old_camp'];
const GOALS=[
  {id:'camp_ready',title:'ตั้งแคมป์แรก',description:'สร้างเพิงพักและหลุมกองไฟให้พร้อมผ่านคืนแรก',reward:{ration:1,bandage:1},progress:s=>Object.values(s.camps).some(c=>c.structures.includes('shelter')&&c.structures.includes('firepit')),label:s=>s.milestones.goals?.camp_ready?'สำเร็จแล้ว':'เพิงพัก + หลุมกองไฟ'},
  {id:'water_route',title:'รู้จักแหล่งน้ำ',description:'ไปถึงลำธารหรือหุบเขาหมอกเพื่อวางเส้นทางเสบียง',reward:{water:2},progress:s=>s.visited.includes('river')||s.visited.includes('valley'),label:s=>s.visited.includes('river')||s.visited.includes('valley')?'พบแหล่งน้ำแล้ว':'ยังไม่พบแหล่งน้ำ'},
  {id:'field_scout',title:'สำรวจพื้นที่ 3 แห่ง',description:'เดินทางให้พบพื้นที่อย่างน้อยสามแห่ง',reward:{wood:2,fiber:2},progress:s=>Math.min(3,s.visited.length)/3,label:s=>`${Math.min(3,s.visited.length)}/3 พื้นที่`},
  {id:'landmark_scout',title:'ทำความรู้จักป่า',description:'ค้นพบจุดสำรวจพิเศษสี่แห่ง',reward:{medicine:1},progress:s=>Math.min(4,s.world.discovered.length)/4,label:s=>`${Math.min(4,s.world.discovered.length)}/4 จุดพิเศษ`},
  {id:'final_preparation',title:'เตรียมคืนสุดท้าย',description:'เมื่อใกล้ครบเดือน ต้องมีเพิงพักและหลุมไฟที่ยังใช้งานได้',reward:{ration:3,bandage:1},progress:s=>s.day>=25&&Object.values(s.camps).some(c=>c.structures.includes('shelter')&&c.structures.includes('firepit')&&(c.condition??100)>=70),label:s=>s.day<25?`เริ่มได้วันที่ 25 (อีก ${25-s.day} วัน)`:s.milestones.goals?.final_preparation?'สำเร็จแล้ว':'ต้องมีเพิงและหลุมไฟแข็งแรง ≥70%'}
];
function initGoals(s){if(!s.milestones||typeof s.milestones!=='object'||Array.isArray(s.milestones))s.milestones={};if(!s.milestones.goals||typeof s.milestones.goals!=='object'||Array.isArray(s.milestones.goals))s.milestones.goals={};return s;}
function completeGoals(s){
  initGoals(s);
  for(const goal of GOALS){
    const progress=goal.progress(s),completed=typeof progress==='number'?progress>=1:Boolean(progress);
    if(s.milestones.goals[goal.id]||!completed)continue;
    s.milestones.goals[goal.id]=true;
    Object.entries(goal.reward).forEach(([id,n])=>add(s,id,n));
    log(s,`เป้าหมายสำเร็จ: ${goal.title} • ได้ ${Object.entries(goal.reward).map(([id,n])=>`${D.items[id].name} ×${n}`).join(' / ')}`,'success');
  }
}
const temperature=s=>D.weather[s.weather].temp+site(s).temp-Math.floor((s.day-1)/10)*2-(s.time>=1140?5:0);
const capacity=s=>count(s,'pack')?38:24, weight=s=>Object.entries(s.inv).reduce((a,[k,v])=>a+D.items[k].weight*v,0);
function random(s){s.seed=(Math.imul(1664525,s.seed)+1013904223)>>>0;return s.seed/4294967296;}
const roll=(s,a,b)=>a+Math.floor(random(s)*(b-a+1));
function log(s,text,tone='normal'){s.logs.unshift({day:s.day,time:s.time,text,tone});s.logs=s.logs.slice(0,80);}
function add(s,id,n=1){
const fit=Math.max(0,Math.min(n,Math.floor((capacity(s)-weight(s)+.00001)/D.items[id].weight)));
if(fit)s.inv[id]=count(s,id)+fit;
if(fit<n){camp(s).cache[id]=(camp(s).cache[id]||0)+n-fit;log(s,`กระเป๋าเต็ม: ฝาก ${D.items[id].name} ${n-fit} ไว้ในคลังพื้นที่`,'warning');}
if(fit&&D.items[id].durability&&!s.tools[id])s.tools[id]=D.items[id].durability;
return fit;
}
function remove(s,id,n=1){if(count(s,id)<n)return false;s.inv[id]-=n;if(!s.inv[id])delete s.inv[id];return true;}
function newGame(difficulty='survivor',seed=Date.now()>>>0){
const s={version:2,seed:seed>>>0,difficulty,day:1,time:420,location:'clearing',health:100,energy:88,food:78,water:72,warmth:82,wet:0,sickness:0,wound:0,weather:'clear',forecast:'cloudy',inv:{},tools:{},camps:{},visited:['clearing'],searched:[],logs:[],event:null,ended:false,won:false,signal:false,actions:0,milestones:{goals:{}},lastResult:''};
for(const a of D.sites)s.camps[a.id]={structures:[],fire:0,cache:{},stock:6};
World.init(s);initGoals(s);
const basic={wood:4,stone:3,fiber:3,water:3,ration:difficulty==='wild'?2:4,bandage:1};
if(difficulty==='explorer'){basic.water+=2;basic.ration+=2;}
Object.entries(basic).forEach(([k,v])=>add(s,k,v));log(s,'คุณหลงจากเส้นทางเดินป่า ตั้งหลัก หาแหล่งน้ำ และเตรียมที่พักก่อนมืด','story');return s;
}
const hasMats=(s,mats)=>Object.entries(mats).every(([k,v])=>count(s,k)>=v);
function pay(s,mats){Object.entries(mats).forEach(([k,v])=>remove(s,k,v));}
function useTool(s,id){if(!count(s,id)||!D.items[id].durability)return;s.tools[id]=(s.tools[id]||D.items[id].durability)-1;if(s.tools[id]<=0){remove(s,id);delete s.tools[id];log(s,`${D.items[id].name} ชำรุดแล้ว ต้องทำอันใหม่`,'warning');}}
function endCheck(s){if(s.health<=0){s.health=0;s.ended=true;s.won=false;s.event=null;log(s,'การเดินทางสิ้นสุดลงในป่าลึก','danger');}}
function routePlan(s,target){
  if(!D.sites.some(x=>x.id===target))return {reachable:false,path:[],minutes:0,energy:0,risk:0,nextHop:null,blocked:null};
  if(target===s.location)return {reachable:true,path:[s.location],minutes:0,energy:0,risk:0,nextHop:null,blocked:null};
  const queue=[{id:s.location,path:[s.location]}],seen=new Set([s.location]);
  while(queue.length){
    const node=queue.shift(),area=D.sites.find(x=>x.id===node.id);
    for(const next of area.links){
      if(seen.has(next)||World.blocked(s,node.id,next))continue;
      const path=node.path.concat(next);if(next===target){
        const [minutes,energy]=cost(s,'travel');
        const factor=D.difficulties[s.difficulty].risk;
        const risk=s.day===1?0:1-path.slice(1).reduce((chance,id)=>{
          const regional={river:'riverbank',forest:'forest_call',rocks:'cave_echo',ruins:'radio_static',valley:'fog_signal',ridge:'ridge_beacon',clearing:'old_camp'}[id];
          const regionalChance=regional&&!(s.world?.eventsSeen||[]).includes(regional)?Math.min(1,.22*factor):0;
          const genericChance=Math.min(1,.16*factor);
          return chance*(1-regionalChance)*(1-genericChance);
        },1);
        return {reachable:true,path,minutes:minutes*(path.length-1),energy:energy*(path.length-1),risk,nextHop:path[1],blocked:null};
      }
      seen.add(next);queue.push({id:next,path});
    }
  }
  const direct=World.blocked(s,s.location,target);
  return {reachable:false,path:[],minutes:0,energy:0,risk:0,nextHop:null,blocked:direct||null};
}
function advance(s,minutes,energy=0,travel=false){
const factor=D.difficulties[s.difficulty].decay,hours=minutes/60,c=travel?{structures:[],fire:0}:camp(s),w=D.weather[s.weather];
s.time+=minutes;s.actions++;s.energy=clamp(s.energy-energy);s.food=clamp(s.food-hours*2.7*factor);s.water=clamp(s.water-hours*3.8*factor);
const protectedHere=World.shelter(s,c);
s.wet=clamp(s.wet+hours*(w.wet*(protectedHere?.15:count(s,'coat')?.3:1)-(c.fire>0?28:5)));
const cold=w.cold+Math.max(0,-site(s).temp)*.4+Math.floor((s.day-1)/10)+(s.time>=1080?2:0)+s.wet*.045;
s.warmth=clamp(s.warmth+hours*(c.fire>0?13:((protectedHere?2:1)+(count(s,'coat')?2:0)-cold)));
for(const cc of Object.values(s.camps))cc.fire=Math.max(0,cc.fire-minutes);
let damage=0;if(s.food===0)damage+=5*hours;if(s.water===0)damage+=9*hours;if(s.warmth<20)damage+=6*hours;if(s.energy===0)damage+=3*hours;
if(s.sickness)damage+=1.8*hours;if(s.wound)damage+=1.2*hours;s.health=clamp(s.health-damage*factor);endCheck(s);
}
function cost(s,type,id){const special=World.cost(s,type,id);if(special)return special;const a={wood:[60,12],stone:[60,13],fiber:[45,8],forage:[60,10],water:[30,5],hunt:[90,19],fish:[60,10],explore:[90,15],rest:[60,0],fire:[30,5],boil:[30,4],cook:[30,4],dry:[60,5],signal:[120,18],travel:[90+(s.weather==='storm'?30:0)+(weight(s)>capacity(s)*.8?30:0)-(count(s,'compass')?15:0),16-(count(s,'boots')?4:0)],dismantle:[30,8]};if(type==='craft'&&D.recipes[id])return [D.recipes[id].time,D.recipes[id].energy];return a[type]||[0,0];}
function available(s,type,id){
if(s.ended)return 'การเดินทางจบแล้ว';if(s.event)return 'ตัดสินใจในเหตุการณ์ก่อน';
const c=camp(s),sd=site(s),[minutes,energy]=cost(s,type,id);
const worldReason=World.available(s,type,id);if(worldReason)return worldReason;
if(type==='sleep')return s.time<900?'นอนได้ตั้งแต่ 15:00 น. • พักสั้นเพื่อฟื้นแรงก่อนได้':'';
if(['consume','stash','take','drop'].includes(type)){
if(!D.items[id])return 'ไม่มีสิ่งของนี้';
if(type==='take')return !(c.cache[id]>0)?'ไม่มีของในคลัง':weight(s)+D.items[id].weight>(id==='pack'?38:capacity(s))+.00001?'กระเป๋าเต็ม':'';
if(!count(s,id))return 'ไม่มีสิ่งของนี้';
if(type==='consume'&&!['food','water','medical'].includes(D.items[id].type))return 'สิ่งนี้ใช้บริโภคไม่ได้';
if(['stash','drop'].includes(type)&&D.items[id].type==='quest')return 'เก็บชิ้นส่วนกู้ภัยไว้กับตัว';
if(['stash','drop'].includes(type)&&id==='pack'&&count(s,id)===1&&weight(s)-.5>24+.00001)return 'นำของออกให้ต่ำกว่า 24 กก. ก่อน';return '';
}
if(!['wood','stone','fiber','forage','water','hunt','fish','explore','rest','fire','boil','cook','dry','signal','travel','craft','dismantle','investigate','reinforce','repair','clearTrail','filter'].includes(type))return 'ไม่รู้จักกิจกรรมนี้';
if(s.time+minutes>1320)return 'เวลาไม่พอ • นอนพักเพื่อเริ่มวันใหม่';if(s.energy<energy)return 'พลังงานไม่พอ • พักสั้นหรือกินเสบียง';
if(type==='craft'){const r=D.recipes[id];if(!r)return 'ไม่พบสูตร';if(r.group==='camp'&&c.structures.includes(id))return 'สร้างแล้วในพื้นที่นี้';if(r.group==='tool'&&(count(s,id)||(c.cache[id]||0)))return 'มีอุปกรณ์นี้แล้ว (ตรวจดูในคลังด้วย)';if(r.requires&&!c.structures.includes(r.requires))return 'ต้องมีเพิงพักก่อน';if(!hasMats(s,r.mats))return 'วัสดุไม่ครบ';}
if(type==='water'&&!sd.water)return 'ต้องไปลำธารหรือหุบเขาหมอก';if(type==='forage'&&c.stock<=0)return 'อาหารบริเวณนี้หมด • ฟื้นตัววันละ 1';
if(type==='hunt'&&!count(s,'spear'))return 'ต้องมีหอกล่าสัตว์';if(type==='fish'&&(!sd.water||!count(s,'rod')))return 'ต้องมีเบ็ดและอยู่ใกล้น้ำ';
if(type==='fire'&&!c.structures.includes('firepit'))return 'ต้องสร้างหลุมกองไฟ';if(type==='fire'&&count(s,'wood')<2)return 'ต้องใช้ไม้ฟืน 2';
if(['boil','cook','dry'].includes(type)&&c.fire<minutes)return 'ต้องมีไฟเหลือพอสำหรับกิจกรรม';
if(type==='boil'&&!count(s,'dirty'))return 'ต้องมีน้ำจากลำธาร';if(['cook','dry'].includes(type)&&!count(s,'raw'))return 'ต้องมีเนื้อสด';
if(type==='dry'&&!c.structures.includes('rack'))return 'ต้องสร้างราวรมควัน';
if(type==='travel'&&(!D.sites.some(x=>x.id===id)||!sd.links.includes(id)))return 'เดินทางได้เฉพาะพื้นที่ที่เชื่อมต่อ';
if(type==='dismantle'&&!c.structures.includes(id))return 'ไม่มีโครงสร้างนี้';
if(type==='signal'){if(s.location!=='ridge')return 'ส่งสัญญาณได้ที่สันเขาสุดท้าย';if(!['radio','battery','wire'].every(k=>count(s,k)))return 'ต้องมีวิทยุ แบตเตอรี่ และสายสัญญาณ';if(s.day<10)return 'เที่ยวบินค้นหาเริ่มในวันที่ 10';if(s.weather==='storm')return 'พายุรบกวนสัญญาณ • รอฟ้าเปิด';}return '';
}
function encounter(s,type){
  if(s.ended||s.day===1||!['travel','explore','forage','hunt','fish','water'].includes(type))return;
  const regional={river:['riverbank'],forest:['forest_call'],rocks:['cave_echo'],ruins:['radio_static'],valley:['fog_signal'],ridge:['ridge_beacon'],clearing:['old_camp']}[s.location]||[];
  const eligible=regional.filter(id=>!(s.world?.eventsSeen||[]).includes(id));
  if(eligible.length&&random(s)<.22*D.difficulties[s.difficulty].risk){
    s.event=eligible[roll(s,0,eligible.length-1)];
    if(!Array.isArray(s.world.eventsSeen))s.world.eventsSeen=[];
    s.world.eventsSeen.push(s.event);
    return;
  }
  if(random(s)>.16*D.difficulties[s.difficulty].risk)return;
  s.event=['tracks','backpack','rainfront','snake','ravine','herbgrove'][roll(s,0,5)];
}
// A pure preflight: bulk transfers either fit in full or leave the save untouched.
function inventoryPlan(s,type,id,quantity=1){
const before=weight(s),item=D.items[id];
const invalid=message=>({ok:false,message,max:0,quantity,weight:before,capacity:capacity(s)});
if(!['stash','take','drop'].includes(type))return invalid('ไม่ใช่การจัดสัมภาระ');
const reason=available(s,type,id);if(reason)return invalid(reason);
let max=type==='take'?camp(s).cache[id]:count(s,id);
if(type==='take')max=Math.min(max,Math.max(0,Math.floor(((id==='pack'?38:capacity(s))-before+.00001)/item.weight)));
if(id==='pack'&&type!=='take'&&before-count(s,id)*item.weight>24+.00001)max=Math.max(0,count(s,id)-1);
if(!Number.isInteger(quantity)||quantity<1)return {...invalid('จำนวนต้องเป็นจำนวนเต็มตั้งแต่ 1'),max};
if(quantity>max)return {...invalid(type==='take'?'จำนวนเกินของในคลังหรือความจุกระเป๋า':'จำนวนเกินของที่ย้ายได้'),max};
const after=before+(type==='take'?1:-1)*quantity*item.weight;
const packs=count(s,'pack')+(id==='pack'?(type==='take'?quantity:-quantity):0);
return {ok:true,message:'',max,quantity,weight:after,capacity:packs?38:24};
}
function action(s,type,id,quantity=1){
if(['stash','take','drop'].includes(type)){
const plan=inventoryPlan(s,type,id,quantity);if(!plan.ok)return {ok:false,message:plan.message};
const c=camp(s),item=D.items[id];
if(type==='take'){
c.cache[id]-=quantity;s.inv[id]=count(s,id)+quantity;
if(item.durability&&!s.tools[id])s.tools[id]=item.durability;
}else{remove(s,id,quantity);if(type==='stash')c.cache[id]=(c.cache[id]||0)+quantity;}
const msg=`${type==='take'?'หยิบ':type==='stash'?'ฝาก':'ทิ้ง'}${item.name} ${quantity} ชิ้น${type==='take'?'จากคลัง':''}`;
log(s,msg);return {ok:true,message:msg};
}
if(quantity!==1)return {ok:false,message:'กิจกรรมนี้ทำได้ครั้งละหนึ่งรายการ'};
const reason=available(s,type,id);if(reason)return {ok:false,message:reason};
const c=camp(s),sd=site(s);let msg='',tone='normal';
if(type==='consume'){
const item=D.items[id];remove(s,id);s.food=clamp(s.food+(item.food||0));s.water=clamp(s.water+(item.water||0));s.health=clamp(s.health+(item.health||0));if(item.food)s.energy=clamp(s.energy+3);if(item.risk&&random(s)<item.risk){s.sickness=2;s.health=clamp(s.health-7);tone='warning';}if(item.cure){s.sickness=0;s.wound=0;}if(item.wound)s.wound=0;msg=`ใช้${item.name}${tone==='warning'?' • อาหารหรือน้ำไม่สะอาดทำให้ป่วย':''}`;
log(s,msg,tone);endCheck(s);return {ok:true,message:msg};
}
if(type==='sleep')return sleep(s);let [minutes,energy]=cost(s,type,id);
switch(type){
case 'wood':{const n=sd.wood+roll(s,0,2)+(count(s,'axe')?3:0);add(s,'wood',n);useTool(s,'axe');msg=`เก็บไม้ฟืนได้ ${n} ชิ้น`;break;}
case 'stone':{const n=sd.stone+roll(s,0,2);add(s,'stone',n);msg=`เก็บก้อนหินได้ ${n} ก้อน`;break;}
case 'fiber':{const n=sd.fiber+roll(s,1,2);add(s,'fiber',n);msg=`เก็บเส้นใยพืชได้ ${n} มัด`;break;}
case 'forage':{const n=roll(s,2,3);c.stock--;add(s,'berries',n);const herbs=random(s)<.6?roll(s,1,2):0;if(herbs)add(s,'herb',herbs);msg=`พบผลไม้ป่า ${n}${herbs?` และสมุนไพร ${herbs}`:''}`;break;}
case 'water':{const n=World.flooded(s)?1:3;add(s,'dirty',n);msg=`เก็บน้ำจากลำธาร ${n} หน่วย${n===1?' • น้ำหลากทำให้ตักได้ช้าลง':''} • ต้มก่อนดื่ม`;break;}
case 'hunt':{const win=random(s)<World.huntChance(s);c.wildlife=Math.max(0,c.wildlife-2);useTool(s,'spear');if(win){const n=roll(s,2,4);add(s,'raw',n);msg=`ล่าได้เนื้อสด ${n} ชิ้น`;}else msg='รอยเท้าหายไปในพุ่มไม้ • การล่าครั้งนี้ไม่ได้อาหาร';break;}
case 'fish':{const n=Math.min(c.fishStock,roll(s,1,3));c.fishStock=Math.max(0,c.fishStock-n);useTool(s,'rod');add(s,'raw',n);msg=`จับปลาได้ ${n} ตัว • เก็บเป็นเนื้อสด`;break;}
case 'explore':{
if(sd.quest&&!s.searched.includes(sd.id)){add(s,sd.quest);s.searched.push(sd.id);msg=`ค้นพบ${D.items[sd.quest].name}! ชิ้นส่วนสำคัญสำหรับการกู้ภัย`;tone='success';}
else if(s.location==='ruins'){const n=roll(s,2,4);add(s,'scrap',n);const food=random(s)<.45;if(food)add(s,'ration');msg=`ค้นซากสถานี พบเศษโลหะ ${n}${food?' และเสบียง 1':''}`;}
else{add(s,'herb',roll(s,1,2));add(s,'fiber',2);if(random(s)<.45)add(s,'scrap');msg='สำรวจเส้นทาง พบสมุนไพรและวัสดุที่ใช้ได้';}
World.discover(s,log);
if(random(s)<Math.max(0,sd.risk*D.difficulties[s.difficulty].risk-(count(s,'binoculars')?.04:0))){s.wound=2;s.health=clamp(s.health-roll(s,5,10));msg+=' • ลื่นบาดเจ็บ ควรพันแผล';tone='warning';}break;
}
case 'rest':s.energy=clamp(s.energy+(World.shelter(s)?27:21));if(c.fire>0)s.warmth=clamp(s.warmth+10);msg='พักหายใจ ฟื้นพลัง และฟังเสียงป่ารอบตัว';break;
case 'craft':{const r=D.recipes[id];pay(s,r.mats);if(r.group==='camp'){if(!c.structures.length)c.condition=100;c.structures.push(id);s.milestones[id]=true;}else add(s,id);msg=`${r.group==='camp'?'สร้าง':'ทำ'}${r.name}สำเร็จ`;tone='success';break;}
case 'dismantle':{const r=D.recipes[id];c.structures=c.structures.filter(x=>x!==id);if(id==='firepit')c.fire=0;if(id==='shelter'&&c.structures.includes('bed')){c.structures=c.structures.filter(x=>x!=='bed');Object.entries(D.recipes.bed.mats).forEach(([k,v])=>add(s,k,Math.floor(v*.5)));}Object.entries(r.mats).forEach(([k,v])=>add(s,k,Math.floor(v*.5)));msg=`รื้อ${r.name} • คืนวัสดุครึ่งหนึ่ง ปัดเศษลง`;break;}
case 'fire':remove(s,'wood',2);c.fire+=270+(s.weather==='rain'&&!World.shelter(s)?-60:s.weather==='storm'&&!World.shelter(s)?-120:0);msg='เติมเชื้อไฟ ความอบอุ่นกลับมาอีกครั้ง';break;
case 'boil':{const n=Math.min(3,count(s,'dirty'));remove(s,'dirty',n);add(s,'water',n);msg=`ต้มน้ำสะอาด ${n} หน่วย`;break;}
case 'cook':{const n=Math.min(2,count(s,'raw'));remove(s,'raw',n);add(s,'cooked',n);msg=`ย่างเนื้อ ${n} ชิ้น พร้อมกิน`;break;}
case 'dry':{const n=Math.min(2,count(s,'raw'));remove(s,'raw',n);add(s,'dried',n);msg=`รมควันเนื้อ ${n} ชิ้น เก็บไว้ได้นาน`;break;}
case 'travel':s.location=id;if(!s.visited.includes(id))s.visited.push(id);msg=`เดินทางถึง${site(s).name}`;break;
case 'signal':s.signal=true;msg='สัญญาณถูกตอบรับ! เฮลิคอปเตอร์พบตำแหน่งของคุณ';tone='success';break;
default:msg=World.perform(s,type,id,{add,pay,useTool,log});tone='success';break;
}
advance(s,minutes,energy,['travel','wood','stone','fiber','forage','water','hunt','fish','explore','signal','investigate','clearTrail'].includes(type));completeGoals(s);log(s,msg,tone);if(type==='signal'&&!s.ended){s.ended=true;s.won=true;}if(!s.ended)encounter(s,type);s.lastResult=msg;return {ok:true,message:msg};
}
function nextWeather(s){const r=random(s);return r<(s.day<6?.45:.25)?'clear':r<.62?'cloudy':r<.87?'rain':'storm';}
function sleepPreview(s){
const c=camp(s),shelter=World.shelter(s),bed=shelter&&c.structures.includes('bed'),fire=c.fire>=120,w=D.weather[s.weather],factor=D.difficulties[s.difficulty].decay,hours=(1860-s.time)/60;
const food=clamp(s.food-hours*1.05*factor),water=clamp(s.water-hours*1.35*factor);
const nightCold=(shelter?3:13)+w.cold*2+Math.max(0,-site(s).temp)+Math.floor((s.day-1)/10)*2+(s.wet>45?8:0)-(fire?14:0)-(count(s,'coat')?6:0)-(count(s,'sleeping_bag')?6:0);
const warmth=clamp(s.warmth-nightCold),wet=clamp(s.wet+(w.wet&&!shelter?20:-40));
// Keep the original two clamps: sleeping-bag recovery happens before sickness loss.
const energy=clamp(clamp(s.energy+(count(s,'sleeping_bag')?8:0))+(shelter?57:37)+(bed?18:0)-(s.sickness?15:0));
const causes=[];
if(food<10)causes.push({id:'food',label:'ความอิ่มต่ำกว่า 10',damage:10*factor});
if(water<10)causes.push({id:'water',label:'น้ำในร่างกายต่ำกว่า 10',damage:17*factor});
if(warmth<22)causes.push({id:'warmth',label:'ความอบอุ่นต่ำกว่า 22',damage:14*factor});
if(s.sickness)causes.push({id:'sickness',label:'อาการป่วย',damage:8*factor});
if(s.wound)causes.push({id:'wound',label:'บาดแผล',damage:5*factor});
const loss=causes.reduce((n,cause)=>n+cause.damage,0);
const recovery=loss===0&&food>25&&water>25?(shelter?8:3)+(bed?5:0):0;
const attackRisk=!shelter&&s.day>2?.12*D.difficulties[s.difficulty].risk:0;
const health=clamp(s.health-loss+recovery),healthMin=attackRisk?clamp(s.health-loss-8*factor):health;
return {food,water,warmth,wet,energy,health,healthMin,loss,recovery,causes,attackRisk,shelter,bed,fire};
}
function sleep(s){
const p=sleepPreview(s),shelter=p.shelter,w=D.weather[s.weather],factor=D.difficulties[s.difficulty].decay;
Object.assign(s,{food:p.food,water:p.water,warmth:p.warmth,wet:p.wet,energy:p.energy});
let loss=p.loss;
if(p.attackRisk&&random(s)<p.attackRisk){loss+=8*factor;log(s,'เสียงสัตว์ป่าทำให้คุณผวาตื่น และบาดเจ็บระหว่างหนี','warning');}
s.health=clamp(s.health-loss+(loss===0?p.recovery:0));if(s.sickness)s.sickness--;if(s.wound)s.wound--;
let spoiled=0;Object.entries(s.inv).forEach(([id,n])=>{const d=D.items[id].decay;if(d){const amount=Math.min(n,Math.floor(n*d+random(s)));if(amount){remove(s,id,amount);spoiled+=amount;}}});
for(const cc of Object.values(s.camps)){cc.fire=0;cc.stock=Math.min(6,cc.stock+1);Object.entries(cc.cache).forEach(([id,n])=>{if(D.items[id].decay)cc.cache[id]=Math.max(0,n-Math.ceil(n*D.items[id].decay));});if(cc.structures.includes('collector')&&w.wet)cc.cache.water=(cc.cache.water||0)+(s.weather==='storm'?5:3);}
World.night(s,log);
if(spoiled)log(s,`อาหารในกระเป๋าเสีย ${spoiled} ชิ้นระหว่างคืน`,'warning');endCheck(s);if(s.ended)return {ok:true,message:'คุณไม่รอดจากค่ำคืนนี้'};
if(s.day===30){s.ended=true;s.won=true;log(s,'ครบ 30 วัน! ทีมค้นหาพบค่ายของคุณและพาคุณกลับบ้าน','success');return {ok:true,message:'คุณเอาชีวิตรอดครบ 30 วัน!'};}
s.day++;s.time=420;s.weather=s.forecast;s.forecast=nextWeather(s);const msg=`เช้าวันที่ ${s.day} • ${D.weather[s.weather].name} • ${shelter?'นอนใต้เพิงพัก':'นอนกลางแจ้ง'}${loss?' ร่างกายยังต้องการการดูแล':''}`;log(s,msg,loss?'warning':'success');
const chapters={3:'บนต้นไม้มีรอยทำเครื่องหมายเก่า สถานีพิทักษ์ทางเหนืออาจมีวิทยุเหลืออยู่',7:'เสียงเครื่องยนต์แว่วมาจากอีกฟากเขา หากเก็บชิ้นส่วนครบ ลองขึ้นไปยังสันเขา',10:'เที่ยวบินค้นหาเริ่มแล้ว! วิทยุ แบตเตอรี่ และสายสัญญาณจะช่วยให้คุณกลับบ้าน',11:'ลมหนาวชุดใหม่เข้ามา อุณหภูมิทุกพื้นที่ลดลง 2°C เตรียมเสื้อคลุมและฟืนสำรอง',21:'อากาศเย็นลงอีก 2°C คืนต่อจากนี้จะยาวนานกว่าเดิม',28:'ผ่านมาเกือบเดือนแล้ว เหลืออีกเพียงสามคืน อย่าประมาทเรื่องน้ำและความอบอุ่น'};
World.dawn(s,log);
if(chapters[s.day])log(s,chapters[s.day],'story');
completeGoals(s);
return {ok:true,message:msg};
}
function resolveEvent(s,choice){
if(!s.event||![0,1].includes(choice)||s.ended)return {ok:false,message:'ไม่มีเหตุการณ์ที่เลือกได้'};let msg='';
 if(s.event==='riverbank'){if(choice===0){const c=camp(s);if(count(s,'rod')&&!World.flooded(s)&&c.fishStock>0){c.fishStock--;add(s,'raw',1);useTool(s,'rod');msg='คุณลองเหวี่ยงเบ็ดในแอ่งน้ำ ได้ปลา 1 ตัว';}else{s.wet=clamp(s.wet+8);msg=World.flooded(s)?'น้ำเชี่ยวเกินไป คุณลุยไปดูแอ่งน้ำแต่จับปลาไม่ได้':c.fishStock<=0?'ปลาในแอ่งหนีไปหมดแล้ว คุณกลับมามือเปล่า':'คุณลุยไปดูรอยน้ำวน แต่ไม่พบปลาที่จับได้';}}else{add(s,'dirty',1);s.wet=clamp(s.wet+4);msg='คุณรองน้ำจากซอกหินได้ 1 หน่วย แต่ต้องต้มก่อนดื่ม';}}
 else if(s.event==='forest_call'){if(choice===0){const c=camp(s);if(count(s,'spear')&&c.wildlife>0){c.wildlife=Math.max(0,c.wildlife-1);add(s,'raw',1);useTool(s,'spear');msg='เสียงร้องพาคุณไปพบรอยสัตว์ ได้เนื้อสด 1 ชิ้น';}else{s.energy=clamp(s.energy-6);msg=c.wildlife<=0?'รอยสัตว์ในพื้นที่หมด คุณตามเสียงไปไกลแต่ไม่ได้อาหาร':'คุณตามเสียงไปไกลเกินไป จึงถอยกลับก่อนมืด';}}else{add(s,'fiber',2);msg='คุณทำเครื่องหมายต้นไม้และเก็บเส้นใยระหว่างทางได้ 2 มัด';}}
else if(s.event==='cave_echo'){if(choice===0){if(count(s,'torch')){remove(s,'torch');add(s,'scrap',2);add(s,'medicine',1);msg='คบไฟเผยช่องเก็บของเก่า ได้เศษโลหะ 2 และยา 1';}else{s.wound=2;s.health=clamp(s.health-8);msg='คุณฝืนเข้าไปในความมืด สะดุดหินและบาดเจ็บ';}}else{s.energy=clamp(s.energy+4);msg='คุณจำตำแหน่งถ้ำไว้ แล้วถอยกลับอย่างปลอดภัย';}}
 else if(s.event==='radio_static'){if(choice===0){s.energy=clamp(s.energy-5);s.milestones.radio_clue=true;msg='เสียงซ่าจากวิทยุเก่าบอกทางไปห้องเก็บของ • สำรวจจุดพิเศษในสถานีเร็วขึ้น 30 นาทีและใช้พลังงานน้อยลง 4';}else{add(s,'scrap',2);msg='คุณงัดแผงโลหะข้างสถานี ได้เศษโลหะ 2 ชิ้น';}}
 else if(s.event==='fog_signal'){if(choice===0){s.wet=clamp(s.wet+12);s.energy=clamp(s.energy-4);s.milestones.fog_clue=true;msg='คุณตามแสงวาบผ่านหมอก พบทางไปซากเครื่องบิน • สำรวจจุดพิเศษในหุบเขาเร็วขึ้น 30 นาทีและใช้พลังงานน้อยลง 4';}else{add(s,'herb',2);msg='คุณหลีกเลี่ยงหมอกและเก็บสมุนไพรริมทางได้ 2 ต้น';}}
else if(s.event==='ridge_beacon'){if(choice===0){s.warmth=clamp(s.warmth+8);s.energy=clamp(s.energy-4);msg='คุณจุดแผ่นสะท้อนแสงบนสันเขา ความหวังทำให้ใจอุ่นขึ้น • พลังงาน −4';}else{s.energy=clamp(s.energy+4);msg='คุณพักใต้แนวหิน รับลมให้น้อยลงและฟื้นพลัง 4';}}
else if(s.event==='old_camp'){if(choice===0){add(s,'ration',1);add(s,'scrap',1);msg='ใต้กองใบไม้มีเสบียงเก่า 1 และเศษโลหะ 1';}else{add(s,'fiber',2);msg='คุณไม่เสี่ยงกับของเก่า และเก็บเส้นใยแห้งได้ 2 มัด';}}
else if(s.event==='tracks'){if(choice===0){if(count(s,'spear')||random(s)<.55){add(s,'raw',2);useTool(s,'spear');msg='คุณตามรอยอย่างระวัง และได้เนื้อสด 2 ชิ้น';}else{s.health=clamp(s.health-12);s.wound=2;msg='สัตว์ป่าพุ่งสวนกลับ คุณบาดเจ็บและถอยหนี';}}else{s.energy=clamp(s.energy+4);msg='คุณเลือกทางอ้อม รักษาระยะห่างจากสัตว์ป่า';}}
else if(s.event==='backpack'){if(choice===0){add(s,'ration',2);add(s,'scrap',2);if(random(s)<.3){s.health=clamp(s.health-8);s.wound=2;msg='พบเสบียง 2 และเศษโลหะ 2 แต่กิ่งไม้บาดระหว่างปีน';}else msg='ในกระเป๋ามีเสบียง 2 และเศษโลหะ 2 ที่ยังใช้ได้';}else{add(s,'fiber',2);msg='คุณไม่เสี่ยงปีน และเก็บเส้นใยใกล้ทาง 2 มัด';}}
else if(s.event==='snake'){if(choice===0){s.energy=clamp(s.energy-8);msg='คุณถอยออกมาอย่างช้า ๆ ปล่อยให้งูผ่านไป • พลังงาน −8';}else{add(s,'raw',1);if(count(s,'spear')){useTool(s,'spear');msg='หอกช่วยรักษาระยะห่าง ได้เนื้อสด 1 ชิ้น';}else if(random(s)<.35){s.health=clamp(s.health-10);s.sickness=2;msg='ได้เนื้อสด 1 แต่ถูกกัด • สุขภาพ −10 และป่วย';}else msg='คุณไล่ต้อนสำเร็จ ได้เนื้อสด 1 ชิ้น';}}
else if(s.event==='ravine'){if(choice===0){s.energy=clamp(s.energy+10);if(random(s)<.25){s.health=clamp(s.health-14);s.wound=2;msg='ทางลัดช่วยประหยัดแรง 10 แต่ลื่นบาดเจ็บ • สุขภาพ −14';}else msg='ข้ามทางลัดสำเร็จ ประหยัดพลังงาน 10';}else{s.energy=clamp(s.energy-4);msg='คุณเลือกทางอ้อมที่มั่นคง • พลังงาน −4';}}
else if(s.event==='herbgrove'){if(choice===0){add(s,'herb',3);if(random(s)<.2){s.health=clamp(s.health-5);s.wound=2;msg='เก็บสมุนไพร 3 แต่หนามบาดมือ • สุขภาพ −5';}else msg='เก็บสมุนไพรที่รู้จักได้ 3 ต้น';}else{add(s,'berries',1);msg='เก็บผลไม้ 1 จากริมทาง โดยไม่ฝ่าดงหนาม';}}
else{if(choice===0){s.energy=clamp(s.energy-6);s.wet=clamp(s.wet-20);msg='คุณย้ายไปหลบฝนใต้ชะง่อนหิน • พลังงาน −6 เปียก −20';}else{add(s,'dirty',2);s.wet=clamp(s.wet+20);msg='รองน้ำฝนได้ 2 หน่วย ต้องต้มเพราะภาชนะสกปรก • เปียก +20';}}
s.event=null;log(s,msg,'story');endCheck(s);return {ok:true,message:msg};
}
function validate(raw){
if(!raw||raw.version!==2)throw Error('ไฟล์นี้ไม่ใช่เซฟ WILDLAND เวอร์ชัน 2');const s=JSON.parse(JSON.stringify(raw));initGoals(s);
const num=(v,a,b)=>typeof v==='number'&&Number.isFinite(v)&&v>=a&&v<=b;
if(!Object.hasOwn(D.difficulties,s.difficulty)||!D.sites.some(x=>x.id===s.location)||!Object.hasOwn(D.weather,s.weather)||!Object.hasOwn(D.weather,s.forecast))throw Error('ข้อมูลพื้นที่หรือระดับความยากไม่ถูกต้อง');
if(!Number.isInteger(s.day)||!num(s.day,1,30)||!num(s.time,420,1320)||!num(s.seed,0,4294967295)||!num(s.actions,0,100000))throw Error('ข้อมูลวันหรือเวลาไม่ถูกต้อง');
for(const k of ['health','energy','food','water','warmth','wet'])if(!num(s[k],0,100))throw Error('ค่าสถานะไม่ถูกต้อง');
for(const k of ['sickness','wound'])if(!Number.isInteger(s[k])||!num(s[k],0,3))throw Error('สถานะบาดเจ็บไม่ถูกต้อง');
const inventory=v=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.entries(v).every(([k,n])=>Object.hasOwn(D.items,k)&&Number.isInteger(n)&&num(n,0,10000));
if(!inventory(s.inv))throw Error('ข้อมูลกระเป๋าไม่ถูกต้อง');if(!s.camps||Object.keys(s.camps).length!==D.sites.length)throw Error('ข้อมูลแคมป์ไม่ครบ');
for(const a of D.sites){const c=s.camps[a.id];if(!c||!Array.isArray(c.structures)||new Set(c.structures).size!==c.structures.length||!c.structures.every(k=>D.recipes[k]?.group==='camp')||!num(c.fire,0,100000)||!num(c.stock,0,6)||!inventory(c.cache))throw Error('ข้อมูลแคมป์ไม่ถูกต้อง');}
for(const key of ['visited','searched'])if(!Array.isArray(s[key])||!s[key].every(id=>D.sites.some(x=>x.id===id)))throw Error('ข้อมูลเส้นทางไม่ถูกต้อง');
if(!s.tools||typeof s.tools!=='object'||Object.entries(s.tools).some(([k,v])=>!D.items[k]?.durability||!num(v,0,D.items[k].durability)))throw Error('ข้อมูลเครื่องมือไม่ถูกต้อง');
if(!Array.isArray(s.logs)||s.logs.length>80||!s.logs.every(l=>l&&typeof l.text==='string'&&l.text.length<1200&&num(l.day,1,30)&&num(l.time,420,1320)&&['normal','warning','danger','success','story'].includes(l.tone)))throw Error('บันทึกไม่ถูกต้อง');
 if(![null,'tracks','backpack','rainfront','snake','ravine','herbgrove',...REGIONAL_EVENTS].includes(s.event)||['ended','won','signal'].some(k=>typeof s[k]!=='boolean')||!s.milestones||typeof s.milestones!=='object'||['radio_clue','fog_clue'].some(k=>s.milestones[k]!==undefined&&typeof s.milestones[k]!=='boolean')||!s.milestones.goals||Object.entries(s.milestones.goals).some(([k,v])=>!GOALS.some(g=>g.id===k)||typeof v!=='boolean'))throw Error('ข้อมูลความคืบหน้าไม่ถูกต้อง');
if(weight(s)>capacity(s)+.01)throw Error('น้ำหนักกระเป๋าเกินความจุ');return World.validate(s);
}
return {newGame,action,available,cost,routePlan,inventoryPlan,sleepPreview,resolveEvent,validate,site,camp,count,weight,capacity,log,random,temperature,goals:GOALS,world:World};
})();
if(typeof module!=='undefined')module.exports=Survival;
