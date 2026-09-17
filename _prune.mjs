import fs from 'node:fs';
import path from 'node:path';

const FILE = 'public/models/face3/cave-temple.gltf';
const gltf = JSON.parse(fs.readFileSync(FILE, 'utf8'));

// 和 face3.js 里同一套判定
const nameKey = (n) => (n || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const isArtifact = (n) => {
  const k = nameKey(n);
  return k === 'plane001' || k === 'cube008' || k === 'cube014' ||
    /^male02\d*$/.test(k) || /^4hair\d*$/.test(k);
};

// 把这些节点从场景图里摘掉。注意：不能只删 nodes[] 里的条目——必须让它们从 scenes[].nodes
// 以及所有父节点的 children 里都不可达。GLTFLoader 是从场景根节点开始遍历的，
// 不可达的节点（连同它的网格、材质、贴图）根本不会被加载，
// 这一步才是真正省掉那 82MB 人物贴图的关键：光在运行时移除已经太晚了。
const removed = [];
const reachable = new Set();
for (const scene of gltf.scenes || []) {
  scene.nodes = (scene.nodes || []).filter((i) => {
    if (isArtifact(gltf.nodes[i].name)) { removed.push(gltf.nodes[i].name); return false; }
    return true;
  });
}
for (const node of gltf.nodes || []) {
  if (!node.children) continue;
  node.children = node.children.filter((i) => {
    if (isArtifact(gltf.nodes[i].name)) { removed.push(gltf.nodes[i].name); return false; }
    return true;
  });
  if (!node.children.length) delete node.children;
}

fs.writeFileSync(FILE, JSON.stringify(gltf));

// 检查：从场景根出发还能到达多少个「带网格」的节点
const walk = (i) => {
  if (reachable.has(i)) return;
  reachable.add(i);
  for (const c of gltf.nodes[i].children || []) walk(c);
};
for (const scene of gltf.scenes || []) for (const i of scene.nodes || []) walk(i);
const meshed = [...reachable].filter((i) => gltf.nodes[i].mesh !== undefined);

console.log(`已摘除 ${removed.length} 个节点: ${removed.join(', ')}`);
console.log(`场景图里仍可达的节点: ${reachable.size} 个，其中带网格的: ${meshed.length} 个`);
console.log(`可达网格名单: ${meshed.map((i) => gltf.nodes[i].name).join(', ')}`);
console.log(`gltf 大小: ${(fs.statSync(FILE).size / 1024).toFixed(0)} KB`);
