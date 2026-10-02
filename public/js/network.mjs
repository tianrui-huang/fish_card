// Copyright (C) 2026 Tide Card contributors
// SPDX-License-Identifier: GPL-3.0-only

export async function requestJSON(base, url, body) {
  let r;
  try {
    r = await fetch(`${base}${url}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    throw Error(
      e.name === 'TimeoutError'
        ? '服务端响应超时，请稍后重试。'
        : '无法连接服务端，请确认网络和服务端已启动。',
    );
  }
  const data = await r.json();
  if (!r.ok)
    throw Object.assign(Error(data.error || '请求失败'), { code: data.code, status: r.status });
  return data;
}
