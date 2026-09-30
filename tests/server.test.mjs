import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from '../server.mjs';

test('HTTP room lifecycle and SSE closure work for two clients', { timeout: 10000 }, async t => {
  const server = createServer();
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (path, body) => {
    const res = await fetch(base + path, { ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(5000) });
    return { status: res.status, data: await res.json() };
  };
  const post = async (path, body) => {
    const result = await request(path, body);
    assert.equal(result.status, 200, JSON.stringify(result.data));
    return result.data;
  };
  const state = async player => (await request('/api/state?token=' + player.token)).data;
  const a = await post('/api/create', { name: '甲' });
  const b = await post('/api/join', { name: '乙', code: a.code });
  await post('/api/leave', { token: a.token, mode: 'keep' });
  assert.equal((await state(a)).phase, 'rps');
  await post('/api/action', { token: a.token, action: { type: 'rps', choice: 'rock' } });
  await post('/api/action', { token: b.token, action: { type: 'rps', choice: 'scissors' } });
  for (const player of [b, a]) for (let slot = 0; slot < 3; slot++) {
    const g = await state(player);
    const card = g.players[g.you].hand.find(c => g.cards[c.type].kind !== 'once');
    await post('/api/action', { token: player.token, action: { type: 'place', cardId: card.id, slot } });
  }
  for (const player of [a, b, a]) await post('/api/action', { token: player.token, action: { type: 'pass' } });
  assert.equal((await state(b)).winner, 1);
  const events = await fetch(base + '/api/events?token=' + a.token, { signal: AbortSignal.timeout(5000) });
  const eventText = events.text();
  await post('/api/leave', { token: b.token, mode: 'finish' });
  const text = await eventText;
  assert.match(text, /event: room-closed/);
  assert.match(text, /"reason":"finished"/);
  assert.match(text, /"winner":1/);
  for (const player of [a, b]) {
    const result = await request('/api/state?token=' + player.token);
    assert.equal(result.status, 410);
    assert.equal(result.data.code, 'ROOM_CLOSED');
  }
  assert.equal((await request('/api/join', { name: '丙', code: a.code })).status, 400);
  const created = await Promise.all(Array.from({ length: 20 }, (_, i) => post('/api/create', { name: `并发${i}` })));
  assert.equal(new Set(created.map(r => r.code)).size, 20);
  for (const room of created) await post('/api/leave', { token: room.token, mode: 'abandon' });
});
