'use strict';
const E=require('../src/engine.js');
const D=require('../src/data.js');
function simulate(seed,difficulty='survivor'){
const s=E.newGame(difficulty,seed);let iterations=0;
function run(k,id){const result=E.action(s,k,id);if(!result.ok)throw Error(`${k}/${id}: ${result.message}`);E.validate(s);}
while(!s.ended&&iterations++<3000){
if(s.event){E.resolveEvent(s,1);continue;}
const c=E.camp(s),count=id=>E.count(s,id), can=(k,id)=>!E.available(s,k,id);
const foods=['cooked','dried','berries','ration'];
if(s.food<68){const food=foods.find(k=>count(k));if(food){run('consume',food);continue;}}
if(s.water<67&&count('water')){run('consume','water');continue;}
if((s.sickness||s.wound||s.health<60)&&count('medicine')){run('consume','medicine');continue;}
if(s.wound&&count('bandage')){run('consume','bandage');continue;}
if(s.time>=1260){if(can('fire')&&c.fire<120)run('fire');else run('sleep');continue;}
if(s.energy<22&&can('rest')){run('rest');continue;}
if(s.location!=='river'){run('travel','river');continue;}
const target=!c.structures.includes('shelter')?'shelter':!c.structures.includes('firepit')?'firepit':!count('spear')?'spear':!count('coat')?'coat':!c.structures.includes('bed')?'bed':null;
if(target){const recipe=D.recipes[target];if(can('craft',target)){run('craft',target);continue;}const missing=Object.keys(recipe.mats).find(id=>count(id)<recipe.mats[id]);if(missing&&can(missing)){run(missing);continue;}}
if((s.sickness||s.health<65)&&count('herb')>=3&&count('fiber')>=1&&can('craft','medicine')){run('craft','medicine');continue;}
if(count('water')<2){if(count('dirty')){if(can('boil')){run('boil');continue;}if(can('fire')){run('fire');continue;}if(can('wood')){run('wood');continue;}}else if(can('water')){run('water');continue;}}
if(foods.reduce((a,k)=>a+count(k),0)<2){if(count('raw')){if(can('cook')){run('cook');continue;}if(can('fire')){run('fire');continue;}if(can('wood')){run('wood');continue;}}else if(can('forage')&&c.stock>2){run('forage');continue;}else if(can('hunt')){run('hunt');continue;}}
if((s.warmth<70||s.time>=900)&&c.fire<150){if(can('fire')){run('fire');continue;}if(can('wood')){run('wood');continue;}}
if(s.time>=900){run('sleep');continue;}
if(can('forage')&&c.stock>0){run('forage');continue;}
run('rest');
}
return {seed,difficulty,won:s.won,day:s.day,health:Math.round(s.health),actions:s.actions,iterations};
}
if(require.main===module){const results=[1,7,42,1234,9182].map(seed=>simulate(seed));console.log(JSON.stringify(results,null,2));if(results.some(r=>!r.won))process.exitCode=1;}
module.exports=simulate;
