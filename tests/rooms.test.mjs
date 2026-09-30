import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomStore } from '../room-store.mjs';
import { act, CARDS } from '../engine.mjs';

test('occupied codes are never overwritten, including repeated collisions', () => {
  const store = new RoomStore({ codeGenerator: () => 'AAAAAA' });
  const a = store.create('甲'), b = store.create('乙'), c = store.create('丙');
  assert.equal(a.code, 'AAAAAA');
  assert.equal(new Set([a.code, b.code, c.code]).size, 3);
  assert.equal(store.session(a.token).g.players[0].name, '甲');
});

test('keeping preserves cards, credentials and joining; abandoning releases code', () => {
  const store = new RoomStore({ codeGenerator: () => '123ABC' });
  const a = store.create('甲'), game = store.session(a.token).g;
  const hand = structuredClone(game.players[0].hand);
  store.leave(a.token, 'keep');
  const b = store.join(a.code.toLowerCase(), '乙');
  assert.deepEqual(store.session(a.token).g.players[0].hand, hand);
  assert.equal(store.session(b.token).g, game);
  store.leave(a.token, 'abandon');
  assert.equal(store.rooms.size, 0);
  assert.equal(store.tokens.size, 0);
  const next = store.create('新房间');
  assert.equal(next.code, a.code);
  assert.throws(() => store.session(a.token), { code: 'ROOM_CLOSED' });
  assert.throws(() => store.session(b.token), { code: 'ROOM_CLOSED' });
});

test('abandoning notifies closure and awards the other participant a win', () => {
  const closed = [];
  const store = new RoomStore({ onClose: (g, reason) => closed.push({ g, reason }) });
  const a = store.create('甲'), b = store.join(a.code, '乙');
  store.leave(b.token, 'abandon');
  assert.equal(closed.length, 1);
  assert.equal(closed[0].reason, 'abandoned');
  assert.equal(closed[0].g.phase, 'ended');
  assert.equal(closed[0].g.winner, 0);
  assert.equal(closed[0].g.pending, null);
});

test('invalid leave and premature finish leave the room unchanged', () => {
  const store = new RoomStore(), a = store.create('甲');
  assert.throws(() => store.leave(a.token, 'invalid'));
  assert.throws(() => store.leave(a.token, 'finish'));
  assert.equal(store.session(a.token).g.phase, 'waiting');
  assert.equal(store.rooms.size, 1);
});

test('normal victory then return clears both tokens and preserves the winner', () => {
  const store = new RoomStore();
  const a = store.create('甲'), b = store.join(a.code, '乙');
  const { g } = store.session(a.token);
  act(g, 0, { type: 'rps', choice: 'rock' });
  act(g, 1, { type: 'rps', choice: 'scissors' });
  for (const i of [1, 0]) for (let slot = 0; slot < 3; slot++) {
    const c = g.players[i].hand.find(c => CARDS[c.type].kind !== 'once');
    act(g, i, { type: 'place', cardId: c.id, slot });
  }
  act(g, 0, { type: 'pass' });
  act(g, 1, { type: 'pass' });
  act(g, 0, { type: 'pass' });
  assert.equal(g.phase, 'ended');
  assert.equal(g.winner, 1);
  store.leave(b.token, 'finish');
  assert.equal(g.winner, 1);
  assert.equal(store.rooms.size, 0);
  assert.equal(store.tokens.size, 0);
  assert.throws(() => store.leave(a.token, 'finish'), { code: 'ROOM_CLOSED' });
});

test('closing one room does not affect other rooms', () => {
  const store = new RoomStore(), a = store.create('甲'), b = store.create('乙');
  store.leave(a.token, 'abandon');
  assert.equal(store.session(b.token).g.code, b.code);
  assert.equal(store.rooms.size, 1);
  assert.equal(store.tokens.size, 1);
});
