import * as THREE from 'three';
import { createFace as createFace0 } from './face0.js';
import { createFace as createFace1 } from './face1.js';
import { createFace as createFace2 } from './face2.js';
import { createFace as createFace3 } from './face3.js';
import { createFace as createFace4 } from './face4.js';
import { createFace as createFace5 } from './face5.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createStarfield, createAmbience, createHaloAura, createGroundGlow, createCubeEdges, sprites } from './effects.js';
import { startAudio, setFaceAudio, toggleMute, playFootstep, playJump, playLand, playFlip, playUi, updateAudio } from './audio.js';
import { FACE_BASES, getFaceAtPosition, loadingManager } from './face-utils.js';
import './styles.css';

const faceMakers = [createFace0, createFace1, createFace2, createFace3, createFace4, createFace5];
const FACE_SIZE = 48, CREATURE_HEIGHT = 0.52, CREATURE_RADIUS = 0.42, SPEED = 5.4, RUN_MULTIPLIER = 1.85, JUMP_SPEED = 6.4, GRAVITY = 16;
const CAMERA_DISTANCE = 5.1, CAMERA_MIN_CLEARANCE = 0.4, PITCH_LIMIT_DOWN = -1.3, PITCH_LIMIT_UP = 1.05;
let scene, camera, renderer, hemi, key, creature, halo, faces = [], currentFace = 0, yaw = 0, pitch = 0, pointerLocked = false, verticalVelocity = 0, grounded = true, faceTransition = null;
const keys = new Set(), clock = new THREE.Clock(), cameraPosition = new THREE.Vector3(), desiredCameraPosition = new THREE.Vector3(), tempForward = new THREE.Vector3(), tempRight = new THREE.Vector3(), tempView = new THREE.Vector3(), tempCameraUp = new THREE.Vector3(), tempMove = new THREE.Vector3(), cameraMatrix = new THREE.Matrix4(), keyLightPosition = new THREE.Vector3(), keyLightBasis = { normal: new THREE.Vector3(), right: new THREE.Vector3(), forward: new THREE.Vector3() };
const ui = { title: document.querySelector('[data-face-title]'), culture: document.querySelector('[data-culture]'), gravity: document.querySelector('[data-gravity]'), being: document.querySelector('[data-being]'), prompt: document.querySelector('.start-prompt'), loader: document.querySelector('.loader'), loaderFill: document.querySelector('.loader-fill'), mute: document.querySelector('[data-audio-hint]') };

// 加载调度：出生面先单独加载，让玩家尽快看到东西；其余五个面再做「最多两个并发」的排队加载。
// 不能六个一起上——实测那样会把请求挤爆（贴图成批加载失败）。队列靠每个面自己的 onReady 回调推进，
// 而不是 LoadingManager.onLoad：后者在 GLTFLoader 下会提前触发（它先下 .gltf、解析完才去下 .bin 和贴图，
// 中途 itemsLoaded 会短暂等于 itemsTotal）。
// 顺序 = 出生面 → 它的四个邻面 → 底面（底面要先从边上掉下去才够得着，放最后）。
const SPAWN_FACE = 0;
const FACE_LOAD_ORDER = [2, 3, 4, 5, 1], MAX_CONCURRENT_FACE_LOADS = 2;
let faceLoadIndex = 0, activeFaceLoads = 0, spawnFaceReady = false;
// 只让体量够大的网格投射阴影：树叶卡片、藤蔓面片这类小物件投出的影子几乎看不见，却要和主体一样
// 走一遍阴影渲染。接收阴影全部保留，明暗层次不受影响。数值可按观感调。
const SHADOW_CASTER_MIN_SIZE = 1.2;
const shadowBox = new THREE.Box3(), shadowSize = new THREE.Vector3();
// 自适应分辨率：高 DPI 屏上固定 2x 会让像素量翻四倍，而这类场景的瓶颈通常在填充率。
// 用滑动平均帧时间做主调节，掉帧就降、富余就升，配合 700ms 的最小间隔避免来回抖动。
const PIXEL_RATIO_MAX = Math.min(devicePixelRatio, 2), PIXEL_RATIO_MIN = 1;
let pixelRatio = PIXEL_RATIO_MAX, frameTimeAvg = 16.7, lastPixelRatioChange = 0;
const BOOT_TIME = performance.now();

