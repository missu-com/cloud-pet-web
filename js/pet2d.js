/* ============================================================
 * pet2d.js — 奇迹暖暖风 SVG 2D 立绘互动宠物舞台（无任何外部依赖）
 *
 * 视觉：分层 SVG 立绘 —— 多段渐变上色(受光面→玫瑰暗部)、大玻璃眼
 * (渐变虹膜+双高光+星芒)、腮红喷枪、ω 嘴、绒毛描边、呆毛。
 * 手感（motion-web handfeel 规范）：
 *   §1 欠阻尼弹簧 —— 耳朵/尾巴点按后带回弹的抖动
 *   §2 速度耦合 —— 跳跃时耳朵/尾巴滞后摆动（重量感）
 *   §4 果冻次级运动 —— 落地时身体轻微挤压回弹
 *   §6 异频呼吸 —— 身体/头/耳各用不同频率，永不齐步
 *   §7.1 帧率无关 —— 阻尼按 pow(D, dt*60) 归一
 * 互动：摸头/耳/肚/鼻/爪/尾各自反应；瞳孔跟随指针；
 *       指针靠近耳朵尾巴会轻微抽动（可发现性邀请）。
 * API 与 pet3d.js 完全兼容：attach/setMode/setRoles/act/pickAt/
 *   headPx/anchorPx/setRunning/setSleeping/isSleeping/status/destroy
 * 根节点复用 id=p3dCv（app.js 的舞台重渲染会保留该节点）。
 * ============================================================ */

const VB_W = 300, VB_H = 400;

/* ---------- 调色板（水彩手绘：焦糖棕兔 / 奶油焦糖狗） ---------- */
const PAL = {
  rabbit: {
    furTop: '#FDEFD2', furMid: '#EEC18A', furLow: '#D69E5B', furShadow: '#BA7C3E',
    belly: '#FFFDF6', muzzle: '#FFF6E6',
    earOut: '#D99F5B', earInA: '#F4C6AC', earInB: '#EAA38A',
    irisA: '#8A5A2C', irisB: '#452611', pupil: '#241206',
    noseA: '#C08A5C', noseB: '#A0683C', blush: '#F5A98C',
    line: '#7A4E28', mouthIn: '#B26858', tongue: '#FFA0A8',
    patchA: '', patchB: '', sparkle: '#FFF9E9'
  },
  dog: {
    furTop: '#FFFCF3', furMid: '#FBEBCB', furLow: '#F0D3A3', furShadow: '#DFB985',
    belly: '#FFFFF9', muzzle: '#FFFDF6',
    earOut: '#DBA262', earInA: '#F6CBB0', earInB: '#EBA98B',
    irisA: '#C98A4A', irisB: '#7A4A1C', pupil: '#2E1808',
    noseA: '#7C4C30', noseB: '#4E2C16', blush: '#F7AC8E',
    line: '#6B4423', mouthIn: '#B26858', tongue: '#FFA0A8',
    patchA: '#D9A05C', patchB: '#C98B4E', sparkle: '#FFF6D8'
  }
};

/* ---------- SVG 生成 ---------- */
function gradDefs(p, uid) {
  return `<defs>
    <linearGradient id="g-fur-${uid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${p.furTop}"/><stop offset=".52" stop-color="${p.furMid}"/>
      <stop offset=".82" stop-color="${p.furLow}"/><stop offset="1" stop-color="${p.furShadow}"/>
    </linearGradient>
    <linearGradient id="g-ear-${uid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${p.furMid}"/><stop offset="1" stop-color="${p.earOut}"/>
    </linearGradient>
    <linearGradient id="g-earin-${uid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${p.earInA}"/><stop offset="1" stop-color="${p.earInB}"/>
    </linearGradient>
    <linearGradient id="g-belly-${uid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${p.belly}"/><stop offset="1" stop-color="${p.furMid}"/>
    </linearGradient>
    <linearGradient id="g-muzzle-${uid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${p.muzzle}"/><stop offset="1" stop-color="${p.furMid}"/>
    </linearGradient>
    <radialGradient id="g-patch-${uid}" cx=".5" cy=".4" r=".85">
      <stop offset="0" stop-color="${p.patchA || p.furLow}"/><stop offset="1" stop-color="${p.patchB || p.furShadow}"/>
    </radialGradient>
    <radialGradient id="g-iris-${uid}" cx=".5" cy=".32" r=".85">
      <stop offset="0" stop-color="${p.irisA}"/><stop offset=".62" stop-color="${p.irisB}"/><stop offset="1" stop-color="#2E1608"/>
    </radialGradient>
    <radialGradient id="g-blush-${uid}" cx=".5" cy=".5" r=".55">
      <stop offset="0" stop-color="${p.blush}" stop-opacity=".82"/><stop offset="1" stop-color="${p.blush}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="g-nose-${uid}" cx=".42" cy=".3" r=".9">
      <stop offset="0" stop-color="${p.noseA}"/><stop offset="1" stop-color="${p.noseB}"/>
    </radialGradient>
    <radialGradient id="g-tail-${uid}" cx=".45" cy=".35" r=".9">
      <stop offset="0" stop-color="${p.furTop}"/><stop offset="1" stop-color="${p.furLow}"/>
    </radialGradient>
    <linearGradient id="g-rim-${uid}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity=".85"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>
  </defs>`;
}

