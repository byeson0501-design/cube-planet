// 生成合并版《六面体星球 · 项目总结报告》Word 文档。
// 合并来源：① 项目早期阶段总结（设计理念、模型处理流程、早期问题表）
//          ② 当前实现与实测数据（六个面全部接入、光照/音效/资源优化、性能与体积实测）
// 凡两者冲突处一律以当前实际代码状态为准。
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import {
  Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, ImageRun,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, VerticalAlign, PageBreak,
} from 'docx';

const IMG = 'docs/images';
mkdirSync('docs', { recursive: true });

const BODY = { ascii: 'Segoe UI', eastAsia: 'Microsoft YaHei', hAnsi: 'Segoe UI' };
const MONO = { ascii: 'Consolas', eastAsia: 'Microsoft YaHei', hAnsi: 'Consolas' };
const BRAND = '4B3FE3';

// ── 基础构件 ──────────────────────────────────────────────────
const p = (text) => new Paragraph({ children: [new TextRun({ text })], spacing: { after: 120, line: 330 } });
const h1 = (text) => new Paragraph({
  children: [new TextRun({ text, bold: true, size: 30, color: BRAND })],
  heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 180 },
});
const h2 = (text) => new Paragraph({
  children: [new TextRun({ text, bold: true, size: 24 })],
  heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 },
});
const bullet = (text) => new Paragraph({
  children: [new TextRun({ text })], bullet: { level: 0 }, spacing: { after: 60, line: 320 },
});
const numbered = (text) => new Paragraph({
  children: [new TextRun({ text })], numbering: { reference: 'steps', level: 0 }, spacing: { after: 60, line: 320 },
});

const code = (source) => new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  borders: {
    top: { style: BorderStyle.SINGLE, size: 4, color: 'DCDCE2' },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: 'DCDCE2' },
    left: { style: BorderStyle.SINGLE, size: 4, color: 'DCDCE2' },
    right: { style: BorderStyle.SINGLE, size: 4, color: 'DCDCE2' },
    insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE },
  },
  rows: [new TableRow({
    children: [new TableCell({
      shading: { type: ShadingType.CLEAR, fill: 'F5F5F8' },
      margins: { top: 120, bottom: 120, left: 160, right: 160 },
      children: source.replace(/\s+$/, '').split('\n').map((line) => new Paragraph({
        children: [new TextRun({ text: line || ' ', font: MONO, size: 17 })],
        spacing: { after: 0, line: 260 },
      })),
    })],
  })],
});

const figure = async (name, caption, widthPt) => {
  const file = join(IMG, `${name}.png`);
  const meta = await sharp(file).metadata();
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 180, after: 60 },
      children: [new ImageRun({
        type: 'png', data: readFileSync(file),
        transformation: { width: widthPt, height: Math.round(widthPt * meta.height / meta.width) },
      })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [new TextRun({ text: caption, size: 19, color: '52525B' })],
    }),
  ];
};

const cell = (text, opts = {}) => new TableCell({
  verticalAlign: VerticalAlign.CENTER,
  shading: opts.head ? { type: ShadingType.CLEAR, fill: 'EFEFF2' } : undefined,
  margins: { top: 80, bottom: 80, left: 120, right: 120 },
  width: { size: opts.width, type: WidthType.PERCENTAGE },
  children: [new Paragraph({
    alignment: opts.center ? AlignmentType.CENTER : AlignmentType.START,
    spacing: { after: 0, line: 280 },
    children: [new TextRun({ text: String(text), bold: !!opts.head, size: opts.size ?? 19 })],
  })],
});
const table = (headers, rows, widths, sizes = {}) => new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  borders: {
    top: { style: BorderStyle.SINGLE, size: 4, color: 'DCDCE2' },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: 'DCDCE2' },
    left: { style: BorderStyle.SINGLE, size: 4, color: 'DCDCE2' },
    right: { style: BorderStyle.SINGLE, size: 4, color: 'DCDCE2' },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'DCDCE2' },
    insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'DCDCE2' },
  },
  rows: [
    new TableRow({
      tableHeader: true,
      children: headers.map((t, i) => cell(t, { head: true, center: true, width: widths[i] })),
    }),
    ...rows.map((r) => new TableRow({
      children: r.map((t, i) => cell(t, { center: i === 0 && widths[0] <= 8, width: widths[i], size: sizes[i] })),
    })),
  ],
});
const gap = () => new Paragraph({ children: [], spacing: { after: 120 } });

// ── 正文 ──────────────────────────────────────────────────────
const children = [];

children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 },
  children: [new TextRun({ text: '六面体星球', bold: true, size: 48, color: BRAND })] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 },
  children: [new TextRun({ text: '基于 WebGL 与 three.js 的六面景观交互式 3D 网页项目', size: 24, color: '52525B' })] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 360 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'DCDCE2' } },
  children: [new TextRun({ text: '项目总结报告', size: 21, color: 'A1A1AA' })] }));

