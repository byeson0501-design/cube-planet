// 全部音频都是 Web Audio 程序化合成的，不引入任何音频文件——所以体积为 0，也不会有版权问题。
//
// 三条总线：
//   master ├─ musicGain     背景 pad
//          ├─ ambienceGain  每面一套环境音链，同时在跑、靠增益交叉淡入淡出
//          └─ sfxGain       脚步/跳跃/落地/翻面/UI 这些一次性音效
//
// 浏览器要求 AudioContext 必须在用户手势之后才能出声，所以这里不在模块加载时就创建，
// 而是等 startAudio()（由「点击屏幕开始」触发）。

let ctx, master, musicGain, ambienceGain, sfxGain, noiseBuffer;
const ambiences = new Map();   // faceId -> { out, gain, events, timer }
let activeFace = 0, started = false, muted = false, masterLevel = 0.9;

const rand = (lo, hi) => lo + Math.random() * (hi - lo);

function makeNoiseBuffer() {
  const seconds = 2;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}
const gain = (value = 0) => { const g = ctx.createGain(); g.gain.value = value; return g; };
const osc = (type, freq) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; return o; };
const filter = (type, freq, q = 1) => { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; return f; };
const noise = () => { const s = ctx.createBufferSource(); s.buffer = noiseBuffer; s.loop = true; return s; };
// 给某个 AudioParam 叠一层慢速正弦起伏，参数自身的当前值就是中心值。
// 用途是让长音「呼吸」起来——纯静态的振荡器听起来很死。
function slowLfo(param, freq, depth) {
  const o = osc('sine', freq); const g = gain(depth);
  o.connect(g).connect(param); o.start();
  return o;
}

// ── 每个面的环境音 ────────────────────────────────────────────────
// 每个 builder 返回该面独立的输出节点（已经接到 ambienceGain），内部自带常驻声源。
// 六个面同时存在、只有当前面的增益是打开的，所以切面时是交叉淡入而不是硬切。
const ambienceBuilders = {
  // 0 教堂：管风琴式低频长音（几个泛音叠加）+ 一点空气底噪
  0() {
    const out = gain(0);
    for (const [freq, level] of [[55, 0.5], [82.5, 0.3], [110, 0.22], [165, 0.13]]) {
      const o = osc('sine', freq); const g = gain(level);
      o.connect(g).connect(out); o.start();
      slowLfo(g.gain, rand(0.05, 0.11), level * 0.35);
    }
    const air = noise(); const lp = filter('lowpass', 480); const ag = gain(0.05);
    air.connect(lp).connect(ag).connect(out); air.start();
    return { out };
  },
  // 1 展廊：远处的低语——带通噪声 + 缓慢幅度调制，再叠一点很轻的高频微光
  1() {
    const out = gain(0);
    const whisper = noise(); const bp = filter('bandpass', 850, 3.2); const wg = gain(0.1);
    whisper.connect(bp).connect(wg).connect(out); whisper.start();
    slowLfo(wg.gain, 0.23, 0.06);
    const shimmer = osc('sine', 2093); const sg = gain(0.011);
    shimmer.connect(sg).connect(out); shimmer.start();
    slowLfo(sg.gain, 0.11, 0.008);
    return { out };
  },
  // 2 书苑：室外柔和气声 + 偶尔一阵翻书/叶动
  2() {
    const out = gain(0);
    const air = noise(); const lp = filter('lowpass', 700); const ag = gain(0.055);
    air.connect(lp).connect(ag).connect(out); air.start();
    slowLfo(ag.gain, 0.09, 0.025);
    return {
      out,
      events: [{ every: [5, 13], play: () => { noiseBurst(2400, 0.9, 0.5, 0.05, 'highpass'); } }],
    };
  },
  // 3 溶洞：低频轰鸣打底，定时落水滴（水滴用短促的下降音高 + 一点延迟做出洞壁回响）
  3() {
    const out = gain(0);
    const rumble = noise(); const lp = filter('lowpass', 180); const rg = gain(0.14);
    rumble.connect(lp).connect(rg).connect(out); rumble.start();
    return {
      out,
      events: [{ every: [1.6, 5.5], play: () => { drip(out); } }],
    };
  },
  // 4 工业遗迹：穿堂风（带共振的带通噪声）+ 偶尔金属吱呀
  4() {
    const out = gain(0);
    const wind = noise(); const bp = filter('bandpass', 340, 6); const wg = gain(0.1);
    wind.connect(bp).connect(wg).connect(out); wind.start();
    slowLfo(wg.gain, 0.07, 0.05);
    slowLfo(bp.frequency, 0.05, 130);
    return {
      out,
      events: [{ every: [6, 16], play: () => { creak(out); } }],
    };
  },
  // 5 庭院：风吹树叶的沙沙声（高通噪声 + 快速小幅调制）+ 一管很轻的箫音
  5() {
    const out = gain(0);
    const leaves = noise(); const hp = filter('highpass', 1800); const lg = gain(0.085);
    leaves.connect(hp).connect(lg).connect(out); leaves.start();
    slowLfo(lg.gain, 0.19, 0.05);
    slowLfo(lg.gain, 0.031, 0.02);
    const flute = osc('sine', 587.33); const fg = gain(0.02); const vibrato = osc('sine', 4.6); const vg = gain(2.5);
    vibrato.connect(vg).connect(flute.frequency);
    flute.connect(fg).connect(out); flute.start(); vibrato.start();
    slowLfo(fg.gain, 0.055, 0.013);
    return { out };
  },
};

