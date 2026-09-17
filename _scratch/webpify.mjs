// 批次 D1：把各面引用的贴图转成 WebP，并只重写 gltf 里对应的 uri。
// 刻意不用 gltf-transform 的 webp 命令：它读文件时会解掉 EXT_meshopt_compression，
// 写回时几何变成未压缩（face3 实测 45MB → 104MB）。这里几何和 .bin 完全不碰。
//
// 另外顺手修掉 uri 里的 '#'：URL 里 '#' 是 fragment 分隔符，带 '#' 的文件名 100% 404，
// 编码成 %23 才能真正取到文件（磁盘上的文件名保持原样，只有 uri 编码）。
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const ROOT = 'public/models';
// 法线图对色度误差最敏感，给最高；数据图（粗糙/金属/AO）是灰度信息，中间档；
// 基础色/自发光用 85 —— 这个档位下肉眼与源 JPEG 基本无从区分，但体积能掉到 1/4 上下。
const QUALITY = { normal: 90, data: 88, color: 85 };
let converted = 0, failed = 0, bytesBefore = 0, bytesAfter = 0;

// 从场景根按可达性遍历，拿到「真正会被下载的材质」，再递归收集它们引用到的纹理。
// 只扫材质根上的固定槽位会漏掉 KHR_materials_* 扩展里的贴图。
function reachableMaterials(j) {
  const seenNode = new Set(), meshUsed = new Set(), matUsed = new Set();
  function visit(ni) {
    if (ni == null || seenNode.has(ni)) return;
    seenNode.add(ni);
    const n = j.nodes[ni];
    if (n.mesh != null) meshUsed.add(n.mesh);
    for (const c of n.children || []) visit(c);
  }
  for (const r of j.scenes[j.scene ?? 0].nodes || []) visit(r);
  for (const mi of meshUsed) for (const p of j.meshes[mi].primitives || []) if (p.material != null) matUsed.add(p.material);
  return [...matUsed].map((i) => j.materials[i]);
}

// 材质节点下凡是带 numeric index 的对象都只可能是纹理引用，用 key 名判断用途
function textureRoles(material, out) {
  (function walk(node, key) {
    if (!node || typeof node !== 'object') return;
    if (!Array.isArray(node) && typeof node.index === 'number') {
      const role = /normal/i.test(key) ? 'normal'
        : /metal|rough|occlusion|specular|gloss/i.test(key) ? 'data'
          : 'color';
      out.push({ texIndex: node.index, role });
    }
    for (const [k, v] of Object.entries(node)) walk(v, k);
  })(material, '');
}

for (const face of [0, 1, 2, 3, 4, 5]) {
  const dir = `${ROOT}/face${face}`;
  const gltfName = readdirSync(dir).find((f) => f.endsWith('.gltf'));
  const gltfPath = join(dir, gltfName);
  const j = JSON.parse(readFileSync(gltfPath, 'utf8'));

  // imageIndex -> role（同一张图被多种用途引用时取最高画质）
  const roleOf = new Map();
  const refs = [];
  for (const m of reachableMaterials(j)) textureRoles(m, refs);
  const rank = { color: 0, data: 1, normal: 2 };
  for (const { texIndex, role } of refs) {
    const src = j.textures[texIndex]?.source;
    if (src == null) continue;
    const prev = roleOf.get(src);
    if (!prev || rank[role] > rank[prev]) roleOf.set(src, role);
  }

  console.log(`\n=== face${face} (${gltfName}) —— 可达材质引用 ${roleOf.size} 张 / images 共 ${(j.images || []).length} 张 ===`);
  let changed = false;
  for (let i = 0; i < (j.images || []).length; i++) {
    const image = j.images[i];
    const uri = image.uri;
    if (!uri || uri.endsWith('.bin')) continue;
    const diskPath = join(dir, decodeURIComponent(uri));
    const out = `${diskPath.replace(/\.[^.]+$/, '')}.webp`;
    const role = roleOf.get(i) || 'color';
    if (!existsSync(diskPath)) { console.log(`  [缺失] ${uri}`); continue; }
    const before = statSync(diskPath).size;
    try {
      await sharp(diskPath, { failOn: 'none' }).webp({ quality: QUALITY[role], effort: 4, alphaQuality: 92 }).toFile(out);
    } catch (e) {
      failed++;
      console.log(`  [失败] ${uri} —— ${e.message}`);
      continue;
    }
    const after = statSync(out).size;
    bytesBefore += before; bytesAfter += after; converted++;
    console.log(`  ${role.padEnd(6)} ${(before / 1048576).toFixed(2)}MB → ${(after / 1048576).toFixed(2)}MB  ${uri}`);
    // 磁盘上保持字面 '#'，uri 里编码成 %23，否则浏览器会把 '#' 当 fragment 丢掉
    image.uri = out.split(/[\\/]/).pop().replace(/#/g, '%23');
    changed = true;
  }
  if (changed) writeFileSync(gltfPath, JSON.stringify(j));
}

console.log(`\n合计：转换 ${converted} 张，失败 ${failed} 张`);
console.log(`体积 ${(bytesBefore / 1048576).toFixed(1)}MB → ${(bytesAfter / 1048576).toFixed(1)}MB（省 ${((1 - bytesAfter / bytesBefore) * 100).toFixed(1)}%）`);
