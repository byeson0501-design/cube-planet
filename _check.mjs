import fs from 'node:fs';

const files = [
  ['face1', 'public/models/face1/Echoes-of-Existence.gltf'],
  ['face2', 'public/models/face2/Site File .gltf'],
  ['face5', 'public/models/face5/唯美日式场景.gltf'],
  ['face3', 'public/models/face3/cave-temple.gltf'],
];
for (const [label, file] of files) {
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  const refs = {};
  for (const bv of j.bufferViews || []) refs[bv.buffer] = (refs[bv.buffer] || 0) + 1;
  console.log(`=== ${label} ===`);
  console.log('  buffers:', JSON.stringify((j.buffers || []).map((b, i) => `[${i}] uri=${b.uri} byteLength=${b.byteLength}`)));
  console.log('  bufferViews 引用分布:', JSON.stringify(refs));
}