// 水滴：短促的下滑正弦 + 两条延迟线模拟洞壁回响
function drip(destination) {
  const t = ctx.currentTime;
  const o = osc('sine', rand(900, 1500)); const g = gain(0);
  o.connect(g).connect(destination);
  o.frequency.setValueAtTime(o.frequency.value, t);
  o.frequency.exponentialRampToValueAtTime(o.frequency.value * 0.45, t + 0.12);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.07, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  o.start(t); o.stop(t + 0.3);
}

// 金属吱呀：窄带高频噪声 + 缓慢的音高漂移，听起来像锈蚀结构在受力
function creak(destination) {
  const t = ctx.currentTime;
  const src = noise(); const bp = filter('bandpass', rand(700, 1400), 14); const g = gain(0);
  src.connect(bp).connect(g).connect(destination);
  bp.frequency.setValueAtTime(bp.frequency.value, t);
  bp.frequency.linearRampToValueAtTime(bp.frequency.value * rand(1.2, 1.5), t + 0.6);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.045, t + 0.12);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
  src.start(t); src.stop(t + 0.9);
}

// ── 一次性音效 ────────────────────────────────────────────────────
function noiseBurst(freq, q, decay, level, type = 'bandpass') {
  const t = ctx.currentTime;
  const src = noise(); const f = filter(type, freq, q); const g = gain(0);
  src.connect(f).connect(g).connect(sfxGain);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(level, t + 0.006);   // 快速起音，否则听起来是「呼」而不是「啪」
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  src.start(t); src.stop(t + decay + 0.05);
}
function tone(from, to, decay, level, type = 'sine') {
  const t = ctx.currentTime;
  const o = osc(type, from); const g = gain(0);
  o.connect(g).connect(sfxGain);
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + decay);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(level, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  o.start(t); o.stop(t + decay + 0.05);
}

// 每个面的脚步音色：石地、木石、草地、湿石、金属、落叶，靠滤波类型和中心频率区分
const FOOTSTEPS = {
  0: { freq: 520, q: 1.2, decay: 0.16, level: 0.16, type: 'bandpass' },
  1: { freq: 380, q: 1.0, decay: 0.2, level: 0.13, type: 'bandpass' },
  2: { freq: 2600, q: 0.8, decay: 0.13, level: 0.1, type: 'highpass' },
  3: { freq: 300, q: 0.9, decay: 0.26, level: 0.15, type: 'bandpass' },
  4: { freq: 1800, q: 4, decay: 0.24, level: 0.12, type: 'bandpass' },
  5: { freq: 3400, q: 0.7, decay: 0.12, level: 0.09, type: 'highpass' },
};

// ── 背景音乐 ──────────────────────────────────────────────────────
// 五声音阶上的几个根音轮换，每个根音铺一套「根音 + 五度 + 八度 + 十二度」的正弦/三角波，
// 再过一级低通。刻意不放任何打击或明显旋律：它是底噪式的氛围，不是主角。
const MUSIC_ROOTS = [110, 123.47, 146.83, 164.81, 130.81];
let musicVoices = [], musicChordTimer = 0, musicChordIndex = 0;

function buildMusic() {
  musicGain = gain(0);
  const lp = filter('lowpass', 820); lp.connect(musicGain); musicGain.connect(master);
  musicVoices = [];
  const ratios = [1, 1.5, 2, 2.997, 4];
  ratios.forEach((ratio, i) => {
    const o = osc(i % 2 ? 'triangle' : 'sine', MUSIC_ROOTS[0] * ratio);
    const g = gain(0.11 / (i + 1));
    o.connect(g).connect(lp); o.start();
    slowLfo(g.gain, 0.028 + i * 0.017, 0.02);   // 每个声部独立起伏，听起来像呼吸
    musicVoices.push({ o, ratio });
  });
  slowLfo(lp.frequency, 0.019, 300);
}

