// Copyright (C) 2026 Many Fish contributors
// SPDX-License-Identifier: GPL-3.0-only

export const RELEASE_REPOSITORY = 'https://github.com/tianrui-huang/fish_card';
export const RELEASE_API = 'https://api.github.com/repos/tianrui-huang/fish_card/releases/tags/';
export const WINDOWS_ASSET = 'fish-windows-launcher.zip';
export const MAX_UPDATE_SIZE = 100 * 1024 * 1024;

function parseVersion(version) {
  if (typeof version !== 'string' || version.length > 80) return null;
  const match =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(
      version,
    );
  if (!match) return null;
  const main = match.slice(1, 4).map(Number);
  const pre = match[4]?.split('.') || [];
  if (
    main.some((n) => !Number.isSafeInteger(n)) ||
    pre.some((n) => /^\d+$/.test(n) && (!Number.isSafeInteger(Number(n)) || /^0\d/.test(n)))
  )
    return null;
  return { main, pre };
}
export function compareVersions(left, right) {
  const a = parseVersion(left),
    b = parseVersion(right);
  if (!a || !b) throw Error('服务端版本格式异常，无法自动更新。');
  for (let i = 0; i < 3; i++) if (a.main[i] !== b.main[i]) return a.main[i] > b.main[i] ? 1 : -1;
  if (!a.pre.length || !b.pre.length)
    return a.pre.length === b.pre.length ? 0 : a.pre.length ? -1 : 1;
  for (let i = 0; i < Math.max(a.pre.length, b.pre.length); i++) {
    if (a.pre[i] === undefined) return -1;
    if (b.pre[i] === undefined) return 1;
    if (a.pre[i] === b.pre[i]) continue;
    const numericA = /^\d+$/.test(a.pre[i]),
      numericB = /^\d+$/.test(b.pre[i]);
    if (numericA && numericB) return Number(a.pre[i]) > Number(b.pre[i]) ? 1 : -1;
    if (numericA !== numericB) return numericA ? -1 : 1;
    return a.pre[i] > b.pre[i] ? 1 : -1;
  }
  return 0;
}
export function releasePage(version) {
  compareVersions(version, version);
  return `${RELEASE_REPOSITORY}/releases/tag/v${version}`;
}
export function selectUpdateAsset(release, version) {
  compareVersions(version, version);
  const url = `${RELEASE_REPOSITORY}/releases/download/v${version}/${WINDOWS_ASSET}`;
  const asset = release.assets?.find((item) => item.name === WINDOWS_ASSET);
  if (
    release.draft ||
    release.tag_name !== `v${version}` ||
    !asset ||
    asset.state !== 'uploaded' ||
    asset.browser_download_url !== url ||
    !/^sha256:[0-9a-f]{64}$/.test(asset.digest || '') ||
    !Number.isSafeInteger(asset.size) ||
    asset.size < 1 ||
    asset.size > MAX_UPDATE_SIZE
  )
    throw Error('官方对应版本的更新包尚未就绪，请稍后重试。');
  return { url, size: asset.size, sha256: asset.digest.slice(7) };
}
export async function inspectOfficialVersion(currentVersion, official, fetcher = fetch) {
  const response = await fetcher(official + '/api/health', {
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw Error('无法检查官方服务器版本，请稍后重试。');
  const health = await response.json();
  if (health.service !== 'many-fish-game' || health.integrity !== 'verified')
    throw Error('官方服务器版本信息异常，请稍后重试。');
  return compareVersions(health.version, currentVersion) > 0 ? health.version : null;
}
