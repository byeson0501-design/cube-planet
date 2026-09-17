import * as THREE from 'three';
import { createFace as createFace0 } from './face0.js';
import { createFace as createFace1 } from './face1.js';
import { createFace as createFace2 } from './face2.js';
import { createFace as createFace3 } from './face3.js';
import { createFace as createFace4 } from './face4.js';
import { createFace as createFace5 } from './face5.js';
import { FACE_BASES, getFaceAtPosition, loadingManager } from './face-utils.js';
import './styles.css';

const faceMakers = [createFace0, createFace1, createFace2, createFace3, createFace4, createFace5];
const FACE_SIZE = 48, CREATURE_HEIGHT = 0.52, CREATURE_RADIUS = 0.42, SPEED = 5.4, RUN_MULTIPLIER = 1.85, JUMP_SPEED = 6.4, GRAVITY = 16;
const CAMERA_DISTANCE = 5.1, CAMERA_MIN_CLEARANCE = 0.4, PITCH_LIMIT_DOWN = -1.3, PITCH_LIMIT_UP = 1.05;
let scene, camera, renderer, hemi, key, creature, halo, faces = [], currentFace = 0, yaw = 0, pitch = 0, pointerLocked = false, verticalVelocity = 0, grounded = true, faceTransition = null;
const keys = new Set(), clock = new THREE.Clock(), cameraPosition = new THREE.Vector3(), desiredCameraPosition = new THREE.Vector3(), tempForward = new THREE.Vector3(), tempRight = new THREE.Vector3(), tempView = new THREE.Vector3(), tempCameraUp = new THREE.Vector3(), tempMove = new THREE.Vector3(), cameraMatrix = new THREE.Matrix4(), keyLightPosition = new THREE.Vector3(), keyLightBasis = { normal: new THREE.Vector3(), right: new THREE.Vector3(), forward: new THREE.Vector3() };
const ui = { title: document.querySelector('[data-face-title]'), culture: document.querySelector('[data-culture]'), gravity: document.querySelector('[data-gravity]'), being: document.querySelector('[data-being]'), prompt: document.querySelector('.start-prompt'), loader: document.querySelector('.loader'), loaderFill: document.querySelector('.loader-fill') };

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