// 泛光：这套场景的亮部（彩窗、浮金、红叶、光晕、粒子）本身就是氛围的主要来源，加一层辉光提升最明显。
// 阈值必须给到 1.0（线性空间）而不是 0.7 这种数：各面的主光+环境光本来就把大片漫反射推到 1.0 以上，
// 而且项目没开色调映射、高光直接截断，阈值一低就变成整幅画面糊成一片白。
// radius 是扩散范围，veil 主要来自它——所以给得很小，让辉光贴着光源而不是铺满全屏。
const BLOOM_STRENGTH = 0.09, BLOOM_RADIUS = 0.22, BLOOM_THRESHOLD = 2.5;
let composer, bloomPass, starfield, haloRing, haloAura, groundGlow, cubeEdges;
// 每个面一套氛围粒子。粒子活在面 group 的局部坐标系里，+Y 就是该面的法线方向：
// rise 为正 = 上浮（尘埃、孢子、金粒），为负 = 下落（灰烬、落叶）。参数含义见 effects.js。
const AMBIENCE_SPRITES = { soft: sprites.soft(), leaf: sprites.leaf() };
const AMBIENCE = {
  0: { count: 260, sprite: AMBIENCE_SPRITES.soft, color: '#ffe9c4', size: 0.14, opacity: 0.5, spread: 46, base: 0.4, height: 16, rise: 0.34, sway: 0.5 },   // 教堂：逆光里漂浮的尘埃
  1: { count: 220, sprite: AMBIENCE_SPRITES.soft, color: '#ffd88f', size: 0.13, opacity: 0.6, spread: 44, base: 0.4, height: 14, rise: 0.5, sway: 0.4 },    // 展廊：缓缓上升的金色低语
  2: { count: 240, sprite: AMBIENCE_SPRITES.soft, color: '#f2f2dc', size: 0.12, opacity: 0.45, spread: 46, base: 0.4, height: 14, rise: 0.3, sway: 0.6 },   // 书苑：被阳光照到的浮尘
  3: { count: 240, sprite: AMBIENCE_SPRITES.soft, color: '#8ff0e0', size: 0.16, opacity: 0.6, spread: 46, base: 0.4, height: 15, rise: 0.24, sway: 0.35 },  // 溶洞：幽青色的孢子
  4: { count: 220, sprite: AMBIENCE_SPRITES.soft, color: '#b8b0a4', size: 0.12, opacity: 0.4, spread: 46, base: 3, height: 16, rise: -0.3, sway: 0.55 },    // 工业遗迹：飘落的灰烬
  5: { count: 150, sprite: AMBIENCE_SPRITES.leaf, color: '#ffffff', size: 0.42, opacity: 0.85, spread: 44, base: 0.6, height: 18, rise: -0.75, sway: 0.9 },  // 和风庭院：飘落的红叶
};

// 每个面可以自带一套光照参数（见各 faceN.js 里的 lighting 字段），没写的就用这里的默认值。
// sun* 三个分量是主光相对角色的偏移：height 越大越接近正午顶光，forward/right 决定光从哪一侧来。
const DEFAULT_LIGHTING = {
  background: '#061018', fogColor: '#061018', fogDensity: 0.018,
  hemiSky: '#b4d9ff', hemiGround: '#09101d', hemiIntensity: 0.9,
  sunColor: '#ffffff', sunIntensity: 1.4,
  sunHeight: 24, sunForward: 12, sunRight: 8,
};
let lightingTarget = null, lightingCurrent = null, lightingReady = false;
const sunOffset = { height: DEFAULT_LIGHTING.sunHeight, forward: DEFAULT_LIGHTING.sunForward, right: DEFAULT_LIGHTING.sunRight };
// 脚步声不按时间触发而是按「走过的距离」触发：加速跑时步频自然变快，减速停下就不会有多余的步子。
const STRIDE_WALK = 1.9, STRIDE_RUN = 2.6;
let stepDistance = 0;
const stepFrom = new THREE.Vector3();

