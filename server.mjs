import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { act, view } from './engine.mjs';
import { RoomStore } from './room-store.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 8080);
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml' };
const send = (res, status, data) => { res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify(data)); };
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  res.setHeader('Access-Control-Max-Age','600');
}
const readBody = async req => {
  let text = '';
  for await (const chunk of req) { text += chunk; if (text.length > 20000) throw Error('请求内容太长。'); }
  return JSON.parse(text || '{}');
};
export function createServer() {
  const streams = new Map();
  const store = new RoomStore({ onClose(g, reason) {
    for (let i = 0; i < g.players.length; i++) {
      const key = `${g.code}:${i}`, clients = streams.get(key);
      streams.delete(key);
      for (const res of clients || []) {
        res.write(`event: room-closed\ndata: ${JSON.stringify({ reason, state: g.phase === 'ended' ? view(g, i) : null })}\n\n`);
        res.end();
      }
    }
  } });
  const session = token => store.session(token);
  function broadcast(g) {
    for (let i=0; i<2; i++) for (const res of streams.get(`${g.code}:${i}`) || []) res.write(`data: ${JSON.stringify(view(g,i))}\n\n`);
  }
  function addStream(g,i,res) {
    const key = `${g.code}:${i}`;
    if (!streams.has(key)) streams.set(key,new Set());
    const clients = streams.get(key);
    clients.add(res);
    res.write(`data: ${JSON.stringify(view(g,i))}\n\n`);
    const timer = setInterval(() => res.write(': ping\n\n'),20000);
    res.on('close',() => { clearInterval(timer); clients.delete(res); if (!clients.size && streams.get(key) === clients) streams.delete(key); });
  }
  const server = http.createServer(async (req,res) => {
    try {
      cors(res);
      const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
      if (u.pathname === '/api/health' && req.method === 'GET') { send(res,200,{ok:true,service:'tide-card-game'}); return; }
      if (req.method === 'POST' && u.pathname === '/api/create') {
        const b = await readBody(req); send(res,200,store.create(b.name)); return;
      }
      if (req.method === 'POST' && u.pathname === '/api/join') {
        const b = await readBody(req); const result = store.join(b.code,b.name); send(res,200,result); broadcast(session(result.token).g); return;
      }
      if (req.method === 'POST' && u.pathname === '/api/leave') {
        const b = await readBody(req); send(res,200,store.leave(b.token,b.mode)); return;
      }
      if (u.pathname === '/api/state' && req.method === 'GET') { const {g,i}=session(u.searchParams.get('token')); send(res,200,view(g,i)); return; }
      if (u.pathname === '/api/events' && req.method === 'GET') {
        const {g,i}=session(u.searchParams.get('token'));
        res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache','Connection':'keep-alive','X-Accel-Buffering':'no'}); addStream(g,i,res); return;
      }
      if (u.pathname === '/api/action' && req.method === 'POST') {
        const b = await readBody(req); const {g,i}=session(b.token); act(g,i,b.action); broadcast(g); send(res,200,{ok:true}); return;
      }
      if (req.method !== 'GET') { send(res,405,{error:'方法不支持。'}); return; }
      let rel = decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname);
      if (!['/index.html','/app.css','/app.js'].includes(rel)) { send(res,404,{error:'找不到页面。'}); return; }
      const file = path.join(root,'public',rel.slice(1)); const data = await readFile(file);
      res.writeHead(200,{'Content-Type':mime[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-cache'}); res.end(data);
    } catch (e) { send(res,e.status || 400,{error:e.message || '请求失败。', ...(e.code ? {code:e.code} : {})}); }
  });
  return server;
}
const server = createServer();
function listenOn(candidate) {
  const onError = error => {
    server.removeListener('listening', onListening);
    if (error.code === 'EADDRINUSE' && !process.env.PORT && candidate < 8090) { listenOn(candidate + 1); return; }
    throw error;
  };
  const onListening = () => {
    server.removeListener('error', onError);
    console.log(`潮汐卡牌已启动： http://localhost:${candidate}`);
    for (const list of Object.values(os.networkInterfaces())) for (const n of list || []) if (n.family === 'IPv4' && !n.internal) console.log(`局域网访问： http://${n.address}:${candidate}`);
  };
  server.once('error', onError);
  server.once('listening', onListening);
  server.listen(candidate,'0.0.0.0');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) listenOn(port);
