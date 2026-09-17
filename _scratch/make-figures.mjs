// 生成 Word 报告用的配图。
// 注意：sharp 走的是 librsvg，实测【不支持 CSS 自定义属性 var(--x)】（会渲染成黑色），
// 但支持在 <style> 里用字面色值，也支持中文。所以这里全部用字面色值写 SVG，再栅格化成 PNG。
import { writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const OUT = 'docs/images';
mkdirSync(OUT, { recursive: true });

const C = {
  ink: '#171717', muted: '#52525B', line: '#C9C9CF',
  surfaceMuted: '#EFEFF2', brand: '#4B3FE3', brandSoft: '#EDEBFD', brandText: '#1A1759',
  s1: '#3C2ECA', s2: '#A9AEFF',
};
const FONT = '"Microsoft YaHei", "PingFang SC", "Segoe UI", sans-serif';

const head = (w, h) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
<style>
text { font-family: ${FONT}; }
.t { fill: ${C.ink}; font-size: 14px; }
.th { fill: ${C.ink}; font-size: 15px; font-weight: 500; }
.ts { fill: ${C.muted}; font-size: 13px; }
.tm { fill: ${C.muted}; font-family: Consolas, monospace; font-size: 13px; }
.arr { stroke: ${C.muted}; stroke-width: 1.5; fill: none; stroke-linecap: round; stroke-linejoin: round; }
.leader { stroke: ${C.muted}; stroke-width: 1; fill: none; }
.axis { stroke: ${C.line}; stroke-width: 1.5; fill: none; stroke-linecap: round; }
.surf { stroke: ${C.ink}; stroke-width: 2.5; fill: none; stroke-linecap: round; stroke-linejoin: round; }
.curve { stroke: ${C.brand}; stroke-width: 2; fill: none; stroke-linecap: round; stroke-linejoin: round; }
.boxN { fill: ${C.surfaceMuted}; stroke: ${C.line}; }
.boxB { fill: ${C.brandSoft}; stroke: ${C.brand}; }
.pillN { fill: ${C.surfaceMuted}; stroke: ${C.line}; }
.pillB { fill: ${C.surfaceMuted}; stroke: ${C.brand}; }
.grid { stroke: ${C.line}; stroke-width: 1; }
.conn { stroke: ${C.muted}; stroke-width: 1; fill: none; }
.leaf { fill: ${C.surfaceMuted}; stroke: ${C.line}; }
.rootbox { fill: ${C.brandSoft}; stroke: ${C.brand}; }
.lf { fill: ${C.ink}; font-size: 14px; }
</style>
<rect x="0" y="0" width="${w}" height="${h}" fill="#FFFFFF" />
<defs>
  <marker id="am" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto"><path d="M1 1 L7 4 L1 7 Z" fill="${C.muted}" /></marker>
  <marker id="amb" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto"><path d="M1 1 L7 4 L1 7 Z" fill="${C.brand}" /></marker>
</defs>`;

// ── 图0：设计理念与世界划分 ──────────────────────────────────────
const WORLDS = [
  ['face0', '西风大教堂', '高天圣堂 · 遗迹与彩窗｜羽族旅人'],
  ['face1', '存在回声', '意识展廊 · 藤蔓、浮金与低语文字｜回声行者'],
  ['face2', '拱环书苑', '环廊庭院 · 苔藓、书卷与野花｜书页精灵'],
  ['face3', '幽光溶洞', '古迹回廊 · 苔藓、藤蔓与残柱｜溶洞守灵'],
  ['face4', '锈蚀庭园', '工业遗迹 · 藤蔓、铁锈与废弃管道｜锈蚀拾荒者'],
  ['face5', '和风庭院', '神社庭院 · 苔藓、红叶与鸟居｜庭院狐'],
];
const ROW_H = 44, PITCH = 56, TOP = 144;
let leaves = '';
WORLDS.forEach((w, i) => {
  const y = TOP + i * PITCH, cy = y + ROW_H / 2;
  leaves += `<line class="conn" x1="110" y1="${cy}" x2="150" y2="${cy}" />`;
  leaves += `<rect class="leaf" x="150" y="${y}" width="540" height="${ROW_H}" rx="8" />`;
  leaves += `<text class="lf" x="166" y="${cy + 5}">${w[0]}　${w[1]}</text>`;
  leaves += `<text class="ts" x="674" y="${cy + 4}" text-anchor="end">${w[2]}</text>`;
});
const fig0 = `${head(720, 508)}
<rect class="rootbox" x="250" y="30" width="220" height="52" rx="8" />
<text class="th" x="360" y="54" text-anchor="middle" fill="${C.brandText}">六面体星球</text>
<text class="ts" x="360" y="74" text-anchor="middle" fill="${C.brand}">六个 48 × 48 的世界</text>
<path class="conn" d="M360 82 L360 112 L110 112" />
<line class="conn" x1="110" y1="112" x2="110" y2="${TOP + 5 * PITCH + ROW_H / 2}" />
${leaves}
</svg>`;

// ── 图1：六面体星球世界模型 ──────────────────────────────────────
const fig1 = `${head(720, 450)}
<text class="ts" x="46" y="34">面上局部正交基</text>
<path class="arr" d="M110 152 L110 96" marker-end="url(#am)" />
<path class="arr" d="M110 152 L172 152" marker-end="url(#am)" />
<path class="arr" d="M110 152 L150 190" marker-end="url(#am)" />
<circle cx="110" cy="152" r="3" fill="${C.muted}" />
<text class="tm" x="118" y="104">n 法线</text>
<text class="tm" x="180" y="157">r 右</text>
<text class="tm" x="157" y="204">f 前</text>

<polygon points="293.4,200 380,250 380,350 293.4,300" fill="${C.surfaceMuted}" stroke="${C.line}" />
<polygon points="466.6,200 466.6,300 380,350 380,250" fill="${C.surfaceMuted}" stroke="${C.line}" />
<polygon points="380,150 466.6,200 380,250 293.4,200" fill="${C.brandSoft}" stroke="${C.brand}" />
<circle cx="410" cy="212" r="9" fill="${C.brand}" stroke="#FFFFFF" stroke-width="2" />

<path class="leader" d="M380 116 L380 196" />
<rect class="pillB" x="277.5" y="88" width="205" height="28" rx="8" />
<text class="ts" x="380" y="107" text-anchor="middle" fill="${C.brandText}">face0 西风大教堂 · 出生面</text>

<path class="leader" d="M423.3 275 L536 275" />
<rect class="pillN" x="536" y="261" width="128" height="28" rx="8" />
<text class="ts" x="600" y="280" text-anchor="middle">face5 和风庭院</text>

<path class="leader" d="M336.7 275 L224 275" />
<rect class="pillN" x="96" y="261" width="128" height="28" rx="8" />
<text class="ts" x="160" y="280" text-anchor="middle">face2 拱环书苑</text>

<circle cx="126" cy="416" r="5" fill="${C.brand}" />
<text class="ts" x="142" y="420">角色 · 未直接可见的三面：face1 存在回声 / face3 幽光溶洞 / face4 锈蚀庭园</text>
</svg>`;

// ── 图2：渲染与表现管线 ──────────────────────────────────────────
const node = (x, y, w, h, cls, title, sub, tFill, sFill) => `
<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="${h}" rx="8" />
<text class="th" x="${x + w / 2}" y="${y + 28}" text-anchor="middle" ${tFill}>${title}</text>
<text class="ts" x="${x + w / 2}" y="${y + 50}" text-anchor="middle" ${sFill}>${sub}</text>`;

const fig2 = `${head(720, 268)}
${node(40, 40, 136, 64, 'boxN', '逐帧更新', 'animate()', '', '')}
${node(208, 40, 136, 64, 'boxB', '按面剔除', 'visible = false', `fill="${C.brandText}"`, `fill="${C.brand}"`)}
${node(376, 40, 136, 64, 'boxN', '光照 + 阴影', '逐帧指数插值', '', '')}
${node(544, 40, 136, 64, 'boxN', '场景渲染', 'RenderPass', '', '')}
<path class="arr" d="M176 72 L200 72" marker-end="url(#am)" />
<path class="arr" d="M344 72 L368 72" marker-end="url(#am)" />
<path class="arr" d="M512 72 L536 72" marker-end="url(#am)" />
<path class="arr" d="M612 104 L612 132 L276 132 L276 152" marker-end="url(#am)" />
${node(208, 160, 136, 64, 'boxN', '泛光 Bloom', '阈值 2.5', '', '')}
${node(376, 160, 136, 64, 'boxN', '色彩空间输出', 'OutputPass', '', '')}
<path class="arr" d="M344 192 L368 192" marker-end="url(#am)" />
</svg>`;

// ── 图3：越棱翻面机制 ────────────────────────────────────────────
const fig3 = `${head(720, 472)}
<text class="ts" x="40" y="34">以棱为枢轴的两面法线旋转</text>
<rect x="170" y="190" width="130" height="100" fill="${C.surfaceMuted}" />
<path class="surf" d="M170 190 L300 190 L300 290" />
<path class="arr" d="M300 190 L300 120" marker-end="url(#am)" />
<path class="arr" d="M300 190 L370 190" marker-end="url(#am)" />
<text class="tm" x="306" y="132">n1</text>
<text class="tm" x="376" y="196">n2</text>
<path class="curve" d="M300 120 A70 70 0 0 1 370 190" marker-end="url(#amb)" />
<circle cx="300" cy="190" r="4" fill="${C.ink}" />
<text class="ts" x="200" y="232">棱 · 枢轴</text>
<text class="ts" x="40" y="330">700ms smoothstep 缓动</text>
<text class="tm" x="120" y="362">t' = t*t*(3-2t)</text>
<polyline class="curve" points="120,430 182.5,427.4 245,420.6 307.5,411.0 370,400 432.5,389.0 495,379.4 557.5,372.6 620,370" />
<path class="axis" d="M120 440 L620 440" />
<text class="ts" x="120" y="458">0</text>
<text class="ts" x="370" y="458" text-anchor="middle">350ms</text>
<text class="ts" x="620" y="458" text-anchor="end">700ms</text>
</svg>`;

// ── 图4：各面资源体积优化前后 ────────────────────────────────────
const rows = [
  { f: 'face0', a: 37.0, b: 15.4 }, { f: 'face1', a: 113.6, b: 87.6 },
  { f: 'face2', a: 245.9, b: 96.7 }, { f: 'face3', a: 133.2, b: 46.0 },
  { f: 'face4', a: 108.4, b: 24.9 }, { f: 'face5', a: 154.9, b: 70.3 },
];
const BASE = 340;
let bars = '', ticks = '', xlabels = '';
for (let i = 0; i <= 250; i += 50) {
  const y = BASE - i;
  ticks += `<line class="grid" x1="70" y1="${y}" x2="690" y2="${y}" />`;
  ticks += `<text class="ts" x="62" y="${y + 4}" text-anchor="end">${i}</text>`;
}
rows.forEach((r, i) => {
  const cx = 70 + 103.33 * i + 51.67;
  bars += `<rect x="${(cx - 35).toFixed(1)}" y="${(BASE - r.a).toFixed(1)}" width="32" height="${r.a}" rx="4" fill="${C.s1}" />`;
  bars += `<rect x="${(cx + 3).toFixed(1)}" y="${(BASE - r.b).toFixed(1)}" width="32" height="${r.b}" rx="4" fill="${C.s2}" />`;
  xlabels += `<text class="ts" x="${cx.toFixed(1)}" y="${BASE + 22}" text-anchor="middle">${r.f}</text>`;
});
const fig4 = `${head(720, 390)}
<circle cx="76" cy="22" r="5" fill="${C.s1}" /><text class="ts" x="88" y="27">本轮优化前</text>
<circle cx="196" cy="22" r="5" fill="${C.s2}" /><text class="ts" x="208" y="27">当前</text>
<text class="ts" x="690" y="27" text-anchor="end">单位：MB（模型资源，不含 .blend 源文件）</text>
${ticks}${bars}${xlabels}
</svg>`;

const figures = { 'fig0-world-division': fig0, 'fig1-world-model': fig1, 'fig2-pipeline': fig2, 'fig3-fold-mechanism': fig3, 'fig4-resource-size': fig4 };
for (const [name, svg] of Object.entries(figures)) {
  writeFileSync(join(OUT, `${name}.svg`), svg);
  const info = await sharp(Buffer.from(svg), { density: 200 }).png().toFile(join(OUT, `${name}.png`));
  console.log(`${name}.png  ${info.width}x${info.height}`);
}

// ── 运行效果图：从浏览器截图目录复制已验证有内容的图 ──────────────
const SHOTS = process.env.TEMP + '\\trae\\screenshots\\';
const shots = [
  ['cube-planet-face0.png', 'shot-face0-church.png', 'face0 西风大教堂'],
  ['cross_test.png', 'shot-face1-gallery.png', 'face1 存在回声'],
  ['cube-planet-walk.png', 'shot-face3-cave.png', 'face3 幽光溶洞'],
  ['meshopt_check.png', 'shot-face5-courtyard.png', 'face5 和风庭院'],
];
for (const [src, dst, label] of shots) {
  const from = join(SHOTS, src);
  if (!existsSync(from)) { console.log(`[缺失] ${src}`); continue; }
  copyFileSync(from, join(OUT, dst));
  const meta = await sharp(from).metadata();
  console.log(`${dst}  ${meta.width}x${meta.height}  (${label})`);
}
