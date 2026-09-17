import * as THREE from 'three';

// 这个模块负责批次 B 的全部「氛围」元素：全部程序化生成，不依赖任何外部贴图资源。
// 粒子/星空都挂在各面自己的 group 下（局部 +Y 就是该面的法线方向），
// 所以它们会自动跟着 A1 的按面剔除一起开关，不需要额外管理。

// 柔和的圆形光斑。星空点、光晕、落地光圈都用它。
function makeRadialTexture(size, inner, mid) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const r = size / 2;
  const gradient = ctx.createRadialGradient(r, r, 0, r, r, r);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(mid[0], mid[1]);
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// 叶片剪影。face5 的落叶用它——用圆点表现落叶会像像素噪点，套一个叶子形状才读得出来。
function makeLeafTexture(size) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const c = size / 2;
  ctx.translate(c, c);
  const gradient = ctx.createLinearGradient(0, -c, 0, c);
  gradient.addColorStop(0, 'rgba(255,206,140,0.95)');
  gradient.addColorStop(0.55, 'rgba(226,138,74,0.9)');
  gradient.addColorStop(1, 'rgba(150,60,40,0.75)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(0, -c * 0.92);
  ctx.bezierCurveTo(c * 0.78, -c * 0.34, c * 0.6, c * 0.5, 0, c * 0.92);
  ctx.bezierCurveTo(-c * 0.6, c * 0.5, -c * 0.78, -c * 0.34, 0, -c * 0.92);
  ctx.fill();
  // 叶脉
  ctx.strokeStyle = 'rgba(90,40,26,0.5)';
  ctx.lineWidth = Math.max(1, size * 0.018);
  ctx.beginPath();
  ctx.moveTo(0, -c * 0.8);
  ctx.lineTo(0, c * 0.8);
  ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// 星云：一张等距柱状投影的噪点云图，贴在大球内壁上做加法混合，负责铺一层很淡的底色。
// 直接在画布上叠若干柔和的彩色光斑，比写噪声 shader 简单得多，视觉上也够用。
function makeNebulaTexture(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.globalCompositeOperation = 'lighter';
  const hues = [[86, 130, 220], [120, 96, 200], [58, 150, 170], [190, 120, 180], [70, 110, 190]];
  for (let i = 0; i < 22; i++) {
    const x = Math.random() * width;
    const y = height * (0.2 + Math.random() * 0.6);
    const radius = width * (0.08 + Math.random() * 0.22);
    const [r, g, b] = hues[i % hues.length];
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(${r},${g},${b},${0.10 + Math.random() * 0.10})`);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// 星空 + 星云。球壳半径取 115：相机最多离原点约 30，远平面 180，从任何一面望出去都在视野内，
// 又完全在 48 单位的星球之外。用 fog:false —— 否则会被各面 0.012~0.032 的雾直接吃掉。
const STARFIELD_RADIUS = 115;
export function createStarfield() {
  const group = new THREE.Group();
  const dot = makeRadialTexture(32, 'rgba(255,255,255,1)', [0.45, 'rgba(255,255,255,0.5)']);
  // 三层不同大小/亮度的星点。PointsMaterial 只有单一的 size，分三层比写自定义 shader 简单，
  // 代价也只是三个 draw call。
  const layers = [
    { count: 3200, size: 0.45, color: '#c8d6ff', opacity: 0.8 },
    { count: 820, size: 0.85, color: '#ffffff', opacity: 0.95 },
    { count: 140, size: 1.5, color: '#ffe2bd', opacity: 1 },
  ];
  for (const layer of layers) {
    const positions = new Float32Array(layer.count * 3);
    for (let i = 0; i < layer.count; i++) {
      // 球面均匀分布，避免星点在两极堆积
      const u = Math.random() * 2 - 1;
      const theta = Math.random() * Math.PI * 2;
      const ring = Math.sqrt(1 - u * u);
      positions[i * 3] = Math.cos(theta) * ring * STARFIELD_RADIUS;
      positions[i * 3 + 1] = u * STARFIELD_RADIUS;
      positions[i * 3 + 2] = Math.sin(theta) * ring * STARFIELD_RADIUS;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      size: layer.size, map: dot, color: layer.color, transparent: true, opacity: layer.opacity,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false, sizeAttenuation: true,
    });
    group.add(new THREE.Points(geometry, material));
  }
  const nebula = new THREE.Mesh(
    new THREE.SphereGeometry(STARFIELD_RADIUS * 1.04, 32, 24),
    new THREE.MeshBasicMaterial({
      map: makeNebulaTexture(1024, 512), side: THREE.BackSide, transparent: true,
      opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }),
  );
  group.add(nebula);
  return group;
}

// 每个面一套氛围粒子。粒子活在面 group 的局部坐标系里，+Y 就是该面的法线方向，
// 所以「上浮/下落」直接写 Y 的增量即可，不用管面朝哪个方向。
export function createAmbience(config) {
  const count = config.count;
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  const phases = new Float32Array(count);
  const spread = config.spread, base = config.base, height = config.height;
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * spread;
    positions[i * 3 + 1] = base + Math.random() * height;
    positions[i * 3 + 2] = (Math.random() - 0.5) * spread;
    speeds[i] = 0.45 + Math.random() * 0.85;
    phases[i] = Math.random() * Math.PI * 2;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    size: config.size, map: config.sprite, color: config.color, transparent: true, opacity: config.opacity,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false, sizeAttenuation: true,
  });
  const points = new THREE.Points(geometry, material);
  const array = geometry.attributes.position.array;
  const top = base + height;
  return {
    object: points,
    // 几百个点的逐帧更新可以忽略不计，而且是分面剔除之后才跑的（不可见的面不会执行到这里）
    update(delta, elapsed) {
      for (let i = 0; i < count; i++) {
        const speed = speeds[i];
        array[i * 3 + 1] += config.rise * speed * delta;
        array[i * 3] += Math.sin(elapsed * 0.33 + phases[i]) * config.sway * speed * delta;
        array[i * 3 + 2] += Math.cos(elapsed * 0.27 + phases[i]) * config.sway * speed * delta;
        if (array[i * 3 + 1] > top) array[i * 3 + 1] = base;
        else if (array[i * 3 + 1] < base) array[i * 3 + 1] = top;
      }
      geometry.attributes.position.needsUpdate = true;
    },
  };
}

// 角色的外层柔和光晕。Sprite 永远正对相机，所以不管角色站在哪个面、什么角度都对。
// 注意别给太大/太亮：它是加法混合又正好在画面中心，一旦过大就会和泛光叠乘、把整幅画面托成一片暖雾。
export function createHaloAura() {
  const aura = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeRadialTexture(128, 'rgba(255,244,214,0.9)', [0.3, 'rgba(255,226,160,0.32)']),
    transparent: true, opacity: 0.34, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  aura.scale.setScalar(1.7);
  return aura;
}
export function createGroundGlow() {
  return new THREE.Mesh(
    new THREE.CircleGeometry(0.85, 32),
    new THREE.MeshBasicMaterial({
      map: makeRadialTexture(128, 'rgba(255,246,220,0.85)', [0.25, 'rgba(255,222,150,0.35)']),
      transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }),
  );
}

// 六面体的 12 条棱：用细圆柱而不是 LineSegments——线宽在多数平台被忽略，
// 永远只有 1 像素，在 4K 屏上会细到看不见。加了泛光之后这些棱会自己发亮。
// 12 条共用一个材质，所以外层改一次颜色就能整组换色。
export function createCubeEdges(size, color) {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const geometry = new THREE.CylinderGeometry(0.07, 0.07, size, 6);
  const half = size / 2;
  const axisVector = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  for (let axis = 0; axis < 3; axis++) {
    // 沿 axis 轴走向的 4 条棱，位置落在另外两个轴的 ±half 组合上
    const others = [0, 1, 2].filter((a) => a !== axis);
    axisVector.set(axis === 0 ? 1 : 0, axis === 1 ? 1 : 0, axis === 2 ? 1 : 0);
    for (const signA of [-1, 1]) for (const signB of [-1, 1]) {
      const mesh = new THREE.Mesh(geometry, material);
      const position = [0, 0, 0];
      position[others[0]] = signA * half;
      position[others[1]] = signB * half;
      mesh.position.set(position[0], position[1], position[2]);
      mesh.quaternion.setFromUnitVectors(up, axisVector);
      group.add(mesh);
    }
  }
  return { object: group, material };
}

// 供各面标定粒子风格用的贴图
export const sprites = {
  soft: () => makeRadialTexture(64, 'rgba(255,255,255,1)', [0.35, 'rgba(255,255,255,0.45)']),
  leaf: () => makeLeafTexture(64),
};
