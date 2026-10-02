// Copyright (C) 2026 Many Fish contributors
// SPDX-License-Identifier: GPL-3.0-only

import { createHash, randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { OFFICIAL_SERVER } from '../../public/js/config.mjs';
import { inspectOfficialVersion, RELEASE_API, selectUpdateAsset } from '../../public/js/update.mjs';

export function isLocalUpdateRequest(req) {
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) return false;
  let origin;
  try {
    const url = new URL(`http://${req.headers.host}`);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return false;
    origin = url.origin;
  } catch {
    return false;
  }
  // Cross-origin requests cannot start downloads or read local update status.
  return req.headers.origin ? req.headers.origin === origin : req.method === 'GET';
}
const githubHeaders = { Accept: 'application/vnd.github+json', 'User-Agent': 'Many-Fish-Updater' };
async function downloadResponse(url, fetcher, signal) {
  for (let redirect = 0; redirect < 5; redirect++) {
    const parsed = new URL(url);
    if (
      parsed.protocol !== 'https:' ||
      ![
        'github.com',
        'release-assets.githubusercontent.com',
        'objects.githubusercontent.com',
      ].includes(parsed.hostname) ||
      parsed.username ||
      parsed.password
    )
      throw Error('更新下载地址异常。');
    const response = await fetcher(url, { redirect: 'manual', signal });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (!location) throw Error('更新包下载跳转异常。');
      url = new URL(location, url).href;
      continue;
    }
    if (!response.ok || !response.body) throw Error('无法下载更新包，请稍后重试。');
    return response;
  }
  throw Error('更新包下载跳转过多。');
}
export function createClientUpdater({
  root,
  version,
  fetcher = fetch,
  platform = process.platform,
}) {
  let job = null;
  let completedFile = null;
  const snapshot = () => job && { ...job };
  async function run(requested) {
    let partial;
    try {
      const target = await inspectOfficialVersion(version, OFFICIAL_SERVER, fetcher);
      if (!target || target !== requested) throw Error('官方服务器版本已变化，请重新连接检查。');
      const response = await fetcher(RELEASE_API + `v${target}`, {
        headers: githubHeaders,
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw Error('官方对应版本的更新包尚未发布，或 GitHub 暂时无法连接。');
      const asset = selectUpdateAsset(await response.json(), target);
      const directory = path.join(root, 'dist', 'updates');
      await mkdir(directory, { recursive: true });
      const filename = `many-fish-windows-v${target}.zip`;
      const destination = path.join(directory, filename);
      const markInternet = () =>
        platform === 'win32'
          ? writeFile(
              destination + ':Zone.Identifier',
              `[ZoneTransfer]\r\nZoneId=3\r\nHostUrl=${asset.url}\r\n`,
            )
          : Promise.resolve();
      // Cache reuse is based on the official SHA-256, never just a filename or version string.
      try {
        const hash = createHash('sha256');
        let size = 0;
        for await (const chunk of createReadStream(destination)) {
          hash.update(chunk);
          size += chunk.length;
        }
        if (size === asset.size && hash.digest('hex') === asset.sha256) {
          await markInternet();
          completedFile = destination;
          Object.assign(job, {
            state: 'ready',
            received: size,
            total: size,
            filename,
            sha256: asset.sha256,
          });
          return;
        }
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      partial = destination + `.${job.id}.part`;
      Object.assign(job, { state: 'downloading', total: asset.size });
      const download = await downloadResponse(asset.url, fetcher, AbortSignal.timeout(300000));
      const advertised = download.headers.get('content-length');
      if (advertised && Number(advertised) !== asset.size)
        throw Error('更新包大小与官方清单不一致。');
      const hash = createHash('sha256');
      async function* checkedBytes() {
        for await (const chunk of download.body) {
          job.received += chunk.length;
          if (job.received > asset.size) throw Error('更新包超过官方声明的大小。');
          hash.update(chunk);
          yield chunk;
        }
      }
      await pipeline(checkedBytes(), createWriteStream(partial, { flags: 'wx' }));
      job.state = 'verifying';
      if (job.received !== asset.size || hash.digest('hex') !== asset.sha256)
        throw Error('更新包校验失败，请重试。');
      await rename(partial, destination);
      partial = null;
      // Retain Internet provenance on Windows instead of suppressing its security checks.
      await markInternet();
      completedFile = destination;
      Object.assign(job, { state: 'ready', filename, sha256: asset.sha256 });
    } catch (error) {
      if (partial) await rm(partial, { force: true }).catch(() => {});
      Object.assign(job, {
        state: 'error',
        error: error.name === 'TimeoutError' ? '更新下载超时，请重试。' : error.message,
      });
    }
  }
  return {
    start(requested) {
      if (job && ['checking', 'downloading', 'verifying'].includes(job.state)) return snapshot();
      job = {
        id: randomBytes(24).toString('hex'),
        version: requested,
        state: 'checking',
        received: 0,
        total: 0,
      };
      completedFile = null;
      void run(requested);
      return snapshot();
    },
    status: snapshot,
    file(id) {
      return job?.state === 'ready' && job.id === id
        ? { path: completedFile, name: job.filename }
        : null;
    },
  };
}
