// Copyright (C) 2026 Tide Card contributors
// SPDX-License-Identifier: GPL-3.0-only

import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from '../server.mjs';
import { readFileSync } from 'node:fs';

const proof = JSON.parse(readFileSync(new URL('../public/release.json', import.meta.url), 'utf8'));

test('HTTP room lifecycle and SSE closure work for two clients', { timeout: 10000 }, async (t) => {
  const server = createServer();
  t.after(() => {
    server.closeAllConnections();
    return new Promise((resolve) => server.close(resolve));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (path, body) => {
    const res = await fetch(base + path, {
      ...(body
        ? {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }
        : {}),
      signal: AbortSignal.timeout(5000),
    });
    return { status: res.status, data: await res.json() };
  };
  const post = async (path, body) => {
    if (path === '/api/create' || path === '/api/join') {
      const verified = await request('/api/verify', { proof });
      assert.equal(verified.status, 200);
      body = { ...body, verification: verified.data.verification };
    }
    const result = await request(path, body);
    assert.equal(result.status, 200, JSON.stringify(result.data));
    return result.data;
  };
  const state = async (player) => (await request('/api/state?token=' + player.token)).data;
  const a = await post('/api/create', { name: '甲' });
  const b = await post('/api/join', { name: '乙', code: a.code });
  await post('/api/leave', { token: a.token, mode: 'keep' });
  assert.equal((await state(a)).phase, 'rps');
  await post('/api/action', { token: a.token, action: { type: 'rps', choice: 'rock' } });
  await post('/api/action', { token: b.token, action: { type: 'rps', choice: 'scissors' } });
  for (const player of [b, a])
    for (let slot = 0; slot < 3; slot++) {
      const g = await state(player);
      const card = g.players[g.you].hand.find((c) => g.cards[c.type].kind !== 'once');
      await post('/api/action', {
        token: player.token,
        action: { type: 'place', cardId: card.id, slot },
      });
    }
  for (const player of [a, b, a])
    await post('/api/action', { token: player.token, action: { type: 'pass' } });
  assert.equal((await state(b)).winner, 1);
  const events = await fetch(base + '/api/events?token=' + a.token, {
    signal: AbortSignal.timeout(5000),
  });
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
  const verified = await request('/api/verify', { proof });
  assert.equal(
    (
      await request('/api/join', {
        name: '丙',
        code: a.code,
        verification: verified.data.verification,
      })
    ).status,
    400,
  );
  const created = await Promise.all(
    Array.from({ length: 20 }, (_, i) => post('/api/create', { name: `并发${i}` })),
  );
  assert.equal(new Set(created.map((r) => r.code)).size, 20);
  for (const room of created) await post('/api/leave', { token: room.token, mode: 'abandon' });
});

test('HTTP requires file verification, rejects incompatible clients and binds rooms to one release', async (t) => {
  const server = createServer();
  t.after(() => {
    server.closeAllConnections();
    return new Promise((resolve) => server.close(resolve));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (url, body) => {
    const r = await fetch(base + url, {
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
  const health = await request('/api/health');
  assert.equal(health.data.integrity, 'verified');
  assert.equal(health.data.releaseId, proof.releaseId);
  const missing = await request('/api/create', { name: '未校验' });
  assert.equal(missing.status, 403);
  assert.equal(missing.data.code, 'VERIFY_REQUIRED');
  for (const key of ['version', 'protocol', 'releaseId', 'rulesHash']) {
    const wrong = await request('/api/verify', { proof: { ...proof, [key]: 'forged' } });
    assert.equal(wrong.status, 409);
    assert.equal(wrong.data.code, 'CLIENT_INCOMPATIBLE');
  }
  for (const files of [
    { ...proof.files, '/js/app.js': '0'.repeat(64) },
    {},
    { ...proof.files, '/extra.js': '0'.repeat(64) },
  ]) {
    const wrong = await request('/api/verify', { proof: { ...proof, files } });
    assert.equal(wrong.status, 409);
    assert.equal(wrong.data.code, 'CLIENT_INTEGRITY_FAILED');
  }
  const ticket = async () => (await request('/api/verify', { proof })).data.verification;
  const verification = await ticket();
  const a = (
    await request('/api/create', {
      name: '甲',
      verification,
      ap: 999,
      cards: { elephant: { hp: 999 } },
    })
  ).data;
  assert.equal(a.releaseId, proof.releaseId);
  assert.equal((await request('/api/create', { name: '复用', verification })).status, 403);
  assert.equal((await request('/api/join', { name: '未校验', code: a.code })).status, 403);
  const badProof = await request('/api/verify', {
    proof: { ...proof, releaseId: 'another-release' },
  });
  assert.equal(badProof.status, 409);
  assert.equal((await request('/api/state?token=' + a.token)).data.phase, 'waiting');
  const b = (await request('/api/join', { name: '乙', code: a.code, verification: await ticket() }))
    .data;
  assert.equal(b.releaseId, a.releaseId);
  assert.equal((await request('/api/resume', { token: a.token })).status, 403);
  assert.equal(
    (await request('/api/resume', { token: a.token, verification: await ticket() })).status,
    200,
  );
  const initial = (await request('/api/state?token=' + a.token)).data;
  assert.equal(initial.cards.elephant.hp, 2);
  const fakeAction = await request('/api/action', {
    token: a.token,
    action: { type: 'setState', ap: 999, hp: 999, turn: 0 },
  });
  assert.equal(fakeAction.status, 400);
  assert.deepEqual((await request('/api/state?token=' + a.token)).data, initial);
  for (const url of ['/api/state?token=forged', '/api/events?token=forged'])
    assert.equal((await request(url)).status, 410);
  const manifest = await request('/release.json');
  assert.deepEqual(manifest.data, proof);
  assert.equal((await request('/release-integrity.mjs')).status, 404);
  await request('/api/leave', { token: a.token, mode: 'abandon' });
});
