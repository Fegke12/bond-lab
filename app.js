/* BOND LAB — интерактивная презентация «Типы химических связей».
   Чистый JS без внешних библиотек: работает офлайн, открывается двойным щелчком по index.html. */
(function () {
'use strict';

/* ───────────────────────── 1. УТИЛИТЫ ───────────────────────── */
const W = 1600, HGT = 900, TAU = Math.PI * 2, RAD = Math.PI / 180;
const NS = 'http://www.w3.org/2000/svg';
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const clamp = (v, a, b) => Math.max(a === undefined ? 0 : a, Math.min(b === undefined ? 1 : b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const rnd = (a, b) => a + Math.random() * (b - a);
const rgb = (c, a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + (a === undefined ? 1 : a) + ')';
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const ru = (n, d) => n.toFixed(d === undefined ? 2 : d).replace('.', ',');

function S(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) { if (k === 'text') e.textContent = attrs[k]; else if (k === 'fill' && tag === 'text') e.style.fill = attrs[k]; else e.setAttribute(k, attrs[k]); }
  if (parent) parent.appendChild(e);
  return e;
}
function H(tag, cls, html, parent) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined && html !== null) e.innerHTML = html;
  if (parent) parent.appendChild(e);
  return e;
}
function setupCanvas(c, w, h, r) {
  r = r || 1.5; c.width = w * r; c.height = h * r;
  const ctx = c.getContext('2d'); ctx.setTransform(r, 0, 0, r, 0, 0); return ctx;
}
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function segOn(root, btn) { $$('button', root).forEach(b => b.classList.toggle('on', b === btn)); }

/* Твины: привязаны к «владельцу» (строка), чтобы сцену можно было остановить при уходе со слайда. */
const tweens = new Set();
function tween(ms, fn, owner) { return new Promise(res => tweens.add({ t0: null, ms, fn, owner: owner || '', res })); }
function wait(ms, owner) { return tween(ms, () => {}, owner); }
function cancelTweens(prefix) { for (const tw of Array.from(tweens)) if (tw.owner.indexOf(prefix) === 0) tweens.delete(tw); }

/* Общее состояние (результаты практики показываются на финальном экране). */
const G = { quiz: { score: 0, total: 0, done: false }, build: { score: 0, max: 40, tasks: 0 } };

/* Элементы: цвет, радиус условной валентной оболочки, число валентных электронов, электроотрицательность (Полинг). */
const EL = {
  H:  { c: [226, 236, 255], r: 46, core: 17, v: 1, chi: 2.20, name: 'водород' },
  O:  { c: [255, 112, 112], r: 58, core: 27, v: 6, chi: 3.44, name: 'кислород' },
  N:  { c: [118, 146, 255], r: 58, core: 27, v: 5, chi: 3.04, name: 'азот' },
  Cl: { c: [102, 226, 142], r: 60, core: 29, v: 7, chi: 3.16, name: 'хлор' },
  Na: { c: [186, 150, 255], r: 60, core: 29, v: 1, chi: 0.93, name: 'натрий' }
};
const C_E = [150, 236, 255], C_E2 = [255, 190, 235], C_METAL = [150, 176, 222], C_HOT = [255, 110, 70];

/* Общие SVG-градиенты и фильтры. */
(function defs() {
  let g = '';
  for (const k in EL) {
    const c = EL[k].c;
    g += '<radialGradient id="g-' + k + '" cx=".36" cy=".32" r=".8"><stop offset="0" stop-color="' + rgb(mix(c, [255, 255, 255], .8)) + '"/><stop offset=".5" stop-color="' + rgb(c) + '"/><stop offset="1" stop-color="' + rgb(mix(c, [6, 10, 24], .65)) + '"/></radialGradient>';
  }
  g += '<radialGradient id="g-M" cx=".36" cy=".32" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="' + rgb(C_METAL) + '"/><stop offset="1" stop-color="#1c2a4a"/></radialGradient>';
  g += '<radialGradient id="g-cloud"><stop offset="0" stop-color="rgba(90,200,255,.55)"/><stop offset=".6" stop-color="rgba(90,160,255,.2)"/><stop offset="1" stop-color="rgba(90,160,255,0)"/></radialGradient>';
  g += '<radialGradient id="g-bond"><stop offset="0" stop-color="rgba(160,255,240,.9)"/><stop offset="1" stop-color="rgba(90,255,220,0)"/></radialGradient>';
  g += '<filter id="f-blur" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="16"/></filter>';
  g += '<marker id="m-arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#fff"/></marker>';
  g += '<marker id="m-arr-c" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#55d9ff"/></marker>';
  const d = H('div'); d.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  d.innerHTML = '<svg width="0" height="0"><defs>' + g + '</defs></svg>';
  document.body.appendChild(d);
})();

/* Шар с бликом и свечением (Canvas). */
function sphere(ctx, x, y, r, c, glow, alpha) {
  if (alpha === undefined) alpha = 1;
  if (alpha <= 0 || r <= 0) return;
  ctx.globalAlpha = alpha;
  let g;
  if (glow) {
    g = ctx.createRadialGradient(x, y, r * .5, x, y, r * 2.6);
    g.addColorStop(0, rgb(c, glow)); g.addColorStop(1, rgb(c, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 2.6, 0, TAU); ctx.fill();
  }
  g = ctx.createRadialGradient(x - r * .35, y - r * .38, r * .05, x, y, r);
  g.addColorStop(0, rgb(mix(c, [255, 255, 255], .8))); g.addColorStop(.5, rgb(c)); g.addColorStop(1, rgb(mix(c, [6, 10, 24], .68)));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;
}
function sign(ctx, x, y, s, plus, col) {
  ctx.strokeStyle = col || '#06101f'; ctx.lineWidth = Math.max(1.6, s * .28); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - s, y); ctx.lineTo(x + s, y);
  if (plus) { ctx.moveTo(x, y - s); ctx.lineTo(x, y + s); }
  ctx.stroke();
}
function eDot(ctx, x, y, r, a) {
  ctx.fillStyle = rgb(C_E, .2 * (a === undefined ? 1 : a)); ctx.beginPath(); ctx.arc(x, y, r * 2.6, 0, TAU); ctx.fill();
  ctx.fillStyle = rgb([205, 248, 255], a === undefined ? 1 : a); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}
function rot3(p, yaw, pitch) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const x = p.x * cy + p.z * sy, z0 = -p.x * sy + p.z * cy;
  return { x, y: p.y * cp - z0 * sp, z: p.y * sp + z0 * cp };
}

/* ───────────────────────── 2. МИНИ-ИЛЛЮСТРАЦИИ ───────────────────────── */
function icon(kind) {
  let s = '<svg viewBox="0 0 220 130" class="ico ico-' + kind + '">';
  if (kind === 'ionic') {
    s += '<g class="ia"><circle cx="66" cy="65" r="22" fill="url(#g-Na)"/><text x="66" y="65">+</text></g>' +
      '<g class="ib"><circle cx="150" cy="65" r="34" fill="url(#g-Cl)"/><text x="150" y="64">−</text></g>' +
      '<path class="arrow" d="M94 65h14m-5-5l5 5-5 5"/>';
  } else if (kind === 'cov' || kind === 'polar') {
    const p = kind === 'polar';
    s += '<circle class="ring" cx="84" cy="65" r="' + (p ? 30 : 38) + '"/><circle class="ring" cx="' + (p ? 138 : 136) + '" cy="65" r="' + (p ? 44 : 38) + '"/>' +
      '<circle cx="' + (p ? 80 : 76) + '" cy="65" r="' + (p ? 13 : 17) + '" fill="url(#g-' + (p ? 'H' : 'Cl') + ')"/><circle cx="' + (p ? 150 : 144) + '" cy="65" r="' + (p ? 20 : 17) + '" fill="url(#g-Cl)"/>' +
      '<ellipse cx="' + (p ? 108 : 110) + '" cy="65" rx="13" ry="8" fill="rgba(255,255,255,.12)" stroke="#fff" stroke-width="1.3"/>' +
      '<circle class="e" cx="' + (p ? 103 : 105) + '" cy="65" r="4"/><circle class="e" cx="' + (p ? 113 : 115) + '" cy="65" r="4"/>';
    if (p) s += '<text class="lbl" x="80" y="22">δ⁺</text><text class="lbl" x="150" y="14">δ⁻</text>';
  } else if (kind === 'metal') {
    for (let j = 0; j < 2; j++) for (let i = 0; i < 4; i++) { const x = 38 + i * 48, y = 40 + j * 50; s += '<circle cx="' + x + '" cy="' + y + '" r="14" fill="url(#g-M)"/><text x="' + x + '" y="' + y + '" style="font-size:15px">+</text>'; }
    [[60, 62], [14, 44], [110, 68], [158, 60], [86, 18], [134, 112], [206, 82], [62, 112], [182, 20], [110, 40]].forEach(p => { s += '<circle class="e" cx="' + p[0] + '" cy="' + p[1] + '" r="4"/>'; });
  } else if (kind === 'hbond') {
    s += '<line class="cb" x1="52" y1="62" x2="84" y2="76"/><line class="cb" x1="52" y1="62" x2="30" y2="88"/><line class="hb" x1="96" y1="78" x2="140" y2="78"/>' +
      '<line class="cb" x1="160" y1="78" x2="186" y2="56"/><line class="cb" x1="160" y1="78" x2="180" y2="106"/>' +
      '<circle cx="52" cy="62" r="17" fill="url(#g-O)"/><circle cx="86" cy="77" r="10" fill="url(#g-H)"/><circle cx="29" cy="89" r="10" fill="url(#g-H)"/>' +
      '<circle cx="160" cy="78" r="17" fill="url(#g-O)"/><circle cx="187" cy="55" r="10" fill="url(#g-H)"/><circle cx="181" cy="107" r="10" fill="url(#g-H)"/>';
  }
  return s + '</svg>';
}
$$('[data-ico]').forEach(e => { e.innerHTML = icon(e.dataset.ico); });

/* ───────────────────────── 3. МОДЕЛЬ ЛЬЮИСА (SVG) ─────────────────────────
   Атом = ядро с символом + условная валентная оболочка. Точки — валентные электроны.
   set(p): p = 0 — атомы порознь, p = 1 — связь образована. */
const MOL = {
  H2:  { f: 'H₂',  st: 'H–H',   atoms: [['H', -35, 0, []], ['H', 35, 0, []]], bonds: [[0, 1, 1]], pairs: 1,
         val: 'H — 1 электрон', type: 'ковалентная неполярная, одинарная', note: 'Атомы одинаковые: общая пара расположена симметрично.' },
  Cl2: { f: 'Cl₂', st: 'Cl–Cl', atoms: [['Cl', -49, 0, [90, 180, 270]], ['Cl', 49, 0, [90, 0, 270]]], bonds: [[0, 1, 1]], pairs: 1,
         val: 'Cl — 7 электронов', type: 'ковалентная неполярная, одинарная', note: 'У каждого атома остаётся по три неподелённые пары.' },
  O2:  { f: 'O₂',  st: 'O=O',   atoms: [['O', -47, 0, [120, 240]], ['O', 47, 0, [60, 300]]], bonds: [[0, 1, 2]], pairs: 2,
         val: 'O — 6 электронов', type: 'ковалентная неполярная, двойная', note: 'Каждый атом даёт в общие пары по два электрона.' },
  N2:  { f: 'N₂',  st: 'N≡N',   atoms: [['N', -47, 0, [180]], ['N', 47, 0, [0]]], bonds: [[0, 1, 3]], pairs: 3,
         val: 'N — 5 электронов', type: 'ковалентная неполярная, тройная', note: 'Три общие пары — одна из самых прочных связей.' },
  HCl: { f: 'HCl', st: 'H–Cl',  atoms: [['H', -48, 0, []], ['Cl', 36, 0, [90, 0, 270]]], bonds: [[0, 1, 1]], pairs: 1,
         val: 'H — 1 · Cl — 7', type: 'ковалентная полярная, одинарная', note: 'Хлор электроотрицательнее: общая пара смещена к нему.' },
  H2O: { f: 'H₂O', st: 'H–O–H', atoms: [['O', 0, -28, [240, 300]], ['H', -64.8, 22.2, []], ['H', 64.8, 22.2, []]], bonds: [[0, 1, 1], [0, 2, 1]], pairs: 2,
         val: 'O — 6 · H — 1', type: 'две ковалентные полярные связи O–H', note: 'Обе общие пары смещены к кислороду. Молекула угловая.' },
  NaCl: { f: 'NaCl', st: 'Na⁺ Cl⁻', atoms: [['Na', -67, 0, []], ['Cl', 67, 0, [90, 0, 270]]], bonds: [[0, 1, 1]], ionic: true, pairs: 0,
         val: 'Na — 1 · Cl — 7', type: 'ионная', note: '' }
};

function lewis(parent, key, o) {
  o = Object.assign({ x: 0, y: 0, s: 1, delta: true, spread: 70 }, o);
  const m = MOL[key];
  const g = S('g', { transform: 'translate(' + o.x + ' ' + o.y + ') scale(' + o.s + ')' }, parent);
  const A = m.atoms.map(a => ({ s: a[0], fx: a[1], fy: a[2], lp: a[3], el: EL[a[0]], x: a[1], y: a[2] }));
  const cx = A.reduce((s, a) => s + a.fx, 0) / A.length, cy = A.reduce((s, a) => s + a.fy, 0) / A.length;
  A.forEach(a => { const d = Math.hypot(a.fx - cx, a.fy - cy) || 1; a.dx = (a.fx - cx) / d; a.dy = (a.fy - cy) / d; });
  const gR = S('g', {}, g), gP = S('g', {}, g), gA = S('g', {}, g), gE = S('g', {}, g), gL = S('g', {}, g);
  A.forEach(a => {
    a.ring = S('circle', { r: a.el.r, class: 'lw-ring' }, gR);
    a.core = S('circle', { r: a.el.core, fill: 'url(#g-' + a.s + ')' }, gA);
    a.txt = S('text', { class: 'lw-sym', 'font-size': a.el.core * (a.s.length > 1 ? .82 : 1.05), text: a.s }, gA);
    a.q = 0;
  });
  const E = [], pairs = [];
  const dot = (c) => S('circle', { r: 5.2, class: 'lw-e', fill: rgb(c) }, gE);
  m.bonds.forEach(b => {
    const a = A[b[0]], c = A[b[1]], n = b[2];
    const L = Math.hypot(c.fx - a.fx, c.fy - a.fy), ux = (c.fx - a.fx) / L, uy = (c.fy - a.fy) / L;
    const pol = clamp((c.el.chi - a.el.chi) / 1.2, -1, 1);
    a.q -= pol; c.q += pol;
    for (let k = 0; k < n; k++) {
      const off = k - (n - 1) / 2;
      const mx = a.fx + ux * (a.el.r - 11 + pol * 8) - uy * off * 22, my = a.fy + uy * (a.el.r - 11 + pol * 8) + ux * off * 22;
      E.push({ el: dot(C_E), own: a, kind: 's', ang: Math.atan2(uy, ux) + off * 24 * RAD, ex: mx - ux * 6.5, ey: my - uy * 6.5, other: c });
      E.push({ el: dot(C_E2), own: c, kind: 's', ang: Math.atan2(-uy, -ux) - off * 24 * RAD, ex: mx + ux * 6.5, ey: my + uy * 6.5, other: a });
      if (!m.ionic) pairs.push(S('ellipse', { cx: mx, cy: my, rx: 15, ry: 8.5, class: 'lw-pair', transform: 'rotate(' + Math.atan2(uy, ux) / RAD + ' ' + mx + ' ' + my + ')', opacity: 0 }, gP));
    }
  });
  A.forEach((a, i) => a.lp.forEach(deg => { [-7.5, 7.5].forEach(d => E.push({ el: dot(i === 0 ? C_E : C_E2), own: a, kind: 'l', ang: (deg + d) * RAD })); }));
  const deltas = [];
  if (o.delta && !m.ionic) A.forEach(a => { if (Math.abs(a.q) > .3) deltas.push(S('text', { class: 'lw-delta', x: a.fx + (key !== 'H2O' ? 0 : a.s === 'O' ? 78 : (a.fx < 0 ? -1 : 1) * (a.el.r + 24)), y: key !== 'H2O' ? a.fy - a.el.r - 12 : a.s === 'O' ? a.fy - a.el.r + 18 : a.fy + 9, opacity: 0, text: a.q > 0 ? 'δ⁻' : 'δ⁺' }, gL)); });

  function set(p) {
    const pa = ease(clamp(p / .6)), pe = ease(clamp((p - .35) / .65)), fin = clamp((p - .88) / .12);
    A.forEach(a => {
      a.x = a.fx + a.dx * (1 - pa) * o.spread; a.y = a.fy + a.dy * (1 - pa) * o.spread;
      a.ring.setAttribute('cx', a.x); a.ring.setAttribute('cy', a.y);
      a.core.setAttribute('cx', a.x); a.core.setAttribute('cy', a.y);
      a.txt.setAttribute('x', a.x); a.txt.setAttribute('y', a.y + 1);
    });
    E.forEach(e => {
      const a = e.own; let x = a.x + a.el.r * Math.cos(e.ang), y = a.y + a.el.r * Math.sin(e.ang);
      if (e.kind === 's') {
        if (m.ionic) {
          const cl = A[1], base = Math.PI; // сторона хлора, обращённая к натрию
          if (a === cl) { x = cl.x + cl.el.r * Math.cos(base - 7.5 * RAD); y = cl.y + cl.el.r * Math.sin(base - 7.5 * RAD); }
          else { const tx = cl.x + cl.el.r * Math.cos(base + 7.5 * RAD), ty = cl.y + cl.el.r * Math.sin(base + 7.5 * RAD); x = lerp(x, tx, pe); y = lerp(y, ty, pe) - Math.sin(pe * Math.PI) * 26; }
        } else { x = lerp(x, e.ex, pe); y = lerp(y, e.ey, pe); }
      }
      e.el.setAttribute('cx', x); e.el.setAttribute('cy', y);
    });
    pairs.forEach(el => el.setAttribute('opacity', fin));
    deltas.forEach(el => el.setAttribute('opacity', fin));
    if (m.ionic) {
      A[0].ring.setAttribute('opacity', 1 - .85 * fin);
      A[0].txt.textContent = fin > .5 ? 'Na⁺' : 'Na'; A[1].txt.textContent = fin > .5 ? 'Cl⁻' : 'Cl';
      A[0].txt.setAttribute('font-size', fin > .5 ? 20 : 24); A[1].txt.setAttribute('font-size', fin > .5 ? 20 : 24);
    }
  }
  set(0);
  return { set, g, mol: m };
}

/* ───────────────────────── 4. ИОННАЯ РЕШЁТКА NaCl (Canvas, псевдо-3D) ───────────────────────── */
function makeLattice(n) {
  const pts = [], h = (n - 1) / 2;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) {
    const d = { x: rnd(-1, 1), y: rnd(-1, 1), z: rnd(-1, 1) }, dl = Math.hypot(d.x, d.y, d.z) || 1, far = rnd(3.5, 6);
    pts.push({ x: i - h, y: j - h, z: k - h, i, j, k, cl: (i + j + k) % 2 === (n === 3 ? 1 : 0), sx: d.x / dl * far, sy: d.y / dl * far, sz: d.z / dl * far, delay: Math.random() * .35 });
  }
  const links = [];
  for (let a = 0; a < pts.length; a++) for (let b = a + 1; b < pts.length; b++) {
    const p = pts[a], q = pts[b];
    if (Math.abs(p.i - q.i) + Math.abs(p.j - q.j) + Math.abs(p.k - q.k) === 1) links.push([a, b]);
  }
  const mid = n === 3 ? pts.findIndex(p => p.i === 1 && p.j === 1 && p.k === 1) : -1;
  return { pts, links, mid, n };
}
function drawLattice(ctx, L, cx, cy, sp, yaw, pitch, build, hl) {
  const P = L.pts.map(p => {
    const t = ease(clamp(build * 1.5 - p.delay));
    const r = rot3({ x: lerp(p.sx, p.x, t), y: lerp(p.sy, p.y, t), z: lerp(p.sz, p.z, t) }, yaw, pitch);
    const f = 7 / (7 - r.z);
    return { X: cx + r.x * sp * f, Y: cy + r.y * sp * f, f, z: r.z, a: clamp(t * 1.6), p };
  });
  const la = smooth(.75, 1, build);
  ctx.lineCap = 'round';
  L.links.forEach(l => {
    const a = P[l[0]], b = P[l[1]], isHl = hl && (l[0] === L.mid || l[1] === L.mid);
    ctx.strokeStyle = isHl ? 'rgba(255,255,255,' + .85 * la + ')' : 'rgba(150,195,255,' + .3 * la + ')';
    ctx.lineWidth = isHl ? 2.6 : 1.2;
    ctx.beginPath(); ctx.moveTo(a.X, a.Y); ctx.lineTo(b.X, b.Y); ctx.stroke();
  });
  P.slice().sort((a, b) => a.z - b.z).forEach(q => {
    const cl = q.p.cl, r = (cl ? .31 : .2) * sp * q.f, c = cl ? EL.Cl.c : EL.Na.c;
    sphere(ctx, q.X, q.Y, r, c, .22, q.a);
    if (q.a > .6) sign(ctx, q.X, q.Y, r * .36, !cl);
  });
  return P;
}

