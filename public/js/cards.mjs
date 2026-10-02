// Copyright (C) 2026 Many Fish contributors
// SPDX-License-Identifier: GPL-3.0-only

export const FALLBACK_CARDS = {
  kangaroo: { name: '袋鼠', kind: 'unit', hp: 2, text: '腾空积累势能；落击或受伤反击。' },
  elephant: {
    name: '大象',
    kind: 'unit',
    hp: 2,
    text: '压制敌方牌；受击免费返回，主动返回耗1点。',
  },
  whale: { name: '鲸', kind: 'unit', hp: 2, text: '操控敌方牌执行一次耗点行动，共耗1点。' },
  sloth: { name: '树懒', kind: 'dual', hp: 2, text: '使一张敌方牌睡眠；一次性可使一排睡眠。' },
  starfish: { name: '海星', kind: 'once', text: '从双方弃牌堆复活一张牌。' },
  seahorse: { name: '海马', kind: 'once', text: '夺取敌方牌，或盲抽一张手牌。' },
  urchin: { name: '海胆', kind: 'unit', hp: 2, text: '受伤时反弹1点伤害。' },
  sunfish: {
    name: '翻车鱼',
    kind: 'unit',
    hp: 3,
    text: '每张牌每回合限一次，消耗1生命为友方牌恢复1生命，可因此退场。',
  },
  shark: { name: '鲨鱼', kind: 'unit', hp: 2, text: '攻击一排；击杀后追击。' },
  crab: {
    name: '螃蟹',
    kind: 'unit',
    hp: 2,
    text: '每张牌每回合限一次，消耗1生命获得1行动点，可因此退场。',
  },
  penguin: { name: '企鹅', kind: 'unit', hp: 3, text: '对方回合替友方牌挡伤。' },
};

