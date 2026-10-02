// Copyright (C) 2026 Many Fish contributors
// SPDX-License-Identifier: GPL-3.0-only

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// Exercise the real batch branches with simulated discovery and install calls.
// No Windows installer or WinGet process is executed by these tests.
function runLauncher({
  existing = false,
  wingetPresent = true,
  wingetExit = 1,
  msiExit = 0,
  installer = true,
} = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'tide-launcher-'));
  try {
    let source = readFileSync(new URL('../启动游戏.cmd', import.meta.url), 'utf8');
    if (!existing)
      source = source.replace(
        /^:find_node\r?\n[\s\S]*?(?=\r?\n:try_node)/m,
        `:find_node\nset "NODE_EXE="\nif not exist installed exit /b 1\nset "NODE_EXE=${process.execPath}"\nexit /b 0\n`,
      );
    source = source
      .replace('where winget >nul 2>nul', 'call mock-where.cmd >nul 2>nul')
      .replace('call winget install', 'call mock-winget.cmd install')
      .replace(/^start "" \/wait .*msiexec\.exe.*$/m, 'call mock-msi.cmd');
    const put = (name, text) => {
      mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
      writeFileSync(path.join(dir, name), text.replace(/\r?\n/g, '\r\n'));
    };
    put('启动游戏.cmd', source);
    put('mock-where.cmd', '@echo off\nexit /b %TIDE_TEST_WHERE_EXIT%\n');
    put(
      'mock-winget.cmd',
      '@echo off\necho called>winget-called\nexit /b %TIDE_TEST_WINGET_EXIT%\n',
    );
    put(
      'mock-msi.cmd',
      '@echo off\necho called>msi-called\necho installed>installed\nexit /b %TIDE_TEST_MSI_EXIT%\n',
    );
    put(
      'server.mjs',
      "import {writeFileSync} from 'node:fs'; writeFileSync('game-started','yes');\n",
    );
    if (installer)
      put('third_party/nodejs/node-v24.21.0-x64.msi', 'TEST PLACEHOLDER - NOT AN INSTALLER');
    const result = spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/c', '启动游戏.cmd'], {
      cwd: dir,
      input: '\n',
      encoding: 'utf8',
      timeout: 10000,
      env: {
        ...process.env,
        TIDE_TEST_WHERE_EXIT: wingetPresent ? '0' : '1',
        TIDE_TEST_WINGET_EXIT: String(wingetExit),
        TIDE_TEST_MSI_EXIT: String(msiExit),
      },
    });
    assert.ifError(result.error);
    return {
      status: result.status,
      output: result.stdout + result.stderr,
      wingetCalled: existsSync(path.join(dir, 'winget-called')),
      msiCalled: existsSync(path.join(dir, 'msi-called')),
      started: existsSync(path.join(dir, 'game-started')),
    };
  } finally {
    assert.equal(path.dirname(path.resolve(dir)), path.resolve(tmpdir()));
    rmSync(dir, { recursive: true, force: true });
  }
}

test('启动脚本已有 Node 时直接启动，无需安装', { skip: process.platform !== 'win32' }, () => {
  const r = runLauncher({ existing: true });
  assert.equal(r.status, 0, r.output);
  assert.equal(r.started, true);
  assert.equal(r.wingetCalled, false);
  assert.equal(r.msiCalled, false);
});

test(
  'WinGet 失败或缺失时离线安装，接受成功与需重启退出码',
  { skip: process.platform !== 'win32' },
  () => {
    for (const wingetPresent of [true, false])
      for (const msiExit of [0, 3010]) {
        const r = runLauncher({ wingetPresent, msiExit });
        assert.equal(r.status, 0, r.output);
        assert.equal(r.wingetCalled, wingetPresent);
        assert.equal(r.msiCalled, true);
        assert.equal(r.started, true);
      }
  },
);

test('离线安装失败或安装包缺失时停止，不启动游戏', { skip: process.platform !== 'win32' }, () => {
  for (const options of [{ msiExit: 1603 }, { installer: false }]) {
    const r = runLauncher(options);
    assert.equal(r.status, 1, r.output);
    assert.equal(r.started, false);
    assert.equal(r.msiCalled, options.installer !== false);
  }
});
