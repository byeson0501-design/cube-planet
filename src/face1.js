import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { pointOnFace, place, loadingManager } from './face-utils.js';

export function createFace(scene, size, basis) {
  const group = new THREE.Group();
  const face = {
    name: '存在回声', culture: '意识展廊 · 藤蔓、浮金与低语文字', gravity: '重力：标准重力（1.00 g）', being: '回声行者',
    creatureColor: '#c9a86a', accent: '#e8d9a0', speedMultiplier: .95,
    // 意识展廊：同样偏室内，主光会被顶棚挡掉，所以环境光给 1.5 保证暗部还有细节，
    // 再叠一盏低角度金色主光斜切进来：藤蔓和浮金被照亮的边缘发暖，暗部留在冷色里，
    // 形成冷暖对冲的神秘感。雾偏浓（0.024）做出展廊的纵深。
    lighting: {
      background: '#0c1018', fogColor: '#101422', fogDensity: 0.024,
      hemiSky: '#5a6d8c', hemiGround: '#3a2c18', hemiIntensity: 1.5,
      sunColor: '#ffd9a0', sunIntensity: 2.1,
      sunHeight: 16, sunForward: 20, sunRight: 6,
    },
    spawnPosition: pointOnFace(basis, size, 0, 0, .52), collisionOctree: null, update: () => {},
  };
  scene.add(group);
  const anchor = new THREE.Group();
  place(anchor, basis, size, 82, 24, -16);
  group.add(anchor);
  // 这个模型已经用 gltf-transform 做过 quantize + meshopt 压缩（.bin 从 463MB 降到约 79MB），
  // 必须挂上 MeshoptDecoder 才能解析里面的 EXT_meshopt_compression 数据。
  new GLTFLoader(loadingManager).setMeshoptDecoder(MeshoptDecoder).load('/models/face1/Echoes-of-Existence.gltf', (gltf) => {
    const model = gltf.scene;
    // 之前怀疑模型朝向倒置，加了这个翻转开关——现场截图确认朝向本身没问题，
    // 所以保持关闭。真正的问题是上面的下降偏移量算多了。
    const FLIP_VERTICAL = false;
    if (FLIP_VERTICAL) model.rotation.x = Math.PI;
    // 模型原始朝向未知，先按默认方向摆放；如果发现展廊背对着出生点，
    // 把下面这行的 0 改成 Math.PI（转180°）或 Math.PI / 2（转90°）即可。
    model.rotation.y = 0;
    model.updateMatrixWorld(true);
    const sourceBox = new THREE.Box3().setFromObject(model);
    const sourceSize = sourceBox.getSize(new THREE.Vector3());
    // 场景本身是长方形展廊，X/Z 两个方向分别独立拉伸贴合这个 48×48 面的边长
    // （留 .1 余量防止穿插到相邻面）；高度（Y）采用两者里较小的缩放比例。
    // 宽度倍数从之前的 1.3 调小到 1.1——拉伸太猛会让密集的装饰物簇挤在一起、
    // 变形叠加，看起来就像"一堆奇怪的模型"。
    const WIDTH_MULTIPLIER = 6;
    const scaleX = (size - .1) / sourceSize.x * WIDTH_MULTIPLIER;
    const scaleZ = (size - .1) / sourceSize.z * WIDTH_MULTIPLIER/3;
    const scaleY = (size - .1) / sourceSize.y * WIDTH_MULTIPLIER;
    model.scale.set(scaleX, scaleY, scaleZ);
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.x -= center.x; model.position.z -= center.z; model.position.y -= box.min.y;
    anchor.add(model); anchor.updateMatrixWorld(true);
    model.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = true; object.receiveShadow = true;
      // 藤蔓/花瓣/叶片这类材质本身是半透明（BLEND）的，而且单个模型里褶皱面很多，
      // 引擎没法把它们的三角面正确排序，会像截图里那样撕裂成一堆锯齿碎片闪烁。
      // 这里把它们改成"硬裁切"（alphaTest）而不是柔和的半透明混合——依然能保留
      // 叶片镂空的边缘效果，但不再需要排序，从根源上消除撕裂。
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        if (!material || !material.transparent) return;
        material.transparent = false;
        material.alphaTest = 0.5;
        material.depthWrite = true;
        material.needsUpdate = true;
      });
    });
  }, undefined, (error) => console.error('Echoes of Existence load failed:', error));
  return face;
}
