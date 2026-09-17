import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { pointOnFace, place, loadingManager } from './face-utils.js';

export function createFace(scene, size, basis) {
  const group = new THREE.Group();
  const face = {
    name: '拱环书苑', culture: '环廊庭院 · 苔藓、书卷与野花', gravity: '重力：标准重力（1.00 g）', being: '书页精灵',
    creatureColor: '#8fae6b', accent: '#c9d98a', speedMultiplier: 1,
    // 环廊庭院：柔和的日常日照。环廊是半围合结构，主光会被廊顶削掉一部分，
    // 所以环境光给到 1.35；地面色调偏绿——苔藓和植被会把光反射回来，让石廊下半部带一点绿。
    // 主光从另一侧来（sunRight 取负），和教堂那一面在光影方向上区分开。
    lighting: {
      background: '#0a1614', fogColor: '#0e1c1a', fogDensity: 0.016,
      hemiSky: '#bfd8e8', hemiGround: '#4e6a3c', hemiIntensity: 1.35,
      sunColor: '#fff2da', sunIntensity: 2.3,
      sunHeight: 28, sunForward: 12, sunRight: -9,
    },
    spawnPosition: pointOnFace(basis, size, 0, 0, .52), collisionOctree: null, update: () => {},
  };
  scene.add(group);
  const anchor = new THREE.Group();
  place(anchor, basis, size, 0, -6, -1);
  group.add(anchor);
  // 这个模型已经用 gltf-transform 做过 quantize + meshopt 压缩（.bin 从 249MB 降到约 70MB），
  // 必须挂上 MeshoptDecoder 才能解析里面的 EXT_meshopt_compression 数据。
  new GLTFLoader(loadingManager).setMeshoptDecoder(MeshoptDecoder).load('/models/face2/Site File .gltf', (gltf) => {
    const model = gltf.scene;
    // 源文件里混入了一个巨大的占位立方体（节点名 Cube，材质是默认占位名，缩放约 139 倍，
    // 把整个庭院场景都包了进去）——不是真实场景内容，需要先剔除，否则会渲染成一个
    // 灰色大盒子、还会把包围盒算错导致缩放不准。
    const isPlaceholderCube = (name) => name === 'Cube' || /^Cube\.\d+$/.test(name);
    [...model.children].forEach((child) => { if (isPlaceholderCube(child.name)) model.remove(child); });
    // 模型原始朝向未知，先按默认方向摆放；如果发现拱门庭院背对着出生点，
    // 把下面这行的 0 改成 Math.PI（转180°）或 Math.PI / 2（转90°）即可。
    model.rotation.y = 0;
    model.updateMatrixWorld(true);
    const sourceBox = new THREE.Box3().setFromObject(model);
    const sourceSize = sourceBox.getSize(new THREE.Vector3());
    // X/Z 方向分别独立拉伸贴合这个 48×48 面的边长（留 .1 余量防止穿插到相邻面）；
    // 高度（Y）采用两者里较小的缩放比例，避免场景被拉得比例失真。
    // 面积扩大到原来的 9 倍 = 长和宽各扩大 3 倍（面积是线性尺寸的平方，√9=3），
    // 所以场景会明显超出这个面的边界，向四周溢出。
    const AREA_MULTIPLIER = 9, LINEAR_MULTIPLIER = Math.sqrt(AREA_MULTIPLIER);
    const scaleX = (size - .1) / sourceSize.x * LINEAR_MULTIPLIER;
    const scaleZ = (size - .1) / sourceSize.z * LINEAR_MULTIPLIER;
    const scaleY = Math.min(scaleX, scaleZ);
    model.scale.set(scaleX, scaleY, scaleZ);
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.x -= center.x; model.position.z -= center.z; model.position.y -= box.min.y;
    anchor.add(model); anchor.updateMatrixWorld(true);
    model.traverse((object) => { if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; } });
  }, undefined, (error) => console.error('Site File load failed:', error));
  return face;
}
