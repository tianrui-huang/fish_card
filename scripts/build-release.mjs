// Copyright (C) 2026 Many Fish contributors
// SPDX-License-Identifier: GPL-3.0-only

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { RUNTIME_FILES, hash, releaseId, loadRelease, rulesHash } from '../src/server/release.mjs';
import { CLIENT_VERSION, PROTOCOL, CLIENT_FILES } from '../public/js/config.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
if (pkg.version !== CLIENT_VERSION) throw Error('package.json 与客户端发布版本不一致。');
if (process.argv.includes('--check')) {
  const release = loadRelease(root);
  console.log(`发布文件校验通过：${release.client.version} ${release.client.releaseId}`);
  process.exit(0);
}
const files = Object.fromEntries(
  RUNTIME_FILES.map((f) => [f, hash(readFileSync(path.join(root, f)))]),
);
const manifest = { protocol: PROTOCOL, version: CLIENT_VERSION, files };
manifest.releaseId = releaseId(manifest);
const client = {
  protocol: PROTOCOL,
  version: CLIENT_VERSION,
  releaseId: manifest.releaseId,
  rulesHash: rulesHash(manifest),
  files: Object.fromEntries(CLIENT_FILES.map((f) => [f, files['public' + f]])),
};
writeFileSync(path.join(root, 'public/release.json'), JSON.stringify(client, null, 2) + '\n');
manifest.files['public/release.json'] = hash(readFileSync(path.join(root, 'public/release.json')));
writeFileSync(path.join(root, 'release.json'), JSON.stringify(manifest, null, 2) + '\n');
loadRelease(root);
console.log(`发布清单已生成并校验：${CLIENT_VERSION} ${manifest.releaseId}`);
