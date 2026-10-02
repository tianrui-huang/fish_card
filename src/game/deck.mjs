// Copyright (C) 2026 Tide Card contributors
// SPDX-License-Identifier: GPL-3.0-only

import { randomBytes } from 'node:crypto';
import { CARDS, CARD_TYPES, POOL } from './cards.mjs';

export function validDeck(deck) {
  return (
    Array.isArray(deck) &&
    deck.length === 6 &&
    deck.every((t) => CARD_TYPES.includes(t)) &&
    deck.filter((t) => CARDS[t].kind !== 'once').length >= 3
  );
}
export function drawCards(pool = POOL) {
  if (
    !Array.isArray(pool) ||
    pool.length < 6 ||
    pool.some((t) => !CARD_TYPES.includes(t)) ||
    pool.filter((t) => CARDS[t].kind !== 'once').length < 3
  )
    throw Error('牌池配置无效。');
  const shuffled = [...pool];
  for (let k = shuffled.length - 1; k > 0; k--) {
    const j = randomBytes(4).readUInt32BE() % (k + 1);
    [shuffled[k], shuffled[j]] = [shuffled[j], shuffled[k]];
  }
  const hand = shuffled.slice(0, 6);
  return validDeck(hand) ? { hand, remaining: shuffled.slice(6) } : drawCards(pool);
}
export function drawHand(pool = POOL) {
  return drawCards(pool).hand;
}
