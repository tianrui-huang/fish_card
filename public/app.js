const app = document.querySelector('#app');
const roomChip = document.querySelector('#room-chip');
const connection = document.querySelector('#connection');
const toast = document.querySelector('#toast');
const sessionKey = 'tide-card-session';
const serverModeKey = 'tide-server-mode', serverUrlKey = 'tide-server-url';
let token = sessionStorage.getItem(sessionKey), state = null, intent = null, chosenHand = null, eventSource = null, toastTimer, fxTimer;
let serverMode = localStorage.getItem(serverModeKey) || 'current';
let customServerUrl = localStorage.getItem(serverUrlKey) || '';
let effects = { hit:new Map(), heal:new Set(), attack:new Set(), sleep:new Set(), dead:new Map(), targeting:new Set() };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cardData = type => state?.cards?.[type] || ({sloth:{name:'树懒',kind:'dual',hp:2,text:'使一张敌方牌睡眠；一次性可使一排睡眠。'},starfish:{name:'海星',kind:'once',text:'从双方弃牌堆复活一张牌。'},seahorse:{name:'海马',kind:'once',text:'夺取敌方牌，或盲抽一张手牌。'},urchin:{name:'海胆',kind:'unit',hp:2,text:'受伤时反弹1点伤害。'},sunfish:{name:'翻车鱼',kind:'unit',hp:3,text:'消耗1生命为友方牌恢复1生命，可因此退场。'},shark:{name:'鲨鱼',kind:'unit',hp:2,text:'攻击一排；击杀后追击。'},crab:{name:'螃蟹',kind:'unit',hp:2,text:'消耗1生命获得1行动点，可因此退场。'},penguin:{name:'企鹅',kind:'unit',hp:3,text:'对方回合替友方牌挡伤。'}})[type];
const art = type => {
  const shapes = {
    sloth:'<path d="M55 23h91M86 26q-2 18 13 21 12-3 9-19" fill="none" stroke="#6a5645" stroke-width="6" stroke-linecap="round"/><ellipse cx="101" cy="60" rx="24" ry="29" fill="#a47d57"/><circle cx="101" cy="40" r="20" fill="#b89468"/><ellipse cx="101" cy="43" rx="12" ry="10" fill="#efe3c9"/><circle cx="96" cy="42" r="2"/><circle cx="106" cy="42" r="2"/><path d="M97 48q4 4 8 0" fill="none" stroke="#654c3b" stroke-width="2"/>',
    starfish:'<path d="M101 20l13 26 29 3-21 19 6 29-27-15-27 15 6-29-21-19 29-3z" fill="#fa8771" stroke="#d35e61" stroke-width="4"/><circle cx="94" cy="57" r="2" fill="#823f54"/><circle cx="108" cy="57" r="2" fill="#823f54"/><path d="M96 65q5 5 10 0" fill="none" stroke="#823f54" stroke-width="2"/>',
    seahorse:'<path d="M120 28q-16-13-30 0-13 12-3 26 9 12 25 4 10-5 5-14-4-6-12-1" fill="none" stroke="#efc46c" stroke-width="12" stroke-linecap="round"/><path d="M116 30q20-3 24 11l-15 7" fill="#e5ac5f"/><circle cx="132" cy="34" r="2" fill="#173d4c"/><path d="M99 54q8 12 4 23-5 12 7 15 8 2 12-5" fill="none" stroke="#d78e56" stroke-width="8" stroke-linecap="round"/><path d="M94 38l-9-8m9 16l-12 0m17 14l-9 8" stroke="#f6db89" stroke-width="3"/>',
    urchin:'<g fill="#7e69a5" stroke="#594a83" stroke-width="3">'+Array.from({length:12},(_,i)=>`<path d="M101 54L${101+43*Math.cos(i*Math.PI/6)} ${54+43*Math.sin(i*Math.PI/6)}L${101+16*Math.cos(i*Math.PI/6+.2)} ${54+16*Math.sin(i*Math.PI/6+.2)}Z"/>`).join('')+'</g><circle cx="101" cy="54" r="22" fill="#967fb9"/><circle cx="94" cy="51" r="3" fill="#f7edca"/><circle cx="108" cy="51" r="3" fill="#f7edca"/><path d="M95 61q6 5 12 0" fill="none" stroke="#493f6d" stroke-width="2"/>',
    sunfish:'<ellipse cx="101" cy="56" rx="39" ry="29" fill="#efa566"/><path d="M65 56L44 40v32zm73 0l22-15v30z" fill="#d78060"/><path d="M90 28q12-11 23 0m-23 56q12 10 23 0" fill="#edbd73"/><circle cx="87" cy="51" r="3" fill="#173e4b"/><circle cx="115" cy="51" r="3" fill="#173e4b"/><path d="M94 64q7 5 14 0" fill="none" stroke="#9e5c53" stroke-width="2"/>',
    shark:'<path d="M43 60q26-27 74-19l29-21-3 28q20 10 25 20-24 23-63 17-39-2-62-25z" fill="#829ba3"/><path d="M92 43l19-29 11 31m-22 34l-8 20 30-20" fill="#617f89"/><circle cx="130" cy="56" r="3" fill="#132e3a"/><path d="M142 69l-12 2 9 5 10-4" fill="#f3eee0"/>',
    crab:'<ellipse cx="101" cy="59" rx="30" ry="24" fill="#e16d62"/><path d="M72 56L52 45 43 55l22 11m67-10l20-11 9 10-22 11M81 76l-12 13m27-10l-4 14m31-17l11 13m-25-11l4 14" fill="none" stroke="#c75354" stroke-width="7" stroke-linecap="round"/><path d="M70 47q-17-12-25 0m87 0q17-12 25 0" fill="none" stroke="#e7806a" stroke-width="9" stroke-linecap="round"/><circle cx="91" cy="54" r="3" fill="#fff4d4"/><circle cx="111" cy="54" r="3" fill="#fff4d4"/>',
    penguin:'<ellipse cx="101" cy="57" rx="31" ry="39" fill="#263d4c"/><ellipse cx="101" cy="64" rx="20" ry="28" fill="#f6efd9"/><circle cx="91" cy="43" r="3" fill="#fff"/><circle cx="111" cy="43" r="3" fill="#fff"/><circle cx="91" cy="43" r="1.6" fill="#142c39"/><circle cx="111" cy="43" r="1.6" fill="#142c39"/><path d="M96 51l5 6 5-6z" fill="#eda863"/><path d="M77 94l18 2-10 6m20-6l18-2-8 8" fill="#e8a75e"/>'
  };
  return `<svg viewBox="0 0 202 108" aria-hidden="true"><g fill="#e1fff2" opacity=".55"><circle cx="28" cy="28" r="3"/><circle cx="170" cy="72" r="4"/><circle cx="39" cy="85" r="2"/></g>${shapes[type] || ''}</svg>`;
};
function cardHTML(c, {hand=false, selected=false}={}) {
  const d=cardData(c.type), hp=d.hp && c.hp !== undefined ? `<span class="hp">♥ <strong>${c.hp}</strong>/${d.hp}</span>` : '<span class="hp">✦ 一次性</span>';
  const fx=[];if(effects.attack.has(c.id)){fx.push('fx-attack');const owner=state?.players?.findIndex(p=>p.field.some(x=>x?.id===c.id));fx.push(owner===state?.you?'fx-lunge-up':'fx-lunge-down');}if(effects.hit.has(c.id))fx.push('fx-hit');if(effects.heal.has(c.id))fx.push('fx-heal');if(effects.sleep.has(c.id))fx.push('fx-sleep');if(effects.targeting.has(c.id))fx.push('fx-target');
  const pop=effects.hit.has(c.id)?`<span class="combat-pop damage-pop">−${effects.hit.get(c.id)}</span>`:effects.heal.has(c.id)?'<span class="combat-pop heal-pop">+1</span>':'';
  return `<div class="card ${selected?'selected':''} ${c.sleep?'sleeping':''} ${fx.join(' ')}" data-card="${esc(c.id)}" data-owner="${hand?'hand':'field'}"><div class="card-inner"><div class="card-head"><strong>${esc(d.name)}</strong><span class="card-kind">${d.kind==='once'?'一次性':d.kind==='dual'?'两用':'角色'}</span></div><div class="card-art">${art(c.type)}</div><div class="card-info"><div class="card-text">${esc(d.text)}</div><div class="card-foot">${hp}<span>${esc(d.suit||'海域')}</span></div></div></div>${pop}${effects.sleep.has(c.id)?'<span class="sleep-burst">Zzz</span>':''}${c.sleep?'<span class="sleep-tag">☾ 睡眠</span>':''}</div>`;
}
async function post(url, body) {
  const r=await fetch(`${apiRoot()}${url}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); const data=await r.json();
  if(!r.ok) throw Error(data.error||'请求失败'); return data;
}
function notify(message) { toast.textContent=message; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>toast.classList.remove('show'),2700); }
function apiRoot(){
  if(serverMode==='current')return window.location.origin;
  const raw=customServerUrl.trim();
  if(!raw)throw Error('请填写服务端地址。');
  let url;try{url=new URL(raw);}catch{throw Error('请填写完整服务端网址，例如 https://game.example.com。');}
  if(!['http:','https:'].includes(url.protocol))throw Error('服务端地址需要使用 HTTP 或 HTTPS。');
  if(url.pathname!=='/'||url.search||url.hash)throw Error('服务端网址请填写域名或 IP 根地址，不要附加路径。');
  return url.origin.replace(/\/$/,'');
}
function saveServerSettings(){
  serverMode=document.querySelector('#server-mode')?.value||serverMode;
  const input=document.querySelector('#server-url');if(input)customServerUrl=input.value.trim();
  localStorage.setItem(serverModeKey,serverMode);localStorage.setItem(serverUrlKey,customServerUrl);
}
async function send(action) { try { await post('/api/action',{token,action}); intent=null; chosenHand=null; render(); } catch(e){notify(e.message);} }
function stopEvents(){ if(eventSource){eventSource.close();eventSource=null;} }
function applyState(next) {
  const prev=state;
  if(prev?.players?.length===2&&next?.players?.length===2&&next.version!==prev.version){
    const find=(source,id)=>{for(let p=0;p<2;p++)for(let s=0;s<4;s++)if(source.players[p].field[s]?.id===id)return {p,s,c:source.players[p].field[s]};return null;};
    const logs=next.log.slice(Math.max(0,next.log.length-(next.version-prev.version+3)));
    for(let p=0;p<2;p++)for(let s=0;s<4;s++){
      const old=prev.players[p].field[s];if(!old)continue;
      const now=find(next,old.id);
      if(now&&now.c.hp<old.hp)effects.hit.set(old.id,old.hp-now.c.hp);
      else if(now&&now.c.hp>old.hp)effects.heal.add(old.id);
      if(old.sleep===0&&now?.c.sleep>0)effects.sleep.add(old.id);
      if(!now){
        const inHand=next.players.some(player=>player.hand?.some(card=>card.id===old.id));
        const inDiscard=next.players.some(player=>player.discard.some(card=>card.id===old.id));
        if(inDiscard&&!inHand)effects.dead.set(`${p}:${s}`,cardData(old.type).name);
      }
      if(now&&p===prev.turn&&logs.some(line=>line.includes(`${prev.players[p].name}的${cardData(old.type).name}攻击`)||line.includes(`${prev.players[p].name}的${cardData(old.type).name}冲击`)||line.includes(`${prev.players[p].name}的${cardData(old.type).name}追击`)))effects.attack.add(old.id);
    }
    if(next.pending?.target)effects.targeting.add(next.pending.target);
    if(effects.hit.size||effects.heal.size||effects.sleep.size||effects.dead.size||effects.attack.size||effects.targeting.size){
      clearTimeout(fxTimer);fxTimer=setTimeout(()=>{effects={hit:new Map(),heal:new Set(),attack:new Set(),sleep:new Set(),dead:new Map(),targeting:new Set()};render();},950);
    }
  }
  state=next;render();
}
function connect(t) {
  token=t;sessionStorage.setItem(sessionKey,t);stopEvents();connection.textContent='正在连接';
  let base;try{base=apiRoot();}catch(e){notify(e.message);sessionStorage.removeItem(sessionKey);token=null;state=null;render();return;}
  fetch(`${base}/api/state?token=${encodeURIComponent(t)}`).then(async r=>{if(!r.ok)throw Error('房间已失效或服务端地址不可用。');applyState(await r.json());
    eventSource=new EventSource(`${base}/api/events?token=${encodeURIComponent(t)}`);
    eventSource.onopen=()=>connection.textContent='已连接';eventSource.onerror=()=>connection.textContent='重新连接中';
    eventSource.onmessage=e=>applyState(JSON.parse(e.data));
  }).catch(()=>{sessionStorage.removeItem(sessionKey);token=null;state=null;render();});
}
function lobby() {
  roomChip.textContent='';connection.textContent='本机运行';
  const custom=serverMode==='custom';
  app.innerHTML=`<section class="lobby"><div class="hero"><div class="hero-eyebrow">TWO PLAYER CARD BATTLE</div><h1>海底见，<br><span>手底见真章。</span></h1><p>把熟悉的海洋生物卡牌搬上桌。排兵布阵、交换生命、抓住对手的空档——潮汐正在改变。</p><div class="hero-art"><span class="bubble"></span><span class="bubble"></span><span class="bubble"></span><div class="float-card">${art('penguin')}</div><div class="float-card">${art('shark')}</div></div></div><div class="lobby-panel"><h2>开始对局</h2><p>两位玩家选择同一台游戏服务端，再通过房间号会合。</p><label class="field-label" for="server-mode">连接到</label><select id="server-mode" class="text-input"><option value="current" ${!custom?'selected':''}>当前页面的服务端</option><option value="custom" ${custom?'selected':''}>自定义公网服务端</option></select><div id="server-address-wrap" ${custom?'':'hidden'}><label class="field-label" for="server-url">服务端网址</label><input id="server-url" class="text-input" type="url" placeholder="https://game.example.com" value="${esc(customServerUrl)}"><p class="server-hint">填写完整网址，公网地址建议使用 HTTPS。</p></div><label class="field-label" for="name">你的名字</label><input id="name" class="text-input" maxlength="16" placeholder="输入昵称" value="玩家"><button id="create" class="primary full" style="margin-top:15px">创建新房间</button><div class="divider">或者加入朋友的房间</div><div class="join-row"><input id="code" class="text-input" maxlength="6" placeholder="六位房间号"><button id="join" class="secondary">加入房间</button></div><p class="lobby-note">牌池目前包含八种已知卡各一张；卡牌数量和后续规则可继续调整。</p></div></section>`;
}
const me=()=>state.players[state.you], foe=()=>state.players[1-state.you];
function isMyTurn(){return state.phase==='battle'&&state.turn===state.you&&!state.pending;}
function selectedCard(id){return me().hand?.find(x=>x.id===id);}
function setupScreen(){
  const mine=state.setup===state.you;
  const rows=(owner,side)=>[0,1].map(r=>{const localRow=side==='enemy'?1-r:r;return `<div class="row"><span class="row-label">${localRow?'后排':'前排'}</span>${[0,1].map(col=>{const s=localRow*2+col,c=owner.field[s];return `<div class="slot ${!c&&side==='mine'&&mine&&chosenHand?'selectable':''}" data-slot="${s}" data-side="${side}">${c?cardHTML(c):'·'}</div>`}).join('')}</div>`}).join('');
  app.innerHTML=`<section class="center-state"><div class="hero-eyebrow">OPENING FORMATION</div><h2>${mine?'摆出你的三张牌':'等待对手摆牌'}</h2><p>${mine?'点击手牌，再点击自己的空格放置。':'对手正在选择阵容；你可以观察对方已经摆出的牌。'}</p><div class="battlefield"><div class="zone-title">${esc(foe().name)} · 对手半场</div>${rows(foe(),'enemy')}<div class="middle-line">潮 汐 分 界</div>${rows(me(),'mine')}<div class="zone-title">你的半场</div></div><div class="hand-cards"><div class="hand-track">${me().hand.map(c=>cardHTML(c,{hand:true,selected:chosenHand===c.id})).join('')}</div></div><p class="muted">已放置 ${me().placed}/3</p></section>`;
  wire();
}
function rpsScreen(){
  const waiting=me().rpsReady;
  app.innerHTML=`<section class="center-state"><div class="hero-eyebrow">WHO GOES FIRST?</div><h2>${waiting?'等对手出拳':'猜拳决定先后手'}</h2><p>${waiting?'你已经出拳，等另一位玩家。':'输家先摆三张牌，赢家后摆并先行动。'}${!waiting?'你也可以浏览一下手牌：':''}</p>${!waiting?`<div class="rps-row"><button class="secondary" data-rps="rock">✊ 石头</button><button class="secondary" data-rps="paper">✋ 布</button><button class="secondary" data-rps="scissors">✌ 剪刀</button></div>`:''}<p class="muted">${me().hand.map(c=>esc(cardData(c.type).name)).join('　·　')}</p></section>`;
  wire();
}
function intentText(){
  const i=intent;if(!i)return {title:'选择行动',body:isMyTurn()?'点击场上己方牌发动技能，或选择手牌。':'等待行动或查看战况。'};
  const map={place:['选择空格','点击自己半场的空格上场。'],attack:['选择攻击目标','点击射程内的敌方场上牌。'],sloth:['选择目标','点击一张敌方场上牌使其睡眠。'],shark:['选择一排','鲨鱼会攻击该排所有可攻击的牌。'],starDiscard:['选择复活牌','点击己方或对方弃牌堆中的一张非一次性牌。'],starSlot:['选择复活位置','点击自己的空格。'],seahorse:['选择夺取方式','选择一张敌方场上牌，或盲抽手牌。'],sunfish:['选择治疗目标','点击一张受伤的其他友方牌。'],onceSloth:['选择目标排','敌方该排的所有牌进入睡眠。']};return {title:map[i.kind]?.[0]||'选择目标',body:map[i.kind]?.[1]||''};
}
function actionPanel(){
  const p=me(),selected=p.field.flat().find(c=>c?.id===intent?.actorId), text=intentText();
  let h=selectedCard(chosenHand);if(intent&&intent.kind!=='actor')h=null;
  if(state.pending?.respondTo===state.you){const penguins=p.field.filter(c=>c?.type==='penguin'&&!c.sleep);return `<h3 class="choice-title">企鹅挡伤</h3><p>选择一只企鹅替目标承受伤害，或让攻击落下。</p>${penguins.map(c=>`<button class="option" data-intercept="${c.id}">🐧 ${esc(cardData(c.type).name)}挡伤</button>`).join('')}<button class="secondary full" data-intercept="">放行</button>`;}
  if(state.pending)return '<h3 class="choice-title">伤害结算中</h3><p>等待防守方作出响应。</p>';
  if(state.phase==='rps')return '<h3 class="choice-title">猜拳</h3><p>用猜拳决定开局顺序。</p>';
  if(state.phase==='setup')return `<h3 class="choice-title">${state.setup===state.you?'开局布阵':'等待对手'}</h3><p>各自上场三张牌。摆牌不消耗行动点。</p>`;
  if(state.phase==='ended')return `<h3 class="choice-title">${state.winner===state.you?'对局胜利':'对局结束'}</h3><p>${esc(state.players[state.winner]?.name)}获胜。</p>`;
  if(h){
    const d=cardData(h.type);let b=`<h3 class="choice-title">${esc(d.name)}</h3><p>${esc(d.text)}</p>`;
    if(d.kind!=='once')b+='<button class="option" data-choice="place">放到场上</button>';
    if(h.type==='sloth')b+='<button class="option" data-choice="onceSloth">作为一次性使用 · 敌方一排睡眠</button>';
    if(h.type==='starfish'){const available=[...p.discard,...foe().discard].some(c=>cardData(c.type).kind!=='once');b+=`<button class="option" data-choice="starDiscard" ${available?'':'disabled'}>使用海星 · 复活弃牌</button>`;if(!available)b+='<p>双方弃牌堆里还没有可复活的牌。</p>';}
    if(h.type==='seahorse')b+='<button class="option" data-choice="seahorse">使用海马 · 夺取场上牌</button><button class="option" data-choice="seahorseBlind">使用海马 · 盲抽手牌</button>';
    if(d.kind==='unit')b='<h3 class="choice-title">'+esc(d.name)+'</h3><p>'+esc(d.text)+'</p><button class="option" data-choice="place">放到场上</button>';
    return b;
  }
  if(intent?.kind==='starDiscard'){
    const pile=(owner,label)=>`<div class="revive-group"><strong>${label}</strong>${owner.discard.filter(c=>cardData(c.type).kind!=='once').map(c=>`<button class="option" data-discard="${esc(c.id)}">${esc(cardData(c.type).name)}</button>`).join('')||'<p>没有可复活的牌</p>'}</div>`;
    return `<h3 class="choice-title">选择复活牌</h3><p>从任意一方的弃牌堆选择一张牌。</p>${pile(p,'己方弃牌堆')}${pile(foe(),'对方弃牌堆')}<button class="ghost small" data-choice="cancel">取消</button>`;
  }
  if(intent&&intent.kind!=='actor')return `<h3 class="choice-title">${esc(text.title)}</h3><p>${esc(text.body)}</p><button class="ghost small" data-choice="cancel">取消</button>${intent.kind==='shark'?'<button class="option" data-row="0">攻击敌方前排</button><button class="option" data-row="1">攻击敌方后排</button>':''}${intent.kind==='seahorse'?'<button class="option" data-blind="1">盲抽一张敌方手牌</button>':''}${intent.kind==='onceSloth'?'<button class="option" data-row="0">使敌方前排睡眠</button><button class="option" data-row="1">使敌方后排睡眠</button>':''}`;
  if(selected){let buttons=`<h3 class="choice-title">${esc(cardData(selected.type).name)} · ${selected.hp} HP</h3><button class="option" data-choice="attack">普通攻击 · 消耗1行动点</button>`;
    if(selected.type==='sloth')buttons+='<button class="option" data-choice="sloth">技能：使敌方牌睡眠 · 消耗1点</button>';
    if(selected.type==='shark')buttons+='<button class="option" data-choice="shark">技能：攻击敌方一排 · 消耗1点</button>';
    if(selected.type==='sunfish')buttons+='<button class="option" data-choice="sunfish">技能：治疗友方 · 免费</button>';
    if(selected.type==='crab')buttons+='<button class="option" data-choice="crab">技能：换取行动点 · 免费</button>';
    buttons+='<p>海胆被动自动触发。企鹅在对方回合自动提供挡伤选项。</p>';return buttons;
  }
  return `<h3 class="choice-title">${esc(text.title)}</h3><p>${esc(text.body)}</p>${isMyTurn()?`<p>点击手牌或场上己方牌继续。</p>`:''}`;
}
function resultOverlay(){
  const won=state.winner===state.you;
  const sparks=won?Array.from({length:22},(_,i)=>`<i style="left:${4+(i*37)%92}%;--drift:${(i%2?1:-1)*(28+i*5)}px;animation-delay:${(i%6)*.09}s"></i>`).join(''):'';
  return `<div class="result-overlay ${won?'victory':'defeat'}" role="dialog" aria-modal="true" aria-label="${won?'对局胜利':'对局结束'}"><div class="result-sparks" aria-hidden="true">${sparks}</div><section class="result-card"><div class="result-emblem" aria-hidden="true">${won?'✦':'◈'}</div><div class="result-kicker">${won?'VICTORY':'GAME OVER'}</div><h1>${won?'胜利！':'对局结束'}</h1><p>${won?'你赢得了这场海洋对决。':`${esc(state.players[state.winner]?.name)}赢得了这场对局。`}</p><button class="primary" data-leave>返回大厅</button></section></div>`;
}
function battleScreen(){
  const p=me(),o=foe(), mineTurn=isMyTurn();
  const cardRows=(owner,side)=>[0,1].map(r=>{const localRow=side==='enemy'?1-r:r;const ownerIndex=side==='enemy'?1-state.you:state.you;return `<div class="row"><span class="row-label">${localRow?'后排':'前排'}</span>${[0,1].map(col=>{const s=localRow*2+col,c=owner.field[s],death=effects.dead.get(`${ownerIndex}:${s}`);let selectable=false;if(!c&&side==='mine'&&mineTurn&&(chosenHand||intent?.kind==='place'||intent?.kind==='starSlot'))selectable=true;if(c&&intent?.kind==='attack'&&side==='enemy'&&c.sleep===0)selectable=true;if(c&&intent?.kind==='sloth'&&side==='enemy')selectable=true;if(c&&intent?.kind==='sunfish'&&side==='mine')selectable=true;if(c&&intent?.kind==='seahorse'&&side==='enemy')selectable=true;return `<div class="slot ${!c?'empty':''} ${selectable?'selectable':''}" data-slot="${s}" data-side="${side}">${c?cardHTML(c,{selected:intent?.actorId===c.id}):death?`<span class="slot-death"><b>✦</b><small>${esc(death)}退场</small></span>`:selectable?'＋':'·'}</div>`}).join('')}</div>`}).join('');
  app.innerHTML=`<div class="game-layout"><section class="arena"><div class="player-strip"><div><strong>${esc(o.name)}</strong> <span>对手 · ${o.handCount} 张手牌</span></div><div>${state.turn===1-state.you?'<span class="turn-badge">对手行动</span>':''}<div class="back-row">${Array.from({length:Math.min(o.handCount,8)},()=>'<i class="mini-back">✦</i>').join('')}</div></div></div><div class="battlefield"><div class="zone-title">${esc(o.name)} · 敌方半场</div>${cardRows(o,'enemy')}<div class="middle-line">潮 汐 分 界</div>${cardRows(p,'mine')}<div class="zone-title">你的半场</div></div><div class="hand-area"><div class="hand-heading"><strong>你的手牌</strong><span>${p.hand.length} 张 · ${mineTurn?`行动点 ${state.ap}`:'等待中'}</span></div><div class="hand-cards"><div class="hand-track">${p.hand.map(c=>cardHTML(c,{hand:true,selected:chosenHand===c.id})).join('')}</div></div></div><div class="player-strip" style="margin-top:12px"><strong>你的弃牌堆 <span>(${p.discard.length})</span></strong><span>${p.discard.length?p.discard.map(c=>`<button class="ghost small" data-discard="${esc(c.id)}">${esc(cardData(c.type).name)}</button>`).join(' '):'暂无弃牌'}</span></div></section><aside class="side-panel"><h2>对局状态</h2><p class="phase-text">${state.pending?.respondTo===state.you?'你的企鹅可以拦截这次伤害。':mineTurn?'轮到你行动。场地至少保留一张己方牌。':`等待${esc(o.name)}行动。`}</p><div class="stat-line"><div class="stat"><strong>${state.ap}</strong><span>行动点</span></div><div class="stat"><strong>${state.round}</strong><span>当前回合</span></div><div class="stat"><strong>${p.passes}</strong><span>连续弃权</span></div></div><div class="action-panel">${actionPanel()}</div><button class="secondary full pass-button" data-pass="1" ${!mineTurn?'disabled':''}>放弃行动点 · 结束回合</button><h2 class="log-title">战况记录</h2><div class="log">${[...state.log].reverse().map(x=>`<div class="log-entry">${esc(x)}</div>`).join('')}</div></aside></div>`;
  app.querySelector('.arena > .player-strip').insertAdjacentHTML('afterend',`<div class="opponent-discard"><strong>对手弃牌堆 <span>(${o.discard.length})</span></strong><div>${o.discard.length?o.discard.map(c=>`<button class="ghost small" data-discard="${esc(c.id)}">${esc(cardData(c.type).name)}</button>`).join(' '):'<span>暂无弃牌</span>'}</div></div>`);
  if(state.phase==='ended'){app.querySelector('.game-layout').inert=true;app.insertAdjacentHTML('beforeend',resultOverlay());}
  wire();
}
function restoreHandScroll(position){const hand=app.querySelector('.hand-cards');if(hand)hand.scrollLeft=position;}
function render(){
  const handScroll=app.querySelector('.hand-cards')?.scrollLeft ?? 0;
  if(!state){lobby();return;} roomChip.innerHTML=`房间 <strong>${esc(state.code)}</strong>`;
  if(state.phase==='waiting'){let address='';try{address=apiRoot();}catch{}app.innerHTML=`<section class="center-state"><div class="hero-eyebrow">ROOM ${esc(state.code)}</div><h2>房间已创建</h2><p>把下面的服务端地址和房间号发给朋友，对方选择同一服务端后即可加入。</p><p class="server-address">服务端：<strong>${esc(address)}</strong></p><button id="copy" class="primary">复制联机信息</button><p class="muted">你的手牌：${me().hand.map(c=>esc(cardData(c.type).name)).join(' · ')}</p></section>`;document.querySelector('#copy').onclick=()=>navigator.clipboard?.writeText(`服务端：${address}\n房间号：${state.code}`).then(()=>notify('服务端地址和房间号已复制')).catch(()=>notify(`服务端：${address}　房间号：${state.code}`));return;}
  if(state.phase==='setup'){setupScreen();restoreHandScroll(handScroll);return;}if(state.phase==='rps'){rpsScreen();return;}battleScreen();restoreHandScroll(handScroll);
}
function chooseCard(id,owner){
  if(owner==='hand'){
    if(state.phase==='setup'&&state.setup===state.you){chosenHand=id;intent={kind:'place'};render();return;}
    if(!isMyTurn())return;chosenHand=id;intent=null;render();return;
  }
  if(owner==='field'){
    const c=me().field.find(x=>x?.id===id);if(!c)return;
    if(intent?.kind==='attack'){void send({type:'attack',actorId:intent.actorId,targetId:id});return;}
    if(intent?.kind==='sloth'){void send({type:'skill',actorId:intent.actorId,targetId:id});return;}
    if(intent?.kind==='sunfish'){void send({type:'skill',actorId:intent.actorId,targetId:id});return;}
    if(!isMyTurn()||c.sleep)return;chosenHand=null;intent={kind:'actor',actorId:id};render();
  }
}
function handleSlot(el){
  const slot=Number(el.dataset.slot), side=el.dataset.side, cardEl=el.querySelector('[data-card]');
  if(cardEl){chooseCard(cardEl.dataset.card,side==='mine'?'field':'enemy');
    if(intent?.kind==='seahorse'&&side==='enemy'){void send({type:'once',cardId:chosenHand,targetId:cardEl.dataset.card});}return;}
  if(side!=='mine'||!isMyTurn()&&state.phase!=='setup')return;
  if(intent?.kind==='starSlot'){void send({type:'once',cardId:chosenHand,discardId:intent.discardId,slot});return;}
  if(chosenHand&&(['place','actor'].includes(intent?.kind)||state.phase==='setup')){void send({type:'place',cardId:chosenHand,slot});return;}
}
function leaveGame(){
  stopEvents();clearTimeout(fxTimer);sessionStorage.removeItem(sessionKey);
  token=null;state=null;intent=null;chosenHand=null;
  effects={hit:new Map(),heal:new Set(),attack:new Set(),sleep:new Set(),dead:new Map(),targeting:new Set()};
  render();
}
function wire(){
  app.querySelectorAll('[data-card]').forEach(el=>el.onclick=e=>{e.stopPropagation();const owner=el.dataset.owner==='hand'?'hand':'field';if(owner==='field'&&el.closest('.slot')?.dataset.side==='enemy'){if(intent?.kind==='seahorse'){void send({type:'once',cardId:chosenHand,targetId:el.dataset.card});return;}if(intent?.kind==='attack'||intent?.kind==='sloth'){void send(intent.kind==='attack'?{type:'attack',actorId:intent.actorId,targetId:el.dataset.card}:{type:'skill',actorId:intent.actorId,targetId:el.dataset.card});return;}}chooseCard(el.dataset.card,owner);});
  app.querySelectorAll('.slot').forEach(el=>el.onclick=()=>handleSlot(el));
  app.querySelectorAll('[data-rps]').forEach(b=>b.onclick=()=>void send({type:'rps',choice:b.dataset.rps}));
  const pass=app.querySelector('[data-pass]');if(pass)pass.onclick=()=>{intent=null;chosenHand=null;void send({type:'pass'});};
  app.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>{const c=b.dataset.choice;
    if(c==='cancel'){intent=null;chosenHand=null;render();return;}
    if(c==='place'){intent={kind:'place'};render();return;}
    if(c==='attack'){intent={kind:'attack',actorId:intent?.actorId||app.querySelector('.card.selected')?.dataset.card};render();return;}
    if(['sloth','shark','sunfish','crab'].includes(c)){const actorId=app.querySelector('.card.selected')?.dataset.card; if(c==='crab'){void send({type:'skill',actorId});return;}intent={kind:c,actorId};if(c==='sunfish'){}render();return;}
    if(c==='starDiscard'){intent={kind:'starDiscard'};render();return;}
    if(c==='seahorse'){intent={kind:'seahorse'};render();return;}
    if(c==='seahorseBlind'){void send({type:'once',cardId:chosenHand});return;}
    if(c==='onceSloth'){intent={kind:'onceSloth'};render();return;}
  });
  app.querySelectorAll('[data-row]').forEach(b=>b.onclick=()=>{const row=Number(b.dataset.row);if(intent?.kind==='shark')void send({type:'skill',actorId:intent.actorId,row});else if(intent?.kind==='onceSloth')void send({type:'once',cardId:chosenHand,row});});
  app.querySelectorAll('[data-intercept]').forEach(b=>b.onclick=()=>void send({type:'intercept',penguinId:b.dataset.intercept||null}));
  app.querySelectorAll('[data-blind]').forEach(b=>b.onclick=()=>void send({type:'once',cardId:chosenHand}));
  app.querySelectorAll('[data-discard]').forEach(b=>{const card=[...me().discard,...foe().discard].find(c=>c.id===b.dataset.discard);b.disabled=intent?.kind!=='starDiscard'||!card||cardData(card.type).kind==='once';b.onclick=()=>{intent={kind:'starSlot',discardId:b.dataset.discard};render();};});
  app.querySelectorAll('[data-leave]').forEach(b=>b.onclick=leaveGame);
}
document.querySelector('#rules-button').onclick=()=>document.querySelector('#rules').showModal();
document.querySelector('#rules form').onsubmit=e=>{e.preventDefault();document.querySelector('#rules').close();};
app.addEventListener('click',async e=>{
  if(e.target.closest('#create')){try{saveServerSettings();const r=await post('/api/create',{name:document.querySelector('#name').value});connect(r.token);}catch(err){notify(err.message);}return;}
  if(e.target.closest('#join')){try{saveServerSettings();const r=await post('/api/join',{name:document.querySelector('#name').value,code:document.querySelector('#code').value});connect(r.token);}catch(err){notify(err.message);}}
});
app.addEventListener('change',e=>{
  if(e.target.id==='server-mode'){serverMode=e.target.value;localStorage.setItem(serverModeKey,serverMode);render();}
  if(e.target.id==='server-url'){customServerUrl=e.target.value.trim();localStorage.setItem(serverUrlKey,customServerUrl);}
});
if(token)connect(token);else lobby();
