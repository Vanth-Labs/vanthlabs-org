/* lab.js — the lab's illustration of the text-to-motion model, on the SMPL-X skeleton.
   The model outputs SMPL-X poses: 55 joints (body, jaw, eyes, both hands), one axis-angle rotation each.
   The figure here uses that same skeleton (kinematic tree and rest joints) and the same kind of per-joint
   rotations. What it does NOT use:
   - the SMPL-X mesh: non-commercial licence, not distributed (as Hannah's own repo notes). The body here is an
     approximate surface, drawn in the style of an SMPL-X render (grey, with the quad grid), skinned to the skeleton;
   - motion data: the gestures are keyed by hand. The training slider blends random motion with the gesture.
   Views follow the usual pipeline picture: keypoints → skeleton → body.
   three.js r160 is vendored in ./vendor (MIT), so the page makes no third-party requests. */
import * as THREE from './vendor/three.module.min.js';

/* SMPL-X rest joints (metres), J_regressor @ v_template: the same derived data Hannah's frontend ships
   in src/retarget/smplxRest.json. Model faces +z, y up, its left side is +x. */
const REST = [[0.0031,-0.3514,0.012],[0.0613,-0.4442,-0.014],[-0.0601,-0.4553,-0.0092],[0.0004,-0.2415,-0.0156],[0.116,-0.8229,-0.0234],[-0.1044,-0.8177,-0.026],[0.0098,-0.1097,-0.0215],[0.0726,-1.226,-0.0552],[-0.0889,-1.2284,-0.0462],[-0.0015,-0.0574,0.0069],[0.1198,-1.284,0.063],[-0.1278,-1.2868,0.0728],[-0.0137,0.1077,-0.0247],[0.0448,0.0275,-0.0003],[-0.0492,0.0269,-0.0065],[0.0111,0.2682,-0.004],[0.1641,0.0852,-0.0158],[-0.1518,0.0804,-0.0191],[0.4182,0.0131,-0.0582],[-0.4229,0.0439,-0.0456],[0.6702,0.0363,-0.0607],[-0.6722,0.0394,-0.0609],[-0.0047,0.2677,-0.0096],[0.0316,0.3108,0.0622],[-0.0316,0.3108,0.0622],[0.7721,0.0276,-0.0413],[0.804,0.0298,-0.0383],[0.8266,0.0275,-0.0383],[0.7796,0.03,-0.0647],[0.8102,0.0308,-0.0687],[0.8337,0.0288,-0.0728],[0.7542,0.0218,-0.1044],[0.7697,0.0206,-0.1164],[0.7852,0.019,-0.1277],[0.7676,0.027,-0.088],[0.7957,0.0285,-0.0933],[0.8185,0.0271,-0.1004],[0.7108,0.0183,-0.0351],[0.7278,0.0193,-0.0101],[0.7484,0.0142,0.0054],[-0.7721,0.0276,-0.0413],[-0.804,0.0298,-0.0383],[-0.8266,0.0275,-0.0383],[-0.7796,0.03,-0.0647],[-0.8102,0.0308,-0.0687],[-0.8337,0.0288,-0.0728],[-0.7542,0.0218,-0.1044],[-0.7697,0.0206,-0.1164],[-0.7852,0.019,-0.1277],[-0.7676,0.027,-0.088],[-0.7957,0.0285,-0.0933],[-0.8185,0.0271,-0.1004],[-0.7108,0.0183,-0.0351],[-0.7278,0.0193,-0.0101],[-0.7484,0.0142,0.0054]];
const PARENT = [-1, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 9, 9, 12, 13, 14, 16, 17, 18, 19, 15, 15, 15,
  20, 25, 26, 20, 28, 29, 20, 31, 32, 20, 34, 35, 20, 37, 38,
  21, 40, 41, 21, 43, 44, 21, 46, 47, 21, 49, 50, 21, 52, 53];
const Y0 = 1.335; // puts the soles on the floor
const J = { pelvis: 0, lHip: 1, rHip: 2, spine1: 3, lKnee: 4, rKnee: 5, spine2: 6, lAnkle: 7, rAnkle: 8, spine3: 9, lFoot: 10, rFoot: 11,
  neck: 12, lCollar: 13, rCollar: 14, head: 15, lShoulder: 16, rShoulder: 17, lElbow: 18, rElbow: 19, lWrist: 20, rWrist: 21 };
