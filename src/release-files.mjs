// Copyright (C) 2026 Many Fish contributors
// SPDX-License-Identifier: GPL-3.0-only

import { CLIENT_FILES } from '../public/js/config.mjs';
export { CLIENT_FILES } from '../public/js/config.mjs';

export const RUNTIME_FILES = [
  'server.mjs',
  'src/release-files.mjs',
  'src/game/cards.mjs',
  'src/game/deck.mjs',
  'src/game/engine.mjs',
  'src/server/http.mjs',
  'src/server/rooms.mjs',
  'src/server/events.mjs',
  'src/server/release.mjs',
  'src/server/client-update.mjs',
  'LICENSE',
  ...CLIENT_FILES.map((file) => 'public' + file),
];
