// Copyright (C) 2026 Many Fish contributors
// SPDX-License-Identifier: GPL-3.0-only

import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from '../server.mjs';
import { createClientUpdater, isLocalUpdateRequest } from '../src/server/client-update.mjs';
import {
  compareVersions,
  inspectOfficialVersion,
  selectUpdateAsset,
  RELEASE_API,
  WINDOWS_ASSET,
  releasePage,
} from '../public/js/update.mjs';
import { OFFICIAL_SERVER } from '../public/js/config.mjs';

const current = '0.1.0-demo.4',
  next = '0.1.0-demo.5';
const bytes = Buffer.from('PK\x03\x04official test archive');
const digest = createHash('sha256').update(bytes).digest('hex');
const downloadURL = `https://github.com/tianrui-huang/fish_card/releases/download/v${next}/${WINDOWS_ASSET}`;
const release = {
  tag_name: `v${next}`,
  draft: false,
  assets: [
    {
      name: WINDOWS_ASSET,
      state: 'uploaded',
      size: bytes.length,
      digest: 'sha256:' + digest,
      browser_download_url: downloadURL,
    },
  ],
};
const health = (version) =>
  new Response(JSON.stringify({ service: 'many-fish-game', integrity: 'verified', version }));
const metadata = () => new Response(JSON.stringify(release));
async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'many-fish-update-'));
  t.after(async () => {
    assert.equal(path.dirname(root), path.resolve(tmpdir()));
    assert.match(path.basename(root), /^many-fish-update-/);
    await rm(root, { recursive: true, force: true });
  });
  return root;
}
async function complete(updater) {
  const until = Date.now() + 5000;
  while (Date.now() < until) {
    const state = updater.status();
    if (['ready', 'error'].includes(state?.state)) return state;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw Error('Test download did not finish.');
}
const fetcher =
  (asset = () => new Response(bytes), official = next) =>
  async (url) => {
    if (url === OFFICIAL_SERVER + '/api/health') return health(official);
    if (url === RELEASE_API + `v${next}`) return metadata();
    if (url === downloadURL) return asset();
    throw Error('Unexpected destination: ' + url);
  };

test('版本排序识别 demo.10、正式版和未来版本，不把旧服务器当作更新', async () => {
  for (const [a, b, result] of [
    ['0.1.0-demo.10', '0.1.0-demo.9', 1],
    ['0.1.0', '0.1.0-demo.99', 1],
    ['1.0.0', '0.99.0', 1],
    [current, current, 0],
    ['0.1.0-alpha', '0.1.0-demo.4', -1],
    ['0.1.0-1', '0.1.0-alpha', -1],
    ['0.1.0-demo', '0.1.0-demo.1', -1],
  ])
    assert.equal(compareVersions(a, b), result);
  for (const invalid of [
    'old',
    '0.01.0',
    '0.1.0-demo.01',
    '../escape',
    '0.1.0?bad',
    '999999999999999999999.0.0',
    null,
  ])
    assert.throws(() => compareVersions(invalid, current), /格式异常/);
  assert.equal(await inspectOfficialVersion(current, OFFICIAL_SERVER, fetcher()), next);
  assert.equal(
    await inspectOfficialVersion(current, OFFICIAL_SERVER, fetcher(undefined, current)),
    null,
  );
  assert.equal(
    await inspectOfficialVersion(current, OFFICIAL_SERVER, fetcher(undefined, '0.1.0-demo.3')),
    null,
  );
  await assert.rejects(
    inspectOfficialVersion(current, OFFICIAL_SERVER, async () => new Response('{}')),
    /信息异常/,
  );
});

test('更新源限定官方仓库的对应发布，要求已上传文件、大小与 SHA-256', () => {
  assert.equal(selectUpdateAsset(release, next).sha256, digest);
  assert.equal(
    releasePage(next),
    'https://github.com/tianrui-huang/fish_card/releases/tag/v' + next,
  );
  for (const changed of [
    { draft: true },
    { tag_name: 'v0.1.0-demo.99' },
    { assets: [] },
    ...[
      { digest: null },
      { size: 0 },
      { size: 101 * 1048576 },
      { state: 'new' },
      { browser_download_url: downloadURL + '?redirect=evil' },
      { browser_download_url: 'https://evil.example/game.zip' },
    ].map((change) => ({ assets: [{ ...release.assets[0], ...change }] })),
  ])
    assert.throws(() => selectUpdateAsset({ ...release, ...changed }, next), /未就绪/);
});

test('自动下载后台进度、去重、完整校验、缓存复用，不改运行源码', async (t) => {
  const root = await fixture(t);
  await writeFile(path.join(root, 'server.mjs'), 'original source');
  let networkDownloads = 0;
  const get = fetcher(() => {
    networkDownloads++;
    return new Response(bytes);
  });
  const updater = createClientUpdater({ root, version: current, fetcher: get, platform: 'linux' });
  const first = updater.start(next);
  assert.equal(first.state, 'checking');
  assert.equal(updater.start(next).id, first.id);
  const state = await complete(updater);
  assert.equal(state.state, 'ready');
  assert.equal(state.received, bytes.length);
  assert.equal(state.sha256, digest);
  assert.deepEqual(await readFile(updater.file(first.id).path), bytes);
  assert.equal(updater.file('wrong-id'), null);
  const retry = updater.start(next);
  assert.notEqual(retry.id, first.id);
  assert.equal((await complete(updater)).state, 'ready');
  assert.equal(await readFile(path.join(root, 'server.mjs'), 'utf8'), 'original source');
  const again = createClientUpdater({ root, version: current, fetcher: get, platform: 'linux' });
  again.start(next);
  assert.equal((await complete(again)).state, 'ready');
  assert.equal(networkDownloads, 1);
});

test('校验失败、截断、超长与异常跳转清理临时包，不覆盖已存在文件', async (t) => {
  const root = await fixture(t);
  for (const response of [
    () => new Response(Buffer.alloc(bytes.length)),
    () => new Response(bytes.subarray(0, 2)),
    () => new Response(Buffer.concat([bytes, bytes])),
    () =>
      new Response(null, {
        status: 302,
        headers: { location: 'https://evil.example/archive.zip' },
      }),
  ]) {
    const updater = createClientUpdater({
      root,
      version: current,
      fetcher: fetcher(response),
      platform: 'linux',
    });
    updater.start(next);
    const state = await complete(updater);
    assert.equal(state.state, 'error');
    assert.equal(updater.file(state.id), null);
    assert.deepEqual(await readdir(path.join(root, 'dist/updates')), []);
  }
  const existing = path.join(root, 'dist/updates', `many-fish-windows-v${next}.zip`);
  await writeFile(existing, 'existing archive');
  const failed = createClientUpdater({
    root,
    version: current,
    fetcher: fetcher(() => new Response(Buffer.alloc(bytes.length))),
    platform: 'linux',
  });
  failed.start(next);
  assert.equal((await complete(failed)).state, 'error');
  assert.equal(await readFile(existing, 'utf8'), 'existing archive');
  assert.deepEqual(await readdir(path.dirname(existing)), [`many-fish-windows-v${next}.zip`]);
});

test('服务器版本变化或网络失败不下载；失败后能重试', async (t) => {
  const root = await fixture(t);
  let fail = true,
    requests = 0;
  const good = fetcher();
  const updater = createClientUpdater({
    root,
    version: current,
    platform: 'linux',
    fetcher: async (...args) => {
      requests++;
      if (fail) throw Error('网络离线');
      return good(...args);
    },
  });
  updater.start(next);
  assert.match((await complete(updater)).error, /网络离线/);
  fail = false;
  updater.start(next);
  assert.equal((await complete(updater)).state, 'ready');
  assert.equal(requests, 4);
  const changed = createClientUpdater({
    root,
    version: current,
    fetcher: fetcher(undefined, current),
    platform: 'linux',
  });
  changed.start(next);
  assert.match((await complete(changed)).error, /版本已变化/);
});

test('GitHub 资源跳转可正常下载，Windows 更新包保留 Internet 来源', async (t) => {
  const root = await fixture(t);
  const redirected =
    'https://release-assets.githubusercontent.com/github-production-release-asset/test.zip';
  const normal = fetcher();
  const updater = createClientUpdater({
    root,
    version: current,
    platform: process.platform,
    fetcher: async (url, options) => {
      if (url === downloadURL) {
        assert.equal(options.redirect, 'manual');
        return new Response(null, { status: 302, headers: { location: redirected } });
      }
      if (url === redirected) {
        assert.equal(options.redirect, 'manual');
        return new Response(bytes);
      }
      return normal(url, options);
    },
  });
  updater.start(next);
  const state = await complete(updater);
  assert.equal(state.state, 'ready');
  if (process.platform === 'win32')
    assert.match(
      await readFile(updater.file(state.id).path + ':Zone.Identifier', 'utf8'),
      /ZoneId=3/,
    );
});

test('更新接口只允许本机和同源页面，不能通过 LAN、Nginx 或跨站触发', () => {
  const request = (address, host, origin, method = 'POST') => ({
    socket: { remoteAddress: address },
    headers: { host, origin },
    method,
  });
  assert.equal(
    isLocalUpdateRequest(request('127.0.0.1', 'localhost:8080', 'http://localhost:8080')),
    true,
  );
  assert.equal(
    isLocalUpdateRequest(request('::ffff:127.0.0.1', '127.0.0.1:8080', undefined, 'GET')),
    true,
  );
  for (const req of [
    request('192.168.1.2', 'localhost:8080', 'http://localhost:8080'),
    request('127.0.0.1', 'game.example', 'http://game.example'),
    request('127.0.0.1', 'localhost:8080', 'https://evil.example'),
    request('127.0.0.1', 'localhost:8080', undefined),
  ])
    assert.equal(isLocalUpdateRequest(req), false);
});

test('HTTP 下载接口可读取状态和完整文件，错误凭据或来源被拒绝', async (t) => {
  const root = await fixture(t);
  const archive = path.join(root, 'game.zip');
  await writeFile(archive, bytes);
  const updater = {
    start: () => ({ state: 'checking', id: 'token' }),
    status: () => ({ state: 'ready', id: 'token' }),
    file: (id) =>
      id === 'token' ? { path: archive, name: 'many-fish-windows-v0.1.0-demo.5.zip' } : null,
  };
  const server = createServer({ updater });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => {
    server.closeAllConnections();
    return new Promise((resolve) => server.close(resolve));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const start = (headers) =>
    fetch(base + '/api/client-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ version: next, url: 'https://evil.example' }),
    });
  assert.equal((await start({ Origin: 'https://evil.example' })).status, 403);
  assert.equal((await start({})).status, 403);
  assert.equal((await start({ Origin: base })).status, 200);
  const status = await fetch(base + '/api/client-update');
  assert.equal(status.headers.get('access-control-allow-origin'), null);
  assert.equal((await status.json()).state, 'ready');
  const download = await fetch(base + '/api/client-update/download?id=token');
  assert.equal(download.status, 200);
  assert.match(download.headers.get('content-disposition'), /attachment/);
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), bytes);
  assert.equal((await fetch(base + '/api/client-update/download?id=wrong')).status, 404);
  assert.equal(
    (await fetch(base + '/api/client-update', { headers: { Origin: 'https://evil.example' } }))
      .status,
    403,
  );
});