const FING = { l: { index: [25, 26, 27], middle: [28, 29, 30], pinky: [31, 32, 33], ring: [34, 35, 36], thumb: [37, 38, 39] },
  r: { index: [40, 41, 42], middle: [43, 44, 45], pinky: [46, 47, 48], ring: [49, 50, 51], thumb: [52, 53, 54] } };

/* ---------- poses: Euler XYZ per joint, relative to the T-pose rest ----------
   Mirroring left → right in this frame is (x, y, z) → (x, -y, -z). */
const mir = (e) => [e[0], -e[1], -e[2]];
function pose(spec) {
  const p = {};
  const set = (j, e) => { p[j] = e; };
  const both = (l, r, e) => { set(l, e); set(r, mir(e)); };
  const curl = (side, fingers, a, thumb) => {
    const s = side === 'l' ? -1 : 1;
    fingers.forEach((f) => FING[side][f].forEach((j, k) => set(j, [0, 0, s * a * (k === 0 ? 0.8 : 1)])));
    if (thumb != null) FING[side].thumb.forEach((j, k) => set(j, side === 'l' ? [0, -thumb * (k ? 0.6 : 0.3), -thumb * 0.4] : [0, thumb * (k ? 0.6 : 0.3), thumb * 0.4]));
  };
  /* defaults: arms down, elbows soft, hands relaxed */
  both(J.lShoulder, J.rShoulder, [0, -0.12, -1.2]);
  both(J.lElbow, J.rElbow, [0, -0.28, 0]);
  both(J.lCollar, J.rCollar, [0, 0, -0.08]);
  curl('l', ['index', 'middle', 'ring', 'pinky'], 0.28, 0.3);
  curl('r', ['index', 'middle', 'ring', 'pinky'], 0.28, 0.3);
  spec({ set, both, curl });
  return p;
}
const POSES = {
  rest: pose(() => {}),
  wave: pose(({ set, curl }) => {                       // right hand up, palm to the viewer
    set(J.rShoulder, [0, 0.3, -0.5]);
    set(J.rElbow, [0, 0.15, -1.35]);
    set(J.rWrist, [-1.45, 0, 0]);
    curl('r', ['index', 'middle', 'ring', 'pinky'], 0.06, 0.05);
    set(J.spine3, [0, -0.06, 0.04]); set(J.neck, [0, -0.08, 0.06]); set(J.head, [0.04, -0.06, 0.04]);
  }),
  point: pose(({ set, curl }) => {                      // left arm to the viewer's right, index finger out
    set(J.lShoulder, [0, -0.5, 0.06]);
    set(J.lElbow, [0, -0.12, 0.05]);
    set(J.lWrist, [0, 0, 0.08]);
    curl('l', ['middle', 'ring', 'pinky'], 1.35, 0.9);
    curl('l', ['index'], 0.02);
    set(J.spine3, [0, 0.14, 0]); set(J.neck, [0, 0.22, 0]); set(J.head, [0.02, 0.26, 0]);
  }),
  present: pose(({ both, curl, set }) => {              // both forearms forward, palms up
    both(J.lShoulder, J.rShoulder, [0, -0.62, -1.05]);
    both(J.lElbow, J.rElbow, [0, -1.55, 0]);
    both(J.lWrist, J.rWrist, [1.25, 0, 0]);
    curl('l', ['index', 'middle', 'ring', 'pinky'], 0.12, 0.1);
    curl('r', ['index', 'middle', 'ring', 'pinky'], 0.12, 0.1);
    set(J.spine3, [0.05, 0, 0]); set(J.head, [0.08, 0, 0]);
  })
};

/* Each phrase: words with their start time (s), a duration, pose keyframes [time, pose], emphasis beats.
   The page's language picks the words; the gestures are the same in both. */