/* 眼睛（大玻璃眼：眼白→渐变虹膜→瞳孔→双高光→星芒→上睫毛） */
function eyeSVG(p, uid, cx, cy, flip) {
  const f = flip || 1;
  return `<g>
    <ellipse cx="${cx}" cy="${cy}" rx="12.5" ry="14.5" fill="#FFFDFB"/>
    <ellipse cx="${cx}" cy="${cy}" rx="10.6" ry="12.8" fill="url(#g-iris-${uid})"/>
    <ellipse cx="${cx}" cy="${cy}" rx="10.6" ry="12.8" fill="none" stroke="${p.irisB}" stroke-opacity=".35" stroke-width="1"/>
    <ellipse cx="${cx}" cy="${cy + .6}" rx="5.4" ry="6.8" fill="${p.pupil}"/>
    <circle cx="${cx - 3.6 * f}" cy="${cy - 4.8}" r="3.7" fill="#FFFFFF"/>
    <circle cx="${cx - 2.2 * f}" cy="${cy - 6.6}" r="1.5" fill="#FFFFFF" opacity=".9"/>
    <circle cx="${cx + 3.4 * f}" cy="${cy + 4.6}" r="1.9" fill="#FFFFFF" opacity=".88"/>
    <path d="M ${cx + 5.2 * f} ${cy - 5.4} l 1.1 2.1 2.2 1.1 -2.2 1.1 -1.1 2.1 -1.1 -2.1 -2.2 -1.1 2.2 -1.1 Z" fill="#FFFFFF" opacity=".95"/>
    <path d="M ${cx - 11.5 * f} ${cy - 9} Q ${cx} ${cy - 17.5} ${cx + 11.5 * f} ${cy - 9}" fill="none" stroke="#4A3020" stroke-width="2.1" stroke-linecap="round" opacity=".85"/>
  </g>`;
}

/* 四角星光（头顶装饰，参考图水彩狗自带的亮星） */
function sparkSvg(p, uid, x, y, s) {
  return `<path transform="translate(${x} ${y}) scale(${s}) rotate(${Math.floor(Math.random()*45)})"
     d="M 0 -9 C 2 -2.4 2.4 -2 9 0 C 2.4 2 2 2.4 0 9 C -2 2.4 -2.4 2 -9 0 C -2.4 -2 -2 -2.4 0 -9 Z"
     fill="${p.sparkle}" stroke="#FFF" stroke-width="1" opacity=".9"/>`;
}

