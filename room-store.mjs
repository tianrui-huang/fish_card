import { randomBytes } from 'node:crypto';
import { createGame, joinGame } from './engine.mjs';

export class RoomStore {
  constructor({ codeGenerator = () => randomBytes(3).toString('hex').toUpperCase(), onClose = () => {} } = {}) {
    this.rooms = new Map();
    this.tokens = new Map();
    this.codeGenerator = codeGenerator;
    this.onClose = onClose;
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
    do { token = randomBytes(24).toString('hex'); } while (this.tokens.has(token));
    this.tokens.set(token, { code: g.code, i });
    return { token, code: g.code };
  }

  create(name) {
    const g = createGame(name);
    g.code = this.allocateCode();
    this.rooms.set(g.code, g);
    return this.addToken(g, 0);
  }

  join(code, name) {
    const g = this.rooms.get(String(code || '').trim().toUpperCase());
    if (!g) throw Error('找不到房间。');
    joinGame(g, name);
    return this.addToken(g, 1);
  }

  session(token) {
    const s = this.tokens.get(token);
    const g = s && this.rooms.get(s.code);
    if (!g) throw Object.assign(Error('房间已关闭或服务已重启。'), { status: 410, code: 'ROOM_CLOSED' });
    return { g, i: s.i };
  }

  leave(token, mode) {
    const { g, i } = this.session(token);
    if (!['keep', 'abandon', 'finish'].includes(mode)) throw Error('请选择保留或放弃房间。');
    if (mode === 'keep') return { ok: true, kept: true, code: g.code };
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
