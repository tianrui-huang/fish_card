import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const release = new URL('../releases/潮汐卡牌-独立客户端-v0.1.0.html', import.meta.url);

test('独立客户端包含全部界面资源，并能在 file: 环境启动', async () => {
  const html = await readFile(release, 'utf8');
  assert.equal((html.match(/<style>/g) || []).length, 1);
  assert.equal((html.match(/<script>/g) || []).length, 1);
  assert.doesNotMatch(html, /(?:src|href)="\/(?:app\.js|app\.css)"/);
  const script = html.match(/<script>\s*([\s\S]*?)\s*<\/script>/)?.[1];
  assert.ok(script);

  const app = { innerHTML:'', addEventListener(){} };
  const nodes = new Map([
    ['#app', app], ['#room-chip', {}], ['#connection', {}],
    ['#toast', {}], ['#rules-button', {}], ['#rules form', {}]
  ]);
  const inaccessibleStorage = { getItem(){throw Error('Storage unavailable');} };
  const context = {
    document:{ querySelector(selector){return nodes.get(selector);} },
    window:{ location:{ protocol:'file:', origin:'null' }, localStorage:inaccessibleStorage, sessionStorage:inaccessibleStorage },
    URL, setTimeout, clearTimeout
  };
  runInNewContext(script, context);
  assert.match(app.innerHTML, /独立客户端无需安装 Node/);
  assert.doesNotMatch(app.innerHTML, /当前页面的服务端/);
  assert.throws(() => runInNewContext('apiRoot()', context), /请填写服务端地址/);
  assert.equal(runInNewContext("customServerUrl='http://127.0.0.1:8080'; apiRoot()", context), 'http://127.0.0.1:8080');
});
