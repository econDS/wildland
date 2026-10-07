'use strict';
const WorldRules=(()=>{
const D=typeof WILD!=='undefined'?WILD:require('./data.js');
const has=(s,k)=>(s.inv[k]||0)>0;
const cap=(n,a,b)=>Math.max(a,Math.min(b,n));
function init(s){
  // Additive migration: older version-2 saves keep their day, inventory and RNG.
  if(!s.world)s.world={seed:s.seed,hazards:[],discovered:[],claimed:[],eventsSeen:[]};
  if(!Array.isArray(s.world.eventsSeen))s.world.eventsSeen=[];
  for(const c of Object.values(s.camps)){
    if(c.condition===undefined)c.condition=100;
    if(c.braced===undefined)c.braced=false;
    if(c.wildlife===undefined)c.wildlife=6;
    if(c.fishStock===undefined)c.fishStock=6;
  }
  return s;
}
function migration(s,day=s.day){
  const habitats=['forest','valley','clearing'];
  return habitats[(Math.floor((day-1)/4)+(s.world?.seed||0)%3)%3];
}
function hazardsFor(s,weather,day){
  if(day<4)return [];
  const result=[];
  const pending=(s.world?.hazards||[]).filter(h=>h.until>=day);
  // Keep the ring connected: never close both river–rocks and forest–ruins.
  if((weather==='storm'&&day%2===0)||(weather==='rain'&&day%3===0)){
    if(!pending.some(h=>h.type==='treefall'))result.push({type:'flood',site:'river',edge:['river','rocks'],until:day});
  }else if(weather==='storm'&&!pending.some(h=>h.type==='flood'))result.push({type:'treefall',site:'forest',edge:['forest','ruins'],until:day+1});
  return result;
}
const active=s=>(s.world?.hazards||[]).filter(h=>h.until>=s.day);
const flooded=(s,id=s.location)=>active(s).some(h=>h.type==='flood'&&h.site===id);
const blocked=(s,from,to)=>active(s).find(h=>h.edge.includes(from)&&h.edge.includes(to)&&from!==to);
const shelter=(s,c=s.camps[s.location])=>c.structures.includes('shelter')&&(c.condition??100)>=40;
const huntChance=s=>cap(.35+(s.camps[s.location].wildlife??6)*.05+(s.location==='forest'?.15:0)+(s.day>=4&&migration(s)===s.location?.1:0)+(has(s,'binoculars')?.1:0),.2,.95);
const repairMats=s=>has(s,'toolroll')?{wood:2,fiber:1}:{wood:3,fiber:2};
const costs={reinforce:[60,10],repair:[60,10],clearTrail:[90,18],filter:[45,4]};
function cost(s,type,id){
  if(type==='investigate'&&D.landmarks[id]){
    const landmark=D.landmarks[id];
    const clue=(id==='ruins'&&s.milestones?.radio_clue)||(id==='valley'&&s.milestones?.fog_clue);
    return clue?[Math.max(0,landmark.time-30),Math.max(0,landmark.energy-4)]:[landmark.time,landmark.energy];
  }
  return costs[type];
}
function available(s,type,id){
  const c=s.camps[s.location];
  if(type==='travel'){
    const h=blocked(s,s.location,id);
    if(h)return h.type==='flood'?`น้ำหลากปิดทางถึงสิ้นวันที่ ${h.until} • ใช้เส้นทางอื่น`:`ต้นไม้ล้มปิดทางถึงสิ้นวันที่ ${h.until} • ใช้ขวานเปิดทางหรือเดินอ้อม`;
  }
  if(type==='hunt'&&c.wildlife<=0)return 'รอยสัตว์ในพื้นที่หมด • รอให้ฟื้นตัวหรือย้ายพื้นที่';
  if(type==='fish'&&(c.fishStock<=0||flooded(s)))return flooded(s)?'น้ำเชี่ยวเกินไป • รอน้ำลดหรือหาอาหารวิธีอื่น':'ปลารบกวนจนหนีหมด • รอให้ฟื้นตัวหรือย้ายพื้นที่';
  if(type==='investigate'){
    const p=D.landmarks[id];
    if(!p||id!==s.location)return 'ต้องอยู่ในพื้นที่ของจุดสำรวจ';
    if(!s.world.discovered.includes(id))return 'ใช้สำรวจเส้นทางเพื่อค้นหาจุดพิเศษก่อน';
    if(s.world.claimed.includes(id))return 'สำรวจและรับรางวัลจุดนี้แล้ว';
    if(flooded(s)&&id==='river')return 'น้ำตกเชี่ยวเกินไป • รอให้น้ำลดก่อน';
    if(Object.entries(p.mats).some(([k,n])=>(s.inv[k]||0)<n))return 'เตรียม '+Object.entries(p.mats).map(([k,n])=>`${D.items[k].name} ${n}`).join(' + ');
  }
  if(type==='filter'&&(!has(s,'water_filter')||!has(s,'dirty')))return !has(s,'water_filter')?'ต้องมีเครื่องกรองจากน้ำตกม่านเงิน':'ต้องมีน้ำจากลำธาร';
  if(['repair','reinforce'].includes(type)){
    if(!c.structures.length)return 'ยังไม่มีโครงสร้างให้ดูแล';
    if(type==='repair'&&c.condition>=100)return 'แคมป์สมบูรณ์แล้ว';
    if(type==='reinforce'&&c.braced)return 'ค้ำยันสำหรับคืนนี้แล้ว';
    const mats=type==='repair'?repairMats(s):{wood:2,fiber:2};
    if(Object.entries(mats).some(([k,n])=>(s.inv[k]||0)<n))return 'ต้องใช้ '+Object.entries(mats).map(([k,n])=>`${D.items[k].name} ${n}`).join(' + ');
  }
  if(type==='clearTrail'){
    if(!active(s).some(h=>h.type==='treefall'&&h.edge.includes(s.location)))return 'ไม่มีต้นไม้ล้มขวางทางใกล้พื้นที่นี้';
    if(!has(s,'axe'))return 'ต้องมีขวานหินเปิดทาง';
  }
  return '';
}
function perform(s,type,id,{add,pay,useTool,log}){
  const c=s.camps[s.location];
  if(type==='investigate'){
    const p=D.landmarks[id];pay(s,p.mats);s.world.claimed.push(id);
    Object.entries(p.reward).forEach(([k,n])=>add(s,k,n));log(s,p.story,'story');
    return `สำรวจ${p.name}สำเร็จ • ${Object.entries(p.reward).map(([k,n])=>`${D.items[k].name} ×${n}`).join(' / ')}`;
  }
  if(type==='filter'){const n=Math.min(2,s.inv.dirty);pay(s,{dirty:n});add(s,'water',n);return `กรองน้ำสะอาด ${n} หน่วยโดยไม่ใช้ไฟ`;}
  if(type==='repair'){pay(s,repairMats(s));c.condition=Math.min(100,c.condition+45);return `ซ่อมแคมป์แล้ว • ความแข็งแรง ${c.condition}%`;}
  if(type==='reinforce'){pay(s,{wood:2,fiber:2});c.braced=true;return 'ค้ำยันแคมป์แล้ว • ลดความเสียหาย 75% สำหรับคืนนี้';}
  if(type==='clearTrail'){
    s.world.hazards=s.world.hazards.filter(h=>!(h.type==='treefall'&&h.edge.includes(s.location)));
    useTool(s,'axe');add(s,'wood',3);return 'ตัดต้นไม้เปิดเส้นทางแล้ว • ได้ไม้ฟืน 3';
  }
  return null;
}
function discover(s,log){if(!s.world.discovered.includes(s.location)){s.world.discovered.push(s.location);log(s,`ค้นพบจุดพิเศษ: ${D.landmarks[s.location].name} • เตรียมตัวแล้วเข้าไปสำรวจเพื่อรับอุปกรณ์เฉพาะทาง`,'success');}}
function night(s,log){
  for(const [id,c]of Object.entries(s.camps)){
    if(c.structures.length&&s.day>=4){
      let damage=(s.weather==='storm'?Math.round(18*D.difficulties[s.difficulty].risk):0)+(flooded(s,id)?12:0);
      if(c.braced)damage*=.25;
      if(id===s.location&&has(s,'storm_tarp'))damage*=.5;
      damage=Math.round(damage);
      if(damage){c.condition=Math.max(0,c.condition-damage);log(s,`${D.sites.find(a=>a.id===id).name}: แคมป์เสียหาย ${damage} เหลือ ${c.condition}%${c.condition<40?' • เพิงพักกันฝนไม่ได้จนกว่าจะซ่อม':''}`,'warning');}
    }
    c.braced=false;
    c.wildlife=cap(c.wildlife+(migration(s,s.day+1)===id?2:(s.day%2===0?1:0)),0,6);
    c.fishStock=cap(c.fishStock+(['rain','storm'].includes(s.weather)?2:1),0,6);
  }
}
function dawn(s,log){
  s.world.hazards=active(s);
  for(const h of hazardsFor(s,s.weather,s.day)){
    s.world.hazards=s.world.hazards.filter(old=>old.type!==h.type);s.world.hazards.push(h);
    log(s,h.type==='flood'?'น้ำหลากที่ลำธาร • ทางไปเนินผาหินปิดวันนี้ ตกปลาไม่ได้ และแคมป์เสี่ยงเสียหายคืนนี้':'ต้นไม้ล้มปิดทางป่าดิบ–สถานีร้าง • เปิดทางด้วยขวานหรืออ้อมทางสันเขา','warning');
  }
  if(s.day>=4&&migration(s)!==migration(s,s.day-1))log(s,`ฝูงสัตว์ย้ายไป${D.sites.find(a=>a.id===migration(s)).name} • รอยสัตว์ฟื้นตัวเร็วขึ้นที่นั่น`,'story');
}
function validate(s){
  init(s);
  const w=s.world,integer=(n,a,b)=>Number.isInteger(n)&&n>=a&&n<=b;
  if(!w||!integer(w.seed,0,4294967295)||!Array.isArray(w.hazards)||w.hazards.length>2||!Array.isArray(w.eventsSeen)||new Set(w.eventsSeen).size!==w.eventsSeen.length||w.eventsSeen.some(id=>typeof id!=='string'||id.length>40))throw Error('ข้อมูลสภาพป่าไม่ถูกต้อง');
  for(const key of ['discovered','claimed'])if(!Array.isArray(w[key])||new Set(w[key]).size!==w[key].length||!w[key].every(k=>Object.hasOwn(D.landmarks,k)))throw Error('ข้อมูลจุดสำรวจไม่ถูกต้อง');
  if(!w.claimed.every(k=>w.discovered.includes(k)))throw Error('ข้อมูลรางวัลจุดสำรวจไม่ถูกต้อง');
  if(new Set(w.hazards.map(h=>h?.type)).size!==w.hazards.length)throw Error('ข้อมูลภัยซ้ำกัน');
  for(const h of w.hazards){const expected=h?.type==='flood'?['river','rocks']:h?.type==='treefall'?['forest','ruins']:null;if(!expected||!Array.isArray(h.edge)||h.edge.join()!==expected.join()||h.site!==expected[0]||!integer(h.until,1,31))throw Error('ข้อมูลเส้นทางปิดไม่ถูกต้อง');}
  for(const c of Object.values(s.camps))if(!integer(c.condition,0,100)||typeof c.braced!=='boolean'||!integer(c.wildlife,0,6)||!integer(c.fishStock,0,6))throw Error('ข้อมูลแคมป์และสัตว์ป่าไม่ถูกต้อง');
  return s;
}
return {init,migration,hazardsFor,active,flooded,blocked,shelter,huntChance,repairMats,cost,available,perform,discover,night,dawn,validate};
})();
if(typeof module!=='undefined')module.exports=WorldRules;
