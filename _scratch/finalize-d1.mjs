// 批次 D1 收尾：
// 1) 少数本来就压得很狠的 JPG（多是法线图）转 WebP 后反而更大 —— 这些退回原文件，删掉 webp。
// 2) 把 gltf 已不再引用的原始 png/jpg 移出 public（移到 _source_models，可随时挪回）。
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync, renameSync, mkdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'public/models';
const FACES = [0, 1, 2, 3, 4, 5];

// ── 1) 反向退回：webp 比原图大就保留原图 ──
let reverted = 0, reclaimed = 0;
for (const face of FACES) {
  const dir = `${ROOT}/face${face}`;
  const gltfPath = join(dir, readdirSync(dir).find((f) => f.endsWith('.gltf')));
  const j = JSON.parse(readFileSync(gltfPath, 'utf8'));
  let changed = false;
  for (const image of j.images || []) {
    const uri = image.uri;
    if (!uri || !uri.endsWith('.webp')) continue;
    const webpPath = join(dir, decodeURIComponent(uri));
    const original = webpPath.replace(/\.webp$/, '');
    // 原始文件可能是 .png 也可能是 .jpg，两个都试
    const candidates = [`${original}.png`, `${original}.jpg`, `${original}.jpeg`];
    const src = candidates.find((p) => existsSync(p));
    if (!src) continue;
    if (statSync(src).size <= statSync(webpPath).size) {
      image.uri = src.split(/[\\/]/).pop().replace(/#/g, '%23');
      reclaimed += statSync(webpPath).size;
      unlinkSync(webpPath);
      reverted++;
      changed = true;
    }
  }
  if (changed) writeFileSync(gltfPath, JSON.stringify(j));
}
console.log(`退回原格式 ${reverted} 张`);

// ── 2) 移出已被彻底弃用的原图 ──
const docs = [];
for (const face of FACES) {
  const dir = `${ROOT}/face${face}`;
  const gltfPath = join(dir, readdirSync(dir).find((f) => f.endsWith('.gltf')));
  const j = JSON.parse(readFileSync(gltfPath, 'utf8'));
  docs.push({ face, dir, uris: (j.images || []).map((im) => im.uri).filter(Boolean) });
}

let moved = 0, movedBytes = 0;
for (const { face, dir, uris } of docs) {
  const used = new Set(uris.map((u) => decodeURIComponent(u)));
  const dest = `_source_models/face${face}-tex-src`;
  const orphans = readdirSync(dir).filter((f) => /\.(png|jpe?g)$/i.test(f) && !used.has(f));
  if (!orphans.length) continue;
  mkdirSync(dest, { recursive: true });
  for (const f of orphans) {
    const from = join(dir, f);
    movedBytes += statSync(from).size;
    renameSync(from, join(dest, f));
    moved++;
  }
  console.log(`face${face}: 移出 ${orphans.length} 个已弃用原图`);
}
console.log(`共移出 ${moved} 个文件，${(movedBytes / 1048576).toFixed(1)}MB`);
