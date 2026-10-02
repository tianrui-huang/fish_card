// Copyright (C) 2026 Tide Card contributors
// SPDX-License-Identifier: GPL-3.0-only

import { view } from '../game/engine.mjs';

export function createRoomEvents() {
  const streams = new Map();
  function broadcast(g) {
    for (let i = 0; i < 2; i++)
      for (const res of streams.get(`${g.code}:${i}`) || [])
        res.write(`data: ${JSON.stringify(view(g, i))}\n\n`);
  }
  function addStream(g, i, res) {
    const key = `${g.code}:${i}`;
    if (!streams.has(key)) streams.set(key, new Set());
    const clients = streams.get(key);
    clients.add(res);
    res.write(`data: ${JSON.stringify(view(g, i))}\n\n`);
    const timer = setInterval(() => res.write(': ping\n\n'), 20000);
    res.on('close', () => {
      clearInterval(timer);
      clients.delete(res);
      if (!clients.size && streams.get(key) === clients) streams.delete(key);
    });
  }
  function closeRoom(g, reason) {
    for (let i = 0; i < g.players.length; i++) {
      const key = `${g.code}:${i}`,
        clients = streams.get(key);
      streams.delete(key);
      for (const res of clients || []) {
        res.write(
          `event: room-closed\ndata: ${JSON.stringify({ reason, state: g.phase === 'ended' ? view(g, i) : null })}\n\n`,
        );
        res.end();
      }
    }
  }
  return { broadcast, addStream, closeRoom };
}
