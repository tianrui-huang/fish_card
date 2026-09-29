import { randomBytes } from 'node:crypto';

export const CARDS = {
  sloth: { name: '树懒', kind: 'dual', hp: 2, suit: '青', text: '攻击1。技能：使敌方一张牌睡眠。一次性：使敌方一排睡眠。' },
  starfish: { name: '海星', kind: 'once', text: '从双方弃牌堆复活一张非一次性卡到己方指定空位。' },
  seahorse: { name: '海马', kind: 'once', text: '夺取敌方场上一张牌，或盲抽敌方一张手牌。' },
  urchin: { name: '海胆', kind: 'unit', hp: 2, suit: '紫', text: '攻击1。受到伤害时，向伤害来源返还1点伤害。' },
  sunfish: { name: '翻车鱼', kind: 'unit', hp: 3, suit: '橙', text: '攻击1。消耗自身1生命，为其他友方牌恢复1生命；可以因此退场，不耗行动点。' },
  shark: { name: '鲨鱼', kind: 'unit', hp: 2, suit: '蓝', text: '攻击1。技能：敌方一排各受到1伤害；若击杀，再追击可攻击范围内生命最高的一张牌。' },
  crab: { name: '螃蟹', kind: 'unit', hp: 2, suit: '红', text: '攻击1。消耗自身1生命，本回合获得1行动点；可以因此退场，不耗行动点。' },
  penguin: { name: '企鹅', kind: 'unit', hp: 3, suit: '黑', text: '攻击1。对方回合中，可替另一张友方牌承受伤害；不耗行动点。' },
};
export const CARD_TYPES = Object.keys(CARDS);
// 临时牌池：目前每种已知卡一张。收到完整卡表后在这里调整数量。
export const POOL = ['sloth','starfish','seahorse','urchin','sunfish','shark','crab','penguin'];
const uid = () => randomBytes(8).toString('hex');
const unit = c => CARDS[c.type].kind !== 'once';
const player = (name, deck) => ({ name: String(name || '玩家').slice(0, 16), hand: deck.map(type => ({ id: uid(), type })), field: [null, null, null, null], discard: [], passes: 0, rps: null, placed: 0 });
export function validDeck(deck) {
  return Array.isArray(deck) && deck.length === 6 && deck.every(t => CARD_TYPES.includes(t)) && deck.filter(t => CARDS[t].kind !== 'once').length >= 3;
}
export function drawHand(pool = POOL) {
  if (!Array.isArray(pool) || pool.length < 6 || pool.some(t => !CARD_TYPES.includes(t))) throw Error('牌池配置无效。');
  const shuffled = [...pool];
  for (let k = shuffled.length - 1; k > 0; k--) { const j = randomBytes(4).readUInt32BE() % (k+1); [shuffled[k],shuffled[j]] = [shuffled[j],shuffled[k]]; }
  const hand = shuffled.slice(0,6);
  if (hand.filter(t => CARDS[t].kind !== 'once').length < 3) return drawHand(pool);
  return hand;
}
export function createGame(name) {
  return { code: randomBytes(3).toString('hex').toUpperCase(), phase: 'waiting', players: [player(name, drawHand())], turn: null, first: null, setup: null, ap: 0, round: 0, pending: null, winner: null, log: ['房间已创建，等待另一位玩家。'], version: 1 };
}
export function joinGame(g, name) {
  if (g.players.length !== 1) throw Error('房间已满。');
  g.players.push(player(name, drawHand())); g.phase = 'rps'; log(g, '两位玩家已就位，请各自出拳。'); return g;
}
function log(g, s) { g.log.push(s); if (g.log.length > 70) g.log.shift(); g.version++; }
function fail(s) { throw Error(s); }
const enemy = i => 1 - i;
const fieldCard = (g, i, slot) => Number.isInteger(slot) && slot >= 0 && slot < 4 ? g.players[i].field[slot] : null;
function findField(g, id) {
  for (let p = 0; p < 2; p++) for (let s = 0; s < 4; s++) if (g.players[p].field[s]?.id === id) return { p, s, c: g.players[p].field[s] };
  return null;
}
function takeHand(g, i, id) { const ix = g.players[i].hand.findIndex(c => c.id === id); if (ix < 0) fail('手牌不存在。'); return g.players[i].hand.splice(ix, 1)[0]; }
function putBack(g, i, c) { g.players[i].hand.push(c); }
function actor(g, i, id, type) { const a = findField(g, id); if (!a || a.p !== i) fail('请选择自己的场上牌。'); if (a.c.sleep > 0) fail('睡眠中的牌不能行动。'); if (type && a.c.type !== type) fail('这张牌没有该技能。'); return a; }
function canReach(a, b) { return a.p !== b.p && (a.s < 2 || b.s < 2); }
function ensureTurn(g, i) { if (g.phase !== 'battle' || g.turn !== i) fail('还没轮到你。'); if (g.pending) fail('请先处理待响应的伤害。'); }
function spend(g, i) { if (g.ap < 1) fail('行动点不足。'); g.ap--; g.players[i].passes = 0; }
function startTurn(g, i) {
  g.phase = 'battle'; g.turn = i; g.ap = 1; g.round++;
  const p = g.players[i];
  if (!p.field.some(Boolean)) {
    const canRevive = p.hand.some(c => c.type === 'starfish') && g.players.some(owner => owner.discard.some(unit));
    const canSteal = p.hand.some(c => c.type === 'seahorse') && (g.players[enemy(i)].field.some(Boolean) || g.players[enemy(i)].hand.some(unit));
    if (!p.hand.some(unit) && !canRevive && !canSteal) { finish(g, enemy(i), `${p.name}已无牌可上场`); return; }
  }
  log(g, `第${g.round}回合 · ${p.name}行动（1点）`);
}
function finish(g, i, why) { g.phase = 'ended'; g.winner = i; g.pending = null; g.ap = 0; log(g, `${why}，${g.players[i].name}获胜。`); }
function checkWin(g) {
  for (let i = 0; i < 2; i++) {
    const p = g.players[i];
    if (!p.field.some(Boolean) && !p.hand.some(unit) && !p.hand.some(c => CARDS[c.type].kind === 'once')) { finish(g, enemy(i), `${p.name}的牌已全部耗尽`); return true; }
  }
  return false;
}
function endTurn(g, passed = false) {
  const i = g.turn; const p = g.players[i];
  if (passed) { p.passes++; log(g, `${p.name}放弃行动点（连续${p.passes}次）。`); if (p.passes >= 2) { finish(g, enemy(i), `${p.name}连续两回合弃权`); return; } }
  for (const c of p.field) if (c?.sleep > 0) c.sleep--;
  if (checkWin(g)) return;
  startTurn(g, enemy(i));
}
function maybeEnd(g) { if (g.phase === 'battle' && !g.pending && g.ap === 0) endTurn(g); }
function removeDead(g, p, s) { const c = g.players[p].field[s]; if (c && c.hp <= 0) { g.players[p].field[s] = null; c.hp = 0; c.sleep = 0; g.players[p].discard.push(c); log(g, `${g.players[p].name}的${CARDS[c.type].name}退场。`); return true; } return false; }
function damage(g, item, interceptId) {
  let target = findField(g, item.target);
  if (!target) return;
  if (interceptId) { const penguin = findField(g, interceptId); if (!penguin || penguin.p !== target.p || penguin.c.type !== 'penguin' || penguin.c.sleep || penguin.c.id === target.c.id) fail('无法使用这张企鹅挡伤。'); target = penguin; log(g, `${g.players[target.p].name}的企鹅挡下攻击。`); }
  const source = findField(g, item.source);
  target.c.hp -= item.amount;
  log(g, `${CARDS[target.c.type].name}受到${item.amount}点伤害。`);
  const reflect = target.c.type === 'urchin' && source && source.p !== target.p && !item.reflection;
  const killed = removeDead(g, target.p, target.s);
  if (killed && item.sharkPrimary) g.pending.sharkKilled = true;
  if (reflect) { const s = findField(g, item.source); if (s) { s.c.hp--; log(g, `海胆反弹1点伤害给${CARDS[s.c.type].name}。`); removeDead(g, s.p, s.s); } }
}
function processQueue(g) {
  while (g.pending && g.pending.queue.length) {
    const item = g.pending.queue[0]; const target = findField(g, item.target);
    if (!target) { g.pending.queue.shift(); continue; }
    const source = findField(g, item.source);
    const eligible = source && source.p !== target.p && g.turn !== target.p && target.c.type !== 'penguin' && g.players[target.p].field.some(c => c?.type === 'penguin' && !c.sleep);
    if (eligible) { g.pending.respondTo = target.p; log(g, `${g.players[target.p].name}可选择企鹅挡伤。`); return; }
    g.pending.queue.shift(); damage(g, item);
  }
  if (g.pending?.shark && g.pending.sharkKilled && !g.pending.followupDone) {
    g.pending.followupDone = true;
    const a = findField(g, g.pending.shark);
    if (a) {
      const targets = g.players[enemy(a.p)].field.map((c,s) => c ? { p: enemy(a.p), s, c } : null).filter(t => t && canReach(a,t)).sort((x,y) => y.c.hp - x.c.hp || x.s - y.s);
      if (targets.length) { g.pending.queue.push({ source: a.c.id, target: targets[0].c.id, amount: 1 }); log(g, `鲨鱼追击生命最高的${CARDS[targets[0].c.type].name}。`); processQueue(g); return; }
    }
  }
  g.pending = null;
  if (!checkWin(g)) maybeEnd(g);
}
function hit(g, items, shark) { g.pending = { queue: items, respondTo: null, shark: shark || null, sharkKilled: false, followupDone: false }; processQueue(g); }
function place(g, i, id, slot, setup = false) {
  if (!Number.isInteger(slot) || slot < 0 || slot > 3 || fieldCard(g,i,slot)) fail('请选择自己的空格位。');
  const c = g.players[i].hand.find(x => x.id === id); if (!c || !unit(c)) fail('请选择非一次性手牌。');
  takeHand(g,i,id); c.hp = CARDS[c.type].hp; c.sleep = 0; g.players[i].field[slot] = c;
  if (setup) g.players[i].placed++;
  log(g, `${g.players[i].name}将${CARDS[c.type].name}放入场地。`);
}
export function act(g, i, a) {
  if (!g.players[i]) fail('玩家不存在。');
  if (!a || typeof a !== 'object') fail('动作无效。');
  const p = g.players[i], opp = g.players[enemy(i)];
  if (g.phase === 'rps') {
    if (a.type !== 'rps' || !['rock','paper','scissors'].includes(a.choice)) fail('请先出拳。');
    if (p.rps) fail('你已经出拳。');
    p.rps = a.choice; log(g, `${p.name}已出拳。`);
    if (g.players.every(x => x.rps)) {
      const [x,y] = g.players.map(x => x.rps); if (x === y) { g.players.forEach(x => x.rps = null); log(g, '平局，重新出拳。'); }
      else { const beats = { rock: 'scissors', scissors: 'paper', paper: 'rock' }; const w = beats[x] === y ? 0 : 1; g.first = w; g.setup = enemy(w); g.phase = 'setup'; log(g, `${g.players[w].name}猜拳获胜。${g.players[g.setup].name}先摆三张牌。`); }
    } return;
  }
  if (g.phase === 'setup') {
    if (i !== g.setup || a.type !== 'place') fail('等待当前玩家摆牌。');
    place(g, i, a.cardId, a.slot, true);
    if (p.placed === 3) { if (i === enemy(g.first)) { g.setup = g.first; log(g, `现在由${g.players[g.first].name}摆三张牌。`); } else { g.setup = null; startTurn(g, g.first); } }
    return;
  }
  if (g.pending) {
    if (a.type !== 'intercept' || i !== g.pending.respondTo) fail('等待防守方响应。');
    const item = g.pending.queue.shift();
    if (a.penguinId) damage(g, item, a.penguinId); else damage(g, item);
    g.pending.respondTo = null; processQueue(g); return;
  }
  ensureTurn(g, i);
  if (a.type === 'place') { place(g, i, a.cardId, a.slot); return; }
  if (a.type === 'pass') { endTurn(g, true); return; }
  if (a.type === 'attack') {
    const src = actor(g,i,a.actorId), tgt = findField(g,a.targetId);
    if (!tgt || tgt.p === i || tgt.c.sleep > 0 || !canReach(src,tgt)) fail('目标不在攻击范围内，或正在睡眠。');
    spend(g,i); log(g, `${p.name}的${CARDS[src.c.type].name}攻击${CARDS[tgt.c.type].name}。`); hit(g,[{source:src.c.id,target:tgt.c.id,amount:1}]); return;
  }
  if (a.type === 'skill') {
    const src = actor(g,i,a.actorId); const type = src.c.type;
    if (type === 'sloth') {
      const tgt = findField(g,a.targetId); if (!tgt || tgt.p === i) fail('请选择敌方场上牌。');
      spend(g,i); tgt.c.sleep = 2; log(g, `${p.name}的树懒使${CARDS[tgt.c.type].name}睡眠。`); maybeEnd(g); return;
    }
    if (type === 'shark') {
      if (![0,1].includes(a.row)) fail('请选择敌方一排。');
      const targets = opp.field.map((c,s) => c && Math.floor(s/2) === a.row ? {p:enemy(i),s,c} : null).filter(t => t && t.c.sleep === 0 && canReach(src,t));
      if (!targets.length) fail('这一排没有可攻击的目标。');
      spend(g,i); log(g, `${p.name}的鲨鱼冲击敌方${a.row === 0 ? '前' : '后'}排。`); hit(g,targets.map(t => ({source:src.c.id,target:t.c.id,amount:1,sharkPrimary:true})),src.c.id); return;
    }
    if (type === 'sunfish') {
      const tgt = findField(g,a.targetId); if (!tgt || tgt.p !== i || tgt.c.id === src.c.id || tgt.c.hp >= CARDS[tgt.c.type].hp) fail('请选择受伤的其他友方牌。');
      src.c.hp--; tgt.c.hp++; log(g, `${p.name}的翻车鱼为${CARDS[tgt.c.type].name}恢复1生命。`); removeDead(g,src.p,src.s); checkWin(g); return;
    }
    if (type === 'crab') {
      src.c.hp--; g.ap++; log(g, `${p.name}的螃蟹换得1点额外行动点。`); removeDead(g,src.p,src.s); checkWin(g); return;
    }
    fail('这张牌没有主动技能。');
  }
  if (a.type === 'once') {
    const c = p.hand.find(x => x.id === a.cardId); if (!c || !['sloth','starfish','seahorse'].includes(c.type)) fail('请选择一次性牌。');
    if (c.type === 'sloth') {
      if (![0,1].includes(a.row)) fail('请选择敌方一排。');
      const targets = opp.field.filter((x,s) => x && Math.floor(s/2) === a.row); if (!targets.length) fail('目标排没有牌。');
      takeHand(g,i,c.id); p.discard.push(c); targets.forEach(x => x.sleep = 2); log(g, `${p.name}打出一次性树懒，敌方一排睡眠。`);
    } else if (c.type === 'starfish') {
      const source = g.players.find(owner => owner.discard.some(x => x.id === a.discardId && unit(x)));
      const dc = source?.discard.find(x => x.id === a.discardId && unit(x)); if (!dc || !Number.isInteger(a.slot) || a.slot < 0 || a.slot > 3 || p.field[a.slot]) fail('请选择双方弃牌堆中的非一次性牌与自己的空格位。');
      takeHand(g,i,c.id); p.discard.push(c); source.discard.splice(source.discard.indexOf(dc),1); dc.hp = CARDS[dc.type].hp; dc.sleep = 0; p.field[a.slot] = dc; log(g, `${p.name}使用海星从${source === p ? '己方' : '对方'}弃牌堆复活${CARDS[dc.type].name}。`);
    } else {
      if (a.targetId) { const target = findField(g,a.targetId); if (!target || target.p !== enemy(i)) fail('请选择敌方场上牌。'); opp.field[target.s] = null; target.c.hp = undefined; target.c.sleep = 0; putBack(g,i,target.c); log(g, `${p.name}使用海马夺走敌方场上的${CARDS[target.c.type].name}。`); }
      else { if (!opp.hand.length) fail('敌方手牌为空。'); const ix = Math.floor(Math.random()*opp.hand.length); const stolen = opp.hand.splice(ix,1)[0]; putBack(g,i,stolen); log(g, `${p.name}使用海马盲抽了敌方一张手牌。`); }
      takeHand(g,i,c.id); p.discard.push(c);
    }
    checkWin(g); return;
  }
  fail('未知动作。');
}
export function view(g, i) {
  const safe = p => ({ name:p.name, field:p.field, discard:p.discard, handCount:p.hand.length, passes:p.passes, placed:p.placed, rpsReady:!!p.rps });
  const players = g.players.map(safe); players[i].hand = g.players[i].hand;
  return { code:g.code, phase:g.phase, players, you:i, turn:g.turn, first:g.first, setup:g.setup, ap:g.ap, round:g.round, pending:g.pending && { respondTo:g.pending.respondTo, target:g.pending.queue[0]?.target }, winner:g.winner, log:g.log, version:g.version, cards:CARDS };
}