const EN = (document.documentElement.lang || '').slice(0, 2) === 'en';
const PHRASES = [
  { words: EN ? [['Hi,', 0], ['how', 0.75], ['are', 0.95], ['you?', 1.15]] : [['Hola,', 0], ['¿cómo', 0.95], ['estás?', 1.3]], dur: 2.6,
    keys: [[0, 'rest'], [0.25, 'wave'], [1.9, 'wave'], [2.45, 'rest']], beats: [] },
  { words: EN ? [['Here’s', 0], ['GitHub,', 0.45], ['on', 1.3], ['your', 1.45], ['right.', 1.62]] : [['Aquí', 0], ['está', 0.32], ['GitHub,', 0.62], ['a', 1.35], ['tu', 1.5], ['derecha.', 1.68]], dur: 3.0,
    keys: [[0, 'rest'], [0.55, 'point'], [2.4, 'point'], [2.9, 'rest']], beats: EN ? [0.5] : [0.62] },
  { words: EN ? [['I', 0], ['sorted', 0.15], ['your', 0.6], ['files', 0.78], ['by', 1.3], ['type.', 1.45]] : [['Ordené', 0], ['tus', 0.5], ['archivos', 0.68], ['por', 1.3], ['tipo.', 1.48]], dur: 2.8,
    keys: [[0, 'rest'], [0.2, 'present'], [2.2, 'present'], [2.7, 'rest']], beats: EN ? [0.78, 1.45] : [0.68, 1.48] }
];
const GAP = 0.9;
/* how much an untrained model shakes each joint (radians) */
const NOISE_AMP = (j) => (j === J.lShoulder || j === J.rShoulder) ? 0.9 : (j === J.lElbow || j === J.rElbow) ? 0.8
  : (j === J.lWrist || j === J.rWrist) ? 0.5 : (j === J.spine1 || j === J.spine2 || j === J.spine3) ? 0.16
  : (j === J.neck || j === J.head) ? 0.3 : (j === J.lCollar || j === J.rCollar) ? 0.2 : j >= 25 ? 0.35 : 0;

