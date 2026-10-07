'use strict';
const WILD = (() => {
const items = {
wood:{name:'ไม้ฟืน',icon:'wood',weight:.6,type:'material',desc:'เชื้อเพลิงและโครงสร้าง • หาได้ในป่า'},
stone:{name:'ก้อนหิน',icon:'rock',weight:.5,type:'material',desc:'ทำหลุมไฟและเครื่องมือ • พบมากที่เนินหิน'},
fiber:{name:'เส้นใยพืช',icon:'leaf',weight:.15,type:'material',desc:'ผูกโครงสร้างและทำเชือก • เก็บจากพุ่มไม้'},
herb:{name:'สมุนไพร',icon:'leaf',weight:.1,type:'material',desc:'ใช้ทำยารักษาอาการป่วย'},
scrap:{name:'เศษโลหะ',icon:'tool',weight:.4,type:'material',desc:'ค้นหาในสถานีร้าง • ใช้ทำอุปกรณ์'},
berries:{name:'ผลไม้ป่า',icon:'food',weight:.2,type:'food',food:16,water:4,decay:.15,desc:'ความอิ่ม +16 • น้ำ +4 • เสื่อมสภาพข้ามคืน'},
ration:{name:'เสบียงแห้ง',icon:'food',weight:.4,type:'food',food:36,desc:'ความอิ่ม +36 • เก็บได้นาน'},
raw:{name:'เนื้อสด',icon:'food',weight:.5,type:'food',food:15,risk:.45,decay:.6,desc:'กินดิบเสี่ยงป่วย 45% • ควรปรุงด้วยไฟ'},
cooked:{name:'เนื้อย่าง',icon:'food',weight:.4,type:'food',food:38,health:3,decay:.3,desc:'ความอิ่ม +38 • สุขภาพ +3 • เสื่อมสภาพข้ามคืน'},
dried:{name:'เนื้อรมควัน',icon:'food',weight:.25,type:'food',food:30,water:-4,desc:'ความอิ่ม +30 • น้ำ −4 • เก็บได้นาน'},
water:{name:'น้ำสะอาด',icon:'water',weight:.5,type:'water',water:34,desc:'น้ำในร่างกาย +34 • พร้อมดื่ม'},
dirty:{name:'น้ำจากลำธาร',icon:'water',weight:.5,type:'water',water:24,risk:.35,desc:'น้ำ +24 • เสี่ยงป่วย 35% • ต้มก่อนดื่ม'},
medicine:{name:'ยาสมุนไพร',icon:'medical',weight:.15,type:'medical',health:22,cure:true,desc:'สุขภาพ +22 • รักษาอาการป่วยและบาดเจ็บ'},
bandage:{name:'ผ้าพันแผล',icon:'medical',weight:.1,type:'medical',health:12,wound:true,desc:'สุขภาพ +12 • รักษาแผล'},
axe:{name:'ขวานหิน',icon:'axe',weight:1.2,type:'tool',durability:24,desc:'เก็บไม้เพิ่มครั้งละ 3 • สึกหรอเมื่อใช้งาน'},
spear:{name:'หอกล่าสัตว์',icon:'spear',weight:1,type:'tool',durability:18,desc:'ใช้ล่าสัตว์และป้องกันตัว'},
rod:{name:'เบ็ดตกปลา',icon:'fish',weight:.6,type:'tool',durability:20,desc:'ตกปลาที่ลำธาร • สึกหรอเมื่อใช้งาน'},
coat:{name:'เสื้อคลุมกันฝน',icon:'shield',weight:.8,type:'tool',desc:'ลดการเปียกและสูญเสียความอบอุ่น'},
pack:{name:'กระเป๋าเสริม',icon:'pack',weight:.5,type:'tool',desc:'เพิ่มความจุกระเป๋าจาก 24 เป็น 38 กก.'},
radio:{name:'วิทยุชำรุด',icon:'radio',weight:.7,type:'quest',desc:'ค้นพบที่สถานีร้าง • ชิ้นส่วนส่งสัญญาณกู้ภัย'},
battery:{name:'แบตเตอรี่',icon:'battery',weight:.5,type:'quest',desc:'ค้นพบที่หุบเขาหมอก • ชิ้นส่วนส่งสัญญาณกู้ภัย'},
wire:{name:'สายสัญญาณ',icon:'signal',weight:.3,type:'quest',desc:'ค้นพบที่สันเขา • ชิ้นส่วนส่งสัญญาณกู้ภัย'}
};
const recipes = {
axe:{name:'ขวานหิน',icon:'axe',mats:{wood:2,stone:3,fiber:2},time:60,energy:8,desc:'เก็บไม้ได้มากขึ้น 3 ชิ้นต่อครั้ง',group:'tool'},
spear:{name:'หอกล่าสัตว์',icon:'spear',mats:{wood:3,stone:2,fiber:1},time:60,energy:8,desc:'ปลดล็อกการล่า • ลดอันตรายจากสัตว์',group:'tool'},
rod:{name:'เบ็ดตกปลา',icon:'fish',mats:{wood:2,fiber:4,scrap:1},time:60,energy:6,desc:'จับปลาได้ 1–3 ชิ้นที่ลำธาร',group:'tool'},
coat:{name:'เสื้อคลุมกันฝน',icon:'shield',mats:{fiber:10},time:90,energy:8,desc:'ลดความเปียกและความหนาวระหว่างเดินทาง',group:'tool'},
pack:{name:'กระเป๋าเสริม',icon:'pack',mats:{fiber:8,scrap:2},time:90,energy:8,desc:'บรรทุกสัมภาระได้สูงสุด 38 กก.',group:'tool'},
medicine:{name:'ยาสมุนไพร',icon:'medical',mats:{herb:3,fiber:1},time:30,energy:3,desc:'รักษาป่วยและแผล • สุขภาพ +22',group:'medical'},
bandage:{name:'ผ้าพันแผล',icon:'medical',mats:{fiber:3,herb:1},time:30,energy:3,desc:'รักษาบาดแผล • สุขภาพ +12',group:'medical'},
shelter:{name:'เพิงพัก',icon:'tent',mats:{wood:6,fiber:6},time:120,energy:14,desc:'กันฝน • นอนฟื้นแรงมากขึ้น • อยู่ที่พื้นที่นี้',group:'camp'},
firepit:{name:'หลุมกองไฟ',icon:'fire',mats:{wood:3,stone:4},time:60,energy:8,desc:'ใช้จุดไฟ ต้มน้ำ ปรุงอาหาร และให้ความอบอุ่น',group:'camp'},
bed:{name:'ที่นอนใบไม้',icon:'sleep',mats:{wood:2,fiber:6},time:60,energy:8,desc:'ฟื้นพลังเพิ่ม 18 และสุขภาพเพิ่ม 5 เมื่อนอน',group:'camp',requires:'shelter'},
collector:{name:'ถังรองน้ำฝน',icon:'rain',mats:{wood:3,fiber:4,scrap:2},time:90,energy:10,desc:'เก็บน้ำสะอาด 3–5 หน่วยไว้ในคลังเมื่อฝนตกข้ามคืน',group:'camp'},
rack:{name:'ราวรมควัน',icon:'food',mats:{wood:4,fiber:3},time:60,energy:8,desc:'ปลดล็อกเนื้อรมควันซึ่งไม่เน่าเสีย',group:'camp'}
};
const sites = [
{id:'clearing',name:'ลานสน',subtitle:'PINE CLEARING',desc:'แสงแรกลอดผ่านทิวสน ที่นี่พอจะเป็นบ้านได้… ชั่วคราว',x:25,y:68,alt:846,temp:1,links:['forest','river'],wood:3,stone:2,fiber:3,risk:.05,resource:'ไม้ฟืน · เส้นใย · ผลไม้',color:'#8c9a69'},
{id:'forest',name:'ป่าดิบลึก',subtitle:'OLD-GROWTH FOREST',desc:'ใต้เรือนยอดที่หนาทึบ ทุกเสียงอาจเป็นทั้งโอกาสและคำเตือน',x:36,y:42,alt:980,temp:-1,links:['clearing','ruins','valley'],wood:5,stone:1,fiber:4,risk:.14,resource:'ไม้ฟืนมาก · สมุนไพร · สัตว์ป่า',color:'#637f60'},
{id:'river',name:'ลำธารหินขาว',subtitle:'WHITEWATER CREEK',desc:'สายน้ำเย็นไหลผ่านหินขาว เสียงของมันกลบฝีเท้าทุกอย่าง',x:54,y:76,alt:712,temp:0,links:['clearing','rocks'],wood:2,stone:3,fiber:2,risk:.08,resource:'น้ำ · ปลา · หิน',color:'#7caaaa',water:true},
{id:'rocks',name:'เนินผาหิน',subtitle:'GRANITE BLUFF',desc:'พื้นดินค่อย ๆ หายไป เหลือเพียงลมหอบเย็นและหินแกรนิต',x:72,y:56,alt:1180,temp:-3,links:['river','ridge'],wood:1,stone:5,fiber:1,risk:.14,resource:'หินมาก · ทางขึ้นสันเขา',color:'#a4a897'},
{id:'ruins',name:'สถานีพิทักษ์ร้าง',subtitle:'ABANDONED OUTPOST',desc:'หลังคาสังกะสีผุกร่อน ใครบางคนเคยอยู่ที่นี่ก่อนคุณ',x:53,y:28,alt:1070,temp:0,links:['forest','ridge'],wood:2,stone:2,fiber:2,risk:.12,resource:'เศษโลหะ · เสบียง · วิทยุ',color:'#ae9878',quest:'radio'},
{id:'valley',name:'หุบเขาหมอก',subtitle:'MIST VALLEY',desc:'ซากอุปกรณ์สำรวจจมอยู่ในหมอก เส้นทางขากลับเริ่มเลือนหาย',x:17,y:22,alt:630,temp:-2,links:['forest'],wood:4,stone:2,fiber:4,risk:.18,resource:'สมุนไพร · แบตเตอรี่ · น้ำ',color:'#819d91',water:true,quest:'battery'},
{id:'ridge',name:'สันเขาสุดท้าย',subtitle:'LAST LIGHT RIDGE',desc:'เหนือแนวไม้ ท้องฟ้ากว้างพอจะส่งเสียงของคุณออกไป',x:81,y:17,alt:1642,temp:-5,links:['rocks','ruins'],wood:1,stone:4,fiber:1,risk:.2,resource:'สายสัญญาณ · จุดส่งสัญญาณกู้ภัย',color:'#a9b5a8',quest:'wire'}
];
const weather={clear:{name:'ฟ้าโปร่ง',icon:'sun',temp:19,wet:0,cold:0},cloudy:{name:'เมฆมาก',icon:'cloud',temp:15,wet:0,cold:1},rain:{name:'ฝนตก',icon:'rain',temp:11,wet:12,cold:3},storm:{name:'พายุฝน',icon:'storm',temp:7,wet:20,cold:5}};
const difficulties={explorer:{name:'นักสำรวจ',desc:'เสบียงมากขึ้น ร่างกายลดช้าลง เหมาะกับการเรียนรู้',decay:.72,risk:.65},survivor:{name:'ผู้รอดชีวิต',desc:'ทรัพยากรมีจำกัด ทุกการตัดสินใจมีราคา',decay:1,risk:1},wild:{name:'ป่าไร้ปรานี',desc:'ร่างกายลดเร็วขึ้น อุบัติเหตุรุนแรง เสบียงเริ่มต้นน้อย',decay:1.25,risk:1.3}};
Object.assign(items,{
  compass:{name:'เข็มทิศสนาม',icon:'compass',weight:.2,type:'tool',desc:'รางวัลจากหีบใต้รากสน • เดินทางเร็วขึ้น 15 นาที'},
  boots:{name:'รองเท้าเดินป่า',icon:'shield',weight:.7,type:'tool',desc:'รางวัลจากห้างพราน • เดินทางใช้พลังงานน้อยลง 4'},
  water_filter:{name:'เครื่องกรองพกพา',icon:'water',weight:.4,type:'tool',desc:'รางวัลจากน้ำตก • กรองน้ำสะอาด 2 หน่วยใน 45 นาที ไม่ใช้ไฟ'},
  sleeping_bag:{name:'ถุงนอนฉนวน',icon:'sleep',weight:1,type:'tool',desc:'รางวัลจากถ้ำ • ลดความหนาวกลางคืน 6 และฟื้นแรงเพิ่ม 8'},
  toolroll:{name:'ชุดเครื่องมือช่าง',icon:'tool',weight:.6,type:'tool',desc:'รางวัลจากคลังสถานี • ซ่อมแคมป์ใช้ไม้ 2 + เส้นใย 1'},
  storm_tarp:{name:'ผ้าใบกู้ภัย',icon:'tent',weight:.6,type:'tool',desc:'รางวัลจากซากเครื่องบิน • ลดความเสียหายแคมป์ที่คุณพักลงครึ่งหนึ่ง'},
  binoculars:{name:'กล้องส่องทางไกล',icon:'eye',weight:.4,type:'tool',desc:'รางวัลจากจุดชมวิว • ล่าสำเร็จเพิ่ม 10% และลดเสี่ยงสำรวจ 4%'},
  torch:{name:'คบไฟสำรวจ',icon:'fire',weight:.3,type:'material',desc:'ใช้ส่องทางในถ้ำ • ใช้หมดเมื่อสำรวจจุดพิเศษ'},
  climbing_rope:{name:'เชือกปีนเขา',icon:'tool',weight:.4,type:'material',desc:'ใช้ลงไปยังแอ่งน้ำตก • ใช้หมดเมื่อสำรวจจุดพิเศษ'}
});
Object.assign(recipes,{
  torch:{name:'คบไฟสำรวจ',icon:'fire',mats:{wood:1,fiber:2},time:30,energy:4,desc:'เตรียมแสงสำหรับสำรวจถ้ำ ใช้ครั้งเดียว',group:'exploration'},
  climbing_rope:{name:'เชือกปีนเขา',icon:'tool',mats:{fiber:5},time:45,energy:6,desc:'เตรียมเชือกลงแอ่งน้ำตก ใช้ครั้งเดียว',group:'exploration'}
});
const landmarks={
  clearing:{name:'หีบใต้รากสน',kind:'HIDDEN CACHE',icon:'compass',hint:'รอยสลักบนต้นสนชี้ไปยังเนินเล็ก ๆ',story:'ใต้รากไม้มีหีบกันน้ำของนักสำรวจ เข็มทิศด้านในยังทำงานได้',time:60,energy:10,mats:{},reward:{compass:1,ration:2}},
  forest:{name:'ห้างพรานเก่า',kind:'HUNTER’S WATCH',icon:'tent',hint:'บันไดไม้เก่าหายขึ้นไปในเรือนยอด',story:'คุณขึ้นถึงชานไม้และพบรองเท้าที่แข็งแรง พร้อมเสบียงของเจ้าของเก่า',time:90,energy:14,mats:{},reward:{boots:1,dried:2}},
  river:{name:'น้ำตกม่านเงิน',kind:'SILVERFALL',icon:'water',hint:'เสียงน้ำอีกสายดังมาจากหลังหน้าผา',story:'หลังม่านน้ำมีถุงอุปกรณ์สำรวจ เครื่องกรองน้ำถูกเก็บในกล่องกันกระแทก',time:120,energy:18,mats:{climbing_rope:1},reward:{water_filter:1,water:2}},
  rocks:{name:'ถ้ำแสงหิ่งห้อย',kind:'FIREFLY CAVERN',icon:'mountain',hint:'ลมเย็นพัดออกมาจากรอยแยกในหิน',story:'แสงคบไฟเผยที่พักเก่าในโพรงลึก ถุงนอนยังแห้งอยู่ในถุงผนึก',time:120,energy:18,mats:{torch:1},reward:{sleeping_bag:1,medicine:1}},
  ruins:{name:'คลังอุปกรณ์สถานี',kind:'RANGER’S LOCKER',icon:'tool',hint:'ประตูเหล็กข้างสถานียังปิดสนิท',story:'คุณงัดบานประตูที่ติดสนิม พบชุดเครื่องมือช่างกับโลหะสำรอง',time:90,energy:16,mats:{},reward:{toolroll:1,scrap:4}},
  valley:{name:'ซากเครื่องบินสำรวจ',kind:'THE LOST FLIGHT',icon:'shield',hint:'เศษอะลูมิเนียมสะท้อนแสงอยู่ในหมอก',story:'ในห้องสัมภาระมีผ้าใบกู้ภัยเก็บม้วนไว้ คุณนำมันออกมาก่อนหมอกจะลงจัด',time:120,energy:18,mats:{},reward:{storm_tarp:1,ration:3}},
  ridge:{name:'จุดชมวิวเหนือเมฆ',kind:'ABOVE THE CLOUDS',icon:'eye',hint:'ธงเก่าปลิวอยู่เหนือทางเดินช่วงสุดท้าย',story:'จากจุดนี้คุณมองเห็นป่าแทบทั้งหมด กล้องส่องทางไกลในกล่องเฝ้าระวังยังใช้ได้',time:90,energy:16,mats:{},reward:{binoculars:1,bandage:2}}
};
return {items,recipes,sites,weather,difficulties,landmarks};
})();
if(typeof module!=='undefined')module.exports=WILD;