function petSVG(role) {
  const p = PAL[role] || PAL.rabbit;
  const uid = role;
  const dog = role === 'dog';

  /* 耳朵几何：兔=细长立耳；狗=宽大垂耳(焦糖) */
  const earUp = `
      <path d="M 0 0 C -9 -5 -14 -30 -9 -60 C -6 -78 4 -83 10 -74 C 17 -48 13 -9 0 0 Z" fill="url(#g-ear-${uid})" stroke="${p.line}" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M 0 -6 C -5 -9 -8 -28 -5 -48 C -3 -60 3 -65 6 -59 C 9 -44 6 -13 0 -6 Z" fill="url(#g-earin-${uid})" opacity=".92"/>
      <path d="M -2 -40 C -4 -50 -1 -62 4 -68" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" opacity=".3"/>`;
  const earDown = `
      <path d="M 0 0 C -19 6 -29 40 -21 74 C -16 92 8 95 15 76 C 24 44 15 6 0 0 Z" fill="url(#g-ear-${uid})" stroke="${p.line}" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M -2 10 C -13 16 -20 42 -14 68 C -11 81 4 83 9 70 C 15 46 9 16 -2 10 Z" fill="url(#g-earin-${uid})" opacity=".92"/>
      <path d="M -3 30 C -8 45 -7 62 -2 74" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" opacity=".28"/>`;

  /* 尾巴：兔=焦糖圆绒球；狗=卷尾上翘 */
  const tailRabbit = `
      <g class="g-tail">
        <circle cx="0" cy="0" r="22" fill="url(#g-tail-${uid})" stroke="${p.line}" stroke-width="2"/>
        <circle cx="-6" cy="-6" r="8" fill="#FFFFFF" opacity=".55"/>
        <path d="M -8 -6 C -12 -2 -12 6 -8 12" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" opacity=".5"/>
      </g>`;
  const tailDog = `
      <g class="g-tail">
        <path d="M 0 8 C -8 -6 -4 -24 12 -26 C 26 -28 32 -14 24 -6 C 30 -4 32 6 22 10 C 12 14 4 14 0 8 Z" fill="url(#g-tail-${uid})" stroke="${p.line}" stroke-width="2.2" stroke-linejoin="round"/>
        <circle cx="16" cy="-16" r="6" fill="#FFFFFF" opacity=".55"/>
      </g>`;

  /* 头顶毛簇（兔=呆毛；狗=两侧焦糖斑 + 额斑） */
  const headTop = dog
    ? `<ellipse cx="106" cy="120" rx="24" ry="22" fill="url(#g-patch-${uid})" opacity=".95"/>
       <ellipse cx="194" cy="120" rx="24" ry="22" fill="url(#g-patch-${uid})" opacity=".95"/>
       <ellipse cx="150" cy="106" rx="18" ry="12" fill="url(#g-patch-${uid})" opacity=".7"/>
       <path d="M 96 118 C 100 96 118 88 128 100 C 132 84 156 82 162 98 C 172 86 190 94 192 114" fill="none" stroke="${p.line}" stroke-width="2" stroke-linecap="round" opacity=".5"/>`
    : `<path d="M 150 96 C 138 90 128 100 128 100 C 132 87 141 83 150 83 C 159 83 168 87 172 100 C 172 100 162 90 150 96 Z" fill="url(#g-patch-${uid})" opacity=".6"/>
       <path d="M 144 96 C 140 84 146 74 154 72 C 150 80 152 88 158 92" fill="none" stroke="${p.line}" stroke-width="2.1" stroke-linecap="round" opacity=".7"/>`;

  const svg = `<svg viewBox="0 0 ${VB_W} ${VB_H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    ${gradDefs(p, uid)}
    <!-- 尾巴（身体后侧） -->
    <g class="g-tail-w" transform="translate(${dog ? 218 : 212}, ${dog ? 252 : 262}) rotate(${dog ? -18 : 8})">
      ${dog ? tailDog : tailRabbit}
    </g>
    <!-- 身体 -->
    <g class="g-all">
      ${dog ? `<g class="g-sparkle">
          ${sparkSvg(p, uid, 238, 78, 1)}
          ${sparkSvg(p, uid, 268, 118, .78)}
          ${sparkSvg(p, uid, 84, 104, .82)}
          ${sparkSvg(p, uid, 244, 178, .62)}
        </g>` : `<g class="g-sparkle">
          ${sparkSvg(p, uid, 226, 118, .5)}
          ${sparkSvg(p, uid, 76, 150, .4)}
        </g>`}
      <g class="g-body">
        <path d="M 150 206 C 106 206 88 238 86 274 C 84 314 112 342 150 342 C 188 342 216 314 214 274 C 212 238 194 206 150 206 Z"
              fill="url(#g-fur-${uid})" stroke="${p.line}" stroke-width="2.4" stroke-linejoin="round"/>
        <path d="M 108 232 C 96 248 92 272 96 292" fill="none" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" opacity=".5"/>
        <path d="M 192 232 C 204 248 208 272 204 292" fill="none" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" opacity=".4"/>
        <ellipse cx="150" cy="292" rx="42" ry="48" fill="url(#g-belly-${uid})"/>
        <ellipse cx="114" cy="340" rx="21" ry="13" fill="url(#g-fur-${uid})" stroke="${p.line}" stroke-width="2.2"/>
        <ellipse cx="186" cy="340" rx="21" ry="13" fill="url(#g-fur-${uid})" stroke="${p.line}" stroke-width="2.2"/>
      </g>
      <!-- 前爪 -->
      <g class="g-paw g-pawL"><ellipse cx="128" cy="324" rx="12" ry="15" fill="url(#g-fur-${uid})" stroke="${p.line}" stroke-width="2.2"/>
        <path d="M 124 318 L 124 326 M 132 318 L 132 326" stroke="${p.line}" stroke-width="1.4" opacity=".4"/></g>
      <g class="g-paw g-pawR"><ellipse cx="172" cy="324" rx="12" ry="15" fill="url(#g-fur-${uid})" stroke="${p.line}" stroke-width="2.2"/>
        <path d="M 168 318 L 168 326 M 176 318 L 176 326" stroke="${p.line}" stroke-width="1.4" opacity=".4"/></g>
      <!-- 头 -->
      <g class="g-head">
        <g class="g-ear g-earL" transform="translate(128,113) rotate(${-11})">${dog ? earDown : earUp}</g>
        <g class="g-ear g-earR" transform="translate(172,113) rotate(${11})">${dog ? earDown : earUp}</g>
        <ellipse cx="150" cy="152" rx="63" ry="59" fill="url(#g-fur-${uid})" stroke="${p.line}" stroke-width="2.4"/>
        ${headTop}
        <path d="M 92 138 C 86 148 86 160 90 170" fill="none" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" opacity=".55"/>
        <path d="M 208 138 C 214 148 214 160 210 170" fill="none" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" opacity=".4"/>
        <!-- 白色口鼻 -->
        <ellipse cx="150" cy="186" rx="31" ry="22" fill="url(#g-muzzle-${uid})"/>
        <ellipse cx="150" cy="198" rx="20" ry="13" fill="${p.muzzle}" opacity=".5"/>
        <!-- 腮红 -->
        <ellipse cx="107" cy="177" rx="15" ry="9" fill="url(#g-blush-${uid})"/>
        <ellipse cx="193" cy="177" rx="15" ry="9" fill="url(#g-blush-${uid})"/>
        <!-- 眉毛（生气时显形） -->
        <path class="g-brow g-browL" d="M 114 128 Q 126 122 137 127" fill="none" stroke="${p.line}" stroke-width="2.4" stroke-linecap="round" opacity="0"/>
        <path class="g-brow g-browR" d="M 163 127 Q 174 122 186 128" fill="none" stroke="${p.line}" stroke-width="2.4" stroke-linecap="round" opacity="0"/>
        <!-- 眼睛（参考图水灵大眼：眼白→渐变虹膜→大瞳孔→双高光→星芒→上睫毛） -->
        <g class="g-eye g-eyeL">${eyeSVG(p, uid, 125, 152, 1)}</g>
        <g class="g-eye g-eyeR">${eyeSVG(p, uid, 175, 152, -1)}</g>
        <path class="g-lid g-lidL" d="M 113 152 Q 125 143 137 152" fill="none" stroke="${p.line}" stroke-width="2.2" stroke-linecap="round" opacity="0"/>
        <path class="g-lid g-lidR" d="M 163 152 Q 175 143 187 152" fill="none" stroke="${p.line}" stroke-width="2.2" stroke-linecap="round" opacity="0"/>
        <!-- 鼻子 + 嘴（落在口鼻白区上） -->
        <path d="M 142 176 Q 150 171 158 176 Q 154 185 150 186.5 Q 146 185 142 176 Z" fill="url(#g-nose-${uid})" stroke="${p.line}" stroke-width="1.6" stroke-linejoin="round"/>
        <path d="M 150 186.5 L 150 191" stroke="${p.line}" stroke-width="1.6" stroke-linecap="round"/>
        <g class="g-mouth-c">
          <path d="M 150 191 Q 144 197 138 194 M 150 191 Q 156 197 162 194" fill="none" stroke="${p.line}" stroke-width="2" stroke-linecap="round"/>
        </g>
        <g class="g-mouth-o" opacity="0">
          <ellipse cx="150" cy="197" rx="9" ry="8" fill="${p.mouthIn}" stroke="${p.line}" stroke-width="1.8"/>
          <path class="g-tongue" d="M 144 199 Q 150 208 156 199 Z" fill="${p.tongue}" opacity="0"/>
        </g>
      </g>
    </g>
  </svg>`;
  return svg;
}

