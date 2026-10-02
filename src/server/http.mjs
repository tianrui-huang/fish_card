// Copyright (C) 2026 Tide Card contributors
// SPDX-License-Identifier: GPL-3.0-only

import http from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { act, view } from '../game/engine.mjs';
import { RoomStore } from './rooms.mjs';
import { loadRelease, ReleaseGate } from './release.mjs';

import { readFile } from 'node:fs/promises';
import { createRoomEvents } from './events.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '': 'text/plain; charset=utf-8',
};
const send = (res, status, data) => {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(data));
};
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '600');
}
const readBody = async (req) => {
  let text = '';
  for await (const chunk of req) {
    text += chunk;
    if (text.length > 20000) throw Error('请求内容太长。');
  }
  return JSON.parse(text || '{}');
};
export function createServer() {
  // Validate the shipped baseline once; serve those verified bytes for this process's lifetime.
  const release = loadRelease(root),
    gate = new ReleaseGate(release.client);
  const { broadcast, addStream, closeRoom } = createRoomEvents();
  const store = new RoomStore({ onClose: closeRoom });
  const session = (token) => {
    const result = store.session(token);
    if (
      store.tokens.get(token).releaseId !== release.client.releaseId ||
      result.g.releaseId !== release.client.releaseId
    )
      throw Object.assign(Error('房间发布版本不一致，请重新创建房间。'), {
        status: 409,
        code: 'CLIENT_INCOMPATIBLE',
      });
    return result;
  };
  function bind(result, verification) {
    gate.consume(verification);
    const s = store.tokens.get(result.token);
    s.releaseId = release.client.releaseId;
    store.rooms.get(s.code).releaseId = release.client.releaseId;
    return { ...result, version: release.client.version, releaseId: release.client.releaseId };
  }
  const server = http.createServer(async (req, res) => {
    try {
      cors(res);
      const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }
      if (u.pathname === '/api/health' && req.method === 'GET') {
        send(res, 200, {
          ok: true,
          service: 'tide-card-game',
          version: release.client.version,
          releaseId: release.client.releaseId,
          integrity: 'verified',
        });
        return;
      }
      if (u.pathname === '/api/verify' && req.method === 'POST') {
        const b = await readBody(req);
        send(res, 200, gate.verify(b.proof));
        return;
      }
      if (req.method === 'POST' && u.pathname === '/api/create') {
        const b = await readBody(req);
        gate.require(b.verification);
        send(res, 200, bind(store.create(b.name), b.verification));
        return;
      }
      if (req.method === 'POST' && u.pathname === '/api/join') {
        const b = await readBody(req);
        gate.require(b.verification);
        const result = bind(store.join(b.code, b.name), b.verification);
        send(res, 200, result);
        broadcast(session(result.token).g);
        return;
      }
      if (req.method === 'POST' && u.pathname === '/api/resume') {
        const b = await readBody(req);
        gate.require(b.verification);
        const { g } = session(b.token);
        gate.consume(b.verification);
        send(res, 200, {
          ok: true,
          code: g.code,
          version: release.client.version,
          releaseId: release.client.releaseId,
        });
        return;
      }
      if (req.method === 'POST' && u.pathname === '/api/leave') {
        const b = await readBody(req);
        session(b.token);
        send(res, 200, store.leave(b.token, b.mode));
        return;
      }
      if (u.pathname === '/api/state' && req.method === 'GET') {
        const { g, i } = session(u.searchParams.get('token'));
        send(res, 200, view(g, i));
        return;
      }
      if (u.pathname === '/api/events' && req.method === 'GET') {
        const { g, i } = session(u.searchParams.get('token'));
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        });
        addStream(g, i, res);
        return;
      }
      if (u.pathname === '/api/action' && req.method === 'POST') {
        const b = await readBody(req);
        const { g, i } = session(b.token);
        act(g, i, b.action);
        broadcast(g);
        send(res, 200, { ok: true });
        return;
      }
      if (req.method !== 'GET') {
        send(res, 405, { error: '方法不支持。' });
        return;
      }
      if (u.pathname === '/source.zip') {
        let data;
        try {
          data = await readFile(path.join(root, 'dist', 'fish-source.zip'));
        } catch (e) {
          if (e.code !== 'ENOENT') throw e;
          send(res, 404, { error: '当前开发副本尚未生成源码包，请运行发布打包脚本。' });
          return;
        }
        res.writeHead(200, {
          'Content-Type': 'application/zip',
          'Content-Disposition': 'attachment; filename=fish-source.zip',
          'Cache-Control': 'no-store',
        });
        res.end(data);
        return;
      }
      let rel = decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname);
      const data = release.assets.get(rel);
      if (!data) {
        send(res, 404, { error: '找不到页面。' });
        return;
      }
      res.writeHead(200, {
        'Content-Type': mime[path.extname(rel)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(data);
    } catch (e) {
      send(res, e.status || 400, {
        error: e.message || '请求失败。',
        ...(e.code ? { code: e.code } : {}),
      });
    }
  });
  return server;
}
