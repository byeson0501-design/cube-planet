// 临时分析脚本（批次 D 用，验收后删除）：列出 gltf 里被「剩余网格真正用到的材质」引用到的贴图
import { readFileSync } from 'node:fs';

const path = process.argv[2];
const j = JSON.parse(readFileSync(path, 'utf8'));
const matUsed = new Set();
const meshUsed = new Set();
// 从场景根开始遍历节点图：只有被节点真正挂载的网格/材质才会被 GLTFLoader 实例化，
// 文件里残留的孤立 mesh / material 定义不会产生任何下载。所以必须按「可达性」判定，不能只看数组里有没有。
const seenNode = new Set();
function visit(ni) {
  if (ni == null || seenNode.has(ni)) return;
  seenNode.add(ni);
  const n = j.nodes[ni];
  if (n.mesh != null) meshUsed.add(n.mesh);
  for (const c of n.children || []) visit(c);
}
for (const root of j.scenes[j.scene ?? 0].nodes || []) visit(root);
for (const mi of meshUsed) for (const p of j.meshes[mi].primitives || []) if (p.material != null) matUsed.add(p.material);
console.log('nodes', (j.nodes || []).length, '(reachable', seenNode.size + ') | meshes', (j.meshes || []).length, '(reachable', meshUsed.size + ') | materials', (j.materials || []).length, '(reachable', matUsed.size + ')');
const used = new Set();
// 递归收集材质里所有的 numeric index —— 在材质节点下，带 index 的对象只会是纹理引用，
// 这样连 KHR_materials_* 扩展里的贴图（specular / clearcoat 等）也一并覆盖到。
// 只扫 material 根下的固定槽位会漏掉扩展里的贴图，造成「假未引用」。
const texRefs = new Set();
(function walk(node) {
  if (!node || typeof node !== 'object') return;
  if (!Array.isArray(node) && typeof node.index === 'number') texRefs.add(node.index);
  for (const v of Object.values(node)) walk(v);
})(j.materials.filter((_, i) => matUsed.has(i)));
for (const ti of texRefs) if (j.textures[ti]?.source != null) used.add(j.textures[ti].source);
console.log('\nALL images:');
j.images.forEach((im, i) => console.log('  ', i, im.uri, used.has(i) ? '' : '   <-- UNUSED'));
console.log('\nUNUSED:');
console.log('  ' + [...j.images.keys()].filter((i) => !used.has(i)).map((i) => j.images[i].uri).join('\n  '));