/* ---------- 锚点（SVG 坐标，用于命中 + 头顶气泡） ---------- */
const ANCHORS = {
  head: { x: 150, y: 152 }, body: { x: 150, y: 275 }, belly: { x: 150, y: 288 },
  nose: { x: 150, y: 174 }, mouth: { x: 150, y: 190 },
  ear: { x: 128, y: 74 }, earR: { x: 172, y: 74 },
  paw: { x: 128, y: 324 }, pawR: { x: 172, y: 324 }, tail: { x: 224, y: 262 }
};
const PART_R = { head: 58, body: 62, belly: 46, nose: 18, ear: 36, earR: 36, paw: 20, pawR: 20, tail: 28, mouth: 18 };

/* ---------- 弹簧（handfeel §1 / §7.1 帧率无关阻尼） ---------- */
function spring(K, D) {
  return { x: 0, v: 0, K, D,
    step(dt) { this.v += -this.K * this.x * dt; this.v *= Math.pow(this.D, Math.min(3, dt * 60)); this.x += this.v * dt; return this.x; }
  };
}

function PetStage2D() {
  let enabled = false;
  let host = null, root = null, grab = null, rafId = 0, lastT = 0, running = false;
  let cb = { onTap: null, onEmptyTap: null, onFail: null };
  let layout = { roles: [], atWork: false, my: '' };
  const pets = new Map();
  let ro = null;
  let ptr = { x: -9999, y: -9999, in: false };
  let reducedMotion = false;
  let twitchCool = 0;

  try { reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  function makePet(role, big) {
    const wrap = document.createElement('div');
    wrap.className = 'p2d-pet' + (big ? ' big' : '');
    wrap.dataset.role = role;
    wrap.innerHTML = `<div class="p2d-shadow"></div>` + petSVG(role);
    const q = (sel) => wrap.querySelector(sel);
    const pet = {
      role, wrap, el: wrap,
      svg: wrap.querySelector('svg'),
      gAll: q('.g-all'), gBody: q('.g-body'), gHead: q('.g-head'),
      gEarL: q('.g-earL'), gEarR: q('.g-earR'), gTailW: q('.g-tail-w'),
      gPawL: q('.g-pawL'), gPawR: q('.g-pawR'),
      gEyeL: q('.g-eyeL'), gEyeR: q('.g-eyeR'),
      gLidL: q('.g-lidL'), gLidR: q('.g-lidR'),
      gBrowL: q('.g-browL'), gBrowR: q('.g-browR'),
      gMouthC: q('.g-mouth-c'), gMouthO: q('.g-mouth-o'), gTongue: q('.g-tongue'),
      gSparkle: q('.g-sparkle'),
      dog: role === 'dog', big,
      st: {
        role, sleep: false, speakUntil: 0, fx: null, fxT: 0,
        t: Math.random() * 9, phase: Math.random() * 6.28,
        blinkC: 1 + Math.random() * 3, blinkHold: 0, eyeY: 1, eyeYT: 1,
        hop: 0, hopVel: 0, prevHop: 0, px: {}, w: 0,
        earBaseL: role === 'dog' ? -14 : -13, earBaseR: role === 'dog' ? 14 : 13
      },
      sp: { earL: spring(64, 0.88), earR: spring(64, 0.88), tail: spring(46, 0.9), squash: spring(150, 0.82) }
    };
    /* 瞳孔跟随需要单独移动虹膜内的高光组：直接平移整个眼睛内容太糙，
       我们把瞳孔+高光包一层 g-pupil（渲染后补加） */
    [pet.gEyeL, pet.gEyeR].forEach((g) => {
      const inner = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      inner.setAttribute('class', 'g-pupil');
      while (g.childNodes.length > 0) inner.appendChild(g.childNodes[0]);
      const outer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      outer.appendChild(inner);
      g.appendChild(outer);
    });
    pet.gPupL = pet.gEyeL.querySelector('.g-pupil');
    pet.gPupR = pet.gEyeR.querySelector('.g-pupil');
    return pet;
  }

  /* ---------- 布局 ---------- */
  function layoutStage() {
    if (!root) return;
    const list = layout.roles || [];
    pets.forEach((p) => { if (p.wrap.parentNode) p.wrap.remove(); });
    pets.clear();
    const W = host.clientWidth || 320, H = host.clientHeight || 420;
    list.forEach((r) => {
      const my = r.role === layout.my;
      const scale = my ? 1 : 0.62;
      const w = Math.min(W * (W < 480 ? 0.62 : 0.48), my ? 360 : 214);
      const pet = makePet(r.role, my);
      pet.st.w = w;
      root.appendChild(pet.wrap);
      pets.set(r.role, pet);
      /* 位置：单只居中；在家=我在右；上班=我在左（对齐 3D 版布局语义） */
      let leftPct, bottomPct;
      if (list.length === 1) { leftPct = 50; bottomPct = 8; }
      else if (my) { leftPct = layout.atWork ? 27 : 66; bottomPct = layout.atWork ? 16 : 9; }
      else { leftPct = layout.atWork ? 72 : 22; bottomPct = layout.atWork ? 20 : 12; }
      pet.wrap.style.width = w + 'px';
      pet.wrap.style.left = leftPct + '%';
      pet.wrap.style.bottom = bottomPct + '%';
      pet.wrap.style.setProperty('--p2d-scale', scale);
      if (!my) pet.wrap.classList.add('flip');
      storePx(pet);
    });
  }

  function storePx(pet) {
    const hr = host.getBoundingClientRect();
    const r = pet.wrap.getBoundingClientRect();
    const k = r.width / VB_W;
    Object.keys(ANCHORS).forEach((name) => {
      const a = ANCHORS[name];
      const ax = (pet.wrap.classList.contains('flip')) ? (VB_W - a.x) : a.x;
      pet.st.px[name] = { x: r.left - hr.left + ax * k, y: r.top - hr.top + a.y * (r.height / VB_H), valid: true };
    });
    pet.st.k = k;
  }

  /* ---------- 动作（fx 时间线，语义与 pet3d 对齐） ---------- */
  function act(role, kind, opt) {
    const pet = pets.get(role); if (!pet) return false;
    const p = pet.st, o = opt || {};
    let dur = 1.1;
    if (kind === 'eat' || kind === 'reject') dur = 2.0;
    else if (kind === 'happy' || kind === 'poke-head' || kind === 'poke-belly') dur = 1.3;
    else if (kind === 'startle') dur = 1.5;
    else if (kind === 'poke-ear') dur = 1.0;
    else if (kind === 'sleep') dur = 0.6;
    else if (kind === 'wake') dur = 0.4;
    p.fx = { kind, dur, t: 0, part: o.part || '' };
    if (kind === 'sleep') p.sleep = true;
    if (kind === 'wake') p.sleep = false;
    /* 弹簧注入（点按后带回弹的抖动 = 手感核心） */
    if (kind === 'poke-ear') {
      if (o.part === 'earR') pet.sp.earR.v += 520; else pet.sp.earL.v -= 520;
    } else if (kind === 'poke-tail') {
      pet.sp.tail.v += 620;
    } else if (kind === 'happy' || kind === 'poke-head' || kind === 'poke-belly') {
      pet.sp.earL.v -= 300; pet.sp.earR.v += 300;
      pet.sp.squash.v -= 4.2;
    } else if (kind === 'startle') {
      pet.sp.earL.v -= 700; pet.sp.earR.v += 700;
      pet.sp.squash.v -= 8;
    } else if (kind === 'reject' || kind === 'grumpy') {
      pet.sp.earL.v += 200; pet.sp.earR.v -= 200;
    }
    if (kind === 'talk') { p.speakUntil = Date.now() + (o.ms || 1500); return true; }
    return true;
  }

  function easeVal(u) { return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; }

  /* ---------- 每帧姿态 ---------- */
  function updatePet(pet, dt, now) {
    const p = pet.st, sp = pet.sp;
    p.t += dt;
    const T = p.t;
    const life = reducedMotion ? 0.4 : 1;

    if (p.fx) { p.fxT += dt; if (p.fxT >= p.fx.dur) { p.fx = null; p.fxT = 0; } }
    const fx = p.fx;
    const u = fx ? Math.min(1, p.fxT / fx.dur) : 1;
    const inW = Math.sin(u * Math.PI);
    const decay = 1 - u;

    const pose = { hop: 0, headYaw: 0, headPitch: 0, earShake: 0, jaw: 0, eyeSq: 0, angry: 0, tailWag: p.sleep ? 0 : .14, pawWave: 0, shiver: 0, tongue: 0 };
    const speaking = Date.now() < p.speakUntil;

    if (fx) {
      const k = fx.kind;
      if (k === 'happy' || k === 'poke-head') {
        pose.hop = inW * (k === 'happy' ? 24 : 12);
        pose.earShake = inW * .8; pose.eyeSq = inW; pose.tailWag = Math.max(pose.tailWag, .7);
        pose.jaw = inW * .3; pose.headPitch = inW * .12;
      } else if (k === 'poke-belly') {
        pose.hop = Math.abs(Math.sin(u * 3 * Math.PI)) * 14;
        pose.headPitch = inW * .22; pose.eyeSq = inW; pose.jaw = inW * .5; pose.shiver = inW;
      } else if (k === 'poke-ear') { pose.eyeSq = inW * .5; }
      else if (k === 'poke-nose') { pose.headYaw = Math.sin(u * Math.PI * 2) * .4; pose.eyeSq = inW * .6; }
      else if (k === 'poke-paw' || k === 'poke-body') {
        pose.pawWave = Math.abs(Math.sin(u * 3 * Math.PI)); pose.tailWag = Math.max(pose.tailWag, .9);
        pose.eyeSq = inW * .6; pose.headPitch = inW * .08;
      } else if (k === 'poke-tail') { pose.tailWag = Math.max(pose.tailWag, 2.6 * decay); pose.eyeSq = inW * .5; }
      else if (k === 'reject' || k === 'grumpy') {
        pose.headYaw = easeVal(u) * -.6; pose.angry = easeVal(u); pose.jaw = u < .2 ? u * 4 * .4 : .05; pose.tailWag = .03;
      } else if (k === 'eat') {
        pose.jaw = Math.abs(Math.sin(T * 9)) * .85 * decay; pose.tailWag = .8 * decay;
        pose.eyeSq = .5; pose.tongue = .6; pose.headPitch = Math.sin(T * 9) * .05;
      } else if (k === 'sleep') { pose.headPitch = easeVal(u) * .1; }
      else if (k === 'startle') {
        pose.hop = Math.sin(u * Math.PI) * 42; pose.earShake = Math.sin(u * Math.PI) * 1.4;
        pose.eyeSq = 0; pose.angry = 1 - Math.min(1, u * 2); pose.jaw = Math.sin(Math.min(1, u * 1.6) * Math.PI) * .9;
      }
    }
    if (speaking) {
      pose.jaw = Math.max(pose.jaw, (Math.sin(T * 7.5) * .5 + .5) * .8);
      pose.headPitch = Math.max(pose.headPitch, Math.sin(T * 7.5) * .04);
    }

    /* 跳跃 + 速度耦合（§2：耳尾感知身体速度 → 重量感） */
    p.prevHop = p.hop;
    p.hop += (pose.hop - p.hop) * Math.min(1, dt * 14);
    p.hopVel = (p.hop - p.prevHop) / Math.max(dt, 1e-4);

    /* 呼吸（§6 异频：身体 1.05Hz / 头 0.6Hz / 耳 0.8Hz） */
    const breathe = p.sleep ? 0.014 : 0.02;
    const breath = Math.sin(T * (p.sleep ? 1.05 : 2.1) + p.phase) * breathe * life;

    /* 弹簧推进 */
    const earLx = sp.earL.step(dt), earRx = sp.earR.step(dt), tailX = sp.tail.step(dt);
    const sq = sp.squash.step(dt);

    /* ---- 应用变换 ---- */
    const squashY = 1 - Math.min(.14, p.hop * .006 + Math.max(0, -sq) * .1);
    const squashX = 2 - squashY;
    pet.gAll.setAttribute('transform', `translate(0,${(-p.hop).toFixed(2)}) translate(150,342) scale(${squashX.toFixed(4)},${squashY.toFixed(4)}) translate(-150,-342)`);

    const swayHead = Math.sin(T * 0.6 + p.phase) * 1.1 * life;
    const headYawDeg = pose.headYaw * -8 + swayHead;
    const headPitchPx = pose.headPitch * 7;
    pet.gHead.setAttribute('transform', `rotate(${headYawDeg.toFixed(2)} 150 206) translate(0,${headPitchPx.toFixed(2)})`);

    const wig = pose.earShake * Math.sin(T * 30) * 10 * life;
    const earCouple = clampv(-p.hopVel * 0.016, -16, 16);   /* §2 速度耦合 */
    const earBack = pose.angry > .3 ? 16 : 0;
    pet.gEarL.setAttribute('transform', `translate(128,113) rotate(${(p.earBaseL + earLx + wig * .4 + earCouple - earBack).toFixed(2)})`);
    pet.gEarR.setAttribute('transform', `translate(172,113) rotate(${(p.earBaseR + earRx + wig * .4 - earCouple + earBack).toFixed(2)})`);

    const wagAmp = (3.5 + pose.tailWag * 15) * life;
    const wagFreq = 4.5 + pose.tailWag * 8;
    const tailBase = pet.dog ? -18 : 8;
    pet.gTailW.setAttribute('transform', `translate(${pet.dog ? 218 : 212},${pet.dog ? 252 : 262}) rotate(${(tailBase + tailX * .55 + Math.sin(T * wagFreq) * wagAmp - earCouple * .5).toFixed(2)})`);

    /* 星光闪烁（参考图头顶亮星：低频呼吸 + 轻微漂浮） */
    if (pet.gSparkle) {
      const tw = 0.55 + 0.45 * Math.sin(T * 2.2 + p.phase * 3);
      pet.gSparkle.setAttribute('opacity', (p.sleep ? .35 : tw).toFixed(2));
      pet.gSparkle.setAttribute('transform', `translate(0,${(Math.sin(T * 1.1 + p.phase) * 2).toFixed(2)})`);
    }

    /* 爪子挥动 */
    const pawRot = pose.pawWave > 0 ? -Math.abs(Math.sin(p.fxT * 14)) * 46 : 0;
    pet.gPawL.setAttribute('transform', `rotate(${pawRot.toFixed(1)} 128 336)`);
    pet.gPawR.setAttribute('transform', '');

    /* 眼睛：眨眼 / 眯眼 / 睡闭 + 瞳孔追指针 */
    let eyeTarget = p.sleep ? 0.05 : 1;
    if (!p.sleep && (pose.eyeSq > .35 || pose.angry > .4)) eyeTarget = 0.42;
    if (!p.sleep && !fx) {
      p.blinkC -= dt;
      if (p.blinkC <= 0) { p.blinkC = 1.6 + Math.random() * 3.4; p.blinkHold = 0.12; }
      if (p.blinkHold > 0) { p.blinkHold -= dt; if (p.blinkHold > 0) eyeTarget = 0.07; }
    }
    p.eyeY += (eyeTarget - p.eyeY) * Math.min(1, dt * 16);
    const lid = p.eyeY < .3 ? 1 : 0;
    setTr(pet.gEyeL, `translate(125,152) scale(1,${Math.max(.05, p.eyeY).toFixed(3)}) translate(-125,-152)`);
    setTr(pet.gEyeR, `translate(175,152) scale(1,${Math.max(.05, p.eyeY).toFixed(3)}) translate(-175,-152)`);
    pet.gLidL.setAttribute('opacity', lid ? 1 : 0);
    pet.gLidR.setAttribute('opacity', lid ? 1 : 0);

    /* 瞳孔跟随（限制在小范围，可爱不惊悚） */
    let pdx = 0, pdy = 0;
    if (ptr.in && !p.sleep) {
      const hr = host.getBoundingClientRect();
      const hx = p.px.head.x, hy = p.px.head.y;
      const dx = (ptr.x - hr.left) - hx, dy = (ptr.y - hr.top) - hy;
      const d = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, Math.max(0, (d - 20) / 160));
      pdx = clampv((dx / d) * 3.4 * reach, -3.4, 3.4);
      pdy = clampv((dy / d) * 2.6 * reach, -2.6, 2.6);
    }
    setTr(pet.gPupL, `translate(${pdx.toFixed(2)},${pdy.toFixed(2)})`);
    setTr(pet.gPupR, `translate(${pdx.toFixed(2)},${pdy.toFixed(2)})`);

    /* 眉毛（生气） */
    const browO = pose.angry > .15 ? Math.min(1, pose.angry * 1.6) : 0;
    pet.gBrowL.setAttribute('opacity', browO.toFixed(2));
    pet.gBrowR.setAttribute('opacity', browO.toFixed(2));
    pet.gBrowL.setAttribute('transform', `rotate(${(-browO * 16).toFixed(1)} 126 126) translate(0,${(browO * 3).toFixed(1)})`);
    pet.gBrowR.setAttribute('transform', `rotate(${(browO * 16).toFixed(1)} 174 126) translate(0,${(browO * 3).toFixed(1)})`);

    /* 嘴：闭合 ω / 张嘴 + 舌头 */
    const jaw = Math.min(1, pose.jaw);
    const openO = Math.min(1, jaw * 2.4);
    pet.gMouthC.setAttribute('opacity', (1 - openO).toFixed(2));
    pet.gMouthO.setAttribute('opacity', openO.toFixed(2));
    pet.gMouthO.setAttribute('transform', `translate(150,191) scale(1,${(0.25 + jaw * .95).toFixed(3)}) translate(-150,-191)`);
    pet.gTongue.setAttribute('opacity', Math.min(1, pose.tongue + (pet.dog && pose.eyeSq > .8 ? .8 : 0)).toFixed(2));

    /* 影子随跳跃缩放 */
    const sh = pet.wrap.querySelector('.p2d-shadow');
    if (sh) {
      const k = 1 - Math.min(.3, p.hop * .004);
      sh.style.transform = `translateX(-50%) scale(${k.toFixed(3)},${(k * .9).toFixed(3)})`;
      sh.style.opacity = (0.34 - p.hop * .003).toFixed(2);
    }
    storePx(pet);
  }

  function setTr(el, tr) { el.setAttribute('transform', tr); }
  function clampv(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  /* ---------- 渲染循环 ---------- */
  function frame(now) {
    rafId = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - lastT) / 1000 || 0.016);
    lastT = now;
    if (!running) return;
    twitchCool -= dt;
    pets.forEach((pet) => updatePet(pet, dt, now));
  }

  /* ---------- 命中测试 ---------- */
  function pickAt(clientX, clientY) {
    if (!host) return null;
    const hr = host.getBoundingClientRect();
    const x = clientX - hr.left, y = clientY - hr.top;
    let best = null;
    pets.forEach((pet, role) => {
      const st = pet.st;
      const head = st.px.head; if (!head) return;
      const bodyR = 58 * (st.k || 1);
      const dHead = Math.hypot(x - head.x, y - head.y);
      if (dHead <= bodyR * 1.35) {
        const cand = { role, part: 'body', d: dHead / Math.max(1, bodyR) + .8 };
        if (!best || cand.d < best.d) best = cand;
      }
      Object.keys(ANCHORS).forEach((name) => {
        const a = st.px[name]; if (!a) return;
        const rPx = Math.max(13, (PART_R[name] || 30) * (st.k || 1));
        const d = Math.hypot(x - a.x, y - a.y);
        if (d <= rPx) {
          const cand = { role, part: name === 'pawR' ? 'paw' : name, d: d / rPx };
          if (!best || cand.d < best.d) best = cand;
        }
      });
    });
    return best;
  }
  function anchorPx(role, name) {
    const pet = pets.get(role); if (!pet) return null;
    return pet.st.px[name] || pet.st.px.head || null;
  }
  function headPx(role) { return anchorPx(role, 'head'); }

  /* ---------- 指针 ---------- */
  function onDown(e) {
    if (!enabled) return;
    grab._pd = { x: e.clientX, y: e.clientY, t: Date.now() };
  }
  function onUp(e) {
    if (!grab || !grab._pd) return;
    const s = grab._pd; grab._pd = null;
    const quick = Date.now() - s.t < 600 && Math.hypot(e.clientX - s.x, e.clientY - s.y) < 10;
    if (!quick) return;
    const hit = pickAt(e.clientX, e.clientY);
    if (hit) cb.onTap && cb.onTap(hit.role, hit.part);
    else cb.onEmptyTap && cb.onEmptyTap();
  }
  function onMove(e) {
    if (!enabled) return;
    ptr.x = e.clientX; ptr.y = e.clientY; ptr.in = true;
    /* 可发现性邀请：指针可点部位 → 手型光标 */
    if (grab) {
      const hit = pickAt(e.clientX, e.clientY);
      grab.style.cursor = hit ? 'pointer' : 'default';
      /* 靠近耳朵/尾巴 → 轻微抽动（冷却 0.9s） */
      if (twitchCool <= 0 && hit && (hit.part === 'ear' || hit.part === 'earR' || hit.part === 'tail')) {
        twitchCool = 0.9;
        const pet = pets.get(hit.role);
        if (pet && !pet.st.sleep) {
          if (hit.part === 'tail') pet.sp.tail.v += 260;
          else if (hit.part === 'earR') pet.sp.earR.v += 240;
          else pet.sp.earL.v -= 240;
        }
      }
    }
  }
  function onLeave() { ptr.in = false; if (grab) grab.style.cursor = 'default'; }

  /* ---------- 挂载 / 生命周期 ---------- */
  function attach(el, options) {
    if (enabled) return true;
    cb = options || cb;
    host = el;
    root = document.createElement('div');
    root.id = 'p3dCv';           /* 复用 3D 画布 id：app.js 重渲染舞台时会保留该节点 */
    root.className = 'p2d-root';
    grab = document.createElement('div');
    grab.className = 'p2d-grab';
    root.appendChild(grab);
    host.appendChild(root);
    grab.addEventListener('pointerdown', onDown);
    grab.addEventListener('pointerup', onUp);
    grab.addEventListener('pointercancel', onUp);
    grab.addEventListener('pointermove', onMove);
    grab.addEventListener('pointerleave', onLeave);
    enabled = true; running = true;
    lastT = performance.now();
    rafId = requestAnimationFrame(frame);
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => { layoutStage(); });
      ro.observe(host);
    }
    return true;
  }
  function destroy() {
    running = false; enabled = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    if (ro) { try { ro.disconnect(); } catch (e) {} ro = null; }
    try { if (root && root.parentNode) root.parentNode.removeChild(root); } catch (e) {}
    root = null; grab = null; host = null; pets.clear();
  }

  return {
    attach, act, pickAt, headPx, anchorPx, destroy,
    resize() { layoutStage(); },
    setRunning(b) {
      running = !!b;
      if (running && !rafId) { lastT = performance.now(); rafId = requestAnimationFrame(frame); }
    },
    setRoles(r) { layout.roles = r || []; layoutStage(); },
    setMode(o) {
      if (o) { layout.my = o.my || layout.my; layout.atWork = !!o.atWork; }
      if (o && o.roles) layout.roles = o.roles;
      layoutStage();
    },
    setSleeping(role, on) {
      const pet = pets.get(role); if (!pet) return;
      pet.st.sleep = !!on;
      if (on) pet.st.speakUntil = 0;
    },
    isSleeping(role) { const pet = pets.get(role); return pet ? pet.st.sleep : false; },
    status() { return { enabled, failReason: '', count: pets.size, mode: '2d-svg' }; },
    get enabled() { return enabled; }
  };
}

const Pet3D = PetStage2D();   /* 同名导出：app.js 零改动切换 */
window.Pet3D = Pet3D;
export { Pet3D };
export default Pet3D;