init(); animate();
function init() {
  scene = new THREE.Scene(); scene.background = new THREE.Color('#061018'); scene.fog = new THREE.FogExp2('#061018', 0.018);
  camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 180);
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.shadowMap.enabled = true; document.querySelector('#app').appendChild(renderer.domElement);
  // 后处理链：RenderPass → 泛光 → OutputPass。加了 composer 之后 renderer 自己的输出色彩空间
  // 就不再生效，必须由 OutputPass 来收尾做色彩空间转换，否则画面会整体偏暗/偏灰。
  // 目标缓冲区要手动开 4x 多重采样：renderer 的 antialias 只作用于默认帧缓冲区，
  // 走 composer 之后场景是渲染到离屏缓冲的，不开的话边缘会明显出现锯齿。
  composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType }));
  composer.addPass(new RenderPass(scene, camera));
  bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), BLOOM_STRENGTH, BLOOM_RADIUS, BLOOM_THRESHOLD);
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());
  applyViewportSize();
  starfield = createStarfield(); scene.add(starfield);
  cubeEdges = createCubeEdges(FACE_SIZE, '#9fd8ff'); scene.add(cubeEdges.object);
  hemi = new THREE.HemisphereLight('#b4d9ff', '#09101d', 0.9); scene.add(hemi);
  key = new THREE.DirectionalLight('#ffffff', 1.4); key.castShadow = true;
  // DirectionalLight 默认的阴影相机取景范围只有左右上下各 5 个单位，
  // 而每个面是 48×48，绝大部分物体根本不在阴影相机的取景范围内，
  // 导致大范围阴影缺失/错位、看起来像光影完全不对。这里把取景范围扩大到能覆盖整个面。
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -30; key.shadow.camera.right = 30;
  key.shadow.camera.top = 30; key.shadow.camera.bottom = -30;
  key.shadow.camera.near = 1; key.shadow.camera.far = 80;
  key.shadow.bias = -0.0005;
  scene.add(key); scene.add(key.target);
  faces = new Array(6).fill(null);
  wireLoadingUI();
  loadFace(SPAWN_FACE);   // 出生面单独先加载，其余面等它就绪后才进队列（见 loadNextFaces）
  creature = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 2), new THREE.MeshStandardMaterial({ color: '#f3d3a4', roughness: 0.48, emissive: '#1b0817', emissiveIntensity: 0.3 })); creature.castShadow = true; scene.add(creature);
  // 光环三件套：细圆环（跟着面法线转）+ 外层光晕（Sprite，永远正对相机）+ 贴地光圈（位置见 placeGroundGlow）
  haloRing = new THREE.Mesh(new THREE.TorusGeometry(0.53, 0.028, 8, 32), new THREE.MeshBasicMaterial({ color: '#f8dd9b', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  haloAura = createHaloAura();
  halo = new THREE.Group(); halo.add(haloRing, haloAura); scene.add(halo);
  groundGlow = createGroundGlow(); scene.add(groundGlow);
  spawnOnFace(SPAWN_FACE); setupEvents();
}
function setupEvents() {
  addEventListener('resize', applyViewportSize);
  addEventListener('keydown', e => {
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight'].includes(e.code)) keys.add(e.code);
    if (e.code === 'Space') { e.preventDefault(); if (grounded) { verticalVelocity = JUMP_SPEED; grounded = false; playJump(); } }
    // 静音开关。浏览器不允许没有用户手势就出声，所以这里先确保音频已经启动再切。
    if (e.code === 'KeyM') { startAudio(currentFace); ui.mute.textContent = toggleMute() ? 'M 音效：关' : 'M 音效：开'; }
  }); addEventListener('keyup', e => keys.delete(e.code));
  renderer.domElement.addEventListener('click', () => { startAudio(currentFace); renderer.domElement.requestPointerLock(); }); document.addEventListener('pointerlockchange', () => { pointerLocked = document.pointerLockElement === renderer.domElement; ui.prompt.classList.toggle('hidden', pointerLocked); playUi(); }); document.addEventListener('mousemove', e => { if (pointerLocked) { yaw += e.movementX * 0.0028; pitch = THREE.MathUtils.clamp(pitch - e.movementY * 0.0025, PITCH_LIMIT_DOWN, PITCH_LIMIT_UP); } });
}
function wireLoadingUI() {
  loadingManager.onStart = () => ui.loader.classList.add('active');
  loadingManager.onProgress = (_url, loaded, total) => { ui.loaderFill.style.width = (total > 0 ? Math.round(loaded / total * 100) : 0) + '%'; };
  loadingManager.onLoad = () => ui.loader.classList.remove('active');
  loadingManager.onError = (url) => console.error('资源加载失败：', url);
}
// 建一个面并把它的模型加载排进队列。faceMakers 是同步返回的（只有模型本身异步加载），
// 所以 faces[id] 立刻就有值，animate() 里的 faces[currentFace] 不会出现 undefined。
function loadFace(id) {
  activeFaceLoads++;
  let face = null;
  // 闭包要先声明 face 再引用它；onReady 是异步触发的，那时 face 一定已经赋值好了
  face = faceMakers[id](scene, FACE_SIZE, FACE_BASES[id], () => {
    activeFaceLoads--;
    if (id === SPAWN_FACE) spawnFaceReady = true;
    attachShadowCasters(face);
    updateFaceVisibility();
    loadNextFaces();
  });
  faces[id] = face;
  attachAmbience(id, face);
  updateFaceVisibility();
  return face;
}
// 把这一面的氛围粒子挂上去。挂在面自己的 group 下（局部 +Y 就是该面法线），所以它会跟着
// 按面剔除一起开关，不用单独管理。更新接到 face.update 上：翻面过程中 animateFaceTransition
// 会对前后两个面各调一次，粒子不会卡在原地。
function attachAmbience(id, face) {
  const config = AMBIENCE[id];
  if (!config) return;
  const ambience = createAmbience(config);
  face.group.add(ambience.object);
  const innerUpdate = face.update;
  face.update = (delta, elapsed) => { innerUpdate(delta, elapsed); ambience.update(delta, elapsed); };
}
// 落地光圈贴着当前面的地表：把角色位置沿法线压回地表，再抬 0.02 避免与地面 z-fighting。
function placeGroundGlow(normal) {
  const height = creature.position.dot(normal) - FACE_SIZE / 2;
  groundGlow.position.copy(creature.position).addScaledVector(normal, 0.02 - height);
  groundGlow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
}
// 玩家有可能比队列先走到某个面，这时现场把它建出来；队列轮到它时会走上面这条短路，不会重复建。
function ensureFace(id) { return faces[id] || loadFace(id); }
function loadNextFaces() {
  if (!spawnFaceReady) return;   // 出生面就绪前不启动队列，让它独占带宽先出画面
  while (activeFaceLoads < MAX_CONCURRENT_FACE_LOADS && faceLoadIndex < FACE_LOAD_ORDER.length) loadFace(FACE_LOAD_ORDER[faceLoadIndex++]);
}
// 按面剔除：六个面都常驻在场景里，站在 face0 时另外五个面的所有网格仍在参与主渲染和阴影两遍遍历。
// three.js 碰到 visible=false 会把整棵子树直接跳过（WebGLRenderer.projectObject 和
// WebGLShadowMap.renderObject 都有这个早退），所以按面关掉能同时省掉这两遍开销。
function updateFaceVisibility() {
  const shown = faceTransition ? [faceTransition.previousFace, faceTransition.nextFace] : [currentFace];
  faces.forEach((face, id) => { if (face) face.group.visible = shown.includes(id); });
}
function attachShadowCasters(face) {
  face.group.traverse((object) => {
    if (!object.isMesh) return;
    // 用世界空间包围盒判断体量：各面模型自带缩放（比如 face3 缩到 0.446），按几何体本地尺寸会误判
    shadowBox.setFromObject(object).getSize(shadowSize);
    object.castShadow = Math.max(shadowSize.x, shadowSize.y, shadowSize.z) >= SHADOW_CASTER_MIN_SIZE;
  });
}
function updateAdaptiveResolution(delta) {
  const now = performance.now();
  // 预热：刚启动那几秒要解析几个大模型，帧时间天然很长，用它当依据会一开始就把分辨率压到底。
  // 页面切到后台时 rAF 会被浏览器节流，帧时间同样不可信，也要跳过。
  if (now - BOOT_TIME < 3000 || document.hidden) return;
  frameTimeAvg += (delta * 1000 - frameTimeAvg) * 0.05;   // 慢速指数平均，不被单帧尖刺带偏
  if (now - lastPixelRatioChange < 700) return;
  if (frameTimeAvg > 22 && pixelRatio > PIXEL_RATIO_MIN) pixelRatio = Math.max(PIXEL_RATIO_MIN, pixelRatio - 0.25);
  else if (frameTimeAvg < 13.5 && pixelRatio < PIXEL_RATIO_MAX) pixelRatio = Math.min(PIXEL_RATIO_MAX, pixelRatio + 0.25);
  else return;
  lastPixelRatioChange = now;
  applyViewportSize();
}
// renderer 和后处理链必须同步尺寸与像素比，否则 composer 会按错误的尺寸渲染（画面被拉伸或发糊）。
// 窗口尺寸变化和自适应分辨率都统一走这里。
function applyViewportSize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(innerWidth, innerHeight);
  composer.setPixelRatio(pixelRatio);
  composer.setSize(innerWidth, innerHeight);
}
function updateKeyLight(basis, target) {
  keyLightPosition.copy(target)
    .addScaledVector(basis.normal, sunOffset.height)
    .addScaledVector(basis.forward, sunOffset.forward)
    .addScaledVector(basis.right, sunOffset.right);
  key.position.copy(keyLightPosition);
  key.target.position.copy(target);
  key.target.updateMatrixWorld();
}
function normalizeLighting(cfg) {
  return {
    background: new THREE.Color(cfg.background), fogColor: new THREE.Color(cfg.fogColor), fogDensity: cfg.fogDensity,
    hemiSky: new THREE.Color(cfg.hemiSky), hemiGround: new THREE.Color(cfg.hemiGround), hemiIntensity: cfg.hemiIntensity,
    sunColor: new THREE.Color(cfg.sunColor), sunIntensity: cfg.sunIntensity,
    sunHeight: cfg.sunHeight, sunForward: cfg.sunForward, sunRight: cfg.sunRight,
  };
}
// 逐帧把当前光照往目标推近。跨面时是渐变而不是硬切，眼睛不会被突然的明暗跳变刺到。
function updateLighting(delta) {
  if (!lightingTarget) return;
  if (!lightingCurrent) lightingCurrent = normalizeLighting(DEFAULT_LIGHTING);
  // 第一帧直接对齐到当前面的参数（否则开局会从默认值慢慢淡过去，像是一进场灯光在变脸）
  const k = lightingReady ? 1 - Math.exp(-3.5 * delta) : 1;
  lightingReady = true;
  const mix = (from, to) => from + (to - from) * k;
  lightingCurrent.background.lerp(lightingTarget.background, k);
  lightingCurrent.fogColor.lerp(lightingTarget.fogColor, k);
  lightingCurrent.hemiSky.lerp(lightingTarget.hemiSky, k);
  lightingCurrent.hemiGround.lerp(lightingTarget.hemiGround, k);
  lightingCurrent.sunColor.lerp(lightingTarget.sunColor, k);
  lightingCurrent.fogDensity = mix(lightingCurrent.fogDensity, lightingTarget.fogDensity);
  lightingCurrent.hemiIntensity = mix(lightingCurrent.hemiIntensity, lightingTarget.hemiIntensity);
  lightingCurrent.sunIntensity = mix(lightingCurrent.sunIntensity, lightingTarget.sunIntensity);
  lightingCurrent.sunHeight = mix(lightingCurrent.sunHeight, lightingTarget.sunHeight);
  lightingCurrent.sunForward = mix(lightingCurrent.sunForward, lightingTarget.sunForward);
  lightingCurrent.sunRight = mix(lightingCurrent.sunRight, lightingTarget.sunRight);

  scene.background.copy(lightingCurrent.background);
  scene.fog.color.copy(lightingCurrent.fogColor);
  scene.fog.density = lightingCurrent.fogDensity;
  hemi.color.copy(lightingCurrent.hemiSky);
  hemi.groundColor.copy(lightingCurrent.hemiGround);
  hemi.intensity = lightingCurrent.hemiIntensity;
  key.color.copy(lightingCurrent.sunColor);
  key.intensity = lightingCurrent.sunIntensity;
  sunOffset.height = lightingCurrent.sunHeight;
  sunOffset.forward = lightingCurrent.sunForward;
  sunOffset.right = lightingCurrent.sunRight;
}
function spawnOnFace(id) { currentFace = id; creature.position.copy(faces[id].spawnPosition); yaw = faces[id].spawnYaw ?? 0; stepDistance = 0; setFaceAudio(id); updateFacePresentation(); updateFaceVisibility(); }
function updateFacePresentation() { const face = faces[currentFace]; ui.title.textContent = face.name; ui.culture.textContent = face.culture; ui.gravity.textContent = face.gravity; ui.being.textContent = face.being; creature.material.color.set(face.creatureColor); haloRing.material.color.set(face.accent); haloAura.material.color.set(face.accent); groundGlow.material.color.set(face.accent); cubeEdges.material.color.set(face.accent); lightingTarget = normalizeLighting({ ...DEFAULT_LIGHTING, ...(face.lighting || {}) }); }
function setMovementAxes(basis) { tempForward.copy(basis.forward).multiplyScalar(Math.cos(yaw)).addScaledVector(basis.right, Math.sin(yaw)); tempRight.copy(basis.right).multiplyScalar(Math.cos(yaw)).addScaledVector(basis.forward, -Math.sin(yaw)); }
function animate() {
  requestAnimationFrame(animate); const delta = Math.min(clock.getDelta(), .05); updateAdaptiveResolution(delta); updateAudio(delta);
  // 星空极慢自转，静止的天空会显得像贴图
  starfield.rotation.y += delta * 0.006;
  if (faceTransition) { animateFaceTransition(delta); updateLighting(delta); composer.render(); return; }
  const face = faces[currentFace], basis = FACE_BASES[currentFace];
  setMovementAxes(basis);
  tempView.copy(tempForward).multiplyScalar(Math.cos(pitch)).addScaledVector(basis.normal, Math.sin(pitch));
  const forwardMovement = tempForward;
  tempMove.set(0, 0, 0); if (keys.has('KeyW')) tempMove.add(forwardMovement); if (keys.has('KeyS')) tempMove.sub(forwardMovement); if (keys.has('KeyD')) tempMove.add(tempRight); if (keys.has('KeyA')) tempMove.sub(tempRight);
  if (tempMove.lengthSq()) { const run = keys.has('ShiftLeft') || keys.has('ShiftRight'); tempMove.normalize().multiplyScalar(SPEED * face.speedMultiplier * (run ? RUN_MULTIPLIER : 1) * delta); stepFrom.copy(creature.position); moveCreatureWithCollisions(face, tempMove); updateFootsteps(creature.position.distanceTo(stepFrom), run); if (constrainToCube(tempForward)) { animateFaceTransition(delta); composer.render(); return; } }
  const activeBasis = FACE_BASES[currentFace];
  verticalVelocity -= GRAVITY * delta; creature.position.addScaledVector(activeBasis.normal, verticalVelocity * delta);
  const surfaceDistance = creature.position.dot(activeBasis.normal) - FACE_SIZE / 2;
  const minimumHeight = CREATURE_HEIGHT;
  if (surfaceDistance <= minimumHeight) { creature.position.addScaledVector(activeBasis.normal, minimumHeight - surfaceDistance); verticalVelocity = 0; if (!grounded) playLand(); grounded = true; }
  else grounded = false;
  setMovementAxes(activeBasis); creature.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), activeBasis.normal); halo.position.copy(creature.position).addScaledVector(activeBasis.normal, -.38); halo.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), activeBasis.normal); halo.rotateZ(clock.elapsedTime * .45); placeGroundGlow(activeBasis.normal);
  faces[currentFace].update(delta, clock.elapsedTime); updateKeyLight(activeBasis, creature.position); updateLighting(delta); updateCamera(activeBasis, delta); composer.render();
}
// 累计实际位移，攒够一个步幅就响一声。空中不迈步（落地那一下另外有 playLand）。
function updateFootsteps(distance, running) {
  if (!grounded) return;
  stepDistance += distance;
  if (stepDistance < (running ? STRIDE_RUN : STRIDE_WALK)) return;
  stepDistance = 0;
  playFootstep();
}
function moveCreatureWithCollisions(face, movement) {
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
}
function constrainToCube(heading) {
  const previousFace = currentFace, previousBasis = FACE_BASES[previousFace], half = FACE_SIZE / 2;
  // Use the contact point rather than the creature centre, so jumping cannot block an edge crossing.
  const heightAboveSurface = creature.position.dot(previousBasis.normal) - half;
  const contactPoint = creature.position.clone().addScaledVector(previousBasis.normal, -heightAboveSurface);
  const nextFace = getFaceAtPosition(contactPoint);
  if (nextFace !== previousFace) {
    const rotation = new THREE.Quaternion().setFromUnitVectors(FACE_BASES[previousFace].normal, FACE_BASES[nextFace].normal);
    const foldedHeading = heading.clone().applyQuaternion(rotation);
    const nextBasis = FACE_BASES[nextFace];
    const nextYaw = Math.atan2(foldedHeading.dot(nextBasis.right), foldedHeading.dot(nextBasis.forward));
    const edgeAnchor = contactPoint.clone();
    edgeAnchor.x = THREE.MathUtils.clamp(edgeAnchor.x, -half, half); edgeAnchor.y = THREE.MathUtils.clamp(edgeAnchor.y, -half, half); edgeAnchor.z = THREE.MathUtils.clamp(edgeAnchor.z, -half, half);
    const startPosition = edgeAnchor.clone().addScaledVector(previousBasis.normal, heightAboveSurface);
    const endPosition = edgeAnchor.clone().addScaledVector(nextBasis.normal, heightAboveSurface);
    const startQuaternion = creature.quaternion.clone();
    const endQuaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), nextBasis.normal);
    const cameraStartPosition = camera.position.clone(), cameraStartQuaternion = camera.quaternion.clone();
    const foldedView = foldedHeading.clone().multiplyScalar(Math.cos(pitch)).addScaledVector(nextBasis.normal, Math.sin(pitch));
    const cameraEndPosition = endPosition.clone().addScaledVector(foldedView, -CAMERA_DISTANCE);
    const nextMinHeight = half + CAMERA_MIN_CLEARANCE;
    const cameraEndHeight = cameraEndPosition.dot(nextBasis.normal);
    if (cameraEndHeight < nextMinHeight) cameraEndPosition.addScaledVector(nextBasis.normal, nextMinHeight - cameraEndHeight);
    const cameraEndQuaternion = getCameraQuaternion(nextBasis, foldedHeading);
    faceTransition = { startedAt: performance.now(), duration: 700, previousFace, nextFace, nextYaw, edgeAnchor, rotation, startPosition, endPosition, startQuaternion, endQuaternion, cameraStartPosition, cameraEndPosition, cameraStartQuaternion, cameraEndQuaternion };
    playFlip();
    // 环境音在翻面一开始就切过去：淡入用 1.4 秒，正好压过 700ms 的翻转动画，落到新面时新环境音已经起来了
    setFaceAudio(nextFace);
    stepDistance = 0;
    creature.position.copy(startPosition);
    ensureFace(nextFace);     // 玩家有可能比加载队列先走到这个面
    updateFaceVisibility();   // 翻面过程中，这一对相邻面都要可见
    return true;
  }
  const normal = FACE_BASES[currentFace].normal;
  creature.position.set(normal.x ? normal.x * (half + heightAboveSurface) : THREE.MathUtils.clamp(contactPoint.x, -half, half), normal.y ? normal.y * (half + heightAboveSurface) : THREE.MathUtils.clamp(contactPoint.y, -half, half), normal.z ? normal.z * (half + heightAboveSurface) : THREE.MathUtils.clamp(contactPoint.z, -half, half));
  return false;
}
function animateFaceTransition() {
  const transition = faceTransition;
  const raw = Math.min((performance.now() - transition.startedAt) / transition.duration, 1);
  const t = raw * raw * (3 - 2 * raw); // smooth start/end, like walking around a physical edge
  const partialTurn = new THREE.Quaternion().slerpQuaternions(new THREE.Quaternion(), transition.rotation, t);
  creature.position.copy(transition.startPosition).sub(transition.edgeAnchor).applyQuaternion(partialTurn).add(transition.edgeAnchor);
  creature.quaternion.slerpQuaternions(transition.startQuaternion, transition.endQuaternion, t);
  const transitionNormal = FACE_BASES[transition.previousFace].normal.clone().lerp(FACE_BASES[transition.nextFace].normal, t).normalize();
  halo.position.copy(creature.position).addScaledVector(transitionNormal, -.38); halo.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), transitionNormal); halo.rotateZ(clock.elapsedTime * .45); placeGroundGlow(transitionNormal);
  camera.position.lerpVectors(transition.cameraStartPosition, transition.cameraEndPosition, t);
  camera.quaternion.slerpQuaternions(transition.cameraStartQuaternion, transition.cameraEndQuaternion, t);
  keyLightBasis.normal.copy(FACE_BASES[transition.previousFace].normal).applyQuaternion(partialTurn);
  keyLightBasis.right.copy(FACE_BASES[transition.previousFace].right).applyQuaternion(partialTurn);
  keyLightBasis.forward.copy(FACE_BASES[transition.previousFace].forward).applyQuaternion(partialTurn);
  updateKeyLight(keyLightBasis, creature.position);
  faces[transition.previousFace].update(0, clock.elapsedTime); faces[transition.nextFace].update(0, clock.elapsedTime);
  if (raw === 1) {
    currentFace = transition.nextFace; yaw = transition.nextYaw; creature.position.copy(transition.endPosition); cameraPosition.copy(transition.cameraEndPosition); faceTransition = null; updateFacePresentation(); updateFaceVisibility();
  }
}
function getCameraQuaternion(basis, heading) {
  const right = heading.clone().cross(basis.normal).normalize();
  const view = heading.clone().multiplyScalar(Math.cos(pitch)).addScaledVector(basis.normal, Math.sin(pitch));
  const up = basis.normal.clone().multiplyScalar(Math.cos(pitch)).addScaledVector(heading, -Math.sin(pitch));
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, view.negate()));
}
function updateCamera(basis, delta) {
  tempView.copy(tempForward).multiplyScalar(Math.cos(pitch)).addScaledVector(basis.normal, Math.sin(pitch));
  tempCameraUp.copy(basis.normal).multiplyScalar(Math.cos(pitch)).addScaledVector(tempForward, -Math.sin(pitch));
  // Orbit around the creature rather than looking past it, keeping the player at screen centre.
  desiredCameraPosition.copy(creature.position).addScaledVector(tempView, -CAMERA_DISTANCE);
  // 保险丝：无论俯仰角多大，都不允许镜头的高度低于本面的地面——否则镜头会钻到
  // 单面渲染的地板背后，穿模看到相邻的面。
  const minHeight = FACE_SIZE / 2 + CAMERA_MIN_CLEARANCE;
  const currentHeight = desiredCameraPosition.dot(basis.normal);
  if (currentHeight < minHeight) desiredCameraPosition.addScaledVector(basis.normal, minHeight - currentHeight);
  cameraPosition.lerp(desiredCameraPosition, 1 - Math.exp(-9 * delta)); camera.position.copy(cameraPosition);
  camera.quaternion.setFromRotationMatrix(cameraMatrix.makeBasis(tempRight, tempCameraUp, tempView.clone().negate()));
}