export const art = (type) => {
  const shapes = {
    kangaroo:
      '<path d="M82 40L77 15q10-8 14 24m18 2l8-26q12 0 2 31" fill="#cc9567" stroke="#956343" stroke-width="4"/><ellipse cx="100" cy="54" rx="24" ry="22" fill="#dcaa7a"/><ellipse cx="104" cy="78" rx="28" ry="25" fill="#b88155"/><ellipse cx="103" cy="82" rx="17" ry="14" fill="#eed2a2"/><path d="M78 73Q40 75 45 99L81 89m39-3l25 14m-53-5l-11 7" fill="none" stroke="#ad744f" stroke-width="9" stroke-linecap="round"/><circle cx="94" cy="48" r="3" fill="#233d48"/><circle cx="111" cy="48" r="3" fill="#233d48"/><path d="M100 55l5 4 5-4" fill="#835747"/>',
    elephant:
      '<ellipse cx="102" cy="63" rx="42" ry="30" fill="#8da8af"/><ellipse cx="78" cy="49" rx="24" ry="27" fill="#aec3c5"/><ellipse cx="131" cy="49" rx="24" ry="27" fill="#aec3c5"/><ellipse cx="105" cy="48" rx="27" ry="29" fill="#9cb6ba"/><path d="M105 61v25q0 19 17 12" fill="none" stroke="#9cb6ba" stroke-width="13" stroke-linecap="round"/><path d="M83 76l-5 21m52-21l5 21" stroke="#78969f" stroke-width="13" stroke-linecap="round"/><path d="M86 65l-8 12m46-12l8 12" stroke="#fff0ce" stroke-width="5" stroke-linecap="round"/><circle cx="93" cy="47" r="3" fill="#23404a"/><circle cx="118" cy="47" r="3" fill="#23404a"/>',
    whale:
      '<path d="M46 52q15-32 69-18 23 6 31 29l19-17 13 12-28 25q-31 23-73 5Q44 81 46 52z" fill="#638cba"/><path d="M51 70q33 23 81 3-18 26-48 17z" fill="#c6e5ec"/><path d="M99 72l-13 29 33-24" fill="#4b719e"/><circle cx="68" cy="53" r="3" fill="#122e46"/><path d="M53 66q11 8 22 1M79 30V17m-1 7l-8-10m10 8l10-9" fill="none" stroke="#c4f3f1" stroke-width="3" stroke-linecap="round"/>',
    sloth:
      '<path d="M55 23h91M86 26q-2 18 13 21 12-3 9-19" fill="none" stroke="#6a5645" stroke-width="6" stroke-linecap="round"/><ellipse cx="101" cy="60" rx="24" ry="29" fill="#a47d57"/><circle cx="101" cy="40" r="20" fill="#b89468"/><ellipse cx="101" cy="43" rx="12" ry="10" fill="#efe3c9"/><circle cx="96" cy="42" r="2"/><circle cx="106" cy="42" r="2"/><path d="M97 48q4 4 8 0" fill="none" stroke="#654c3b" stroke-width="2"/>',
    starfish:
      '<path d="M101 20l13 26 29 3-21 19 6 29-27-15-27 15 6-29-21-19 29-3z" fill="#fa8771" stroke="#d35e61" stroke-width="4"/><circle cx="94" cy="57" r="2" fill="#823f54"/><circle cx="108" cy="57" r="2" fill="#823f54"/><path d="M96 65q5 5 10 0" fill="none" stroke="#823f54" stroke-width="2"/>',
    seahorse:
      '<path d="M120 28q-16-13-30 0-13 12-3 26 9 12 25 4 10-5 5-14-4-6-12-1" fill="none" stroke="#efc46c" stroke-width="12" stroke-linecap="round"/><path d="M116 30q20-3 24 11l-15 7" fill="#e5ac5f"/><circle cx="132" cy="34" r="2" fill="#173d4c"/><path d="M99 54q8 12 4 23-5 12 7 15 8 2 12-5" fill="none" stroke="#d78e56" stroke-width="8" stroke-linecap="round"/><path d="M94 38l-9-8m9 16l-12 0m17 14l-9 8" stroke="#f6db89" stroke-width="3"/>',
    urchin:
      '<g fill="#7e69a5" stroke="#594a83" stroke-width="3">' +
      Array.from(
        { length: 12 },
        (_, i) =>
          `<path d="M101 54L${101 + 43 * Math.cos((i * Math.PI) / 6)} ${54 + 43 * Math.sin((i * Math.PI) / 6)}L${101 + 16 * Math.cos((i * Math.PI) / 6 + 0.2)} ${54 + 16 * Math.sin((i * Math.PI) / 6 + 0.2)}Z"/>`,
      ).join('') +
      '</g><circle cx="101" cy="54" r="22" fill="#967fb9"/><circle cx="94" cy="51" r="3" fill="#f7edca"/><circle cx="108" cy="51" r="3" fill="#f7edca"/><path d="M95 61q6 5 12 0" fill="none" stroke="#493f6d" stroke-width="2"/>',
    sunfish:
      '<ellipse cx="101" cy="56" rx="39" ry="29" fill="#efa566"/><path d="M65 56L44 40v32zm73 0l22-15v30z" fill="#d78060"/><path d="M90 28q12-11 23 0m-23 56q12 10 23 0" fill="#edbd73"/><circle cx="87" cy="51" r="3" fill="#173e4b"/><circle cx="115" cy="51" r="3" fill="#173e4b"/><path d="M94 64q7 5 14 0" fill="none" stroke="#9e5c53" stroke-width="2"/>',
    shark:
      '<path d="M43 60q26-27 74-19l29-21-3 28q20 10 25 20-24 23-63 17-39-2-62-25z" fill="#829ba3"/><path d="M92 43l19-29 11 31m-22 34l-8 20 30-20" fill="#617f89"/><circle cx="130" cy="56" r="3" fill="#132e3a"/><path d="M142 69l-12 2 9 5 10-4" fill="#f3eee0"/>',
    crab: '<ellipse cx="101" cy="59" rx="30" ry="24" fill="#e16d62"/><path d="M72 56L52 45 43 55l22 11m67-10l20-11 9 10-22 11M81 76l-12 13m27-10l-4 14m31-17l11 13m-25-11l4 14" fill="none" stroke="#c75354" stroke-width="7" stroke-linecap="round"/><path d="M70 47q-17-12-25 0m87 0q17-12 25 0" fill="none" stroke="#e7806a" stroke-width="9" stroke-linecap="round"/><circle cx="91" cy="54" r="3" fill="#fff4d4"/><circle cx="111" cy="54" r="3" fill="#fff4d4"/>',
    penguin:
      '<ellipse cx="101" cy="57" rx="31" ry="39" fill="#263d4c"/><ellipse cx="101" cy="64" rx="20" ry="28" fill="#f6efd9"/><circle cx="91" cy="43" r="3" fill="#fff"/><circle cx="111" cy="43" r="3" fill="#fff"/><circle cx="91" cy="43" r="1.6" fill="#142c39"/><circle cx="111" cy="43" r="1.6" fill="#142c39"/><path d="M96 51l5 6 5-6z" fill="#eda863"/><path d="M77 94l18 2-10 6m20-6l18-2-8 8" fill="#e8a75e"/>',
  };
  return `<svg viewBox="0 0 202 108" aria-hidden="true"><g fill="#e1fff2" opacity=".55"><circle cx="28" cy="28" r="3"/><circle cx="170" cy="72" r="4"/><circle cx="39" cy="85" r="2"/></g>${shapes[type] || ''}</svg>`;
};
