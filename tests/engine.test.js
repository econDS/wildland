'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../src/engine.js');
const D=require('../src/data.js');
const fresh=()=>E.newGame('survivor',1234);
const act=(s,k,id)=>{const r=E.action(s,k,id);assert.equal(r.ok,true,r.message);E.validate(s);return r;};
const equip=s=>{s.inv={wood:15,stone:8,fiber:15,water:3,ration:4,herb:4};s.energy=100;};
test('fresh state, rejected actions are atomic, seeded actions are reproducible',()=>{
const a=fresh(),b=fresh();E.validate(a);const before=JSON.stringify(a);assert.equal(E.action(a,'craft','shelter').ok,false);assert.equal(E.action(a,'travel','ridge').ok,false);assert.equal(E.action(a,'sleep').ok,false);assert.equal(JSON.stringify(a),before);
for(const type of ['wood','fiber','forage']){act(a,type);act(b,type);}assert.deepEqual(a,b);assert.equal(a.time,585);
});
test('playable first day: build, cook water, eat, sleep and restore save',()=>{
const s=fresh();act(s,'wood');act(s,'fiber');act(s,'craft','shelter');act(s,'stone');act(s,'wood');act(s,'craft','firepit');act(s,'rest');act(s,'fire');act(s,'consume','water');act(s,'consume','ration');while(s.time<900)act(s,'rest');act(s,'sleep');assert.equal(s.day,2);assert.equal(s.time,420);assert.equal(s.weather,'cloudy');assert.ok(s.health>85);assert.deepEqual(E.validate(JSON.parse(JSON.stringify(s))),s);
});
test('fire expires at every camp; travel does not benefit from destination shelter',()=>{
const s=fresh();s.camps.clearing.fire=300;s.camps.river.fire=200;s.camps.river.structures=['shelter'];s.weather='storm';s.warmth=50;act(s,'travel','river');assert.equal(s.camps.clearing.fire,180);assert.equal(s.camps.river.fire,80);assert.ok(s.wet>0);assert.ok(s.warmth<50);
});
test('craft once, tool durability and dismantle dependent bed',()=>{
const s=fresh();equip(s);act(s,'craft','axe');const n=s.inv.wood;act(s,'wood');assert.ok(s.inv.wood>=n+6);assert.equal(s.tools.axe,23);s.tools.axe=1;act(s,'wood');assert.equal(s.inv.axe,undefined);assert.equal(s.tools.axe,undefined);
s.time=420;s.energy=100;act(s,'craft','shelter');act(s,'craft','bed');assert.equal(E.action(s,'craft','bed').ok,false);act(s,'dismantle','shelter');assert.ok(!s.camps.clearing.structures.includes('bed'));
});
test('water and food processing consume correct batches and fire',()=>{
const s=fresh();s.location='river';s.inv.dirty=4;s.inv.raw=3;s.camps.river.structures=['firepit','rack'];s.camps.river.fire=180;act(s,'boil');assert.equal(s.inv.dirty,1);assert.equal(s.inv.water,6);act(s,'cook');assert.equal(s.inv.cooked,2);assert.equal(s.inv.raw,1);act(s,'dry');assert.equal(s.inv.raw,undefined);assert.equal(s.inv.dried,1);assert.equal(s.camps.river.fire,60);
});
test('weight overflow goes to local cache, storage round-trip and quest protection',()=>{
const s=fresh();s.inv={wood:39};act(s,'wood');assert.ok(E.weight(s)<=24);assert.ok(s.camps.clearing.cache.wood>0);act(s,'stash','wood');const n=s.inv.wood;act(s,'take','wood');assert.equal(s.inv.wood,n+1);s.inv={radio:1};assert.equal(E.action(s,'drop','radio').ok,false);assert.equal(E.action(s,'stash','radio').ok,false);
});
test('night spoilage and rain collection apply to distant camps too',()=>{
const s=fresh();s.time=1080;s.weather='rain';s.inv={raw:8,berries:10};s.camps.river.structures=['collector'];s.camps.river.cache={raw:4};act(s,'sleep');assert.ok(s.inv.raw<8);assert.equal(s.camps.river.cache.water,3);assert.equal(s.camps.river.cache.raw,1);
});
test('events block time actions, persist through save, resolve once, and medicine cures',()=>{
const s=fresh();s.event='tracks';const snapshot=JSON.stringify(s);assert.equal(E.action(s,'wood').ok,false);assert.equal(JSON.stringify(s),snapshot);assert.equal(E.validate(s).event,'tracks');assert.equal(E.resolveEvent(s,1).ok,true);assert.equal(E.resolveEvent(s,1).ok,false);s.wound=2;s.sickness=2;s.health=40;s.inv.medicine=1;act(s,'consume','medicine');assert.equal(s.health,62);assert.equal(s.wound+s.sickness,0);
});
test('time boundary, death terminal state and no accidental win at day 30 dawn',()=>{
const s=fresh();s.time=1305;assert.equal(E.action(s,'wood').ok,false);s.health=1;s.food=0;s.water=0;s.day=30;act(s,'sleep');assert.equal(s.won,false);assert.equal(s.ended,true);const before=JSON.stringify(s);assert.equal(E.action(s,'consume','ration').ok,false);assert.equal(JSON.stringify(s),before);
const win=fresh();win.day=30;win.time=1200;win.camps.clearing.structures=['shelter'];act(win,'sleep');assert.equal(win.won,true);assert.equal(win.day,30);
});
test('rescue requires all parts, correct site, day and weather',()=>{
const s=fresh();s.inv={radio:1,battery:1,wire:1};s.location='ridge';assert.equal(E.action(s,'signal').ok,false);s.day=10;s.weather='storm';assert.equal(E.action(s,'signal').ok,false);s.weather='clear';act(s,'signal');assert.equal(s.won,true);assert.equal(s.ended,true);assert.equal(s.signal,true);
});
test('all three quest locations yield a guaranteed first-search part',()=>{
for(const loc of ['ruins','valley','ridge']){const s=fresh();s.location=loc;act(s,'explore');const quest=D.sites.find(x=>x.id===loc).quest;assert.equal(s.inv[quest],1);s.time=420;s.energy=100;act(s,'explore');assert.equal(s.inv[quest],1);}
});
test('malformed saves are rejected safely',()=>{
for(const mutate of [s=>s.version=1,s=>s.health=-1,s=>s.inv.unknown=1,s=>s.inv.wood=-1,s=>s.weather='__proto__',s=>s.camps.clearing.structures=['fake'],s=>s.event='bad',s=>s.logs[0].text=null,s=>s.inv.wood=500]){const s=fresh();mutate(s);assert.throws(()=>E.validate(s));}
});

test('all authored encounters resolve and round-trip without invalid states',()=>{
for(const event of ['tracks','backpack','rainfront','snake','ravine','herbgrove'])for(const choice of [0,1]){const s=fresh();s.event=event;E.validate(s);assert.equal(E.resolveEvent(s,choice).ok,true);assert.equal(s.event,null);E.validate(s);}
});
test('weather exposure, seasonal cold and fuel duration match the rules',()=>{
const s=fresh();s.camps.clearing.structures=['shelter','firepit'];s.weather='rain';act(s,'fire');assert.equal(s.camps.clearing.fire,240);act(s,'wood');assert.ok(s.wet>0,'outdoor gathering is exposed even at a sheltered camp');
const early=E.temperature(s);s.day=11;assert.equal(E.temperature(s),early-2);s.day=21;assert.equal(E.temperature(s),early-4);
});