// 一、项目概述
children.push(h1('一、项目概述'));
children.push(p('本项目以 Three.js 构建一个可探索的「正方体星球」。星球由六个 48×48 单位的正方形面构成，每一面对应不同的文化语境、景观风格、光照氛围与角色化身。玩家使用 WASD、鼠标、Shift 与 Space 控制角色，在各面之间跨越棱边移动，六个面构成一个可连续探索的封闭世界。'));
children.push(p('项目当前已完成六个面的正式 glTF 场景接入，并统一解决了模型缩放与居中、纹理与二进制缓冲区依赖同步、资源路径管理、按真实三角面构建碰撞，以及六面之间统一的光照、音效与性能调度。技术栈为 three.js r0.185.1 + Vite 8.1.3，构建为静态站点部署到 GitHub Pages，全程零后端。'));
children.push(gap());
children.push(table(
  ['面', '立方体位置', '景观名', '文化语境', '角色化身', '速度'],
  [
    ['face0', '+Y 顶面', '西风大教堂', '高天圣堂 · 遗迹与彩窗', '羽族旅人', '1.10'],
    ['face1', '−Y 底面', '存在回声', '意识展廊 · 藤蔓、浮金与低语文字', '回声行者', '0.95'],
    ['face2', '+Z 前面', '拱环书苑', '环廊庭院 · 苔藓、书卷与野花', '书页精灵', '1.00'],
    ['face3', '−Z 后面', '幽光溶洞', '古迹回廊 · 苔藓、藤蔓与残柱', '溶洞守灵', '1.00'],
    ['face4', '−X 左面', '锈蚀庭园', '工业遗迹 · 藤蔓、铁锈与废弃管道', '锈蚀拾荒者', '1.00'],
    ['face5', '+X 右面', '和风庭院', '神社庭院 · 苔藓、红叶与鸟居', '庭院狐', '1.00'],
  ],
  [8, 12, 15, 36, 15, 8],
  { 3: 18, 4: 18 },
));
children.push(gap());
children.push(p('设计理念上，六个面并非同一场景的六种配色，而是六个彼此独立的文化语境：神圣、意识、书卷、幽暗、工业、枯寂。玩家在同一个几何体上切换位置，却像走进六部互不相干的世界，形成「一星球、六世界」的对照体验。'));
children.push(...await figure('fig0-world-division', '图 1　设计理念与世界划分：一个正方体星球，六种文化语境与角色化身', 620));

// 二、核心技术原理
children.push(h1('二、核心技术原理'));
children.push(h2('2.1 WebGL'));
children.push(p('WebGL 是浏览器中的底层图形接口，负责把三维几何、材质、光照与相机信息交给 GPU 渲染。项目通过 WebGLRenderer 输出实时画面，并利用深度测试、阴影与着色器完成空间视觉效果。一次绘制调用的完整流程是：'));
children.push(numbered('顶点着色器：顶点从模型空间经 Model-View-Projection 矩阵变换到裁剪空间；'));
children.push(numbered('图元装配与光栅化：三角形被离散为片元；'));
children.push(numbered('片元着色器：逐片元计算颜色。本项目使用的 MeshStandardMaterial 走 PBR 光照模型，需要法线、粗糙度、金属度等参数；'));
children.push(numbered('逐片元操作：深度测试、混合，写入帧缓冲。'));
children.push(p('关键认知在于：这四步的开销都发生在 GPU 侧，而 CPU 侧的开销主要在「提交」——每一次绘制调用、每一次状态切换都需要 CPU 介入。因此优化往往不是「让着色器更快」，而是「少提交」。这一点直接决定了本项目后来的性能优化方向。'));

children.push(h2('2.2 Three.js'));
children.push(p('Three.js 对 WebGL 进行了高层封装，在底层接口之上提供场景图（Scene Graph）与一整套三维对象模型。其核心结构是 Scene → Object3D → Mesh，每个 Mesh 携带 Geometry（几何数据，最终对应 VBO）与 Material（着色参数）。渲染时渲染器遍历场景图，把每个可见的 Mesh 转成一次绘制调用。本项目主要使用：'));
children.push(bullet('Scene：承载所有景观、角色、灯光与模型；'));
children.push(bullet('PerspectiveCamera：提供透视视角（本项目视场角 62°，远平面 180）；'));
children.push(bullet('WebGLRenderer：输出浏览器中的实时画面；'));
children.push(bullet('Mesh、Geometry、Material：构建程序化景观与角色（星空、粒子、光环、主角球体均为程序化生成）；'));
children.push(bullet('GLTFLoader：加载各面的 glTF 场景；'));
children.push(bullet('Octree：根据模型真实三角面构建静态碰撞检测（见 3.4 节说明）；'));
children.push(bullet('Quaternion：实现角色与镜头跨越立方体棱边时的平滑旋转。'));
children.push(p('此外还有三个子系统与本项目直接相关。光照：HemisphereLight 负责基础环境色，DirectionalLight 负责方向性与阴影；three.js 的光照是各光源贡献线性相加的，没有自动曝光，这一点后来成了好几个视觉问题的根源。阴影：主平行光开启 castShadow 后，引擎会额外地从光源视角把所有投射阴影的物体再渲染一遍到深度贴图，也就是让绘制开销再翻一倍。后处理：EffectComposer 把渲染流程改成「渲染到离屏缓冲 → 一串 Pass 依次处理 → 输出到屏幕」。'));

