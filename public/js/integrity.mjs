// Copyright (C) 2026 Tide Card contributors
// SPDX-License-Identifier: GPL-3.0-only

import { CLIENT_VERSION, PROTOCOL, CLIENT_FILES, OFFICIAL_SERVER } from './config.mjs';
import { sha256 } from './sha256.mjs';

export async function inspectClient(origin, fetcher = fetch) {
  const read = async (file) => {
    const res = await fetcher(origin + file, {
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw Error('客户端文件不完整，请重新解压最新版并刷新页面。');
    return res;
  };
  const manifest = await (await read('/release.json')).json();
  if (manifest.version !== CLIENT_VERSION || manifest.protocol !== PROTOCOL)
    throw Error('页面与客户端版本不一致，请更新客户端并按 Ctrl+F5 刷新。');
  if (
    Object.keys(manifest.files || {})
      .sort()
      .join('|') !== [...CLIENT_FILES].sort().join('|')
  )
    throw Error('客户端校验清单异常，请重新解压最新版。');
  const hashes = Object.fromEntries(
    await Promise.all(
      CLIENT_FILES.map(async (file) => {
        const hash = await sha256(await (await read(file)).arrayBuffer());
        if (hash !== manifest.files[file])
          throw Error(`客户端文件校验失败（${file}），请重新解压最新版并刷新。`);
        return [file, hash];
      }),
    ),
  );
  return {
    protocol: PROTOCOL,
    version: CLIENT_VERSION,
    releaseId: manifest.releaseId,
    rulesHash: manifest.rulesHash,
    files: hashes,
  };
}
export function serverLabel(address, currentOrigin) {
  if (address === OFFICIAL_SERVER) return '官方服务器';
  if (address === currentOrigin) return '当前页面的服务端';
  return address;
}
