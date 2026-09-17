import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const DIR = 'public/models/face3';
const OLD = 'untitled9';
const NEW = 'cave-temple';
const BACKUP = '_source_models/face3_original';

// 1) 先备份原始 gltf + bin。必须在压缩之前：gltf-transform 会把新 buffer 写回输入引用过的
//    那个文件名（也就是就地覆盖原 bin），压缩后再备份就已经晚了。
fs.mkdirSync(BACKUP, { recursive: true });
for (const ext of ['gltf', 'bin']) {
  const from = path.join(DIR, `${OLD}.${ext}`);
  const to = path.join(BACKUP, `${OLD}.${ext}`);
  if (fs.existsSync(from) && !fs.existsSync(to)) {
    fs.copyFileSync(from, to);
    console.log(`备份 ${path.basename(from)} -> ${to}`);
  }
}

const src = path.join(DIR, `${OLD}.gltf`);
const tmp = path.join(DIR, '_q.gltf');
const binBefore = fs.statSync(path.join(DIR, `${OLD}.bin`)).size;

// 2) quantize 降精度（位置 14bit、法线 10bit…），再 meshopt 压缩 buffer
execSync(`npx gltf-transform quantize "${src}" "${tmp}"`, { stdio: 'pipe' });
execSync(`npx gltf-transform meshopt "${tmp}" "${src}"`, { stdio: 'pipe' });
fs.rmSync(tmp, { force: true });
fs.rmSync(path.join(DIR, '_q.bin'), { force: true });

// 3) 改名。buffer 的真实文件名以 gltf 里写的为准（可能是 percent-encoded），不靠猜。
const json = JSON.parse(fs.readFileSync(src, 'utf8'));
const renames = [];
for (const buf of json.buffers || []) {
  if (!buf.uri) continue;
  const oldName = decodeURIComponent(buf.uri);
  const newName = `${NEW}.bin`;
  if (oldName !== newName) renames.push([oldName, newName]);
}
// 先改 JSON 里的引用，再动磁盘上的文件
let text = fs.readFileSync(src, 'utf8');
for (const [oldName, newName] of renames) text = text.split(oldName).join(newName);
text = text.split(OLD).join(NEW);
fs.writeFileSync(path.join(DIR, `${NEW}.gltf`), text);
fs.rmSync(src, { force: true });
for (const [oldName, newName] of renames) {
  const from = path.join(DIR, oldName);
  if (fs.existsSync(from)) fs.renameSync(from, path.join(DIR, newName));
}

// 4) 报告
const finalJson = JSON.parse(fs.readFileSync(path.join(DIR, `${NEW}.gltf`), 'utf8'));
const binAfter = fs.statSync(path.join(DIR, `${NEW}.bin`)).size;
console.log(`\n几何: ${(binBefore / 1048576).toFixed(1)} MB -> ${(binAfter / 1048576).toFixed(1)} MB  (${(binBefore / binAfter).toFixed(1)}x)`);
console.log(`buffers = ${JSON.stringify((finalJson.buffers || []).map((b) => b.uri))}`);
console.log(`extensionsRequired = ${JSON.stringify(finalJson.extensionsRequired)}`);
console.log(`gltf 大小 = ${(fs.statSync(path.join(DIR, `${NEW}.gltf`)).size / 1024).toFixed(0)} KB`);
console.log(`\n目录里剩下的 untitled9 相关文件: ${fs.readdirSync(DIR).filter((f) => f.includes(OLD)).join(', ') || '(无)'}`);
