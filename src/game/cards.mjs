// Copyright (C) 2026 Many Fish contributors
// SPDX-License-Identifier: GPL-3.0-only

export const CARDS = {
  sloth: {
    name: '树懒',
    kind: 'dual',
    hp: 2,
    suit: '青',
    text: '攻击1。技能：使敌方一张牌睡眠，至施加者第二次回合开始。一次性：使敌方一排睡眠。',
  },
  starfish: { name: '海星', kind: 'once', text: '从双方弃牌堆复活一张非一次性卡到己方指定空位。' },
  seahorse: { name: '海马', kind: 'once', text: '夺取敌方场上一张牌，或盲抽敌方一张手牌。' },
  urchin: {
    name: '海胆',
    kind: 'unit',
    hp: 2,
    suit: '紫',
    text: '攻击1。受到伤害时，向伤害来源返还1点伤害。',
  },
  sunfish: {
    name: '翻车鱼',
    kind: 'unit',
    hp: 3,
    suit: '橙',
    text: '攻击1。每张牌每回合限一次：消耗自身1生命，为其他友方牌恢复1生命；可以因此退场，不耗行动点。',
  },
  shark: {
    name: '鲨鱼',
    kind: 'unit',
    hp: 2,
    suit: '蓝',
    text: '攻击1。攻击敌方一排；若击杀，追击射程内生命最高的牌。',
  },
  crab: {
    name: '螃蟹',
    kind: 'unit',
    hp: 2,
    suit: '红',
    text: '攻击1。每张牌每回合限一次：消耗自身1生命，本回合获得1行动点；可以因此退场，不耗行动点。',
  },
  penguin: {
    name: '企鹅',
    kind: 'unit',
    hp: 3,
    suit: '黑',
    text: '攻击1。对方回合中，可替另一张友方牌承受伤害；不耗行动点。',
  },
  kangaroo: {
    name: '袋鼠',
    kind: 'unit',
    hp: 2,
    suit: '棕',
    text: '攻击1。1点腾空，势能最多3层；1点落击造成1+势能伤害。受伤解除腾空并自动反击。',
  },
  elephant: {
    name: '大象',
    kind: 'unit',
    hp: 2,
    suit: '灰',
    text: '攻击1。1点压制敌牌并移至其上。受伤时被压牌受1伤，大象免费返回；主动返回耗1点。',
  },
  whale: {
    name: '鲸',
    kind: 'unit',
    hp: 2,
    suit: '靛',
    text: '攻击1。操控一张敌牌执行一次耗点行动，共耗1点。位置与射程不变，攻击可选双方其他牌。',
  },
};
export const CARD_TYPES = Object.keys(CARDS);
export const DAMAGE_KINDS = {
  attack: '普攻',
  sharkSkill: '技能 · 鲨鱼群攻',
  sharkFollowup: '技能 · 鲨鱼追击',
  kangarooLanding: '技能 · 袋鼠落击',
  kangarooCounter: '被动 · 袋鼠反击',
  urchinReflect: '被动 · 海胆反伤',
  elephantRelease: '技能 · 压制附加伤害',
};
export const POOL_COUNTS = {
  starfish: 2,
  seahorse: 2,
  shark: 3,
  kangaroo: 3,
  crab: 4,
  whale: 4,
  urchin: 4,
  elephant: 4,
  sloth: 5,
  penguin: 5,
  sunfish: 6,
};
export const POOL = Object.entries(POOL_COUNTS).flatMap(([type, count]) => Array(count).fill(type));
