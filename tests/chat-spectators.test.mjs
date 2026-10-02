// Copyright (C) 2026 Many Fish contributors
// SPDX-License-Identifier: GPL-3.0-only

import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { RoomStore } from '../src/server/rooms.mjs';
import { createServer } from '../server.mjs';
const proof = JSON.parse(readFileSync(new URL('../public/release.json', import.meta.url), 'utf8'));

test('观战不占玩家席位，隐藏双方手牌，退出只释放自己的凭据', () => {
  const store = new RoomStore();
  const a = store.create('甲');
  const watch = store.watch(a.code, '观众');
  const b = store.join(a.code, '乙');
  const { g, i } = store.session(watch.token);
  const v = store.snapshot(g, i);
  assert.equal(v.role, 'spectator');
  assert.equal(v.you, null);
  assert.equal(v.spectatorCount, 1);
  for (const p of v.players) assert.equal('hand' in p, false);
  for (const card of g.players.flatMap((p) => p.hand))
    assert.equal(JSON.stringify(v).includes(card.id), false);
  assert.equal(store.snapshot(g, 0).players[0].hand.length, 6);
  store.leave(watch.token, 'finish');
  assert.equal(g.phase, 'rps');
  assert.equal(g.spectators.size, 0);
  assert.equal(store.session(a.token).g, store.session(b.token).g);
  assert.throws(() => store.session(watch.token), { code: 'ROOM_CLOSED' });
});
test('聊天身份来自凭据、长度和频率由服务端限制，记录有上限且不推进对局', () => {
  let now = 0;
  const store = new RoomStore({ now: () => now });
  const a = store.create('甲'),
    watcher = store.watch(a.code, '观众');
  const { g } = store.session(a.token);
  const version = g.version;
  assert.throws(() => store.chat(a.token, '   '));
  assert.throws(() => store.chat(a.token, 'x'.repeat(301)));
  assert.throws(() => store.chat(a.token, { text: 'hello' }));
  const first = store.chat(a.token, ' <img src=x onerror=alert(1)> ');
  assert.equal(first.name, '甲');
  assert.equal(first.role, 'player');
  assert.equal(first.text, '<img src=x onerror=alert(1)>');
  assert.throws(() => store.chat(a.token, 'spam'), { status: 429 });
  assert.equal(store.chat(watcher.token, 'hello').role, 'spectator');
  for (let n = 0; n < 110; n++) {
    now += 1000;
    store.chat(a.token, `message ${n}`);
  }
  assert.equal(g.chat.length, 100);
  assert.equal(g.chat.at(-1).id, 112);
  assert.equal(g.version, version);
  assert.equal(g.round, 0);
  store.leave(a.token, 'abandon');
  assert.throws(() => store.chat(watcher.token, 'after close'), { code: 'ROOM_CLOSED' });
});
test('观战名额有上限，房间关闭释放全部观众和房间号', () => {
  const store = new RoomStore({ codeGenerator: () => 'ABC123' });
  const a = store.create('甲');
  const watchers = Array.from({ length: 50 }, () => store.watch(a.code, '观众'));
  assert.throws(() => store.watch(a.code, '多一个'), /50人/);
  store.leave(watchers[0].token, 'abandon');
  store.watch(a.code, '替补');
  store.leave(a.token, 'abandon');
  assert.equal(store.tokens.size, 0);
  assert.equal(store.rooms.size, 0);
  assert.equal(store.create('下一局').code, 'ABC123');
});
test(
  '三方 HTTP 与 SSE：观众收取聊天、无法操作，玩家关房时观众收到结束并失效',
  { timeout: 10000 },
  async (t) => {
    const server = createServer();
    t.after(() => {
      server.closeAllConnections();
      return new Promise((resolve) => server.close(resolve));
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`;
    const request = async (path, body) => {
      const r = await fetch(base + path, {
        ...(body
          ? {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            }
          : {}),
        signal: AbortSignal.timeout(5000),
      });
      return { status: r.status, data: await r.json() };
    };
    const enter = async (path, body) => {
      const verified = await request('/api/verify', { proof });
      const r = await request(path, { ...body, verification: verified.data.verification });
      assert.equal(r.status, 200);
      return r.data;
    };
    assert.equal((await request('/api/watch', { code: 'none' })).status, 403);
    const a = await enter('/api/create', { name: '甲' });
    const watcher = await enter('/api/watch', { name: '观众', code: a.code });
    const b = await enter('/api/join', { name: '乙', code: a.code });
    const getState = async (player) => (await request('/api/state?token=' + player.token)).data;
    const before = await getState(a);
    assert.equal(
      (
        await request('/api/action', {
          token: watcher.token,
          action: { type: 'rps', choice: 'rock' },
          i: 0,
        })
      ).status,
      403,
    );
    assert.deepEqual(await getState(a), before);
    const v = await getState(watcher);
    assert.equal(v.you, null);
    assert.equal(v.role, 'spectator');
    assert.ok(v.players.every((p) => !('hand' in p)));
    const stream = await fetch(base + '/api/events?token=' + watcher.token, {
      signal: AbortSignal.timeout(5000),
    });
    const text = stream.text();
    const chat = await request('/api/chat', {
      token: watcher.token,
      text: '大家好 <script>bad()</script>',
      name: '假装玩家',
      role: 'player',
    });
    assert.equal(chat.status, 200);
    assert.equal(chat.data.message.name, '观众');
    assert.equal(chat.data.message.role, 'spectator');
    assert.equal((await getState(b)).chat[0].text, '大家好 <script>bad()</script>');
    assert.equal((await request('/api/chat', { token: watcher.token, text: 'spam' })).status, 429);
    await request('/api/leave', { token: a.token, mode: 'abandon' });
    const events = await text;
    assert.match(events, /大家好/);
    assert.match(events, /event: room-closed/);
    assert.match(events, /"winner":1/);
    assert.doesNotMatch(events, /"hand":/);
    assert.equal((await request('/api/state?token=' + watcher.token)).status, 410);
    assert.equal((await request('/api/chat', { token: watcher.token, text: 'late' })).status, 410);
  },
);
