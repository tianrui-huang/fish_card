// Copyright (C) 2026 Many Fish contributors
// SPDX-License-Identifier: GPL-3.0-only

import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { RUNTIME_FILES, CLIENT_FILES } from '../release-files.mjs';
export { RUNTIME_FILES } from '../release-files.mjs';

export const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const rulesHash = (m) =>
  hash(JSON.stringify([m.files['src/game/cards.mjs'], m.files['src/game/engine.mjs']]));
export const releaseId = (m) =>
  hash(JSON.stringify([m.protocol, m.version, RUNTIME_FILES.map((f) => [f, m.files[f]])]));
const failure = (message, code = 'CLIENT_INCOMPATIBLE', status = 409) =>
  Object.assign(Error(message), { code, status });
export function loadRelease(root) {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(path.join(root, 'release.json'), 'utf8'));
  } catch {
    throw Error('发布校验清单 release.json 缺失或损坏。请完整更新服务端包。');
  }
  const required = [...RUNTIME_FILES, 'public/release.json'];
  if (
    manifest.protocol !== 1 ||
    typeof manifest.version !== 'string' ||
    Object.keys(manifest.files || {})
      .sort()
      .join('|') !== required.sort().join('|') ||
    manifest.releaseId !== releaseId(manifest)
  )
    throw Error('发布校验清单不正确。请完整更新服务端包。');
  const assets = new Map();
  for (const file of [...RUNTIME_FILES, 'public/release.json']) {
    let bytes;
    try {
      bytes = readFileSync(path.join(root, file));
    } catch {
      throw Error(`服务端文件缺失：${file}。请完整更新服务端包。`);
    }
    if (hash(bytes) !== manifest.files[file])
      throw Error(
        `服务端文件校验失败：${file}。请完整更新服务端包；开发修改后需重新生成发布清单。`,
      );
    if (file.startsWith('public/')) assets.set('/' + file.slice(7), bytes);
    if (file === 'LICENSE') assets.set('/LICENSE', bytes);
  }
  const client = JSON.parse(assets.get('/release.json').toString('utf8'));
  if (
    client.releaseId !== manifest.releaseId ||
    client.rulesHash !== rulesHash(manifest) ||
    client.version !== manifest.version ||
    client.protocol !== manifest.protocol ||
    Object.keys(client.files || {})
      .sort()
      .join('|') !== [...CLIENT_FILES].sort().join('|') ||
    Object.entries(client.files).some(([f, h]) => h !== manifest.files['public' + f])
  )
    throw Error('客户端与服务端发布清单不一致，请完整更新服务端包。');
  return { manifest, client, assets };
}
export class ReleaseGate {
  constructor(client, { now = Date.now, ttl = 5 * 60 * 1000, limit = 2048 } = {}) {
    this.client = client;
    this.now = now;
    this.ttl = ttl;
    this.limit = limit;
    this.tickets = new Map();
  }
  verify(proof) {
    const expected = this.client;
    if (
      !proof ||
      proof.protocol !== expected.protocol ||
      proof.version !== expected.version ||
      proof.releaseId !== expected.releaseId ||
      proof.rulesHash !== expected.rulesHash
    )
      throw failure(
        `客户端与服务端版本不一致。服务端版本为 ${expected.version}；请双方更新到同一发布包，或请房主更新服务端。`,
      );
    if (
      Object.keys(proof.files || {})
        .sort()
        .join('|') !== Object.keys(expected.files).sort().join('|') ||
      Object.entries(expected.files).some(([f, h]) => proof.files[f] !== h)
    )
      throw failure(
        '客户端文件校验失败，请重新解压最新版并按 Ctrl+F5 刷新。',
        'CLIENT_INTEGRITY_FAILED',
      );
    for (const [key, expiry] of this.tickets) if (expiry <= this.now()) this.tickets.delete(key);
    if (this.tickets.size >= this.limit)
      throw failure('校验请求繁忙，请稍后重试。', 'VERIFY_BUSY', 429);
    const verification = randomBytes(24).toString('hex');
    this.tickets.set(verification, this.now() + this.ttl);
    return { verification, version: expected.version, releaseId: expected.releaseId };
  }
  require(ticket) {
    const expiry = this.tickets.get(ticket);
    if (!expiry || expiry <= this.now()) {
      this.tickets.delete(ticket);
      throw failure('请先校验客户端版本，再创建、加入或恢复房间。', 'VERIFY_REQUIRED', 403);
    }
  }
  consume(ticket) {
    this.require(ticket);
    this.tickets.delete(ticket);
  }
}
