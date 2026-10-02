// Copyright (C) 2026 Many Fish contributors
// SPDX-License-Identifier: GPL-3.0-only

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { once } from 'node:events';
import { createServer } from '../server.mjs';
import { CLIENT_FILES } from '../public/js/config.mjs';

test('public release serves relocated assets, GPL text and the corresponding source archive', async (t) => {
  const server = createServer();
  t.after(() => {
    server.closeAllConnections();
    return new Promise((resolve) => server.close(resolve));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = (url) => fetch(base + url, { signal: AbortSignal.timeout(5000) });
  for (const file of CLIENT_FILES) {
    const res = await get(file);
    assert.equal(res.status, 200, file);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.deepEqual(
      Buffer.from(await res.arrayBuffer()),
      readFileSync(new URL('../public' + file, import.meta.url)),
    );
  }
  const page = await (await get('/')).text();
  assert.match(page, /src="\/js\/app.js"/);
  assert.match(page, /href="\/css\/app.css"/);
  assert.match(page, /href="\/LICENSE"/);
  assert.match(page, /href="\/source.zip"/);
  const license = await get('/LICENSE');
  assert.equal(license.status, 200);
  assert.match(license.headers.get('content-type'), /text\/plain/);
  assert.equal(await license.text(), readFileSync(new URL('../LICENSE', import.meta.url), 'utf8'));
  const source = await get('/source.zip');
  const sourcePath = new URL('../dist/fish-source.zip', import.meta.url);
  if (existsSync(sourcePath)) {
    assert.equal(source.status, 200);
    assert.match(source.headers.get('content-disposition'), /fish-source.zip/);
    assert.deepEqual(Buffer.from(await source.arrayBuffer()), readFileSync(sourcePath));
  } else {
    assert.equal(source.status, 404);
    assert.match((await source.json()).error, /尚未生成源码包/);
  }
  for (const path of ['/app.js', '/app.css', '/src/game/engine.mjs', '/.git/config']) {
    assert.equal((await get(path)).status, 404, path);
  }
});