/* ───────────────────────── 5. МОДЕЛЬ МЕТАЛЛА (Canvas) ─────────────────────────
   Ионы закреплены в узлах и только колеблются; электроны движутся по всему объёму. */
function MetalSim(ctx, o) {
  const sim = { mode: o.mode || 'base', tm: 0, on: false, o };
  const ions = [], es = [];
  for (let j = 0; j < o.rows; j++) for (let i = 0; i < o.cols; i++) ions.push({ bx: o.x0 + i * o.sp, by: o.y0 + j * o.sp, row: j, ph: Math.random() * TAU, x: 0, y: 0 });
  const B = o.box;
  for (let i = 0; i < o.ne; i++) es.push({ x: rnd(B[0], B[2]), y: rnd(B[1], B[3]), vx: rnd(-60, 60), vy: rnd(-60, 60) });
  const haze = [0, 1, 2].map(i => ({ ph: i * 2.1, r: (B[3] - B[1]) * .75 }));
  sim.setMode = mname => { sim.mode = mname; sim.tm = 0; };
  sim.heat = x => { if (sim.mode !== 'heat') return 0; const xn = (x - B[0]) / (B[2] - B[0]), f = Math.min(1.5, sim.tm / 3.5); return clamp((f - xn) * 2 + .1); };
  sim.shift = () => {
    if (sim.mode !== 'bend') return 0;
    const u = sim.tm % 6;
    return u < 1 ? 0 : u < 2.4 ? ease((u - 1) / 1.4) : u < 4 ? 1 : u < 5.4 ? 1 - ease((u - 4) / 1.4) : 0;
  };
  sim.step = (t, dt) => {
    sim.tm += dt;
    const sh = sim.shift() * o.sp, half = Math.ceil(o.rows / 2), midY = o.y0 + (half - .5) * o.sp, dsh = sh - (sim.psh || 0);
    sim.psh = sh; sim.midY = midY;
    ions.forEach(n => {
      const T = sim.heat(n.bx), amp = (o.amp || 1.6) + 6 * T;
      n.T = T;
      n.x = n.bx + (n.row < half ? sh : 0) + Math.sin(t * (9 + 10 * T) + n.ph) * amp;
      n.y = n.by + Math.cos(t * (8 + 9 * T) + n.ph * 1.7) * amp;
    });
    const drift = (sim.mode === 'current' && sim.on) ? (o.drift || 70) : 0;
    es.forEach(e => {
      const T = sim.heat(e.x), k = 1 + 1.6 * T;
      e.vx += rnd(-1, 1) * 900 * dt * k; e.vy += rnd(-1, 1) * 900 * dt * k;
      const sp = Math.hypot(e.vx, e.vy), max = 95 * k;
      if (sp > max) { e.vx *= max / sp; e.vy *= max / sp; }
      const off = e.y < midY ? sh : 0;   // верхние слои (и их электроны) сдвигаются вместе
      if (off || dsh) { if (e.y < midY) e.x += dsh; }
      e.x += (e.vx + drift) * dt; e.y += e.vy * dt;
      if (o.wrap) { if (e.x > B[2]) e.x = B[0]; if (e.x < B[0]) e.x = B[2]; }
      else { if (e.x < B[0] + off) { e.x = B[0] + off; e.vx = Math.abs(e.vx); } if (e.x > B[2] + off) { e.x = B[2] + off; e.vx = -Math.abs(e.vx); } }
      if (e.y < B[1]) { e.y = B[1]; e.vy = Math.abs(e.vy); } if (e.y > B[3]) { e.y = B[3]; e.vy = -Math.abs(e.vy); }
    });
  };
  sim.draw = t => {
    const w = B[2] - B[0], h = B[3] - B[1], pad = o.pad === undefined ? 22 : o.pad;
    // брусок металла
    const sh = sim.psh || 0;
    ctx.beginPath();
    if (sh > .5) { ctx.rect(B[0] - pad + sh, B[1] - pad, w + pad * 2, sim.midY - B[1] + pad); ctx.rect(B[0] - pad, sim.midY, w + pad * 2, B[3] + pad - sim.midY); }
    else if (ctx.roundRect) ctx.roundRect(B[0] - pad, B[1] - pad, w + pad * 2, h + pad * 2, 14); else ctx.rect(B[0] - pad, B[1] - pad, w + pad * 2, h + pad * 2);
    const bg = ctx.createLinearGradient(0, B[1], 0, B[3]);
    bg.addColorStop(0, 'rgba(150,180,235,.13)'); bg.addColorStop(1, 'rgba(110,140,220,.05)');
    ctx.fillStyle = bg; ctx.fill(); ctx.strokeStyle = 'rgba(160,200,255,.35)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.save(); ctx.clip();
    // «электронный газ»
    haze.forEach(hz => {
      const x = B[0] + w * (.5 + .42 * Math.sin(t * .22 + hz.ph)), y = B[1] + h * (.5 + .3 * Math.cos(t * .31 + hz.ph * 1.3));
      const g = ctx.createRadialGradient(x, y, 0, x, y, hz.r);
      g.addColorStop(0, 'rgba(85,217,255,.13)'); g.addColorStop(1, 'rgba(85,217,255,0)');
      ctx.fillStyle = g; ctx.fillRect(B[0] - pad, B[1] - pad, w + pad * 2 + sh, h + pad * 2);
    });
    if (sim.mode === 'heat') {
      const f = Math.min(1.5, sim.tm / 3.5), g = ctx.createLinearGradient(B[0], 0, B[2], 0);
      g.addColorStop(0, 'rgba(255,110,60,.34)'); g.addColorStop(clamp(f * .8, .05, 1), 'rgba(255,110,60,' + (f > 1.2 ? .2 : .04) + ')'); g.addColorStop(1, 'rgba(255,110,60,' + clamp(f - 1) * .3 + ')');
      ctx.fillStyle = g; ctx.fillRect(B[0] - pad, B[1] - pad, w + pad * 2, h + pad * 2);
    }
    ctx.restore();
    ions.forEach(n => { sphere(ctx, n.x, n.y, o.r, mix(C_METAL, C_HOT, n.T || 0), .16); sign(ctx, n.x, n.y, o.r * .36, true); });
    es.forEach(e => eDot(ctx, e.x, e.y, o.er || 3.6, 1));
  };
  sim.ions = ions; sim.es = es;
  return sim;
}

/* ───────────────────────── 6. НАВИГАЦИЯ И УПРАВЛЕНИЕ ───────────────────────── */
const stage = $('#stage'), slides = $$('.slide'), N = slides.length;
let SCALE = 1, cur = -1;
const factories = {}, inst = {};
function scene(i, f) { factories[i] = f; }

function fit() {
  SCALE = Math.min(window.innerWidth / W, window.innerHeight / HGT);
  stage.style.transform = 'translate(-50%,-50%) scale(' + SCALE + ')';
}
window.addEventListener('resize', fit); fit();
/* Сцена не должна прокручиваться (например, при фокусе на элементе соседнего слайда). */
stage.addEventListener('scroll', () => { stage.scrollLeft = 0; stage.scrollTop = 0; });
window.addEventListener('scroll', () => window.scrollTo(0, 0));

const progress = $('#progress'), tocList = $('#tocList');
slides.forEach((s, i) => {
  const b = H('button', '', '', progress); b.title = (i + 1) + '. ' + s.dataset.title; b.addEventListener('click', () => go(i));
  const t = H('button', '', '<i>' + String(i + 1).padStart(2, '0') + '</i><span><small>' + s.dataset.sec + '</small>' + s.dataset.title + '</span>', tocList);
  t.addEventListener('click', () => { closeOverlays(); go(i); });
});

function go(i) {
  i = clamp(i, 0, N - 1);
  if (i === cur) return;
  if (cur >= 0) { cancelTweens(cur + ':'); if (inst[cur] && inst[cur].leave) inst[cur].leave(); }
  cur = i;
  slides.forEach((s, k) => { s.classList.toggle('active', k === i); s.classList.toggle('past', k < i); });
  stage.classList.toggle('is-title', i === 0);
  $('#topSec').textContent = slides[i].dataset.sec + ' · ' + slides[i].dataset.title;
  $('#counter').textContent = String(i + 1).padStart(2, '0') + ' / ' + N;
  $$('button', progress).forEach((b, k) => { b.classList.toggle('cur', k === i); b.classList.toggle('done', k < i); });
  $$('button', tocList).forEach((b, k) => b.classList.toggle('cur', k === i));
  $('#prevBtn').disabled = i === 0; $('#nextBtn').disabled = i === N - 1;
  if (!inst[i] && factories[i]) inst[i] = factories[i]() || {};
  if (inst[i] && inst[i].enter) inst[i].enter();
  try { history.replaceState(null, '', '#' + (i + 1)); } catch (e) { /* file:// в некоторых браузерах */ }
}
const next = () => go(cur + 1), prev = () => go(cur - 1);

function closeOverlays() { $$('.overlay').forEach(o => { o.hidden = true; }); }
function toggleOverlay(id) { const o = $(id), was = o.hidden; closeOverlays(); o.hidden = !was; }
$$('.overlay').forEach(o => o.addEventListener('click', e => { if (e.target === o || e.target.closest('[data-close]')) o.hidden = true; }));
function fullscreen() {
  const d = document, el = d.documentElement;
  if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
  else { const f = el.requestFullscreen || el.webkitRequestFullscreen; if (f) { const r = f.call(el); if (r && r.catch) r.catch(() => {}); } }
}
$('#nextBtn').addEventListener('click', next); $('#prevBtn').addEventListener('click', prev);
$('#tocBtn').addEventListener('click', () => toggleOverlay('#toc'));
$('#fsBtn').addEventListener('click', fullscreen);
$('#startBtn').addEventListener('click', () => go(1));
$('#notesBtn').addEventListener('click', () => toggleOverlay('#notes'));
$('#againBtn').addEventListener('click', () => go(0));
$$('[data-go]').forEach(b => b.addEventListener('click', () => go(+b.dataset.go)));

