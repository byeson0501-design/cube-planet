import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { pointOnFace, place, loadingManager, assetUrl } from './face-utils.js';

// 源模型里那块 Plane 地面（106×106 的 2 面片平面）所在的 y。竖直方向要按它对齐而不是按包围盒最低点：
// 洞壁的墙根一直延伸到 y≈-44.7，比可行走的地面低了 46 个单位，用最低点对齐会把角色埋进地里。
// 如果重新导出后发现角色陷进地面或者浮空，就是这里需要重新量一下。
const GROUND_Y = 1.41;

export function createFace(scene, size, basis, onReady) {
  const group = new THREE.Group();
  const face = { group,
    name: '幽光溶洞', culture: '古迹回廊 · 苔藓、藤蔓与残柱', gravity: '重力：标准重力（1.00 g）', being: '溶洞守灵',
    creatureColor: '#7c9473', accent: '#b9d1a0', speedMultiplier: 1,
    // 幽光溶洞：洞穴里没有直射阳光。主光压到 1.3 并且方向做得很陡（sunHeight 40、前右偏移很小），
    // 像从洞顶裂隙漏下来的一线天光；回廊是有顶的，主光基本被挡在外面，真正把层次撑起来的
    // 是幽青色的环境光（2.6）。雾不能太浓——之前用 0.032，40 单位外的东西有 81% 被雾吃掉，
    // 石柱全糊成黑色剪影，所以收到 0.020 并把雾色从近黑抬到带青的 #0a2029，
    // 让远处是「雾化」而不是「变黑」。
    lighting: {
      background: '#061318', fogColor: '#0a2029', fogDensity: 0.020,
      hemiSky: '#5a8b99', hemiGround: '#2a3a2c', hemiIntensity: 2.6,
      sunColor: '#b8e4e8', sunIntensity: 1.3,
      sunHeight: 40, sunForward: 3, sunRight: 4,
    },
    // 出生点不能用默认的面心：模型原点那一带正好被 Cube.011 / Cube.012 两个大结构包住
    // （它们包围盒 x -3.8~4.31、z -23.4~23.4 把原点罩在里面），一出生就糊在结构内部，看出去全黑。
    // 下面这个位置是离线栅格化整面（约 300 万个三角面）扫出来的：以「角色本身体积空 + 身后相机位置也空」
    // 为条件筛选后，离面心最近的可用点，距面心约 20 源单位（≈8.9 世界单位）。要微调就改 right / forward。
    spawnPosition: pointOnFace(basis, size, 8.9, -0.26, .52), spawnYaw: -Math.PI / 2,
    collisionOctree: null, update: () => {},
  };
  scene.add(group);
  const anchor = new THREE.Group();
  place(anchor, basis, size, 0, 0, 0);
  group.add(anchor);
  // 这个模型已经用 gltf-transform 做过 quantize + meshopt 压缩（.bin 从 266.6MB 降到约 45MB），
  // 必须挂上 MeshoptDecoder 才能解析里面的 EXT_meshopt_compression 数据。
  new GLTFLoader(loadingManager).setMeshoptDecoder(MeshoptDecoder).load(assetUrl('/models/face3/cave-temple.gltf'), (gltf) => {
    const model = gltf.scene;
    // 这个导出里混进了几类不属于「古迹回廊」的东西。逐条说明依据，方便你判断是否要保留其中某个：
    // 1) Plane.001 —— 106×106 的竖直面，材质 Material.001 没有任何贴图、baseColor 是纯黑 [0,0,0]，
    //    是导出残留的背景/虚空面（和 face4 里的 VOID 同类，会挡住视线）。它同时从 y=-46.7 伸到
    //    y=59.5，把包围盒下沿拉到地面以下 46 个单位，落地高度也会被它带偏。
    // 2) Cube.008 —— 2×2×2、完全没有材质的小方块（无材质 → 渲染成纯白），是 Blender 里的定位标记。
    // 3) Cube.014 —— 只有 12 个三角面、却被放到 z≈-143（离主体 100+ 单位）的离群薄板。
    //    它把 Z 方向包围盒从 ~107 撑到 197.8，导致整个场景被过度缩小、在面里只占一半还偏在一边。
    // 4) Male_02.001/002/003 + 4_hair_0.1_0_0.001~006 —— 一套人物资产（1 个单位高的人形 + 头发），
    //    被重复导入且缩放不一致：头发有 15 个单位高，是身体（1 个单位）的 15 倍。它们和人物贴图
    //    Male_02_* 一起占了约 30 万三角面 + 82MB 贴图，而在 106 个单位的洞里只有 1% 大，几乎看不见。
    // 如果其中某个其实是场景内容，把它从下面这行里删掉即可（three.js 加载时会把节点名里的点号去掉，
    // 所以比对前先把名字压成「小写 + 只留字母数字」再匹配，不必去猜它被改成了什么样）。
    const nameKey = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const isArtifact = (name) => {
      const key = nameKey(name);
      return key === 'plane001' || key === 'cube008' || key === 'cube014' ||
        /^male02\d*$/.test(key) || /^4hair\d*$/.test(key);
    };
    [...model.children].forEach((child) => { if (isArtifact(child.name)) model.remove(child); });
    // 模型原始朝向未知，先按默认方向摆放；如果发现遗迹背对着出生点，
    // 把下面这行的 0 改成 Math.PI（转180°）或 Math.PI / 2（转90°）即可。
    model.rotation.y = 0;
    model.updateMatrixWorld(true);
    const sourceBox = new THREE.Box3().setFromObject(model);
    const sourceSize = sourceBox.getSize(new THREE.Vector3());
    // 剔除离群物之后场地约 106×107，本来就是方的，X/Z 各自贴合这个 48×48 的面即可（留 .1 余量
    // 防止穿插到相邻面）；高度取两者里较小的一档，避免洞体被拉高失真。
    const scaleX = (size - .1) / sourceSize.x;
    const scaleZ = (size - .1) / sourceSize.z;
    const scaleY = Math.min(scaleX, scaleZ);
    model.scale.set(scaleX, scaleY, scaleZ);
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.x -= center.x; model.position.z -= center.z;
    model.position.y -= GROUND_Y * scaleY;
    anchor.add(model); anchor.updateMatrixWorld(true);
    model.traverse((object) => { if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; } });
    onReady?.();
  }, undefined, (error) => { console.error('Cave temple load failed:', error); onReady?.(); });
  return face;
}
