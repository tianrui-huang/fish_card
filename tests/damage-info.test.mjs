import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createGame, joinGame, view, CARDS } from '../engine.mjs';

const card=(id,type,hp=CARDS[type].hp,extra={})=>({id,type,hp,sleep:0,...extra});
function battle(){
  const g=createGame('攻击者');joinGame(g,'防守者');
  Object.assign(g,{phase:'battle',turn:0,ap:4,round:1});
  for(let i=0;i<2;i++){g.players[i].field=[null,null,null,null];g.players[i].discard=[];g.players[i].hand=[{id:'spare'+i,type:'crab'}];}
  return g;
}
test('企鹅挡普攻前显示来源与目标，挡后记录实际企鹅和原目标',()=>{
  const g=battle();g.players[0].field[0]=card('src','crab');g.players[1].field[0]=card('target','sloth');g.players[1].field[1]=card('guard','penguin');
  act(g,0,{type:'attack',actorId:'src',targetId:'target'});
  const pending=view(g,1).pending.attack;
  assert.equal(pending.kind,'attack');assert.equal(pending.source.player,0);assert.equal(pending.source.id,'src');assert.equal(pending.target.id,'target');assert.equal(pending.amount,1);
  assert.equal(g.players[1].field[0].hp,2);
  act(g,1,{type:'intercept',penguinId:'guard'});
  const event=view(g,1).damageEvents.at(-1);
  assert.equal(event.intercepted,true);assert.equal(event.target.id,'guard');assert.equal(event.target.slot,1);assert.equal(event.intendedTarget.id,'target');assert.equal(event.kind,'attack');
  assert.match(g.log.join('\n'),/攻击者的螃蟹.*普攻.*防守者的企鹅/);
  assert.match(g.log.join('\n'),/企鹅.*替.*树懒.*挡下.*螃蟹.*普攻/);
  assert.equal(view(g,0).players[1].hand,undefined);
});
test('企鹅挡鲨鱼群攻与追击时保留各自的技能名称',()=>{
  const g=battle();g.players[0].field[0]=card('src','shark');g.players[1].field[0]=card('weak','sloth',1);g.players[1].field[2]=card('strong','sunfish');g.players[1].field[3]=card('guard','penguin');
  act(g,0,{type:'skill',actorId:'src',row:0});
  assert.equal(view(g,1).pending.attack.kind,'sharkSkill');
  act(g,1,{type:'intercept',penguinId:null});
  assert.equal(view(g,1).pending.attack.kind,'sharkFollowup');assert.equal(view(g,1).pending.attack.target.id,'strong');
  act(g,1,{type:'intercept',penguinId:null});
  assert.deepEqual(g.damageEvents.map(e=>e.kind),['sharkSkill','sharkFollowup']);
});
test('袋鼠落击与致命伤后的反击标明技能和被动来源',()=>{
  const g=battle();g.players[0].field[0]=card('src','kangaroo',2,{airborne:true,gravity:1});g.players[1].field[0]=card('target','sloth');
  act(g,0,{type:'skill',actorId:'src',targetId:'target'});
  assert.equal(g.damageEvents[0].kind,'kangarooLanding');assert.equal(g.damageEvents[0].amount,2);
  const h=battle();h.players[0].field[0]=card('src','crab');h.players[1].field[0]=card('roo','kangaroo',1,{airborne:true,gravity:1});
  act(h,0,{type:'attack',actorId:'src',targetId:'roo'});
  assert.equal(h.players[1].field[0],null);assert.equal(h.damageEvents[1].kind,'kangarooCounter');assert.equal(h.damageEvents[1].source.id,'roo');assert.equal(h.damageEvents[1].source.type,'kangaroo');assert.equal(h.damageEvents[1].source.player,1);
});
test('海胆致死反伤和大象压制附加伤害仍保留来源卡',()=>{
  const g=battle();g.players[0].field[0]=card('src','crab');g.players[1].field[0]=card('spike','urchin',1);
  act(g,0,{type:'attack',actorId:'src',targetId:'spike'});
  assert.equal(g.damageEvents[1].kind,'urchinReflect');assert.equal(g.damageEvents[1].source.type,'urchin');
  const h=battle();h.players[0].field[0]=card('ele','elephant',1);h.players[1].field[0]=card('base','crab');h.players[1].field[1]=card('src','crab');
  act(h,0,{type:'skill',actorId:'ele',targetId:'base'});h.turn=1;
  act(h,1,{type:'attack',actorId:'src',targetId:'base'});
  assert.equal(h.damageEvents[0].target.type,'elephant');assert.equal(h.damageEvents[1].kind,'elephantRelease');assert.equal(h.damageEvents[1].source.type,'elephant');assert.equal(h.damageEvents[1].source.player,0);assert.equal(h.damageEvents[1].target.id,'base');
});
test('鲸操控时同时标明实际出手卡持有者和操控者，追击也保留操控者',()=>{
  const g=battle();g.players[0].field[0]=card('whale','whale');g.players[1].field[0]=card('src','shark');g.players[1].field[1]=card('weak','crab',1);g.players[1].field[2]=card('strong','sloth');
  act(g,0,{type:'control',actorId:'whale',targetId:'src',action:{type:'skill',actorId:'src',row:0}});
  for(const event of g.damageEvents){assert.equal(event.source.player,1);assert.equal(event.controller,0);assert.equal(event.target.player,1);}
  assert.equal(g.damageEvents[1].kind,'sharkFollowup');assert.match(g.log.join('\n'),/由攻击者的鲸操控/);
});
test('伤害历史有上限且序号连续增加，不累积无限事件',()=>{
  const g=battle();g.ap=20;g.players[0].field[0]=card('src','crab');g.players[1].field[0]=card('target','sloth');
  for(let i=0;i<20;i++){g.players[1].field[0].hp=2;act(g,0,{type:'attack',actorId:'src',targetId:'target'});}
  assert.equal(g.damageEvents.length,12);assert.equal(g.damageEvents[0].id,9);assert.equal(g.damageEvents.at(-1).id,20);
});