init(); animate();
function init() {
  scene = new THREE.Scene(); scene.background = new THREE.Color('#061018'); scene.fog = new THREE.FogExp2('#061018', 0.018);
  camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 180);
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.shadowMap.enabled = true; document.querySelector('#app').appendChild(renderer.domElement);
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
  const TEST_FACE = 3;
  faces = new Array(6).fill(null);
  faces[TEST_FACE] = faceMakers[TEST_FACE](scene, FACE_SIZE, FACE_BASES[TEST_FACE]);
  wireLoadingUI();
  creature = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 2), new THREE.MeshStandardMaterial({ color: '#f3d3a4', roughness: 0.48, emissive: '#1b0817', emissiveIntensity: 0.3 })); creature.castShadow = true; scene.add(creature);
  halo = new THREE.Mesh(new THREE.TorusGeometry(0.53, 0.028, 8, 32), new THREE.MeshBasicMaterial({ color: '#f8dd9b', transparent: true, opacity: 0.75 })); scene.add(halo);
  spawnOnFace(TEST_FACE); setupEvents();
}
function setupEvents() {
  addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
  addEventListener('keydown', e => {
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight'].includes(e.code)) keys.add(e.code);
    if (e.code === 'Space') { e.preventDefault(); if (grounded) { verticalVelocity = JUMP_SPEED; grounded = false; } }
  }); addEventListener('keyup', e => keys.delete(e.code));
  renderer.domElement.addEventListener('click', () => renderer.domElement.requestPointerLock()); document.addEventListener('pointerlockchange', () => { pointerLocked = document.pointerLockElement === renderer.domElement; ui.prompt.classList.toggle('hidden', pointerLocked); }); document.addEventListener('mousemove', e => { if (pointerLocked) { yaw += e.movementX * 0.0028; pitch = THREE.MathUtils.clamp(pitch - e.movementY * 0.0025, PITCH_LIMIT_DOWN, PITCH_LIMIT_UP); } });
}
function wireLoadingUI() {
  loadingManager.onStart = () => ui.loader.classList.add('active');
  loadingManager.onProgress = (_url, loaded, total) => { ui.loaderFill.style.width = (total > 0 ? Math.round(loaded / total * 100) : 0) + '%'; };
  loadingManager.onLoad = () => ui.loader.classList.remove('active');
  loadingManager.onError = (url) => console.error('资源加载失败：', url);
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
function spawnOnFace(id) { currentFace = id; creature.position.copy(faces[id].spawnPosition); yaw = faces[id].spawnYaw ?? 0; updateFacePresentation(); }
function updateFacePresentation() { const face = faces[currentFace]; ui.title.textContent = face.name; ui.culture.textContent = face.culture; ui.gravity.textContent = face.gravity; ui.being.textContent = face.being; creature.material.color.set(face.creatureColor); halo.material.color.set(face.accent); lightingTarget = normalizeLighting({ ...DEFAULT_LIGHTING, ...(face.lighting || {}) }); }
function setMovementAxes(basis) { tempForward.copy(basis.forward).multiplyScalar(Math.cos(yaw)).addScaledVector(basis.right, Math.sin(yaw)); tempRight.copy(basis.right).multiplyScalar(Math.cos(yaw)).addScaledVector(basis.forward, -Math.sin(yaw)); }
function animate() {
  requestAnimationFrame(animate); const delta = Math.min(clock.getDelta(), .05);
  if (faceTransition) { animateFaceTransition(delta); updateLighting(delta); renderer.render(scene, camera); return; }
  const face = faces[currentFace], basis = FACE_BASES[currentFace];
  setMovementAxes(basis);
  tempView.copy(tempForward).multiplyScalar(Math.cos(pitch)).addScaledVector(basis.normal, Math.sin(pitch));
  const forwardMovement = tempForward;
  tempMove.set(0, 0, 0); if (keys.has('KeyW')) tempMove.add(forwardMovement); if (keys.has('KeyS')) tempMove.sub(forwardMovement); if (keys.has('KeyD')) tempMove.add(tempRight); if (keys.has('KeyA')) tempMove.sub(tempRight);
  if (tempMove.lengthSq()) { const run = keys.has('ShiftLeft') || keys.has('ShiftRight'); tempMove.normalize().multiplyScalar(SPEED * face.speedMultiplier * (run ? RUN_MULTIPLIER : 1) * delta); moveCreatureWithCollisions(face, tempMove); if (constrainToCube(tempForward)) { animateFaceTransition(); renderer.render(scene, camera); return; } }
  const activeBasis = FACE_BASES[currentFace];
  verticalVelocity -= GRAVITY * delta; creature.position.addScaledVector(activeBasis.normal, verticalVelocity * delta);
  const surfaceDistance = creature.position.dot(activeBasis.normal) - FACE_SIZE / 2;
  const minimumHeight = CREATURE_HEIGHT;
  if (surfaceDistance <= minimumHeight) { creature.position.addScaledVector(activeBasis.normal, minimumHeight - surfaceDistance); verticalVelocity = 0; grounded = true; }
  else grounded = false;
  setMovementAxes(activeBasis); creature.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), activeBasis.normal); halo.position.copy(creature.position).addScaledVector(activeBasis.normal, -.38); halo.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), activeBasis.normal); halo.rotateZ(clock.elapsedTime * .45);
  faces[currentFace].update(delta, clock.elapsedTime); updateKeyLight(activeBasis, creature.position); updateLighting(delta); updateCamera(activeBasis, delta); renderer.render(scene, camera);
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
    creature.position.copy(startPosition);
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
  halo.position.copy(creature.position).addScaledVector(transitionNormal, -.38); halo.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), transitionNormal); halo.rotateZ(clock.elapsedTime * .45);
  camera.position.lerpVectors(transition.cameraStartPosition, transition.cameraEndPosition, t);
  camera.quaternion.slerpQuaternions(transition.cameraStartQuaternion, transition.cameraEndQuaternion, t);
  keyLightBasis.normal.copy(FACE_BASES[transition.previousFace].normal).applyQuaternion(partialTurn);
  keyLightBasis.right.copy(FACE_BASES[transition.previousFace].right).applyQuaternion(partialTurn);
  keyLightBasis.forward.copy(FACE_BASES[transition.previousFace].forward).applyQuaternion(partialTurn);
  updateKeyLight(keyLightBasis, creature.position);
  faces[transition.previousFace].update(0, clock.elapsedTime); faces[transition.nextFace].update(0, clock.elapsedTime);
  if (raw === 1) {
    currentFace = transition.nextFace; yaw = transition.nextYaw; creature.position.copy(transition.endPosition); cameraPosition.copy(transition.cameraEndPosition); faceTransition = null; updateFacePresentation();
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