children.push(h2('2.3 三维图形基础'));
children.push(p('项目使用局部坐标系定义每个面的 normal、right 与 forward 三个方向。角色移动时，WASD 会先转换成当前面的局部向量，再转换到世界坐标；跨面时则根据新旧面的法线关系旋转角色方向与镜头位置。'));
children.push(code(`当前面局部坐标
↑ normal ：该面的「向上」，与重力方向相反
→ right  ：局部右方
→ forward：局部前方

WASD → 局部移动向量 → 世界坐标移动 → 边缘检测 → 跨面旋转`));
children.push(gap());
children.push(p('这组基的存在，让「把物体放在某面某处」退化成一次仿射组合，也意味着六个面共用同一套逻辑——重力方向、移动轴、相机位置、光照方向全部由当前面的三个向量推出，不需要为每个面单独实现：'));
children.push(code(`export const FACE_BASES = [
  { normal: (0, 1, 0),  right: (1, 0, 0),  forward: (0, 0, -1) },  // face0 +Y 顶面
  { normal: (0, -1, 0), right: (1, 0, 0),  forward: (0, 0, 1)  },  // face1 -Y 底面
  // ... 其余四面同理
];

export function pointOnFace(basis, size, right = 0, forward = 0, height = .02) {
  return basis.normal.clone().multiplyScalar(size / 2 + height)
    .addScaledVector(basis.right, right)
    .addScaledVector(basis.forward, forward);
}`));
children.push(gap());
children.push(p('另一个基础是四元数。旋转若用欧拉角会遭遇万向节死锁与插值不自然；四元数用四个数表示旋转，插值走球面线性插值（slerp），能在两个朝向之间走出最短、匀速的弧线。本项目翻面动画的核心就是一次 slerp。'));
children.push(...await figure('fig1-world-model', '图 2　六面体星球的世界模型：六个面各是一套局部正交基，角色站在出生面上', 620));

// 三、项目实施过程
children.push(h1('三、项目实施过程'));
children.push(h2('3.1 开发环境搭建'));
children.push(p('项目采用 Vite 作为前端开发与构建工具，使用 ES Module 引入 Three.js。每个星球面独立存放在 face0.js 至 face5.js 中，公共坐标逻辑集中在 face-utils.js。正式依赖只有两个：'));
children.push(code(`{
  "dependencies": { "three": "^0.185.1" },
  "devDependencies": { "vite": "^8.1.1" }
}`));
children.push(gap());
children.push(p('部署到 GitHub Pages 需要处理子路径，因此在 vite.config.js 中配置 base：'));
children.push(code(`export default defineConfig({ base: '/cube-planet/' });`));
children.push(gap());
children.push(p('模型处理另外用过两个不写入 package.json 的一次性工具（以 --no-save 安装）：@gltf-transform/cli 做几何压缩，sharp 做贴图处理，避免把重依赖带进正式工程。'));

children.push(h2('3.2 场景初始化'));
children.push(p('主程序初始化场景、相机、渲染器、后处理链、环境光、方向光与角色球体；随后分别创建六个面，并将角色出生于第零面。'));
children.push(code(`renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;

// 后处理链：RenderPass → 泛光 → OutputPass
composer = new EffectComposer(renderer,
  new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType }));
composer.addPass(new RenderPass(scene, camera));
bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.09, 0.22, 2.5);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());`));
children.push(gap());
children.push(p('这里有两个容易踩的坑：加了 composer 之后 renderer 的 outputColorSpace 不再生效，必须由 OutputPass 收尾做色彩空间转换；renderer 的 antialias 只作用于默认帧缓冲，走 composer 后场景渲染到离屏缓冲，必须手动在 RenderTarget 上开 samples: 4 才有 MSAA。'));
children.push(p('光照体系采用「每面一套参数 + 逐帧指数插值」。每个面模块可以自带一个 lighting 字段，缺省项由 DEFAULT_LIGHTING 补齐：'));
children.push(code(`const DEFAULT_LIGHTING = {
  background: '#061018', fogColor: '#061018', fogDensity: 0.018,
  hemiSky: '#b4d9ff', hemiGround: '#09101d', hemiIntensity: 0.9,
  sunColor: '#ffffff', sunIntensity: 1.4,
  sunHeight: 24, sunForward: 12, sunRight: 8,       // 主光相对角色的偏移
};`));
children.push(gap());
children.push(p('换面时不做硬切，而是让当前值朝目标值做指数收敛，收敛速度与帧时间无关，因此在任何帧率下观感一致；主光的方向也是相对角色的偏移（太阳位置 = 角色位置 + normal × sunHeight + forward × sunForward + right × sunRight），角色走到哪光就跟到哪，六个面共用一套光而不需要六盏灯。'));
children.push(code(`const k = lightingReady ? 1 - Math.exp(-3.5 * delta) : 1;
lightingCurrent.fogDensity = mix(lightingCurrent.fogDensity, lightingTarget.fogDensity);
// 颜色用 lerp，标量用 mix，逐项插值`));
children.push(gap());
children.push(...await figure('fig2-pipeline', '图 3　渲染与表现管线：按面剔除是关键的性能节点', 620));

