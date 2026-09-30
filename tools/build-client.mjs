import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = process.argv[2];
if (!version || !/^v\d+\.\d+(?:\.\d+)?$/.test(version)) {
  console.error('用法：node tools/build-client.mjs v0.1.0');
  process.exitCode = 1;
} else {
  const publicDir = path.join(root, 'public');
  const [template, css, js] = await Promise.all([
    readFile(path.join(publicDir, 'index.html'), 'utf8'),
    readFile(path.join(publicDir, 'app.css'), 'utf8'),
    readFile(path.join(publicDir, 'app.js'), 'utf8')
  ]);
  const cssTag = '<link rel="stylesheet" href="/app.css">';
  const jsTag = '<script type="module" src="/app.js"></script>';
  if (!template.includes(cssTag) || !template.includes(jsTag)) {
    throw Error('页面资源引用已变化，请同步更新独立客户端构建脚本。');
  }
  const html = template.replace('<!doctype html>', `<!doctype html>\n<!-- 潮汐卡牌独立客户端 ${version}；双击打开，无需安装 Node。联机仍需游戏服务端。 -->`)
    .replace(cssTag, `<style>\n${css.replace(/<\/style/gi, '<\\/style')}\n</style>`)
    .replace(jsTag, `<script>\n${js.replace(/<\/script/gi, '<\\/script')}\n</script>`);
  const releaseDir = path.join(root, 'releases');
  await mkdir(releaseDir, { recursive: true });
  const output = path.join(releaseDir, `潮汐卡牌-独立客户端-${version}.html`);
  await writeFile(output, html, { encoding: 'utf8', flag: 'wx' });
  console.log(output);
}
