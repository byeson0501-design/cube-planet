// 修复带 '#' 的贴图文件名：'#' 是 URL 的 fragment 分隔符，转义成 %23 在这套 dev server 上
// 依然取不到文件，唯一可靠的做法是把文件名里的 '#' 去掉、空格换成下划线，并同步改 uri。
// 影响的是原本就 100% 加载失败的贴图（face1 的两张 Map），改完才真正能显示。
import { readFileSync, writeFileSync, existsSync, renameSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'public/models';
const seen = new Map();   // 目标文件名 -> 来源，用来发现命名冲突

for (const face of [0, 1, 2, 3, 4, 5]) {
  const dir = `${ROOT}/face${face}`;
  const gltfPath = join(dir, readdirSync(dir).find((f) => f.endsWith('.gltf')));
  const j = JSON.parse(readFileSync(gltfPath, 'utf8'));
  let changed = false;
  for (const image of j.images || []) {
    const uri = image.uri;
    if (!uri || uri.endsWith('.bin')) continue;
    const decoded = decodeURIComponent(uri);
    if (!/[#\s]/.test(decoded)) continue;
    const safe = decoded.replace(/#/g, '').replace(/\s+/g, '_');
    const from = join(dir, decoded);
    const to = join(dir, safe);
    if (existsSync(from)) {
      if (existsSync(to)) { console.log(`  [冲突，跳过] ${safe}`); continue; }
      renameSync(from, to);
    } else if (!existsSync(to)) {
      console.log(`  [源文件不存在] ${decoded}`);
      continue;
    }
    if (seen.has(`${face}/${safe}`)) console.log(`  [跨面重名] ${safe}`);
    seen.set(`${face}/${safe}`, uri);
    console.log(`  ${decoded} → ${safe}`);
    image.uri = safe;
    changed = true;
  }
  if (changed) writeFileSync(gltfPath, JSON.stringify(j));
}