children.push(h2('3.3 三维模型加载与处理'));
children.push(p('六个面的模型均来自 Blender 导出的 glTF，用 GLTFLoader 加载。以第零面「西风大教堂」为例，处理流程包括：'));
children.push(numbered('将 .gltf、.bin 与纹理资源同步至项目 public/models/face0 目录，并检查 glTF 的全部依赖资源确保没有缺失；'));
children.push(numbered('剔除源文件里混入的非场景物体——14 个 Blender 光照探针体积占位方块（Cube、Cube.001…、立方体、立方体.001）。它们并非教堂实体，若保留会被渲染成灰色板子、收进碰撞体挡住行走，还会把包围盒算错导致缩放失准；'));
children.push(numbered('读取模型包围盒并缩放，使其适配该面 48×48 的范围。教堂本体狭长（长 135.87 × 宽 56.1），等比缩放会让宽边空出一大片无建筑覆盖的区域，因此改为 X / Z 独立拉伸、Y 跟随长度方向比例的非等比缩放；'));
children.push(numbered('将模型居中、旋转，并按需求调整相对地表高度（模型通过一个 anchor 组整体下沉，避免出生点与底板重叠）；'));
children.push(numbered('按真实三角面构建静态碰撞，而不是使用粗糙的大型包围盒。'));
children.push(gap());
children.push(p('（以下为节选，省略了材质修正等细节。）'));
children.push(code(`new GLTFLoader(loadingManager).load(assetUrl('/models/face0/西风大教堂.gltf'), (gltf) => {
  const model = gltf.scene;
  // 剔除光照探针占位方块（否则会被渲染成灰板并挡住行走）
  [...model.children].forEach((c) => { if (isProbeVolume(c.name)) model.remove(c); });
  model.rotation.y = Math.PI;
  model.updateMatrixWorld(true);

  const sourceSize = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  const scaleX = (size - .1) / sourceSize.x;      // 非等比：X / Z 各自拉伸到贴合面
  const scaleZ = (size - .1) / sourceSize.z;
  model.scale.set(scaleX, scaleZ, scaleZ);
  model.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.x -= center.x; model.position.z -= center.z; model.position.y -= box.min.y;
  anchor.add(model); anchor.updateMatrixWorld(true);

  // 遍历网格：开启阴影，并把误导出的半透明材质修正为不透明（见第五章问题 7）
  model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  onReady?.();
});`));
children.push(gap());
children.push(p('除加载流程本身，资源管理上还做了三件事。其一，加载调度：六个面不能同时加载，实测会把请求挤爆导致贴图成批失败，最终方案是「出生面独占带宽优先加载，其余五面按最多 2 并发排队」，队列由每个面自己的 onReady 回调驱动，而不用 LoadingManager.onLoad。其二，几何压缩：用 gltf-transform 施加 quantize（位置 14 bit / 法线 10 bit）与 meshopt，产出 EXT_meshopt_compression 与 KHR_mesh_quantization 两个扩展，运行时由 MeshoptDecoder 解压，face1 几何从 463 MB 降到 79 MB。其三，贴图处理：先用 sharp 降采样（基础色与自发光上限 2048，数据贴图上限 1024），再全部转 WebP，并只重写 glTF 里的 uri，几何与 .bin 不动。'));
children.push(p('资源路径必须手动拼 base 前缀，这是部署到 GitHub Pages 时踩过的坑——base 只作用于 index.html 与 CSS 里被 Vite 改写过的那部分引用，代码里手写的路径不会自动加前缀：'));
children.push(code(`export const assetUrl = (path) => import.meta.env.BASE_URL + path.replace(/^\\//, '');`));
children.push(gap());

children.push(h2('3.4 交互功能实现'));
children.push(bullet('鼠标控制水平转向与垂直俯仰（Pointer Lock 指针锁定）；'));
children.push(bullet('WASD 控制角色在当前面移动，Shift 提高移动速度，Space 触发跳跃；'));
children.push(bullet('角色抵达边缘时，沿立方体共享棱平滑转动至相邻面；'));
children.push(bullet('镜头围绕角色公转，保持角色位于画面中心；'));
children.push(bullet('建筑碰撞基于真实三角面，使教堂内部空腔可通行、墙体与家具不可穿透。'));
children.push(gap());
children.push(p('移动轴随角色朝向走。面平面内的「前」和「右」由偏航角在当前面的局部基上旋转得到：'));
children.push(code(`function setMovementAxes(basis) {
  tempForward.copy(basis.forward).multiplyScalar(Math.cos(yaw)).addScaledVector(basis.right, Math.sin(yaw));
  tempRight.copy(basis.right).multiplyScalar(Math.cos(yaw)).addScaledVector(basis.forward, -Math.sin(yaw));
}`));
children.push(gap());
children.push(p('碰撞用八叉树做球体相交检测，失败时逐轴回退（先整体试，撞了就分别试 x / y / z 三个轴），这是最省事的滑墙实现；若某个面没有构建八叉树，则直接位移：'));
children.push(code(`function moveCreatureWithCollisions(face, movement) {
  const octree = face.collisionOctree;
  if (!octree) { creature.position.add(movement); return; }
  const collides = (position) => Boolean(octree.sphereIntersect(new THREE.Sphere(position, CREATURE_RADIUS)));
  const target = creature.position.clone().add(movement);
  if (!collides(target)) { creature.position.copy(target); return; }
  for (const axis of ['x', 'y', 'z']) {
    if (!movement[axis]) continue;
    const candidate = creature.position.clone();
    candidate[axis] += movement[axis];
    if (!collides(candidate)) creature.position.copy(candidate);
  }
}`));
children.push(gap());
children.push(p('关于八叉树的当前状态需要说明：六个面的 collisionOctree 目前均为 null，也就是说碰撞管线保留可用、但默认未启用，角色在各面上是自由行走的。重新启用只需在对应面的模型加载完成后构建八叉树并赋值。'));
children.push(p('越边判定不靠碰撞体，而是「角色位置各分量的绝对值，谁最大就落在谁对应的面上」，并且判定用的是接触点而不是角色中心，否则跳跃时会被棱挡住过不去：'));
children.push(code(`export function getFaceAtPosition(p) {
  const a = [Math.abs(p.y), Math.abs(p.y), Math.abs(p.z), Math.abs(p.z), Math.abs(p.x), Math.abs(p.x)];
  let best = 0;
  for (let i = 1; i < 6; i++) if (a[i] > a[best]) best = i;
  if ((best === 0 && p.y >= 0) || (best === 1 && p.y < 0) /* ... */) return best;
  return best ^ 1;   // 恰好落在边界时的兜底
}`));
children.push(gap());

