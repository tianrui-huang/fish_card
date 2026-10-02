// Copyright (C) 2026 Many Fish contributors
// SPDX-License-Identifier: GPL-3.0-only

import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createGame, joinGame } from '../src/game/engine.mjs';
function battle() {
  const g = createGame('甲');
  joinGame(g, '乙');
  Object.assign(g, { phase: 'battle', turn: 0, ap: 1, round: 1 });
  for (const p of g.players)
    Object.assign(p, { hand: [], discard: [], field: [null, null, null, null] });
  g.players[0].field[0] = { id: 'crab', type: 'crab', hp: 2 };
  g.players[0].field[1] = { id: 'ally', type: 'penguin', hp: 3 };
  g.players[1].field[0] = { id: 'foe', type: 'penguin', hp: 3 };
  return g;
}
const skill = (g, id = 'crab') => act(g, 0, { type: 'skill', actorId: id });
test('每张螃蟹本回合只能换取一次行动点，拒绝请求不扣血或改状态', () => {
  const g = battle();
  skill(g);
  assert.equal(g.ap, 2);
  assert.equal(g.players[0].field[0].hp, 1);
  const before = structuredClone(g);
  assert.throws(() => skill(g), /本回合已经发动/);
  assert.deepEqual(g, before);
  act(g, 0, { type: 'attack', actorId: 'crab', targetId: 'foe' });
  assert.equal(g.ap, 1);
  assert.throws(() => skill(g), /本回合已经发动/);
});
test('不同螃蟹分别计次，下回合可以再用并烧掉最后一点生命', () => {
  const g = battle();
  g.players[0].field[2] = { id: 'second', type: 'crab', hp: 2 };
  skill(g);
  skill(g, 'second');
  assert.equal(g.ap, 3);
  act(g, 0, { type: 'pass' });
  act(g, 1, { type: 'pass' });
  skill(g);
  skill(g, 'second');
  assert.equal(g.ap, 3);
  assert.equal(g.players[0].field[0], null);
  assert.equal(g.players[0].field[2], null);
});
test('同回合复活螃蟹不刷新使用次数，无效行动不占次数', () => {
  const g = battle();
  const before = structuredClone(g);
  assert.throws(() => skill(g, 'missing'));
  assert.deepEqual(g, before);
  g.players[0].field[0].hp = 1;
  g.players[0].hand = [{ id: 'star', type: 'starfish' }];
  skill(g);
  act(g, 0, { type: 'once', cardId: 'star', discardId: 'crab', slot: 0 });
  assert.equal(g.players[0].field[0].hp, 2);
  const revived = structuredClone(g);
  assert.throws(() => skill(g), /本回合已经发动/);
  assert.deepEqual(g, revived);
});