document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key;
  if (k === 'Escape') { closeOverlays(); return; }
  if (k === ' ' || k === 'ArrowRight' || k === 'PageDown') { e.preventDefault(); closeOverlays(); next(); }
  else if (k === 'ArrowLeft' || k === 'PageUp' || k === 'Backspace') { e.preventDefault(); closeOverlays(); prev(); }
  else if (k === 'Home') { e.preventDefault(); go(0); }
  else if (k === 'End') { e.preventDefault(); go(N - 1); }
  else if (k === 'f' || k === 'F' || k === 'а' || k === 'А') fullscreen();
  else if (k === 'm' || k === 'M' || k === 'ь' || k === 'Ь') toggleOverlay('#toc');
});
/* После щелчка мышью снимаем фокус, чтобы пробел листал слайды, а не «нажимал» кнопку ещё раз. */
document.addEventListener('click', e => { const b = e.target.closest('button'); if (b && e.detail > 0) b.blur(); });
document.addEventListener('pointerup', e => { if (e.target.matches && e.target.matches('input[type=range]')) e.target.blur(); });

/* Фоновые частицы — глубина пространства. */
const dustCtx = $('#dust').getContext('2d');
const dustP = Array.from({ length: 70 }, () => ({ x: Math.random() * W, y: Math.random() * HGT, z: rnd(.2, 1), ph: Math.random() * TAU }));
function dust(t, dt) {
  dustCtx.clearRect(0, 0, W, HGT);
  dustP.forEach(p => {
    p.x += 9 * p.z * dt; p.y -= 5 * p.z * dt;
    if (p.x > W + 5) p.x = -5; if (p.y < -5) p.y = HGT + 5;
    dustCtx.fillStyle = 'rgba(160,215,255,' + (.12 + .35 * p.z * (.6 + .4 * Math.sin(t * 1.3 + p.ph))) + ')';
    dustCtx.beginPath(); dustCtx.arc(p.x, p.y, .6 + 1.5 * p.z, 0, TAU); dustCtx.fill();
  });
}

/* ───────────────────────── 7. СЦЕНЫ ───────────────────────── */

/* 0 · Титул: атомы слетаются и образуют три молекулы воды, связанные водородными связями. */
scene(0, () => {
  const ctx = setupCanvas($('#titleCanvas'), 1600, 836, 1.25);
  const V = (x, y, z) => ({ x, y, z }), add = (a, b) => V(a.x + b.x, a.y + b.y, a.z + b.z), mul = (a, k) => V(a.x * k, a.y * k, a.z * k);
  const dotp = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z, norm = a => mul(a, 1 / Math.hypot(a.x, a.y, a.z));
  const c1 = Math.cos(104.5 * RAD), s1 = Math.sin(104.5 * RAD);
  function water(O, u, w) { // O–H 0,96 Å, угол H–O–H 104,5°
    u = norm(u); w = norm(add(w, mul(u, -dotp(u, w))));
    return [{ p: O, s: 'O' }, { p: add(O, mul(u, .96)), s: 'H' }, { p: add(O, add(mul(u, .96 * c1), mul(w, .96 * s1))), s: 'H' }];
  }
  const uA = norm(V(.791, .612, 0));
  let atoms = [].concat(
    water(V(0, 0, 0), uA, V(-.612, .791, 0)),
    water(mul(uA, 2.8), V(.5, .3, .8), V(.3, .9, -.4)),
    water(V(0, -1.6, 2.3), V(0, 1.6, -2.3), V(1, 0, .2)));
  const cen = atoms.reduce((s, a) => add(s, a.p), V(0, 0, 0));
  atoms.forEach(a => {
    a.p = add(a.p, mul(cen, -1 / atoms.length));
    const d = norm(V(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)));
    a.s0 = add(a.p, mul(d, rnd(5, 9))); a.delay = Math.random() * .45;
  });
  const cov = [[0, 1], [0, 2], [3, 4], [3, 5], [6, 7], [6, 8]], hb = [[1, 3], [7, 0]];
  let t0 = 0;
  return {
    enter() { t0 = performance.now() / 1000; },
    tick(t) {
      const p = clamp((t - t0 - .4) / 3.4), yaw = t * .22, pitch = .35 + .12 * Math.sin(t * .3);
      const CX = 1175, CY = 420, K = 112;
      ctx.clearRect(0, 0, 1600, 836);
      const P = atoms.map(a => {
        const k = ease(clamp(p * 1.45 - a.delay));
        const r = rot3(V(lerp(a.s0.x, a.p.x, k), lerp(a.s0.y, a.p.y, k), lerp(a.s0.z, a.p.z, k)), yaw, pitch), f = 9 / (9 - r.z);
        return { X: CX + r.x * K * f, Y: CY + r.y * K * f, f, z: r.z, a: clamp(k * 1.5), s: a.s };
      });
      const b = smooth(.72, 1, p);
      // электронные облака молекул
      [0, 3, 6].forEach(i => {
        const q = P[i], R = 185 * q.f, g = ctx.createRadialGradient(q.X, q.Y, 0, q.X, q.Y, R);
        g.addColorStop(0, 'rgba(85,200,255,' + .2 * b + ')'); g.addColorStop(.55, 'rgba(110,120,255,' + .08 * b + ')'); g.addColorStop(1, 'rgba(110,120,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.X, q.Y, R, 0, TAU); ctx.fill();
      });
      ctx.lineCap = 'round';
      hb.forEach(l => {
        const a = P[l[0]], c = P[l[1]];
        ctx.setLineDash([3, 13]); ctx.lineDashOffset = -t * 14; ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(62,240,200,' + .9 * b + ')';
        ctx.beginPath(); ctx.moveTo(a.X, a.Y); ctx.lineTo(c.X, c.Y); ctx.stroke();
      });
      ctx.setLineDash([]);
      cov.forEach(l => {
        const a = P[l[0]], c = P[l[1]];
        ctx.strokeStyle = 'rgba(85,217,255,' + .28 * b + ')'; ctx.lineWidth = 26 * a.f;
        ctx.beginPath(); ctx.moveTo(a.X, a.Y); ctx.lineTo(c.X, c.Y); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,' + .9 * b + ')'; ctx.lineWidth = 7 * a.f;
        ctx.beginPath(); ctx.moveTo(a.X, a.Y); ctx.lineTo(c.X, c.Y); ctx.stroke();
      });
      P.slice().sort((a, c) => a.z - c.z).forEach(q => {
        const o = q.s === 'O';
        sphere(ctx, q.X, q.Y, (o ? 40 : 25) * q.f, o ? EL.O.c : EL.H.c, .3, q.a);
      });
      // общие электронные пары на связях O–H
      if (b > 0) cov.forEach((l, i) => {
        const a = P[l[0]], c = P[l[1]], dx = c.X - a.X, dy = c.Y - a.Y, L = Math.hypot(dx, dy) || 1;
        for (let k = -1; k <= 1; k += 2) {
          const u = .56 + .03 * Math.sin(t * 2.2 + i), w = k * 7 * a.f;
          eDot(ctx, a.X + dx * u - dy / L * w, a.Y + dy * u + dx / L * w, 3.4 * a.f, b);
        }
      });
    }
  };
});

/* 1 · Почему атомы соединяются: два атома H и кривая энергии (потенциал Морзе для H₂). */
scene(1, () => {
  const svg = $('#whySvg'), range = $('#whyRange'), status = $('#whyStatus'), def = $('#whyDef');
  const D = 436, AL = 1.94, R0 = .74, K = 150, CX = 480, CY = 118;
  const En = r => D * (Math.pow(1 - Math.exp(-AL * (r - R0)), 2) - 1);
  const px = r => 120 + (r - .35) / 2.85 * 740, py = e => 255 + (250 - clamp(e, -480, 250)) / 730 * 190;
  let r = 3;
  const glow = S('ellipse', { cx: CX, cy: CY, rx: 46, ry: 60, fill: 'url(#g-bond)', class: 'bondglow', opacity: 0 }, svg);
  const at = [0, 1].map(i => {
    const g = S('g', {}, svg);
    return { g, cloud: S('circle', { r: 92, fill: 'url(#g-cloud)', class: 'cloud' }, g), ring: S('circle', { r: 98, class: 'atomring' }, g), shell: S('circle', { r: 68, class: 'shell' }, g),
      nuc: S('circle', { r: 13, fill: 'url(#g-O)', class: 'nuc' }, g), plus: S('text', { text: '+', 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 800, fill: '#fff', dy: 6 }, g),
      lbl: S('text', { text: 'H', 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 700, y: CY + 122, fill: '#b3c1dd' }, g), el: S('circle', { r: 6.5, class: 'el' }, svg) };
  });
  // график
  S('line', { x1: 120, y1: 250, x2: 120, y2: 448, stroke: 'rgba(160,200,255,.5)', 'marker-start': 'url(#m-arr)' }, svg);
  S('line', { x1: 120, y1: 448, x2: 880, y2: 448, stroke: 'rgba(160,200,255,.5)', 'marker-end': 'url(#m-arr)' }, svg);
  S('line', { x1: 120, y1: py(0), x2: 870, y2: py(0), stroke: 'rgba(160,200,255,.35)', 'stroke-dasharray': '4 6' }, svg);
  S('text', { x: 866, y: py(0) - 9, 'text-anchor': 'end', 'font-size': 15, fill: '#7586aa', class: 't-mono', text: 'E = 0 · АТОМЫ ДАЛЕКО' }, svg);
  S('text', { x: 134, y: 268, 'font-size': 15, fill: '#b3c1dd', class: 't-mono', text: 'ЭНЕРГИЯ СИСТЕМЫ' }, svg);
  S('text', { x: 880, y: 468, 'text-anchor': 'end', 'font-size': 15, fill: '#b3c1dd', class: 't-mono', text: 'РАССТОЯНИЕ МЕЖДУ ЯДРАМИ' }, svg);
  let d = '';
  for (let x = .42; x <= 3.2; x += .02) d += (d ? 'L' : 'M') + px(x).toFixed(1) + ' ' + py(En(x)).toFixed(1);
  S('path', { d, fill: 'none', stroke: '#55d9ff', 'stroke-width': 3.5, 'stroke-linecap': 'round' }, svg);
  S('line', { x1: px(R0), y1: py(-436), x2: px(R0), y2: 448, stroke: 'rgba(62,240,200,.6)', 'stroke-dasharray': '3 5' }, svg);
  S('text', { x: px(1.22), y: py(-436) + 4, 'font-size': 16, fill: '#3ef0c8', class: 't-mono', text: 'МИНИМУМ: 74 пм · −436 кДж/моль' }, svg);
  const mark = S('circle', { r: 9, fill: '#fff', stroke: '#55d9ff', 'stroke-width': 4 }, svg);
  const read = S('text', { x: 866, y: 276, 'text-anchor': 'end', 'font-size': 18, class: 't-mono', fill: '#fff' }, svg);

  const DEFS = {
    atom: '<b>Атом</b> — мельчайшая химически неделимая частица: положительное ядро и электроны вокруг него.',
    nuc: '<b>Ядро</b> — центр атома с положительным зарядом. Оно притягивает электроны — и свои, и соседнего атома.',
    shell: '<b>Электронная оболочка</b> — область вокруг ядра, где находятся электроны. Пунктир — её условная граница.',
    val: '<b>Валентные электроны</b> — электроны внешнего слоя. Именно они участвуют в образовании связей.',
    bond: '<b>Химическая связь</b> — взаимодействие, которое удерживает атомы вместе. Система при этом теряет энергию и становится устойчивее.'
  };
  function setR(v, fromRange) {
    r = clamp(v, .35, 3.2); if (!fromRange) range.value = Math.round(r * 100);
    const e = En(r);
    mark.setAttribute('cx', px(r)); mark.setAttribute('cy', py(e));
    read.textContent = 'r = ' + Math.round(r * 100) + ' пм · E = ' + (e > 250 ? '> +250' : (e > 0 ? '+' : '−') + Math.abs(Math.round(e))) + ' кДж/моль';
    status.textContent = r > 2 ? '● Атомы далеко: они почти не взаимодействуют.'
      : r > .92 ? '● Ядро каждого атома притягивает электрон соседа. Энергия системы понижается.'
      : r >= .6 ? '● Минимум энергии: устойчивая связь H–H. Электроны общие для двух ядер.'
      : '● Слишком близко: ядра отталкиваются, энергия резко растёт.';
    status.style.color = r < .6 ? '#ff6f72' : (r <= .92 ? '#3ef0c8' : '#b3c1dd');
  }
  function approach() { cancelTweens('1:'); const a = r > 1 ? r : 3; tween(2800, p => setR(lerp(a, R0, ease(p))), '1:r'); }
  range.addEventListener('input', () => { cancelTweens('1:'); setR(range.value / 100, true); });
  $('#whyApproach').addEventListener('click', approach);
  $$('#whyChips .chip').forEach(c => c.addEventListener('click', () => {
    const on = !c.classList.contains('on');
    $$('#whyChips .chip').forEach(x => x.classList.toggle('on', on && x === c));
    if (on) { svg.dataset.hl = c.dataset.k; def.innerHTML = DEFS[c.dataset.k]; if (c.dataset.k === 'bond') approach(); }
    else delete svg.dataset.hl;
  }));
  return {
    enter() { cancelTweens('1:'); setR(3); },
    tick(t) {
      const sep = r * K, b = smooth(1.5, .8, r);
      at.forEach((a, i) => {
        const x = CX + (i ? 1 : -1) * sep / 2;
        a.g.setAttribute('transform', 'translate(' + x + ' ' + CY + ')');
        a.lbl.setAttribute('y', 122); a.lbl.setAttribute('opacity', 1 - b * .0);
        const an = t * 1.7 * (i ? -1 : 1) + i * 2.4, ox = x + 46 * Math.cos(an), oy = CY + 46 * Math.sin(an);
        const bx = CX + (i ? 9 : -9) + 5 * Math.sin(t * 2.3 + i * 1.7), by = CY + 15 * Math.sin(t * 3.1 + i * Math.PI);
        a.el.setAttribute('cx', lerp(ox, bx, b)); a.el.setAttribute('cy', lerp(oy, by, b));
      });
      glow.setAttribute('opacity', b * (r < .55 ? .4 : 1) * (.8 + .2 * Math.sin(t * 3)));
      glow.setAttribute('rx', 30 + sep * .22);
    }
  };
});

/* 2 · Три типа связи — карточки ведут к демонстрациям (иконки вставлены выше). */