function advanceChord() {
  musicChordIndex = (musicChordIndex + 1) % MUSIC_ROOTS.length;
  const root = MUSIC_ROOTS[musicChordIndex];
  const t = ctx.currentTime;
  // 用 8 秒的线性滑音换和弦——比直接赋值自然，不会有「换档」感
  musicVoices.forEach(({ o, ratio }) => { o.frequency.linearRampToValueAtTime(root * ratio, t + 8); });
}

// ── 对外接口 ──────────────────────────────────────────────────────
export function startAudio(faceId = 0) {
  if (started) return;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return;                                  // 浏览器不支持就静默跳过，不影响主流程
  ctx = new Ctor();
  // 少数浏览器即使是在用户手势里创建上下文，也可能先给一个 suspended 状态，不 resume 就一直没声。
  if (ctx.state === 'suspended') ctx.resume();
  noiseBuffer = makeNoiseBuffer();
  // 主总线直接到位，只有「氛围层」和「音乐层」做慢淡入。
  // 如果淡的是主总线，第一次点击触发的那声 UI 反馈会几乎听不见，像是没生效。
  master = gain(masterLevel); master.connect(ctx.destination);
  ambienceGain = gain(0); ambienceGain.connect(master);
  sfxGain = gain(0.85); sfxGain.connect(master);
  buildMusic();
  started = true;          // 必须先置位：setFaceAudio 自带 !started 守卫，放在它后面会把整套环境音挡掉
  setFaceAudio(faceId);
  ambienceGain.gain.setValueAtTime(0, ctx.currentTime);
  ambienceGain.gain.linearRampToValueAtTime(1, ctx.currentTime + 2.5);
  musicGain.gain.setValueAtTime(0, ctx.currentTime);
  musicGain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 6);
}

// 静音开关（M 键）。整体总线拉到 0 而不是暂停上下文，
// 这样环境音/音乐都还在原速跑，取消静音时不会出现所有 LFO 相位跳变。
export function toggleMute() {
  if (!started) return false;
  muted = !muted;
  const t = ctx.currentTime;
  master.gain.cancelScheduledValues(t);
  master.gain.setValueAtTime(master.gain.value, t);
  master.gain.linearRampToValueAtTime(muted ? 0 : masterLevel, t + 0.25);
  return muted;
}
export const isMuted = () => muted;

// 切面：目标面的增益拉起来，其余压下去。1.4 秒对得上翻面动画的节奏。
export function setFaceAudio(faceId) {
  if (!started) return;
  activeFace = faceId;
  if (!ambiences.has(faceId)) {
    const built = ambienceBuilders[faceId]();
    built.gain = gain(0);
    built.out.connect(built.gain); built.gain.connect(ambienceGain);
    ambiences.set(faceId, built);
  }
  const t = ctx.currentTime;
  for (const [id, chain] of ambiences) {
    chain.gain.gain.cancelScheduledValues(t);
    chain.gain.gain.setValueAtTime(chain.gain.gain.value, t);
    chain.gain.gain.linearRampToValueAtTime(id === faceId ? 1 : 0, t + (id === faceId ? 1.4 : 0.9));
  }
}

export function playFootstep() {
  if (!started) return;
  const s = FOOTSTEPS[activeFace] || FOOTSTEPS[0];
  noiseBurst(s.freq, s.q, s.decay, s.level, s.type);
}
export function playJump() { if (started) tone(320, 720, 0.18, 0.1); }
export function playLand() {
  if (!started) return;
  noiseBurst(220, 0.9, 0.22, 0.16);
  tone(140, 70, 0.22, 0.13);   // 低频下坠，落地才有重量
}
export function playFlip() {
  if (!started) return;
  // 翻面：带通噪声扫频走一个先上后下的弧线，时长和 700ms 的翻转动画对齐
  const t = ctx.currentTime;
  const src = noise(); const bp = filter('bandpass', 400, 1.1); const g = gain(0);
  src.connect(bp).connect(g).connect(sfxGain);
  bp.frequency.setValueAtTime(300, t);
  bp.frequency.linearRampToValueAtTime(1600, t + 0.34);
  bp.frequency.linearRampToValueAtTime(320, t + 0.7);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.13, t + 0.12);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.72);
  src.start(t); src.stop(t + 0.8);
}
export function playUi() { if (started) tone(1180, 1760, 0.07, 0.055); }

// 每帧调用：驱动环境音里的随机事件和音乐换和弦
export function updateAudio(delta) {
  if (!started) return;
  musicChordTimer += delta;
  if (musicChordTimer > 26) { musicChordTimer = 0; advanceChord(); }
  const chain = ambiences.get(activeFace);
  if (!chain || !chain.events) return;
  for (const event of chain.events) {
    event.timer = (event.timer ?? rand(event.every[0], event.every[1])) - delta;
    if (event.timer <= 0) { event.timer = rand(event.every[0], event.every[1]); event.play(); }
  }
}
