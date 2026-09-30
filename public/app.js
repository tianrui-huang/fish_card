const app = document.querySelector('#app');
const roomChip = document.querySelector('#room-chip');
const connection = document.querySelector('#connection');
const toast = document.querySelector('#toast');
const sessionKey = 'tide-card-session';
const serverModeKey = 'tide-server-mode', serverUrlKey = 'tide-server-url';
let token = sessionStorage.getItem(sessionKey), state = null, intent = null, chosenHand = null, eventSource = null, toastTimer, fxTimer;
const activeKey = 'tide-card-active-room', keptKey = 'tide-card-kept-rooms';
function stored(key, fallback) { try { return JSON.parse(sessionStorage.getItem(key)) || fallback; } catch { return fallback; } }
let activeRoom = stored(activeKey, null), keptRooms = stored(keptKey, []);
if (!Array.isArray(keptRooms)) keptRooms = [];
let connectionEpoch = 0, lobbyBusy = false, leaveBusy = false, menuRoom = null, leavingToken = null;
const roomMenu = document.querySelector('#room-menu'), roomMenuButton = document.querySelector('#room-menu-button');
let serverMode = localStorage.getItem(serverModeKey) || 'current';
let customServerUrl = localStorage.getItem(serverUrlKey) || '';
let effects = { hit:new Map(), heal:new Set(), attack:new Set(), sleep:new Set(), dead:new Map(), targeting:new Set() };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cardData = type => state?.cards?.[type] || ({kangaroo:{name:'袋鼠',kind:'unit',hp:2,text:'腾空积累势能；落击或受伤反击。'},elephant:{name:'大象',kind:'unit',hp:2,text:'压制敌方牌；受击免费返回，主动返回耗1点。'},whale:{name:'鲸',kind:'unit',hp:2,text:'操控敌方牌执行一次耗点行动，共耗1点。'},sloth:{name:'树懒',kind:'dual',hp:2,text:'使一张敌方牌睡眠；一次性可使一排睡眠。'},starfish:{name:'海星',kind:'once',text:'从双方弃牌堆复活一张牌。'},seahorse:{name:'海马',kind:'once',text:'夺取敌方牌，或盲抽一张手牌。'},urchin:{name:'海胆',kind:'unit',hp:2,text:'受伤时反弹1点伤害。'},sunfish:{name:'翻车鱼',kind:'unit',hp:3,text:'消耗1生命为友方牌恢复1生命，可因此退场。'},shark:{name:'鲨鱼',kind:'unit',hp:2,text:'攻击一排；击杀后追击。'},crab:{name:'螃蟹',kind:'unit',hp:2,text:'消耗1生命获得1行动点，可因此退场。'},penguin:{name:'企鹅',kind:'unit',hp:3,text:'对方回合替友方牌挡伤。'}})[type];
const art = type => {
  const shapes = {
    kangaroo:'<path d="M82 40L77 15q10-8 14 24m18 2l8-26q12 0 2 31" fill="#cc9567" stroke="#956343" stroke-width="4"/><ellipse cx="100" cy="54" rx="24" ry="22" fill="#dcaa7a"/><ellipse cx="104" cy="78" rx="28" ry="25" fill="#b88155"/><ellipse cx="103" cy="82" rx="17" ry="14" fill="#eed2a2"/><path d="M78 73Q40 75 45 99L81 89m39-3l25 14m-53-5l-11 7" fill="none" stroke="#ad744f" stroke-width="9" stroke-linecap="round"/><circle cx="94" cy="48" r="3" fill="#233d48"/><circle cx="111" cy="48" r="3" fill="#233d48"/><path d="M100 55l5 4 5-4" fill="#835747"/>',
    elephant:'<ellipse cx="102" cy="63" rx="42" ry="30" fill="#8da8af"/><ellipse cx="78" cy="49" rx="24" ry="27" fill="#aec3c5"/><ellipse cx="131" cy="49" rx="24" ry="27" fill="#aec3c5"/><ellipse cx="105" cy="48" rx="27" ry="29" fill="#9cb6ba"/><path d="M105 61v25q0 19 17 12" fill="none" stroke="#9cb6ba" stroke-width="13" stroke-linecap="round"/><path d="M83 76l-5 21m52-21l5 21" stroke="#78969f" stroke-width="13" stroke-linecap="round"/><path d="M86 65l-8 12m46-12l8 12" stroke="#fff0ce" stroke-width="5" stroke-linecap="round"/><circle cx="93" cy="47" r="3" fill="#23404a"/><circle cx="118" cy="47" r="3" fill="#23404a"/>',
    whale:'<path d="M46 52q15-32 69-18 23 6 31 29l19-17 13 12-28 25q-31 23-73 5Q44 81 46 52z" fill="#638cba"/><path d="M51 70q33 23 81 3-18 26-48 17z" fill="#c6e5ec"/><path d="M99 72l-13 29 33-24" fill="#4b719e"/><circle cx="68" cy="53" r="3" fill="#122e46"/><path d="M53 66q11 8 22 1M79 30V17m-1 7l-8-10m10 8l10-9" fill="none" stroke="#c4f3f1" stroke-width="3" stroke-linecap="round"/>',
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
  const d=cardData(c.type), hp=d.hp ? `<span class="hp">♥ <strong>${c.hp ?? d.hp}</strong>/${d.hp}</span>` : '<span class="hp">✦ 一次性</span>';
  const fx=[];if(effects.attack.has(c.id)){fx.push('fx-attack');const owner=state?.players?.findIndex(p=>p.field.some(x=>x?.id===c.id));fx.push(owner===state?.you?'fx-lunge-up':'fx-lunge-down');}if(effects.hit.has(c.id))fx.push('fx-hit');if(effects.heal.has(c.id))fx.push('fx-heal');if(effects.sleep.has(c.id))fx.push('fx-sleep');if(effects.targeting.has(c.id))fx.push('fx-target');
  const pop=effects.hit.has(c.id)?`<span class="combat-pop damage-pop">−${effects.hit.get(c.id)}</span>`:effects.heal.has(c.id)?'<span class="combat-pop heal-pop">+1</span>':'';
  return `<div class="card ${selected?'selected':''} ${c.sleep?'sleeping':''} ${c.airborne?'airborne':''} ${c.suppressedBy?'suppressed':''} ${fx.join(' ')}" data-card="${esc(c.id)}" data-owner="${hand?'hand':'field'}" title="${esc(d.text)}"><div class="card-inner"><div class="card-head"><strong>${esc(d.name)}</strong><span class="card-kind">${d.kind==='once'?'一次性':d.kind==='dual'?'两用':'角色'}</span></div><div class="card-art">${art(c.type)}</div><div class="card-info"><div class="card-text">${esc(d.text)}</div><div class="card-foot">${hp}<span>${esc(d.suit||'海域')}</span></div></div></div>${pop}${effects.sleep.has(c.id)?'<span class="sleep-burst">Zzz</span>':''}<div class="state-badges">${c.sleep?'<span class="badge-sleep">☾ 睡眠</span>':''}${c.airborne?`<span class="badge-air">↑ 腾空 · 势能 ${c.gravity}/3</span>`:''}${c.suppressedBy?'<span class="badge-suppress">⛓ 压制</span>':''}${state?.covering?.some(x=>x.c.id===c.id)?`<span class="badge-cover">▼ ${state.covering.find(x=>x.c.id===c.id).p===state.you?'己方':'对方'} · 压制中</span>`:''}</div></div>`;
}
async function post(url, body, base = activeRoom?.server || apiRoot()) {
  const r=await fetch(`${base}${url}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); const data=await r.json();
  if(!r.ok) throw Object.assign(Error(data.error||'请求失败'),{code:data.code,status:r.status}); return data;
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
async function send(action) {
  const epoch = connectionEpoch;
  try { await post('/api/action',{token,action}); if(epoch!==connectionEpoch)return; intent=null; chosenHand=null; render(); }
  catch(e){if(epoch===connectionEpoch)notify(e.message);}
}
function stopEvents(){ connectionEpoch++; if(eventSource){eventSource.close();eventSource=null;} }
function snapshotUnits(source){
  const units=source.players.flatMap((p,owner)=>p.field.flatMap((c,s)=>c?[{p:owner,locationP:owner,s,c}]:[]));
  const pending=[...(source.covering||[])];
  for(let pass=0;pass<pending.length+1;pass++)for(const x of pending)if(!units.some(y=>y.c.id===x.c.id)){const base=units.find(y=>y.c.id===x.targetId);if(base)units.push({p:x.p,locationP:base.locationP,s:base.s,c:x.c});}
  if(source.pending?.returnCard&&!units.some(x=>x.c.id===source.pending.returnCard.id))units.push({p:source.pending.respondTo,s:0,c:source.pending.returnCard});
  return units;
}
function applyState(next){
  const prev=state;
  if(prev?.players?.length===2&&next?.players?.length===2&&next.version!==prev.version){
    const before=snapshotUnits(prev),after=snapshotUnits(next),logs=next.log.slice(Math.max(0,next.log.length-(next.version-prev.version+3)));
    for(const old of before){
      const now=after.find(x=>x.c.id===old.c.id);
      if(now&&now.c.hp<old.c.hp)effects.hit.set(old.c.id,old.c.hp-now.c.hp);
      else if(now&&now.c.hp>old.c.hp)effects.heal.add(old.c.id);
      if(!old.c.sleep&&now?.c.sleep)effects.sleep.add(old.c.id);
      if(!now&&next.players.some(p=>p.discard.some(c=>c.id===old.c.id)))effects.dead.set(`${old.locationP??old.p}:${old.s}`,cardData(old.c.type).name);
      if(now&&logs.some(line=>line.includes(`令${cardData(old.c.type).name}攻击`)||line.includes(`令${cardData(old.c.type).name}冲击`)||line.includes(`令${cardData(old.c.type).name}落击`)||line.includes(`${cardData(old.c.type).name}追击`)))effects.attack.add(old.c.id);
    }
    if(next.pending?.target)effects.targeting.add(next.pending.target);
    if(effects.hit.size||effects.heal.size||effects.sleep.size||effects.dead.size||effects.attack.size||effects.targeting.size){clearTimeout(fxTimer);fxTimer=setTimeout(()=>{effects={hit:new Map(),heal:new Set(),attack:new Set(),sleep:new Set(),dead:new Map(),targeting:new Set()};render();},950);}
    if(next.turn!==prev.turn||next.phase!==prev.phase){intent=null;chosenHand=null;}
  }
  state=next;if(next.phase==='ended'&&roomMenu.open)roomMenu.close();render();
}

function saveKeptRooms(){sessionStorage.setItem(keptKey,JSON.stringify(keptRooms));}
function forgetRoom(t){keptRooms=keptRooms.filter(r=>r.token!==t);saveKeptRooms();}
function rememberRoom(room){if(!room)return;forgetRoom(room.token);keptRooms.unshift({...room});saveKeptRooms();}
function updateActiveRoom(){
  if(!activeRoom||!state)return;
  activeRoom={...activeRoom,code:state.code,name:me().name,phase:state.phase};
  sessionStorage.setItem(activeKey,JSON.stringify(activeRoom));
}
function closedRoom(data, t){
  forgetRoom(t);
  if(token!==t)return;
  stopEvents();sessionStorage.removeItem(sessionKey);sessionStorage.removeItem(activeKey);
  token=null;activeRoom=null;
  if(roomMenu.open)roomMenu.close();
  if(leavingToken===t){leaveGame();return;}
  if(data.state?.phase==='ended'){state={...data.state,roomClosed:true};connection.textContent='房间已关闭';render();}
  else{leaveGame();notify('房间已关闭。');}
}
async function connect(t, base = activeRoom?.server || apiRoot()) {
  stopEvents();const epoch=connectionEpoch;
  token=t;state=null;intent=null;chosenHand=null;
  activeRoom={...(activeRoom?.token===t?activeRoom:keptRooms.find(r=>r.token===t)),token:t,server:base};
  sessionStorage.setItem(sessionKey,t);sessionStorage.setItem(activeKey,JSON.stringify(activeRoom));
  roomMenuButton.hidden=true;roomChip.textContent='';connection.textContent='正在连接';
  app.innerHTML='<section class="center-state"><h2>正在进入房间…</h2></section>';
  try {
    const r=await fetch(base+'/api/state?token='+encodeURIComponent(t)), data=await r.json();
    if(epoch!==connectionEpoch)return;
    if(!r.ok)throw Object.assign(Error(data.error||'无法进入房间。'),{code:data.code});
    forgetRoom(t);applyState(data);updateActiveRoom();
    const stream=new EventSource(base+'/api/events?token='+encodeURIComponent(t));eventSource=stream;
    let checking=false;
    stream.onopen=()=>{if(epoch===connectionEpoch)connection.textContent='已连接';};
    stream.onmessage=e=>{if(epoch===connectionEpoch){applyState(JSON.parse(e.data));updateActiveRoom();}};
    stream.addEventListener('room-closed',e=>{if(epoch===connectionEpoch)closedRoom(JSON.parse(e.data),t);});
    stream.onerror=async()=>{
      if(epoch!==connectionEpoch)return;
      connection.textContent='重新连接中';
      if(checking)return;checking=true;
      try{const res=await fetch(base+'/api/state?token='+encodeURIComponent(t));
        if(epoch===connectionEpoch&&res.status===410)closedRoom({state:state?.phase==='ended'?state:null},t);
      }catch{}finally{checking=false;}
    };
  }catch(e){
    if(epoch!==connectionEpoch)return;
    if(e.code==='ROOM_CLOSED')forgetRoom(t);else rememberRoom(activeRoom);
    leaveGame();notify(e.message);
  }
}
function keptRoomsHTML(){
  if(!keptRooms.length)return '';
  return '<section class="kept-rooms"><h3>暂存的房间</h3><p class="server-hint">本标签页中可继续；保留期间对手仍可加入或行动。</p>'+keptRooms.map((r,i)=>
    '<article class="kept-room"><div><strong>房间 '+esc(r.code||'待恢复')+'</strong><small>'+esc(r.server)+'</small></div><div class="kept-room-actions"><button class="secondary small" data-resume="'+i+'">继续房间</button><button class="ghost small" data-drop-room="'+i+'">放弃房间</button></div></article>'
  ).join('')+'</section>';
}
function lobby() {
  roomChip.textContent='';connection.textContent='大厅';roomMenuButton.hidden=true;
  const custom=serverMode==='custom';
  app.innerHTML=`<section class="lobby"><div class="hero"><div class="hero-eyebrow">TWO PLAYER CARD BATTLE</div><h1>海底见，<br><span>手底见真章。</span></h1><p>把熟悉的海洋生物卡牌搬上桌。排兵布阵、交换生命、抓住对手的空档——潮汐正在改变。</p><div class="hero-art"><span class="bubble"></span><span class="bubble"></span><span class="bubble"></span><div class="float-card">${art('penguin')}</div><div class="float-card">${art('shark')}</div></div></div><div class="lobby-panel"><h2>开始对局</h2><p>两位玩家选择同一台游戏服务端，再通过房间号会合。</p><label class="field-label" for="server-mode">连接到</label><select id="server-mode" class="text-input"><option value="current" ${!custom?'selected':''}>当前页面的服务端</option><option value="custom" ${custom?'selected':''}>自定义公网服务端</option></select><div id="server-address-wrap" ${custom?'':'hidden'}><label class="field-label" for="server-url">服务端网址</label><input id="server-url" class="text-input" type="url" placeholder="https://game.example.com" value="${esc(customServerUrl)}"><p class="server-hint">填写完整网址，公网地址建议使用 HTTPS。</p></div><label class="field-label" for="name">你的名字</label><input id="name" class="text-input" maxlength="16" placeholder="输入昵称" value="玩家"><button id="create" class="primary full" style="margin-top:15px">创建新房间</button><div class="divider">或者加入朋友的房间</div><div class="join-row"><input id="code" class="text-input" maxlength="6" placeholder="六位房间号"><button id="join" class="secondary">加入房间</button></div><p class="lobby-note">十一种卡共42张，双方从同一牌堆各随机抽六张。</p>${keptRoomsHTML()}</div></section>`;
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
  app.innerHTML=`<section class="center-state pregame-state"><div class="hero-eyebrow">WHO GOES FIRST?</div><h2>${waiting?'等对手出拳':'猜拳决定先后手'}</h2><p>${waiting?'你已经出拳，等另一位玩家。':'输家先摆三张牌，赢家后摆并先行动。'}</p>${!waiting?`<div class="rps-row"><button class="secondary" data-rps="rock">✊ 石头</button><button class="secondary" data-rps="paper">✋ 布</button><button class="secondary" data-rps="scissors">✌ 剪刀</button></div>`:''}${previewHandHTML()}</section>`;
  wire();
}
function previewHandHTML(){
  const selected=selectedCard(chosenHand), d=selected&&cardData(selected.type);
  return `<section class="hand-area preview-hand" aria-label="你的手牌"><div class="hand-heading"><strong>你的手牌</strong><span>${me().hand.length} 张 · 点击查看</span></div><div class="hand-cards"><div class="hand-track">${me().hand.map(c=>cardHTML(c,{hand:true,selected:c.id===chosenHand}).replace('<div class="card ',`<div role="button" tabindex="0" aria-label="查看${esc(cardData(c.type).name)}" class="card `)).join('')}</div></div><div class="hand-preview-detail" aria-live="polite">${d?`<strong>${esc(d.name)} · ${d.hp?`生命 ${d.hp}`:'一次性牌'}</strong><p>${esc(d.text)}</p>`:'点击卡牌查看完整说明；手牌较多时可左右滚动。'}</div></section>`;
}
function waitingScreen(){
  let address='';try{address=activeRoom?.server||apiRoot();}catch{}
  app.innerHTML=`<section class="center-state pregame-state"><div class="hero-eyebrow">ROOM ${esc(state.code)}</div><h2>房间已创建</h2><p>把下面的服务端地址和房间号发给朋友，对方选择同一服务端后即可加入。</p><p class="server-address">服务端：<strong>${esc(address)}</strong></p><button id="copy" class="primary">复制联机信息</button>${previewHandHTML()}</section>`;
  document.querySelector('#copy').onclick=()=>navigator.clipboard?.writeText(`服务端：${address}\n房间号：${state.code}`).then(()=>notify('服务端地址和房间号已复制')).catch(()=>notify(`服务端：${address}　房间号：${state.code}`));
  wire();
}
function locate(id,seen=new Set()){
  if(!id||seen.has(id))return null;seen.add(id);
  for(let p=0;p<2;p++)for(let s=0;s<4;s++)if(state.players[p].field[s]?.id===id)return {p,s,locationP:p,c:state.players[p].field[s],kind:'field'};
  const cover=state.covering?.find(x=>x.c.id===id);if(cover){const base=locate(cover.targetId,seen);if(base)return {p:cover.p,s:base.s,locationP:base.locationP,c:cover.c,kind:'cover'};}
  return null;
}
function topAt(id){let a=locate(id);const seen=new Set();while(a?.c.suppressedBy&&!seen.has(a.c.id)){seen.add(a.c.id);const top=locate(a.c.suppressedBy);if(!top)break;a=top;}return a;}
const physicalRow=a=>a.locationP===0?(a.s<2?1:0):(a.s<2?2:3);
const reachable=(a,b)=>Math.abs(physicalRow(a)-physicalRow(b))<=2;
function actorAction(action){
  let next=action;for(const step of [...(intent?.control||[])].reverse())next={type:'control',actorId:step.actorId,targetId:step.targetId,action:next};
  return send(next);
}
function changeIntent(kind){intent={...intent,kind};render();}
function legalTarget(id,kind=intent?.kind){
  const a=locate(intent?.actorId),raw=locate(id),t=['attack','kangaroo','elephant'].includes(kind)?topAt(id):raw;
  if(!t)return false;
  if(kind==='seahorse')return t.p!==state.you;
  if(!a)return false;
  if(['attack','kangaroo'].includes(kind))return t.c.id!==a.c.id&&!t.c.sleep&&!(t.kind==='cover'&&t.p===state.you)&&(intent?.control?.length||t.p!==a.p)&&reachable(a,t);
  if(kind==='sunfish')return t.p===a.p&&t.c.id!==a.c.id&&t.c.hp<cardData(t.c.type).hp;
  if(kind==='sloth')return t.p!==a.p&&!t.c.suppressedBy;
  if(kind==='elephant')return t.p!==a.p;
  if(kind==='whale')return t.p!==a.p&&!t.c.sleep&&!t.c.suppressedBy&&!(intent?.control||[]).some(x=>x.actorId===t.c.id);
  return false;
}
function renderRows(owner,side){
  const locationP=side==='mine'?state.you:1-state.you;
  return [0,1].map(r=>{const localRow=side==='enemy'?1-r:r;return `<div class="row"><span class="row-label">${localRow?'后排':'前排'}</span>${[0,1].map(col=>{
    const s=localRow*2+col,base=owner.field[s],top=base?topAt(base.id):null,death=effects.dead.get(`${locationP}:${s}`);
    const layers=[];let c=base;while(c&&!layers.some(x=>x.id===c.id)){layers.push(c);c=c.suppressedBy?locate(c.suppressedBy)?.c:null;}
    const ret=state.pending?.kind==='return'&&state.pending.respondTo===state.you&&side==='mine';
    const actor=locate(intent?.actorId),activeReturn=intent?.kind==='elephantReturn'&&actor?.p===locationP&&isMyTurn();
    let selectable=base?legalTarget(base.id):!base&&(ret||activeReturn||(side==='mine'&&isMyTurn()&&(chosenHand||intent?.kind==='starSlot')));
    const stack=layers.length>1;
    const contents=base?`${cardHTML(top?.c||base,{selected:intent?.actorId===(top?.c||base).id})}${stack?`<div class="suppressed-stack">${layers.slice(0,-1).reverse().map(x=>`<button class="suppressed-unit" data-card="${esc(x.id)}" data-owner="field" title="${esc(cardData(x.type).text)}">⛓ ${esc(cardData(x.type).name)} · ♥${x.hp} · 被压制</button>`).join('')}</div>`:''}`:death?`<span class="slot-death"><b>✦</b><small>${esc(death)}退场</small></span>`:selectable?'＋':'·';
    return `<div class="slot ${!base?'empty':''} ${selectable?'selectable':''} ${stack?'stacked':''}" style="--stack-height:${(layers.length-1)*28}px" data-slot="${s}" data-side="${side}">${contents}</div>`;
  }).join('')}</div>`;}).join('');
}
function sharkRowsHTML(){
  const controlled=!!intent?.control?.length;
  const targets=controlled?[1-state.you,state.you]:[1-locate(intent?.actorId).p];
  return targets.map(p=>[0,1].map(row=>`<button class="option" data-row="${row}" data-target-player="${p}">攻击${p===state.you?'己方':'敌方'}${row?'后':'前'}排</button>`).join('')).join('');
}
function intentText(){
  const map={place:['选择空格','点击自己半场的空格上场。'],attack:['选择攻击目标','点击高亮的射程内目标。'],sloth:['选择睡眠目标','敌牌睡至施加者第二次回合开始。'],shark:['选择一排','选择目标阵营的一排；鲸操控时可选择双方，位置与射程不变。'],starDiscard:['选择复活牌','从双方弃牌堆选一张非一次性牌。'],starSlot:['选择复活位置','点击自己的空格。'],seahorse:['选择夺取方式','点击敌方场上牌，或盲抽手牌。'],sunfish:['选择治疗目标','点击受伤的其他友方牌。'],onceSloth:['选择目标排','敌方该排进入睡眠。'],kangaroo:['选择落击目标','消耗1点，解除腾空并造成1+势能的伤害。'],elephant:['选择压制目标','只能压制敌方。其技能状态会被清除。'],elephantReturn:['选择返回位置','点击大象原持有者半场的空格，主动返回消耗1点。'],whale:['选择要操控的牌','选择敌牌，再为它指定一次耗点行为；全部共耗1点。']};
  const item=map[intent?.kind];return item?{title:item[0],body:item[1]}:{title:'选择行动',body:isMyTurn()?'点击场上己方牌发动技能，或选择手牌。':'等待行动或查看卡牌。'};
}
function actionPanel(){
  const p=me(),selected=locate(intent?.actorId)?.c,text=intentText(),controlled=!!intent?.control?.length;
  if(state.pending?.kind==='return'){
    if(state.pending.respondTo!==state.you)return '<h3 class="choice-title">大象返回</h3><p>等待大象持有者选择返回位置。</p>';
    return `<h3 class="choice-title">大象免费返回</h3><p>剩余 ${state.pending.returnCard?.hp} 生命。点击自己的空格，或选择下面的位置。</p>${p.field.map((c,s)=>!c?`<button class="option" data-return="${s}">${s<2?'前':'后'}排${s%2?'右':'左'}格</button>`:'').join('')}`;
  }
  if(state.pending?.respondTo===state.you){const penguins=p.field.filter(c=>c?.type==='penguin'&&!c.sleep&&!c.suppressedBy&&c.id!==topAt(state.pending.target)?.c.id);return `<h3 class="choice-title">企鹅挡伤</h3><p>选择企鹅替目标承受本次伤害，或放行。</p>${penguins.map(c=>`<button class="option" data-intercept="${c.id}">🐧 企鹅挡伤</button>`).join('')}<button class="secondary full" data-intercept="">放行</button>`;}
  if(state.pending)return '<h3 class="choice-title">伤害结算中</h3><p>等待防守方响应。</p>';
  if(state.phase==='ended')return `<h3 class="choice-title">对局结束</h3><p>${esc(state.players[state.winner]?.name)}获胜。</p>`;
  let h=selectedCard(chosenHand);if(intent&&intent.kind!=='actor')h=null;
  if(h){const d=cardData(h.type);let b=`<h3 class="choice-title">${esc(d.name)}</h3><p>${esc(d.text)}</p>`;
    if(d.kind!=='once')b+='<button class="option" data-choice="place">放到场上</button>';
    if(h.type==='sloth')b+='<button class="option" data-choice="onceSloth">一次性使用 · 敌方一排睡眠</button>';
    if(h.type==='starfish'){const available=[...p.discard,...foe().discard].some(c=>cardData(c.type).kind!=='once');b+=`<button class="option" data-choice="starDiscard" ${available?'':'disabled'}>海星 · 复活弃牌</button>`;if(!available)b+='<p>双方弃牌堆暂无可复活牌。</p>';}
    if(h.type==='seahorse')b+='<button class="option" data-choice="seahorse">海马 · 夺取场上牌</button><button class="option" data-choice="seahorseBlind">海马 · 盲抽手牌</button>';
    return b;
  }
  if(intent?.kind==='starDiscard'){const pile=(owner,label)=>`<div class="revive-group"><strong>${label}</strong>${owner.discard.filter(c=>cardData(c.type).kind!=='once').map(c=>`<button class="option" data-discard="${esc(c.id)}">${esc(cardData(c.type).name)}</button>`).join('')||'<p>没有可复活的牌</p>'}</div>`;return `<h3 class="choice-title">选择复活牌</h3>${pile(p,'己方弃牌堆')}${pile(foe(),'对方弃牌堆')}<button class="ghost small" data-choice="cancel">取消</button>`;}
  if(intent&&!['actor','inspect'].includes(intent.kind))return `<h3 class="choice-title">${esc(text.title)}</h3><p>${esc(text.body)}</p>${controlled?'<p class="control-note">鲸操控中 · 攻击可选择双方其他牌，位置与射程不变</p>':''}<button class="ghost small" data-choice="cancel">取消</button>${intent.kind==='shark'?sharkRowsHTML():''}${intent.kind==='seahorse'?'<button class="option" data-blind="1">盲抽敌方手牌</button>':''}${intent.kind==='onceSloth'?'<button class="option" data-row="0">使敌方前排睡眠</button><button class="option" data-row="1">使敌方后排睡眠</button>':''}`;
  if(selected){let b=`<h3 class="choice-title">${esc(cardData(selected.type).name)} · ${selected.hp} HP</h3><p>${esc(cardData(selected.type).text)}</p>`;
    if(selected.sleep)b+='<p>☾ 睡眠中，不能行动或被攻击。</p>';
    if(selected.suppressedBy)b+='<p>⛓ 被压制，不能操作。</p>';
    if(selected.airborne)b+=`<p>↑ 腾空 · 重力势能 ${selected.gravity}/3 · 落击/反击伤害 ${1+selected.gravity}</p>`;
    if(intent.kind==='inspect')return b;
    if(controlled)b+='<p class="control-note">鲸正在操控这张牌，可选择耗点行为。普通攻击、袋鼠落击和鲨鱼群攻可选择鲸方的敌牌或己方其他牌，仍按原位置计算射程。</p>';
    b+='<button class="option" data-choice="attack">普通攻击 · 消耗1点</button>';
    if(selected.type==='sloth')b+='<button class="option" data-choice="sloth">使敌方牌睡眠 · 1点</button>';
    if(selected.type==='shark')b+='<button class="option" data-choice="shark">攻击敌方一排 · 1点</button>';
    if(selected.type==='sunfish'&&!controlled)b+='<button class="option" data-choice="sunfish">治疗友方 · 免费</button>';
    if(selected.type==='crab'&&!controlled)b+='<button class="option" data-choice="crab">换取行动点 · 免费</button>';
    if(selected.type==='kangaroo')b+=`<button class="option" data-choice="kangaroo">${selected.airborne?'落击 · '+(1+selected.gravity)+'伤害':'进入腾空 · 立即获得1势能'} · 1点</button>`;
    if(selected.type==='elephant')b+=`<button class="option" data-choice="elephant">${locate(selected.id).kind==='cover'?'主动解除压制并返回':'压制敌方牌'} · 1点</button>`;
    if(selected.type==='whale')b+='<button class="option" data-choice="whale">操控敌方牌行动 · 共1点</button>';
    return b+'<button class="ghost small" data-choice="cancel">取消选择</button>';
  }
  return `<h3 class="choice-title">${esc(text.title)}</h3><p>${esc(text.body)}</p>`;
}

function resultOverlay(){
  const won=state.winner===state.you;
  const sparks=won?Array.from({length:22},(_,i)=>`<i style="left:${4+(i*37)%92}%;--drift:${(i%2?1:-1)*(28+i*5)}px;animation-delay:${(i%6)*.09}s"></i>`).join(''):'';
  return `<div class="result-overlay ${won?'victory':'defeat'}" role="dialog" aria-modal="true" aria-label="${won?'对局胜利':'对局结束'}"><div class="result-sparks" aria-hidden="true">${sparks}</div><section class="result-card"><div class="result-emblem" aria-hidden="true">${won?'✦':'◈'}</div><div class="result-kicker">${won?'VICTORY':'GAME OVER'}</div><h1>${won?'胜利！':'对局结束'}</h1><p>${won?'你赢得了这场海洋对决。':`${esc(state.players[state.winner]?.name)}赢得了这场对局。`}</p><p class="result-room-note">${state.roomClosed?'房间已关闭，房间号已释放。':'返回大厅将关闭房间并释放房间号。'}</p><button class="primary" data-leave ${leaveBusy?'disabled':''}>${leaveBusy?'正在关闭房间…':'返回大厅'}</button></section></div>`;
}
function battleScreen(){
  const p=me(),o=foe(), mineTurn=isMyTurn();
  const cardRows=(owner,side)=>renderRows(owner,side);
  app.innerHTML=`<div class="game-layout"><section class="arena"><div class="player-strip"><div><strong>${esc(o.name)}</strong> <span>对手 · ${o.handCount} 张手牌</span></div><div>${state.turn===1-state.you?'<span class="turn-badge">对手行动</span>':''}<div class="back-row">${Array.from({length:Math.min(o.handCount,8)},()=>'<i class="mini-back">✦</i>').join('')}</div></div></div><div class="battlefield"><div class="zone-title">${esc(o.name)} · 敌方半场</div>${cardRows(o,'enemy')}<div class="middle-line">潮 汐 分 界</div>${cardRows(p,'mine')}<div class="zone-title">你的半场</div></div><div class="hand-area"><div class="hand-heading"><strong>你的手牌</strong><span>${p.hand.length} 张 · ${mineTurn?`行动点 ${state.ap}`:'等待中'}</span></div><div class="hand-cards"><div class="hand-track">${p.hand.map(c=>cardHTML(c,{hand:true,selected:chosenHand===c.id})).join('')}</div></div></div><div class="player-strip" style="margin-top:12px"><strong>你的弃牌堆 <span>(${p.discard.length})</span></strong><span>${p.discard.length?p.discard.map(c=>`<button class="ghost small" data-discard="${esc(c.id)}">${esc(cardData(c.type).name)}</button>`).join(' '):'暂无弃牌'}</span></div></section><aside class="side-panel"><h2>对局状态</h2><p class="phase-text">${state.pending?.kind==='return'?(state.pending.respondTo===state.you?'请选择大象返回的位置。':'等待对手选择大象返回位置。'):state.pending?.respondTo===state.you?'你的企鹅可以拦截这次伤害。':mineTurn?'轮到你行动。场地至少保留一张己方牌。':`等待${esc(o.name)}行动。`}</p><div class="stat-line"><div class="stat"><strong>${state.ap}</strong><span>行动点</span></div><div class="stat"><strong>${state.round}</strong><span>当前回合</span></div><div class="stat"><strong>${p.passes}</strong><span>连续弃权</span></div></div><div class="action-panel">${actionPanel()}</div><button class="secondary full pass-button" data-pass="1" ${!mineTurn?'disabled':''}>放弃行动点 · 结束回合</button><h2 class="log-title">战况记录</h2><div class="log">${[...state.log].reverse().map(x=>`<div class="log-entry">${esc(x)}</div>`).join('')}</div></aside></div>`;
  app.querySelector('.arena > .player-strip').insertAdjacentHTML('afterend',`<div class="opponent-discard"><strong>对手弃牌堆 <span>(${o.discard.length})</span></strong><div>${o.discard.length?o.discard.map(c=>`<button class="ghost small" data-discard="${esc(c.id)}">${esc(cardData(c.type).name)}</button>`).join(' '):'<span>暂无弃牌</span>'}</div></div>`);
  if(state.phase==='ended'){app.querySelector('.game-layout').inert=true;app.insertAdjacentHTML('beforeend',resultOverlay());}
  wire();
}
function restoreHandScroll(position){const hand=app.querySelector('.hand-cards');if(hand)hand.scrollLeft=position;}
function render(){
  const handScroll=app.querySelector('.hand-cards')?.scrollLeft ?? 0;
  roomMenuButton.hidden=!state||state.phase==='ended';
  if(!state){lobby();return;} roomChip.innerHTML=`房间 <strong>${esc(state.code)}</strong>`;
  if(state.phase==='waiting'){waitingScreen();restoreHandScroll(handScroll);return;}
  if(state.phase==='setup'){setupScreen();restoreHandScroll(handScroll);return;}if(state.phase==='rps'){rpsScreen();restoreHandScroll(handScroll);return;}battleScreen();restoreHandScroll(handScroll);
}
function chooseCard(id,owner){
  if(owner==='hand'){
    if(state.phase==='waiting'||state.phase==='rps'){chosenHand=id;intent=null;render();return;}
    if(state.phase==='setup'&&state.setup===state.you){chosenHand=id;intent={kind:'place'};render();return;}
    if(!isMyTurn())return;chosenHand=id;intent=null;render();return;
  }
  const targetKinds=['attack','sloth','sunfish','seahorse','kangaroo','elephant','whale'];
  if(isMyTurn()&&targetKinds.includes(intent?.kind)){
    if(!legalTarget(id)){notify('这张牌不符合目标条件，请选择高亮目标。');return;}
    if(intent.kind==='whale'){intent={kind:'actor',actorId:id,control:[...(intent.control||[]),{actorId:intent.actorId,targetId:id}]};chosenHand=null;render();return;}
    if(intent.kind==='seahorse'){void send({type:'once',cardId:chosenHand,targetId:id});return;}
    const targetId=['attack','kangaroo','elephant'].includes(intent.kind)?topAt(id).c.id:id;
    void actorAction({type:intent.kind==='attack'?'attack':'skill',actorId:intent.actorId,targetId});return;
  }
  const a=locate(id);if(!a)return;chosenHand=null;
  intent={kind:isMyTurn()&&a.p===state.you&&!a.c.sleep&&!a.c.suppressedBy?'actor':'inspect',actorId:id};render();
}
function handleSlot(el){
  const slot=Number(el.dataset.slot),side=el.dataset.side,cardEl=el.querySelector('.card[data-card]');
  if(cardEl){chooseCard(cardEl.dataset.card,'field');return;}
  if(state.pending?.kind==='return'&&state.pending.respondTo===state.you&&side==='mine'){void send({type:'return',slot});return;}
  if(intent?.kind==='elephantReturn'&&isMyTurn()){const a=locate(intent.actorId),p=side==='mine'?state.you:1-state.you;if(p===a?.p)void actorAction({type:'skill',actorId:a.c.id,slot});return;}
  if(side!=='mine'||(!isMyTurn()&&state.phase!=='setup'))return;
  if(intent?.kind==='starSlot'){void send({type:'once',cardId:chosenHand,discardId:intent.discardId,slot});return;}
  if(chosenHand&&(intent?.kind==='place'||state.phase==='setup'))void send({type:'place',cardId:chosenHand,slot});
}
function leaveGame(){
  stopEvents();clearTimeout(fxTimer);sessionStorage.removeItem(sessionKey);sessionStorage.removeItem(activeKey);activeRoom=null;token=null;state=null;intent=null;chosenHand=null;
  effects={hit:new Map(),heal:new Set(),attack:new Set(),sleep:new Set(),dead:new Map(),targeting:new Set()};render();
}
function openRoomMenu(room = activeRoom){
  if(!room||leaveBusy)return;
  menuRoom={...room};const current=room.token===token;
  document.querySelector('#room-menu-title').textContent=current?'返回大厅':'放弃暂存房间';
  document.querySelector('#room-menu-description').textContent=current
    ?'保留可稍后继续，房间不会暂停；放弃将关闭房间，双方到齐后会判对手获胜。'
    :'放弃后房间号会被释放；双方到齐后会判对手获胜。';
  document.querySelector('#keep-room').hidden=!current;
  document.querySelector('#abandon-room').textContent=current?'放弃房间并返回':'确认放弃房间';
  document.querySelector('#cancel-room-menu').textContent=current?'继续留在房间':'取消';
  document.querySelector('#room-menu-error').textContent='';roomMenu.showModal();
}
async function leaveRoom(mode, room = activeRoom){
  if(leaveBusy)return;
  if(!room){if(state?.roomClosed)leaveGame();return;}
  leaveBusy=true;leavingToken=room.token;
  roomMenu.querySelectorAll('button').forEach(b=>b.disabled=true);
  app.querySelectorAll('[data-leave]').forEach(b=>{b.disabled=true;b.textContent='正在关闭房间…';});
  const current=room.token===token;
  try{
    await post('/api/leave',{token:room.token,mode},room.server);
    const kept=mode==='keep'&&token===room.token;
    if(kept){rememberRoom({...room,code:state?.code||room.code,phase:state?.phase||room.phase});}
    else forgetRoom(room.token);
    if(roomMenu.open)roomMenu.close();
    if(current)leaveGame();else render();
    notify(kept?'房间已保留，可在大厅继续。':'房间已关闭，房间号已释放。');
  }catch(e){
    if(e.code==='ROOM_CLOSED'){
      forgetRoom(room.token);if(roomMenu.open)roomMenu.close();
      if(current)leaveGame();else render();notify('房间已关闭，房间号已释放。');
    }else{
      document.querySelector('#room-menu-error').textContent=e.message;
      notify(e.message);
    }
  }finally{
    leaveBusy=false;leavingToken=null;roomMenu.querySelectorAll('button').forEach(b=>b.disabled=false);
    app.querySelectorAll('[data-leave]').forEach(b=>{b.disabled=false;b.textContent='返回大厅';});
  }
}
roomMenuButton.onclick=()=>openRoomMenu();
document.querySelector('#keep-room').onclick=()=>void leaveRoom('keep',menuRoom);
document.querySelector('#abandon-room').onclick=()=>void leaveRoom('abandon',menuRoom);
for(const id of ['room-menu-close','cancel-room-menu'])document.querySelector('#'+id).onclick=()=>roomMenu.close();
roomMenu.addEventListener('cancel',e=>{if(leaveBusy)e.preventDefault();});
function wire(){
  app.querySelectorAll('[data-card]').forEach(el=>el.onclick=e=>{e.stopPropagation();chooseCard(el.dataset.card,el.dataset.owner==='hand'?'hand':'field');});
  app.querySelectorAll('.preview-hand [data-card]').forEach(el=>el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();chooseCard(el.dataset.card,'hand');}});
  app.querySelectorAll('.slot').forEach(el=>el.onclick=()=>handleSlot(el));
  app.querySelectorAll('[data-rps]').forEach(b=>b.onclick=()=>void send({type:'rps',choice:b.dataset.rps}));
  const pass=app.querySelector('[data-pass]');if(pass)pass.onclick=()=>void send({type:'pass'});
  app.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>{
    const kind=b.dataset.choice,actorId=intent?.actorId;
    if(kind==='cancel'){intent=null;chosenHand=null;render();return;}
    if(kind==='crab'){void actorAction({type:'skill',actorId});return;}
    if(kind==='kangaroo'&&!locate(actorId)?.c.airborne){void actorAction({type:'skill',actorId});return;}
    if(kind==='elephant'){changeIntent(locate(actorId)?.kind==='cover'?'elephantReturn':'elephant');return;}
    if(kind==='seahorseBlind'){void send({type:'once',cardId:chosenHand});return;}
    if(['attack','sloth','sunfish','shark','kangaroo','whale'].includes(kind)){changeIntent(kind);return;}
    if(['place','starDiscard','seahorse','onceSloth'].includes(kind)){intent={kind};render();}
  });
  app.querySelectorAll('[data-row]').forEach(b=>b.onclick=()=>{const row=Number(b.dataset.row);if(intent?.kind==='shark')void actorAction({type:'skill',actorId:intent.actorId,row,targetPlayer:Number(b.dataset.targetPlayer)});else if(intent?.kind==='onceSloth')void send({type:'once',cardId:chosenHand,row});});
  app.querySelectorAll('[data-intercept]').forEach(b=>b.onclick=()=>void send({type:'intercept',penguinId:b.dataset.intercept||null}));
  app.querySelectorAll('[data-return]').forEach(b=>b.onclick=()=>void send({type:'return',slot:Number(b.dataset.return)}));
  app.querySelectorAll('[data-blind]').forEach(b=>b.onclick=()=>void send({type:'once',cardId:chosenHand}));
  app.querySelectorAll('[data-discard]').forEach(b=>{const card=[...me().discard,...foe().discard].find(c=>c.id===b.dataset.discard);b.disabled=intent?.kind!=='starDiscard'||!card||cardData(card.type).kind==='once';b.onclick=()=>{intent={kind:'starSlot',discardId:b.dataset.discard};render();};});
  app.querySelectorAll('[data-leave]').forEach(b=>b.onclick=()=>state.roomClosed?leaveGame():void leaveRoom('finish'));
}

document.querySelector('#rules-button').onclick=()=>document.querySelector('#rules').showModal();
document.querySelector('#rules form').onsubmit=e=>{e.preventDefault();document.querySelector('#rules').close();};
app.addEventListener('click',async e=>{
  if(lobbyBusy||leaveBusy)return;
  const resume=e.target.closest('[data-resume]'), drop=e.target.closest('[data-drop-room]');
  if(resume){const room=keptRooms[Number(resume.dataset.resume)];if(room){lobbyBusy=true;try{await connect(room.token,room.server);}finally{lobbyBusy=false;}}return;}
  if(drop){openRoomMenu(keptRooms[Number(drop.dataset.dropRoom)]);return;}
  const create=e.target.closest('#create'),join=e.target.closest('#join');
  if((!create&&!join)||lobbyBusy)return;
  lobbyBusy=true;app.querySelectorAll('#create,#join').forEach(b=>b.disabled=true);
  try{saveServerSettings();const base=apiRoot();
    const r=await post(create?'/api/create':'/api/join',{name:document.querySelector('#name').value,...(join?{code:document.querySelector('#code').value}:{})},base);
    await connect(r.token,base);
  }catch(err){notify(err.message);}finally{lobbyBusy=false;app.querySelectorAll('#create,#join').forEach(b=>b.disabled=false);}
});
app.addEventListener('change',e=>{
  if(e.target.id==='server-mode'){serverMode=e.target.value;localStorage.setItem(serverModeKey,serverMode);render();}
  if(e.target.id==='server-url'){customServerUrl=e.target.value.trim();localStorage.setItem(serverUrlKey,customServerUrl);}
});
if(token)connect(token).catch(e=>{leaveGame();notify(e.message);});else lobby();