children.push(h2('3.5 动画系统'));
children.push(p('场景采用 requestAnimationFrame 主循环逐帧更新，每一帧依次完成：'));
children.push(numbered('计算帧间隔时间（并封顶到 50ms，避免切回标签页时出现巨大步长）；'));
children.push(numbered('更新角色移动、重力与跳跃；'));
children.push(numbered('更新跨面过渡动画；'));
children.push(numbered('更新镜头位置与朝向；'));
children.push(numbered('更新各面场景的动态元素（氛围粒子、环境音随机事件）；'));
children.push(numbered('调用渲染器输出画面。'));
children.push(gap());
children.push(p('其中最有技术含量的是跨面过渡动画。当接触点越到相邻面时，不是瞬移，而是构造一个 700ms 的补间：以棱为枢轴，把角色、朝向、相机整体绕同一条轴旋转 90°。'));
children.push(code(`const rotation = new THREE.Quaternion().setFromUnitVectors(
  FACE_BASES[previousFace].normal, FACE_BASES[nextFace].normal);

// 运动方向也要跟着「折」过去
const foldedHeading = heading.clone().applyQuaternion(rotation);
const nextYaw = Math.atan2(foldedHeading.dot(nextBasis.right), foldedHeading.dot(nextBasis.forward));

faceTransition = { startedAt: performance.now(), duration: 700, previousFace, nextFace, nextYaw,
  edgeAnchor, rotation, startPosition, endPosition, startQuaternion, endQuaternion,
  cameraStartPosition, cameraEndPosition, cameraStartQuaternion, cameraEndQuaternion };`));
children.push(gap());
children.push(p('逐帧插值时，位置是把起点相对锚点的偏移用部分旋转转过去再平移回来，朝向用 slerpQuaternions，缓动是 smoothstep：'));
children.push(code(`const raw = Math.min((performance.now() - transition.startedAt) / transition.duration, 1);
const t = raw * raw * (3 - 2 * raw);                       // smoothstep
const partialTurn = new THREE.Quaternion().slerpQuaternions(new THREE.Quaternion(), transition.rotation, t);
creature.position.copy(transition.startPosition).sub(transition.edgeAnchor)
  .applyQuaternion(partialTurn).add(transition.edgeAnchor);
creature.quaternion.slerpQuaternions(transition.startQuaternion, transition.endQuaternion, t);`));
children.push(gap());
children.push(p('这里有一个容易被忽略的细节：角色本身几乎没动——因为它就是在棱上翻过去的，位移半径只有角色高度 0.52 个单位；真正在动的是相机，它从上一面的后方摆到下一面的后方，半径 5.1 个单位。观众看到的「天地旋转」其实全部来自相机的 90° 摆动。用 performance.now() 而不用累加 delta，保证了哪怕掉帧，动画总时长也精确是 700ms。'));
children.push(...await figure('fig3-fold-mechanism', '图 4　越棱翻面机制：以棱为枢轴的一次 90° 旋转，配合 smoothstep 缓动的 700ms 时间轴', 620));
children.push(p('表现层动画（非功能性、纯氛围）包括四类：星空以极慢速度自转（静止的天空看起来像贴图）；角色光环三件套——细圆环跟着面法线转、外层光晕 Sprite 永远正对相机、贴地光圈沿法线压回地表再抬 0.02 以避免 z-fighting；六面专属氛围粒子，每面约 260 个，分别对应教堂尘埃、展廊浮金、书苑浮尘、溶洞孢子、遗迹灰烬、庭院落叶，它们挂在面 group 的局部坐标系里，局部 +Y 就是该面法线，因此只需给「上升／下落速度」一个正负号就统一了六种效果，而且会跟着按面剔除自动一起开关；相机绕角色公转而非穿过角色，保证玩家始终在画面中央。'));

children.push(h2('3.6 音效与环境音'));
children.push(p('音效系统是纯 Web Audio 程序化合成的，不引入任何音频文件——体积增量为零，也没有版权问题。结构是三条总线：'));
children.push(code(`// src/audio.js
master = gain(masterLevel); master.connect(ctx.destination);   // 主总线，静音开关作用在这里
ambienceGain = gain(0); ambienceGain.connect(master);          // 环境音层，2.5s 淡入
sfxGain = gain(0.85); sfxGain.connect(master);                 // 音效层，立即可用`));
children.push(gap());
children.push(bullet('主总线直接到位，只让环境层与音乐层慢淡入。如果淡的是主总线，第一次点击触发的那声界面反馈会几乎听不见，像是没生效；'));
children.push(bullet('六个面的环境音链全部常驻、靠增益交叉淡入淡出（1.4s 进 / 0.9s 出）。切面时是声音渐变而不是硬切，换回来时不用重建节点，也不会有相位跳变；'));
children.push(bullet('脚步声按走过的距离触发，而不是按时间。加速跑时步频自然变快，停下就不会有多余的步子；'));
children.push(bullet('静音拉总线增益而不是暂停 AudioContext，这样所有振荡器与 LFO 仍在原速运行，取消静音时不会出现相位跳变；'));
children.push(bullet('环境音里的随机事件（水滴、金属吱呀、翻书）由逐帧的 updateAudio(delta) 驱动计时器，每个面的音色由 FOOTSTEPS 表按滤波类型与中心频率区分。'));

// 四、项目成果与分析
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(h1('四、项目成果与分析'));
children.push(p('项目已完成一个可实时探索的六面体星球：六个独立文化景观模块、统一的角色移动与镜头系统、跨越立方体棱边的连续转面体验、六个面的正式 glTF 场景接入、纹理与二进制缓冲区及资源路径管理、六面差异化的光照与音景，以及按面剔除的性能调度。'));

