// Copyright (C) 2026 Many Fish contributors
// SPDX-License-Identifier: GPL-3.0-only

import { CLIENT_VERSION, OFFICIAL_SERVER } from './config.mjs';
import {
  inspectOfficialVersion,
  compareVersions,
  releasePage,
  RELEASE_API,
  selectUpdateAsset,
} from './update.mjs';

export function createUpdateUI({ inspect = inspectOfficialVersion, fetcher = fetch } = {}) {
  const dialog = document.querySelector('#client-update');
  const message = document.querySelector('#update-message');
  const progress = document.querySelector('#update-progress');
  const retry = document.querySelector('#update-retry');
  const save = document.querySelector('#update-save');
  const releases = document.querySelector('#update-release');
  const official = document.querySelector('#update-play');
  const dismiss = document.querySelector('#update-dismiss');
  let version,
    pollController,
    running = null,
    lastAutomatic = null;
  official.href = OFFICIAL_SERVER + '/';
  function autoSave(url, name) {
    save.href = url;
    save.download = name;
    save.hidden = false;
    if (lastAutomatic !== version) {
      lastAutomatic = version;
      save.click();
    }
  }
  const interrupted = () =>
    Object.assign(Error('请先更新客户端，再连接官方服务器。'), { code: 'CLIENT_UPDATE_REQUIRED' });
  async function download() {
    pollController?.abort();
    const controller = new AbortController();
    pollController = controller;
    retry.hidden = true;
    save.hidden = true;
    progress.hidden = false;
    progress.removeAttribute('value');
    message.textContent = `官方服务器使用 ${version}，当前客户端为 ${CLIENT_VERSION}。正在获取更新包…`;
    try {
      const origin = window.location.origin;
      const request = (url, options = {}) =>
        fetcher(url, {
          ...options,
          signal: AbortSignal.any
            ? AbortSignal.any([controller.signal, AbortSignal.timeout(15000)])
            : controller.signal,
        });
      const local = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
      if (!local) {
        const response = await request(RELEASE_API + `v${version}`);
        if (!response.ok) throw Error('对应版本尚未发布，或 GitHub 暂时无法连接。');
        const asset = selectUpdateAsset(await response.json(), version);
        if (controller.signal.aborted) return;
        autoSave(asset.url, `many-fish-windows-v${version}.zip`);
        message.textContent =
          '已请求浏览器下载官方更新包。若浏览器未开始下载，请点击“保存更新包”。解压后使用新版启动游戏。';
        progress.hidden = true;
        return;
      }
      const start = await request(origin + '/api/client-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version }),
      });
      if (!start.ok) throw Error('本地启动器尚不支持自动下载，请使用“打开发布页面”获取新版。');
      let job = await start.json();
      const deadline = Date.now() + 7 * 60 * 1000;
      while (!controller.signal.aborted) {
        if (!job || job.version !== version) throw Error('另一个版本正在下载，请稍后重试。');
        if (job.state === 'error') throw Error(job.error);
        if (job.total) {
          progress.max = job.total;
          progress.value = job.received;
        }
        if (job.state === 'ready') {
          autoSave(
            origin + '/api/client-update/download?id=' + encodeURIComponent(job.id),
            job.filename,
          );
          message.textContent = `更新包已下载并通过 SHA-256 校验，保存在当前游戏目录的 dist/updates/${job.filename}。已请求浏览器另存一份；请关闭本地游戏服务，将更新包完整解压到新目录，再启动新版。`;
          return;
        }
        message.textContent =
          job.state === 'checking'
            ? `正在查找官方服务器使用的 ${version} 更新包…`
            : job.state === 'verifying'
              ? '下载完成，正在校验更新包…'
              : `正在下载 ${version}：${(job.received / 1048576).toFixed(1)} / ${(job.total / 1048576).toFixed(1)} MB`;
        if (Date.now() > deadline) throw Error('更新下载超时，请稍后重试。');
        await new Promise((resolve, reject) => {
          const onAbort = () => {
            clearTimeout(timer);
            reject(controller.signal.reason);
          };
          const timer = setTimeout(() => {
            controller.signal.removeEventListener('abort', onAbort);
            resolve();
          }, 1000);
          controller.signal.addEventListener('abort', onAbort, { once: true });
        });
        const status = await request(origin + '/api/client-update', { cache: 'no-store' });
        if (!status.ok) throw Error('本地游戏服务已关闭；下载完成后可检查 dist/updates/ 目录。');
        job = await status.json();
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      progress.hidden = true;
      retry.hidden = false;
      message.textContent = `自动更新未完成：${error.message} 可以重试，或直接打开官方网页试玩。`;
    }
  }
  retry.onclick = () => {
    lastAutomatic = null;
    void download();
  };
  dismiss.onclick = () => dialog.close();
  dialog.addEventListener('close', () => pollController?.abort());
  return {
    async check(base) {
      if (base !== OFFICIAL_SERVER) return;
      if (running) {
        await running;
        throw interrupted();
      }
      const target = await inspect(CLIENT_VERSION, OFFICIAL_SERVER);
      if (!target) return;
      let pageVersion = window.location.origin === OFFICIAL_SERVER ? target : null;
      if (['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)) {
        try {
          const response = await fetcher(window.location.origin + '/api/health', {
            cache: 'no-store',
            signal: AbortSignal.timeout(15000),
          });
          const health = await response.json();
          if (
            response.ok &&
            health.service === 'many-fish-game' &&
            compareVersions(health.version, CLIENT_VERSION) > 0
          )
            pageVersion = health.version;
        } catch {}
      }
      if (pageVersion) {
        const key = 'many-fish-update-refresh';
        if (sessionStorage.getItem(key) !== pageVersion) {
          sessionStorage.setItem(key, pageVersion);
          const page = new URL(window.location.href);
          page.searchParams.set('update', pageVersion);
          window.location.replace(page.href);
          throw interrupted();
        }
      }
      version = target;
      releases.href = releasePage(version);
      document.querySelector('#update-title').textContent = `客户端需要更新至 ${version}`;
      if (!dialog.open) dialog.showModal();
      running = download();
      try {
        await running;
      } finally {
        running = null;
      }
      throw interrupted();
    },
  };
}
