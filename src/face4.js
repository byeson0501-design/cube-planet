import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { pointOnFace, place, loadingManager, assetUrl } from './face-utils.js';

export function createFace(scene, size, basis, onReady) {
  const group = new THREE.Group();
  const face = { group,
    name: '锈蚀庭园', culture: '工业遗迹 · 藤蔓、铁锈与废弃管道', gravity: '重力：标准重力（1.00 g）', being: '锈蚀拾荒者',
    creatureColor: '#c98a5e', accent: '#e8b184', speedMultiplier: 1,
    // 工业遗迹：阴天散射光。特征是「低对比」——主光只有 1.6、环境光却有 1.35，
    // 两者拉近才像云层把阳光打散；颜色一律偏冷灰，雾也偏灰（0.026），
    // 让铁锈和藤蔓的暖色在灰调里反而更突出。
    lighting: {
      background: '#0a0f14', fogColor: '#141a20', fogDensity: 0.026,
      hemiSky: '#93a6b5', hemiGround: '#40382e', hemiIntensity: 1.35,
      sunColor: '#c6d2dc', sunIntensity: 1.6,
      sunHeight: 26, sunForward: 6, sunRight: -14,
    },
    spawnPosition: pointOnFace(basis, size, 0, 0, .52), collisionOctree: null, update: () => {},
  };
  scene.add(group);
  const anchor = new THREE.Group();
  // 模型自身的地面（那块 Base_Soil-dry 泥土面）比它包围盒的最低点高 2.47 个单位，
  // 而最低点只是几丛散落的小草。这里按「缩放后的 2.47」整体下沉，让泥土面正好落在本面地表上，
  // 角色才是在场景地面上行走，而不是浮在它上方或被埋进地里。
  place(anchor, basis, size, 0, 0, -4.67);
  group.add(anchor);
  new GLTFLoader(loadingManager).load(assetUrl('/models/face4/lastofustrial.gltf'), (gltf) => {
    const model = gltf.scene;
    // 源文件里混入了四类不属于场景本体的对象，先剔除，否则会渲染出错或把包围盒算歪：
    // 1) fog —— Blender 的体积雾域，导出后变成一个 13.6³ 的实体盒子罩住整个场地，材质无贴图。
    //    下面会给所有网格开启 castShadow，它会投下一片盖住全场的阴影。
    // 2) VOID —— 背景虚空面，同样是导出残留。
    // 3) Grass_Basic_* 四株草 —— 被放在 y≈-10.6 处，离场景主体约 10 个单位，会把包围盒撑大，
    //    导致整体缩放比例和落地高度全部算错。
    // 4) BIG_Start_Point* 八个 —— 无材质的 0.2 小方块，是 Blender 资产包的定位标记，不是场景内容。
    // 注意：three.js 加载时会把节点名重写一遍（空格换成下划线、点号直接删掉），
    // "BIG_Start_Point.001" 到这里其实叫 "BIG_Start_Point001"。所以比对前先把名字压成
    // 「小写 + 只留字母数字」，两种写法都能命中，不必去猜它被改成了什么样。
    const nameKey = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const isArtifact = (name) => {
      const key = nameKey(name);
      return key === 'fog' || key === 'void' ||
        /^bigstartpoint\d*$/.test(key) ||
        /^grassbasic(dry)?[ad]springsummer$/.test(key);
    };
    [...model.children].forEach((child) => { if (isArtifact(child.name)) model.remove(child); });
    // 模型原始朝向未知，先按默认方向摆放；如果发现建筑背对着出生点，
    // 把下面这行的 0 改成 Math.PI（转180°）或 Math.PI / 2（转90°）即可。
    model.rotation.y = 0;
    model.updateMatrixWorld(true);
    const sourceBox = new THREE.Box3().setFromObject(model);
    const sourceSize = sourceBox.getSize(new THREE.Vector3());
    // 场地本身是 19×25 的狭长形，而这个是 48×48 的正方形面。X/Z 各按自己的边长拉伸贴合
    // （留 .1 余量防止穿插到相邻面），两轴差异约 1.34 倍，变形看不出来；
    // 高度（Y）取两者里较小的一档，避免建筑被拉高失真。
    const scaleX = (size - .1) / sourceSize.x;
    const scaleZ = (size - .1) / sourceSize.z;
    const scaleY = Math.min(scaleX, scaleZ);
    model.scale.set(scaleX, scaleY, scaleZ);
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.x -= center.x; model.position.z -= center.z; model.position.y -= box.min.y;
    anchor.add(model); anchor.updateMatrixWorld(true);
    model.traverse((object) => { if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; } });
    onReady?.();
  }, undefined, (error) => { console.error('Last of Us industrial load failed:', error); onReady?.(); });
  return face;
}
