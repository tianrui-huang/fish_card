// Copyright (C) 2026 Many Fish contributors
// SPDX-License-Identifier: GPL-3.0-only

import { view } from '../game/engine.mjs';

export function createRoomEvents({ snapshot = view } = {}) {
  const streams = new Map();
  function broadcast(g) {
    for (const [key, { i, clients }] of streams)
      if (key.startsWith(`${g.code}:`))
        for (const res of clients) res.write(`data: ${JSON.stringify(snapshot(g, i))}\n\n`);
  }
  function addStream(g, i, res) {
    const key = `${g.code}:${i}`;
    if (!streams.has(key)) streams.set(key, { i, clients: new Set() });
    const { clients } = streams.get(key);
    clients.add(res);
    res.write(`data: ${JSON.stringify(snapshot(g, i))}\n\n`);
    const timer = setInterval(() => res.write(': ping\n\n'), 20000);
    res.on('close', () => {
      clearInterval(timer);
      clients.delete(res);
      if (!clients.size && streams.get(key)?.clients === clients) streams.delete(key);
    });
  }
  function closeViewer(g, i, reason = 'watch-left') {
    const key = `${g.code}:${i}`;
    const entry = streams.get(key);
    streams.delete(key);
    for (const res of entry?.clients || []) {
      res.write(
        `event: room-closed\ndata: ${JSON.stringify({ reason, state: g.phase === 'ended' ? snapshot(g, i) : null })}\n\n`,
      );
      res.end();
    }
  }
  function closeRoom(g, reason) {
    for (const [key, { i }] of [...streams])
      if (key.startsWith(`${g.code}:`)) closeViewer(g, i, reason);
  }
  return { broadcast, addStream, closeRoom, closeViewer };
}