/* 3 · Ионная связь: Na + Cl → Na⁺ + Cl⁻ → кристалл. */
scene(3, () => {
  const svg = $('#ionSvg'), panel = svg.parentNode, txt = $('#ionText'), steps = $$('#ionSteps li');
  const lctx = setupCanvas($('#ionLattice'), 960, 520, 1.5), L = makeLattice(3);
  const RS = [38, 70, 102], Y = 262, SP = [.5, -.3, .2];
  const st = { tr: 0, ion: 0, near: 0, hlS: 0, hlE: 0, lat: 0, latOn: false, step: 0 };
  const TEXT = [
    'Атом натрия и&nbsp;атом хлора. У&nbsp;натрия на&nbsp;внешнем слое <b>1&nbsp;электрон</b>, у&nbsp;хлора — <b>7</b>, до&nbsp;завершения слоя не&nbsp;хватает одного.',
    'Электронные оболочки: Na — 2, 8, <b>1</b> · Cl — 2, 8, <b>7</b>.',
    'Внешний электрон натрия удерживается ядром слабее остальных. У&nbsp;хлора на&nbsp;внешнем слое есть свободное место.',
    'Электрон переходит от&nbsp;натрия к&nbsp;хлору.',
    'Образовались ионы: катион <b>Na⁺</b> (11&nbsp;протонов, 10&nbsp;электронов) и&nbsp;анион <b>Cl⁻</b> (17&nbsp;протонов, 18&nbsp;электронов).',
    'При образовании ионной связи возникают противоположно заряженные ионы, которые <b>притягиваются друг к&nbsp;другу</b>.',
    'Ионы притягиваются во&nbsp;всех направлениях и&nbsp;выстраиваются в&nbsp;<b>кристаллическую решётку</b>. Отдельных молекул NaCl в&nbsp;кристалле нет.'
  ];
  function mk(sym, z, shells) {
    const g = S('g', {}, svg), a = { sym, z, shells, g, e: [] };
    a.glow = S('circle', { r: 150, fill: 'url(#g-cloud)', opacity: .5 }, g);
    a.sh = RS.map(r => S('circle', { r, class: 'sh' }, g));
    S('circle', { r: 21, fill: 'url(#g-' + sym + ')' }, g);
    S('text', { text: '+' + z, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800, y: 5, style: 'fill:#06101f' }, g);
    a.lbl = S('text', { 'text-anchor': 'middle', 'font-size': 44, 'font-weight': 800, y: -152 }, g);
    a.name = S('text', { 'text-anchor': 'middle', 'font-size': 17, y: -124, class: 't-mono', style: 'fill:#b3c1dd' }, g);
    a.cnt = S('text', { 'text-anchor': 'middle', 'font-size': 17, y: 146, class: 't-mono', style: 'fill:#b3c1dd' }, g);
    a.chg = S('text', { 'text-anchor': 'middle', 'font-size': 17, y: 172, class: 't-mono', style: 'fill:#fff' }, g);
    shells.forEach((n, k) => { for (let i = 0; i < n; i++) a.e.push({ k, i, n: (sym === 'Cl' && k === 2) ? 8 : n, el: S('circle', { r: 5.5, class: 'e' }, svg) }); });
    return a;
  }
  const na = mk('Na', 11, [2, 8, 1]), cl = mk('Cl', 17, [2, 8, 7]);
  cl.e.filter(e => e.k === 2).forEach(e => { e.i += 1; });      // слот 0 третьего слоя хлора — вакансия
  const vac = S('circle', { r: 8, class: 'vac' }, svg);
  const hlE = S('circle', { r: 15, fill: 'none', stroke: '#fff', 'stroke-width': 2.5, opacity: 0 }, svg);
  const hlT = S('text', { 'font-size': 16, class: 't-mono', 'text-anchor': 'middle', opacity: 0, text: 'ВНЕШНИЙ ЭЛЕКТРОН' }, svg);
  const vacT = S('text', { 'font-size': 16, class: 't-mono', 'text-anchor': 'middle', opacity: 0, text: 'СВОБОДНОЕ МЕСТО' }, svg);
  const force = S('g', { opacity: 0 }, svg);
  const fa = S('line', { stroke: '#fff', 'stroke-width': 3, 'marker-end': 'url(#m-arr)' }, force), fb = S('line', { stroke: '#fff', 'stroke-width': 3, 'marker-end': 'url(#m-arr)' }, force);
  const ft = S('text', { 'font-size': 16, class: 't-mono', 'text-anchor': 'middle', x: 480, y: Y + 214, text: 'ЭЛЕКТРОСТАТИЧЕСКОЕ ПРИТЯЖЕНИЕ' }, force);
  const traveller = na.e.find(e => e.k === 2);

  function setStep(n) { st.step = n; steps.forEach((li, i) => { li.classList.toggle('cur', i === n - 1); li.classList.toggle('done', i < n - 1); }); txt.innerHTML = TEXT[n]; }
  function lattice(on) { st.latOn = on; panel.classList.toggle('show-lattice', on); if (on) { st.lat = 0; tween(2200, p => { st.lat = p; }, '3:lat'); } }
  function reset() { cancelTweens('3:'); st.tr = st.ion = st.near = st.hlS = st.hlE = 0; lattice(false); setStep(0); }
  const tw = (ms, f) => tween(ms, f, '3:seq');
  async function seqTransfer() {
    setStep(1); await tw(1500, p => { st.hlS = Math.sin(p * Math.PI); });
    setStep(2); st.hlE = 1; await wait(1700, '3:seq');
    setStep(3); await tw(2000, p => { st.tr = ease(p); st.hlE = 1 - p; }); st.hlE = 0;
  }
  async function seqIons() {
    setStep(4); await tw(1200, p => { st.ion = ease(p); }); await wait(1300, '3:seq');
    setStep(5); await tw(1700, p => { st.near = ease(p); });
  }
  $('#ionRun').addEventListener('click', async () => { reset(); await seqTransfer(); await wait(500, '3:seq'); await seqIons(); await wait(2200, '3:seq'); setStep(6); lattice(true); });
  $('#ionTransfer').addEventListener('click', async () => { reset(); await seqTransfer(); });
  $('#ionIons').addEventListener('click', async () => { reset(); st.tr = 1; await seqIons(); });
  $('#ionCrystal').addEventListener('click', () => { reset(); st.tr = st.ion = st.near = 1; setStep(6); lattice(true); });
  $('#ionReset').addEventListener('click', reset);

  function pos(a, e, t) { const an = t * SP[e.k] + e.i / e.n * TAU + e.k; return [a.x + RS[e.k] * Math.cos(an), Y + RS[e.k] * Math.sin(an)]; }
  return {
    enter() { reset(); },
    tick(t) {
      if (st.latOn) {
        lctx.clearRect(0, 0, 960, 520);
        drawLattice(lctx, L, 480, 312, 96, t * .28, .42, st.lat, true);
        if (st.lat > .9) {
          lctx.font = '600 15px ' + getComputedStyle(document.body).fontFamily; lctx.textAlign = 'left';
          sphere(lctx, 40, 478, 9, EL.Na.c, 0); lctx.fillStyle = '#dfe8ff'; lctx.fillText('Na⁺', 56, 483);
          sphere(lctx, 112, 478, 13, EL.Cl.c, 0); lctx.fillStyle = '#dfe8ff'; lctx.fillText('Cl⁻', 132, 483);
        }
        return;
      }
      na.x = lerp(270, 388, st.near); cl.x = lerp(690, 572, st.near);
      [na, cl].forEach(a => a.g.setAttribute('transform', 'translate(' + a.x + ' ' + Y + ')'));
      const ion = st.ion > .5;
      na.lbl.textContent = ion ? 'Na⁺' : 'Na'; cl.lbl.textContent = ion ? 'Cl⁻' : 'Cl';
      na.name.textContent = ion ? 'КАТИОН НАТРИЯ' : 'АТОМ НАТРИЯ'; cl.name.textContent = ion ? 'ХЛОРИД-ИОН' : 'АТОМ ХЛОРА';
      const moved = st.tr >= 1;
      na.cnt.textContent = 'p⁺ 11 · e⁻ ' + (moved ? 10 : 11); cl.cnt.textContent = 'p⁺ 17 · e⁻ ' + (moved ? 18 : 17);
      na.chg.textContent = ion ? 'ЗАРЯД 1+' : ''; cl.chg.textContent = ion ? 'ЗАРЯД 1−' : '';
      na.sh[2].setAttribute('opacity', 1 - st.ion); na.glow.setAttribute('r', lerp(150, 108, st.ion)); cl.glow.setAttribute('r', lerp(150, 162, st.ion));
      [na, cl].forEach(a => a.sh.forEach(s => { s.style.stroke = st.hlS > .02 ? 'rgba(255,255,255,' + (.4 + .6 * st.hlS) + ')' : ''; s.style.strokeWidth = 1.4 + 2.2 * st.hlS; }));
      [na, cl].forEach(a => a.e.forEach(e => { if (e === traveller) return; const p = pos(a, e, t); e.el.setAttribute('cx', p[0]); e.el.setAttribute('cy', p[1]); }));
      const A = pos(na, traveller, t), B = pos(cl, { k: 2, i: 0, n: 8 }, t), u = st.tr;
      const mx = (A[0] + B[0]) / 2, my = Math.min(A[1], B[1]) - 150;
      const ex = (1 - u) * (1 - u) * A[0] + 2 * u * (1 - u) * mx + u * u * B[0], ey = (1 - u) * (1 - u) * A[1] + 2 * u * (1 - u) * my + u * u * B[1];
      traveller.el.setAttribute('cx', ex); traveller.el.setAttribute('cy', ey); traveller.el.setAttribute('r', 5.5 + 3 * Math.sin(u * Math.PI));
      vac.setAttribute('cx', B[0]); vac.setAttribute('cy', B[1]); vac.setAttribute('opacity', u < 1 ? 1 : 0);
      const pulse = st.hlE * (.6 + .4 * Math.sin(t * 7));
      hlE.setAttribute('cx', ex); hlE.setAttribute('cy', ey); hlE.setAttribute('opacity', pulse);
      const lab = st.step === 2 ? 1 : 0;
      hlT.setAttribute('x', na.x); hlT.setAttribute('y', Y + 180); hlT.setAttribute('opacity', lab);
      vacT.setAttribute('x', cl.x); vacT.setAttribute('y', Y + 180); vacT.setAttribute('opacity', lab);
      const f = st.ion > .9 ? 1 : 0;
      force.setAttribute('opacity', f * (st.step >= 5 ? 1 : .0));
      const gap = cl.x - na.x, x1 = na.x + 80, x2 = cl.x - 112, mid = (x1 + x2) / 2, w = Math.max(0, (x2 - x1) / 2 - 8) * (.75 + .25 * Math.sin(t * 5));
      fa.setAttribute('x1', x1); fa.setAttribute('x2', x1 + w); fb.setAttribute('x1', x2); fb.setAttribute('x2', x2 - w);
      [fa, fb].forEach(l => { l.setAttribute('y1', Y); l.setAttribute('y2', Y); l.setAttribute('opacity', gap > 215 ? 1 : 0); });
      ft.setAttribute('opacity', st.step === 5 ? 1 : 0);
    }
  };
});