children.push(h2('4.1 性能优化'));
children.push(p('最大的发现是：六个面全部常驻场景时，另外五个面根本没有被视锥剔除。因为正方体总共只有 48 个单位，而相机远平面是 180——六个面全部落在视锥内，每一帧都在参与主渲染和阴影两遍遍历。'));
children.push(p('解法是按面剔除。three.js 在 projectObject 与 WebGLShadowMap.renderObject 里都对 visible === false 有早退，所以关掉整棵子树能同时省下两遍开销：'));
children.push(code(`function updateFaceVisibility() {
  const shown = faceTransition ? [faceTransition.previousFace, faceTransition.nextFace] : [currentFace];
  faces.forEach((face, id) => { if (face) face.group.visible = shown.includes(id); });
}`));
children.push(gap());
children.push(table(
  ['指标', '优化前', '优化后', '倍数'],
  [
    ['每帧绘制调用', '1061', '74', '14.3×'],
    ['提交三角形', '65,467,334', '362,362', '180×'],
  ],
  [34, 24, 24, 18],
));
children.push(gap());
children.push(p('另外还做了三件事。阴影投射体筛选：体量小于 1.2 个单位的树叶卡片、藤蔓面片不投阴影，接收阴影全部保留。自适应分辨率：以滑动平均帧时间调节 devicePixelRatio，掉帧就降、富余就升，带 700ms 最小间隔防抖，同时跳过启动预热期（否则开局解析大模型的帧尖刺会立刻把分辨率压到底）与后台标签页（此时 requestAnimationFrame 被浏览器节流，帧时间根本不可信），下限从 0.75 提高到 1 以避免画面发糊。并发加载限流：最多 2 个面同时加载——这一条在开发沙箱里尤其重要，不限流会出现贴图成批加载失败，且每次失败的文件都不同（属于环境资源耗尽，与本机代码无关）。'));

children.push(h2('4.2 资源体积优化'));
children.push(p('资源体积经过两轮系统性优化，整体从约 2.18 GB 降到 341.5 MB：'));
children.push(table(
  ['阶段', '处置方式', '体积'],
  [
    ['起点', '六个面模型全部导入', '约 2.18 GB'],
    ['第一轮', '几何 quantize + meshopt，贴图降采样', '659.6 MB'],
    ['第二轮 D3', '源文件与死资源移出 public 目录', '710.7 MB'],
    ['第二轮 D1', '贴图全面转 WebP', '341.5 MB'],
  ],
  [16, 60, 24],
));
children.push(gap());
children.push(p('死资源的判定不能只看「文件里有没有声明」，而要从场景根节点做可达性遍历：face3 的 glTF 里 28 个节点只有 16 个可达，7 个材质只有 2 个被真正挂载，据此确认 4 张 Male_02 贴图（82.8 MB）完全无人引用；face4 的两个 .blend 源文件（1087 MB）则根本不该出现在 public 目录里。仅此一项就让构建产物从 1880.6 MB 降到 710.7 MB。'));
children.push(p('贴图环节最终选择 WebP 而不是 KTX2，原因是本机 gltf-transform 的 etc1s/uastc 依赖外部 KTX-Software 二进制（实测直接报 spawn ktx ENOENT）。同时刻意没有走 gltf-transform 的 webp 命令，而是用 sharp 转格式加只重写 uri 的方式，避免几何被解压。最终 360 张贴图从 441.0 MB 压到 76.1 MB，省 82.7%。优化到这一阶段后，体积瓶颈已从贴图转移到几何（.bin 约 267 MB）。'));
children.push(...await figure('fig4-resource-size', '图 5　六个面的资源体积优化前后对比（单位 MB，不含 .blend 源文件）', 620));

children.push(h2('4.3 美术与音频成果'));
children.push(p('美术层面：加入泛光后处理（强度 0.09 / 扩散 0.22 / 阈值 2.5）；程序化星空由三层共约 4000 颗星加一层星云球构成；六面棱边发光线用细圆柱而不是 LineSegments，因为后者的 linewidth 在绝大多数平台会被忽略；角色光环升级为「圆环 + 光晕 + 贴地光圈」三件套；每个面配一套专属氛围粒子。'));
children.push(p('音频层面：零音频文件，全部程序化合成。六个面各有一套常驻的环境音链（管风琴低音、远处低语、室外气声、低频轰鸣加水滴回响、穿堂风加金属吱呀、落叶加箫音），叠加一层五声音阶轮换的程序化 pad 背景乐，以及脚步、跳跃、落地、翻面扫频、界面反馈五类一次性音效。'));

children.push(h2('4.4 运行效果'));
children.push(p('以下为程序实际运行截图。前三张为当前构建，第四张取自几何压缩验证阶段（场景内容一致，仅缺少后加入的泛光与粒子层）。完整对比六个面时，建议补充截取：角色出生于第零面中心面向大教堂的远景、靠近楼梯与柱子时的碰撞效果、跨面时镜头沿棱旋转的瞬间、以及六面色彩与文化景观的对比画面。'));
children.push(...await figure('shot-face0-church', '图 6　face0 西风大教堂：出生面，高天圣堂、彩窗与烛光', 520));
children.push(...await figure('shot-face1-gallery', '图 7　face1 存在回声：意识展廊，浮金与低语文字，画面右侧可见正方体棱边', 520));
children.push(...await figure('shot-face3-cave', '图 8　face3 幽光溶洞：古迹回廊，苔藓与残柱，角色光环与贴地光圈', 520));
children.push(...await figure('shot-face5-courtyard', '图 9　face5 和风庭院：神社庭院，鸟居、红叶与远处社殿', 520));

