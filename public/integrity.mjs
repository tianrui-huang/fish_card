export const CLIENT_VERSION = '2026.10.01.1';
export const PROTOCOL = 1;
export const OFFICIAL_SERVER = 'https://67.216.204.198:8443';
export const CLIENT_FILES = ['/index.html', '/app.js', '/app.css', '/integrity.mjs'];

// SHA-256 fallback also works on ordinary LAN HTTP, where SubtleCrypto is unavailable.
const K = [
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
];
const rotate = (x, n) => (x >>> n) | (x << (32 - n));
export function sha256Fallback(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const padded = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64);
  padded.set(bytes); padded[bytes.length] = 0x80;
  const data = new DataView(padded.buffer), bits = bytes.length * 8;
  data.setUint32(padded.length - 8, Math.floor(bits / 0x100000000));
  data.setUint32(padded.length - 4, bits >>> 0);
  const h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const w = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let j = 0; j < 16; j++) w[j] = data.getUint32(offset + j * 4);
    for (let j = 16; j < 64; j++) {
      const x = w[j - 15], y = w[j - 2];
      w[j] = w[j - 16] + (rotate(x,7)^rotate(x,18)^(x>>>3)) + w[j - 7] + (rotate(y,17)^rotate(y,19)^(y>>>10));
    }
    let [a,b,c,d,e,f,g,z] = h;
    for (let j = 0; j < 64; j++) {
      const t1 = (z + (rotate(e,6)^rotate(e,11)^rotate(e,25)) + ((e&f)^(~e&g)) + K[j] + w[j]) | 0;
      const t2 = ((rotate(a,2)^rotate(a,13)^rotate(a,22)) + ((a&b)^(a&c)^(b&c))) | 0;
      z=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0;
    }
    [a,b,c,d,e,f,g,z].forEach((x, j) => h[j] = (h[j] + x) >>> 0);
  }
  return h.map(x => x.toString(16).padStart(8,'0')).join('');
}
export async function sha256(bytes) {
  if (globalThis.crypto?.subtle) {
    const result = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(result), x => x.toString(16).padStart(2,'0')).join('');
  }
  return sha256Fallback(bytes);
}
export async function inspectClient(origin, fetcher = fetch) {
  const read = async file => {
    const res = await fetcher(origin + file, { cache:'no-store', signal:AbortSignal.timeout(15000) });
    if (!res.ok) throw Error('客户端文件不完整，请重新解压最新版并刷新页面。');
    return res;
  };
  const manifest = await (await read('/release.json')).json();
  if (manifest.version !== CLIENT_VERSION || manifest.protocol !== PROTOCOL)
    throw Error('页面与客户端版本不一致，请更新客户端并按 Ctrl+F5 刷新。');
  if (Object.keys(manifest.files || {}).sort().join('|') !== [...CLIENT_FILES].sort().join('|'))
    throw Error('客户端校验清单异常，请重新解压最新版。');
  const hashes = Object.fromEntries(await Promise.all(CLIENT_FILES.map(async file => {
    const hash = await sha256(await (await read(file)).arrayBuffer());
    if (hash !== manifest.files[file]) throw Error(`客户端文件校验失败（${file}），请重新解压最新版并刷新。`);
    return [file, hash];
  })));
  return { protocol:PROTOCOL, version:CLIENT_VERSION, releaseId:manifest.releaseId, rulesHash:manifest.rulesHash, files:hashes };
}
export function serverLabel(address, currentOrigin) {
  if (address === OFFICIAL_SERVER) return '官方服务器';
  if (address === currentOrigin) return '当前页面的服务端';
  return address;
}
