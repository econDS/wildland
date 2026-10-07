'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../src/engine.js');

const fresh=()=>E.newGame('survivor',77);

test('route planning returns a costed path and reroutes around an active hazard',()=>{
  const s=fresh();
  const plan=E.routePlan(s,'ridge');
  assert.equal(plan.reachable,true);
  assert.equal(plan.path[0],'clearing');
  assert.equal(plan.path.at(-1),'ridge');
  assert.ok(plan.minutes>0&&plan.energy>0);
  assert.equal(plan.risk,0);
  s.day=4;s.world.hazards=[{type:'treefall',site:'forest',edge:['forest','ruins'],until:5}];
  const reroute=E.routePlan(s,'ridge');
  assert.equal(reroute.reachable,true);
  assert.ok(!reroute.path.includes('ruins')||reroute.path.includes('rocks'));
});

test('route event chance matches travel encounters and first-day exemption',()=>{
  const s=fresh();
  assert.equal(E.routePlan(s,'river').risk,0);
  s.day=2;
  assert.ok(Math.abs(E.routePlan(s,'river').risk-.3448)<1e-10);
  s.world.eventsSeen.push('riverbank');
  assert.ok(Math.abs(E.routePlan(s,'river').risk-.16)<1e-10);
});

test('river and forest events respect depleted stocks and flooding',()=>{
  const river=fresh();
  river.location='river';river.inv.rod=1;river.tools.rod=10;
  river.camps.river.fishStock=1;river.event='riverbank';
  assert.equal(E.resolveEvent(river,0).ok,true);
  assert.equal(river.inv.raw,1);
  assert.equal(river.camps.river.fishStock,0);
  river.event='riverbank';
  E.resolveEvent(river,0);
  assert.equal(river.inv.raw,1);
  river.day=4;river.camps.river.fishStock=1;
  river.world.hazards=[{type:'flood',site:'river',edge:['river','rocks'],until:4}];
  river.event='riverbank';
  E.resolveEvent(river,0);
  assert.equal(river.inv.raw,1);
  assert.equal(river.camps.river.fishStock,1);

  const forest=fresh();
  forest.location='forest';forest.inv.spear=1;forest.tools.spear=10;
  forest.camps.forest.wildlife=1;forest.event='forest_call';
  assert.equal(E.resolveEvent(forest,0).ok,true);
  assert.equal(forest.inv.raw,1);
  assert.equal(forest.camps.forest.wildlife,0);
  forest.event='forest_call';
  E.resolveEvent(forest,0);
  assert.equal(forest.inv.raw,1);
});

test('regional clues reduce the matching landmark cost and survive validation',()=>{
  for(const [event,site,flag] of [
    ['radio_static','ruins','radio_clue'],
    ['fog_signal','valley','fog_clue']
  ]){
    const s=fresh();
    const before=E.cost(s,'investigate',site);
    s.event=event;
    assert.equal(E.resolveEvent(s,0).ok,true);
    assert.equal(s.milestones[flag],true);
    assert.deepEqual(E.cost(s,'investigate',site),[before[0]-30,before[1]-4]);
    const loaded=E.validate(s);
    assert.deepEqual(E.cost(loaded,'investigate',site),[before[0]-30,before[1]-4]);
    loaded.location=site;
    loaded.world.discovered.push(site);
    const startTime=loaded.time,startEnergy=loaded.energy;
    assert.equal(E.action(loaded,'investigate',site).ok,true);
    assert.equal(loaded.time,startTime+before[0]-30);
    assert.equal(loaded.energy,startEnergy-before[1]+4);
  }
});

test('regional encounters resolve and are included in validated saves',()=>{
  for(const event of ['riverbank','forest_call','cave_echo','radio_static','fog_signal','ridge_beacon','old_camp']){
    const s=fresh();
    s.event=event;
    if(event==='cave_echo')s.inv.torch=1;
    if(event==='riverbank')s.inv.rod=1;
    if(event==='forest_call')s.inv.spear=1;
    E.validate(s);
    assert.equal(E.resolveEvent(s,0).ok,true,event);
    assert.equal(s.event,null,event);
    E.validate(s);
  }
});

test('journey goals wait for their threshold and award once',()=>{
  const s=fresh();
  E.action(s,'rest');
  assert.equal(Boolean(s.milestones.goals.camp_ready),false);
  assert.equal(Boolean(s.milestones.goals.field_scout),false);
  s.camps.clearing.structures=['shelter','firepit'];
  s.visited=['clearing','forest','ruins'];
  E.action(s,'rest');
  assert.equal(s.milestones.goals.camp_ready,true);
  assert.equal(s.milestones.goals.field_scout,true);
  const rewardCount=s.inv.ration||0;
  E.action(s,'rest');
  assert.equal(s.inv.ration||0,rewardCount);
});

test('older version-2 saves migrate new goals and regional event history',()=>{
  const old=fresh();
  delete old.milestones.goals;
  delete old.world.eventsSeen;
  const migrated=E.validate(old);
  assert.deepEqual(migrated.milestones.goals,{});
  assert.deepEqual(migrated.world.eventsSeen,[]);
});