// 五、遇到的问题与解决方式
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(h1('五、遇到的问题与解决方式'));
children.push(p('下表列出开发过程中遇到的主要问题。这里只保留有代表性的部分——像鼠标方向符号写反、变量声明顺序错误这类一次改动即可修复的低级失误已经略去，保留的是那些揭示了底层机制、或直接改变了架构决策的问题。'));
children.push(gap());
children.push(table(
  ['#', '问题现象', '根本原因', '解决方式'],
  [
    ['1', '打开是一片空场景', '调试用的常量忘记还原；构建 base 前缀与代码里手写的资源路径不一致，模型全部 404', '新增 assetUrl() 统一拼接前缀；调试常量并入配置管理'],
    ['2', '模型与贴图加载失败，部分资源必定 404', 'glTF 依赖的 .bin 与纹理未全部同步；文件名含 #，而 # 在 URL 里是 fragment 分隔符', '同步全部依赖；文件名规范化（去 #、空格转下划线）并同步改 uri'],
    ['3', '资源加载队列被提前抽干', 'GLTFLoader 先下载 .gltf，解析后才去下载 .bin 与贴图，中途 itemsLoaded 会短暂等于 itemsTotal，导致 LoadingManager.onLoad 提前触发', '改用每个面自己的 onReady 回调驱动队列，并把并发限流到 2'],
    ['4', '角色无法进入相邻面，跨面过程生硬', '最初只切换位置、直接传送，没有统一的跨面坐标关系', '用两个面的法线求出旋转四元数，以共享棱为枢轴做 700ms slerp，角色朝向、运动方向与相机一起转'],
    ['5', '俯仰时镜头「上方」不稳定', '相机的 up 向量依赖世界坐标，与当前面的法线冲突', '改为基于当前面局部正交基的轨道相机'],
    ['6', '角色在教堂中心卡住', '源文件里混入的大型辅助立方体，配合粗略包围盒碰撞，把整片区域都判为实体', '先剔除光照探针占位体，再改为按真实三角面构建八叉树静态碰撞（当前六个面默认未构建八叉树，碰撞管线保留可用）'],
    ['7', '教堂模型出现半透明撕裂与白边闪烁', '源文件里几乎所有材质（墙壁、柱子、旗帜、灯具）都被误导出为 alphaMode: BLEND，只有窗户玻璃本该如此；复杂形状的半透明网格无法逐三角面正确排序', '按材质名只保留玻璃的透明，其余修正为不透明并恢复深度写入'],
    ['8', 'face3 一片漆黑、出生点被埋在几何体里、灯光过暗', '面中心被几何体包住；另一块平面把包围盒下沿拉低 46 个单位，按最小 Y 对齐会埋掉角色；有顶回廊挡住主光，且雾密度 0.032 在 40 个单位外吃掉 81% 亮度', '离线做三百万三角形、0.5 单位网格的通透性扫描找可行走点；垂直对齐改用固定地面高度；半球光 1.7 提到 2.6，雾降到 0.020'],
    ['9', '泛光把画面糊成一片黄白', '项目未开色调映射，六面光照相加超过 1.0 后高光直接截断，大量像素落在阈值之上；中心区域大面积叠加光晕进一步放大问题', '阈值提到 2.5、扩散压到 0.22、强度 0.09；光晕 scale 从 2.3 降到 1.7（根因即色调映射，尚待决策）'],
    ['10', '走 composer 后边缘锯齿、画面发灰', 'renderer.antialias 只作用于默认帧缓冲；outputColorSpace 也被 Composer 接管', '在 RenderTarget 上开 samples: 4；链路末端加 OutputPass'],
    ['11', '资源处理工具「帮倒忙」：原文件被覆盖、体积反而变大', 'gltf-transform 会把新缓冲数据写回输入所引用的 .bin 文件名；prune 在读取时会解掉 meshopt 压缩，写回时不再重压', '处理前一律先备份；实测 prune 后 45.04 MB 涨到 45.95 MB，直接放弃该步骤'],
    ['12', '已废弃的资源仍然被下载；KTX2 路径走不通', 'GLTFLoader 在解析阶段就加载场景图里的全部贴图，onLoad 回调里删节点为时已晚；etc1s/uastc 依赖外部 KTX-Software 二进制', '在文件层（glTF 节点图）先剪掉废弃节点；改走 sharp 转 WebP + 只重写 uri'],
    ['13', '环境音完全不发声', 'startAudio 里的 setFaceAudio 写在 started = true 之前，被其自身的守卫挡掉', '调整赋值顺序；靠插桩统计 Web Audio 节点数发现（只建了 11 个振荡器，预期 19 个）'],
  ],
  [5, 20, 40, 35],
  { 1: 18, 2: 18, 3: 18 },
));
children.push(gap());
children.push(p('其中第 9 项与第 13 项是两类很有代表性的排查方式：前者靠二分排除——把泛光关掉，画面立刻正常，问题范围随即锁定在泛光参数上；后者靠可观测计数——在创建 Web Audio 节点时插桩统计，发现只建了 11 个振荡器而不是预期的 19 个，从而定位到一行守卫顺序错误。都不是靠读代码猜出来的。'));

