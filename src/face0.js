import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { pointOnFace, place, loadingManager } from './face-utils.js';

export function createFace(scene, size, basis) {
  const group = new THREE.Group();
  const face = {
    name: '西风大教堂', culture: '高天圣堂 · 遗迹与彩窗', gravity: '重力：标准重力（1.00 g）', being: '羽族旅人',
    creatureColor: '#f5deb6', accent: '#fff0ba', speedMultiplier: 1.1,
    // 高天圣堂：明亮通透的神圣感。注意这是「室内」场景——主光会被教堂屋顶挡掉大半，
    // 真正决定亮度的是环境光，所以环境光给到 2.0；主光保留 2.2 用来照亮屋顶以外的部分
    // 和角色，并让彩窗附近有明确的方向感。雾很淡（0.012）保住远景细节。
    lighting: {
      background: '#0a1626', fogColor: '#0d1c30', fogDensity: 0.012,
      hemiSky: '#cfdfff', hemiGround: '#7d6a4a', hemiIntensity: 2.0,
      sunColor: '#fff6e0', sunIntensity: 2.2,
      sunHeight: 34, sunForward: 8, sunRight: 12,
    },
    spawnPosition: pointOnFace(basis, size, 0, 0, .52), collisionOctree: null, update: () => {},
  };
  scene.add(group);
  const anchor = new THREE.Group();
  // 在此前基础上下降两个角色直径单位，避免出生点与模型底板重叠。
  place(anchor, basis, size, 0, 0, -2.75);
  group.add(anchor);
  new GLTFLoader(loadingManager).load('/models/face0/%E8%A5%BF%E9%A3%8E%E5%A4%A7%E6%95%99%E5%A0%82.gltf', (gltf) => {
    const model = gltf.scene;
    // 源文件里混入了 14 个 Blender 光照探针体积占位方块（Cube / Cube.001…Cube.011、
    // 立方体、立方体.001，材质均为默认占位材质），并非教堂实体，需先剔除——
    // 否则会被渲染成灰色板子、还会被收进碰撞体挡住行走，也会把包围盒算错导致缩放不准。
    const isProbeVolume = (name) => name === '立方体' || name.startsWith('立方体.') || name === 'Cube' || /^Cube\.\d+$/.test(name);
    [...model.children].forEach((child) => { if (isProbeVolume(child.name)) model.remove(child); });
    model.rotation.y = Math.PI;
    model.updateMatrixWorld(true);
    const sourceBox = new THREE.Box3().setFromObject(model);
    const sourceSize = sourceBox.getSize(new THREE.Vector3());
    // 教堂本体是狭长的（长135.87 × 宽56.1），而这个面是 48×48 的正方形。
    // 若按等比缩放（以长边为基准），宽边方向会空出一大片没有建筑覆盖的区域。
    // 这里改为非等比缩放：宽度（X）和长度（Z）分别独立拉伸到贴合面的宽高（留 .1 余量防止穿插到相邻面），
    // 高度（Y）仍然按长度方向的缩放比例走，避免建筑被拉得过高。
    const scaleX = (size - .1) / sourceSize.x;
    const scaleZ = (size - .1) / sourceSize.z;
    model.scale.set(scaleX, scaleZ, scaleZ);
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.x -= center.x; model.position.z -= center.z; model.position.y -= box.min.y;
    anchor.add(model); anchor.updateMatrixWorld(true);
    model.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = true; object.receiveShadow = true;
      // 源文件里几乎所有材质（墙壁/柱子/旗帜/灯具……）都被误导出成了半透明（alphaMode: BLEND），
      // 只有窗户玻璃本该如此。复杂形状的半透明网格无法被逐三角面正确排序，会呈现出
      // 撕裂状的白色锯齿闪烁。这里按材质名把真正需要透明的玻璃保留，其余一律修正为不透明。
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        if (!material || !material.transparent) return;
        const isGlass = /玻璃|窗户|glass|window/i.test(material.name || '');
        if (!isGlass) { material.transparent = false; material.depthWrite = true; material.needsUpdate = true; }
      });
    });
  }, undefined, (error) => console.error('Cathedral load failed:', error));
  return face;
}
