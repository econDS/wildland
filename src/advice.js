'use strict';
// Read-only advice. Never advances time, changes the save, or consumes RNG.
const SurvivalAdvice=(()=>{
const E=typeof Survival!=='undefined'?Survival:require('./engine.js');
const D=typeof WILD!=='undefined'?WILD:require('./data.js');
function next(s){
  if(s.ended)return {key:'ended',icon:s.won?'signal':'leaf',kicker:'การเดินทางสิ้นสุด',title:s.won?'คุณได้กลับบ้านแล้ว':'ทุกการเดินทางสอนอะไรบางอย่าง',detail:`อยู่รอด ${s.day} วัน • สำรวจ ${s.visited.length} พื้นที่`,label:'เริ่มใหม่',newGame:true};
  if(s.event)return null;
  const c=E.camp(s),hard=s.difficulty==='wild',ready=(type,id)=>!E.available(s,type,id),has=id=>E.count(s,id)>0;
  const hint=(key,icon,title,detail,target={},critical=false)=>({key,icon,title,detail,kicker:critical?'สถานะวิกฤต':'ดูแลการเดินทาง',label:'ไปจัดการ',tone:critical?'warn':'',critical,...target});
  const activity=(key,icon,title,detail,type,filter)=>hint(key,icon,title,detail,{nav:filter?'craft':'gather',filter,action:type});
  const supplies=(key,ids,filter,title)=>{
    const carried=ids.find(id=>has(id)&&ready('consume',id));
    if(carried)return hint(key,D.items[carried].icon,title,D.items[carried].desc,{nav:'inventory',filter,item:carried,label:'เปิดกระเป๋า'});
    const cached=ids.find(id=>c.cache[id]>0&&ready('take',id));
    if(cached)return hint(key,D.items[cached].icon,`หยิบ${D.items[cached].name}จากคลัง`,`${D.items[cached].name}อยู่ในคลังพื้นที่นี้ ${c.cache[cached]} ชิ้น`,{nav:'inventory',filter:'cache',item:cached,label:'เปิดคลัง'});
    if(ids.some(id=>c.cache[id]>0))return hint(`${key}-cache-full`,'pack','จัดที่ว่างเพื่อหยิบเสบียงจากคลัง','กระเป๋าเต็ม • ฝากวัสดุที่ไม่จำเป็นในพื้นที่นี้',{nav:'inventory',filter:'all',label:'จัดกระเป๋า'});
    return null;
  };
  const unavailable=()=>{
    if(s.energy<20&&ready('rest'))return activity('rest','energy','พักสั้นเพื่อฟื้นพลังงาน',`พลังงาน ${Math.round(s.energy)} • ${E.world.shelter(s)?'พักใต้เพิงฟื้น 27':'พักกลางแจ้งฟื้น 21'}`,'rest');
    if(ready('sleep'))return hint('sleep','sleep','ตรวจสภาพร่างกายก่อนเข้านอน','เวลาในวันนี้อาจไม่พอสำหรับการเตรียมตัวเพิ่ม',{sleep:true,label:'ดูสรุปก่อนนอน'});
    return hint('supplies','pack','ตรวจเสบียงและอุปกรณ์ในพื้นที่','ดูของในกระเป๋าและคลัง ก่อนเลือกกิจกรรมถัดไป',{nav:'inventory',filter:'all',label:'เปิดกระเป๋า'});
  };
  const materials=(mats,purpose)=>{
    const missing=Object.entries(mats).filter(([m,n])=>E.count(s,m)<n);
    for(const [m,n] of missing){
      if(c.cache[m]>0&&ready('take',m))return hint(`take-${m}`,D.items[m].icon,`หยิบ${D.items[m].name}สำหรับ${purpose}`,`มี ${E.count(s,m)}/${n} • วัสดุอยู่ในคลังพื้นที่นี้`,{nav:'inventory',filter:'cache',item:m,label:'เปิดคลัง'});
      if(c.cache[m]>0)return hint(`space-${m}`,'pack',`จัดที่ว่างเพื่อหยิบวัสดุสำหรับ${purpose}`,'วัสดุอยู่ในคลัง แต่กระเป๋ายังไม่มีที่ว่างพอ',{nav:'inventory',filter:'all',label:'จัดกระเป๋า'});
      const type=m==='herb'?(ready('forage')?'forage':'explore'):m==='scrap'?'explore':m;
      if(m==='scrap'&&s.location!=='ruins'){
        if(E.routePlan(s,'ruins').nextHop&&ready('travel',E.routePlan(s,'ruins').nextHop))return hint('scrap-route','compass','ไปหาเศษโลหะที่สถานีร้าง',`เตรียมวัสดุสำหรับ${purpose}`,{nav:'map',map:'ruins',label:'เปิดแผนที่'});
      }else if(ready(type))return activity(`gather-${m}`,D.items[m].icon,`หา${D.items[m].name}สำหรับ${purpose}`,`มี ${E.count(s,m)}/${n} • ${m==='herb'?'การหาสมุนไพรมีโอกาสสุ่ม':'เก็บวัสดุที่ยังขาด'}`,type);
    }
    return null;
  };
  const prepare=id=>{
    const r=D.recipes[id];
    if(c.cache[id]>0&&ready('take',id))return hint(`take-${id}`,r.icon,`หยิบ${r.name}จากคลัง`,'อุปกรณ์พร้อมใช้งานอยู่ในพื้นที่นี้',{nav:'inventory',filter:'cache',item:id,label:'เปิดคลัง'});
    if(ready('craft',id))return hint(`craft-${id}`,r.icon,`สร้าง${r.name}`,r.desc,{nav:'craft',filter:r.group,action:'craft',actionId:id,label:'ไปที่สร้าง'});
    return materials(r.mats,r.name)||unavailable();
  };
  const repair=()=>ready('repair')?activity('repair','tent','ซ่อมเพิงพักให้ใช้งานได้',`ความแข็งแรง ${c.condition}% • ต้องมีอย่างน้อย 40%`,'repair','camp'):materials(E.world.repairMats(s),'ซ่อมแคมป์')||unavailable();
  const ignite=()=>ready('fire')?activity('fire','fire','จุดไฟหรือเติมฟืน',`ไฟเหลือ ${Math.round(c.fire)} นาที • เติมฟืนใช้ไม้ 2`,'fire','fire'):!c.structures.includes('firepit')?prepare('firepit'):has('wood')&&E.count(s,'wood')>=2?unavailable():ready('wood')?activity('firewood','wood','เก็บไม้สำหรับกองไฟ',`มีไม้ ${E.count(s,'wood')}/2`,'wood'):unavailable();
  const water=()=>{
    const supply=supplies('drink',['water'],'water','ดื่มน้ำสะอาดก่อน');if(supply)return supply;
    if(has('dirty')){
      if(ready('filter'))return activity('filter','water','กรองน้ำด้วยเครื่องกรองพกพา','ทำน้ำสะอาดได้สูงสุด 2 หน่วย • ไม่ใช้ไฟ','filter','fire');
      if(ready('boil'))return activity('boil','water','ต้มน้ำที่มีในกระเป๋า','ทำน้ำสะอาดได้สูงสุด 3 หน่วย','boil','fire');
      if(has('water_filter')&&E.cost(s,'filter')[0]+s.time>1320)return hint('water-time','water','เวลาไม่พอกรองหรือต้มน้ำ','น้ำที่เหลือยังไม่สะอาด • การดื่มมีความเสี่ยงป่วย',{nav:'inventory',filter:'water',label:'ตรวจน้ำที่เหลือ'});
      if(c.fire>=30||s.time+30>1320)return hint('water-time','water','ตรวจน้ำที่เหลือก่อนพัก','น้ำที่เหลือยังไม่สะอาด • การดื่มมีความเสี่ยงป่วย',{nav:'inventory',filter:'water',label:'ตรวจน้ำที่เหลือ'});
      return ignite();
    }
    if(c.cache.dirty>0&&ready('take','dirty'))return hint('take-dirty','water','หยิบน้ำจากคลังไปทำให้สะอาด','น้ำจากลำธารยังต้องกรองหรือต้มก่อนดื่ม',{nav:'inventory',filter:'cache',item:'dirty',label:'เปิดคลัง'});
    if(ready('water'))return activity('water','water','เก็บน้ำในพื้นที่นี้',`${E.world.flooded(s)?'น้ำหลาก เก็บได้ครั้งละ 1':'เก็บได้ครั้งละ 3'} • ${has('water_filter')?'กรองด้วยเครื่องกรองได้':'ต้องต้มก่อนดื่ม'}`,'water');
    const routes=D.sites.filter(a=>a.water).map(a=>({id:a.id,plan:E.routePlan(s,a.id)})).filter(a=>a.plan.nextHop&&ready('travel',a.plan.nextHop)).sort((a,b)=>a.plan.minutes-b.plan.minutes);
    if(routes.length)return hint('water-route','water','เดินทางไปแหล่งน้ำ',`พื้นที่ปัจจุบันเก็บน้ำไม่ได้ • แหล่งน้ำที่เดินทางได้: ${D.sites.find(a=>a.id===routes[0].id).name}`,{nav:'map',map:routes[0].id,label:'เปิดแผนที่'});
    if(Object.entries(c.cache).some(([id,n])=>n>0&&D.items[id].type==='water'))return hint('water-cache','pack','จัดที่ว่างเพื่อหยิบน้ำจากคลัง','กระเป๋าเต็ม • ฝากวัสดุที่ไม่จำเป็นในพื้นที่นี้',{nav:'inventory',filter:'all',label:'จัดกระเป๋า'});
    return unavailable();
  };
  const food=()=>{
    const supply=supplies('eat',['cooked','berries','ration','dried'],'food','กินอาหารที่พร้อมกิน');if(supply)return supply;
    if(has('raw'))return ready('cook')?activity('cook','food','ปรุงเนื้อสดก่อนกิน','ย่างเนื้อได้สูงสุด 2 ชิ้น • กินดิบเสี่ยงป่วย','cook','fire'):ignite();
    if(c.cache.raw>0&&ready('take','raw'))return hint('take-raw','food','หยิบเนื้อสดจากคลังมาปรุง','เนื้อสดต้องย่างหรือรมควันก่อนกิน',{nav:'inventory',filter:'cache',item:'raw',label:'เปิดคลัง'});
    for(const type of ['forage','fish','hunt'])if(ready(type))return activity(type,'food',type==='forage'?'หาอาหารที่พร้อมกิน':type==='fish'?'ตกปลาในพื้นที่นี้':'ล่าสัตว์ในพื้นที่นี้',type==='forage'?`แหล่งผลไม้เหลือ ${c.stock}/6`:type==='fish'?`ปลาเหลือ ${c.fishStock}/6 • ต้องปรุงก่อนกิน`:`รอยสัตว์ ${c.wildlife}/6 • สำเร็จ ${Math.round(E.world.huntChance(s)*100)}%`,type);
    if(!has('spear')&&c.wildlife>0)return prepare('spear');
    if(Object.entries(c.cache).some(([id,n])=>n>0&&D.items[id].type==='food'))return hint('food-cache','pack','จัดที่ว่างเพื่อหยิบอาหารจากคลัง','กระเป๋าเต็ม • ฝากวัสดุที่ไม่จำเป็นในพื้นที่นี้',{nav:'inventory',filter:'all',label:'จัดกระเป๋า'});
    const destination=D.sites.filter(a=>s.camps[a.id].stock>0).map(a=>({id:a.id,plan:E.routePlan(s,a.id)})).filter(a=>a.plan.nextHop&&ready('travel',a.plan.nextHop)).sort((a,b)=>a.plan.minutes-b.plan.minutes)[0];
    return destination?hint('food-route','food','ย้ายไปหาอาหารพื้นที่อื่น','อาหารในพื้นที่นี้หมดหรือยังหาไม่ได้',{nav:'map',map:destination.id,label:'เปิดแผนที่'}):unavailable();
  };
  const treatment=()=>{
    const ids=['medicine',...(s.wound||s.health<25?['bandage']:[])];
    const supply=supplies('heal',ids,'all',s.sickness||s.wound?'รักษาอาการป่วยและบาดแผล':'ใช้ยาฟื้นสุขภาพ');
    if(supply){if(supply.item==='bandage'&&s.sickness)supply.detail+=' • ผ้าพันแผลไม่รักษาอาการป่วย';return supply;}
    return prepare(s.sickness?'medicine':s.wound?'bandage':'medicine');
  };
  const warmth=()=>{
    if(ready('fire'))return ignite();
    if(c.structures.includes('shelter')&&!E.world.shelter(s))return repair();
    if(c.structures.includes('firepit')&&c.fire<120)return ignite();
    if(c.fire>0&&ready('rest'))return activity('warm-rest','temp','พักใกล้กองไฟเพื่อให้อุ่นขึ้น','พักในแคมป์ช่วยลดความเปียกและฟื้นความอบอุ่น','rest');
    if(!has('coat'))return prepare('coat');
    if(!c.structures.includes('shelter'))return prepare('shelter');
    return unavailable();
  };
  const urgent=(recommendation,detail)=>({...recommendation,kicker:'สถานะวิกฤต',tone:'warn',critical:true,detail:`${detail} • ${recommendation.detail}`});
  // Hard mode has no routine hints, build checklist, or rescue nudges.
  const healthCritical=s.health<25;
  if(healthCritical&&(has('medicine')||has('bandage')||c.cache.medicine||c.cache.bandage))return urgent(treatment(),`สุขภาพ ${Math.round(s.health)}/100`);
  if(s.water<(hard?25:30))return hard?urgent(water(),`น้ำในร่างกาย ${Math.round(s.water)}/100`):{...water(),tone:'warn'};
  if(s.food<(hard?25:30))return hard?urgent(food(),`ความอิ่ม ${Math.round(s.food)}/100`):{...food(),tone:'warn'};
  if(s.warmth<25)return urgent(warmth(),`ความอบอุ่น ${Math.round(s.warmth)}/100`);
  if(s.energy<(hard?10:20))return urgent(unavailable(),`พลังงาน ${Math.round(s.energy)}/100`);
  if(healthCritical)return urgent(treatment(),`สุขภาพ ${Math.round(s.health)}/100`);
  const night=E.sleepPreview(s);
  if(hard){
    if(ready('sleep')&&(night.healthMin<25||(s.time>=1140&&night.causes.some(a=>['water','food','warmth'].includes(a.id)))))return hint('critical-night','sleep','คืนนี้เสี่ยงเข้าสู่ภาวะวิกฤต',`สุขภาพหลังพักประมาณ ${Math.round(night.healthMin)}${night.healthMin!==night.health?`–${Math.round(night.health)}`:''}/100${night.causes.length?` • ${night.causes.map(a=>a.label).join(' / ')}`:''}`,{sleep:true,label:'ดูสรุปก่อนนอน'},true);
    return null;
  }
  if(s.sickness||s.wound)return treatment();
  if(s.time>=1140&&ready('sleep')){
    const cause=night.causes.find(a=>['water','food','warmth'].includes(a.id));
    if(cause)return {...(cause.id==='water'?water():cause.id==='food'?food():warmth()),kicker:'เตรียมคืนนี้',tone:'warn'};
    return hint('sleep','sleep','เตรียมตัวเข้านอน',`สุขภาพหลังพักประมาณ ${Math.round(night.healthMin)}${night.healthMin!==night.health?`–${Math.round(night.health)}`:''}/100`,{sleep:true,label:'ดูสรุปก่อนนอน'});
  }
  if(c.structures.includes('shelter')&&!E.world.shelter(s))return repair();
  if(s.day>=4&&(s.weather==='storm'||E.world.flooded(s))&&c.structures.length&&!c.braced)return ready('reinforce')?activity('reinforce','tent','ค้ำยันแคมป์ก่อนคืนนี้','ลดความเสียหายแคมป์ 75% สำหรับหนึ่งคืน','reinforce','camp'):materials({wood:2,fiber:2},'ค้ำยันแคมป์')||unavailable();
  if(!s.milestones.shelter)return prepare('shelter');
  if(!s.milestones.firepit)return prepare('firepit');
  if(!s.visited.includes('river')&&!s.visited.includes('valley'))return hint('water-discovery','water','สำรวจแหล่งน้ำ','วางเส้นทางน้ำสำหรับวันถัดไป',{nav:'map',map:'river',label:'เปิดแผนที่'});
  if(ready('signal'))return hint('signal','signal','ส่งสัญญาณขอความช่วยเหลือได้แล้ว','วิทยุพร้อมและอากาศเอื้อต่อการส่งสัญญาณ',{nav:'quest',label:'ไปส่งสัญญาณ',tone:'ok'});
  const parts=['radio','battery','wire'].filter(has).length;
  if(parts===3&&s.day<10)return hint('await-rescue','signal','รักษาเสบียงระหว่างรอเที่ยวบินค้นหา',`ชิ้นส่วนครบแล้ว • เริ่มส่งสัญญาณได้วันที่ 10 (อีก ${10-s.day} วัน)`,{nav:'quest',label:'ดูภารกิจ'});
  if(parts===3&&s.weather==='storm')return hint('await-weather','signal','รอพายุผ่านก่อนส่งสัญญาณ','ครบ 3 ชิ้นแล้ว • วันนี้พายุรบกวนสัญญาณ',{nav:'quest',label:'ดูภารกิจ'});
  return hint('rescue','signal',parts===3?'ไปส่งสัญญาณที่สันเขา':'ตามหาชิ้นส่วนวิทยุ',parts===3?'ส่งได้ที่สันเขาในวันที่ไม่มีพายุ':`พบแล้ว ${parts}/3 • สำรวจสถานีร้าง หุบเขาหมอก และสันเขา`,{nav:parts===3?'map':'quest',map:parts===3?'ridge':undefined,label:parts===3?'เปิดแผนที่':'ดูภารกิจ'});
}
return {next};
})();
if(typeof module!=='undefined')module.exports=SurvivalAdvice;