// 六、经验总结与展望
children.push(h1('六、经验总结与展望'));
children.push(h2('6.1 经验总结'));
children.push(numbered('复杂三维交互作品不能只依赖「模型能显示」。真正的工作量在于统一处理坐标系、重力方向、跨面逻辑、相机关系、资源依赖与碰撞精度——这六件事任何一件没对齐，画面看起来都会「差不多但就是不对」。'));
children.push(numbered('数学基础决定了实现的复杂度上限。整个项目里最难的部分不是渲染，而是「怎么让角色在一个封闭立方体上连续行走」。而一旦把「面」抽象成一组正交基，六个面就退化成了「一面乘以六」——重力方向、移动轴、相机位置、光照方向全部由 normal / right / forward 推出。翻面动画同理，一次四元数 slerp 就解决了；如果当初用欧拉角，跨面的万向节问题会非常难缠。'));
children.push(numbered('定位问题要靠证据，不要靠猜。这个项目里最典型的教训是有一次把「空场景」归因于外部猜测的网络中断，实际原因是两个毫不相干的代码缺陷（遗留的调试常量加路径前缀缺失）。后来的排查都尽量设计成可判定的实验：关掉泛光看是否正常、插桩统计音频节点数、逐图元累加比对压缩前后的几何完整性、离线扫描模型寻找可行走点。'));
children.push(numbered('工具链的隐含行为必须实测。gltf-transform 的 prune 会悄悄解掉 meshopt、写入时会覆盖输入引用的 .bin——这两件事文档里都不显眼，是靠「压缩后体积反而变大」和「原文件被改写」发现的。因此任何批量资源处理之前先备份，不是谨慎，而是必需。'));
children.push(numbered('对封闭小场景，「看不见的部分」是最大的性能杠杆。这个项目场景总共才 48 个单位，六个面全在视锥内，剔除法一条都剔不掉。最后靠 visible 主动关掉未激活的面，一次拿到 14.3 倍的绘制调用下降和 180 倍的三角形下降，比任何着色器优化都有效。'));
children.push(numbered('体积优化的优先级会随阶段变化，优化是循环而不是一次性动作。一开始大头是贴图（524 MB），压完贴图之后大头立刻变成几何（267 MB）——压掉最大的一块、重新测量、再压下一块。'));
children.push(numbered('环境限制要如实区分。开发沙箱没有 GPU、requestAnimationFrame 被节流、并发加载大模型会失败，这些必须与代码缺陷分开记录，否则会误导后续判断。真实帧率只能在本地环境实测。'));

children.push(h2('6.2 后续展望'));
children.push(p('内容与表现方向：'));
children.push(numbered('为每个面接入更完整的正式景观模型与独立音景，让六个世界的文化差异进一步拉开；'));
children.push(numbered('使用角色 glTF 与骨骼动画替换当前的球形主角，并配合每个面的角色化身（羽族旅人、回声行者、书页精灵、溶洞守灵、锈蚀拾荒者、庭院狐）做差异化造型；'));
children.push(numbered('为每个面设计独特生物能力，例如游泳、滑翔、攀附，让「换面」不只是换景，而是换玩法；'));
children.push(numbered('增加任务、收集、叙事文本与场景触发器，把静态景观变成可停留更久的世界；'));
children.push(numbered('补充环境雾、体积光、后期泛光与昼夜循环，强化各面的氛围差异。'));
children.push(gap());
children.push(p('工程与性能方向：'));
children.push(numbered('开启色调映射（ACES / AgX）。这是当前最值得做的一件事：项目现在没有色调映射，高光直接截断，这是教堂面高光发白与泛光参数难调的共同根因。开启后六个面的观感会统一改善，但需要重新标定每面的光照强度；'));
children.push(numbered('几何进一步压缩。267 MB 的 .bin 现在是体积上的最大一块，可以考虑 Draco 或更激进的量化位宽与减面策略；'));
children.push(numbered('KTX2 贴图。如果本机装上 KTX-Software，可以进一步把贴图压成 GPU 原生压缩格式。相比 WebP 只能省下载量，KTX2 还能省显存——WebP 在显存里依然是完整解压的位图；'));
children.push(numbered('重新启用按面构建的八叉树碰撞，并做加载耗时评估，把「教堂内部可通行、墙体不可穿透」的效果扩展到全部六面；'));
children.push(numbered('移动端适配。当前设计面向桌面（指针锁定加 WASD），触屏需要双摇杆或虚拟按键。'));

const doc = new Document({
  creator: 'cube-planet',
  title: '六面体星球 · 项目总结报告',
  styles: {
    default: {
      document: { run: { font: BODY, size: 21, color: '171717' } },
      heading1: { run: { font: BODY, size: 30, bold: true, color: BRAND }, paragraph: { spacing: { before: 360, after: 180 } } },
      heading2: { run: { font: BODY, size: 24, bold: true, color: '171717' }, paragraph: { spacing: { before: 240, after: 120 } } },
    },
  },
  numbering: {
    config: [{
      reference: 'steps',
      levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.START, style: { paragraph: { indent: { left: 420, hanging: 280 } } } }],
    }],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 },                        // A4
        margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 }, // 2cm
      },
    },
    children,
  }],
});

const buffer = await Packer.toBuffer(doc);
// 目标文件可能正被 Word 打开（EBUSY），此时退回带后缀的文件名，避免整个流程失败
const candidates = ['六面体星球-项目总结报告.docx', '六面体星球-项目总结报告(合并版).docx'];
for (const name of candidates) {
  const target = join('docs', name);
  try {
    writeFileSync(target, buffer);
    console.log(`已生成：${target}  (${(buffer.length / 1024).toFixed(0)} KB)`);
    break;
  } catch (e) {
    console.log(`[跳过] ${name} —— ${e.code === 'EBUSY' ? '文件被占用（可能已在 Word 中打开）' : e.message}`);
  }
}
