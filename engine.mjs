import { randomBytes } from 'node:crypto';

export const CARDS = {
  sloth: { name:'树懒', kind:'dual', hp:2, suit:'青', text:'攻击1。技能：使敌方一张牌睡眠，至施加者第二次回合开始。一次性：使敌方一排睡眠。' },
  starfish: { name:'海星', kind:'once', text:'从双方弃牌堆复活一张非一次性卡到己方指定空位。' },
  seahorse: { name:'海马', kind:'once', text:'夺取敌方场上一张牌，或盲抽敌方一张手牌。' },
  urchin: { name:'海胆', kind:'unit', hp:2, suit:'紫', text:'攻击1。受到伤害时，向伤害来源返还1点伤害。' },
  sunfish: { name:'翻车鱼', kind:'unit', hp:3, suit:'橙', text:'攻击1。消耗自身1生命，为其他友方牌恢复1生命；可以因此退场，不耗行动点。' },
  shark: { name:'鲨鱼', kind:'unit', hp:2, suit:'蓝', text:'攻击1。攻击敌方一排；若击杀，追击射程内生命最高的牌。' },
  crab: { name:'螃蟹', kind:'unit', hp:2, suit:'红', text:'攻击1。消耗自身1生命，本回合获得1行动点；可以因此退场，不耗行动点。' },
  penguin: { name:'企鹅', kind:'unit', hp:3, suit:'黑', text:'攻击1。对方回合中，可替另一张友方牌承受伤害；不耗行动点。' },
  kangaroo: { name:'袋鼠', kind:'unit', hp:2, suit:'棕', text:'攻击1。1点腾空，势能最多3层；1点落击造成1+势能伤害。受伤解除腾空并自动反击。' },
  elephant: { name:'大象', kind:'unit', hp:2, suit:'灰', text:'攻击1。1点压制敌牌并移至其上。受伤时被压牌受1伤，大象免费返回；主动返回耗1点。' },
  whale: { name:'鲸', kind:'unit', hp:2, suit:'靛', text:'攻击1。操控一张敌牌执行一次耗点行动，共耗1点。位置与射程不变，攻击可选双方其他牌。' },
};
export const CARD_TYPES = Object.keys(CARDS);
export const POOL_COUNTS = {starfish:2,seahorse:2,shark:3,kangaroo:3,crab:4,whale:4,urchin:4,elephant:4,sloth:5,penguin:5,sunfish:6};
export const POOL = Object.entries(POOL_COUNTS).flatMap(([type,count])=>Array(count).fill(type));
const uid = () => randomBytes(8).toString('hex');
const unit = c => CARDS[c.type].kind !== 'once';
const player = (name, deck) => ({name:String(name || '玩家').slice(0,16),hand:deck.map(type=>({id:uid(),type})),field:[null,null,null,null],discard:[],passes:0,rps:null,placed:0});
export function validDeck(deck) { return Array.isArray(deck) && deck.length===6 && deck.every(t=>CARD_TYPES.includes(t)) && deck.filter(t=>CARDS[t].kind!=='once').length>=3; }
function drawCards(pool=POOL) {
  if(!Array.isArray(pool)||pool.length<6||pool.some(t=>!CARD_TYPES.includes(t))||pool.filter(t=>CARDS[t].kind!=='once').length<3)throw Error('牌池配置无效。');
  const shuffled=[...pool];
  for(let k=shuffled.length-1;k>0;k--){const j=randomBytes(4).readUInt32BE()%(k+1);[shuffled[k],shuffled[j]]=[shuffled[j],shuffled[k]];}
  const hand=shuffled.slice(0,6);return validDeck(hand)?{hand,remaining:shuffled.slice(6)}:drawCards(pool);
}
export function drawHand(pool=POOL){return drawCards(pool).hand;}
export function createGame(name) { const deal=drawCards();return {code:randomBytes(3).toString('hex').toUpperCase(),phase:'waiting',players:[player(name,deal.hand)],deck:deal.remaining,covering:[],turn:null,first:null,setup:null,ap:0,round:0,pending:null,winner:null,log:['房间已创建，等待另一位玩家。'],version:1}; }
export function joinGame(g,name) { if(g.players.length!==1)fail('房间已满。');const deal=drawCards(g.deck);g.deck=deal.remaining;g.players.push(player(name,deal.hand));g.phase='rps';log(g,'两位玩家已就位，请各自出拳。');return g; }
function log(g,s){g.log.push(s);if(g.log.length>70)g.log.shift();g.version++;}
function fail(s){throw Error(s);}
const enemy=i=>1-i;
const fieldCard=(g,i,s)=>Number.isInteger(s)&&s>=0&&s<4?g.players[i].field[s]:null;
function findField(g,id,seen=new Set()){
  if(!id||seen.has(id))return null;seen.add(id);
  for(let p=0;p<2;p++)for(let s=0;s<4;s++)if(g.players[p].field[s]?.id===id)return {p,s,locationP:p,c:g.players[p].field[s],kind:'field'};
  const cover=g.covering.find(x=>x.c.id===id);
  if(cover){const base=findField(g,cover.targetId,seen);if(base)return {p:cover.p,s:base.s,locationP:base.locationP,c:cover.c,kind:'cover',cover};}
  const returning=g.pending?.returns?.find(x=>x.c.id===id);
  return returning?{...returning,kind:'return',returning}:null;
}
function allUnits(g){return [...g.players.flatMap(p=>p.field.filter(Boolean)),...g.covering.map(x=>x.c),...(g.pending?.returns||[]).map(x=>x.c)];}
function ownsUnit(g,p){return g.players[p].field.some(Boolean)||g.covering.some(x=>x.p===p)||(g.pending?.returns||[]).some(x=>x.p===p&&x.c.hp>0);}
function topCard(g,id){let c=findField(g,id);const seen=new Set();while(c?.c.suppressedBy&&!seen.has(c.c.id)){seen.add(c.c.id);const top=findField(g,c.c.suppressedBy);if(!top)break;c=top;}return c;}
const row=a=>a.locationP===0?(a.s<2?1:0):(a.s<2?2:3);
const canReach=(a,b)=>Math.abs(row(a)-row(b))<=2;
function takeHand(g,i,id){const ix=g.players[i].hand.findIndex(c=>c.id===id);if(ix<0)fail('手牌不存在。');return g.players[i].hand.splice(ix,1)[0];}
function clearStates(c){c.sleep=0;delete c.sleepUntil;delete c.airborne;delete c.gravity;delete c.suppressedBy;}
function sleep(g,c){if(c.suppressedBy)return;c.sleep=2;c.sleepUntil=g.round+4;}
function actor(g,i,id,controlled=false){const a=findField(g,id);if(!a||a.kind==='return'||(!controlled&&a.p!==i))fail('请选择可操作的场上牌。');if(a.c.sleep>0)fail('睡眠中的牌不能行动。');if(a.c.suppressedBy)fail('被压制的牌不能操作。');return a;}
function spend(g,i){if(g.ap<1)fail('行动点不足。');g.ap--;g.players[i].passes=0;}
function startTurn(g,i){
  g.phase='battle';g.turn=i;g.ap=1;g.round++;
  for(const c of allUnits(g))if(c.sleep>0&&c.sleepUntil!==undefined){c.sleep=Math.max(0,Math.ceil((c.sleepUntil-g.round)/2));if(g.round>=c.sleepUntil){c.sleep=0;delete c.sleepUntil;log(g,`${CARDS[c.type].name}从睡眠中醒来。`);}}
  for(const c of allUnits(g)){const a=findField(g,c.id);if(a?.p===i&&c.airborne&&!c.sleep&&!c.suppressedBy){c.gravity=Math.min(3,(c.gravity||0)+1);log(g,`袋鼠积累重力势能（${c.gravity}/3）。`);}}
  const p=g.players[i];
  if(!ownsUnit(g,i)){
    const canRevive=p.hand.some(c=>c.type==='starfish')&&g.players.some(x=>x.discard.some(unit));
    const canSteal=p.hand.some(c=>c.type==='seahorse')&&(ownsUnit(g,enemy(i))||g.players[enemy(i)].hand.some(unit));
    if(!p.hand.some(unit)&&!canRevive&&!canSteal){finish(g,enemy(i),`${p.name}已无牌可上场`);return;}
  }
  log(g,`第${g.round}回合 · ${p.name}行动（1点）`);
}
function finish(g,i,why){g.phase='ended';g.winner=i;g.pending=null;g.ap=0;log(g,`${why}，${g.players[i].name}获胜。`);}
function checkWin(g){for(let i=0;i<2;i++){const p=g.players[i];if(!ownsUnit(g,i)&&!p.hand.length){finish(g,enemy(i),`${p.name}的牌已全部耗尽`);return true;}}return false;}
function endTurn(g,passed=false){const i=g.turn,p=g.players[i];if(passed){p.passes++;log(g,`${p.name}放弃行动点（连续${p.passes}次）。`);if(p.passes>=2){finish(g,enemy(i),`${p.name}连续两回合弃权`);return;}}if(!checkWin(g))startTurn(g,enemy(i));}
function maybeEnd(g){if(g.phase==='battle'&&!g.pending&&g.ap===0)endTurn(g);}
function detachCover(g,cover){const target=findField(g,cover.targetId);if(target?.c.suppressedBy===cover.c.id)delete target.c.suppressedBy;g.covering.splice(g.covering.indexOf(cover),1);}
function releaseAbove(g,c){const above=g.covering.find(x=>x.targetId===c.id);if(!above)return;const loc=findField(g,above.c.id);detachCover(g,above);if(loc&&above.c.hp>0)g.pending.returns.push({p:above.p,c:above.c,s:loc.s,locationP:loc.locationP});}
function removeDead(g,a){
  if(!a||a.c.hp>0)return false;
  releaseAbove(g,a.c);
  if(a.kind==='field')g.players[a.p].field[a.s]=null;
  else if(a.kind==='cover')detachCover(g,a.cover);
  else g.pending.returns=g.pending.returns.filter(x=>x.c.id!==a.c.id);
  a.c.hp=0;clearStates(a.c);g.players[a.p].discard.push(a.c);log(g,`${g.players[a.p].name}的${CARDS[a.c.type].name}退场。`);return true;
}
function penguins(g,target){return g.players[target.p].field.filter(c=>c?.type==='penguin'&&!c.sleep&&!c.suppressedBy&&c.id!==target.c.id);}
function damageTarget(g,item){return item.direct?findField(g,item.target):topCard(g,item.target);}
function damage(g,item,interceptId){
  let target=damageTarget(g,item);if(!target)return;
  if(interceptId){const penguin=penguins(g,target).find(c=>c.id===interceptId);if(!penguin)fail('无法使用这张企鹅挡伤。');target=findField(g,penguin.id);log(g,`${g.players[target.p].name}的企鹅挡下攻击。`);}
  const source=findField(g,item.source),c=target.c;
  const counter=c.airborne?1+(c.gravity||0):0;
  if(counter){delete c.airborne;delete c.gravity;log(g,'袋鼠受伤，解除腾空并反击。');}
  const cover=target.kind==='cover'?target.cover:null;
  if(cover){detachCover(g,cover);target={p:target.p,s:target.s,locationP:target.locationP,c,kind:'return'};g.pending.returns.push({p:target.p,s:target.s,locationP:target.locationP,c});log(g,'大象受伤，解除压制并准备免费返回。');}
  c.hp-=item.amount;log(g,`${CARDS[c.type].name}受到${item.amount}点伤害。`);
  const killed=removeDead(g,target);if(killed&&item.sharkPrimary)g.pending.sharkKilled=true;
  // 被压牌的附加伤害来自大象；先结算，再让存活的大象选择返回位置。
  const follow=[];
  if(cover)follow.push({source:c.id,sourceP:target.p,target:cover.targetId,amount:1,direct:true,noIntercept:true});
  if(c.type==='urchin'&&source&&!item.reflection)follow.push({source:c.id,sourceP:target.p,target:source.c.id,amount:1,reflection:true,noIntercept:true,direct:true});
  if(counter&&source)follow.push({source:c.id,sourceP:target.p,target:source.c.id,amount:counter,direct:true});
  g.pending.queue.unshift(...follow);
}
function processQueue(g){
  g.pending.respondTo=null;g.pending.kind='damage';
  while(g.pending.queue.length){
    const item=g.pending.queue[0],target=damageTarget(g,item);
    if(!target){g.pending.queue.shift();continue;}
    if(!item.noIntercept&&g.turn!==target.p&&penguins(g,target).length){g.pending.respondTo=target.p;log(g,`${g.players[target.p].name}可选择企鹅挡伤。`);return;}
    g.pending.queue.shift();damage(g,item);
  }
  if(g.pending.shark&&g.pending.sharkKilled&&!g.pending.followupDone){
    g.pending.followupDone=true;const a=findField(g,g.pending.shark);
    if(a&&!a.c.sleep&&!a.c.suppressedBy){const targets=allUnits(g).map(c=>topCard(g,c.id)).filter((t,k,list)=>t&&t.kind!=='return'&&t.c.id!==a.c.id&&t.p===g.pending.sharkTargetPlayer&&!t.c.sleep&&canReach(a,t)&&list.findIndex(x=>x?.c.id===t.c.id)===k).sort((x,y)=>y.c.hp-x.c.hp||x.s-y.s);if(targets.length){g.pending.queue.push({source:a.c.id,sourceP:a.p,target:targets[0].c.id,amount:1});log(g,`鲨鱼追击生命最高的${CARDS[targets[0].c.type].name}。`);processQueue(g);return;}}
  }
  while(g.pending.returns.length){
    const ret=g.pending.returns[0];if(ret.c.hp<=0){g.pending.returns.shift();continue;}
    if(g.players[ret.p].field.every(Boolean)){log(g,'大象无空位可返回，判定死亡。');ret.c.hp=0;removeDead(g,{...ret,kind:'return'});continue;}
    g.pending.kind='return';g.pending.respondTo=ret.p;g.pending.returnCardId=ret.c.id;log(g,`${g.players[ret.p].name}请选择大象返回的空格。`);return;
  }
  g.pending=null;if(!checkWin(g))maybeEnd(g);
}
function hit(g,items,shark,sharkTargetPlayer){g.pending={kind:'damage',queue:items,returns:[],respondTo:null,shark:shark||null,sharkTargetPlayer,sharkKilled:false,followupDone:false};processQueue(g);}
function place(g,i,id,slot,setup=false){
  if(!Number.isInteger(slot)||slot<0||slot>3||fieldCard(g,i,slot))fail('请选择自己的空格位。');
  const c=g.players[i].hand.find(x=>x.id===id);if(!c||!unit(c))fail('请选择非一次性手牌。');
  takeHand(g,i,id);c.hp=CARDS[c.type].hp;clearStates(c);g.players[i].field[slot]=c;if(setup)g.players[i].placed++;log(g,`${g.players[i].name}将${CARDS[c.type].name}放入场地。`);
}
function applyMove(g,i,a,controlled=false,chain=[]){
  const p=g.players[i],src=actor(g,i,a.actorId,controlled),type=src.c.type;
  if(a.type==='control'){
    if(type!=='whale')fail('只有鲸可以操控。');
    const tgt=findField(g,a.targetId);
    if(!tgt||tgt.p===src.p||tgt.c.sleep||tgt.c.suppressedBy||chain.includes(tgt.c.id)||tgt.c.id===src.c.id)fail('请选择可操作的敌方牌，不能循环操控。');
    if(!a.action||!['attack','skill','control'].includes(a.action.type)||a.action.actorId!==tgt.c.id)fail('请选择被操控牌的一次耗点行动。');
    log(g,`${p.name}的鲸操控${CARDS[tgt.c.type].name}。`);applyMove(g,i,a.action,true,[...chain,src.c.id]);return;
  }
  if(a.type==='attack'){
    const tgt=topCard(g,a.targetId);
    if(!tgt||tgt.c.id===src.c.id||(!controlled&&tgt.p===src.p)||(tgt.kind==='cover'&&tgt.p===i)||tgt.c.sleep||!canReach(src,tgt))fail('目标不在攻击范围内、正在睡眠，或是己方压制中的大象。');
    spend(g,i);log(g,`${p.name}令${CARDS[type].name}攻击${CARDS[tgt.c.type].name}。`);hit(g,[{source:src.c.id,sourceP:src.p,target:tgt.c.id,amount:1}]);return;
  }
  if(a.type!=='skill')fail('未知行动。');
  if(controlled&&['sunfish','crab','urchin','penguin'].includes(type))fail('鲸只能操控会消耗行动点的行为。');
  if(type==='sloth'){
    const tgt=findField(g,a.targetId);if(!tgt||tgt.p===src.p||tgt.c.suppressedBy)fail('请选择未被压制的敌方场上牌。');
    spend(g,i);sleep(g,tgt.c);log(g,`${p.name}令树懒使${CARDS[tgt.c.type].name}睡眠。`);maybeEnd(g);return;
  }
  if(type==='shark'){
    if(![0,1].includes(a.row))fail('请选择敌方一排。');
    const targetPlayer=a.targetPlayer??(controlled?enemy(i):enemy(src.p));
    if(![0,1].includes(targetPlayer)||(!controlled&&targetPlayer!==enemy(src.p)))fail('请选择可攻击的目标阵营。');
    const targets=allUnits(g).map(c=>topCard(g,c.id)).filter((t,k,list)=>t&&t.kind!=='return'&&t.c.id!==src.c.id&&t.p===targetPlayer&&t.locationP===targetPlayer&&Math.floor(t.s/2)===a.row&&!t.c.sleep&&canReach(src,t)&&list.findIndex(x=>x?.c.id===t.c.id)===k);
    if(!targets.length)fail('这一排没有可攻击的目标。');spend(g,i);log(g,`${p.name}令鲨鱼冲击${g.players[targetPlayer].name}的${a.row===0?'前':'后'}排。`);hit(g,targets.map(t=>({source:src.c.id,sourceP:src.p,target:t.c.id,amount:1,sharkPrimary:true})),src.c.id,targetPlayer);return;
  }
  if(type==='sunfish'){
    const tgt=findField(g,a.targetId);if(!tgt||tgt.p!==src.p||tgt.c.id===src.c.id||tgt.c.hp>=CARDS[tgt.c.type].hp)fail('请选择受伤的其他友方牌。');
    src.c.hp--;tgt.c.hp++;log(g,`${p.name}的翻车鱼为${CARDS[tgt.c.type].name}恢复1生命。`);removeDead(g,src);checkWin(g);return;
  }
  if(type==='crab'){src.c.hp--;g.ap++;log(g,`${p.name}的螃蟹换得1点额外行动点。`);removeDead(g,src);checkWin(g);return;}
  if(type==='kangaroo'){
    if(src.c.airborne){const tgt=topCard(g,a.targetId);if(!tgt||tgt.c.id===src.c.id||(!controlled&&tgt.p===src.p)||(tgt.kind==='cover'&&tgt.p===i)||tgt.c.sleep||!canReach(src,tgt))fail('请选择射程内未睡眠的攻击目标；不能攻击己方压制中的大象。');const amount=1+(src.c.gravity||0);spend(g,i);delete src.c.airborne;delete src.c.gravity;log(g,`${p.name}令袋鼠落击，造成${amount}点伤害。`);hit(g,[{source:src.c.id,sourceP:src.p,target:tgt.c.id,amount}]);}
    else{spend(g,i);src.c.airborne=true;src.c.gravity=1;log(g,`${p.name}令袋鼠腾空（势能1/3）。`);maybeEnd(g);}return;
  }
  if(type==='elephant'){
    if(src.kind==='cover'){
      if(!Number.isInteger(a.slot)||a.slot<0||a.slot>3||g.players[src.p].field[a.slot])fail('请选择大象持有者半场的空格。');
      spend(g,i);detachCover(g,src.cover);g.players[src.p].field[a.slot]=src.c;log(g,'大象主动解除压制并返回场地（消耗1点）。');maybeEnd(g);return;
    }
    const tgt=topCard(g,a.targetId);if(!tgt||tgt.p===src.p||tgt.kind==='return')fail('大象只能压制敌方场上牌。');
    spend(g,i);clearStates(tgt.c);tgt.c.suppressedBy=src.c.id;g.players[src.p].field[src.s]=null;g.covering.push({p:src.p,c:src.c,targetId:tgt.c.id});log(g,`${p.name}令大象压制${CARDS[tgt.c.type].name}，清除其技能状态。`);maybeEnd(g);return;
  }
  if(type==='whale')fail('请先选择要操控的敌方牌及其行动。');
  fail('这张牌没有主动技能。');
}
function applyAction(g,i,a){
  if(!g.players[i])fail('玩家不存在。');if(!a||typeof a!=='object')fail('动作无效。');
  g.covering ||= [];const p=g.players[i],opp=g.players[enemy(i)];
  if(g.phase==='rps'){
    if(a.type!=='rps'||!['rock','paper','scissors'].includes(a.choice))fail('请先出拳。');if(p.rps)fail('你已经出拳。');p.rps=a.choice;log(g,`${p.name}已出拳。`);
    if(g.players.every(x=>x.rps)){const [x,y]=g.players.map(x=>x.rps);if(x===y){g.players.forEach(x=>x.rps=null);log(g,'平局，重新出拳。');}else{const beats={rock:'scissors',scissors:'paper',paper:'rock'},w=beats[x]===y?0:1;g.first=w;g.setup=enemy(w);g.phase='setup';log(g,`${g.players[w].name}猜拳获胜。${g.players[g.setup].name}先摆三张牌。`);}}return;
  }
  if(g.phase==='setup'){if(i!==g.setup||a.type!=='place')fail('等待当前玩家摆牌。');place(g,i,a.cardId,a.slot,true);if(p.placed===3){if(i===enemy(g.first)){g.setup=g.first;log(g,`现在由${g.players[g.first].name}摆三张牌。`);}else{g.setup=null;startTurn(g,g.first);}}return;}
  if(g.pending){
    if(i!==g.pending.respondTo)fail('等待指定玩家响应。');
    if(g.pending.kind==='return'){
      if(a.type!=='return'||!Number.isInteger(a.slot)||a.slot<0||a.slot>3||p.field[a.slot])fail('请选择自己的空格让大象返回。');
      const ret=g.pending.returns.shift();p.field[a.slot]=ret.c;delete g.pending.returnCardId;log(g,`${p.name}的大象免费返回${a.slot<2?'前':'后'}排。`);processQueue(g);return;
    }
    if(a.type!=='intercept')fail('等待防守方处理伤害。');const item=g.pending.queue.shift();damage(g,item,a.penguinId);processQueue(g);return;
  }
  if(g.phase!=='battle'||g.turn!==i)fail('还没轮到你。');
  if(a.type==='place'){place(g,i,a.cardId,a.slot);return;}
  if(a.type==='pass'){endTurn(g,true);return;}
  if(['attack','skill','control'].includes(a.type)){applyMove(g,i,a);return;}
  if(a.type==='once'){
    const c=p.hand.find(x=>x.id===a.cardId);if(!c||!['sloth','starfish','seahorse'].includes(c.type))fail('请选择一次性牌。');
    if(c.type==='sloth'){
      if(![0,1].includes(a.row))fail('请选择敌方一排。');const targets=allUnits(g).map(x=>findField(g,x.id)).filter(x=>x&&x.p===enemy(i)&&x.locationP===enemy(i)&&Math.floor(x.s/2)===a.row&&!x.c.suppressedBy);if(!targets.length)fail('目标排没有可施加睡眠的牌。');takeHand(g,i,c.id);p.discard.push(c);targets.forEach(x=>sleep(g,x.c));log(g,`${p.name}打出一次性树懒，敌方一排睡眠。`);
    }else if(c.type==='starfish'){
      const owner=g.players.find(x=>x.discard.some(d=>d.id===a.discardId&&unit(d))),dc=owner?.discard.find(x=>x.id===a.discardId&&unit(x));if(!dc||!Number.isInteger(a.slot)||a.slot<0||a.slot>3||p.field[a.slot])fail('请选择双方弃牌堆中的非一次性牌与自己的空格位。');takeHand(g,i,c.id);p.discard.push(c);owner.discard.splice(owner.discard.indexOf(dc),1);dc.hp=CARDS[dc.type].hp;clearStates(dc);p.field[a.slot]=dc;log(g,`${p.name}使用海星从${owner===p?'己方':'对方'}弃牌堆复活${CARDS[dc.type].name}。`);
    }else{
      if(a.targetId){const target=findField(g,a.targetId);if(!target||target.p!==enemy(i))fail('请选择敌方场上牌。');
        // 偷走压制者会立即释放被压牌；偷走被压牌则让其上方大象免费返回。
        g.pending={kind:'damage',queue:[],returns:[],respondTo:null};releaseAbove(g,target.c);
        if(target.kind==='cover')detachCover(g,target.cover);else opp.field[target.s]=null;
        target.c.hp=undefined;clearStates(target.c);p.hand.push(target.c);log(g,`${p.name}使用海马夺走${CARDS[target.c.type].name}。`);
      }else{if(!opp.hand.length)fail('敌方手牌为空。');p.hand.push(opp.hand.splice(Math.floor(Math.random()*opp.hand.length),1)[0]);log(g,`${p.name}使用海马盲抽了敌方一张手牌。`);}
      takeHand(g,i,c.id);p.discard.push(c);
    }
    if(g.pending)processQueue(g);else checkWin(g);return;
  }
  fail('未知动作。');
}
// 先在副本上完整校验，拒绝的请求不会留下扣点、出牌或待响应队列的半成品。
export function act(g,i,a){const next=structuredClone(g);applyAction(next,i,a);Object.assign(g,next);}
export function view(g,i){
  const safe=p=>({name:p.name,field:p.field,discard:p.discard,handCount:p.hand.length,passes:p.passes,placed:p.placed,rpsReady:!!p.rps});
  const players=g.players.map(safe);players[i].hand=g.players[i].hand;
  return {code:g.code,phase:g.phase,players,covering:g.covering||[],you:i,turn:g.turn,first:g.first,setup:g.setup,ap:g.ap,round:g.round,pending:g.pending&&{kind:g.pending.kind,respondTo:g.pending.respondTo,target:g.pending.queue[0]?.target,returnCardId:g.pending.returnCardId,returnCard:g.pending.returns[0]?.c},winner:g.winner,log:g.log,version:g.version,cards:CARDS};
}
