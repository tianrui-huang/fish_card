// Copyright (C) 2026 Tide Card contributors
// SPDX-License-Identifier: GPL-3.0-only

import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createGame, joinGame, view } from '../src/game/engine.mjs';

const unit = (id, type, hp) => ({ id, type, hp, sleep: 0 });
function battle() {
  const g = createGame('甲');
  joinGame(g, '乙');
  Object.assign(g, { phase: 'battle', turn: 0, ap: 1, round: 1 });
  for (const p of g.players) {
    p.hand = [];
    p.discard = [];
    p.field = [null, null, null, null];
  }
  g.players[0].field = [
    unit('fish', 'sunfish', 3),
    unit('ally', 'penguin', 1),
    unit('other', 'urchin', 1),
    null,
  ];
  g.players[1].field[0] = unit('foe', 'crab', 2);
  return g;
}
const heal = (g, actorId = 'fish', targetId = 'ally') =>
  act(g, 0, { type: 'skill', actorId, targetId });

test('同一翻车鱼本回合只可治疗一次，换目标与额外行动点也不能再用', () => {
  const g = battle();
  heal(g);
  assert.equal(g.players[0].field[0].hp, 2);
  assert.equal(g.players[0].field[1].hp, 2);
  assert.equal(g.ap, 1);
  assert.equal(view(g, 0).players[0].field[0].sunfishSkillRound, g.round);
  for (const target of ['ally', 'other']) {
    const before = structuredClone(g);
    assert.throws(() => heal(g, 'fish', target), /本回合已经发动/);
    assert.deepEqual(g, before);
  }
  g.players[0].field[3] = unit('crab', 'crab', 2);
  act(g, 0, { type: 'skill', actorId: 'crab' });
  assert.equal(g.ap, 2);
  const before = structuredClone(g);
  assert.throws(() => heal(g), /本回合已经发动/);
  assert.deepEqual(g, before);
});
test('不同翻车鱼分别计次，下一次自己的回合恢复机会', () => {
  const g = battle();
  g.players[0].field[3] = unit('second', 'sunfish', 3);
  heal(g);
  heal(g, 'second', 'other');
  assert.equal(g.players[0].field[0].hp, 2);
  assert.equal(g.players[0].field[3].hp, 2);
  act(g, 0, { type: 'pass' });
  act(g, 1, { type: 'pass' });
  assert.equal(g.turn, 0);
  assert.equal(g.round, 3);
  heal(g);
  heal(g, 'second', 'fish');
  assert.equal(g.players[0].field[1].hp, 3);
  assert.equal(g.players[0].field[3].hp, 1);
  assert.equal(g.players[0].field[0].hp, 2);
});
test('无效治疗目标不消耗本回合次数，治疗后仍可普攻', () => {
  const g = battle();
  g.players[0].field[2].hp = 2;
  for (const targetId of ['fish', 'foe', 'other', 'missing']) {
    const before = structuredClone(g);
    assert.throws(() => heal(g, 'fish', targetId), /受伤的其他友方/);
    assert.deepEqual(g, before);
  }
  heal(g);
  act(g, 0, { type: 'attack', actorId: 'fish', targetId: 'foe' });
  assert.equal(g.players[1].field[0].hp, 1);
  assert.equal(g.turn, 1);
});
test('翻车鱼烧掉最后一点生命后复活，同一回合仍不能再次治疗', () => {
  const g = battle();
  g.players[0].field[0].hp = 1;
  g.players[0].hand = [{ id: 'star', type: 'starfish' }];
  heal(g);
  assert.equal(g.players[0].field[0], null);
  assert.equal(g.players[0].discard[0].id, 'fish');
  assert.equal(g.players[0].field[1].hp, 2);
  act(g, 0, { type: 'once', cardId: 'star', discardId: 'fish', slot: 0 });
  assert.equal(g.players[0].field[0].hp, 3);
  const before = structuredClone(g);
  assert.throws(() => heal(g), /本回合已经发动/);
  assert.deepEqual(g, before);
});
