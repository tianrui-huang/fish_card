// Copyright (C) 2026 Many Fish contributors
// SPDX-License-Identifier: GPL-3.0-only

import { randomBytes } from 'node:crypto';
import { createGame, joinGame, view } from '../game/engine.mjs';

export class RoomStore {
  constructor({
    codeGenerator = () => randomBytes(3).toString('hex').toUpperCase(),
    onClose = () => {},
    onViewerLeave = () => {},
    now = () => Date.now(),
    chatCooldown = 1000,
  } = {}) {
    this.rooms = new Map();
    this.tokens = new Map();
    this.codeGenerator = codeGenerator;
    this.onClose = onClose;
    this.onViewerLeave = onViewerLeave;
    this.now = now;
    this.chatCooldown = chatCooldown;
  }

  allocateCode() {
    for (let attempt = 0; attempt < 64; attempt++) {
      const code = this.codeGenerator();
      if (/^[0-9A-F]{6}$/.test(code) && !this.rooms.has(code)) return code;
    }
    // Even repeated random collisions cannot overwrite an occupied room.
    for (let value = 0; value < 0x1000000; value++) {
      const code = value.toString(16).toUpperCase().padStart(6, '0');
      if (!this.rooms.has(code)) return code;
    }
    throw Error('房间号已用完，请稍后再试。');
  }

  addToken(g, i) {
    let token;
    do {
      token = randomBytes(24).toString('hex');
    } while (this.tokens.has(token));
    this.tokens.set(token, { code: g.code, i, role: Number.isInteger(i) ? 'player' : 'spectator' });
    return { token, code: g.code };
  }

  create(name) {
    const g = createGame(name);
    g.code = this.allocateCode();
    this.rooms.set(g.code, g);
    return this.addToken(g, 0);
  }

  join(code, name) {
    const g = this.rooms.get(
      String(code || '')
        .trim()
        .toUpperCase(),
    );
    if (!g) throw Error('找不到房间。');
    joinGame(g, name);
    return this.addToken(g, 1);
  }

  watch(code, name) {
    const g = this.rooms.get(
      String(code || '')
        .trim()
        .toUpperCase(),
    );
    if (!g) throw Error('找不到房间。');
    g.spectators ||= new Map();
    if (g.spectators.size >= 50) throw Error('观战人数已达50人，请稍后再试。');
    const id = `spectator:${randomBytes(12).toString('hex')}`;
    g.spectators.set(id, String(name || '观众').slice(0, 16));
    return this.addToken(g, id);
  }

  snapshot(g, i) {
    return {
      ...view(g, i),
      viewerName: Number.isInteger(i) ? g.players[i]?.name : g.spectators?.get(i),
      spectatorCount: g.spectators?.size || 0,
      chat: g.chat || [],
    };
  }

  chat(token, text) {
    const { g, i } = this.session(token);
    if (typeof text !== 'string') throw Error('请输入聊天内容。');
    text = text.trim();
    if (!text || text.length > 300) throw Error('聊天内容需为1到300个字符。');
    const member = this.tokens.get(token);
    const now = this.now();
    if (member.lastChatAt !== undefined && now - member.lastChatAt < this.chatCooldown)
      throw Object.assign(Error('发言太快，请稍后再试。'), { status: 429 });
    const message = {
      id: (g.chatSeq || 0) + 1,
      name: Number.isInteger(i) ? g.players[i].name : g.spectators.get(i),
      role: member.role,
      player: Number.isInteger(i) ? i : null,
      text,
      at: now,
    };
    member.lastChatAt = now;
    g.chatSeq = message.id;
    g.chat ||= [];
    g.chat.push(message);
    if (g.chat.length > 100) g.chat.shift();
    return message;
  }

  session(token) {
    const s = this.tokens.get(token);
    const g = s && this.rooms.get(s.code);
    if (!g)
      throw Object.assign(Error('房间已关闭或服务已重启。'), { status: 410, code: 'ROOM_CLOSED' });
    return { g, i: s.i };
  }

  leave(token, mode) {
    const { g, i } = this.session(token);
    if (!['keep', 'abandon', 'finish'].includes(mode)) throw Error('请选择保留或放弃房间。');
    if (mode === 'keep') return { ok: true, kept: true, code: g.code };
    if (!Number.isInteger(i)) {
      g.spectators.delete(i);
      this.tokens.delete(token);
      this.onViewerLeave(g, i);
      return { ok: true, left: true, code: g.code };
    }
    if (mode === 'finish' && g.phase !== 'ended') throw Error('对局尚未结束。');
    if (g.phase !== 'ended' && g.players.length === 2) {
      g.phase = 'ended';
      g.winner = 1 - i;
      g.ap = 0;
      g.pending = null;
      g.log.push(`${g.players[i].name}放弃房间，${g.players[1 - i].name}获胜。`);
      g.version++;
    }
    this.rooms.delete(g.code);
    for (const [key, s] of this.tokens) if (s.code === g.code) this.tokens.delete(key);
    this.onClose(g, mode === 'finish' ? 'finished' : 'abandoned');
    return { ok: true, closed: true, code: g.code };
  }
}
