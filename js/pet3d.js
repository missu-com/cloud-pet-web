/* ============================================================
 * pet3d.js — 真 3D 互动宠物舞台（Three.js，无外网依赖）
 * 程序化 Q 版宠物（参考 2D 水彩立绘建模）：圆润水滴身 + 渐变毛发
 * + 大眼(虹膜/瞳孔/双高光) + 腮红 + 描边，兔/狗各自有标志特征。
 * 部件：头/耳/眼/嘴/尾/爪 独立可控，状态机驱动动画。
 * 点按命中 = 世界坐标锚点投影(比 raycast 更跟手)，返回 {role, part}。
 * 导出 window.Pet3D（app.js 动态 import 加载）。
 * ============================================================ */
import * as THREE from './lib/three.module.min.js';

const VIEW = { fov: 45, cy: 1.45 };

function PetStage() {
  let enabled = false, failReason = '';
  let renderer = null, scene = null, camera = null;
  let host = null, cv = null, rafId = 0, lastT = 0, running = false;
  let cb = { onTap: null, onEmptyTap: null, onFail: null };
  let renderFails = 0;
  let isIOS = false;
  let layout = { roles: [], atWork: false, my: '' };
  const pets = new Map();      // role -> {role,inst,char,state,...}
  const shadows = [];          // 软阴影
  const lightDir = new THREE.DirectionalLight(0xffffff, 0.95);
  const lightFill = new THREE.DirectionalLight(0xfff2ff, 0.3);
  const hemi = new THREE.HemisphereLight(0xffffff, 0xf7d9e2, 1.0);
  const ambient = new THREE.AmbientLight(0xffffff, 0.46);
  const raycaster = new THREE.Raycaster();
  const tmpV = new THREE.Vector3();

  /* ---------- 部件锚点（用于点按命中 + 头顶气泡定位） ---------- */
  const PART_R = { head: 0.5, body: 0.55, belly: 0.42, nose: 0.17, ear: 0.3, earR: 0.3, paw: 0.2, pawR: 0.2, tail: 0.2, mouth: 0.2 };

  /* ============================================================
   * 材质 / 贴图
   *  - makeFurTex: canvas 纵向渐变 + 噪点 = 毛茸茸立体毛发
   *  - makeWhite / makeSoft: 柔和纯色
   * ============================================================ */
  const _texCache = {};
  function hex(c) { return '#' + ('000000' + (c & 0xffffff).toString(16)).slice(-6); }
  function rgbArr(c) { return [(c >> 16) & 255, (c >> 8) & 255, c & 255]; }
  function hexMix(c1, c2, t) {
    const a = rgbArr(c1), b = rgbArr(c2);
    const r = Math.round(a[0] + (b[0] - a[0]) * t), g = Math.round(a[1] + (b[1] - a[1]) * t), bl = Math.round(a[2] + (b[2] - a[2]) * t);
    return (r << 16) | (g << 8) | bl;
  }
  function makeFurTex(base, top, bottom, key, noise) {
    if (_texCache[key]) return _texCache[key];
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, hex(top)); g.addColorStop(0.55, hex(hexMix(top, bottom, 0.5))); g.addColorStop(1, hex(bottom));
    ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
    // 噪点（毛发颗粒感）：只做极淡白色丝毛高光 + 极淡暖调，保持通透不显脏
    if (noise !== false) {
      for (let i = 0; i < 2800; i++) {
        const x = Math.random() * 256, y = Math.random() * 256;
        const a = Math.random() * 0.06;
        ctx.fillStyle = Math.random() < 0.65 ? 'rgba(255,255,255,' + a.toFixed(3) + ')' : 'rgba(240,205,150,' + (a * 0.6).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(x, y, Math.random() * 1.8 + 0.4, 0, 7); ctx.fill();
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    _texCache[key] = t;
    return t;
  }
  function mat(color, opt) { return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.66, metalness: 0, emissive: 0x0c0906 }, opt || {})); }
  function matFur(top, bottom, key, noise) {
    return new THREE.MeshStandardMaterial({
      map: makeFurTex(0, top, bottom, key, noise),
      color: 0xffffff, roughness: 0.68, metalness: 0, emissive: 0x0d0a07
    });
  }
  const M = {
    fur: null, fur2: null, dark: null, pink: null, eye: null, iris: null,
    pupil: null, noseM: null, blush: null, white: null, mouth: null, outline: null
  };
  function setPalette(p) {
    M.fur = matFur(p.top, p.bottom, p.key + '_body', p.noise);
    M.fur2 = mat(p.fur2, { roughness: 0.95 });
    M.dark = mat(p.dark, { roughness: 0.95 });
    M.pink = mat(p.pink, { roughness: 0.9 });
    M.eye = mat(p.eyeWhite || 0xffffff, { roughness: 0.35 });
    M.iris = mat(p.iris, { roughness: 0.32 });
    M.pupil = mat(p.pupil, { roughness: 0.36 });
    M.noseM = mat(p.nose, { roughness: 0.55 });
    M.blush = mat(p.blush || 0xff9fb2, { transparent: true, opacity: 0.42 });
    M.white = mat(0xffffff, { roughness: 0.25 });
    M.mouth = mat(p.mouthInner || 0x8a4a52, { roughness: 0.7 });
    M.outline = new THREE.MeshBasicMaterial({ color: p.outline || 0x3a2a22, side: THREE.BackSide });
  }

  function makeBall(r, seg, matOverride) {
    const g = new THREE.SphereGeometry(r, seg || 28, (seg || 28) - 6 || 20);
    return new THREE.Mesh(g, matOverride || M.fur);
  }
  function makeCapsule(r, len, matOverride) {
    const g = new THREE.CapsuleGeometry(r, len, 6, 14);
    return new THREE.Mesh(g, matOverride || M.fur);
  }
  // 圆润水滴身体（LatheGeometry 旋转成型）
  function makeBodyMesh(profile, matOverride, seg) {
    const pts = profile.map((p) => new THREE.Vector2(p.x, p.y));
    const geo = new THREE.LatheGeometry(pts, seg || 42);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, matOverride || M.fur);
    return mesh;
  }
  // 卡通描边：一个略大的 BackSide 网格做外圈暗边
  function addOutline(mesh, size) {
    const o = new THREE.Mesh(mesh.geometry, M.outline);
    o.scale.setScalar(1 + (size || 0.018));
    o.userData.isOutline = true;
    mesh.add(o);
    return o;
  }
  function anchor(parent, x, y, z, part) {
    const a = new THREE.Object3D(); a.position.set(x, y, z); a.userData.part = part;
    parent.add(a); return a;
  }
  function regPart(parts, name, obj3d) { parts[name] = obj3d; }

  /* 大眼：眼白 + 虹膜 + 瞳孔 + 双高光（scale.y 缩放 = 眨眼/眯眼） */
  function makeEye(scl, spread) {
    const g = new THREE.Group();
    const ball = makeBall(0.105, 24, M.eye); ball.scale.set(1, 1.18, 0.8);
    const iris = makeBall(scl || 0.082, 24, M.iris); iris.scale.set(1, 1.14, 0.62); iris.position.z = 0.052;
    const pupil = makeBall(scl * 0.6 || 0.048, 20, M.pupil); pupil.scale.set(1, 1.12, 0.5); pupil.position.z = 0.086;
    const hi1 = makeBall(scl * 0.34 || 0.028, 12, M.white); hi1.position.set(spread || 0.032, spread ? spread * 1.3 : 0.043, 0.112);
    const hi2 = makeBall(scl * 0.2 || 0.016, 10, M.white); hi2.position.set(-(spread || 0.026), -(spread ? spread * 1.05 : 0.03), 0.112);
    g.add(ball); g.add(iris); g.add(pupil); g.add(hi1); g.add(hi2);
    g.userData.isEye = true;
    return g;
  }

  /* ============================================================
   * 兔子（奶糖）— 参考 2D：米白 + 浅棕橙渐变、粉色内耳、大棕眼、
   * 粉鼻、腮红、头顶呆毛、坐姿圆润、小圆尾。
   * ============================================================ */
  function buildRabbit() {
    const root = new THREE.Group();
    const parts = {};
    const body = new THREE.Group(); body.position.y = 0;
    const bMesh = makeBodyMesh([
      { x: 0.02, y: -0.04 }, { x: 0.30, y: -0.02 }, { x: 0.50, y: 0.12 }, { x: 0.62, y: 0.40 },
      { x: 0.63, y: 0.70 }, { x: 0.52, y: 0.98 }, { x: 0.34, y: 1.16 }, { x: 0.16, y: 1.22 }, { x: 0.04, y: 1.24 }
    ]);
    addOutline(bMesh, 0.02);
    bMesh.position.y = 0.02; body.add(bMesh);
    // 肚皮（浅色，嵌前侧）
    const belly = makeBall(0.42, 24, M.fur2); belly.scale.set(1.06, 0.94, 0.56); belly.position.set(0, 0.58, 0.35); body.add(belly);
    // 坐姿后脚（两侧）
    const footL = makeBall(0.165, 18, M.fur); footL.scale.set(0.9, 0.55, 1.5); footL.position.set(-0.34, 0.06, 0.12); body.add(footL);
    const footR = footL.clone(); footR.position.x = 0.34; body.add(footR);
    // 小圆尾
    const tail = makeBall(0.135, 18, M.fur2); tail.position.set(0, 0.92, -0.56); body.add(tail);
    regPart(parts, 'tail', tail);

    // 头（大而圆）
    const head = new THREE.Group(); head.position.set(0, 1.62, 0.06);
    const hMesh = makeBall(0.54, 30); hMesh.scale.set(1.02, 1.05, 0.98); addOutline(hMesh, 0.018); head.add(hMesh);
    // 脸颊/口鼻（浅色，前下方）
    const snout = new THREE.Group();
    const snMesh = makeBall(0.24, 24, M.fur2); snMesh.scale.set(1.0, 0.78, 0.78); snMesh.position.set(0, -0.1, 0.4); snout.add(snMesh);
    head.add(snout);
    // 腮红（粉团）
    const blushL = makeBall(0.085, 14, M.blush); blushL.scale.set(1.15, 0.85, 0.6); blushL.position.set(-0.35, -0.02, 0.42); head.add(blushL);
    const blushR = blushL.clone(); blushR.position.x = 0.35; head.add(blushR);
    // 眼睛（大棕眼，带高光）
    const eyeL = makeEye(0.095, 0.036); eyeL.position.set(-0.21, 0.13, 0.46); head.add(eyeL);
    const eyeR = makeEye(0.095, 0.036); eyeR.position.set(0.21, 0.13, 0.46); head.add(eyeR);
    // 眉毛
    function brow(x) {
      const g = new THREE.Group(); g.position.set(x, 0.34, 0.5);
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.026, 0.02), M.dark); b.position.y = 0.01; g.add(b);
      return g;
    }
    const browL = brow(-0.2), browR = brow(0.2); head.add(browL); head.add(browR);
    // 鼻子（粉三角感）
    const nose = makeBall(0.062, 16, M.noseM); nose.scale.set(1.2, 0.92, 0.85); nose.position.set(0, -0.02, 0.55); head.add(nose);
    // 嘴（可张合）
    const mouth = new THREE.Group(); mouth.position.set(0, -0.14, 0.52);
    const mInner = makeBall(0.11, 18, M.mouth); mInner.scale.set(1, 0.24, 0.6); mouth.add(mInner);
    head.add(mouth);
    // 长圆耳朵（外侧渐变棕橙 + 内侧粉，根部可转动 = 摇/竖/垂）
    function ear(x, side) {
      const g = new THREE.Group(); g.position.set(x, 0.4, 0.02);
      const outer = makeCapsule(0.17, 0.46, matFur(0xf1d09b, 0xe5b784, 'rb_ear_' + (side > 0 ? 'r' : 'l'), true));
      outer.scale.set(1.0, 1, 0.6); outer.position.y = 0.42; g.add(outer);
      const inner = makeCapsule(0.09, 0.4, M.pink); inner.scale.set(0.85, 1, 0.62); inner.position.set(side * 0.006, 0.4, 0.055); g.add(inner);
      const tip = makeBall(0.17, 16, outer.material); tip.scale.set(0.98, 0.82, 0.6); tip.position.y = 0.8; g.add(tip);
      g.rotation.z = side * -0.2;
      return g;
    }
    const earL = ear(-0.17, -1), earR = ear(0.17, 1); head.add(earL); head.add(earR);
    // 头顶呆毛
    const tuft = new THREE.Group(); tuft.position.set(0, 0.52, 0.05);
    const t1 = makeBall(0.07, 14, M.dark); t1.scale.set(0.8, 1.7, 0.8); t1.position.set(-0.04, 0.1, 0.02); t1.rotation.z = -0.3; tuft.add(t1);
    const t2 = makeBall(0.06, 14, M.dark); t2.scale.set(0.8, 1.6, 0.8); t2.position.set(0.05, 0.09, 0.03); t2.rotation.z = 0.35; tuft.add(t2);
    head.add(tuft);
    // 前爪（放前侧，可抬爪挥手）
    const pawG = new THREE.Group(); pawG.position.set(0.3, 0.28, 0.42);
    const paw = makeBall(0.135, 18, M.fur); paw.scale.set(1, 0.72, 1.6); pawG.add(paw); body.add(pawG);
    const pawRG = new THREE.Group(); pawRG.position.set(-0.3, 0.28, 0.42);
    const pawR = paw.clone(); pawRG.add(pawR); body.add(pawRG);

    root.add(body); root.add(head);
    parts.body = bMesh; parts.head = hMesh; parts.belly = belly;
    parts.nose = nose; parts.mouth = mouth; parts.paw = paw; parts.pawR = pawR;
    parts.anchor = {
      head: anchor(root, 0, 1.92, 0.06, 'head'),
      body: anchor(root, 0, 0.8, 0, 'body'),
      belly: anchor(root, 0, 0.66, 0.52, 'belly'),
      nose: anchor(root, 0, 1.8, 0.66, 'nose'),
      ear: anchor(root, -0.32, 2.66, 0.06, 'ear'),
      earR: anchor(root, 0.32, 2.66, 0.06, 'earR'),
      tail: anchor(root, 0, 1.0, -0.66, 'tail'),
      paw: anchor(root, 0.34, 0.16, 0.68, 'paw'),
      pawR: anchor(root, -0.34, 0.16, 0.68, 'pawR'),
      mouth: anchor(root, 0, 1.74, 0.66, 'mouth')
    };
    return { root, body, head, eyeL, eyeR, browL, browR, earL, earR, tail, mouth, paw: pawG, pawR: pawRG, parts, kind: 'rabbit' };
  }

  /* ============================================================
   * 狗（布丁）— 参考 2D：奶油白卷毛、大垂耳(外金黄内粉)、琥珀大眼、
   * 棕鼻、吐舌、粉色爪垫、走姿抬头、蓬松卷尾。
   * ============================================================ */
  function buildDog() {
    const root = new THREE.Group();
    const parts = {};
    const body = new THREE.Group(); body.position.y = 0;
    const bMesh = makeBodyMesh([
      { x: 0.02, y: -0.04 }, { x: 0.34, y: -0.02 }, { x: 0.56, y: 0.1 }, { x: 0.66, y: 0.34 },
      { x: 0.66, y: 0.6 }, { x: 0.55, y: 0.84 }, { x: 0.34, y: 1.0 }, { x: 0.14, y: 1.05 }, { x: 0.03, y: 1.05 }
    ]);
    addOutline(bMesh, 0.02);
    bMesh.position.y = 0.0; body.add(bMesh);
    const belly = makeBall(0.44, 24, M.fur2); belly.scale.set(1.05, 0.88, 0.56); belly.position.set(0, 0.5, 0.36); body.add(belly);
    // 坐姿后腿
    const legL = makeBall(0.165, 18, M.fur); legL.scale.set(0.85, 0.52, 1.5); legL.position.set(-0.35, 0.05, 0.1); body.add(legL);
    const legR = legL.clone(); legR.position.x = 0.35; body.add(legR);
    // 蓬松卷尾（多球簇）
    const tail = new THREE.Group(); tail.position.set(0, 0.92, -0.58);
    const t0 = makeBall(0.16, 18, M.fur); t0.position.y = -0.16; tail.add(t0);
    const t1 = makeBall(0.2, 18, M.fur); t1.position.set(0.04, 0.0, -0.06); tail.add(t1);
    const t2 = makeBall(0.17, 16, M.fur2); t2.position.set(-0.02, 0.16, -0.02); tail.add(t2);
    body.add(tail);
    regPart(parts, 'tail', tail);

    // 头
    const head = new THREE.Group(); head.position.set(0, 1.42, 0.1);
    const hMesh = makeBall(0.5, 30); hMesh.scale.set(1.05, 1.04, 1.0); addOutline(hMesh, 0.018); head.add(hMesh);
    // 蓬松卷毛（头顶 + 脸颊绒毛球）
    const fluff = new THREE.Group();
    const f1 = makeBall(0.16, 16, M.fur); f1.scale.set(1.1, 0.9, 1.1); f1.position.set(0, 0.42, 0.06); fluff.add(f1);
    const f2 = makeBall(0.13, 16, M.fur); f2.scale.set(1, 0.85, 1); f2.position.set(-0.32, 0.26, 0.1); fluff.add(f2);
    const f3 = makeBall(0.13, 16, M.fur); f3.scale.set(1, 0.85, 1); f3.position.set(0.32, 0.26, 0.1); fluff.add(f3);
    const f4 = makeBall(0.12, 14, M.fur2); f4.scale.set(1.05, 0.8, 1); f4.position.set(0.37, -0.14, 0.14); fluff.add(f4);
    const f5 = makeBall(0.12, 14, M.fur2); f5.scale.set(1.05, 0.8, 1); f5.position.set(-0.37, -0.14, 0.14); fluff.add(f5);
    head.add(fluff);
    // 口鼻
    const snout = new THREE.Group();
    const snMesh = makeBall(0.22, 24, M.fur2); snMesh.scale.set(1.34, 0.92, 0.9); snMesh.position.set(0, -0.16, 0.34); snout.add(snMesh);
    head.add(snout);
    // 腮红
    const blushL = makeBall(0.08, 14, M.blush); blushL.scale.set(1.1, 0.8, 0.6); blushL.position.set(-0.34, -0.12, 0.36); head.add(blushL);
    const blushR = blushL.clone(); blushR.position.x = 0.34; head.add(blushR);
    // 琥珀大眼
    const eyeL = makeEye(0.1, 0.04); eyeL.position.set(-0.21, 0.1, 0.42); head.add(eyeL);
    const eyeR = makeEye(0.1, 0.04); eyeR.position.set(0.21, 0.1, 0.42); head.add(eyeR);
    function brow(x) {
      const g = new THREE.Group(); g.position.set(x, 0.31, 0.46);
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.028, 0.02), M.dark); b.position.y = 0.01; g.add(b);
      return g;
    }
    const browL = brow(-0.22), browR = brow(0.22); head.add(browL); head.add(browR);
    // 棕鼻
    const nose = makeBall(0.075, 16, M.noseM); nose.scale.set(1.25, 0.9, 0.85); nose.position.set(0, -0.1, 0.56); head.add(nose);
    // 嘴 + 吐舌
    const mouth = new THREE.Group(); mouth.position.set(0, -0.22, 0.5);
    const mInner = makeBall(0.13, 18, M.mouth); mInner.scale.set(1.15, 0.22, 0.6); mouth.add(mInner);
    const tongue = makeBall(0.07, 14, M.pink); tongue.scale.set(0.9, 1.7, 0.5); tongue.position.set(0, -0.16, 0.04); mouth.add(tongue);
    head.add(mouth);
    // 大垂耳（外侧金黄卷、内侧粉）
    function ear(x, side) {
      const g = new THREE.Group(); g.position.set(x, 0.24, 0.02);
      const outer = makeBall(0.21, 20, matFur(0xf3d9a8, 0xe3bd86, 'dg_ear_' + (side > 0 ? 'r' : 'l'), true));
      outer.scale.set(0.58, 1.05, 0.66); outer.position.y = -0.22; g.add(outer);
      const inner = makeBall(0.145, 18, M.pink); inner.scale.set(0.5, 0.9, 0.5); inner.position.set(side * 0.02, -0.24, 0.07); g.add(inner);
      g.rotation.x = 0.16; g.rotation.z = side * 0.2;
      return g;
    }
    const earL = ear(-0.36, -1), earR = ear(0.36, 1); head.add(earL); head.add(earR);
    // 前爪（带粉色爪垫）
    const pawG = new THREE.Group(); pawG.position.set(0.28, 0.2, 0.44);
    const paw = makeBall(0.135, 18, M.fur); paw.scale.set(1, 0.66, 1.6); pawG.add(paw);
    const pad = makeBall(0.06, 12, M.pink); pad.scale.set(1.1, 0.7, 1.1); pad.position.set(0, -0.02, 0.16); pawG.add(pad);
    body.add(pawG);
    const pawRG = new THREE.Group(); pawRG.position.set(-0.28, 0.2, 0.44);
    const pawR = paw.clone(); pawRG.add(pawR); body.add(pawRG);

    root.add(body); root.add(head);
    parts.body = bMesh; parts.head = hMesh; parts.belly = belly;
    parts.nose = nose; parts.mouth = mouth; parts.paw = paw; parts.pawR = pawR;
    parts.anchor = {
      head: anchor(root, 0, 1.66, 0.1, 'head'),
      body: anchor(root, 0, 0.66, 0, 'body'),
      belly: anchor(root, 0, 0.54, 0.56, 'belly'),
      nose: anchor(root, 0, 1.55, 0.66, 'nose'),
      ear: anchor(root, -0.52, 1.86, 0.1, 'ear'),
      earR: anchor(root, 0.52, 1.86, 0.1, 'earR'),
      tail: anchor(root, 0, 1.1, -0.7, 'tail'),
      paw: anchor(root, 0.32, 0.1, 0.7, 'paw'),
      pawR: anchor(root, -0.32, 0.1, 0.7, 'pawR'),
      mouth: anchor(root, 0, 1.5, 0.66, 'mouth')
    };
    return { root, body, head, eyeL, eyeR, browL, browR, earL, earR, tail, mouth, paw: pawG, pawR: pawRG, parts, kind: 'dog' };
  }

  const BUILDERS = { rabbit: buildRabbit, dog: buildDog };
  const PALETTES = {
    rabbit: {
      key: 'rb', top: 0xf8e6c6, bottom: 0xfffaf2, fur2: 0xfffbf6, dark: 0xe6b787,
      pink: 0xffc3d6, nose: 0xf2919f, iris: 0x9a6239, pupil: 0x2e1a10, eyeWhite: 0xffffff,
      blush: 0xffa4b7, mouthInner: 0xa0565e, outline: 0x48342a
    },
    dog: {
      key: 'dg', top: 0xf8eacd, bottom: 0xfff9f0, fur2: 0xfffbf2, dark: 0xe9c280,
      pink: 0xf9b2bd, nose: 0x93623d, iris: 0xc0803a, pupil: 0x4a2a12, eyeWhite: 0xffffff,
      blush: 0xf5acb4, mouthInner: 0xa8565e, outline: 0x48342a
    }
  };

  /* ---------- 宠物实例状态 ---------- */
  function makePetState(role, scale) {
    return {
      role, scale, sleep: false, speakUntil: 0,
      blinkC: 1 + Math.random() * 3, blinkHold: 0, eyeY: 1,
      fx: null, fxT: 0, phase: Math.random() * 6.28, t: 0,
      hopY: 0, squashX: 1, squashY: 1,
      grump: 0, px: {}, scalePx: 1
    };
  }

  /* ============================================================
   * 布局：把宠物放上台（x/z/朝向/缩放），并计算相机距离
   * ============================================================ */
  function layoutStage() {
    const list = layout.roles || [];
    pets.forEach((p) => { if (p.inst.parent) scene.remove(p.inst); });
    shadows.forEach((s) => { if (s.parent) scene.remove(s); });
    pets.clear(); shadows.length = 0;

    let hasOther = false;
    const posList = [];
    list.forEach((r, i) => {
      const my = r.role === layout.my;
      if (!my) hasOther = true;
      let x = 0, z = 0, yaw = 0, scale = r.scale || (my ? 1 : 0.62);
      if (list.length === 1) { x = 0; }
      else if (my) {
        if (layout.atWork) { x = -0.82; yaw = 0.38; } else { x = 0.95; yaw = -0.4; }
      } else {
        if (layout.atWork) { x = 1.15; z = -0.25; yaw = -0.42; scale = 0.62; }
        else { x = -1.18; z = -0.2; yaw = 0.5; scale = 0.66; }
      }
      posList.push({ role: r.role, x, z, yaw, scale, my });
    });

    posList.forEach((cfg) => {
      const role = cfg.role;
      if (!pets.has(role)) {
        setPalette(PALETTES[role] || PALETTES.rabbit);
        const char = BUILDERS[role]();
        const inst = new THREE.Group();
        inst.add(char.root);
        scene.add(inst);
        const st = makePetState(role, cfg.scale);
        const pet = Object.assign({ inst, char, state: st }, st);
        pet.mats = M;
        pets.set(role, pet);
      }
      const pet = pets.get(role);
      pet.inst.position.set(cfg.x, 0, cfg.z);
      pet.inst.rotation.y = cfg.yaw;
      const s = pet.state.scale = cfg.scale;
      pet.inst.scale.set(s, s, s);
      pet.state.my = cfg.my;
      const sh = new THREE.Mesh(
        new THREE.CircleGeometry(0.92 * s, 32),
        new THREE.MeshBasicMaterial({ color: 0x3a2a20, transparent: true, opacity: 0.15, depthWrite: false })
      );
      sh.rotation.x = -Math.PI / 2; sh.position.set(cfg.x, 0.02, cfg.z);
      sh.userData.pet = role; sh.userData.base = 0.92 * s;
      scene.add(sh); shadows.push(sh);
    });

    fitCamera(hasOther);
  }

  function fitCamera(hasOther) {
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const aspect = camera.aspect;
    // 单只：只装下一只居中；双只：装下两只 + 高度约束
    const top = layout.atWork ? 2.2 : (hasOther ? 3.3 : 3.05);
    const cy = top * 0.5;
    VIEW.cy = cy;
    const needV = Math.max(top - cy + 0.5, cy + 0.28);
    const dV = needV / tanHalf;
    const span = hasOther ? (layout.atWork ? 2.8 : 3.0) : 1.55;
    const dH = (span * 0.5) / (tanHalf * Math.max(aspect, 0.42));
    const d = Math.max(dV, dH) + 0.35;
    camera.position.set(0, VIEW.cy, d);
    camera.lookAt(0, VIEW.cy, 0);
    camera.updateMatrixWorld();
  }

  /* ---------- 动作（fx） ---------- */
  function easeOut(u) { return 1 - Math.pow(1 - u, 3); }
  function easeIn(u) { return u * u * u; }

  function act(role, kind, opt) {
    const pet = pets.get(role); if (!pet) return false;
    const p = pet.state;
    const o = opt || {};
    let dur = 1.1;
    if (kind === 'eat') dur = 2.0;
    else if (kind === 'reject') dur = 2.0;
    else if (kind === 'happy' || kind === 'poke-head' || kind === 'poke-belly') dur = 1.3;
    else if (kind === 'startle') dur = 1.5;
    else if (kind === 'poke-ear') dur = 1.0;
    else if (kind === 'sleep') dur = 0.6;
    else if (kind === 'wake') dur = 0.4;
    p.fx = { kind, dur, t: 0, part: o.part || '' };
    if (kind === 'sleep') p.sleep = true;
    if (kind === 'wake') p.sleep = false;
    if (kind === 'talk') { p.speakUntil = Date.now() + (o.ms || 1500); return true; }
    return true;
  }

  /* ---------- 每帧姿态计算 ---------- */
  function easeVal(u) { return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; }
  function updatePet(pet, dt, now) {
    const p = pet.state, ch = pet.char;
    p.t += dt;
    const T = now / 1000;

    if (p.fx) {
      p.fxT += dt;
      if (p.fxT >= p.fx.dur) { p.fx = null; p.fxT = 0; }
    }
    const fx = p.fx;
    const u = fx ? Math.min(1, p.fxT / fx.dur) : 1;
    const ev = fx ? easeVal(u) : 1;

    const pose = { hop: 0, hopFreq: 1, headPitch: 0, headYaw: 0, earShake: 0, earTwitch: 0, earOut: 0, earBack: 0, jaw: 0, eyeSq: 0, angry: 0, tailWag: p.sleep ? 0 : 0.12, pawWave: 0, bodyRoll: 0, shiver: 0, muzzlePulse: 0 };

    const speaking = Date.now() < p.speakUntil;
    const breathe = p.sleep ? 0.008 : 0.017;
    const breath = Math.sin(T * (p.sleep ? 1.1 : 2.1) + p.phase);

    if (fx) {
      const k = fx.kind;
      const inW = Math.sin(u * Math.PI);
      const decay = (1 - u);
      if (k === 'happy' || k === 'poke-head') {
        pose.hop = Math.max(pose.hop, inW * (k === 'happy' ? 0.3 : 0.14));
        pose.earShake = Math.max(pose.earShake, inW * 0.8);
        pose.eyeSq = Math.max(pose.eyeSq, inW);
        pose.tailWag = Math.max(pose.tailWag, 0.7);
        pose.headPitch = Math.max(pose.headPitch, inW * 0.12);
        pose.jaw = Math.max(pose.jaw, inW * 0.3);
      } else if (k === 'poke-belly') {
        pose.hop = Math.max(pose.hop, Math.abs(Math.sin(u * 3 * Math.PI)) * 0.16);
        pose.headPitch = Math.max(pose.headPitch, inW * 0.22);
        pose.eyeSq = Math.max(pose.eyeSq, inW);
        pose.jaw = Math.max(pose.jaw, inW * 0.5);
        pose.shiver = Math.max(pose.shiver, inW);
      } else if (k === 'poke-ear') {
        const side = fx.part === 'earR' ? 1 : -1;
        pose.earShake = Math.max(pose.earShake, decay * 1.6);
        pose.earTwitch = Math.max(pose.earTwitch, decay * 4);
        pose.eyeSq = Math.max(pose.eyeSq, inW * 0.5);
      } else if (k === 'poke-nose') {
        pose.headYaw = Math.max(pose.headYaw, Math.sin(u * Math.PI * 2) * 0.34);
        pose.muzzlePulse = Math.max(pose.muzzlePulse, inW);
        pose.eyeSq = Math.max(pose.eyeSq, inW * 0.6);
      } else if (k === 'poke-paw' || k === 'poke-body') {
        pose.pawWave = Math.max(pose.pawWave, Math.abs(Math.sin(u * 3 * Math.PI)));
        pose.tailWag = Math.max(pose.tailWag, 0.9);
        pose.headPitch = Math.max(pose.headPitch, inW * 0.08);
        pose.eyeSq = Math.max(pose.eyeSq, inW * 0.6);
      } else if (k === 'poke-tail') {
        pose.tailWag = Math.max(pose.tailWag, 2.6 * decay);
        pose.eyeSq = Math.max(pose.eyeSq, inW * 0.5);
      } else if (k === 'reject' || k === 'grumpy') {
        pose.headYaw = Math.max(pose.headYaw, easeOut(u) * -0.62);
        pose.angry = Math.max(pose.angry, easeOut(u));
        pose.earBack = Math.max(pose.earBack, Math.sin(u * Math.PI) * 0.9);
        pose.jaw = Math.max(pose.jaw, u < 0.2 ? u * 4 * 0.4 : 0.05);
        pose.tailWag = 0.03;
      } else if (k === 'eat') {
        pose.jaw = (Math.abs(Math.sin(T * 9)) * 0.85) * decay;
        pose.tailWag = 0.8 * decay;
        pose.eyeSq = Math.max(pose.eyeSq, 0.5);
        pose.headPitch = Math.max(pose.headPitch, Math.sin(T * 9) * 0.05);
      } else if (k === 'sleep') {
        pose.headPitch = Math.max(pose.headPitch, easeOut(u) * 0.1);
      } else if (k === 'startle') {
        pose.hop = Math.max(pose.hop, Math.sin(u * Math.PI) * 0.55);
        pose.earShake = Math.max(pose.earShake, Math.sin(u * Math.PI) * 1.4);
        pose.eyeSq = 0; pose.angry = 1 - Math.min(1, u * 2);
        pose.jaw = Math.max(pose.jaw, Math.sin(Math.min(1, u * 1.6) * Math.PI) * 0.9);
      }
    }
    if (speaking) {
      pose.jaw = Math.max(pose.jaw, (Math.sin(T * 7.5) * 0.5 + 0.5) * 0.8);
      pose.headPitch = Math.max(pose.headPitch, Math.sin(T * 7.5) * 0.04);
    }

    const body = ch.body, head = ch.head;
    let hopNow = pose.hop;
    const sq = 1 - Math.min(0.16, hopNow * 0.9);
    body.position.y = hopNow + breath * 0.03;
    body.scale.set(sq + pose.shiver * Math.sin(T * 60) * 0.01, 1 / sq + hopNow * 0.25, sq);
    // 尾巴摇（狗是多球组：整体 z 摆动；兔是圆球：x 转动）
    if (ch.tail) {
      if (ch.kind === 'dog') ch.tail.rotation.z = Math.sin(T * (6 + pose.tailWag * 9)) * (0.12 + pose.tailWag * 0.5);
      else ch.tail.rotation.x = Math.sin(T * (6 + pose.tailWag * 9)) * (0.16 + pose.tailWag * 0.55);
    }
    head.rotation.y = pose.headYaw + Math.sin(T * 0.6 + p.phase) * 0.06;
    head.rotation.x = pose.headPitch + Math.sin(T * 1.7 + p.phase) * 0.03;
    head.rotation.z = pose.shiver * Math.sin(T * 50) * 0.05;
    applyEars(ch, p, pose, T);
    let eyeTarget = p.sleep ? 0.05 : 1;
    if (!p.sleep && (pose.eyeSq > 0.35 || pose.angry > 0.4)) eyeTarget = 0.42;
    if (p.sleep) eyeTarget = 0.05;
    if (!p.sleep && !fx) {
      p.blinkC -= dt;
      if (p.blinkC <= 0) { p.blinkC = 1.6 + Math.random() * 3.4; p.blinkHold = 0.12; }
      if (p.blinkHold > 0) { p.blinkHold -= dt; if (p.blinkHold <= 0) eyeTarget = 1; else eyeTarget = 0.07; }
    }
    if (p.sleep) { if (p.eyeY > 0.05) p.eyeY -= dt * 4; }
    else p.eyeY += (eyeTarget - p.eyeY) * Math.min(1, dt * 16);
    ch.eyeL.scale.y = Math.max(0.04, p.eyeY);
    ch.eyeR.scale.y = Math.max(0.04, p.eyeY);
    const browA = pose.angry > 0.2 ? -0.55 * Math.min(1, pose.angry * 1.4) : 0;
    ch.browL.rotation.z = browA;
    ch.browR.rotation.z = -browA;
    ch.browL.position.y = 0.01 + (browA < 0 ? 0.06 : 0);
    ch.browR.position.y = 0.01 + (browA < 0 ? 0.06 : 0);
    const jawOpen = Math.min(1, pose.jaw);
    ch.mouth.scale.y = 0.24 + jawOpen * 1.15;
    ch.mouth.scale.z = 0.6 + jawOpen * 0.2;
    ch.paw.rotation.z = pose.pawWave > 0 ? -Math.abs(Math.sin(p.fxT * 16)) * 1.1 : 0;
    ch.pawR.rotation.z = 0;
    p.grump = Math.max(0, p.grump - dt * 0.6);
  }

  function applyEars(ch, p, pose, T) {
    const flapBase = ch.kind === 'dog' ? 0.16 : 0.0;
    const wig = pose.earShake * Math.sin(T * 34) * 0.35;
    const tw = pose.earTwitch * Math.sin(T * 13) * 0.22;
    const splay = pose.earOut * 0.3;
    ch.earL.rotation.x = flapBase + pose.earBack * 0.7 + wig * (p.fx && p.fx.part === 'earL' ? 1 : 0.35);
    ch.earL.rotation.z = (ch.kind === 'dog' ? -0.2 : -0.16) + splay + tw;
    ch.earR.rotation.x = flapBase + pose.earBack * 0.7 + wig * (p.fx && p.fx.part === 'earR' ? 1 : 0.35);
    ch.earR.rotation.z = (ch.kind === 'dog' ? 0.2 : 0.16) - splay + tw * 0.6;
    if (p.sleep) {
      ch.earL.rotation.x += 0.1 * Math.sin(T * 1.2);
      ch.earR.rotation.x += 0.1 * Math.sin(T * 1.2 + 0.5);
    }
  }

  /* ---------- 渲染循环 ---------- */
  function frame(now) {
    rafId = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - lastT) / 1000 || 0.016);
    lastT = now;
    if (!running) return;
    try {
      pets.forEach((pet) => {
        updatePet(pet, dt, now);
        shadows.forEach((sh) => {
          if (sh.userData.pet === pet.role) {
            const h = Math.max(0, pet.inst.position.y);
            const s = sh.userData.base * (1 - h * 0.2);
            sh.scale.set(s, s, 1);
            sh.material.opacity = 0.15 - h * 0.03;
          }
        });
        storePx(pet);
      });
      renderer.render(scene, camera);
      renderFails = 0;
    } catch (err) {
      renderFails++;
      if (renderFails > 8) fail('render: ' + ((err && err.message) || err));
    }
  }
  function storePx(pet) {
    const st = pet.state, w = cv.clientWidth || 1, h = cv.clientHeight || 1;
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const dist = Math.max(1, camera.position.z - pet.inst.position.z);
    st.scalePx = (h / (2 * tanHalf * dist));
    Object.keys(pet.char.parts.anchor).forEach((name) => {
      const a = pet.char.parts.anchor[name];
      a.getWorldPosition(tmpV);
      tmpV.project(camera);
      const x = (tmpV.x * 0.5 + 0.5) * w;
      const y = (-tmpV.y * 0.5 + 0.5) * h;
      st.px[name] = { x, y, valid: tmpV.z < 1 };
    });
  }

  function anchorPx(role, name) {
    const pet = pets.get(role); if (!pet) return null;
    const a = pet.state.px[name] || pet.state.px.head;
    if (!a || !a.valid) return null;
    return a;
  }
  function headPx(role) { return anchorPx(role, 'head'); }

  function pickAt(clientX, clientY) {
    const rect = cv.getBoundingClientRect();
    const x = clientX - rect.left, y = clientY - rect.top;
    let best = null;
    pets.forEach((pet, role) => {
      const st = pet.state;
      const anchors = pet.char.parts.anchor;
      const head = st.px.head; if (!head) return;
      const bodyR = 0.52 * st.scale * st.scalePx;
      if (dist2(x, y, head.x, head.y) <= bodyR * bodyR * 1.6) {
        const cand = { role, part: 'body', d: Math.sqrt(dist2(x, y, head.x, head.y)) / Math.max(1, bodyR) };
        if (!best || cand.d < best.d) best = cand;
      }
      Object.keys(anchors).forEach((name) => {
        const a = st.px[name]; if (!a || !a.valid) return;
        const rWorld = (PART_R[name] || 0.3) * st.scale;
        const rPx = Math.max(12, rWorld * st.scalePx);
        const d2 = dist2(x, y, a.x, a.y);
        if (d2 <= rPx * rPx) {
          const cand = { role, part: name === 'pawR' ? 'paw' : name, d: Math.sqrt(d2) / rPx };
          if (!best || cand.d < best.d) best = cand;
        }
      });
    });
    return best;
  }
  function dist2(x1, y1, x2, y2) { const dx = x1 - x2, dy = y1 - y2; return dx * dx + dy * dy; }

  /* ---------- 指针：轻点=抚摸；睡觉时点=吵醒 ---------- */
  function onPointerDown(e) {
    if (!enabled || !cv) return;
    cv.setPointerCapture && cv.setPointerCapture(e.pointerId);
    cv._pd = { x: e.clientX, y: e.clientY, t: Date.now() };
  }
  function onPointerUp(e) {
    if (!cv || !cv._pd) return;
    const s = cv._pd; cv._pd = null;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    const quick = Date.now() - s.t < 600 && Math.hypot(dx, dy) < 10;
    if (!quick) return;
    const hit = pickAt(e.clientX, e.clientY);
    if (hit) cb.onTap && cb.onTap(hit.role, hit.part);
    else cb.onEmptyTap && cb.onEmptyTap();
  }

  /* ---------- 挂载 ---------- */
  function fail(detail) {
    if (!enabled && !renderer) return;
    failReason = detail || failReason || 'webgl-fail';
    const wasEnabled = enabled;
    destroy();
    if (wasEnabled && cb && cb.onFail) { try { cb.onFail(failReason); } catch (e) {} }
  }
  function attach(el, options) {
    if (enabled) return true;
    cb = options || cb;
    const ua = navigator.userAgent || '';
    isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    try {
      renderer = new THREE.WebGLRenderer({ antialias: !isIOS, alpha: true, powerPreference: 'default', failIfMajorPerformanceCaveat: false });
    } catch (e) {
      failReason = 'webgl: ' + (e && e.message);
      return false;
    }
    if (!renderer.getContext || !renderer.getContext()) {
      try { renderer.dispose(); } catch (e) {}
      failReason = 'webgl: no context';
      return false;
    }
    host = el;
    cv = renderer.domElement;
    cv.id = 'p3dCv';
    cv.style.width = '100%'; cv.style.height = '100%';
    cv.style.display = 'block'; cv.style.touchAction = 'none';
    cv.style.position = 'absolute'; cv.style.inset = '0';
    cv.addEventListener('webglcontextlost', function (ev) {
      if (ev && ev.preventDefault) ev.preventDefault();
      fail('contextlost');
    }, false);
    host.appendChild(cv);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(VIEW.fov, 1, 0.1, 60);
    camera.position.set(0, VIEW.cy, 6.5);
    scene.add(hemi); scene.add(lightDir); scene.add(lightFill); scene.add(ambient);
    lightDir.position.set(4, 7, 4); lightDir.intensity = 0.55;
    lightFill.position.set(-5, 3, -4); lightFill.intensity = 0.5;
    cv.addEventListener('pointerdown', onPointerDown);
    cv.addEventListener('pointerup', onPointerUp);
    cv.addEventListener('pointercancel', onPointerUp);
    resize();
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(resize).observe(host);
    }
    enabled = true;
    running = true;
    lastT = performance.now();
    rafId = requestAnimationFrame(frame);
    return true;
  }
  function resize() {
    if (!host || !renderer) return;
    const w = host.clientWidth || 300, h = host.clientHeight || 300;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isIOS ? 1.75 : 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    layoutStage();
  }
  function setRunning(b) {
    running = !!b;
    if (running && !rafId) { lastT = performance.now(); rafId = requestAnimationFrame(frame); }
  }
  function destroy() {
    running = false; enabled = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    try { if (renderer) { renderer.dispose(); renderer = null; } } catch (e) {}
    try { if (cv && cv.parentNode) cv.parentNode.removeChild(cv); } catch (e) {}
    cv = null; host = null;
  }

  return {
    attach, resize, act, pickAt, headPx, anchorPx, setRunning, destroy, fail,
    setRoles(r) { layout.roles = r || []; layoutStage(); },
    setMode(o) {
      if (o) { layout.my = o.my || layout.my; layout.atWork = !!o.atWork; }
      if (o && o.roles) layout.roles = o.roles;
      layoutStage();
    },
    setSleeping(role, on) {
      const pet = pets.get(role); if (!pet) return;
      pet.state.sleep = !!on;
      if (on) { pet.state.speakUntil = 0; pet.eyeY = Math.min(pet.eyeY, 0.08); }
    },
    isSleeping(role) { const pet = pets.get(role); return pet ? pet.state.sleep : false; },
    status() { return { enabled, failReason, count: pets.size }; },
    get enabled() { return enabled; }
  };
}

/* 导出：兼容动态 import() 使用 */
const Pet3D = PetStage();
window.Pet3D = Pet3D;
export { Pet3D };
export default Pet3D;
