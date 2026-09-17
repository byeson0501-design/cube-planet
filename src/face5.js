import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { pointOnFace, place, loadingManager } from './face-utils.js';

export function createFace(scene, size, basis) {
  const group = new THREE.Group();
  const face = {
    name: '和风庭院', culture: '神社庭院 · 苔藓、红叶与鸟居', gravity: '重力：标准重力（1.00 g）', being: '庭院狐',
    creatureColor: '#c98b7a', accent: '#f0c0a8', speedMultiplier: 1,
    // 神社庭院：黄昏金色时刻。主光是暖橙、压得很低（sunHeight 只有 11，而 sunForward 到 22），
    // 影子会被拉得很长、红叶被照得发暖；天光反过来偏紫蓝（7a86ac 的紫调），
    // 形成冷暖对冲。这是露天场景，主光能直接照到地面，所以环境光不用给太高（1.0），
    // 否则黄昏的低角度感会被冲淡。雾带一点暖紫。
    lighting: {
      background: '#140f16', fogColor: '#1c1418', fogDensity: 0.020,
      hemiSky: '#7a86ac', hemiGround: '#4a3a26', hemiIntensity: 1.0,
      sunColor: '#ffb066', sunIntensity: 2.6,
      sunHeight: 11, sunForward: 22, sunRight: 7,
    },
    // 出生点不能用默认的面心：这版模型的面心正好落在一棵大树的树冠范围里，一出生就糊在树里。
    // 下面这个位置是离线扫过整面、按「角色与本面留出的净空都够」筛出来后，离面心最近的一个，
    // 位于庭园北侧边缘、面朝庭园内部。要微调就改 pointOnFace 的 right / forward 两个参数。
    spawnPosition: pointOnFace(basis, size, -7, 0, .52), spawnYaw: Math.PI / 2,
    collisionOctree: null, update: () => {},
  };
  scene.add(group);
  const anchor = new THREE.Group();
  // 模型的地面（那块 Plane，正好在 y=0）比它包围盒的最低点（几棵树的树根，y≈-3.83）高 3.83 个单位。
  // 这里按「缩放后的 3.83」整体下沉，让庭院地面正好落在本面地表上，树根则埋到地面以下。
  place(anchor, basis, size, 0, 0, -1.96);
  group.add(anchor);
  // 这个模型已经用 gltf-transform 做过 quantize + meshopt 压缩（.bin 从 485MB 降到约 53MB），
  // 必须挂上 MeshoptDecoder 才能解析里面的 EXT_meshopt_compression 数据。
  new GLTFLoader(loadingManager).setMeshoptDecoder(MeshoptDecoder).load('/models/face5/%E5%94%AF%E7%BE%8E%E6%97%A5%E5%BC%8F%E5%9C%BA%E6%99%AF.gltf', (gltf) => {
    const model = gltf.scene;
    const hideOwnMesh = new THREE.MeshBasicMaterial({ visible: false });
    // 注意：three.js 加载时会把节点名重写一遍（空格换成下划线、点号直接删掉），
    // "Volume Cube.001" 到这里其实叫 "Volume_Cube001"、"Plane.001" 叫 "Plane001"。
    // 所以比对前先把名字压成「小写 + 只留字母数字」，两种写法都能命中。
    const nameKey = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const isArtifact = (name) => /^cube$/.test(nameKey(name)) || /^volumecube\d*$/.test(nameKey(name));
    [...model.children].forEach((child) => {
      // 1) Cube —— 一个 37×21×60、完全没有材质的巨大盒子，一路伸到庭院地面之外，
      //    既会挡住视线，开启 castShadow 后又会投下覆盖全场的阴影，属于导出残留。
      // 2) Volume Cube / Volume Cube.001 —— Blender 的体积域（雾/水汽），导出后变成两个无贴图的实体盒子。
      if (isArtifact(child.name)) { model.remove(child); return; }
      // 3) Plane.001 自带一个 4.6×4.6、没有材质的悬空面片，同时却又挂着 51 个子节点（一棵树的树皮与枝叶）。
      //    不能整节点删掉，否则那棵树会被一起删掉——只让这块面片本身不渲染，子节点照常保留。
      if (nameKey(child.name) === 'plane001' && child.isMesh) child.material = hideOwnMesh;
    });
    // 模型原始朝向未知，先按默认方向摆放；如果发现鸟居/神社背对着出生点，
    // 把下面这行的 0 改成 Math.PI（转180°）或 Math.PI / 2（转90°）即可。
    model.rotation.y = 0;
    model.updateMatrixWorld(true);
    const sourceBox = new THREE.Box3().setFromObject(model);
    const sourceSize = sourceBox.getSize(new THREE.Vector3());
    // 庭院本身是 69×94 的狭长形（沿 Z 铺开很远），而这个是 48×48 的正方形面。
    // X/Z 各按自己的边长拉伸贴合（留 .1 余量防止穿插到相邻面），两轴差异约 1.36 倍，变形看不出来；
    // 高度（Y）取两者里较小的一档，避免树木被拉高失真。
    const scaleX = (size - .1) / sourceSize.x;
    const scaleZ = (size - .1) / sourceSize.z;
    const scaleY = Math.min(scaleX, scaleZ);
    model.scale.set(scaleX, scaleY, scaleZ);
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.x -= center.x; model.position.z -= center.z; model.position.y -= box.min.y;
    anchor.add(model); anchor.updateMatrixWorld(true);
    model.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = true; object.receiveShadow = true;
      // 树皮/枝叶/叶片这类材质源文件里绝大多数是半透明（BLEND）的，而一棵树的褶皱面非常多，
      // 引擎没法把它们的三角面正确排序，会像截图里那样撕裂成一堆锯齿碎片闪烁。
      // 这里改成"硬裁切"（alphaTest）而不是柔和的半透明混合——依然保留叶片镂空的边缘效果，
      // 但不再需要排序，从根源上消除撕裂。
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        if (!material || !material.transparent) return;
        material.transparent = false;
        material.alphaTest = 0.5;
        material.depthWrite = true;
        material.needsUpdate = true;
      });
    });
  }, undefined, (error) => console.error('Japanese garden load failed:', error));
  return face;
}
