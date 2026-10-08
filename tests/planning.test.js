'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../src/engine.js');
const Advice=require('../src/advice.js');
const fresh=difficulty=>E.newGame(difficulty||'survivor',42);
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} should equal ${b}`);

test('hard mode stays quiet for routine building, injury, weather and rescue',()=>{
  const s=fresh('wild');
  assert.equal(Advice.next(s),null);
  s.sickness=2;s.wound=2;s.weather='storm';s.day=10;
  assert.equal(Advice.next(s),null);
  s.weather='clear';
  s.location='ridge';s.inv.radio=1;s.inv.battery=1;s.inv.wire=1;
  assert.equal(E.available(s,'signal'),'');
  assert.equal(Advice.next(s),null);
  s.camps.ridge.structures=['shelter','firepit'];s.camps.ridge.condition=35;
  assert.equal(Advice.next(s),null);
});

test('hard mode warns only at critical thresholds and stops after recovery',()=>{
  for(const [stat,value] of [['water',24],['food',24],['warmth',24],['energy',9],['health',24]]){
    const s=fresh('wild');s[stat]=value;
    assert.equal(Advice.next(s).critical,true,stat);
    s[stat]=stat==='energy'?10:25;
    assert.equal(Advice.next(s),null,`${stat} recovered`);
  }
});

test('hard mode warns about a dangerous night, but not a healthy evening',()=>{
  const s=fresh('wild');s.time=1260;s.camps.clearing.structures=['shelter','firepit'];s.camps.clearing.fire=180;
  assert.equal(Advice.next(s),null);
  s.water=25;
  assert.equal(Advice.next(s).key,'critical-night');
  s.water=72;s.health=26;s.wound=2;
  assert.equal(Advice.next(s).key,'critical-night');
});

test('advice prefers carried supplies, then local cache, and uses the portable filter',()=>{
  const s=fresh();s.water=20;
  assert.equal(Advice.next(s).key,'drink');
  delete s.inv.water;s.camps.clearing.cache.water=3;
  let hint=Advice.next(s);assert.equal(hint.filter,'cache');assert.equal(hint.item,'water');
  s.camps.clearing.cache.water=0;s.inv.dirty=2;s.inv.water_filter=1;
  hint=Advice.next(s);assert.equal(hint.key,'filter');assert.equal(hint.action,'filter');
  assert.equal(hint.filter,'fire');assert.equal(E.available(s,hint.action),'');
});

test('water advice respects cooking time, fire, energy and accessible routes',()=>{
  const s=fresh();s.water=20;delete s.inv.water;s.inv.dirty=2;
  s.inv.water_filter=1;s.time=1290;s.camps.clearing.structures=['firepit'];s.camps.clearing.fire=60;
  assert.equal(Advice.next(s).key,'boil','a 30 minute boil fits when the 45 minute filter does not');
  s.time=1320;assert.equal(Advice.next(s).nav,'inventory');
  s.time=420;s.energy=2;s.inv.dirty=0;
  assert.equal(Advice.next(s).key,'rest');
  s.energy=100;s.day=4;s.location='rocks';
  s.world.hazards=[{type:'flood',site:'river',edge:['river','rocks'],until:4}];
  const hint=Advice.next(s);assert.equal(hint.nav,'map');
  assert.equal(E.available(s,'travel',E.routePlan(s,hint.map).nextHop),'');
});

test('full packs with local food or water prompt freeing space, not more gathering',()=>{
  for(const stat of ['water','food']){
    const s=fresh();s.inv={stone:48};s[stat]=20;
    s.camps.clearing.cache[stat==='water'?'water':'ration']=2;
    const hint=Advice.next(s);assert.equal(hint.nav,'inventory');assert.equal(hint.filter,'all');
    assert.match(hint.key,/cache-full/);
  }
});

test('regular advice treats persistent conditions and repairs unusable shelters',()=>{
  const s=fresh();s.sickness=2;s.inv.medicine=1;
  assert.equal(Advice.next(s).item,'medicine');
  s.sickness=0;s.wound=2;delete s.inv.medicine;
  assert.equal(Advice.next(s).item,'bandage');
  s.wound=0;s.camps.clearing.structures=['shelter'];s.camps.clearing.condition=35;
  assert.equal(Advice.next(s).action,'repair');
  const wood=s.inv.wood;s.inv.wood=0;
  assert.equal(Advice.next(s).action,'wood','missing repair material links to an available gather action');
  s.camps.clearing.cache.wood=3;
  assert.equal(Advice.next(s).item,'wood','cached repair material is preferred');
  s.camps.clearing.cache.wood=0;s.inv.wood=wood;
  s.camps.clearing.condition=100;s.day=4;s.weather='storm';
  assert.equal(Advice.next(s).action,'reinforce');
});

test('routine build advice recovers cached materials before gathering',()=>{
  const s=fresh();s.camps.clearing.cache.wood=4;
  const hint=Advice.next(s);assert.equal(hint.item,'wood');assert.equal(hint.filter,'cache');
});

test('advice and sleep previews never change state or RNG, including during encounters',()=>{
  const s=fresh('wild');s.time=1140;s.water=10;
  const before=JSON.stringify(s);
  for(let i=0;i<20;i++){Advice.next(s);E.sleepPreview(s);}
  assert.equal(JSON.stringify(s),before);
  s.event='snake';assert.equal(Advice.next(s),null);
});

test('sleep preview accounts for the actual duration, shelter, food and water',()=>{
  const s=fresh();s.time=1260;s.food=30;s.water=35;s.warmth=60;s.energy=50;s.health=80;s.wet=20;s.weather='rain';
  s.camps.clearing.structures=['shelter','firepit','bed'];s.camps.clearing.fire=120;
  const p=E.sleepPreview(s);
  close(p.food,19.5);close(p.water,21.5);close(p.warmth,65);
  assert.equal(p.energy,100);assert.equal(p.health,80);assert.equal(p.healthMin,80);assert.equal(p.wet,0);
  assert.deepEqual(p.causes,[]);assert.equal(p.attackRisk,0);
  assert.equal(E.action(s,'sleep').ok,true);
  for(const key of ['food','water','warmth','energy','health','wet'])close(s[key],p[key]);
});

test('severe hard-mode night preview includes all damage and wildlife risk',()=>{
  const s=fresh('wild');Object.assign(s,{day:21,time:900,location:'ridge',weather:'storm',food:20,water:20,warmth:40,health:80,wet:60,sickness:2,wound:2});
  const p=E.sleepPreview(s);
  assert.equal(p.food,0);assert.equal(p.water,0);assert.equal(p.warmth,0);
  close(p.loss,67.5);close(p.health,12.5);close(p.healthMin,2.5);close(p.attackRisk,.156);
  assert.deepEqual(p.causes.map(c=>c.id),['food','water','warmth','sickness','wound']);
});

test('night projections bound actual outcomes over difficulties, seeds and shelter states',()=>{
  for(const difficulty of ['explorer','survivor','wild'])for(const seed of [1,7,42,1234,9182])for(const shelter of [false,true]){
    const s=E.newGame(difficulty,seed);Object.assign(s,{day:8,time:1140,weather:'rain',food:55,water:60,warmth:60,health:85,sickness:1,energy:100});
    s.inv.sleeping_bag=1;
    if(shelter)s.camps.clearing.structures=['shelter','bed'];
    const p=E.sleepPreview(s);assert.equal(E.action(s,'sleep').ok,true);
    for(const key of ['food','water','warmth','energy','wet'])close(s[key],p[key]);
    assert.ok(s.health>=p.healthMin-1e-8&&s.health<=p.health+1e-8);
    E.validate(s);
  }
});

test('bulk transfers move the selected amount once without spending time or RNG',()=>{
  const s=fresh(),time=s.time,seed=s.seed,actions=s.actions,logs=s.logs.length;
  const before=E.weight(s),plan=E.inventoryPlan(s,'stash','wood',3);
  assert.equal(plan.ok,true);close(plan.weight,before-1.8);
  assert.equal(E.action(s,'stash','wood',3).ok,true);
  assert.equal(s.inv.wood,1);assert.equal(s.camps.clearing.cache.wood,3);assert.equal(s.logs.length,logs+1);
  assert.equal(E.action(s,'take','wood',2).ok,true);
  assert.equal(s.inv.wood,3);assert.equal(s.camps.clearing.cache.wood,1);
  assert.equal(E.action(s,'drop','wood',3).ok,true);assert.equal(s.inv.wood,undefined);
  assert.equal(s.time,time);assert.equal(s.seed,seed);assert.equal(s.actions,actions);E.validate(s);
});

test('invalid quantities, quests, terminal saves and encounters reject transfers atomically',()=>{
  const invalid=[['stash','wood',0],['stash','wood',-1],['stash','wood',1.5],['stash','wood',NaN],['stash','wood','2'],['stash','wood',99],['take','wood',1],['stash','radio',1],['drop','radio',1],['consume','water',2]];
  for(const [type,id,n]of invalid){const s=fresh();s.inv.radio=1;const before=JSON.stringify(s);assert.equal(E.action(s,type,id,n).ok,false);assert.equal(JSON.stringify(s),before);}
  for(const patch of [{event:'snake'},{ended:true}]){const s=Object.assign(fresh(),patch),before=JSON.stringify(s);assert.equal(E.action(s,'stash','wood',2).ok,false);assert.equal(JSON.stringify(s),before);}
});

test('taking too many leaves cache untouched, but the advertised maximum fits',()=>{
  const s=fresh();s.inv={stone:47};s.camps.clearing.cache.wood=5;
  const p=E.inventoryPlan(s,'take','wood');assert.equal(p.max,0);assert.equal(p.ok,false);
  s.inv.stone=44;
  const plan=E.inventoryPlan(s,'take','wood');assert.equal(plan.max,3);
  const before=JSON.stringify(s);assert.equal(E.action(s,'take','wood',4).ok,false);assert.equal(JSON.stringify(s),before);
  assert.equal(E.action(s,'take','wood',3).ok,true);assert.equal(s.camps.clearing.cache.wood,2);close(E.weight(s),23.8);E.validate(s);
});

test('backpack capacity is applied to the resulting inventory and cannot strand excess weight',()=>{
  const s=fresh();s.inv={stone:47};s.camps.clearing.cache.pack=1;
  assert.equal(E.action(s,'take','pack').ok,true);assert.equal(E.capacity(s),38);close(E.weight(s),24);
  s.inv.stone=60;
  const before=JSON.stringify(s);assert.equal(E.action(s,'stash','pack').ok,false);assert.equal(JSON.stringify(s),before);
  assert.equal(E.action(s,'stash','stone',13).ok,true);
  const plan=E.inventoryPlan(s,'stash','pack');assert.equal(plan.capacity,24);
  assert.equal(E.action(s,'stash','pack').ok,true);close(E.weight(s),23.5);E.validate(s);
});

test('cached tools retain their remaining durability across bulk inventory changes',()=>{
  const s=fresh();s.inv.axe=1;s.tools.axe=3;
  assert.equal(E.action(s,'stash','axe').ok,true);
  assert.equal(E.action(s,'take','axe').ok,true);
  assert.equal(s.tools.axe,3);E.validate(s);
});

test('every hint names a topic so the UI can stop repeating it once learned',()=>{
  const states=[fresh(),fresh('explorer')];
  const thirsty=fresh();thirsty.water=20;
  const hungry=fresh();hungry.food=20;
  const cold=fresh();cold.warmth=10;
  const evening=fresh();evening.time=1150;
  states.push(thirsty,hungry,cold,evening);
  const topics=new Set();
  for(const s of states){
    const hint=Advice.next(s);
    assert.ok(hint,'expected a hint');
    assert.equal(typeof hint.topic,'string');assert.ok(hint.topic.length>0);
    topics.add(hint.topic);
  }
  assert.ok(topics.size>1,'different needs should teach different topics');
});
