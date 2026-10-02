// Copyright (C) 2026 Tide Card contributors
// SPDX-License-Identifier: GPL-3.0-only

import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createGame, joinGame, CARDS } from '../src/game/engine.mjs';

const unit = (id, type, hp = CARDS[type].hp, extra = {}) => ({ id, type, hp, sleep: 0, ...extra });
function battle() {
  const g = createGame('鲸方');
  joinGame(g, '对手');
  Object.assign(g, { phase: 'battle', turn: 0, ap: 2, round: 1 });
  for (const p of g.players) {
    p.field = [null, null, null, null];
    p.hand = [{ id: `spare${p.name}`, type: 'crab' }];
    p.discard = [];
  }
  g.players[0].field[0] = unit('whale', 'whale');
  return g;
}
const control = (g, src, action) =>
  act(g, 0, {
    type: 'control',
    actorId: 'whale',
    targetId: src,
    action: { ...action, actorId: src },
  });

test('鲸操控普通攻击和落击可打双方其他牌，来源与位置保持原样', () => {
  for (const targetPlayer of [0, 1])
    for (const landing of [false, true]) {
      const g = battle(),
        type = landing ? 'kangaroo' : 'crab';
      g.players[1].field[0] = unit('src', type, 2, landing ? { airborne: true, gravity: 1 } : {});
      g.players[targetPlayer].field[1] = unit('target', 'penguin');
      control(g, 'src', { type: landing ? 'skill' : 'attack', targetId: 'target' });
      assert.equal(g.players[targetPlayer].field[1].hp, landing ? 1 : 2);
      assert.equal(g.players[1].field[0].id, 'src');
      assert.equal(g.ap, 1);
      assert.equal(g.pending, null);
    }
});

test('鲸操控鲨鱼默认打鲸方敌人，追击不攻击鲨鱼自身或鲸方', () => {
  const g = battle();
  g.players[1].field[0] = unit('shark', 'shark');
  g.players[1].field[1] = unit('weak', 'crab', 1);
  g.players[1].field[2] = unit('strong', 'penguin');
  control(g, 'shark', { type: 'skill', row: 0 });
  assert.equal(g.players[1].field[0].hp, 2);
  // The defensive player may choose their penguin before the follow-up resolves.
  assert.equal(g.pending.respondTo, 1);
  act(g, 1, { type: 'intercept', penguinId: null });
  assert.equal(g.players[1].field[1], null);
  assert.equal(g.players[1].field[2].hp, 2);
  assert.equal(g.players[0].field[0].hp, 2);
  assert.equal(g.ap, 1);
});

test('鲸操控鲨鱼仍可明确选择鲸方阵营，追击同一阵营', () => {
  const g = battle();
  g.players[1].field[0] = unit('shark', 'shark');
  g.players[0].field[1] = unit('weak', 'crab', 1);
  g.players[0].field[2] = unit('strong', 'sloth');
  control(g, 'shark', { type: 'skill', row: 0, targetPlayer: 0 });
  assert.equal(g.players[0].field[0].hp, 1);
  assert.equal(g.players[0].field[1], null);
  assert.equal(g.players[0].field[2].hp, 1);
  assert.equal(g.players[1].field[0].hp, 2);
  assert.equal(g.ap, 1);
});

test('鲸操控鲨鱼仍遵守射程、睡眠和不能攻击自己的限制', () => {
  const g = battle();
  g.players[1].field[2] = unit('shark', 'shark');
  const before = structuredClone(g);
  assert.throws(() => control(g, 'shark', { type: 'skill', row: 1, targetPlayer: 0 }), /可攻击/);
  assert.deepEqual(g, before);
  assert.throws(() => control(g, 'shark', { type: 'skill', row: 1, targetPlayer: 1 }), /可攻击/);
  g.players[1].field[0] = unit('sleeping', 'crab', 2, { sleep: 2, sleepUntil: 5 });
  assert.throws(() => control(g, 'shark', { type: 'skill', row: 0, targetPlayer: 1 }), /可攻击/);
});

test('未被操控的鲨鱼不能通过目标阵营参数攻击自己的牌', () => {
  const g = battle();
  g.players[0].field[1] = unit('shark', 'shark');
  assert.throws(
    () => act(g, 0, { type: 'skill', actorId: 'shark', row: 0, targetPlayer: 0 }),
    /阵营/,
  );
  g.players[1].field[0] = unit('borrowed', 'shark');
  assert.throws(() => control(g, 'borrowed', { type: 'skill', row: 0, targetPlayer: 7 }), /阵营/);
});

test('大象上场与海星复活均为2生命；普通受击后免费返回剩1生命', () => {
  assert.equal(CARDS.elephant.hp, 2);
  const g = battle();
  g.players[0].hand.push({ id: 'ele', type: 'elephant' });
  act(g, 0, { type: 'place', cardId: 'ele', slot: 1 });
  assert.equal(g.players[0].field[1].hp, 2);
  g.players[1].field[0] = unit('base', 'crab');
  g.players[1].field[1] = unit('attacker', 'crab');
  act(g, 0, { type: 'skill', actorId: 'ele', targetId: 'base' });
  g.turn = 1;
  act(g, 1, { type: 'attack', actorId: 'attacker', targetId: 'base' });
  assert.equal(g.pending.respondTo, 0);
  const before = structuredClone(g);
  assert.throws(() => act(g, 1, { type: 'return', slot: 1 }), /指定玩家/);
  assert.deepEqual(g, before);
  act(g, 0, { type: 'return', slot: 1 });
  assert.equal(g.players[0].field[1].hp, 1);
  const h = battle();
  h.players[0].hand.push({ id: 'star', type: 'starfish' });
  h.players[1].discard.push(unit('fallen', 'elephant', 0));
  act(h, 0, { type: 'once', cardId: 'star', discardId: 'fallen', slot: 1 });
  assert.equal(h.players[0].field[1].hp, 2);
});