/* 4 · Свойства ионных соединений: кристалл / расплав / раствор между электродами. */
scene(4, () => {
  const ctx = setupCanvas($('#saltCanvas'), 960, 520, 1.5), txt = $('#saltText');
  const TEXT = {
    solid: '<b>Кристалл.</b> Ионы колеблются около узлов решётки и&nbsp;не&nbsp;могут перемещаться. Тока нет — лампа не&nbsp;горит.',
    melt: '<b>Расплав (выше 801&nbsp;°C).</b> Решётка разрушена, ионы подвижны: Na⁺ движутся к&nbsp;катоду (−), Cl⁻ — к&nbsp;аноду (+). Цепь проводит ток.',
    sol: '<b>Раствор.</b> Молекулы воды разделяют ионы. Подвижные ионы переносят заряд — раствор проводит ток.'
  };
  const TX0 = 136, TX1 = 824, TY0 = 168, TY1 = 468;
  let mode = 'solid', lamp = 0, liquid = 0, water = 0;
  const ions = [];
  for (let j = 0; j < 5; j++) for (let i = 0; i < 10; i++) ions.push({ gx: 228 + i * 56, gy: 206 + j * 56, na: (i + j) % 2 === 0, x: 228 + i * 56, y: 206 + j * 56, vx: 0, vy: 0, a: 1, ph: Math.random() * TAU, hide: j % 2 === 1, fade: 0 });
  function setMode(m) { mode = m; txt.innerHTML = TEXT[m]; ions.forEach(n => { n.fade = 0; if (m !== 'solid') { n.vx = rnd(-40, 40); n.vy = rnd(-40, 40); } }); }
  $$('#saltModes button').forEach(b => b.addEventListener('click', () => { segOn($('#saltModes'), b); setMode(b.dataset.m); }));
  function wire(t, on) {
    const path = () => { ctx.beginPath(); ctx.moveTo(848, 150); ctx.lineTo(848, 70); ctx.lineTo(112, 70); ctx.lineTo(112, 150); };
    ctx.strokeStyle = 'rgba(160,200,255,.55)'; ctx.lineWidth = 3; ctx.setLineDash([]); path(); ctx.stroke();
    if (on > .05) { ctx.strokeStyle = rgb(C_E, on); ctx.lineWidth = 4; ctx.setLineDash([3, 20]); ctx.lineDashOffset = -t * 70; path(); ctx.stroke(); ctx.setLineDash([]); }
  }
  return {
    enter() { segOn($('#saltModes'), $('#saltModes button')); ions.forEach(n => { n.x = n.gx; n.y = n.gy; n.a = 1; }); liquid = water = lamp = 0; setMode('solid'); },
    tick(t, dt) {
      const mob = mode !== 'solid';
      lamp = lerp(lamp, mob ? 1 : 0, Math.min(1, dt * 3)); liquid = lerp(liquid, mob ? 1 : 0, Math.min(1, dt * 3)); water = lerp(water, mode === 'sol' ? 1 : 0, Math.min(1, dt * 3));
      ctx.clearRect(0, 0, 960, 520);
      wire(t, lamp);
      // источник тока и лампа
      ctx.fillStyle = '#0a1122'; ctx.fillRect(330, 52, 60, 36);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(370, 54); ctx.lineTo(370, 86); ctx.stroke();
      ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(350, 60); ctx.lineTo(350, 80); ctx.stroke();
      ctx.fillStyle = '#b3c1dd'; ctx.font = '700 17px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('−', 340, 46); ctx.fillText('+', 381, 46);
      const g = ctx.createRadialGradient(600, 70, 2, 600, 70, 70);
      g.addColorStop(0, 'rgba(255,214,120,' + .95 * lamp + ')'); g.addColorStop(1, 'rgba(255,190,90,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(600, 70, 70, 0, TAU); ctx.fill();
      ctx.fillStyle = lamp > .5 ? '#ffe6a8' : '#0a1122'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(600, 70, 19, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(587, 57); ctx.lineTo(613, 83); ctx.moveTo(613, 57); ctx.lineTo(587, 83); ctx.strokeStyle = lamp > .5 ? '#a86a10' : '#fff'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#7586aa'; ctx.font = '600 14px sans-serif'; ctx.fillText(lamp > .5 ? 'ЛАМПА ГОРИТ' : 'ЛАМПА НЕ ГОРИТ', 600, 124);
      // сосуд
      ctx.fillStyle = 'rgba(60,150,255,' + (.06 + .16 * water + .05 * liquid) + ')'; ctx.strokeStyle = 'rgba(160,200,255,.4)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.rect(104, 160, 752, 316); ctx.fill(); ctx.stroke();
      if (liquid > .3 && water < .5) { ctx.fillStyle = 'rgba(255,120,60,' + .1 * liquid * (1 - water) + ')'; ctx.fillRect(104, 160, 752, 316); }
      // электроды: слева — тот, что соединён с «−» источника (катод)
      [[104, '−', 'КАТОД'], [840, '+', 'АНОД']].forEach(e => {
        ctx.fillStyle = '#9fb0d2'; ctx.fillRect(e[0], 146, 16, 330);
        ctx.fillStyle = '#fff'; ctx.font = '800 26px sans-serif'; ctx.fillText(e[1], e[0] + 8, 506);
        ctx.fillStyle = '#7586aa'; ctx.font = '600 13px sans-serif'; ctx.fillText(e[2], e[0] + (e[1] === '−' ? 62 : -46), 502);
      });
      ions.forEach(n => {
        const targetA = (mode === 'sol' && n.hide) ? 0 : 1;
        if (!mob) { n.x += (n.gx + Math.sin(t * 11 + n.ph) * 2.2 - n.x) * Math.min(1, dt * 5); n.y += (n.gy + Math.cos(t * 9 + n.ph) * 2.2 - n.y) * Math.min(1, dt * 5); n.a = lerp(n.a, 1, Math.min(1, dt * 4)); }
        else {
          n.vx += (rnd(-1, 1) * 700 + (n.na ? -42 : 42)) * dt; n.vy += rnd(-1, 1) * 700 * dt;
          const s = Math.hypot(n.vx, n.vy); if (s > 78) { n.vx *= 78 / s; n.vy *= 78 / s; }
          n.x += n.vx * dt; n.y += n.vy * dt;
          if (n.y < TY0 + 12) { n.y = TY0 + 12; n.vy = Math.abs(n.vy); } if (n.y > TY1 - 12) { n.y = TY1 - 12; n.vy = -Math.abs(n.vy); }
          if (n.x < TX0) { n.x = TX0; n.vx = Math.abs(n.vx) * .3; if (n.na) n.fade = 1; } if (n.x > TX1) { n.x = TX1; n.vx = -Math.abs(n.vx) * .3; if (!n.na) n.fade = 1; }
          if (n.fade) { n.a -= dt * 1.6; if (n.a <= 0) { n.fade = 0; n.x = rnd(330, 630); n.y = rnd(TY0 + 20, TY1 - 20); n.a = 0; } }
          else n.a = lerp(n.a, targetA, Math.min(1, dt * 3));
        }
        if (n.a < .02) return;
        const r = n.na ? 11 : 17;
        if (water > .3) { ctx.strokeStyle = 'rgba(140,200,255,' + .35 * water * n.a + ')'; ctx.lineWidth = 1.2; ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.arc(n.x, n.y, r + 9, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
        sphere(ctx, n.x, n.y, r, n.na ? EL.Na.c : EL.Cl.c, .18, n.a);
        ctx.globalAlpha = n.a; sign(ctx, n.x, n.y, r * .38, n.na); ctx.globalAlpha = 1;
      });
      ctx.textAlign = 'left'; ctx.font = '600 14px sans-serif'; ctx.fillStyle = '#b3c1dd';
      sphere(ctx, 138, 30, 8, EL.Na.c, 0); ctx.fillStyle = '#dfe8ff'; ctx.fillText('Na⁺', 152, 35); sphere(ctx, 204, 30, 12, EL.Cl.c, 0); ctx.fillStyle = '#dfe8ff'; ctx.fillText('Cl⁻', 222, 35);
      if (water > .5) { ctx.globalAlpha = water; ctx.fillStyle = '#8fd0ff'; ctx.fillText('пунктир — молекулы воды вокруг иона', 290, 35); ctx.globalAlpha = 1; }
    }
  };
});

/* 5 · Ковалентная связь: лаборатория молекул. */
scene(5, () => {
  const svg = $('#covSvg'), info = $('#covInfo'), tabs = $('#covTabs');
  const root = S('g', {}, svg);
  const cap = S('text', { x: 480, y: 432, 'text-anchor': 'middle', 'font-size': 21, fill: '#b3c1dd' }, svg);
  const st = S('text', { x: 480, y: 492, 'text-anchor': 'middle', 'font-size': 46, 'font-weight': 700, class: 't-mono', fill: '#55d9ff', opacity: 0 }, svg);
  const lg = S('g', { transform: 'translate(700 40)' }, svg);
  S('circle', { cx: 0, cy: 0, r: 6, fill: rgb(C_E) }, lg); S('circle', { cx: 18, cy: 0, r: 6, fill: rgb(C_E2) }, lg);
  S('text', { x: 34, y: 5, 'font-size': 15, fill: '#b3c1dd', text: 'валентные электроны' }, lg);
  S('ellipse', { cx: 9, cy: 28, rx: 15, ry: 8, class: 'lw-pair' }, lg);
  S('text', { x: 34, y: 33, 'font-size': 15, fill: '#b3c1dd', text: 'общая электронная пара' }, lg);
  let key = 'H2', model = null;
  function play() {
    cancelTweens('5:'); st.setAttribute('opacity', 0);
    tween(3600, p => {
      const q = clamp((p - .1) / .9); model.set(q);
      cap.textContent = q < .3 ? 'Атомы по отдельности. У каждого есть неспаренные электроны' : q < .88 ? 'Атомы сближаются — электронные оболочки перекрываются' : 'Общие пары принадлежат обоим атомам сразу';
      st.setAttribute('opacity', clamp((q - .88) / .12));
    }, '5:p');
  }
  function select(k) {
    key = k; root.innerHTML = '';
    model = lewis(root, k, { x: 480, y: k === 'H2O' ? 250 : 244, s: k === 'H2O' ? 1.75 : 1.9 });
    const m = MOL[k]; st.textContent = m.st;
    info.innerHTML = '<dt>Молекула</dt><dd class="big">' + m.f + '</dd><dt>Валентные электроны</dt><dd>' + m.val + '</dd><dt>Общих пар</dt><dd>' + m.pairs + '</dd>' +
      '<dt>Структурная формула</dt><dd class="big">' + m.st + '</dd><dt>Тип связи</dt><dd><b>' + m.type + '</b></dd><dt></dt><dd style="color:var(--ink2);font-size:18px">' + m.note + '</dd>';
    play();
  }
  $$('button', tabs).forEach(b => b.addEventListener('click', () => { segOn(tabs, b); select(b.dataset.m); }));
  $('#covReplay').addEventListener('click', play);
  return { enter() { select(key); } };
});

/* 6 · Полярность: распределение электронной плотности и электроотрицательность. */
scene(6, () => {
  const svg = $('#polSvg'), txt = $('#polText'), mols = $('#polMols');
  const CXm = 480, CYm = 200;
  const SPEC = {
    H2:  { f: 'H₂',  a: [['H', -72, 0], ['H', 72, 0]], b: [[0, 1]], t: '<b>H₂ — неполярная связь.</b> Атомы одинаковые и&nbsp;притягивают общую пару с&nbsp;равной силой. Электронная плотность распределена симметрично.' },
    Cl2: { f: 'Cl₂', a: [['Cl', -96, 0], ['Cl', 96, 0]], b: [[0, 1]], t: '<b>Cl₂ — неполярная связь.</b> Электроотрицательность атомов одинакова — общей паре некуда смещаться.' },
    HCl: { f: 'HCl', a: [['H', -92, 0], ['Cl', 78, 0]], b: [[0, 1]], t: '<b>HCl — полярная связь.</b> Хлор электроотрицательнее водорода и&nbsp;сильнее притягивает общую пару: на&nbsp;хлоре δ⁻, на&nbsp;водороде δ⁺.' },
    H2O: { f: 'H₂O', a: [['O', 0, -46], ['H', -100, 32], ['H', 100, 32]], b: [[0, 1], [0, 2]], t: '<b>H₂O — две полярные связи O–H.</b> Кислород оттягивает к&nbsp;себе обе общие пары. Молекула угловая, поэтому полярна и&nbsp;вся молекула.' }
  };
  const POOR = [130, 96, 255], NEU = [70, 170, 255], RICH = [110, 255, 226];
  const col = f => f < 0 ? rgb(mix(NEU, POOR, -f), lerp(.55, .2, -f)) : rgb(mix(NEU, RICH, f), lerp(.55, .98, f));
  const gCloud = S('g', { filter: 'url(#f-blur)' }, svg), gDefs = S('defs', {}, svg), gFront = S('g', {}, svg), gScale = S('g', {}, svg);
  // легенда плотности
  const lgr = S('linearGradient', { id: 'polLegend' }, gDefs);
  [[0, col(-1)], [.5, col(0)], [1, col(1)]].forEach(s => S('stop', { offset: s[0], 'stop-color': s[1] }, lgr));
  S('rect', { x: 690, y: 30, width: 230, height: 14, rx: 7, fill: 'url(#polLegend)' }, svg);
  S('text', { x: 690, y: 66, 'font-size': 14, class: 't-mono', fill: '#b3c1dd', text: 'МЕНЬШЕ' }, svg);
  S('text', { x: 920, y: 66, 'font-size': 14, class: 't-mono', 'text-anchor': 'end', fill: '#b3c1dd', text: 'БОЛЬШЕ' }, svg);
  S('text', { x: 690, y: 22, 'font-size': 14, class: 't-mono', fill: '#7586aa', text: 'ЭЛЕКТРОННАЯ ПЛОТНОСТЬ' }, svg);
  S('text', { x: 150, y: 496, 'font-size': 13, class: 't-mono', fill: '#7586aa', text: 'УСЛОВНАЯ МОДЕЛЬ РАСПРЕДЕЛЕНИЯ ПЛОТНОСТИ, НЕ ИЗОБРАЖЕНИЕ РЕАЛЬНОЙ МОЛЕКУЛЫ' }, svg);
  let polar = 0, key = 'H2', sc = null, s = 0;
  const X = chi => 150 + (chi - .5) / 3.5 * 660;

  function build() {
    const m = SPEC[key]; gCloud.innerHTML = ''; gFront.innerHTML = ''; gScale.innerHTML = ''; $$('linearGradient.dyn', gDefs).forEach(e => e.remove());
    const A = m.a.map(a => ({ s: a[0], x: CXm + a[1], y: CYm + a[2], el: EL[a[0]], q: 0 }));
    const B = m.b.map((b, i) => {
      const a = A[b[0]], c = A[b[1]], pol = clamp((c.el.chi - a.el.chi) / 1.3, -1, 1);
      a.q -= pol; c.q += pol;
      const gr = S('linearGradient', { id: 'polG' + i, class: 'dyn', gradientUnits: 'userSpaceOnUse', x1: a.x, y1: a.y, x2: c.x, y2: c.y }, gDefs);
      const s0 = S('stop', { offset: .1 }, gr), s1 = S('stop', { offset: .9 }, gr);
      const line = S('line', { x1: a.x, y1: a.y, x2: c.x, y2: c.y, 'stroke-width': 124, 'stroke-linecap': 'round', stroke: 'url(#polG' + i + ')' }, gCloud);
      // если связь строго горизонтальна, градиенту нужна ненулевая высота bbox — задаём userSpaceOnUse (сделано выше)
      S('line', { x1: a.x, y1: a.y, x2: c.x, y2: c.y, stroke: 'rgba(255,255,255,.5)', 'stroke-width': 2 }, gFront);
      const L = Math.hypot(c.x - a.x, c.y - a.y), ux = (c.x - a.x) / L, uy = (c.y - a.y) / L;
      const e = [S('circle', { r: 7, fill: '#fff', stroke: '#06101f', 'stroke-width': 1.5 }, gFront), S('circle', { r: 7, fill: '#fff', stroke: '#06101f', 'stroke-width': 1.5 }, gFront)];
      const arr = Math.abs(pol) > .1 ? S('line', { stroke: '#fff', 'stroke-width': 3, 'marker-end': 'url(#m-arr)', opacity: 0 }, gFront) : null;
      return { a, c, pol, s0, s1, line, ux, uy, L, e, arr };
    });
    A.forEach(a => { a.q = clamp(a.q, -1, 1); a.cloud = S('circle', { cx: a.x, cy: a.y }, gCloud); });
    A.forEach(a => {
      S('circle', { cx: a.x, cy: a.y, r: a.el.core + 3, fill: 'url(#g-' + a.s + ')' }, gFront);
      S('text', { x: a.x, y: a.y + 1, class: 'lw-sym', 'font-size': a.s.length > 1 ? 24 : 28, text: a.s }, gFront);
      a.d = Math.abs(a.q) > .2 ? S('text', { x: a.x + (a.s === 'O' ? 0 : (a.x < CXm ? -62 : 62)), y: a.y - (a.s === 'O' ? 74 : 58), 'text-anchor': 'middle', 'font-size': 44, 'font-weight': 700, opacity: 0, text: a.q > 0 ? 'δ⁻' : 'δ⁺' }, gFront) : null;
    });
    // шкала электроотрицательности
    S('line', { x1: 150, y1: 420, x2: 810, y2: 420, stroke: 'rgba(160,200,255,.5)', 'stroke-width': 2 }, gScale);
    for (let v = 1; v <= 4; v++) { S('line', { x1: X(v), y1: 414, x2: X(v), y2: 426, stroke: 'rgba(160,200,255,.6)' }, gScale); S('text', { x: X(v), y: 446, 'text-anchor': 'middle', 'font-size': 14, class: 't-mono', fill: '#7586aa', text: v + ',0' }, gScale); }
    S('text', { x: 150, y: 470, 'font-size': 14, class: 't-mono', fill: '#7586aa', text: 'ЭЛЕКТРООТРИЦАТЕЛЬНОСТЬ χ — СПОСОБНОСТЬ АТОМА ПРИТЯГИВАТЬ ОБЩИЕ ЭЛЕКТРОНЫ' }, gScale);
    const seen = {};
    A.forEach(a => { if (seen[a.s]) return; seen[a.s] = 1;
      S('circle', { cx: X(a.el.chi), cy: 420, r: 9, fill: rgb(a.el.c), stroke: '#06101f', 'stroke-width': 2 }, gScale);
      S('text', { x: X(a.el.chi), y: 400, 'text-anchor': 'middle', 'font-size': 19, 'font-weight': 700, text: a.s + ' ' + ru(a.el.chi) }, gScale); });
    const ks = Object.keys(seen), dchi = ks.length > 1 ? Math.abs(EL[ks[0]].chi - EL[ks[1]].chi) : 0;
    S('text', { x: 480, y: 356, 'text-anchor': 'middle', 'font-size': 23, 'font-weight': 700, fill: dchi ? '#3ef0c8' : '#b3c1dd', text: 'Δχ = ' + ru(dchi) + (dchi ? ' → общая пара смещена' : ' → общая пара посередине') }, gScale);
    txt.innerHTML = m.t;
    sc = { A, B };
  }
  function apply() {
    sc.A.forEach(a => { const f = a.q * s; a.cloud.setAttribute('fill', col(f)); a.cloud.setAttribute('r', (a.el.r + 22) * (1 + .22 * f)); if (a.d) a.d.setAttribute('opacity', s); });
    sc.B.forEach(b => {
      b.s0.setAttribute('stop-color', col(b.a.q * s)); b.s1.setAttribute('stop-color', col(b.c.q * s));
      const t = .5 + .15 * b.pol * s, mx = lerp(b.a.x, b.c.x, t), my = lerp(b.a.y, b.c.y, t);
      b.e.forEach((e, i) => { const k = (i ? 1 : -1) * 9; e.setAttribute('cx', mx + b.ux * k); e.setAttribute('cy', my + b.uy * k); });
      if (b.arr) {
        const dir = b.pol > 0 ? 1 : -1; let nx = -b.uy, ny = b.ux;
        const mx0 = (b.a.x + b.c.x) / 2, my0 = (b.a.y + b.c.y) / 2;
        const out = Math.abs(b.uy) < .01 ? (ny > 0 ? 1 : -1) : ((mx0 - CXm) * nx + (my0 - (CYm + 10)) * ny > 0 ? 1 : -1);
        const cx = mx0 + nx * 62 * out, cy = my0 + ny * 62 * out, h = 34 * dir;
        b.arr.setAttribute('x1', cx - b.ux * h); b.arr.setAttribute('y1', cy - b.uy * h); b.arr.setAttribute('x2', cx + b.ux * h); b.arr.setAttribute('y2', cy + b.uy * h); b.arr.setAttribute('opacity', s * .9);
      }
    });
  }
  function select(k) { key = k; build(); s = 0; apply(); cancelTweens('6:'); $$('.chip', mols).forEach(c => c.classList.toggle('on', c.dataset.k === k)); tween(1700, p => { s = ease(clamp((p - .25) / .75)); apply(); }, '6:s'); }
  function setPolar(p) {
    polar = p; segOn($('#polSeg'), $$('#polSeg button')[p]);
    mols.innerHTML = ''; (p ? ['HCl', 'H2O'] : ['H2', 'Cl2']).forEach(k => { const c = H('button', 'chip', SPEC[k].f, mols); c.dataset.k = k; c.addEventListener('click', () => select(k)); });
    select(p ? 'HCl' : 'H2');
  }
  $$('#polSeg button').forEach(b => b.addEventListener('click', () => setPolar(+b.dataset.p)));
  return { enter() { setPolar(polar); } };
});

/* 7 · Кратность связи. */
scene(7, () => {
  const DATA = [{ k: 'H2', f: 'H–H', n: 'одинарная', p: 1, E: 436, l: 74 }, { k: 'O2', f: 'O=O', n: 'двойная', p: 2, E: 498, l: 121 }, { k: 'N2', f: 'N≡N', n: 'тройная', p: 3, E: 945, l: 110 }];
  const cards = $('#multCards'), bars = $('#multBars'), txt = $('#multText'), btn = $('#multCompare');
  const models = DATA.map((d, i) => {
    const c = H('button', 'mcard rise', '', cards); c.style.setProperty('--i', i + 1);
    const svg = S('svg', { viewBox: '0 0 360 270' }, c);
    const m = lewis(svg, d.k, { x: 180, y: 138, s: 1.6, spread: 44 });
    H('div', 'mf', d.f, c); H('div', 'mn', d.n + ' связь', c);
    H('div', 'ms', 'общих пар: <b>' + d.p + '</b><br>длина связи: <b>' + d.l + ' пм</b>', c);
    c.addEventListener('click', () => { cancelTweens('7:m' + i); tween(2400, p => m.set(p), '7:m' + i); txt.innerHTML = '<b>' + d.f + '</b> — ' + (d.p === 1 ? 'одна общая пара' : d.p === 2 ? 'две общие пары' : 'три общие пары') + ': каждый атом отдаёт в&nbsp;общее пользование ' + (d.p === 1 ? 'один электрон' : d.p === 2 ? 'два электрона' : 'три электрона') + '. Энергия связи — ' + d.E + '&nbsp;кДж/моль.'; });
    return m;
  });
  const rows = DATA.concat([{ f: 'Cl–Cl', E: 243, extra: true }]).map(d => {
    const r = H('div', 'bar' + (d.extra ? ' extra' : ''), '<span>' + d.f + '</span><div><i></i></div><span>' + d.E + '</span>', bars);
    if (d.extra) r.style.display = 'none';
    return { r, i: $('i', r), d };
  });
  let cmp = false;
  function setBars() { rows.forEach(x => { x.i.style.width = (x.d.extra && !cmp ? 0 : x.d.E / 945 * 100) + '%'; }); }
  btn.addEventListener('click', () => {
    cmp = !cmp; rows[3].r.style.display = cmp ? '' : 'none'; btn.innerHTML = cmp ? 'Скрыть Cl–Cl' : 'Сравнить с&nbsp;Cl–Cl';
    requestAnimationFrame(() => requestAnimationFrame(setBars));
    txt.innerHTML = cmp ? '<b>Число чёрточек — не&nbsp;единственный фактор.</b> Связи H–H и&nbsp;Cl–Cl обе одинарные, но&nbsp;их энергия различается почти вдвое. Прочность зависит ещё и&nbsp;от&nbsp;того, какие атомы связаны, и&nbsp;от&nbsp;строения вещества.'
      : 'В&nbsp;школьной модели чёрточка в&nbsp;формуле — одна общая электронная пара. Нажмите на&nbsp;карточку, чтобы увидеть, как образуются пары.';
  });
  return {
    enter() { rows.forEach(x => { x.i.style.width = '0%'; }); wait(500, '7:b').then(setBars); models.forEach((m, i) => { m.set(0); tween(2200, p => m.set(clamp(p * 1.25 - i * .12)), '7:m' + i); }); },
    leave() { models.forEach(m => m.set(1)); }
  };
});

/* 8 · Металлическая связь и свойства металлов. */
scene(8, () => {
  const ctx = setupCanvas($('#metalCanvas'), 960, 520, 1.5), txt = $('#metalText'), root = $('#metalProps');
  const sim = MetalSim(ctx, { cols: 8, rows: 4, sp: 92, x0: 158, y0: 150, r: 21, ne: 58, box: [130, 122, 830, 454], pad: 14 });
  const TEXT = {
    base: '<b>Строение.</b> В&nbsp;узлах решётки — положительные ионы металла. Между ними — общие, делокализованные электроны («электронный газ»). Их притяжение к&nbsp;ионам и&nbsp;есть металлическая связь.',
    heat: '<b>Теплопроводность.</b> Нагретые ионы колеблются сильнее. Подвижные электроны быстро разносят энергию по&nbsp;всему образцу — металл прогревается целиком.',
    bend: '<b>Пластичность и&nbsp;ковкость.</b> Слои ионов смещаются друг относительно друга, а&nbsp;общие электроны продолжают их удерживать. Связь не&nbsp;рвётся — металл гнётся, а&nbsp;не&nbsp;крошится.',
    shine: '<b>Металлический блеск.</b> Свободные электроны у&nbsp;поверхности взаимодействуют со&nbsp;светом и&nbsp;отражают большую его часть.'
  };
  function setMode(m) { sim.setMode(m); txt.innerHTML = TEXT[m]; $$('button', root).forEach(b => b.classList.toggle('on', b.dataset.m === m)); }
  $$('button', root).forEach(b => b.addEventListener('click', () => setMode(b.dataset.m)));
  function label(s, x, y, c, al) { ctx.font = '600 15px sans-serif'; ctx.textAlign = al || 'left'; ctx.fillStyle = c || '#b3c1dd'; ctx.fillText(s, x, y); }
  return {
    enter() { setMode('base'); },
    tick(t, dt) {
      sim.step(t, dt); ctx.clearRect(0, 0, 960, 520);
      if (sim.mode === 'shine') {
        ctx.lineCap = 'round';
        for (let i = 0; i < 5; i++) {
          const hx = 250 + i * 115, hy = 108, u = (sim.tm * .55 + i * .21) % 1;
          ctx.strokeStyle = 'rgba(255,240,170,.22)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(hx - 120, hy - 96); ctx.lineTo(hx, hy); ctx.lineTo(hx + 120, hy - 96); ctx.stroke();
          const seg = (a, b) => { const p = k => k < .5 ? [hx - 120 + 240 * k, hy - 96 + 192 * k] : [hx - 120 + 240 * k, hy - 96 * (2 * k - 1)]; const A = p(a), Bp = p(b); ctx.beginPath(); ctx.moveTo(A[0], A[1]); if (a < .5 && b > .5) ctx.lineTo(hx, hy); ctx.lineTo(Bp[0], Bp[1]); ctx.stroke(); };
          ctx.strokeStyle = 'rgba(255,244,190,.95)'; ctx.lineWidth = 4; seg(u * .86, u * .86 + .14);
          const fl = Math.max(0, 1 - Math.abs(u * .86 + .07 - .5) * 9);
          if (fl > 0) { const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, 46); g.addColorStop(0, 'rgba(255,250,210,' + .9 * fl + ')'); g.addColorStop(1, 'rgba(255,250,210,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(hx, hy, 46, 0, TAU); ctx.fill(); }
        }
        label('СВЕТ ПАДАЕТ', 130, 34, '#ffe9a8'); label('СВЕТ ОТРАЖАЕТСЯ', 830, 34, '#ffe9a8', 'right');
      }
      sim.draw(t);
      if (sim.mode === 'heat') { label('НАГРЕВ →', 132, 100, '#ff9a6a'); label(sim.tm > 5 ? 'ТЕПЛО ДОШЛО ДО ДРУГОГО КРАЯ' : 'ТЕПЛО РАСПРОСТРАНЯЕТСЯ…', 828, 100, '#ff9a6a', 'right'); }
      if (sim.mode === 'bend') {
        const u = sim.tm % 6, fwd = u >= 1 && u < 2.4, back = u >= 4 && u < 5.4;
        if (fwd || back) { ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'; ctx.lineWidth = 5; const y = 196, x = fwd ? 40 : 950, d = fwd ? 1 : -1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 46 * d, y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + 62 * d, y); ctx.lineTo(x + 42 * d, y - 12); ctx.lineTo(x + 42 * d, y + 12); ctx.fill(); }
        label('ВЕРХНИЕ СЛОИ СДВИГАЮТСЯ — РЕШЁТКА ОСТАЁТСЯ ЦЕЛОЙ', 480, 100, '#fff', 'center');
      }
      if (sim.mode === 'base') {
        sphere(ctx, 144, 95, 10, C_METAL, 0); sign(ctx, 144, 95, 4, true); label('ионы металла — в узлах решётки', 164, 100);
        label('делокализованные электроны', 500, 100); eDot(ctx, 482, 95, 4.5, 1);
      }
    }
  };
});

/* 9 · Проводимость металла: источник напряжения задаёт электронам общее направление. */
scene(9, () => {
  const ctx = setupCanvas($('#wireCanvas'), 960, 520, 1.5), bat = $('#battery');
  const sim = MetalSim(ctx, { mode: 'current', cols: 9, rows: 3, sp: 84, x0: 144, y0: 102, r: 20, ne: 54, box: [112, 74, 848, 298], pad: 12, wrap: true, drift: 85 });
  let lamp = 0;
  function set(on) {
    sim.on = on; bat.setAttribute('aria-pressed', on ? 'true' : 'false');
    $('#batState').textContent = on ? 'включён · нажмите ещё раз' : 'выключен · нажмите';
    $('#wireEl').innerHTML = on ? 'к&nbsp;хаотическому движению добавился <b>общий дрейф</b> — от «−» к «+»' : 'движутся хаотически, общего направления нет';
    $('#wireCur').innerHTML = on ? '<b>течёт</b> — заряд переносят электроны' : 'отсутствует';
    $('#wireText').innerHTML = on ? 'Электрическое поле источника действует на&nbsp;все свободные электроны сразу. Ионы решётки остаются на&nbsp;местах — движутся только электроны.' : 'Нажмите на&nbsp;источник напряжения и&nbsp;следите за&nbsp;электронами.';
  }
  bat.addEventListener('click', () => set(!sim.on));
  function loop() { ctx.beginPath(); ctx.moveTo(296, 462); ctx.lineTo(50, 462); ctx.lineTo(50, 186); ctx.lineTo(100, 186); ctx.moveTo(860, 186); ctx.lineTo(910, 186); ctx.lineTo(910, 462); ctx.lineTo(664, 462); }
  function arrow(x1, x2, y, c, s) {
    const d = x2 > x1 ? 1 : -1; ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2 - 10 * d, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x2, y); ctx.lineTo(x2 - 16 * d, y - 8); ctx.lineTo(x2 - 16 * d, y + 8); ctx.fill();
    ctx.font = '600 15px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(s, (x1 + x2) / 2, y - 12);
  }
  return {
    enter() { set(false); lamp = 0; },
    tick(t, dt) {
      sim.step(t, dt); lamp = lerp(lamp, sim.on ? 1 : 0, Math.min(1, dt * 4));
      ctx.clearRect(0, 0, 960, 520);
      ctx.strokeStyle = 'rgba(160,200,255,.55)'; ctx.lineWidth = 3; ctx.setLineDash([]); loop(); ctx.stroke();
      if (lamp > .05) { ctx.strokeStyle = rgb(C_E, lamp); ctx.lineWidth = 4.5; ctx.setLineDash([3, 22]); ctx.lineDashOffset = -t * 85; loop(); ctx.stroke(); ctx.setLineDash([]); }
      // лампа
      const g = ctx.createRadialGradient(760, 462, 2, 760, 462, 78); g.addColorStop(0, 'rgba(255,214,120,' + .95 * lamp + ')'); g.addColorStop(1, 'rgba(255,190,90,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(760, 462, 78, 0, TAU); ctx.fill();
      ctx.fillStyle = lamp > .5 ? '#ffe6a8' : '#0a1122'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(760, 462, 21, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = lamp > .5 ? '#a86a10' : '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(745, 447); ctx.lineTo(775, 477); ctx.moveTo(775, 447); ctx.lineTo(745, 477); ctx.stroke();
      sim.draw(t);
      ctx.font = '600 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#7586aa'; ctx.fillText('МЕТАЛЛИЧЕСКИЙ ПРОВОДНИК (УВЕЛИЧЕНО)', 480, 44);
      if (lamp > .5) {
        ctx.globalAlpha = lamp;
        arrow(300, 660, 350, '#8fe9ff', 'электроны движутся от «−» к «+»');
        arrow(660, 300, 400, '#ffb057', 'условное направление тока: от «+» к «−»');
        ctx.globalAlpha = 1;
      } else { ctx.fillStyle = '#b3c1dd'; ctx.font = '600 15px sans-serif'; ctx.fillText('напряжения нет: электроны движутся беспорядочно', 480, 356); }
    }
  };
});

/* 10 · Сравнение: щелчок по заголовку столбца выделяет тип связи. */
scene(10, () => {
  const cmp = $('#cmp');
  $$('.cmp-head button', cmp).forEach(b => b.addEventListener('click', () => { if (cmp.dataset.c === b.dataset.c) delete cmp.dataset.c; else cmp.dataset.c = b.dataset.c; }));
  return { enter() { delete cmp.dataset.c; } };
});

/* 11 · Водородная связь между молекулами воды. */
scene(11, () => {
  const svg = $('#hbSvg'), txt = $('#hbText'), heatBtn = $('#hbHeat');
  const CX = 640, CY = 258, OH = 71, HB_MAX = 166;
  // [Ox, Oy, угол биссектрисы H–O–H в градусах (ось y направлена вниз)]
  const base = [[0, 0, 90], [163.8, 126.8, 10], [-163.8, 126.8, 170], [133, -158.6, 182.25], [-133, -158.6, -2.25]];
  const HBS = [[0, 0, 1], [0, 1, 2], [3, 0, 0], [4, 1, 0]]; // [молекула-донор, номер её атома H (0 или 1), молекула-акцептор]
  const gH = S('g', {}, svg), gC = S('g', {}, svg), gA = S('g', {}, svg), gL = S('g', {}, svg);
  const mol = base.map((b, i) => ({ b, ph: i * 1.9 + .5, cov: [S('line', { class: 'cov' }, gC), S('line', { class: 'cov' }, gC)],
    o: S('circle', { r: 25, fill: 'url(#g-O)' }, gA), h: [S('circle', { r: 15, fill: 'url(#g-H)' }, gA), S('circle', { r: 15, fill: 'url(#g-H)' }, gA)], P: {} }));
  const hbl = HBS.map(() => S('line', { class: 'hbl' }, gH));
  const dl = [S('text', { 'font-size': 26, 'font-weight': 700, 'text-anchor': 'middle', text: 'δ⁻' }, gL), S('text', { 'font-size': 24, 'font-weight': 700, 'text-anchor': 'middle', text: 'δ⁺' }, gL), S('text', { 'font-size': 24, 'font-weight': 700, 'text-anchor': 'middle', text: 'δ⁺' }, gL)];
  const lc = S('g', { class: 'l-cov' }, gL), lh = S('g', { class: 'l-hb' }, gL);
  S('line', { x1: 36, y1: 52, x2: 92, y2: 52, class: 'cov' }, lc); S('text', { x: 36, y: 86, 'font-size': 21, 'font-weight': 700, text: 'ковалентная связь O–H' }, lc); S('text', { x: 36, y: 112, 'font-size': 17, fill: '#b3c1dd', text: 'внутри молекулы · ≈ 463 кДж/моль' }, lc);
  S('line', { x1: 36, y1: 172, x2: 92, y2: 172, class: 'hbl' }, lh); S('text', { x: 36, y: 206, 'font-size': 21, 'font-weight': 700, text: 'водородная связь' }, lh); S('text', { x: 36, y: 232, 'font-size': 17, fill: '#b3c1dd', text: 'между молекулами · ≈ 20 кДж/моль' }, lh);
  const cnt = S('text', { x: 36, y: 496, 'text-anchor': 'start', 'font-size': 15, class: 't-mono', fill: '#3ef0c8' }, svg);
  let heat = 0, hot = false;
  const TEXT = {
    all: 'Сплошная линия — <b>ковалентная связь</b> O–H внутри молекулы. Пунктир — <b>водородная связь</b> между H&nbsp;одной молекулы и&nbsp;O&nbsp;другой.',
    cov: '<b>Внутри молекулы</b> атомы O&nbsp;и&nbsp;H связаны общими электронными парами. Это ковалентная полярная связь — она и&nbsp;создаёт заряды δ⁺ и&nbsp;δ⁻.',
    hb: '<b>Между молекулами</b> общих электронных пар нет: δ⁺ на&nbsp;водороде притягивается к&nbsp;δ⁻ на&nbsp;кислороде соседа. Это примерно в&nbsp;20&nbsp;раз слабее ковалентной связи.'
  };
  $$('#hbSeg button').forEach(b => b.addEventListener('click', () => { segOn($('#hbSeg'), b); svg.dataset.h = b.dataset.h; txt.innerHTML = TEXT[b.dataset.h]; }));
  heatBtn.addEventListener('click', () => {
    hot = !hot; heatBtn.setAttribute('aria-pressed', hot); heatBtn.textContent = hot ? 'Охладить воду' : 'Нагреть воду';
    if (hot) txt.innerHTML = '<b>Нагрев.</b> Молекулы движутся сильнее — водородные связи рвутся и&nbsp;возникают снова, а&nbsp;связи O–H остаются целыми. Чтобы вода закипела, нужно разорвать почти все водородные связи.';
    else txt.innerHTML = TEXT[svg.dataset.h || 'all'];
  });
  return {
    enter() { hot = false; heat = 0; heatBtn.setAttribute('aria-pressed', false); heatBtn.textContent = 'Нагреть воду'; svg.dataset.h = 'all'; segOn($('#hbSeg'), $('#hbSeg button')); txt.innerHTML = TEXT.all; },
    tick(t, dt) {
      heat = lerp(heat, hot ? 1 : 0, Math.min(1, dt * 2));
      const A = 3 + 24 * heat, D = 3 + 17 * heat, sp = 1 + 2.2 * heat;
      mol.forEach(m => {
        const ox = CX + m.b[0] + D * Math.sin(t * .9 * sp + m.ph), oy = CY + m.b[1] + D * Math.cos(t * .7 * sp + m.ph * 1.6);
        const bis = (m.b[2] + A * Math.sin(t * 1.1 * sp + m.ph * 2.3)) * RAD;
        m.P.o = [ox, oy];
        m.o.setAttribute('cx', ox); m.o.setAttribute('cy', oy);
        [-1, 1].forEach((sg, k) => {
          // k = 0: биссектриса − 52,25°, k = 1: биссектриса + 52,25°
          const an = bis + sg * 52.25 * RAD, hx = ox + OH * Math.cos(an), hy = oy + OH * Math.sin(an);
          m.P['h' + k] = [hx, hy];
          m.h[k].setAttribute('cx', hx); m.h[k].setAttribute('cy', hy);
          const l = m.cov[k]; l.setAttribute('x1', ox); l.setAttribute('y1', oy); l.setAttribute('x2', hx); l.setAttribute('y2', hy);
        });
      });
      let n = 0;
      HBS.forEach((hbd, i) => {
        const hp = mol[hbd[0]].P['h' + hbd[1]], op = mol[hbd[2]].P.o, d = Math.hypot(hp[0] - op[0], hp[1] - op[1]), on = d < HB_MAX;
        const l = hbl[i], ux = (op[0] - hp[0]) / d, uy = (op[1] - hp[1]) / d;
        l.setAttribute('x1', hp[0] + ux * 20); l.setAttribute('y1', hp[1] + uy * 20); l.setAttribute('x2', op[0] - ux * 30); l.setAttribute('y2', op[1] - uy * 30);
        l.style.opacity = on ? '' : 0; if (on) n++;
      });
      const c = mol[0].P;
      dl[0].setAttribute('x', c.o[0]); dl[0].setAttribute('y', c.o[1] - 34);
      dl[1].setAttribute('x', c.h0[0] + 30); dl[1].setAttribute('y', c.h0[1] + 34); dl[2].setAttribute('x', c.h1[0] - 30); dl[2].setAttribute('y', c.h1[1] + 34);
      cnt.textContent = 'ВОДОРОДНЫХ СВЯЗЕЙ СЕЙЧАС: ' + n + ' ИЗ 4 · КОВАЛЕНТНЫХ O–H: 10 ИЗ 10';
    }
  };
});

/* 12 · Конструктор связей. Поддерживаются только сочетания, для которых есть корректная учебная модель. */
scene(12, () => {
  const TASKS = [
    { goal: 'H2', t: 'Соберите молекулу водорода <b>H₂</b> и&nbsp;выберите, что происходит с&nbsp;электронами.' },
    { goal: 'HCl', t: 'Объясните связь в&nbsp;хлороводороде <b>HCl</b>: выберите атомы и&nbsp;механизм.' },
    { goal: 'NaCl', t: 'Покажите, как взаимодействуют <b>Na и&nbsp;Cl</b> при образовании NaCl.' },
    { goal: 'H2O', t: 'Соберите молекулу воды <b>H₂O</b>. Какие связи образует кислород с&nbsp;водородом?' }
  ];
  const COMBO = { 'H,H': ['H2', 'np'], 'Cl,Cl': ['Cl2', 'np'], 'O,O': ['O2', 'np'], 'Cl,H': ['HCl', 'pol'], 'Cl,Na': ['NaCl', 'ion'], 'H,H,O': ['H2O', 'pol'] };
  const OKT = {
    H2: 'Одна общая электронная пара, расположена симметрично. Связь <b>ковалентная неполярная</b>.',
    Cl2: 'Одна общая пара между одинаковыми атомами. Связь <b>ковалентная неполярная</b>.',
    O2: 'Две общие пары между одинаковыми атомами. Связь <b>ковалентная неполярная</b>, двойная.',
    HCl: 'Общая пара смещена к&nbsp;хлору: H&nbsp;δ⁺, Cl&nbsp;δ⁻. Связь <b>ковалентная полярная</b>.',
    NaCl: 'Na отдаёт электрон и&nbsp;становится Na⁺, Cl принимает его и&nbsp;становится Cl⁻. Ионы притягиваются — связь <b>ионная</b>.',
    H2O: 'Две общие пары O–H, обе смещены к&nbsp;кислороду. Связи <b>ковалентные полярные</b>.'
  };
  const WRONG = {
    'np>ion': 'Атомы одинаковые: ни&nbsp;один не&nbsp;притягивает электроны сильнее другого. Электрон не&nbsp;переходит — пара общая.',
    'np>pol': 'Атомы одинаковые, их электроотрицательность равна. Общей паре некуда смещаться.',
    'pol>ion': 'Оба атома — неметаллы. Электрон не&nbsp;переходит полностью: образуется общая пара, смещённая к&nbsp;более электроотрицательному атому.',
    'pol>np': 'Атомы разные: один из&nbsp;них электроотрицательнее и&nbsp;сильнее притягивает общую пару. Пара не&nbsp;может быть посередине.',
    'ion>np': 'Натрий — активный металл, хлор — активный неметалл, разница электроотрицательностей большая (≈&nbsp;2,2). В&nbsp;школьной модели электрон переходит от&nbsp;Na к&nbsp;Cl.',
    'ion>pol': 'Натрий — активный металл, хлор — активный неметалл, разница электроотрицательностей большая (≈&nbsp;2,2). В&nbsp;школьной модели электрон переходит от&nbsp;Na к&nbsp;Cl полностью.'
  };
  const pal = $('#cPalette'), bench = $('#cBench'), mech = $('#cMech'), fb = $('#cFeedback'), svg = $('#cSvg'), nextB = $('#cNext'), checkB = $('#cCheck');
  let ti = 0, atoms = [], m = null, errs = 0, solved = false, finished = false;
  const ph = S('text', { x: 410, y: 186, 'text-anchor': 'middle', 'font-size': 20, fill: '#7586aa' }, svg), root = S('g', {}, svg);
  ['H', 'O', 'Cl', 'Na'].forEach(s => { const b = H('button', 'atom-btn a-' + s, s, pal); b.title = 'Добавить ' + EL[s].name; b.addEventListener('click', () => { if (solved || atoms.length >= 3) return; atoms.push(s); draw(); }); });
  $$('button', mech).forEach(b => b.addEventListener('click', () => { if (solved) return; m = b.dataset.m; segOn(mech, b); }));
  function draw() {
    bench.innerHTML = '';
    if (!atoms.length) H('span', 'ph', 'Рабочая область пуста. Выберите от&nbsp;двух до&nbsp;трёх атомов.', bench);
    atoms.forEach((s, i) => { if (i) H('span', 'plus', '+', bench); const b = H('button', 'atom-btn a-' + s, s, bench); b.title = 'Убрать'; b.addEventListener('click', () => { if (solved) return; atoms.splice(i, 1); draw(); }); });
    if (atoms.length) H('span', 'ph', '← нажмите на&nbsp;атом, чтобы убрать', bench);
  }
  function score() { $('#cScore').innerHTML = '<span>Модель связи</span><span>Очки: <b>' + G.build.score + '</b> / ' + G.build.max + '</span>'; }
  function say(cls, head, text) { fb.className = 'feedback ' + cls; fb.innerHTML = (head ? '<strong>' + head + '</strong>' : '') + text; }
  function clearModel() { cancelTweens('12:'); root.innerHTML = ''; ph.textContent = 'Здесь появится модель связи'; }
  function resetBench() { atoms = []; m = null; solved = false; $$('button', mech).forEach(b => b.classList.remove('on')); draw(); clearModel(); nextB.hidden = true; checkB.disabled = false; say('', '', 'Соберите модель и&nbsp;нажмите «Проверить модель».'); }
  function task() {
    score();
    if (ti >= TASKS.length) {
      finished = true; $('#cTask').innerHTML = '<small>Лаборатория пройдена</small>Результат: <b>' + G.build.score + ' из ' + G.build.max + '</b> очков. Можно собрать модели ещё раз.';
      resetBench(); checkB.disabled = true; nextB.hidden = false; nextB.textContent = 'Начать заново'; say('ok', 'Готово', 'Все четыре задания выполнены.');
      return;
    }
    finished = false; errs = 0; nextB.textContent = 'Следующее задание →';
    $('#cTask').innerHTML = '<small>Задание ' + (ti + 1) + ' из ' + TASKS.length + '</small>' + TASKS[ti].t;
    resetBench();
  }
  function show(key) {
    clearModel(); ph.textContent = '';
    const mdl = lewis(root, key, { x: 410, y: key === 'H2O' ? 190 : 186, s: 1.55 });
    tween(2600, p => mdl.set(p), '12:m');
  }
  checkB.addEventListener('click', () => {
    if (solved || finished) return;
    const key = atoms.slice().sort().join(','), c = COMBO[key];
    if (atoms.length < 2) return say('bad', 'Мало атомов', 'Для связи нужно минимум два атома.');
    if (!c) { errs++; clearModel(); return say('bad', 'Модель не построена', key === 'H,O' ? 'Кислороду до&nbsp;завершения внешнего слоя нужно два электрона — добавьте второй атом H.' : 'Такое сочетание атомов в&nbsp;этом конструкторе не&nbsp;моделируется. Попробуйте другое.'); }
    if (!m) return say('bad', 'Не выбран механизм', 'Укажите, что происходит с&nbsp;электронами (шаг&nbsp;2).');
    if (m !== c[1]) { errs++; clearModel(); return say('bad', 'Ошибка в модели', WRONG[c[1] + '>' + m]); }
    show(c[0]);
    if (c[0] !== TASKS[ti].goal) return say('', 'Модель верная, но задание другое', OKT[c[0]] + ' Теперь соберите то, что указано в&nbsp;задании.');
    const pts = errs ? 5 : 10; G.build.score += pts; G.build.tasks++; solved = true; score();
    say('ok', 'Верно · +' + pts + ' очков', OKT[c[0]]); nextB.hidden = false; checkB.disabled = true;
  });
  $('#cReset').addEventListener('click', () => { if (finished) return; resetBench(); });
  nextB.addEventListener('click', () => { if (finished) { ti = 0; G.build.score = 0; G.build.tasks = 0; } else ti++; task(); });
  task();
  return { enter() { score(); } };
});

/* 13 · Викторина: 10 вопросов, четыре формата. */
scene(13, () => {
  const wrongHCl = '<svg viewBox="0 0 220 130" class="ico"><circle class="ring" cx="80" cy="70" r="30"/><circle class="ring" cx="138" cy="70" r="44"/><circle cx="76" cy="70" r="13" fill="url(#g-H)"/><circle cx="150" cy="70" r="20" fill="url(#g-Cl)"/>' +
    '<circle class="e" cx="103" cy="70" r="4"/><circle class="e" cx="113" cy="70" r="4"/><text x="76" y="71" style="font-size:13px">H</text><text x="150" y="71" style="font-size:14px">Cl</text><text class="lbl" x="76" y="24">δ⁻</text><text class="lbl" x="150" y="14">δ⁺</text></svg>';
  const ART = {
    h2: '<svg viewBox="0 0 220 130" class="ico"><circle class="ring" cx="84" cy="65" r="38"/><circle class="ring" cx="136" cy="65" r="38"/><circle cx="74" cy="65" r="15" fill="url(#g-H)"/><circle cx="146" cy="65" r="15" fill="url(#g-H)"/><circle class="e" cx="105" cy="65" r="4"/><circle class="e" cx="115" cy="65" r="4"/><text x="74" y="66" style="font-size:15px">H</text><text x="146" y="66" style="font-size:15px">H</text></svg>',
    nacl: '<svg viewBox="0 0 220 130" class="ico"><circle class="ring" cx="62" cy="65" r="40"/><circle class="ring" cx="158" cy="65" r="40"/><circle cx="62" cy="65" r="19" fill="url(#g-Na)"/><circle cx="158" cy="65" r="19" fill="url(#g-Cl)"/><text x="62" y="66" style="font-size:14px">Na</text><text x="158" y="66" style="font-size:14px">Cl</text><circle class="e" cx="102" cy="65" r="4.5"/><text class="lbl" x="110" y="34">?</text></svg>',
    h2o: '<svg viewBox="0 0 220 130" class="ico"><line class="cb" x1="110" y1="48" x2="62" y2="92"/><line class="cb" x1="110" y1="48" x2="158" y2="92"/><circle cx="110" cy="48" r="26" fill="url(#g-O)"/><circle cx="60" cy="94" r="16" fill="url(#g-H)"/><circle cx="160" cy="94" r="16" fill="url(#g-H)"/><text x="110" y="49">O</text><text x="60" y="95" style="font-size:14px">H</text><text x="160" y="95" style="font-size:14px">H</text></svg>',
    wire: '<svg viewBox="0 0 220 130" class="ico"><rect x="24" y="44" width="172" height="42" rx="8" fill="rgba(150,180,235,.18)" stroke="rgba(160,200,255,.6)"/><path class="arrow" d="M60 65h96m-8-7l8 7-8 7"/><text class="lbl" x="110" y="112">ток</text><text class="lbl" x="110" y="30">металл</text></svg>',
    pair: '<svg viewBox="0 0 220 130" class="ico"><circle class="ring" cx="84" cy="65" r="38"/><circle class="ring" cx="136" cy="65" r="38"/><circle cx="74" cy="65" r="15" fill="url(#g-M)"/><circle cx="146" cy="65" r="15" fill="url(#g-M)"/><text x="74" y="66" style="font-size:15px">A</text><text x="146" y="66" style="font-size:15px">B</text><ellipse cx="110" cy="65" rx="13" ry="8" fill="rgba(255,255,255,.12)" stroke="#fff" stroke-width="1.3"/><text class="lbl" x="110" y="24">← ? →</text></svg>',
    salt: '<svg viewBox="0 0 220 130" class="ico">' + [0, 1, 2, 3, 4].map(i => [0, 1, 2].map(j => '<circle cx="' + (38 + i * 36) + '" cy="' + (29 + j * 36) + '" r="' + ((i + j) % 2 ? 15 : 10) + '" fill="url(#g-' + ((i + j) % 2 ? 'Cl' : 'Na') + ')"/>').join('')).join('') + '</svg>'
  };
  const Q = [
    { q: 'Какой тип связи в&nbsp;молекуле H₂?', art: ART.h2, o: ['Ковалентная неполярная', 'Ковалентная полярная', 'Ионная', 'Металлическая'], e: 'Атомы одинаковые: общая электронная пара расположена симметрично.', ic: 'cov' },
    { q: 'Что происходит с&nbsp;электроном в&nbsp;модели образования NaCl?', art: ART.nacl, o: ['Атом Na отдаёт электрон атому Cl', 'Атом Cl отдаёт электрон атому Na', 'Na и Cl образуют общую пару поровну', 'Электроны становятся общими для всего кристалла'], e: 'Натрий отдаёт внешний электрон хлору. Получаются ионы Na⁺ и&nbsp;Cl⁻, которые притягиваются.', ic: 'ionic' },
    { q: 'Определите тип связи по&nbsp;модели.', art: icon('metal'), o: ['Металлическая', 'Ионная', 'Ковалентная полярная', 'Водородная'], e: 'Положительные ионы в&nbsp;узлах решётки и&nbsp;общие для всего кристалла электроны — металлическая связь.', ic: 'metal' },
    { q: 'Какая связь соединяет атомы O&nbsp;и&nbsp;H <u>внутри</u> молекулы воды?', art: ART.h2o, o: ['Ковалентная полярная', 'Водородная', 'Ионная', 'Ковалентная неполярная'], e: 'Внутри молекулы — общие электронные пары, смещённые к&nbsp;кислороду. Водородная связь возникает между молекулами.', ic: 'polar' },
    { q: 'Какое взаимодействие показано пунктиром между двумя молекулами воды?', art: icon('hbond'), o: ['Водородная связь', 'Ковалентная связь', 'Ионная связь', 'Металлическая связь'], e: 'Пунктир — водородная связь: притяжение H&nbsp;(δ⁺) одной молекулы к&nbsp;O&nbsp;(δ⁻) другой.', ic: 'hbond' },
    { q: 'Найдите ошибку в&nbsp;модели молекулы HCl.', art: wrongHCl, o: ['Частичные заряды перепутаны местами', 'Общая пара смещена к хлору', 'Между атомами одна общая пара', 'Атом хлора показан крупнее атома водорода'], e: 'Хлор электроотрицательнее и&nbsp;притягивает общую пару, поэтому δ⁻ должен быть на&nbsp;хлоре, а&nbsp;δ⁺ — на&nbsp;водороде.', ic: 'polar' },
    { q: 'Соотнесите вещество и&nbsp;тип связи: перетащите карточки.', art: '<div class="art-row">' + icon('ionic') + icon('cov') + icon('polar') + icon('metal') + '</div>', match: [['Cu', 'Металлическая'], ['NaCl', 'Ионная'], ['Cl₂', 'Ковалентная неполярная'], ['HCl', 'Ковалентная полярная']], e: 'Cu — металл; NaCl — ионы Na⁺ и&nbsp;Cl⁻; Cl₂ — одинаковые атомы; HCl — разные неметаллы.', ic: 'cov' },
    { q: 'Почему металлические проводники обычно хорошо проводят ток?', art: ART.wire, o: ['Делокализованные электроны могут двигаться направленно', 'Положительные ионы свободно перемещаются по металлу', 'Электроны прочно удерживаются каждым атомом', 'Металлы состоят из отдельных молекул'], e: 'Ионы остаются в&nbsp;узлах решётки. Заряд переносят подвижные электроны, общие для всего кристалла.', ic: 'metal' },
    { q: 'Как отличить ковалентную полярную связь от&nbsp;неполярной?', art: ART.pair, o: ['По разнице электроотрицательности атомов', 'По числу атомов в молекуле', 'По агрегатному состоянию вещества', 'По числу общих электронных пар'], e: 'Если электроотрицательность атомов разная, общая пара смещена — связь полярная. Если одинаковая — неполярная.', ic: 'polar' },
    { q: 'Что означает формула NaCl для кристалла поваренной соли?', art: ART.salt, o: ['Соотношение ионов Na⁺ и Cl⁻ равно 1 : 1', 'Кристалл состоит из молекул NaCl', 'Каждый ион Na⁺ связан только с одним ионом Cl⁻', 'В кристалле один атом натрия и один атом хлора'], e: 'В&nbsp;кристалле нет отдельных молекул: каждый ион окружён шестью ионами противоположного знака.', ic: 'ionic' }
  ];
  const root = $('#quiz'), LET = ['A', 'B', 'C', 'D'];
  let qi = 0, res = [];
  function dots(curIdx) { return '<div class="q-dots">' + Q.map((_, i) => '<i class="' + (res[i] === true ? 'ok' : res[i] === false ? 'bad' : i === curIdx ? 'cur' : '') + '"></i>').join('') + '</div>'; }
  function finish(left, right, ok, q, extra) {
    res[qi] = ok; G.quiz.score = res.filter(Boolean).length; G.quiz.total = Q.length;
    right.classList.add('locked');
    const ex = $('.q-exp', left); ex.className = 'q-exp show ' + (ok ? 'ok' : 'bad');
    ex.innerHTML = icon(q.ic) + '<p><strong>' + (ok ? 'Верно' : 'Неверно') + '</strong>' + (extra || '') + q.e + '</p>';
    $('.q-meta b', left).textContent = 'Счёт: ' + G.quiz.score;
    $('.q-dots', left).outerHTML = dots(-1);
    const nb = H('button', 'btn btn-main q-next', qi === Q.length - 1 ? 'Показать результат →' : 'Следующий вопрос →', right);
    nb.addEventListener('click', () => { qi++; if (qi >= Q.length) end(); else render(); });
  }
  function render() {
    const q = Q[qi]; root.innerHTML = '';
    const left = H('div', 'q-left', '<div class="q-meta"><span>Вопрос ' + (qi + 1) + ' из ' + Q.length + '</span><b>Счёт: ' + G.quiz.score + '</b></div>' + dots(qi) + '<div class="q-text">' + q.q + '</div><div class="q-art">' + (q.art || '') + '</div><div class="q-exp"></div>', root);
    const right = H('div', 'q-right', '', root);
    if (q.o) {
      shuffle(q.o.map((t, i) => ({ t, ok: i === 0 }))).forEach((o, i) => {
        const b = H('button', 'opt', '<i>' + LET[i] + '</i><span>' + o.t + '</span>', right); b.dataset.ok = o.ok ? 1 : 0;
        b.addEventListener('click', () => { if (right.classList.contains('locked')) return; b.classList.add(o.ok ? 'ok' : 'bad'); if (!o.ok) $('[data-ok="1"]', right).classList.add('ok'); finish(left, right, o.ok, q); });
      });
    } else matchQ(q, left, right);
  }
  function matchQ(q, left, right) {
    H('div', 'q-hint', 'Перетащите карточку к типу связи — или нажмите на карточку, затем на строку', right);
    const pool = H('div', 'pool', '', right); let sel = null;
    const zones = shuffle(q.match).map(p => { const z = H('div', 'zone', '<span>' + p[1] + '</span><small></small><div class="slot"></div>', right); z.dataset.a = p[0]; return z; });
    const check = H('button', 'btn btn-main q-next', 'Проверить', right); check.disabled = true;
    function place(chip, target) {
      if (target.classList.contains('zone')) { const slot = $('.slot', target), old = $('.dchip', slot); if (old && old !== chip) pool.appendChild(old); slot.appendChild(chip); }
      else pool.appendChild(chip);
      if (sel) sel.classList.remove('sel'); sel = null;
      check.disabled = !!$('.dchip', pool);
    }
    shuffle(q.match).forEach(p => {
      const chip = H('div', 'dchip', p[0], pool); chip.dataset.a = p[0];
      chip.addEventListener('pointerdown', e => {
        if (right.classList.contains('locked')) return;
        e.preventDefault(); const sx = e.clientX, sy = e.clientY; let moved = false;
        try { chip.setPointerCapture(e.pointerId); } catch (err) { /* нет активного указателя */ }
        const mv = ev => { const dx = (ev.clientX - sx) / SCALE, dy = (ev.clientY - sy) / SCALE; if (Math.hypot(dx, dy) > 6) moved = true; if (moved) { chip.classList.add('drag'); chip.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; } };
        const up = ev => {
          chip.removeEventListener('pointermove', mv); chip.removeEventListener('pointerup', up); chip.removeEventListener('pointercancel', up);
          chip.classList.remove('drag'); chip.style.transform = '';
          if (moved) { chip.style.visibility = 'hidden'; const el = document.elementFromPoint(ev.clientX, ev.clientY); chip.style.visibility = ''; const z = el && el.closest('.zone, .pool'); if (z && right.contains(z)) place(chip, z); }
          else { if (sel === chip) { chip.classList.remove('sel'); sel = null; } else { if (sel) sel.classList.remove('sel'); sel = chip; chip.classList.add('sel'); } }
        };
        chip.addEventListener('pointermove', mv); chip.addEventListener('pointerup', up); chip.addEventListener('pointercancel', up);
      });
    });
    zones.concat([pool]).forEach(z => z.addEventListener('click', e => { if (sel && !e.target.closest('.dchip') && !right.classList.contains('locked')) place(sel, z); }));
    check.addEventListener('click', () => {
      let ok = true;
      zones.forEach(z => { const c = $('.dchip', z), good = c && c.dataset.a === z.dataset.a; z.classList.add(good ? 'ok' : 'bad'); if (!good) { ok = false; $('small', z).textContent = 'верно: ' + z.dataset.a; } });
      check.remove(); finish(left, right, ok, q);
    });
  }
  function end() {
    G.quiz.done = true; const s = G.quiz.score, n = Q.length;
    root.innerHTML = '';
    const b = H('div', 'q-end', '<div class="kicker">Результат викторины</div><div class="num">' + s + '<small> / ' + n + '</small></div>' + dots(-1) +
      '<p>' + (s === n ? 'Безупречно. Микромир для вас действительно не&nbsp;тайна.' : s >= 8 ? 'Отличный результат: типы связей вы различаете уверенно.' : s >= 5 ? 'Хорошая основа. Вернитесь к&nbsp;разделам, где были ошибки, и&nbsp;попробуйте ещё раз.' : 'Стоит ещё раз пройти демонстрации — а&nbsp;потом повторить викторину.') + '</p>' +
      '<div class="btn-row"><button class="btn btn-main" id="qAgain">Пройти ещё раз</button><button class="btn" id="qFin">К итогам →</button></div>', root);
    $('#qAgain', b).addEventListener('click', start); $('#qFin', b).addEventListener('click', () => go(14));
  }
  function start() { qi = 0; res = []; G.quiz.score = 0; G.quiz.total = Q.length; G.quiz.done = false; render(); }
  start();
  return {};
});

/* 14 · Финал. */
scene(14, () => {
  const lc = setupCanvas($('#finLattice'), 300, 240, 2), mc = setupCanvas($('#finMetal'), 300, 240, 2);
  const L = makeLattice(3), sim = MetalSim(mc, { cols: 4, rows: 3, sp: 62, x0: 57, y0: 58, r: 15, ne: 22, box: [34, 34, 266, 206], pad: 10, er: 3 });
  const mol = lewis($('#finMol'), 'H2O', { x: 150, y: 128, s: 1.15, delta: false });
  let t0 = 0;
  return {
    enter() {
      t0 = performance.now() / 1000; mol.set(0); tween(2400, p => mol.set(clamp(p * 1.2 - .2)), '14:m');
      let h = '';
      if (G.quiz.done) h += 'Викторина: <b>' + G.quiz.score + ' из ' + G.quiz.total + '</b>';
      else if (G.quiz.total && G.quiz.score) h += 'Викторина не&nbsp;закончена: пока <b>' + G.quiz.score + '</b> верных ответов';
      if (G.build.tasks) h += (h ? ' &nbsp;·&nbsp; ' : '') + 'Конструктор: <b>' + G.build.score + ' из ' + G.build.max + '</b> очков';
      $('#finScore').innerHTML = h || 'Викторина ещё не&nbsp;пройдена — она на&nbsp;предыдущем экране';
    },
    tick(t, dt) {
      lc.clearRect(0, 0, 300, 240); drawLattice(lc, L, 150, 120, 58, t * .4, .45, clamp((t - t0 - .5) / 2.2), false);
      mc.clearRect(0, 0, 300, 240); sim.step(t, dt); sim.draw(t);
    }
  };
});

/* ───────────────────────── 8. ЗАПУСК ───────────────────────── */
let last = performance.now(), warned = false;
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000), t = now / 1000; last = now;
  for (const tw of Array.from(tweens)) {
    if (!tweens.has(tw)) continue;
    if (tw.t0 === null) tw.t0 = now;
    const p = tw.ms <= 0 ? 1 : clamp((now - tw.t0) / tw.ms);
    tw.fn(p);
    if (p >= 1 && tweens.has(tw)) { tweens.delete(tw); tw.res(); }
  }
  try { dust(t, dt); const sc = inst[cur]; if (sc && sc.tick) sc.tick(t, dt); }
  catch (e) { if (!warned) { warned = true; console.error(e); } }
  requestAnimationFrame(frame);
}
const startAt = parseInt((location.hash || '').slice(1), 10);
go(startAt >= 1 && startAt <= N ? startAt - 1 : 0);
requestAnimationFrame(frame);
window.BondLab = { go, next, prev };
})();
