import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, unlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RUNTIME_FILES, loadRelease, ReleaseGate } from '../release-integrity.mjs';
import { inspectClient, sha256Fallback, sha256, serverLabel, OFFICIAL_SERVER } from '../public/integrity.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const proof = JSON.parse(readFileSync(path.join(root,'public/release.json'),'utf8'));
test('LAN HTTP SHA-256 fallback matches standard vectors and multi-block binary data', async () => {
  for (const bytes of [new Uint8Array(), new TextEncoder().encode('abc'), new TextEncoder().encode('潮汐卡牌'.repeat(1000)),
    new Uint8Array(Array.from({length:65537}, (_,i)=>i%256))]) {
    const expected = createHash('sha256').update(bytes).digest('hex');
    assert.equal(sha256Fallback(bytes),expected); assert.equal(await sha256(bytes),expected);
  }
  assert.equal(sha256Fallback(new TextEncoder().encode('abc')),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
test('client reads actual files and detects tampering, missing assets and stale pages', async () => {
  const fetcher = (change = {}) => async (url, options) => {
    assert.equal(options.cache,'no-store');
    const file = new URL(url).pathname;
    if (change.missing === file) return new Response('',{status:404});
    if (file === '/release.json' && change.manifest) return new Response(JSON.stringify(change.manifest));
    let bytes = readFileSync(path.join(root,'public',file.slice(1)));
    if (change.tamper === file) bytes = Buffer.concat([bytes,Buffer.from('\n// tampered')]);
    return new Response(bytes);
  };
  assert.deepEqual(await inspectClient('http://192.168.1.5:8080',fetcher()),proof);
  await assert.rejects(inspectClient('http://test',fetcher({tamper:'/app.js'})),/文件校验失败/);
  await assert.rejects(inspectClient('http://test',fetcher({missing:'/app.css'})),/文件不完整/);
  await assert.rejects(inspectClient('http://test',fetcher({manifest:{...proof,version:'old'}})),/版本不一致/);
  await assert.rejects(inspectClient('http://test',fetcher({manifest:{...proof,files:{}}})),/清单异常/);
});
test('verification tickets expire, cannot be reused and do not accept only version numbers', () => {
  let now=1000;
  const gate = new ReleaseGate(proof,{now:()=>now,ttl:10,limit:1});
  assert.throws(()=>gate.verify({version:proof.version}),/版本不一致/);
  const first=gate.verify(proof).verification;
  assert.throws(()=>gate.verify(proof),/繁忙/);
  gate.require(first); gate.consume(first); assert.throws(()=>gate.require(first),/先校验/);
  const second=gate.verify(proof).verification;
  now+=10; assert.throws(()=>gate.require(second),/先校验/);
  gate.require(gate.verify(proof).verification);
});
test('server refuses modified rules, missing files and modified release baselines', t => {
  const fixture = mkdtempSync(path.join(tmpdir(),'tide-release-'));
  t.after(()=>{
    assert.equal(path.dirname(fixture),path.resolve(tmpdir())); assert.match(path.basename(fixture),/^tide-release-/);
    rmSync(fixture,{recursive:true,force:true});
  });
  mkdirSync(path.join(fixture,'public'));
  const files=[...RUNTIME_FILES,'public/release.json','release.json'];
  for (const f of files) writeFileSync(path.join(fixture,f),readFileSync(path.join(root,f)));
  const verified=loadRelease(fixture); assert.equal(verified.client.releaseId,proof.releaseId);
  writeFileSync(path.join(fixture,'engine.mjs'),readFileSync(path.join(root,'engine.mjs'),'utf8')+'\n// changed rules');
  assert.throws(()=>loadRelease(fixture),/校验失败：engine.mjs/);
  writeFileSync(path.join(fixture,'engine.mjs'),readFileSync(path.join(root,'engine.mjs')));
  unlinkSync(path.join(fixture,'public/app.js')); assert.throws(()=>loadRelease(fixture),/文件缺失/);
  writeFileSync(path.join(fixture,'public/app.js'),readFileSync(path.join(root,'public/app.js')));
  const manifest=JSON.parse(readFileSync(path.join(fixture,'release.json'),'utf8'));
  manifest.files['engine.mjs']='0'.repeat(64);
  writeFileSync(path.join(fixture,'release.json'),JSON.stringify(manifest)); assert.throws(()=>loadRelease(fixture),/清单不正确/);
});
test('official server uses a friendly label without exposing its address', () => {
  assert.equal(serverLabel(OFFICIAL_SERVER,'http://localhost:8080'),'官方服务器');
  assert.equal(serverLabel('http://localhost:8080','http://localhost:8080'),'当前页面的服务端');
  assert.equal(serverLabel('http://192.168.1.2:8080','http://localhost:8080'),'http://192.168.1.2:8080');
});
