// Copyright (C) 2026 Tide Card contributors
// SPDX-License-Identifier: GPL-3.0-only

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { createServer } from './src/server/http.mjs';
export { createServer } from './src/server/http.mjs';

export function startServer() {
  const port = Number(process.env.PORT || 8080);
  const host = process.env.HOST || '0.0.0.0';
  const server = createServer();
  function listenOn(candidate) {
    const onError = (error) => {
      server.removeListener('listening', onListening);
      if (error.code === 'EADDRINUSE' && !process.env.PORT && candidate < 8090) {
        listenOn(candidate + 1);
        return;
      }
      throw error;
    };
    const onListening = () => {
      server.removeListener('error', onError);
      console.log(`潮汐卡牌已启动： http://localhost:${candidate}`);
      if (host === '0.0.0.0')
        for (const list of Object.values(os.networkInterfaces()))
          for (const n of list || [])
            if (n.family === 'IPv4' && !n.internal)
              console.log(`局域网访问： http://${n.address}:${candidate}`);
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(candidate, host);
  }
  listenOn(port);
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  startServer();
