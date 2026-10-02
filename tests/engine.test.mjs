// Copyright (C) 2026 Many Fish contributors
// SPDX-License-Identifier: GPL-3.0-only

import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createGame, joinGame, view } from '../src/game/engine.mjs';

function battle() {
  const game = createGame('甲');
  joinGame(game, '乙');
  game.phase = 'battle';
  game.turn = 0;
  game.ap = 1;
  game.round = 1;
  for (const player of game.players) {
    player.hand = [];
    player.field = [null, null, null, null];
    player.discard = [];
  }
  return game;
}

test('海星可在只剩对方弃牌时继续回合并复活对方牌', () => {
  const game = battle();
  game.players[0].hand.push({ id: 'star', type: 'starfish' });
  game.players[1].field[0] = { id: 'foe', type: 'crab', hp: 2, sleep: 0 };
  game.players[1].discard.push({ id: 'fallen', type: 'urchin', hp: 0, sleep: 0 });
  game.turn = 1;

  act(game, 1, { type: 'pass' });
  assert.equal(game.phase, 'battle');
  assert.equal(game.turn, 0);
  act(game, 0, { type: 'once', cardId: 'star', discardId: 'fallen', slot: 2 });

  assert.equal(game.players[0].field[2].id, 'fallen');
  assert.equal(game.players[0].field[2].hp, 2);
  assert.equal(game.players[1].discard.length, 0);
  assert.equal(game.players[0].discard[0].type, 'starfish');
  assert.equal(view(game, 0).players[1].discard.length, 0);
});

test('螃蟹可消耗最后一点生命获取行动点并退场', () => {
  const game = battle();
  game.players[0].field[0] = { id: 'crab', type: 'crab', hp: 1, sleep: 0 };
  game.players[0].field[1] = { id: 'ally', type: 'urchin', hp: 2, sleep: 0 };
  game.players[1].field[0] = { id: 'foe', type: 'sloth', hp: 2, sleep: 0 };

  act(game, 0, { type: 'skill', actorId: 'crab' });

  assert.equal(game.phase, 'battle');
  assert.equal(game.ap, 2);
  assert.equal(game.players[0].field[0], null);
  assert.equal(game.players[0].discard[0].id, 'crab');
});

test('翻车鱼可消耗最后一点生命治疗其他牌并退场', () => {
  const game = battle();
  game.players[0].field[0] = { id: 'sunfish', type: 'sunfish', hp: 1, sleep: 0 };
  game.players[0].field[1] = { id: 'ally', type: 'urchin', hp: 1, sleep: 0 };
  game.players[1].field[0] = { id: 'foe', type: 'sloth', hp: 2, sleep: 0 };

  act(game, 0, { type: 'skill', actorId: 'sunfish', targetId: 'ally' });

  assert.equal(game.players[0].field[1].hp, 2);
  assert.equal(game.players[0].field[0], null);
  assert.equal(game.players[0].discard[0].id, 'sunfish');
  assert.equal(game.ap, 1);
});

test('最后一张牌因技能退场时正常判负', () => {
  const game = battle();
  game.players[0].field[0] = { id: 'crab', type: 'crab', hp: 1, sleep: 0 };
  game.players[1].field[0] = { id: 'foe', type: 'sloth', hp: 2, sleep: 0 };

  act(game, 0, { type: 'skill', actorId: 'crab' });

  assert.equal(game.phase, 'ended');
  assert.equal(game.winner, 1);
  assert.equal(game.players[0].discard[0].id, 'crab');
});