const smooth = (x) => x * x * (3 - 2 * x);
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* ---------- the body: lofted tubes around the SMPL-X joints, skinned to them ---------- */
const CELL = 0.034; // grid cell size on the surface, like the quad grid of an SMPL-X render
function buildBody() {
  const V = (j) => new THREE.Vector3(REST[j][0], REST[j][1] + Y0, REST[j][2]);
  const pos = [], uv = [], si = [], sw = [], idx = [];
  const tmp = new THREE.Vector3(), T = new THREE.Vector3(), S = new THREE.Vector3(), F = new THREE.Vector3();
  const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  /* loft a tube along points P (with arc-length stations), radii(s) -> [side, front], bones(s) -> [[b,w],[b,w]] */
  function loft(P, radii, bones, ref, capStart = true, capEnd = true) {
    const L = [0]; for (let i = 1; i < P.length; i++) L.push(L[i - 1] + P[i].distanceTo(P[i - 1]));
    const total = L[L.length - 1], ring = 22;
    const at = (s) => {
      let i = 0; while (i < P.length - 2 && s > L[i + 1]) i++;
      const u = (s - L[i]) / Math.max(1e-6, L[i + 1] - L[i]);
      const p = P[i].clone().lerp(P[i + 1], Math.min(1, Math.max(0, u)));
      if (s < 0) p.addScaledVector(P[1].clone().sub(P[0]).normalize(), s);
      if (s > total) p.addScaledVector(P[P.length - 1].clone().sub(P[P.length - 2]).normalize(), s - total);
      return p;
    };
    const stations = [];
    const r0 = Math.min(...radii(0)), r1 = Math.min(...radii(total));
    const capN = 5;
    if (capStart) for (let k = capN; k > 0; k--) { const a = (k / capN) * Math.PI / 2; stations.push({ s: -Math.sin(a) * r0, k: Math.cos(a) }); }
    const n = Math.max(2, Math.ceil(total / 0.012));
    for (let k = 0; k <= n; k++) stations.push({ s: (k / n) * total, k: 1 });
    if (capEnd) for (let k = 1; k <= capN; k++) { const a = (k / capN) * Math.PI / 2; stations.push({ s: total + Math.sin(a) * r1, k: Math.cos(a) }); }
    const base = pos.length / 3;
    const around = Math.max(6, Math.round((Math.PI * (radii(total / 2)[0] + radii(total / 2)[1])) / CELL));
    stations.forEach((st, si_) => {
      const s = Math.min(total, Math.max(0, st.s));
      const c = at(st.s);
      const a0 = at(Math.max(0, s - 0.01)), a1 = at(Math.min(total, s + 0.01));
      T.copy(a1).sub(a0).normalize();
      S.crossVectors(T, ref); if (S.lengthSq() < 1e-6) S.crossVectors(T, new THREE.Vector3(1, 0, 0)); S.normalize();
      F.crossVectors(S, T).normalize();
      const [rs, rf] = radii(s), w = bones(st.s);
      for (let i = 0; i <= ring; i++) {
        const a = (i / ring) * Math.PI * 2;
        tmp.copy(c).addScaledVector(S, Math.cos(a) * rs * st.k).addScaledVector(F, Math.sin(a) * rf * st.k);
        pos.push(tmp.x, tmp.y, tmp.z);
        uv.push((i / ring) * around, st.s / CELL);
        si.push(w[0][0], w[1] ? w[1][0] : 0, 0, 0); sw.push(w[0][1], w[1] ? w[1][1] : 0, 0, 0);
      }
      if (si_ > 0) {
        const r0i = base + (si_ - 1) * (ring + 1), r1i = base + si_ * (ring + 1);
        for (let i = 0; i < ring; i++) idx.push(r0i + i, r1i + i, r0i + i + 1, r0i + i + 1, r1i + i, r1i + i + 1);
      }
    });
    return L;
  }
  /* a chain through joints: each segment follows the joint at its start; blends at every joint */
  function chain(joints, radiiAt, ref, opts = {}) {
    const P = joints.map((j) => (j instanceof THREE.Vector3 ? j : V(j)));
    const L = []; let acc = 0; P.forEach((p, i) => { if (i) acc += p.distanceTo(P[i - 1]); L.push(acc); });
    const drivers = joints.slice(0, -1).map((j) => (typeof j === 'number' ? j : opts.tipBone));
    const parent = opts.parent != null ? opts.parent : PARENT[joints[0]];
    const b = opts.blend || 0.035;
    loft(P, radiiAt, (s) => {
      if (s <= L[0] + b && parent >= 0) { const w = sstep(L[0] - b, L[0] + b, s); return [[drivers[0], w], [parent, 1 - w]]; }
      for (let i = 1; i < drivers.length; i++) if (Math.abs(s - L[i]) < b) { const w = sstep(L[i] - b, L[i] + b, s); return [[drivers[i], w], [drivers[i - 1], 1 - w]]; }
      let i = 0; while (i < drivers.length - 1 && s > L[i + 1]) i++;
      return [[drivers[i], 1]];
    }, ref, opts.capStart !== false, opts.capEnd !== false);
  }
  const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
  const lerpR = (stops) => (s) => { // stops: [[s, side, front], ...]
    if (s <= stops[0][0]) return [stops[0][1], stops[0][2]];
    for (let i = 1; i < stops.length; i++) if (s <= stops[i][0]) { const t = smooth((s - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0])); return [stops[i - 1][1] + (stops[i][1] - stops[i - 1][1]) * t, stops[i - 1][2] + (stops[i][2] - stops[i - 1][2]) * t]; }
    const l = stops[stops.length - 1]; return [l[1], l[2]];
  };
  const len = (a, b) => V(a).distanceTo(V(b));

  /* torso: from below the pelvis up the spine to the neck */
  const hipLow = V(0).add(new THREE.Vector3(0, -0.1, -0.005));
  const tL = [0, len(0, 0) + 0.1, 0.1 + len(0, 3), 0.1 + len(0, 3) + len(3, 6), 0.1 + len(0, 3) + len(3, 6) + len(6, 9)];
  const tTop = tL[4] + len(9, 12);
  chain([hipLow, 0, 3, 6, 9, 12], lerpR([[0, 0.148, 0.098], [0.1, 0.155, 0.1], [tL[2], 0.142, 0.095], [tL[3], 0.148, 0.1], [tL[4], 0.165, 0.108], [tL[4] + 0.06, 0.178, 0.1], [tTop - 0.04, 0.15, 0.08], [tTop, 0.07, 0.06]]), Z, { tipBone: 0, parent: -1, capStart: true, blend: 0.08 });
  /* neck and head */
  chain([12, 15], lerpR([[0, 0.06, 0.058], [1, 0.056, 0.054]]), Z, { blend: 0.04 });
  const hc = V(15).add(new THREE.Vector3(0, -0.06, 0.02)), ht = hc.clone().add(new THREE.Vector3(0, 0.235, 0));
  loft([hc, ht], (s) => { const t = s / 0.235, e = Math.sqrt(Math.max(0, 1 - Math.pow(2 * t - 1, 2))); return [0.082 * e + 0.004, 0.098 * e + 0.004]; }, () => [[15, 1]], Z, false, false);
  /* shoulders, arms, hands, fingers */
  ['l', 'r'].forEach((side) => {
    const L_ = side === 'l', c = L_ ? 13 : 14, sh = L_ ? 16 : 17, el = L_ ? 18 : 19, wr = L_ ? 20 : 21;
    chain([c, sh], lerpR([[0, 0.042, 0.042], [0.12, 0.055, 0.052]]), Y, { blend: 0.03 });
    const ua = len(sh, el), fa = len(el, wr);
    chain([sh, el, wr], lerpR([[0, 0.058, 0.056], [ua * 0.5, 0.05, 0.048], [ua, 0.042, 0.041], [ua + fa * 0.35, 0.04, 0.034], [ua + fa, 0.031, 0.022]]), Y, { blend: 0.04 });
    const F_ = FING[side];
    const knuckle = V(F_.index[0]).add(V(F_.middle[0])).add(V(F_.ring[0])).add(V(F_.pinky[0])).multiplyScalar(0.25);
    chain([wr, knuckle], lerpR([[0, 0.03, 0.02], [0.05, 0.043, 0.017], [0.1, 0.045, 0.015]]), Y, { tipBone: wr, blend: 0.025 });
    ['index', 'middle', 'ring', 'pinky', 'thumb'].forEach((f) => {
      const [a, b, d] = F_[f];
      const tip = V(d).add(V(d).sub(V(b)).multiplyScalar(0.85));
      const r = f === 'thumb' ? 0.0115 : f === 'pinky' ? 0.0078 : 0.0092;
      chain([a, b, d, tip], lerpR([[0, r, r * 0.92], [0.09, r * 0.8, r * 0.75]]), Y, { tipBone: d, blend: 0.012 });
    });
  });
  /* legs and feet */
  ['l', 'r'].forEach((side) => {
    const hp = side === 'l' ? 1 : 2, kn = side === 'l' ? 4 : 5, an = side === 'l' ? 7 : 8, ft = side === 'l' ? 10 : 11;
    const th = len(hp, kn), sh = len(kn, an);
    chain([hp, kn, an], lerpR([[0, 0.09, 0.088], [th * 0.45, 0.075, 0.075], [th, 0.055, 0.056], [th + sh * 0.3, 0.056, 0.058], [th + sh, 0.038, 0.04]]), Z, { blend: 0.045 });
    const heel = V(an).add(new THREE.Vector3(0, -0.045, -0.05)), toe = V(ft).add(new THREE.Vector3(0, -0.02, 0.075));
    loft([heel, V(ft), toe], lerpR([[0, 0.035, 0.03], [0.1, 0.045, 0.032], [0.24, 0.04, 0.018]]), () => [[an, 1]], Y);
  });

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function start({ canvas, chips, modes, said, slider, out, loss }) {
  let ready = false, epoch = +slider.value;
  const still = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* the loss curve: drawn, not measured */
  const Lf = (e) => 0.05 + 0.95 * Math.exp(-e / 17) + 0.03 * Math.sin(e * 1.7) * Math.exp(-e / 40);
  const xy = (e) => [e * 3, 60 - Lf(e) * 54];
  let d = 'M' + xy(0).join(' ');
  for (let e = 1; e <= 100; e++) d += 'L' + xy(e).map((v) => v.toFixed(1)).join(' ');
  loss.querySelector('.loss-line').setAttribute('d', d);
  loss.querySelector('.loss-area').setAttribute('d', d + 'L300 64L0 64Z');
  const mark = loss.querySelector('.loss-mark');
  function setEpoch(v) {
    epoch = v; out.textContent = v + ' %';
    const [x, y] = xy(v); mark.setAttribute('d', 'M' + x.toFixed(1) + ' 0V64M' + (x - 5).toFixed(1) + ' ' + y.toFixed(1) + 'H' + (x + 5).toFixed(1));
    if (ready && still()) frame(0);
  }

  slider.addEventListener('input', () => setEpoch(+slider.value));
  setEpoch(epoch);

  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' }); }
  catch (e) { return false; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  scene.add(new THREE.HemisphereLight(0xece4f4, 0x1a0b0e, 1.25));
  const key = new THREE.DirectionalLight(0xfff1e6, 2.1); key.position.set(-2, 3, 3); scene.add(key);
  const rim = new THREE.DirectionalLight(0xb266ff, 2.2); rim.position.set(2.5, 2, -3); scene.add(rim);
  const world = new THREE.Group(); scene.add(world);

  /* the floor: a capture-studio disc with rings, and a soft shadow */
  const ft = document.createElement('canvas'); ft.width = ft.height = 512;
  const fx = ft.getContext('2d');
  const grd = fx.createRadialGradient(256, 256, 0, 256, 256, 256);
  grd.addColorStop(0, 'rgba(178,102,255,0.38)'); grd.addColorStop(0.6, 'rgba(178,102,255,0.10)'); grd.addColorStop(1, 'rgba(178,102,255,0)');
  fx.fillStyle = grd; fx.fillRect(0, 0, 512, 512);
  fx.strokeStyle = 'rgba(244,236,228,0.16)'; fx.lineWidth = 2;
  for (let r = 60; r < 256; r += 48) { fx.beginPath(); fx.arc(256, 256, r, 0, Math.PI * 2); fx.stroke(); }
  const floorTex = new THREE.CanvasTexture(ft); floorTex.colorSpace = THREE.SRGBColorSpace;
  const floor = new THREE.Mesh(new THREE.CircleGeometry(1.4, 64), new THREE.MeshBasicMaterial({ map: floorTex, transparent: true, depthWrite: false }));
  floor.rotation.x = -Math.PI / 2; world.add(floor);
  const st = document.createElement('canvas'); st.width = st.height = 128;
  const sx = st.getContext('2d'); const sg = sx.createRadialGradient(64, 64, 0, 64, 64, 64);
  sg.addColorStop(0, 'rgba(10,6,12,0.55)'); sg.addColorStop(1, 'rgba(10,6,12,0)'); sx.fillStyle = sg; sx.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.55), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(st), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.003; world.add(shadow);

  /* the SMPL-X skeleton as three.js bones */
  const bones = REST.map(() => new THREE.Bone());
  bones.forEach((b, j) => {
    const p = PARENT[j];
    if (p < 0) b.position.set(REST[j][0], REST[j][1] + Y0, REST[j][2]);
    else { b.position.set(REST[j][0] - REST[p][0], REST[j][1] - REST[p][1], REST[j][2] - REST[p][2]); bones[p].add(b); }
  });
  /* the grid, like the quad wireframe of an SMPL-X render */
  const gc = document.createElement('canvas'); gc.width = gc.height = 64;
  const gx = gc.getContext('2d'); gx.fillStyle = '#ffffff'; gx.fillRect(0, 0, 64, 64);
  gx.fillStyle = 'rgba(70,64,74,0.55)'; gx.fillRect(0, 0, 64, 2); gx.fillRect(0, 0, 2, 64);
  const grid = new THREE.CanvasTexture(gc); grid.wrapS = grid.wrapT = THREE.RepeatWrapping; grid.colorSpace = THREE.SRGBColorSpace;
  grid.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const body = new THREE.SkinnedMesh(buildBody(), new THREE.MeshStandardMaterial({ color: 0xd9d3cf, roughness: 0.62, metalness: 0, map: grid }));
  body.add(bones[0]);
  world.add(body);
  body.updateMatrixWorld(true);
  body.bind(new THREE.Skeleton(bones));

  /* keypoints and skeleton lines, drawn over everything in their views */
  const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.014, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true }), REST.length);
  dots.renderOrder = 20; world.add(dots);
  const linePairs = PARENT.map((p, j) => [p, j]).filter(([p, j]) => p >= 0 && j !== 22 && j !== 23 && j !== 24);
  const lineGeo = new THREE.BufferGeometry(); lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linePairs.length * 6), 3));
  const lines = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true, opacity: 0.92 }));
  lines.renderOrder = 19; lines.frustumCulled = false; world.add(lines);

  /* wrist trails */
  const TRAIL = 40;
  const trailMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false });
  const trails = [J.lWrist, J.rWrist].map((j) => {
    const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.012, 8, 6), trailMat, TRAIL);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false; world.add(mesh);
    return { j, mesh, pts: [] };
  });
  const cHead = new THREE.Color(0xff6a4d), cTail = new THREE.Color(0xb266ff), tmpC = new THREE.Color();
  const tmpV = new THREE.Vector3(), tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), P = REST.map(() => new THREE.Vector3());

  /* untrained motion: smooth random curves per joint and axis, plus a fast jitter */
  const r = rng(11), NZ = REST.map(() => [0, 1, 2].map(() => [0.8 + r() * 2.2, r() * 6.28, 1.6 + r() * 3, r() * 6.28, 5 + r() * 4, r() * 6.28]));
  const noise = (j, ax, t) => { const n = NZ[j][ax]; return 0.55 * Math.sin(n[0] * t + n[1]) + 0.3 * Math.sin(n[2] * t + n[3]) + 0.15 * Math.sin(n[4] * t * 2 + n[5]); };

  let phrase = 0, pt = 0, clock = 0, mode = 'body', yaw = -0.35, yawT = -0.35, visible = false, running = false, last = performance.now();
  const setWords = () => { said.innerHTML = PHRASES[phrase].words.map((w) => '<span>' + w[0] + '</span>').join(' '); };
  const zero = [0, 0, 0];

  function poseAt(t) {
    const k = PHRASES[phrase].keys; let a = k[0], b = k[k.length - 1];
    for (let i = 0; i < k.length - 1; i++) if (t >= k[i][0] && t < k[i + 1][0]) { a = k[i]; b = k[i + 1]; break; }
    if (t >= k[k.length - 1][0]) a = b = k[k.length - 1];
    const u = a === b ? 1 : smooth(Math.min(1, Math.max(0, (t - a[0]) / Math.max(0.2, Math.min(0.45, b[0] - a[0])))));
    return { from: POSES[a[1]], to: POSES[b[1]], u, names: [a[1], b[1]] };
  }
  function apply(t, nt) {
    const Ph = PHRASES[phrase], { from, to, u, names } = poseAt(t), rest = POSES.rest;
    const k = smooth(epoch / 100), wild = Math.pow(1 - k, 1.2);
    const wW = (names[0] === 'wave' ? 1 - u : 0) + (names[1] === 'wave' ? u : 0);
    const pW = (names[0] === 'present' ? 1 - u : 0) + (names[1] === 'present' ? u : 0);
    let beat = 0; Ph.beats.forEach((b) => { beat += Math.exp(-Math.pow((t - b) / 0.09, 2)); });
    for (let j = 0; j < REST.length; j++) {
      const f = from[j] || zero, g = to[j] || zero, rr = rest[j] || zero, amp = NOISE_AMP(j), e = [0, 0, 0];
      for (let ax = 0; ax < 3; ax++) {
        const target = f[ax] + (g[ax] - f[ax]) * u;
        e[ax] = rr[ax] + (target - rr[ax]) * k + (amp ? noise(j, ax, nt) * amp * wild : 0);
      }
      if (j === J.rElbow) e[2] += wW * 0.32 * Math.sin(t * 9) * k;
      if (j === J.lElbow) e[1] -= 0.3 * beat * (pW + 0.4) * k;
      if (j === J.rElbow) e[1] += 0.3 * beat * (pW + 0.4) * k;
      if (j === J.spine3) e[0] += 0.015 * Math.sin(nt * 1.6) + 0.04 * beat * k;
      bones[j].rotation.set(e[0], e[1], e[2]);
    }
    bones[0].position.y = REST[0][1] + Y0 + 0.004 * Math.sin(nt * 1.6);
    const spans = said.children;
    for (let i = 0; i < spans.length; i++) spans[i].classList.toggle('on', t >= Ph.words[i][1] && t < Ph.dur + 0.4);
  }
  function overlays(showTrails) {
    world.updateMatrixWorld(true);
    for (let j = 0; j < REST.length; j++) { bones[j].getWorldPosition(P[j]); world.worldToLocal(P[j]); }
    const showDots = mode !== 'body';
    for (let j = 0; j < REST.length; j++) { const s = showDots ? (j >= 25 ? 0.7 : 1) : 0; tmpS.set(s, s, s); tmpM.compose(P[j], tmpQ, tmpS); dots.setMatrixAt(j, tmpM); }
    dots.instanceMatrix.needsUpdate = true;
    lines.visible = mode === 'skeleton';
    if (lines.visible) { const a = lineGeo.attributes.position.array; linePairs.forEach(([p, j], i) => { a.set([P[p].x, P[p].y, P[p].z, P[j].x, P[j].y, P[j].z], i * 6); }); lineGeo.attributes.position.needsUpdate = true; }
    body.visible = mode === 'body';
    trails.forEach((tr) => {
      tr.pts.unshift(P[tr.j].clone()); if (tr.pts.length > TRAIL) tr.pts.pop();
      for (let i = 0; i < TRAIL; i++) {
        const p = tr.pts[Math.min(i, tr.pts.length - 1)], a = 1 - i / TRAIL, s = showTrails ? 0.3 + 0.7 * a : 0;
        tmpS.set(s, s, s); tmpM.compose(p, tmpQ, tmpS); tr.mesh.setMatrixAt(i, tmpM);
        tmpC.copy(cTail).lerp(cHead, a); tr.mesh.setColorAt(i, tmpC);
      }
      tr.mesh.instanceMatrix.needsUpdate = true; if (tr.mesh.instanceColor) tr.mesh.instanceColor.needsUpdate = true;
    });
    shadow.position.x = P[0].x; shadow.position.z = P[0].z;
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    const dist = camera.aspect < 0.85 ? 5.0 : 4.1;
    camera.position.set(0, 1.15, dist); camera.lookAt(0, 0.95, 0); camera.updateProjectionMatrix();
    if (still()) frame(0);
  }
  function frame(dt) {
    if (still()) { pt = PHRASES[phrase].keys[1][0] + 0.5; clock = 4; }
    else { pt += dt; clock += dt; if (pt > PHRASES[phrase].dur + GAP) pt = 0; }
    yaw += (yawT - yaw) * 0.12; world.rotation.y = yaw;
    apply(Math.min(pt, PHRASES[phrase].dur), clock);
    overlays(!still());
    renderer.render(scene, camera);
  }
  function loop(now) {
    if (!visible || document.hidden || still()) { running = false; return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    frame(dt); requestAnimationFrame(loop);
  }
  function kick() { if (!running && visible && !still()) { running = true; last = performance.now(); requestAnimationFrame(loop); } else if (still()) frame(0); }

  /* interaction: drag or arrow keys turn the figure; chips pick a phrase or a view */
  let dragging = false, px = 0;
  canvas.addEventListener('pointerdown', (e) => { dragging = true; px = e.clientX; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (!dragging) return; yawT += (e.clientX - px) * 0.01; px = e.clientX; if (still()) frame(0); });
  const stop = () => { dragging = false; };
  canvas.addEventListener('pointerup', stop); canvas.addEventListener('pointercancel', stop);
  canvas.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { yawT -= 0.35; e.preventDefault(); }
    if (e.key === 'ArrowRight') { yawT += 0.35; e.preventDefault(); }
    if (still()) frame(0);
  });
  chips.forEach((c) => c.addEventListener('click', () => {
    phrase = +c.getAttribute('data-phrase'); pt = 0;
    chips.forEach((x) => x.setAttribute('aria-pressed', String(x === c)));
    setWords(); trails.forEach((tr) => { tr.pts.length = 0; });
    if (still()) frame(0);
  }));
  (modes || []).forEach((m) => m.addEventListener('click', () => {
    mode = m.getAttribute('data-mode');
    modes.forEach((x) => x.setAttribute('aria-pressed', String(x === m)));
    if (still()) frame(0);
  }));

  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; kick(); }, { threshold: 0.05 }).observe(canvas);
  document.addEventListener('visibilitychange', kick);
  if (reduced.addEventListener) reduced.addEventListener('change', kick);

  ready = true;
  setWords(); resize(); frame(0);
  return true;
}
