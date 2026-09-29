// ===== Scene renderer: a cut-away "section" view of the lot, the ground, and the house as it is built =====
const Scene = (() => {
  const LW = 1000, LH = 560, G = 384; // logical canvas size and ground line
  let cv, ctx, scale = 1, T = 0, provider = () => null;
  let S = null, geo = null, tr = null;
  const confetti = [];
  const pat = {};

  const C = {
    wood: '#d9b77e', woodEdge: '#a8844f', treated: '#a9b27a', osb: '#c9a563', conc: '#a9a9a3', concDark: '#8b8b85', concLight: '#c2c2bc',
    drywall: '#eeede7', pink: '#f3a5bb', pvc: '#f4f4f4', pexR: '#d9463b', pexB: '#2f7be0', wire: '#f2cf3a', box: '#3a78cf', duct: '#b7c1c9',
    glass: 'rgba(160,205,235,0.72)', asphalt: '#3a3d42', rebar: '#9b4f25',
  };
  const PAINT = { living: '#eadfc8', kitchen: '#f2ecd3', dining: '#dde8d3', laundry: '#dce8ef', master: '#d4e0ee', bath: '#d3edf0', half: '#e4f0dc',
    office: '#e5e0d2', entry: '#ece4d4', stairs: '#e9e3d6', hall: '#ebe6db' };
  const KIDPAINT = ['#d6e6f5', '#d9f0e3', '#e6dcf2', '#f7e0d0', '#f6efc6', '#f5d7df'];

  function init(canvas, prov) {
    cv = canvas; ctx = cv.getContext('2d'); provider = prov;
    makePatterns();
    window.addEventListener('resize', resize);
    resize();
    requestAnimationFrame(loop);
  }
  function resize() {
    const p = cv.parentElement; if (!p) return;
    const w = p.clientWidth, h = p.clientHeight;
    if (!w || !h) return;
    let cw = w, ch = w * LH / LW;
    if (ch > h) { ch = h; cw = h * LW / LH; }
    cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
    scale = cv.width / LW;
  }
  let lastTs = 0;
  function loop(ts) {
    requestAnimationFrame(loop);
    if (ts - lastTs < 32) return;
    lastTs = ts; T = ts / 1000;
    S = provider(); if (!S) return;
    if (cv.width < 10) resize();
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    try { draw(); } catch (e) { console.error(e); }
  }

  // ---------- helpers ----------
  const X = f => geo.hx + f * geo.s;
  const Y = f => G - f * geo.s;
  const A = id => S.amt(id);
  function fill(c) { ctx.fillStyle = c; }
  function R(x0, y0, x1, y1, c) { // feet coords
    const a = X(Math.min(x0, x1)), b = X(Math.max(x0, x1)), t = Y(Math.max(y0, y1)), bt = Y(Math.min(y0, y1));
    ctx.fillStyle = c; ctx.fillRect(a, t, Math.max(b - a, 1), Math.max(bt - t, 1));
  }
  function rect(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
  function poly(pts, c, stroke, lw) {
    ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath();
    if (c) { ctx.fillStyle = c; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
  }
  function line(x0, y0, x1, y1, c, w) { ctx.strokeStyle = c; ctx.lineWidth = w || 1; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
  function L(x0, y0, x1, y1, c, w) { line(X(x0), Y(y0), X(x1), Y(y1), c, w); } // feet coords
  function circ(x, y, r, c) { ctx.beginPath(); ctx.arc(x, y, Math.max(r, 0.5), 0, Math.PI * 2); ctx.fillStyle = c; ctx.fill(); }
  function rr(x, y, w, h, r, c, stroke) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    if (c) { ctx.fillStyle = c; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function text(t, x, y, size, c, align, bold) {
    ctx.font = `${bold ? 'bold ' : ''}${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    ctx.fillStyle = c; ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y);
  }
  function shade(hex, amt) {
    let c = hex.replace('#', ''); if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const n = parseInt(c, 16); let r = n >> 16, g2 = (n >> 8) & 255, b = n & 255;
    r = Math.max(0, Math.min(255, Math.round(r + amt * 255))); g2 = Math.max(0, Math.min(255, Math.round(g2 + amt * 255))); b = Math.max(0, Math.min(255, Math.round(b + amt * 255)));
    return '#' + ((1 << 24) + (r << 16) + (g2 << 8) + b).toString(16).slice(1);
  }
  // progressive reveal: clip left-to-right (or bottom-to-top) in feet coordinates
  function reveal(a, x0, x1, y0, y1, fn, vertical) {
    if (a <= 0) return;
    if (a >= 1) { fn(); return; }
    ctx.save(); ctx.beginPath();
    if (vertical) { const yy = y0 + (y1 - y0) * a; ctx.rect(X(x0) - 30, Y(yy), X(x1) - X(x0) + 60, Y(y0) - Y(yy) + 30); }
    else ctx.rect(X(x0) - 30, Y(y1) - 60, (X(x1) - X(x0)) * a + 30, Y(y0) - Y(y1) + 90);
    ctx.clip(); fn(); ctx.restore();
  }
  // wall area with rectangular holes (feet coords, holes: {x,w,y,h})
  function holeyRect(x0, y0, x1, y1, holes, c) {
    ctx.beginPath();
    ctx.rect(X(x0), Y(y1), X(x1) - X(x0), Y(y0) - Y(y1));
    for (const h of holes) ctx.rect(X(h.x), Y(h.y + h.h), h.w * geo.s, h.h * geo.s);
    ctx.fillStyle = c; ctx.fill('evenodd');
  }

  function makePatterns() {
    const mk = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); return c; };
    const r = new RNG(42);
    pat.osb = mk(48, 48, (c, w, h) => {
      c.fillStyle = C.osb; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 90; i++) { c.fillStyle = r.chance(0.5) ? 'rgba(120,80,30,0.25)' : 'rgba(255,235,180,0.35)'; c.save(); c.translate(r.f(0, w), r.f(0, h)); c.rotate(r.f(0, 3.14)); c.fillRect(-3, -0.6, r.f(3, 8), 1.2); c.restore(); }
    });
    pat.pink = mk(24, 24, (c, w, h) => {
      c.fillStyle = C.pink; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) { c.fillStyle = r.chance(0.5) ? 'rgba(255,220,230,0.6)' : 'rgba(200,110,140,0.35)'; c.beginPath(); c.arc(r.f(0, w), r.f(0, h), r.f(0.8, 2.2), 0, 7); c.fill(); }
    });
    pat.wrap = mk(90, 40, (c, w, h) => {
      c.fillStyle = '#f3f5f7'; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(40,90,170,0.45)'; c.font = 'bold 8px sans-serif'; c.fillText('HOUSE WRAP', 4, 14); c.fillText('HOUSE WRAP', 48, 34);
    });
    pat.concrete = mk(40, 40, (c, w, h) => {
      c.fillStyle = C.conc; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 70; i++) { c.fillStyle = r.chance(0.5) ? 'rgba(80,80,80,0.18)' : 'rgba(255,255,255,0.2)'; c.fillRect(r.f(0, w), r.f(0, h), 1, 1); }
    });
    pat.gravel = mk(30, 30, (c, w, h) => {
      c.fillStyle = '#8e8a82'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) { c.fillStyle = ['#b5b0a6', '#6f6b64', '#a19a8e', '#cfc9bf'][i % 4]; c.beginPath(); c.arc(r.f(0, w), r.f(0, h), r.f(0.8, 2), 0, 7); c.fill(); }
    });
    pat.carpet = mk(8, 8, (c, w, h) => { c.fillStyle = '#b9a891'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(255,255,255,0.15)'; c.fillRect(0, 0, 4, 4); c.fillRect(4, 4, 4, 4); });
  }

  // ---------- geometry for the current plan ----------
  function computeGeo(p, clim) {
    const gW = p.garage ? 22 : 0;
    const totalFt = p.W + gW + 4;
    const s = Math.min(11, 600 / totalFt);
    const blockPx = (p.W + gW) * s;
    const left = 530 - blockPx / 2;
    const hx = left + gW * s;
    const frost = clim.frost;
    const found = p.found;
    const y1 = found === 'slab' ? 0.67 : 2.5;
    const yFW = found === 'slab' ? y1 - 0.33 : y1 - 1;
    let footBot, footTop, floorB = null;
    if (found === 'basement') { floorB = -7; footTop = -7.33; footBot = -8.33; }
    else { footBot = -(frost + 1); footTop = footBot + 1; if (found === 'crawl') floorB = footTop; }
    const wallTop = y1 + 9 * (p.stories - 1) + 8;
    const rise = (p.D / 2) * p.pitch / 12;
    const gTop = 0.33 + 9, gRise = 12 * p.pitch / 12;
    return { s, hx, left, gW, gD: 24, y1, yFW, footBot, footTop, floorB, wallTop, rise, gTop, gRise, W: p.W, D: p.D, frost, found, stories: p.stories };
  }
  const floorY = i => geo.y1 + 9 * i;

  // ================= MAIN DRAW =================
  function draw() {
    tr = new RNG(S.seed || 7);
    const p = S.plan;
    geo = p ? computeGeo(p, S.clim) : { s: 8, hx: 420, left: 420, gW: 0, W: 50, D: 28, frost: S.clim.frost, found: 'slab', y1: 0.67, yFW: 0.34, footBot: -2, footTop: -1, wallTop: 9, rise: 6, stories: 1 };
    drawSky();
    drawBackground();
    drawTrees(true);
    drawGround();
    drawStreet();
    if (p) {
      drawSiltFence();
      drawFoundation();
      drawUnderground();
      drawHouse();
    }
    drawTrees(false);
    drawSiteStuff();
    drawVehicles();
    drawWorkers();
    drawFamilyScene();
    drawCallout();
    drawWeatherFx();
    drawConfetti();
  }

  // ---------- sky & background ----------
  function drawSky() {
    const w = S.weather ? S.weather.type : 'sun';
    const cols = { sun: ['#4f9de6', '#cde6fb'], part: ['#62a3df', '#d6e7f5'], cloud: ['#8ea3b6', '#d7dee5'], rain: ['#5c6c7c', '#a8b4bf'], storm: ['#39434e', '#76828e'], snow: ['#a9b6c3', '#e9eef3'] }[w];
    const gr = ctx.createLinearGradient(0, 0, 0, G);
    gr.addColorStop(0, cols[0]); gr.addColorStop(1, cols[1]);
    rect(0, 0, LW, G, gr);
    if (w === 'sun' || w === 'part') {
      const sx = 860, sy = 80;
      const glow = ctx.createRadialGradient(sx, sy, 10, sx, sy, 110);
      glow.addColorStop(0, 'rgba(255,248,210,0.9)'); glow.addColorStop(1, 'rgba(255,248,210,0)');
      rect(sx - 120, sy - 120, 240, 240, glow);
      circ(sx, sy, 30, '#fff4b8');
    }
    const n = { sun: 3, part: 6, cloud: 10, rain: 12, storm: 12, snow: 10 }[w];
    const ccol = { sun: 'rgba(255,255,255,0.9)', part: 'rgba(255,255,255,0.92)', cloud: 'rgba(235,238,242,0.95)', rain: 'rgba(150,160,170,0.95)', storm: 'rgba(90,98,108,0.97)', snow: 'rgba(225,230,236,0.95)' }[w];
    const cr = new RNG(99);
    for (let i = 0; i < n; i++) {
      const base = cr.f(0, LW + 300), sp = cr.f(4, 10), y = cr.f(30, w === 'sun' ? 140 : 190), sc = cr.f(0.7, 1.5);
      const x = ((base + T * sp) % (LW + 300)) - 150;
      cloud(x, y, sc, ccol);
    }
    if (w === 'storm' && (Math.floor(T * 3) % 23 === 0)) { rect(0, 0, LW, G, 'rgba(255,255,255,0.35)'); }
  }
  function cloud(x, y, sc, c) {
    ctx.fillStyle = c; ctx.beginPath();
    [[0, 0, 22], [20, -10, 26], [44, 0, 20], [24, 8, 22], [-18, 6, 16], [62, 8, 14]].forEach(([dx, dy, r]) => { ctx.moveTo(x + dx * sc + r * sc, y + dy * sc); ctx.arc(x + dx * sc, y + dy * sc, r * sc, 0, 7); });
    ctx.fill();
  }
  function drawBackground() {
    const m = S.month;
    const winter = (m <= 1 || m === 11) && S.climKey === 'north';
    const far = winter ? '#c9d3db' : S.climKey === 'south' ? '#9fbf9a' : '#94b9a3';
    const near = winter ? '#dfe6ea' : seasonalGrass(0.08);
    ctx.fillStyle = far; ctx.beginPath(); ctx.moveTo(0, G);
    for (let x = 0; x <= LW; x += 10) ctx.lineTo(x, G - 105 - Math.sin(x * 0.006 + 1) * 30 - Math.sin(x * 0.017) * 12);
    ctx.lineTo(LW, G); ctx.fill();
    // distant neighbor houses
    const nr = new RNG((S.seed || 1) + 5);
    for (let i = 0; i < 6; i++) {
      const x = nr.f(20, 980), yb = G - 62 - Math.sin(x * 0.006 + 1) * 10, w = nr.f(26, 40), h = nr.f(14, 20);
      rect(x, yb - h, w, h, nr.pick(['#c9c3b6', '#b8c4cc', '#d8cfc0', '#c2b59d']));
      poly([[x - 3, yb - h], [x + w + 3, yb - h], [x + w / 2, yb - h - 10]], nr.pick(['#6b5a4e', '#57606a', '#7a4a3a']));
      rect(x + 4, yb - h + 5, 5, 5, '#8fb1c9'); rect(x + w - 10, yb - h + 5, 5, 5, '#8fb1c9');
    }
    ctx.fillStyle = near; ctx.beginPath(); ctx.moveTo(0, G);
    for (let x = 0; x <= LW; x += 10) ctx.lineTo(x, G - 45 - Math.sin(x * 0.009 + 3) * 16 - Math.sin(x * 0.023) * 6);
    ctx.lineTo(LW, G); ctx.fill();
  }
  function seasonalGrass(d) {
    const m = S.month, k = S.climKey;
    let c = '#6aa84f';
    if (m >= 5 && m <= 7) c = k === 'south' ? '#7aa24d' : '#62a046';
    if (m >= 9 && m <= 10) c = '#8aa352';
    if (m === 11 || m <= 1) c = k === 'south' ? '#7f9f55' : '#9a9a6a';
    return shade(c, d || 0);
  }

  // ---------- trees ----------
  function treeList() {
    const r = new RNG(S.lot ? S.lot.seed : 3);
    const n = S.lot ? S.lot.trees + 3 : 6;
    const list = [];
    for (let i = 0; i < n; i++) list.push({ x: r.f(90, 990), h: r.f(16, 30), pine: r.chance(S.climKey === 'north' ? 0.5 : 0.25), back: r.chance(0.6), seed: r.i(1, 1e6), extra: i >= n - 3 });
    return list;
  }
  function inBuildZone(px) {
    if (!S.plan) return false;
    return px > geo.left - 5 * geo.s && px < X(geo.W) + 14 * geo.s;
  }
  function drawTrees(back) {
    const cleared = A('clear') >= 1 || S.preview || (S.plan && !S.lot.trees);
    const scaleT = S.plan ? Math.min(geo.s, 8) : 8;
    for (const t of treeList()) {
      if (t.back !== back) continue;
      if (t.extra && !S.lot) continue;
      if (cleared && inBuildZone(t.x)) continue;
      if (!cleared && A('clear') > 0 && inBuildZone(t.x) && t.x < 90 + A('clear') * 900) continue;
      tree(t.x, G - (back ? 6 : 0), t.h * scaleT * (back ? 0.85 : 1), t.pine, t.seed, back);
    }
    if (A('landscape') > 0.5 || S.preview) { // new baby trees
      const r = new RNG(77);
      [X(geo.W) + 22 * geo.s, geo.left - 14 * geo.s].forEach((x, i) => { if (x > 70 && x < 990 && back === (i === 1)) tree(x, G, 12 * scaleT, false, r.i(1, 999), false); });
    }
  }
  function tree(x, yb, h, pine, seed, back) {
    const r = new RNG(seed);
    const m = S.month, k = S.climKey;
    const trunkW = h * 0.07;
    if (pine) {
      rect(x - trunkW / 2, yb - h * 0.25, trunkW, h * 0.25, '#5a4030');
      const c1 = back ? '#2f5e3a' : '#2e6b3c';
      for (let i = 0; i < 4; i++) {
        const w = h * (0.42 - i * 0.08), y0 = yb - h * (0.15 + i * 0.2);
        poly([[x - w, y0], [x + w, y0], [x, y0 - h * 0.36]], shade(c1, i * 0.03));
      }
      if (S.weather && S.weather.type === 'snow') poly([[x - h * 0.1, yb - h * 0.8], [x + h * 0.1, yb - h * 0.8], [x, yb - h * 0.95]], '#fff');
      return;
    }
    rect(x - trunkW / 2, yb - h * 0.55, trunkW, h * 0.55, '#6b4a33');
    line(x, yb - h * 0.45, x - h * 0.15, yb - h * 0.62, '#6b4a33', trunkW * 0.5);
    line(x, yb - h * 0.5, x + h * 0.14, yb - h * 0.66, '#6b4a33', trunkW * 0.5);
    const bare = (m === 11 || m <= 1) && k !== 'south';
    if (bare) { line(x, yb - h * 0.55, x, yb - h * 0.95, '#6b4a33', trunkW * 0.4); line(x, yb - h * 0.7, x + h * 0.2, yb - h * 0.85, '#6b4a33', 2); line(x, yb - h * 0.75, x - h * 0.2, yb - h * 0.9, '#6b4a33', 2); return; }
    let cols = ['#3f8a3a', '#4f9c43', '#3a7a36', '#5aa84c'];
    if ((m === 9 || m === 10) && k !== 'south') cols = ['#d9822b', '#c9502c', '#e0b33a', '#b8452a'];
    for (let i = 0; i < 9; i++) {
      const a = r.f(0, Math.PI * 2), d = r.f(0, h * 0.22);
      circ(x + Math.cos(a) * d * 1.2, yb - h * 0.7 + Math.sin(a) * d, h * r.f(0.16, 0.24), back ? shade(r.pick(cols), -0.06) : r.pick(cols));
    }
  }

  // ---------- ground & soil section ----------
  function soilColor() { return { loam: '#7b5a3c', clay: '#9a6a42', sandy: '#b89b68', rocky: '#857565' }[S.lot ? S.lot.soil : 'loam']; }
  function drawGround() {
    const topH = 16;
    const gr = ctx.createLinearGradient(0, G, 0, LH);
    gr.addColorStop(0, '#5b4230'); gr.addColorStop(0.08, soilColor()); gr.addColorStop(0.62, shade(soilColor(), -0.08)); gr.addColorStop(0.63, '#6e6a64'); gr.addColorStop(1, '#5a5751');
    rect(0, G, LW, LH - G, gr);
    rect(0, G, LW, topH, '#56402e');
    // pebbles & rock texture
    const r = new RNG(11);
    for (let i = 0; i < 260; i++) {
      const x = r.f(0, LW), y = r.f(G + 18, LH), rr2 = r.f(1, y > G + 105 ? 5 : 2.6);
      ctx.fillStyle = y > G + 105 ? (r.chance(0.5) ? '#7c7872' : '#4d4a45') : (r.chance(0.5) ? 'rgba(60,40,25,0.35)' : 'rgba(210,190,160,0.25)');
      ctx.beginPath(); ctx.ellipse(x, y, rr2 * 1.3, rr2, r.f(0, 3), 0, 7); ctx.fill();
    }
    if (S.lot && S.lot.soil === 'rocky') for (let i = 0; i < 18; i++) { const x = r.f(0, LW), y = r.f(G + 25, G + 100); ctx.fillStyle = '#8d8b86'; ctx.beginPath(); ctx.ellipse(x, y, r.f(4, 10), r.f(3, 7), 0, 0, 7); ctx.fill(); }
    // roots under trees
    // grass / dirt surface
    const disturbed = S.plan && !S.preview && A('excavate') > 0 && A('landscape') < 1;
    const sod = A('landscape');
    rect(0, G - 3, LW, 5, seasonalGrass());
    if (disturbed) {
      const x0 = geo.left - 12 * geo.s, x1 = X(geo.W) + 16 * geo.s;
      rect(x0, G - 2, x1 - x0, 6, '#6d5038');
      for (let i = 0; i < 40; i++) circ(r.f(x0, x1), G - 1 + r.f(0, 3), r.f(1, 2.5), '#5a412d');
    }
    if (sod > 0 && !S.preview) {
      const x0 = geo.left - 12 * geo.s, x1 = X(geo.W) + 16 * geo.s;
      rect(x0, G - 3, (x1 - x0) * sod, 5, '#58a83e');
    }
    // grass blades
    ctx.strokeStyle = seasonalGrass(0.06); ctx.lineWidth = 1.2; ctx.beginPath();
    for (let x = 0; x < LW; x += 5) {
      if (disturbed && x > geo.left - 12 * geo.s && x < X(geo.W) + 16 * geo.s && sod < 1) continue;
      const h = 3 + ((x * 7) % 5); ctx.moveTo(x, G - 1); ctx.lineTo(x + 1.5, G - 1 - h);
    }
    ctx.stroke();
    if (S.weather && S.weather.type === 'snow') rect(0, G - 5, LW, 5, '#f4f7fa');
    // frost line
    const fy = G + geo.frost * geo.s;
    ctx.setLineDash([6, 5]); line(70, fy, LW, fy, 'rgba(170,220,255,0.85)', 1.5); ctx.setLineDash([]);
    text('❄ frost line ' + geo.frost + ' ft', LW - 8, fy + 8, 10, 'rgba(210,235,255,0.95)', 'right', true);
  }

  function drawStreet() {
    rect(0, G - 2, 64, 8, C.asphalt);
    rect(0, G + 6, 64, 10, '#6e6a62');
    for (let x = 4; x < 64; x += 18) rect(x, G - 1, 8, 1.5, '#e8d36a');
    rect(64, G - 6, 6, 12, '#c8c6c0'); // curb
    rect(70, G - 3, 20, 4, '#d0cec8'); // sidewalk
    // city utilities under the street (pipes running along the street)
    if (S.lot && S.lot.water !== 'well') { circ(22, G + 4.5 * 8, 7, '#2f6fd0'); circ(22, G + 4.5 * 8, 4, '#1b3d72'); }
    if (S.lot && S.lot.sewer === 'city') { circ(42, G + 8 * 8, 9, '#3f8f4a'); circ(42, G + 8 * 8, 6, '#204d27'); }
    circ(48, G + 3 * 8, 5, '#e6c229'); circ(10, G + 3.5 * 8, 4, '#d0402f'); circ(56, G + 2 * 8, 3.5, '#ef7f1a');
    if (A('call811') > 0.5 || (S.plan && S.done('call811'))) {
      const alive = !S.done('landscape');
      if (alive) {
        [['#e6c229', 80], ['#d0402f', 96], ['#2f6fd0', 112], ['#ef7f1a', 128], ['#3f8f4a', 144]].forEach(([c, x], i) => {
          if (i === 2 && S.lot.water === 'well') return; if (i === 4 && S.lot.sewer !== 'city') return;
          line(x, G, x, G - 16, '#555', 1); poly([[x, G - 16], [x + 8, G - 13], [x, G - 10]], c);
          ctx.setLineDash([4, 3]); line(x - 6, G - 1, x + 6, G - 1, c, 2); ctx.setLineDash([]);
        });
      }
    }
  }

  // ---------- silt fence (behind house) ----------
  function drawSiltFence() {
    const a = A('silt'); if (a <= 0 || S.preview || S.done('landscape')) return;
    const x0 = geo.left - 10 * geo.s, x1 = X(geo.W) + 14 * geo.s;
    const xe = x0 + (x1 - x0) * a;
    rect(x0, G - 14, xe - x0, 12, '#1f1f22');
    for (let x = x0; x < xe; x += 40) rect(x, G - 18, 3, 18, '#8a6a45');
  }

  // ---------- excavation & foundation ----------
  function drawFoundation() {
    const g0 = geo, W = g0.W, found = g0.found;
    const dig = S.preview ? 1 : A('excavate');
    const bf = S.preview ? 1 : A('backfill');
    const dirt = '#3d2b1f', far = '#4a3526';
    // hole(s)
    if (dig > 0) {
      if (found === 'basement') {
        const d = g0.footBot * dig;
        poly([[X(-4), Y(0)], [X(W + 4), Y(0)], [X(W + 1.5), Y(d)], [X(-1.5), Y(d)]], far);
        const gr = ctx.createLinearGradient(0, Y(0), 0, Y(d)); gr.addColorStop(0, 'rgba(0,0,0,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        poly([[X(-4), Y(0)], [X(W + 4), Y(0)], [X(W + 1.5), Y(d)], [X(-1.5), Y(d)]], gr);
      } else {
        if (found === 'crawl') { const d = g0.footTop * dig; R(-1, 0, W + 1, d, far); }
        const d = g0.footBot * dig;
        [[-2, 2], [W - 2, W + 2]].forEach(([a, b]) => poly([[X(a - 0.8), Y(0)], [X(b + 0.8), Y(0)], [X(b), Y(d)], [X(a), Y(d)]], dirt));
      }
      if (g0.gW) { const d = g0.footBot * dig; [[-g0.gW - 2, -g0.gW + 2]].forEach(([a, b]) => poly([[X(a - 0.8), Y(0)], [X(b + 0.8), Y(0)], [X(b), Y(d)], [X(a), Y(d)]], dirt)); }
      // dirt pile
      const pile = dig * (1 - bf) * (found === 'basement' ? 1 : 0.5);
      if (pile > 0.02 && !S.preview) {
        const px = X(W) + 7 * g0.s, ph = 60 * pile, pw = 90 * Math.sqrt(pile) + 20;
        poly([[px, G], [px + pw / 2, G - ph], [px + pw, G]], '#6d4c33');
        const r = new RNG(5); for (let i = 0; i < 14; i++) circ(px + r.f(10, pw - 10), G - r.f(2, ph * 0.6), 2, '#4e3524');
      }
    }
    // footings
    const footXs = [[-0.67, 1.33], [W - 1.33, W + 0.67]];
    if (g0.gW) footXs.push([-g0.gW - 0.67, -g0.gW + 1.33]);
    const fa = S.preview ? 1 : A('forms'), pa = S.preview ? 1 : A('pourFoot');
    if (fa > 0 && pa < 1 && !S.preview) {
      reveal(fa, -g0.gW - 2, W + 2, g0.footBot - 1, 0, () => {
        footXs.forEach(([a, b]) => {
          R(a - 0.15, g0.footBot, a, g0.footTop + 0.2, '#a0763f'); R(b, g0.footBot, b + 0.15, g0.footTop + 0.2, '#a0763f');
          [[a + 0.5, g0.footBot + 0.35], [b - 0.5, g0.footBot + 0.35], [a + 0.5, g0.footBot + 0.7], [b - 0.5, g0.footBot + 0.7]].forEach(([x, y]) => circ(X(x), Y(y), Math.max(1.5, 0.12 * g0.s), C.rebar));
        });
        // back footing rebar lines
        L(1.33, g0.footBot + 0.35, W - 1.33, g0.footBot + 0.35, C.rebar, 2); L(1.33, g0.footBot + 0.7, W - 1.33, g0.footBot + 0.7, C.rebar, 2);
      });
    }
    if (pa > 0) {
      reveal(pa, -g0.gW - 2, W + 2, g0.footBot - 1, 0, () => {
        ctx.fillStyle = pat.concrete;
        R(1.33, g0.footBot, W - 1.33, g0.footTop, C.concDark);
        footXs.forEach(([a, b]) => { R(a, g0.footBot, b, g0.footTop, C.conc); L(a, g0.footTop, b, g0.footTop, C.concDark, 1); });
      });
    }
    // under-slab plumbing
    if (found === 'slab' && (A('underslab') > 0 || S.preview)) {
      reveal(S.preview ? 1 : A('underslab'), 0, W, -3, 1, () => {
        const xs = wetXs(0);
        L(-1, -1.2, W * 0.9, -0.6, '#e9e9e9', Math.max(3, 0.33 * g0.s));
        xs.forEach(x => L(x, -0.8, x, g0.y1 + 0.4, '#e9e9e9', Math.max(3, 0.3 * g0.s)));
      });
    }
    // foundation walls / slab
    const wa = S.preview ? 1 : A('fwalls');
    if (wa > 0) {
      reveal(wa, -g0.gW - 2, W + 2, g0.footBot, g0.y1 + 1, () => {
        const t = 0.67;
        if (found === 'basement' || found === 'crawl') {
          ctx.save(); ctx.fillStyle = pat.concrete;
          R(t, g0.floorB, W - t, g0.yFW, C.concLight);
          // form-tie dots on back wall
          for (let x = 2; x < W - 1; x += 2) for (let y = g0.floorB + 1; y < g0.yFW - 0.3; y += 2) circ(X(x), Y(y), 1, '#9b9b95');
          ctx.restore();
          R(0, g0.footTop, t, g0.yFW, C.conc); R(W - t, g0.footTop, W, g0.yFW, C.conc);
          if (found === 'basement') { R(t, g0.floorB - 0.33, W - t, g0.floorB, '#b4b4ae'); L(t, g0.floorB, W - t, g0.floorB, '#8f8f89', 1); }
          else { R(t, g0.floorB, W - t, g0.floorB + 0.08, '#1e1f22'); }
        } else {
          // stem walls + gravel + slab
          R(0, g0.footTop, t, g0.y1 - 0.33, C.conc); R(W - t, g0.footTop, W, g0.y1 - 0.33, C.conc);
          ctx.fillStyle = pat.gravel; ctx.fillRect(X(t), Y(g0.y1 - 0.33), X(W - t) - X(t), (g0.y1 - 0.33) * g0.s);
          R(t, g0.y1 - 0.36, W - t, g0.y1 - 0.33, '#2a6fb0');
          R(0, g0.y1 - 0.33, W, g0.y1, C.conc); L(0, g0.y1, W, g0.y1, C.concDark, 1);
        }
        if (g0.gW) { // garage stem walls + slab
          R(-g0.gW, g0.footTop, -g0.gW + t, 0.33, C.conc);
          if (found === 'slab') { } else R(-t, g0.footTop, 0, 0.33, C.conc);
          R(-g0.gW, 0, 0, 0.33, '#b3b3ad'); L(-g0.gW, 0.33, 0, 0.33, C.concDark, 1);
        }
        // anchor bolts
        if (!S.done('deck')) for (let x = 0.33; x < W; x += 6) L(x, g0.yFW, x, g0.yFW + 0.5, '#555', 2);
      });
    }
    // waterproofing + drain tile + gravel
    const wp = S.preview ? 1 : A('waterproof');
    if (wp > 0 && found !== 'slab') {
      reveal(wp, -2, W + 2, g0.footBot, 1, () => {
        R(-0.12, g0.footTop, 0, 0, '#141414'); R(W, g0.footTop, W + 0.12, 0, '#141414');
        [[-1, g0.footTop + 0.5], [W + 1, g0.footTop + 0.5]].forEach(([x, y]) => { circ(X(x), Y(y), Math.max(3, 0.3 * g0.s), '#222'); circ(X(x), Y(y), Math.max(1.5, 0.15 * g0.s), '#555'); });
        ctx.fillStyle = pat.gravel;
        ctx.fillRect(X(-2), Y(g0.footTop + 1.4), 1.8 * g0.s, 1.4 * g0.s);
        ctx.fillRect(X(W + 0.2), Y(g0.footTop + 1.4), 1.8 * g0.s, 1.4 * g0.s);
      });
    }
    // backfill
    if (bf > 0 && dig > 0) {
      const col = shade(soilColor(), -0.05);
      const fillTo = (d0) => d0 + (0 - d0) * bf;
      if (found === 'basement') {
        const top = fillTo(g0.footBot);
        poly([[X(-4 + 2.5 * (1 - (top - g0.footBot) / -g0.footBot)), Y(top)], [X(-0.12), Y(top)], [X(-0.12), Y(g0.footBot)], [X(-1.5), Y(g0.footBot)]], col);
        poly([[X(W + 0.12), Y(top)], [X(W + 4 - 2.5 * (1 - (top - g0.footBot) / -g0.footBot)), Y(top)], [X(W + 1.5), Y(g0.footBot)], [X(W + 0.12), Y(g0.footBot)]], col);
        if (wp > 0) { ctx.fillStyle = pat.gravel; ctx.fillRect(X(-2), Y(g0.footTop + 1.4), 1.8 * g0.s, 1.4 * g0.s); ctx.fillRect(X(W + 0.2), Y(g0.footTop + 1.4), 1.8 * g0.s, 1.4 * g0.s); }
      } else {
        const top = fillTo(g0.footBot);
        const pieces = [[-2.8, -0.12], [W + 0.12, W + 2.8], [0.67, 2.8], [W - 2.8, W - 0.67]];
        if (g0.gW) pieces.push([-g0.gW - 2.8, -g0.gW], [-g0.gW + 0.67, -g0.gW + 2.8]);
        pieces.forEach(([a, b]) => R(a, g0.footTop - (found === 'crawl' ? 0 : 0), b, Math.min(top, 0), col));
        if (found === 'crawl') R(0.67, g0.footTop, 2.8, Math.min(top, g0.footTop), col);
      }
      if (bf >= 1) { rect(X(-4), G - 1, X(W + 4) - X(-4), 3, '#6d5038'); }
    }
  }

  // x positions (feet) of wet walls on a floor (for pipes)
  function wetXs(i) {
    const f = S.plan.floors[i]; if (!f) return [];
    return f.back.filter(r => ['bath', 'half', 'kitchen', 'laundry'].includes(r.type)).map(r => r.x + 1.2);
  }

  // ---------- underground utilities, well, septic ----------
  function drawUnderground() {
    const g0 = geo, W = g0.W;
    const ua = S.preview ? 1 : A('utilities');
    const houseL = -g0.gW;
    if (ua > 0) reveal(ua, -80, W + 60, -12, 2, () => {
      const pipeW = Math.max(3, 0.3 * g0.s);
      if (S.lot.water === 'city') { const y = G + (g0.frost + 0.8) * g0.s; line(22, G + 36, 22, y, '#2f6fd0', pipeW); line(22, y, X(0.5), y, '#2f6fd0', pipeW); }
      if (S.lot.sewer === 'city') { const y0 = G + 8 * 8, y1 = G + Math.min(7, g0.frost + 2) * g0.s; line(42, y0, X(0.5), y1, '#3f8f4a', pipeW + 1); }
      ctx.setLineDash([6, 4]); line(10, G + 28, X(houseL) , G + 2.5 * g0.s, '#d0402f', 2); ctx.setLineDash([]);
      // meter on the house side
      if (!S.preview || true) { const mx = X(houseL) - 6; rect(mx - 4, Y(4.5), 8, 10, '#9aa3ab'); circ(mx, Y(4.2), 2.5, '#dfe7ec'); }
    });
    // well
    if (S.lot.water === 'well') {
      const wa = S.preview ? 1 : A('well');
      if (wa > 0) {
        const wx = X(W) + 26 * g0.s;
        if (wx < LW - 10) {
          const depth = (LH - G) * wa;
          line(wx, G, wx, G + depth, '#7f8c8d', 5); line(wx, G, wx, G + depth, '#bdc3c7', 2);
          if (wa >= 1) { rect(wx - 4, G - 10, 8, 10, '#95a5a6'); rect(wx - 5, G - 12, 10, 3, '#7f8c8d'); text('💧 well', wx, G + depth - 10 > LH - 8 ? LH - 10 : G + depth - 10, 10, '#dff', 'center', true); }
          if (S.done('utilities') || S.preview) line(wx, G + (g0.frost + 0.8) * g0.s, X(W - 0.5), G + (g0.frost + 0.8) * g0.s, '#2f6fd0', 3);
        }
      }
    }
    // septic
    if (S.lot.sewer === 'septic') {
      const sa = S.preview ? 1 : A('septic');
      if (sa > 0) reveal(sa, W, W + 40, -10, 1, () => {
        const tx = X(W) + 8 * g0.s, ty = G + 3 * g0.s;
        rr(tx, ty, 9 * g0.s, 5 * g0.s, 6, '#8d8f93'); rr(tx + 2, ty + 2, 9 * g0.s - 4, 5 * g0.s - 4, 5, '#6d6f73');
        text('septic tank', tx + 4.5 * g0.s, ty + 2.5 * g0.s, 9, '#fff', 'center', true);
        rect(tx + 2 * g0.s, G - 3, 8, 3 + 3 * g0.s, '#27ae60');
        line(X(W - 0.5), G + 2.2 * g0.s, tx, ty + 1 * g0.s, '#3f8f4a', 4);
        ctx.setLineDash([3, 3]); for (let k = 0; k < 3; k++) line(tx + 9 * g0.s, ty + 1.5 * g0.s + k * 6, Math.min(LW, tx + 30 * g0.s), ty + 2.5 * g0.s + k * 6, '#b6d7a8', 2); ctx.setLineDash([]);
      });
    }
  }

  // ================= HOUSE =================
  function frontOps(i) {
    const f = S.plan.floors[i];
    const ops = f.frontWin.map(w => ({ x: w.x, w: w.w, y: w.sill, h: w.h }));
    if (i === 0) ops.push({ x: S.plan.door - 1.5, w: 3, y: 0, h: 6.8, door: true });
    return ops;
  }
  function backOps(i) {
    const f = S.plan.floors[i];
    const ops = f.backWin.map(w => ({ x: w.x, w: w.w, y: w.sill, h: w.h }));
    if (i === 0) { const r = f.back.find(x => x.type === 'dining') || f.back.find(x => x.type === 'laundry'); if (r) ops.push({ x: r.x + r.w - 3.8, w: 3, y: 0, h: 6.8, door: true }); }
    return ops;
  }
  function wallsId(i) { return i === 0 ? 'walls1' : 'walls2'; }
  function stud(xf, y0, y1, c) {
    const x = X(xf), w = Math.max(1.6, 0.125 * geo.s);
    rect(x, Y(y1), w, Y(y0) - Y(y1), c || C.wood);
    rect(x + w - 0.6, Y(y1), 0.6, Y(y0) - Y(y1), C.woodEdge);
  }
  // Wall framing: plates, studs every 16", openings with headers, sills & cripples
  function frameWall(yb, x0, x1, ops, h) {
    h = h || 8;
    R(x0, yb, x1, yb + 0.125, C.treated === undefined ? C.wood : C.wood);
    R(x0, yb + h - 0.25, x1, yb + h, C.wood); L(x0, yb + h - 0.125, x1, yb + h - 0.125, C.woodEdge, 0.7);
    const inOp = x => ops.some(o => x > o.x - 0.3 && x < o.x + o.w + 0.15);
    for (let x = x0; x < x1 - 0.1; x += 1.333) if (!inOp(x)) stud(x, yb + 0.125, yb + h - 0.25);
    stud(x1 - 0.14, yb + 0.125, yb + h - 0.25);
    for (const o of ops) {
      const top = o.y + o.h;
      stud(o.x - 0.28, yb + 0.125, yb + h - 0.25); stud(o.x + o.w + 0.14, yb + 0.125, yb + h - 0.25);
      stud(o.x - 0.14, yb + 0.125, yb + top); stud(o.x + o.w, yb + 0.125, yb + top);
      R(o.x - 0.14, yb + top, o.x + o.w + 0.14, yb + top + 0.9, C.woodEdge);
      L(o.x - 0.14, yb + top + 0.45, o.x + o.w + 0.14, yb + top + 0.45, '#8a6a3f', 0.8);
      for (let x = Math.ceil(o.x / 1.333) * 1.333; x < o.x + o.w - 0.1; x += 1.333) {
        if (top + 0.9 < h - 0.3) stud(x, yb + top + 0.9, yb + h - 0.25);
        if (!o.door) stud(x, yb + 0.125, yb + o.y - 0.14);
      }
      if (!o.door) R(o.x, yb + o.y - 0.14, o.x + o.w, yb + o.y, C.wood);
    }
  }

  function drawHouse() {
    const p = S.plan, g0 = geo;
    const view = S.view;
    // floor deck (first floor)
    drawDeck();
    // basement / crawl interior items
    drawLowerLevel();
    // interior of every floor (always drawn — the front wall covers it in "outside" view)
    for (let i = 0; i < p.stories; i++) drawInterior(i);
    if (p.stories > 1) drawFloorBand(1);
    if (g0.gW) drawGarageInterior();
    drawRoof(view);
    if (g0.gW) drawGarageRoof(view);
    if (view === 'out') {
      for (let i = 0; i < p.stories; i++) drawFrontWall(i);
      if (g0.gW) drawGarageFront();
      drawFoundationFace();
    } else {
      for (let i = 0; i < p.stories; i++) drawEndWalls(i);
      if (g0.gW) drawGarageEnds();
    }
    drawRoofFront(view);
    drawExteriorExtras();
  }

  function drawDeck() {
    const g0 = geo, W = g0.W, a = S.preview ? 1 : A('deck');
    if (a <= 0) return;
    reveal(a, 0, W, g0.yFW, g0.y1, () => {
      if (g0.found === 'slab') { R(0, g0.y1, W, g0.y1 + 0.12, C.treated); return; }
      R(0, g0.yFW, W, g0.yFW + 0.12, C.treated);
      if (S.view === 'in') {
        R(0, g0.yFW + 0.12, W, g0.y1 - 0.07, 'rgba(40,30,20,0.55)');
        for (let x = 0; x < W - 0.2; x += 1.333) R(x, g0.yFW + 0.12, x + 0.16, g0.y1 - 0.07, C.wood);
        R(0, g0.yFW + 0.12, 0.12, g0.y1 - 0.07, C.wood); R(W - 0.12, g0.yFW + 0.12, W, g0.y1 - 0.07, C.wood);
      } else { R(0, g0.yFW + 0.12, W, g0.y1 - 0.07, C.wood); L(0, g0.yFW + 0.5, W, g0.yFW + 0.5, C.woodEdge, 0.5); }
      ctx.fillStyle = pat.osb; ctx.fillRect(X(0), Y(g0.y1), W * g0.s, Math.max(2, 0.07 * g0.s));
    });
  }
  function drawFloorBand(i) { // floor system between stories
    const g0 = geo, W = g0.W, a = S.preview ? 1 : A('floor2');
    if (a <= 0) return;
    const yt = floorY(i), yb = yt - 1;
    reveal(a, 0, W, yb, yt, () => {
      if (S.view === 'in') {
        R(0, yb, W, yt - 0.07, 'rgba(40,30,20,0.6)');
        for (let x = 0; x < W - 0.2; x += 1.333) R(x, yb, x + 0.16, yt - 0.07, C.wood);
        // ducts in the floor system (slab houses feed the first floor from here)
        if ((S.preview || A('hvacRough') > 0) && g0.found === 'slab') R(2, yb + 0.15, W - 2, yb + 0.75, C.duct);
        if (A('drywallHang') >= 1 || S.preview) R(0, yb, W, yb + 0.06, C.drywall);
      } else R(0, yb, W, yt - 0.07, C.wood);
      ctx.fillStyle = pat.osb; ctx.fillRect(X(0), Y(yt), W * g0.s, Math.max(2, 0.07 * g0.s));
    });
  }

  function furnaceLoc() {
    const p = S.plan, g0 = geo;
    if (g0.found === 'basement') return { where: 'basement', x: Math.min(p.W - 4, 5), y: g0.floorB };
    if (g0.gW) return { where: 'garage', x: -3.2, y: 0.33 };
    const f0 = p.floors[0].back.find(r => r.type === 'laundry') || p.floors[0].back[0];
    return { where: 'laundry', x: f0.x + f0.w - 2.6, y: g0.y1 };
  }

  function drawLowerLevel() {
    const g0 = geo, W = g0.W;
    if (g0.found === 'slab') return;
    const yB = g0.floorB, yTop = g0.yFW;
    // HVAC trunk hanging below the first floor
    if (S.preview || A('hvacRough') > 0) {
      reveal(S.preview ? 1 : A('hvacRough'), 0, W, yB, yTop, () => {
        const ty = g0.found === 'basement' ? yTop - 1.1 : Math.max(yB + 0.3, yTop - 1);
        R(1.5, ty, W - 1.5, ty + 0.8, C.duct); for (let x = 3; x < W - 2; x += 4) L(x, ty, x, ty + 0.8, '#9aa6af', 1);
        S.plan.floors[0].back.forEach(r => { const x = r.x + r.w * 0.7; R(x - 0.3, ty + 0.8, x + 0.3, g0.y1, '#d0d6db'); });
      });
    }
    // drain pipes going down / main water entering
    if (S.preview || A('plumbRough') > 0) {
      const xs = wetXs(0).concat(S.plan.stories > 1 ? wetXs(1) : []);
      xs.forEach(x => L(x, yB + 0.2, x, g0.y1, C.pvc, Math.max(3, 0.3 * g0.s)));
      if (xs.length) L(0.7, yB + 0.4, Math.max(...xs), yB + 0.6, C.pvc, Math.max(3, 0.3 * g0.s));
      L(0.7, g0.frost > 2 ? yB + 1.2 : yB + 0.8, 4, yB + 1.2, C.pexB, 2);
    }
    if (g0.found !== 'basement') return;
    // basement stairs (under first-floor stairs, or at left)
    const st = S.plan.floors[0].back.find(r => r.type === 'stairs');
    const sx0 = st ? st.x : 1, sx1 = st ? st.x + st.w : 12;
    if (S.preview || A('deck') >= 1) drawStairs(sx0 + 0.5, sx1 - 0.5, yB, g0.y1, A('trim') >= 1 || S.preview);
    // electrical panel + furnace + water heater + sump pit
    if (S.preview || A('elecRough') > 0) { R(W - 3, yB + 4, W - 1.8, yB + 6.5, '#9aa3ab'); for (let k = 0; k < 4; k++) L(W - 2.8 + k * 0.25, yB + 6.5, W - 2.8 + k * 0.25, g0.yFW, C.wire, 1); }
    const fl = furnaceLoc();
    if (fl.where === 'basement') drawMechanicals(fl.x, fl.y);
    if (S.preview || A('fwalls') >= 1) { R(W - 6, yB - 0.3, W - 4.5, yB, '#222'); }
    if (S.furnish) { // storage boxes
      [[W - 12, 0], [W - 10.4, 0], [W - 11.2, 1.3]].forEach(([x, y]) => { R(x, yB + y, x + 1.5, yB + y + 1.3, '#c89f67'); L(x, yB + y + 0.65, x + 1.5, yB + y + 0.65, '#a57e4c', 1); });
    }
  }
  function drawMechanicals(x, y) {
    // furnace (after hvacFin), water heater (after plumbFin), plenum (hvacRough)
    if (S.preview || A('hvacRough') > 0) R(x + 0.2, y + 4.2, x + 2.2, y + 6.5, C.duct);
    if (S.preview || A('hvacFin') >= 1) {
      R(x, y, x + 2.4, y + 4.2, '#d9dde0'); R(x + 0.3, y + 0.4, x + 2.1, y + 1.9, '#c3c9cd'); R(x + 0.3, y + 2.2, x + 2.1, y + 3.9, '#c3c9cd');
      text('🔥', X(x + 1.2), Y(y + 1.2), Math.max(8, geo.s * 0.9), '#e67e22');
    }
    if (S.preview || A('plumbFin') >= 1) {
      rr(X(x + 2.8), Y(y + 5), 1.9 * geo.s, 5 * geo.s, 5, '#ecf0f1', '#aab');
      L(x + 3.3, y + 5, x + 3.3, y + 6.5, C.pexR, 2); L(x + 4.2, y + 5, x + 4.2, y + 6.5, C.pexB, 2);
    }
  }

  function roomPaint(rm, i) {
    if (rm.type === 'bed') { const k = (rm.name.length + i + (S.seed || 0)) % KIDPAINT.length; return KIDPAINT[k]; }
    return PAINT[rm.type] || '#eee';
  }

  // ---------- interior of one floor (seen through the cut) ----------
  function drawInterior(i) {
    const p = S.plan, g0 = geo, W = g0.W;
    const yb = floorY(i), yt = yb + 8;
    const aw = S.preview ? 1 : A(wallsId(i));
    if (aw <= 0) return;
    const ops = backOps(i);
    const holes = ops.map(o => ({ x: o.x, w: o.w, y: yb + o.y, h: o.h }));
    const pv = S.preview;
    const aS = pv ? 1 : A('sheathing'), aI = pv ? 1 : A('insulation'), aDH = pv ? 1 : A('drywallHang'), aDF = pv ? 1 : A('drywallFin'), aP = pv ? 1 : A('paint');
    reveal(aw, 0, W, yb, yt, () => {
      // back of the house: sheathing seen from inside
      reveal(aS, 0, W, yb, yt, () => { ctx.fillStyle = pat.osb; holeyRect(0, yb, W, yt, holes, pat.osb); });
      if (aS <= 0) holeyRect(0, yb, W, yt, holes, 'rgba(255,255,255,0.08)');
      reveal(aI, 0, W, yb, yt, () => holeyRect(0, yb, W, yt, holes, pat.pink));
      frameWall(yb, 0, W, ops);
      if (aI > 0 && aDH < 1) reveal(aI, 0, W, yb, yt, () => { for (let x = 0.2; x < W; x += 1.333) R(x - 0.3, yb + 0.2, x - 0.05, yt - 0.3, 'rgba(243,165,187,0.35)'); });
      // MEP rough-in
      drawRoughIn(i, yb, yt);
      // drywall
      reveal(aDH, 0, W, yb, yt, () => {
        holeyRect(0, yb, W, yt, holes, C.drywall);
        if (aDF < 1) {
          for (let x = 12; x < W; x += 12) L(x, yb, x, yt, aDF > 0 ? '#fafaf7' : '#d6d4cc', aDF > 0 ? 3 : 1);
          L(0, yb + 4, W, yb + 4, aDF > 0 ? '#fafaf7' : '#d6d4cc', aDF > 0 ? 3 : 1);
          const rr3 = new RNG(i + 3);
          if (aDF > 0) for (let k = 0; k < W * 1.5; k++) { const x = rr3.f(0, W), y = rr3.f(yb + 0.5, yt - 0.5); if (x < W * aDF + 0.5) circ(X(x), Y(y), Math.max(1.5, 0.2 * g0.s), '#fbfbf9'); }
          else for (let x = 0.6; x < W; x += 1.333) for (let y = yb + 1; y < yt; y += 1.5) circ(X(x), Y(y), 0.6, '#aaa');
        }
      });
      // paint
      reveal(aP, 0, W, yb, yt, () => {
        p.floors[i].back.forEach(rm => { ctx.save(); ctx.beginPath(); ctx.rect(X(rm.x), Y(yt), rm.w * g0.s, 8 * g0.s); ctx.clip(); holeyRect(rm.x, yb, rm.x + rm.w, yt, holes, roomPaint(rm, i)); ctx.restore(); });
      });
      // back windows & door
      const aWin = pv ? 1 : A('windows');
      ops.forEach(o => {
        const x0 = X(o.x), y0 = Y(yb + o.y + o.h), w = o.w * g0.s, h = o.h * g0.s;
        if (aWin > 0 && o.x < W * aWin + 1) {
          if (o.door) { rect(x0, y0, w, h, '#f1f1ee'); rect(x0 + w * 0.15, y0 + h * 0.08, w * 0.7, h * 0.45, C.glass); circ(x0 + w * 0.15, y0 + h * 0.55, 1.6, '#b8a36a'); }
          else { rect(x0, y0, w, h, '#fbfbfb'); rect(x0 + 2, y0 + 2, w - 4, h / 2 - 3, C.glass); rect(x0 + 2, y0 + h / 2 + 1, w - 4, h / 2 - 3, C.glass); line(x0 + 3, y0 + h - 4, x0 + w * 0.5, y0 + 4, 'rgba(255,255,255,0.5)', 1.5); }
        }
        if (pv || A('trim') >= 1) { ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(2, 0.25 * g0.s); ctx.strokeRect(x0 - 1, y0 - 1, w + 2, h + 2); }
      });
      // floor finish, fixtures, furniture per room
      p.floors[i].back.forEach(rm => drawRoomStuff(rm, i, yb, yt));
      // partitions between rooms
      drawPartitions(i, yb, yt);
      // stairs
      const st = p.floors[i].back.find(r => r.type === 'stairs');
      if (st && i < p.stories - 1 && (pv || A('floor2') >= 1)) drawStairs(st.x + 0.5, st.x + st.w - 0.5, yb, floorY(i + 1), pv || A('trim') >= 1);
      if (i === p.stories - 1 && (pv || A('drywallHang') >= 1)) R(0, yt - 0.06, W, yt, C.drywall); // ceiling
    });
  }

  function drawRoughIn(i, yb, yt) {
    const p = S.plan, g0 = geo, W = g0.W, pv = S.preview;
    const aPl = pv ? 1 : A('plumbRough'), aH = pv ? 1 : A('hvacRough'), aE = pv ? 1 : A('elecRough');
    const pw = Math.max(3, 0.3 * g0.s);
    // drain/vent stacks run through every floor at each wet-wall x
    const stackXs = [];
    for (let k = 0; k < p.stories; k++) wetXs(k).forEach(x => { if (!stackXs.some(s => Math.abs(s - x) < 1)) stackXs.push(x); });
    if (aPl > 0) reveal(aPl, 0, W, yb, yt, () => {
      stackXs.forEach(x => L(x, yb - 0.5, x, yt + 1, C.pvc, pw));
      p.floors[i].back.forEach(rm => {
        const t = rm.type;
        if (!['bath', 'half', 'kitchen', 'laundry'].includes(t)) return;
        const sx = t === 'kitchen' ? rm.x + rm.w / 2 : rm.x + 2.7;
        L(sx - 0.25, yb, sx - 0.25, yb + 2.3, C.pexR, 2); L(sx + 0.25, yb, sx + 0.25, yb + 2.3, C.pexB, 2);
        L(sx, yb + 1.5, rm.x + 1.2, yb + 1.3, C.pvc, pw * 0.7);
        if (t === 'bath') { // tub + shower valve
          const tx0 = rm.x + rm.w - 5.3, tx1 = rm.x + rm.w - 0.3;
          L(tx0 + 1, yb, tx0 + 1, yb + 4.2, C.pexR, 2); L(tx0 + 1.4, yb, tx0 + 1.4, yb + 4.2, C.pexB, 2); R(tx0 + 0.8, yb + 3.8, tx0 + 1.6, yb + 4.3, '#b87333');
          rr(X(tx0), Y(yb + 1.7), (tx1 - tx0) * g0.s, 1.7 * g0.s, 4, '#fdfdfd', '#c9ccd0');
        }
        if (t === 'bath' || t === 'half') { circ(X(rm.x + 5), Y(yb + 0.05), pw * 0.6, '#ddd'); L(rm.x + 5.4, yb, rm.x + 5.4, yb + 0.7, C.pexB, 2); }
        if (t === 'laundry') R(rm.x + 1.5, yb + 3.2, rm.x + 3, yb + 4.2, '#f6f6f6');
      });
    });
    if (aH > 0) reveal(aH, 0, W, yb, yt, () => {
      const top = i === p.stories - 1 || (geo.found === 'slab' && i === 0);
      p.floors[i].back.forEach(rm => {
        if (rm.type === 'stairs') return;
        const x = rm.x + rm.w * 0.7;
        if (top) { R(x - 0.5, yt - 0.35, x + 0.5, yt, '#d0d6db'); }
        else { R(x - 0.5, yb, x + 0.5, yb + 0.3, '#d0d6db'); }
        if (rm.type === 'bath' || rm.type === 'half') { R(rm.x + 1.8, yt - 0.4, rm.x + 2.8, yt, '#e8e8e8'); }
      });
    });
    if (aE > 0) reveal(aE, 0, W, yb, yt, () => {
      const wireY = yb + 2.1;
      L(0.3, wireY, W - 0.3, wireY, C.wire, 1.5);
      p.floors[i].back.forEach(rm => {
        const sw = rm.x + 0.9;
        L(sw + 0.15, wireY, sw + 0.15, yb + 4, C.wire, 1.2); R(sw, yb + 3.8, sw + 0.3, yb + 4.3, C.box);
        L(sw + 0.15, yb + 4.3, sw + 0.15, yt - 0.5, C.wire, 1.2); L(sw + 0.15, yt - 0.5, rm.x + rm.w / 2, yt - 0.5, C.wire, 1.2);
        R(rm.x + rm.w / 2 - 0.3, yt - 0.4, rm.x + rm.w / 2 + 0.3, yt - 0.05, C.box);
        for (let x = rm.x + 2.5; x < rm.x + rm.w - 1; x += 6) { R(x, yb + 1.1, x + 0.3, yb + 1.55, C.box); L(x + 0.15, yb + 1.55, x + 0.15, wireY, C.wire, 1.2); }
        if (rm.type === 'kitchen') for (let x = rm.x + 2; x < rm.x + rm.w - 3; x += 4) R(x, yb + 3.7, x + 0.3, yb + 4.1, C.box);
      });
    });
  }

  function drawPartitions(i, yb, yt) {
    const p = S.plan, g0 = geo, pv = S.preview;
    const rooms = p.floors[i].back;
    const aDH = pv ? 1 : A('drywallHang'), aP = pv ? 1 : A('paint'), aT = pv ? 1 : A('trim');
    for (let k = 1; k < rooms.length; k++) {
      const x = rooms[k].x, a = rooms[k - 1], b = rooms[k];
      const door = a.type !== 'stairs' && b.type !== 'stairs';
      const x0 = x - 0.22, x1 = x + 0.22;
      const segs = door ? [[yb + 6.9, yt]] : [[yb, yt]];
      segs.forEach(([s0, s1]) => {
        R(x0, s0, x1, s1, C.wood);
        L(x, s0, x, s1, C.woodEdge, 0.6);
        if (aDH >= 1) { R(x0 - 0.05, s0, x0 + 0.05, s1, C.drywall); R(x1 - 0.05, s0, x1 + 0.05, s1, C.drywall); }
        if (aP >= 1) { R(x0 - 0.06, s0, x0 + 0.04, s1, roomPaint(a, i)); R(x1 - 0.04, s0, x1 + 0.06, s1, roomPaint(b, i)); }
      });
      if (door) {
        if (!pv && A(wallsId(i)) >= 1) { R(x0, yb + 6.75, x1, yb + 6.9, C.woodEdge); }
        if (aT >= 1) { // open door against the back wall
          const dx = x + 0.3;
          rect(X(dx), Y(yb + 6.7), 2.6 * g0.s, 6.7 * g0.s, '#f7f5ef');
          ctx.strokeStyle = '#d8d4c8'; ctx.lineWidth = 1;
          ctx.strokeRect(X(dx + 0.4), Y(yb + 6.2), 1.8 * g0.s, 2.6 * g0.s); ctx.strokeRect(X(dx + 0.4), Y(yb + 3.2), 1.8 * g0.s, 2.6 * g0.s);
          circ(X(dx + 2.3), Y(yb + 3.2), 1.5, '#b8a36a');
        }
      }
    }
  }

  function drawStairs(x0, x1, y0, y1, finished) {
    const n = Math.max(8, Math.round((y1 - y0) / 0.64));
    const rise = (y1 - y0) / n, run = (x1 - x0) / n;
    const pts = [[X(x0), Y(y0)]];
    for (let k = 0; k < n; k++) { pts.push([X(x0 + k * run), Y(y0 + (k + 1) * rise)]); pts.push([X(x0 + (k + 1) * run), Y(y0 + (k + 1) * rise)]); }
    pts.push([X(x1), Y(y0)]);
    poly(pts, finished ? '#b07a45' : C.wood, C.woodEdge, 1);
    for (let k = 0; k < n; k++) L(x0 + k * run, y0 + (k + 1) * rise, x0 + (k + 1) * run, y0 + (k + 1) * rise, finished ? '#7a4f28' : C.woodEdge, 2);
    if (finished) {
      L(x0, y0 + 3, x1, y1 + 3, '#6b4423', 3);
      for (let k = 1; k < n; k += 2) L(x0 + k * run, y0 + (k + 1) * rise, x0 + k * run, y0 + (k + 1) * rise + 3, '#fff', 1.5);
    }
  }

  function drawRoomStuff(rm, i, yb, yt) {
    const g0 = geo, pv = S.preview, s = g0.s;
    const x0 = rm.x, x1 = rm.x + rm.w, t = rm.type;
    // finished floor
    const aF = pv ? 1 : A('flooring');
    if (aF > 0 && x0 < g0.W * aF + 0.5) {
      if (['bath', 'half', 'laundry', 'entry'].includes(t)) { R(x0, yb, x1, yb + 0.18, '#e4e1da'); for (let x = x0; x < x1; x += 1) L(x, yb, x, yb + 0.18, '#bdb8ad', 0.8); }
      else if (t === 'bed' || t === 'master') { ctx.fillStyle = pat.carpet; ctx.fillRect(X(x0), Y(yb + 0.2), rm.w * s, 0.2 * s); }
      else { R(x0, yb, x1, yb + 0.15, '#b3814f'); for (let x = x0 + 0.3; x < x1; x += 3.1) L(x, yb, x, yb + 0.15, '#8a5f36', 0.8); }
    }
    // baseboards
    if (pv || A('trim') >= 1) R(x0 + 0.2, yb + 0.15, x1 - 0.2, yb + 0.5, '#ffffff');
    // cabinets
    if ((pv || A('cabinets') >= 1)) {
      if (t === 'kitchen') {
        const c1 = x1 - (pv || A('appliances') >= 1 || true ? 3.6 : 0.6);
        R(x0 + 0.6, yb + 0.3, c1, yb + 3, '#f4f1ea'); for (let x = x0 + 0.6; x < c1 - 0.1; x += 1.6) ctx.strokeRect(X(x + 0.1), Y(yb + 2.8), 1.4 * s, 2.3 * s);
        R(x0 + 0.5, yb + 3, c1 + 0.1, yb + 3.2, '#d5d8dc');
        R(x0 + 0.6, yb + 4.8, c1, yb + 7.4, '#f4f1ea'); ctx.strokeStyle = '#d0c9b8'; for (let x = x0 + 0.6; x < c1 - 0.1; x += 1.6) ctx.strokeRect(X(x + 0.1), Y(yb + 7.3), 1.4 * s, 2.4 * s);
        const sx = rm.x + rm.w / 2; R(sx - 1, yb + 3.05, sx + 1, yb + 3.2, '#9aa3ab');
        if (pv || A('plumbFin') >= 1) { L(sx, yb + 3.2, sx, yb + 4, '#9aa3ab', 2); L(sx, yb + 4, sx + 0.5, yb + 3.8, '#9aa3ab', 2); }
      }
      if (t === 'bath' || t === 'half') {
        R(x0 + 0.5, yb + 0.3, x0 + 3.7, yb + 2.8, '#6f5846'); R(x0 + 0.4, yb + 2.8, x0 + 3.8, yb + 3, '#f0efe9');
        rr(X(x0 + 1.2), Y(yb + 6.2), 1.8 * s, 2.4 * s, 3, '#cfe3ec', '#b7a98f');
      }
    }
    // appliances
    if (pv || A('appliances') >= 1) {
      if (t === 'kitchen') {
        rr(X(x1 - 3.3), Y(yb + 6.2), 2.9 * s, 5.9 * s, 3, '#c9cfd4', '#8e979e'); L(x1 - 2.9, yb + 4.2, x1 - 2.9, yb + 5.5, '#777', 2);
        const rx = x0 + 1.4; R(rx, yb + 0.3, rx + 2.4, yb + 3.05, '#2b2f33'); R(rx + 0.3, yb + 0.7, rx + 2.1, yb + 2.2, '#454b52');
        R(rx - 0.1, yb + 5, rx + 2.5, yb + 5.9, '#bfc5ca');
      }
      if (t === 'laundry') { R(x0 + 0.5, yb + 0.2, x0 + 2.9, yb + 3, '#f5f5f5'); circ(X(x0 + 1.7), Y(yb + 1.5), 0.7 * s, '#b9d6e6'); R(x0 + 3.1, yb + 0.2, x0 + 5.5, yb + 3, '#f5f5f5'); circ(X(x0 + 4.3), Y(yb + 1.5), 0.7 * s, '#ddd'); }
    }
    // plumbing fixtures
    if (pv || A('plumbFin') >= 1) {
      if (t === 'bath' || t === 'half') {
        const tx = x0 + 4.4; rr(X(tx), Y(yb + 2.8), 1.4 * s, 1.2 * s, 3, '#fdfdfd', '#ccc'); rr(X(tx + 0.1), Y(yb + 1.5), 1.6 * s, 1.3 * s, 4, '#fdfdfd', '#ccc');
        L(x0 + 2.1, yb + 3, x0 + 2.1, yb + 3.6, '#9aa3ab', 2);
      }
      if (t === 'bath') { const tx0 = x1 - 5.3; L(tx0 + 1.2, yb + 6, tx0 + 1.8, yb + 6.2, '#9aa3ab', 2); L(tx0, yb + 6.8, x1 - 0.3, yb + 6.8, '#9aa3ab', 1.5); }
    }
    // outlets & switches & lights
    if (pv || A('elecFin') >= 1) {
      rect(X(x0 + 0.85), Y(yb + 4.35), 0.45 * s, 0.6 * s, '#fff');
      for (let x = x0 + 2.5; x < x1 - 1; x += 6) rect(X(x), Y(yb + 1.55), 0.35 * s, 0.5 * s, '#fff');
      const lx = X(x0 + rm.w / 2), ly = Y(yt - 0.05);
      if (S.lights) { const gl = ctx.createRadialGradient(lx, ly + 4, 2, lx, ly + 4, rm.w * s * 0.6); gl.addColorStop(0, 'rgba(255,236,170,0.45)'); gl.addColorStop(1, 'rgba(255,236,170,0)'); rect(X(x0), Y(yt), rm.w * s, 8 * s, gl); }
      poly([[lx - 0.8 * s, ly], [lx + 0.8 * s, ly], [lx + 0.4 * s, ly + 0.5 * s], [lx - 0.4 * s, ly + 0.5 * s]], '#f8f1d8', '#c9b98a');
      if (t === 'bed' || t === 'master') circ(X(x0 + rm.w - 1.2), Y(yt - 0.15), Math.max(2, 0.25 * s), '#fff');
    }
    // hvac registers & thermostat
    if (pv || A('hvacFin') >= 1) {
      const x = rm.x + rm.w * 0.7;
      const top = i === S.plan.stories - 1 || (geo.found === 'slab' && i === 0);
      if (t !== 'stairs') R(x - 0.5, top ? yt - 0.12 : yb + 0.18, x + 0.5, top ? yt : yb + 0.3, '#f4f4f4');
      if (t === 'living' || (t === 'dining' && i === 0)) { rect(X(x0 + 1.6), Y(yb + 5.2), 0.6 * s, 0.6 * s, '#fff'); circ(X(x0 + 1.9), Y(yb + 4.9), 1.2, '#2ecc71'); }
    }
    // tub stays visible after drywall (it was installed at rough-in)
    if (t === 'bath' && (pv || A('drywallHang') >= 1)) {
      const tx0 = x1 - 5.3, tx1 = x1 - 0.3;
      if (pv || A('flooring') >= 1) { R(tx0, yb + 1.7, tx1, yb + 6.5, '#f2f5f7'); for (let y = yb + 2.2; y < yb + 6.5; y += 0.5) L(tx0, y, tx1, y, '#dfe5ea', 0.8); }
      rr(X(tx0), Y(yb + 1.7), (tx1 - tx0) * s, 1.7 * s, 4, '#fdfdfd', '#c9ccd0');
    }
    if (S.furnish) furniture(rm, i, yb, yt);
  }

  function furniture(rm, i, yb, yt) {
    const s = geo.s, x0 = rm.x, x1 = rm.x + rm.w, t = rm.type, fav = S.family ? S.family.fav.color : '#3b7dd8';
    const r = new RNG(Math.round(rm.x * 13 + i * 7));
    const frame = (x, y, w, h, c) => { rect(X(x), Y(y + h), w * s, h * s, '#6b4f3a'); rect(X(x) + 2, Y(y + h) + 2, w * s - 4, h * s - 4, c); };
    if (t === 'bed' || t === 'master') {
      const bw = t === 'master' ? 6.5 : 4.5, bx = x0 + (rm.w - bw) / 2;
      R(bx, yb + 0.2, bx + 0.4, yb + 3.8, '#7a5537'); // headboard (side view)
      R(bx + 0.4, yb + 0.9, bx + bw, yb + 2.1, '#fff'); R(bx + 1.6, yb + 1.5, bx + bw, yb + 2.4, t === 'master' ? '#7d8fa6' : r.pick([fav, '#e67e22', '#9b59b6', '#16a085', '#e84393']));
      rr(X(bx + 0.5), Y(yb + 2.6), 1.1 * s, 0.6 * s, 3, '#fff'); R(bx + 0.4, yb + 0.2, bx + bw, yb + 0.9, '#8b6443');
      R(x0 + 0.5, yb + 0.2, x0 + 1.8, yb + 2.1, '#8b6443'); R(x0 + 0.95, yb + 2.1, x0 + 1.35, yb + 2.9, '#555'); poly([[X(x0 + 0.6), Y(yb + 2.9)], [X(x0 + 1.7), Y(yb + 2.9)], [X(x0 + 1.4), Y(yb + 3.6)], [X(x0 + 0.9), Y(yb + 3.6)]], '#f7e3a1');
      frame(x0 + rm.w / 2 - 1.2, yb + 4.6, 2.4, 1.8, r.pick(['#8ecae6', '#ffb703', '#90be6d', '#f28482']));
      if (t === 'bed') { circ(X(x1 - 1.3), Y(yb + 0.7), 0.5 * s, '#e74c3c'); R(x1 - 2.8, yb + 0.2, x1 - 2.2, yb + 0.8, '#3498db'); R(x1 - 2.5, yb + 0.8, x1 - 1.9, yb + 1.4, '#f1c40f'); }
    } else if (t === 'living') {
      const sx = x0 + 1; R(sx, yb + 0.3, sx + 7, yb + 1.9, '#5d6d7e'); R(sx, yb + 1.9, sx + 7, yb + 3.1, '#566573'); rr(X(sx - 0.3), Y(yb + 2.4), 0.8 * s, 2.1 * s, 3, '#4d5d6e'); rr(X(sx + 6.5), Y(yb + 2.4), 0.8 * s, 2.1 * s, 3, '#4d5d6e');
      rr(X(sx + 1), Y(yb + 2.6), 1.2 * s, 1 * s, 3, fav); rr(X(sx + 4.5), Y(yb + 2.6), 1.2 * s, 1 * s, 3, '#f5cba7');
      R(x1 - 5, yb + 0.2, x1 - 1, yb + 2.2, '#6b4f3a'); R(x1 - 4.8, yb + 2.6, x1 - 1.2, yb + 5, '#111'); R(x1 - 4.6, yb + 2.8, x1 - 1.4, yb + 4.8, '#1f3b57');
      R(x1 - 3.3, yb + 2.2, x1 - 2.7, yb + 2.6, '#111');
      R(sx, yb + 0.15, sx + 7, yb + 0.25, '#c0392b');
      frame(sx + 2, yb + 4.5, 3, 2, '#a9cce3');
      R(x0 + 0.3, yb + 0.2, x0 + 0.9, yb + 1.2, '#b9770e'); circ(X(x0 + 0.6), Y(yb + 1.9), 0.8 * s, '#27ae60');
    } else if (t === 'dining' || t === 'kitchen' && rm.w > 13) {
      const cx = x0 + rm.w / 2 + (t === 'kitchen' ? -1 : 0);
      if (t === 'dining') {
        R(cx - 2.5, yb + 2.3, cx + 2.5, yb + 2.5, '#8b5a2b'); R(cx - 2.2, yb + 0.2, cx - 1.9, yb + 2.3, '#8b5a2b'); R(cx + 1.9, yb + 0.2, cx + 2.2, yb + 2.3, '#8b5a2b');
        [cx - 3.3, cx + 2.8].forEach(x => { R(x, yb + 1.5, x + 0.9, yb + 1.7, '#6e4520'); R(x + (x < cx ? 0 : 0.7), yb + 0.2, x + (x < cx ? 0.2 : 0.9), yb + 3.2, '#6e4520'); });
        circ(X(cx), Y(yb + 2.8), 0.35 * s, '#e67e22'); circ(X(cx + 0.5), Y(yb + 2.8), 0.3 * s, '#c0392b');
        const lx = X(cx), ly = Y(yt); line(lx, ly, lx, ly + 1.2 * s, '#333', 1); poly([[lx - 0.9 * s, ly + 1.8 * s], [lx + 0.9 * s, ly + 1.8 * s], [lx + 0.3 * s, ly + 1.2 * s], [lx - 0.3 * s, ly + 1.2 * s]], '#2c3e50');
      }
    } else if (t === 'office') {
      R(x0 + 1, yb + 2.4, x0 + 5, yb + 2.6, '#8b5a2b'); R(x0 + 1.1, yb + 0.2, x0 + 1.4, yb + 2.4, '#8b5a2b'); R(x0 + 4.6, yb + 0.2, x0 + 4.9, yb + 2.4, '#8b5a2b');
      R(x0 + 2.2, yb + 2.6, x0 + 3.8, yb + 3.8, '#222'); R(x0 + 2.3, yb + 2.7, x0 + 3.7, yb + 3.7, '#5dade2');
      R(x1 - 3, yb + 0.2, x1 - 1, yb + 6, '#a0522d'); for (let y = 1.5; y < 6; y += 1.4) { R(x1 - 2.9, yb + y, x1 - 1.1, yb + y + 0.1, '#7b3f1d'); for (let k = 0; k < 5; k++) R(x1 - 2.8 + k * 0.33, yb + y + 0.1, x1 - 2.6 + k * 0.33, yb + y + 1, r.pick(['#c0392b', '#2980b9', '#27ae60', '#f39c12'])); }
    } else if (t === 'bath') {
      R(x0 + 3.9, yb + 4.5, x0 + 4.1, yb + 5.8, '#aaa'); R(x0 + 3.8, yb + 3.5, x0 + 4.3, yb + 4.6, fav);
    }
  }

  // ---------- section views of the side walls (inside view) ----------
  function drawEndWalls(i) {
    const g0 = geo, W = g0.W, pv = S.preview;
    const yb = i === 0 ? g0.y1 : floorY(i) - 1, yt = floorY(i) + 8;
    if (!pv && A(wallsId(i)) <= 0) return;
    const layers = [
      [0.0, 0.08, 'siding', S.colors ? S.colors.siding : '#ddd'], [0.08, 0.11, 'wrap', '#f3f5f7'], [0.11, 0.17, 'sheathing', C.osb],
      [0.17, 0.62, wallsId(i), C.wood], [0.62, 0.68, 'drywallHang', C.drywall],
    ];
    const cavityInsul = pv || A('insulation') >= 1;
    for (const side of [0, 1]) {
      for (const [a, b, id, c] of layers) {
        if (!(pv || A(id) >= 1 || (id === wallsId(i) && A(id) > 0))) continue;
        const xa = side ? W - b : a, xb = side ? W - a : b;
        R(xa, yb, xb, yt, id === wallsId(i) && cavityInsul ? C.pink : c);
        if (id === wallsId(i) && cavityInsul) { ctx.fillStyle = pat.pink; ctx.fillRect(X(xa), Y(yt), (xb - xa) * g0.s, (yt - yb) * g0.s); }
      }
    }
  }

  // ---------- front wall (outside view) ----------
  function drawFrontWall(i) {
    const g0 = geo, W = g0.W, pv = S.preview, p = S.plan;
    const yb = floorY(i), yt = yb + 8;
    const aw = pv ? 1 : A(wallsId(i));
    if (aw <= 0) return;
    const ops = frontOps(i);
    const holes = ops.map(o => ({ x: o.x, w: o.w, y: yb + o.y, h: o.h }));
    const zb = i === 0 ? (g0.found === 'slab' ? g0.y1 - 0.1 : g0.yFW) : yb - 1;
    reveal(aw, 0, W, yb, yt, () => frameWall(yb, 0, W, ops));
    const aS = pv ? 1 : A('sheathing'), aWr = pv ? 1 : A('wrap'), aWin = pv ? 1 : A('windows'), aSd = pv ? 1 : A('siding');
    reveal(aS, 0, W, zb, yt, () => { holeyRect(0, zb, W, yt, holes, pat.osb); for (let x = 8; x < W; x += 8) L(x, zb, x, yt, 'rgba(90,60,20,0.5)', 1); L(0, yb + 4, W, yb + 4, 'rgba(90,60,20,0.4)', 1); });
    reveal(aWr, 0, W, zb, yt, () => { holeyRect(0, zb, W, yt, holes, pat.wrap); });
    // windows & door units
    if (aWin > 0) ops.forEach(o => { if (o.x < W * aWin + 0.5) (o.door ? frontDoor : windowUnit)(o, yb); });
    // siding
    reveal(aSd, 0, W, zb, yt, () => {
      const sc = S.colors.siding;
      holeyRect(0, zb, W, yt, holes, sc);
      const exp = S.colors.sidingType === 'vinyl' ? 0.62 : 0.58;
      ctx.save(); ctx.beginPath(); ctx.rect(X(0), Y(yt), W * g0.s, (yt - zb) * g0.s);
      for (const h of holes) ctx.rect(X(h.x), Y(h.y + h.h), h.w * g0.s, h.h * g0.s);
      ctx.clip('evenodd');
      for (let y = zb + exp; y < yt; y += exp) { L(0, y, W, y, shade(sc, -0.16), 1); L(0, y - 0.07, W, y - 0.07, shade(sc, 0.06), 1); }
      ctx.restore();
      const tc = S.colors.trim;
      R(0, zb, 0.5, yt, tc); R(W - 0.5, zb, W, yt, tc);
      if (i > 0) R(0, yb - 0.6, W, yb - 0.1, tc);
      holes.forEach(h => { ctx.strokeStyle = tc; ctx.lineWidth = Math.max(2.5, 0.35 * g0.s); ctx.strokeRect(X(h.x) - 1.5, Y(h.y + h.h) - 1.5, h.w * g0.s + 3, h.h * g0.s + (ops.find(o => o.x === h.x).door ? 1.5 : 3)); });
      if (pv || A('extPaint') >= 1) { // shutters
        if (S.colors.shutters) ops.forEach(o => { if (o.door || o.w < 2.8) return; [o.x - o.w * 0.45 - 0.3, o.x + o.w + 0.3].forEach(sx => { R(sx, yb + o.y, sx + o.w * 0.45, yb + o.y + o.h, S.colors.shutters); for (let y = yb + o.y + 0.4; y < yb + o.y + o.h - 0.2; y += 0.4) L(sx + 0.1, y, sx + o.w * 0.45 - 0.1, y, shade(S.colors.shutters, -0.12), 1); }); });
      }
    });
    // re-draw doors above siding edge so knob/paint shows
    if (aWin > 0) ops.forEach(o => { if (o.door && o.x < W * aWin + 0.5) frontDoor(o, yb); });
  }
  function windowUnit(o, yb) {
    const s = geo.s, x = X(o.x), y = Y(yb + o.y + o.h), w = o.w * s, h = o.h * s;
    rect(x, y, w, h, '#fafafa');
    const gl = ctx.createLinearGradient(x, y, x + w, y + h); gl.addColorStop(0, 'rgba(190,225,245,0.72)'); gl.addColorStop(1, 'rgba(120,170,210,0.62)');
    const m = Math.max(2, 0.2 * s);
    rect(x + m, y + m, w - 2 * m, h / 2 - 1.5 * m, gl); rect(x + m, y + h / 2 + m / 2, w - 2 * m, h / 2 - 1.5 * m, gl);
    line(x + m + 2, y + h / 2 - m, x + w * 0.55, y + m + 1, 'rgba(255,255,255,0.65)', 1.5);
    if (S.lights) rect(x + m, y + m, w - 2 * m, h - 2 * m, 'rgba(255,220,130,0.22)');
  }
  function frontDoor(o, yb) {
    const s = geo.s, x = X(o.x), y = Y(yb + 6.8), w = o.w * s, h = 6.8 * s;
    const col = (S.preview || A('extPaint') >= 1) ? S.colors.door : '#f0efe9';
    rect(x, y, w, h, col);
    ctx.strokeStyle = shade(col, -0.18); ctx.lineWidth = 1;
    ctx.strokeRect(x + w * 0.15, y + h * 0.08, w * 0.7, h * 0.35); ctx.strokeRect(x + w * 0.15, y + h * 0.52, w * 0.7, h * 0.4);
    rect(x + w * 0.25, y + h * 0.12, w * 0.5, h * 0.2, 'rgba(180,215,235,0.8)');
    circ(x + w * 0.82, y + h * 0.52, Math.max(1.5, 0.15 * s), '#d4b35a');
    if (S.lights) { const gl = ctx.createRadialGradient(x + w + 6, y + 8, 1, x + w + 6, y + 8, 30); gl.addColorStop(0, 'rgba(255,230,160,0.7)'); gl.addColorStop(1, 'rgba(255,230,160,0)'); rect(x + w - 30, y - 22, 70, 60, gl); }
  }
  function drawFoundationFace() {
    const g0 = geo, W = g0.W;
    if (g0.found === 'slab' || !(S.preview || A('fwalls') >= 1)) return;
    ctx.fillStyle = pat.concrete; ctx.fillRect(X(0), Y(g0.yFW), W * g0.s, g0.yFW * g0.s);
    L(0, g0.yFW, W, g0.yFW, C.concDark, 1);
    if (g0.found === 'basement' && (S.preview || A('windows') >= 1)) [W * 0.25, W * 0.72].forEach(x => { R(x, 0.3, x + 2.5, 1.3, '#222'); R(x + 0.15, 0.4, x + 2.35, 1.2, 'rgba(160,200,230,0.7)'); });
  }

  // ---------- roof ----------
  function roofPts(x0, x1, base, rise, D, over) {
    const half = D / 2;
    let rx0 = x0 + half, rx1 = x1 - half;
    if (rx0 > rx1) rx0 = rx1 = (x0 + x1) / 2;
    return [[X(x0 - over), Y(base - 0.35)], [X(x1 + over), Y(base - 0.35)], [X(rx1), Y(base + rise)], [X(rx0), Y(base + rise)]];
  }
  function drawRoof(view) {
    const g0 = geo, W = g0.W, pv = S.preview;
    const aT = pv ? 1 : A('trusses');
    if (aT <= 0) return;
    const base = g0.wallTop, rise = g0.rise, half = g0.D / 2;
    const h = x => { const d = Math.min(x, W - x); return Math.min(rise, rise * Math.max(0, d) / half); };
    reveal(aT, -2, W + 2, base, base + rise, () => {
      if (view === 'in' || A('sheathing') < 1) {
        // truss ends (seen edge-on) stepping down at the hips
        for (let x = 0; x <= W + 0.01; x += 2) { const hh = h(x); if (hh > 0.3) { stud(Math.min(x, W - 0.15), base, base + hh); } }
        L(0, base, W, base, C.woodEdge, 2);
        ctx.strokeStyle = C.wood; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(X(-1.5), Y(base - 0.35)); ctx.lineTo(X(Math.min(half, W / 2)), Y(base + rise)); ctx.lineTo(X(Math.max(W - half, W / 2)), Y(base + rise)); ctx.lineTo(X(W + 1.5), Y(base - 0.35)); ctx.stroke();
        for (let x = 1; x < W; x += 4) { const hh = h(x); if (hh > 1) L(x, base, x + 1, base + h(x + 1), C.woodEdge, 1); }
      }
      if (view === 'in') {
        const aS = pv ? 1 : A('sheathing');
        if (aS > 0) { ctx.save(); ctx.globalAlpha = 0.5; poly(roofPts(0, W, base, rise, g0.D, 1.5), pat.osb); ctx.restore(); for (let x = 0; x <= W + 0.01; x += 2) { const hh = h(x); if (hh > 0.3) stud(Math.min(x, W - 0.15), base, base + hh); } }
        if (pv || A('insulation') >= 1) { ctx.fillStyle = pat.pink; ctx.fillRect(X(0.3), Y(base + 1.3), (W - 0.6) * g0.s, 1.3 * g0.s); }
        if ((pv || A('hvacRough') >= 1)) { R(3, base + 1.5, W - 3, base + 2.3, C.duct); S.plan.floors[S.plan.stories - 1].back.forEach(r => { if (r.type !== 'stairs') R(r.x + r.w * 0.7 - 0.25, base, r.x + r.w * 0.7 + 0.25, base + 1.5, '#d0d6db'); }); }
        if (pv || A('elecRough') >= 1) L(1, base + 0.4, W - 1, base + 0.4, C.wire, 1.2);
      }
    });
  }
  function drawRoofFront(view) {
    const g0 = geo, W = g0.W, pv = S.preview;
    const base = g0.wallTop, rise = g0.rise;
    const pts = roofPts(0, W, base, rise, g0.D, 1.5);
    const aS = pv ? 1 : A('sheathing'), aR = pv ? 1 : A('roofing');
    if (view === 'out') {
      reveal(aS, -2, W + 2, base, base + rise, () => { poly(pts, pat.osb, 'rgba(90,60,20,0.6)', 1); for (let x = 4; x < W; x += 8) L(x, base, x, base + rise, 'rgba(90,60,20,0.35)', 1); });
      if (aR > 0) {
        const u = Math.min(1, aR / 0.3), sp = Math.max(0, (aR - 0.3) / 0.7);
        reveal(u, -2, W + 2, base, base + rise, () => poly(pts, '#34373b'));
        if (sp > 0) {
          ctx.save(); ctx.beginPath(); pts.forEach((p2, k) => k ? ctx.lineTo(p2[0], p2[1]) : ctx.moveTo(p2[0], p2[1])); ctx.closePath(); ctx.clip();
          shingles(-2, W + 2, base - 0.4, base + rise, sp, S.colors.roof);
          ctx.restore();
          if (sp >= 1) { ctx.strokeStyle = shade(S.colors.roof, -0.15); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); ctx.lineTo(pts[3][0], pts[3][1]); ctx.lineTo(pts[2][0], pts[2][1]); ctx.lineTo(pts[1][0], pts[1][1]); ctx.stroke(); }
        }
        line(pts[0][0], pts[0][1], pts[1][0], pts[1][1], '#9aa3ab', 2); // drip edge
      }
    } else if (aR > 0) {
      ctx.strokeStyle = S.colors.roof; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); ctx.lineTo(pts[3][0], pts[3][1]); ctx.lineTo(pts[2][0], pts[2][1]); ctx.lineTo(pts[1][0], pts[1][1]); ctx.stroke();
    }
    // plumbing vent through the roof
    if ((pv || A('plumbRough') >= 1) && (pv || A('roofing') >= 1 || view === 'in')) {
      const xs = wetXs(S.plan.stories - 1); if (xs.length) { const x = xs[0]; const d = Math.min(x, W - x); const yy = base + Math.min(rise, rise * d / (g0.D / 2)); R(x - 0.2, yy - 1, x + 0.2, yy + 1.2, '#e8e8e8'); R(x - 0.45, yy - 0.2, x + 0.45, yy + 0.1, '#555'); }
    }
    // fascia & gutters
    if (pv || A('siding') >= 1) line(pts[0][0], pts[0][1] + 1, pts[1][0], pts[1][1] + 1, S.colors.trim, Math.max(3, 0.5 * g0.s));
    if (pv || A('gutters') >= 1) {
      rr(pts[0][0] - 2, pts[0][1] - 1, pts[1][0] - pts[0][0] + 4, Math.max(4, 0.55 * g0.s), 2, shade(S.colors.trim, -0.05), shade(S.colors.trim, -0.25));
      [0.2, W - 0.2].forEach(x => { R(x - 0.25, 0.3, x + 0.25, base - 0.3, shade(S.colors.trim, -0.06)); R(x - 0.6, 0, x + 0.6, 0.3, '#aaa'); });
    }
  }
  function shingles(x0, x1, y0, y1, frac, col) {
    const rows = Math.ceil((y1 - y0) / 0.42);
    const n = Math.ceil(rows * frac);
    const r = new RNG(21);
    for (let k = 0; k < n; k++) {
      const ya = y0 + k * 0.42, yb2 = ya + 0.45;
      R(x0, ya, x1, yb2, shade(col, (k % 2 ? 0.02 : -0.02)));
      const off = (k % 2) * 0.55;
      for (let x = x0 + off; x < x1; x += 1.1) { R(x, ya, x + 1.1, yb2, shade(col, r.f(-0.05, 0.05))); L(x, ya, x, yb2, shade(col, -0.25), 0.8); }
      L(x0, ya, x1, ya, shade(col, -0.3), 1);
    }
  }

  // ---------- garage ----------
  function drawGarageInterior() {
    const g0 = geo, gw = g0.gW, pv = S.preview, yb = 0.33, yt = 9.33;
    const aw = pv ? 1 : A('walls1');
    if (aw <= 0) return;
    reveal(aw, -gw, 0, yb, yt, () => {
      if (pv || A('sheathing') > 0) R(-gw, yb, 0, yt, C.osb);
      frameWall(yb, -gw, 0, [], 9);
      if (pv || A('drywallHang') >= 1) R(-gw + 0.3, yb, -0.3, yt, '#e6e5df');
      if (pv || A('elecRough') > 0) { R(-2.2, yb + 4, -1, yb + 6.5, '#9aa3ab'); for (let k = 0; k < 4; k++) L(-2 + k * 0.25, yb + 6.5, -2 + k * 0.25, yt, C.wire, 1); }
      const fl = furnaceLoc(); if (fl.where === 'garage') drawMechanicals(-7.5, yb);
      if (S.furnish) { car(X(-gw / 2 - 1), Y(yb), g0.s); R(-gw + 1, yb + 3, -gw + 5, yb + 3.2, '#8b5a2b'); R(-gw + 1, yb + 5, -gw + 5, yb + 5.2, '#8b5a2b'); circ(X(-gw + 2), Y(yb + 3.6), 0.5 * g0.s, '#27ae60'); }
      if (pv || A('garageDoor') >= 1) {}
    });
  }
  function car(cx, yb, s) {
    const col = S.family ? S.family.fav.color : '#3b7dd8';
    rr(cx - 7 * s, yb - 3.6 * s, 14 * s, 2.4 * s, 6, col);
    poly([[cx - 4 * s, yb - 3.5 * s], [cx - 2.6 * s, yb - 5.2 * s], [cx + 2.8 * s, yb - 5.2 * s], [cx + 4.4 * s, yb - 3.5 * s]], shade(col, -0.1));
    rect(cx - 2.2 * s, yb - 4.9 * s, 2.2 * s, 1.3 * s, 'rgba(170,210,235,0.9)'); rect(cx + 0.3 * s, yb - 4.9 * s, 2.3 * s, 1.3 * s, 'rgba(170,210,235,0.9)');
    circ(cx - 4.2 * s, yb - 1.1 * s, 1.1 * s, '#222'); circ(cx + 4.2 * s, yb - 1.1 * s, 1.1 * s, '#222'); circ(cx - 4.2 * s, yb - 1.1 * s, 0.5 * s, '#aaa'); circ(cx + 4.2 * s, yb - 1.1 * s, 0.5 * s, '#aaa');
  }
  function drawGarageFront() {
    const g0 = geo, gw = g0.gW, pv = S.preview, yb = 0.33, yt = 9.33;
    const aw = pv ? 1 : A('walls1');
    if (aw <= 0) return;
    const op = { x: -gw + 3, w: 16, y: 0, h: 7 };
    const holes = [{ x: op.x, w: op.w, y: yb, h: 7 }];
    reveal(aw, -gw, 0, yb, yt, () => frameWall(yb, -gw, 0, [op], 9));
    const aS = pv ? 1 : A('sheathing'), aWr = pv ? 1 : A('wrap'), aSd = pv ? 1 : A('siding');
    reveal(aS, -gw, 0, yb, yt, () => holeyRect(-gw, yb, 0, yt, holes, pat.osb));
    reveal(aWr, -gw, 0, yb, yt, () => holeyRect(-gw, yb, 0, yt, holes, pat.wrap));
    if (pv || A('windows') >= 1) {
      const x = X(op.x), y = Y(yb + 7), w = op.w * g0.s, h = 7 * g0.s, gc = S.colors ? S.colors.trim : '#fff';
      rect(x, y, w, h, gc);
      for (let k = 1; k < 4; k++) line(x, y + h * k / 4, x + w, y + h * k / 4, shade(gc, -0.18), 1.2);
      for (let k = 0; k < 4; k++) rect(x + w * (k * 0.25 + 0.03), y + h * 0.05, w * 0.19, h * 0.15, 'rgba(160,205,235,0.9)');
    }
    reveal(aSd, -gw, 0, yb, yt, () => {
      const sc = S.colors.siding; holeyRect(-gw, yb, 0, yt, holes, sc);
      ctx.save(); ctx.beginPath(); ctx.rect(X(-gw), Y(yt), gw * g0.s, 9 * g0.s); ctx.rect(X(op.x), Y(yb + 7), op.w * g0.s, 7 * g0.s); ctx.clip('evenodd');
      for (let y = yb + 0.62; y < yt; y += 0.62) L(-gw, y, 0, y, shade(sc, -0.16), 1);
      ctx.restore();
      R(-gw, yb, -gw + 0.5, yt, S.colors.trim);
      ctx.strokeStyle = S.colors.trim; ctx.lineWidth = Math.max(2.5, 0.35 * g0.s); ctx.strokeRect(X(op.x) - 1.5, Y(yb + 7) - 1.5, op.w * g0.s + 3, 7 * g0.s + 1.5);
    });
  }
  function drawGarageEnds() {
    const g0 = geo, gw = g0.gW, pv = S.preview;
    if (!(pv || A('walls1') >= 1)) return;
    R(-gw, 0.33, -gw + 0.6, 9.33, pv || A('siding') >= 1 ? S.colors.siding : pv || A('sheathing') >= 1 ? C.osb : C.wood);
  }
  function drawGarageRoof(view) {
    const g0 = geo, gw = g0.gW, pv = S.preview;
    const aT = pv ? 1 : A('trusses'); if (aT <= 0) return;
    const base = g0.gTop, rise = g0.gRise;
    const pts = [[X(-gw - 1.2), Y(base - 0.35)], [X(0), Y(base - 0.35)], [X(0), Y(base + rise)], [X(-gw + 12), Y(base + rise)]];
    reveal(aT, -gw - 2, 0, base, base + rise, () => {
      for (let x = -gw; x <= 0; x += 2) { const d = x + gw; const hh = Math.min(rise, rise * d / 12); if (hh > 0.3) stud(Math.min(x, -0.15), base, base + hh); }
      L(-gw, base, 0, base, C.woodEdge, 2);
    });
    const aS = pv ? 1 : A('sheathing'), aR = pv ? 1 : A('roofing');
    if (view === 'in' && aR > 0) { ctx.strokeStyle = S.colors.roof; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); ctx.lineTo(pts[3][0], pts[3][1]); ctx.lineTo(pts[2][0], pts[2][1]); ctx.stroke(); }
    if (view === 'out') {
      reveal(aS, -gw - 2, 0, base, base + rise, () => poly(pts, pat.osb, 'rgba(90,60,20,0.6)'));
      if (aR > 0) {
        const u = Math.min(1, aR / 0.3), sp = Math.max(0, (aR - 0.3) / 0.7);
        reveal(u, -gw - 2, 0, base, base + rise, () => poly(pts, '#34373b'));
        if (sp > 0) { ctx.save(); ctx.beginPath(); pts.forEach((p2, k) => k ? ctx.lineTo(p2[0], p2[1]) : ctx.moveTo(p2[0], p2[1])); ctx.closePath(); ctx.clip(); shingles(-gw - 2, 0, base - 0.4, base + rise, sp, S.colors.roof); ctx.restore(); }
      }
      if (pv || A('siding') >= 1) line(pts[0][0], pts[0][1] + 1, pts[1][0], pts[1][1] + 1, S.colors.trim, Math.max(3, 0.5 * g0.s));
      if (pv || A('gutters') >= 1) rr(pts[0][0] - 2, pts[0][1] - 1, pts[1][0] - pts[0][0] + 2, Math.max(4, 0.55 * g0.s), 2, shade(S.colors.trim, -0.05));
    }
  }

  // ---------- extras: steps, driveway, AC, landscaping ----------
  function drawExteriorExtras() {
    const g0 = geo, W = g0.W, pv = S.preview, s = g0.s;
    const aD = pv ? 1 : A('flatwork');
    if (aD > 0) {
      const x0 = 70, x1 = g0.gW ? X(0) : X(S.plan.door - 2);
      rect(x0, G - 3, (x1 - x0) * aD, 5, '#c9c7c0');
      for (let x = x0 + 40; x < x0 + (x1 - x0) * aD; x += 40) line(x, G - 3, x, G + 2, '#a9a79f', 1);
      if (aD >= 1 && S.view === 'out') { // front steps
        const dx = S.plan.door, top = g0.y1, n = Math.max(1, Math.round(top / 0.6));
        for (let k = 0; k < n; k++) R(dx - 2.2 - (n - k - 1) * 0.1, (top / n) * k, dx + 2.2 + (n - k - 1) * 0.1, (top / n) * (k + 1), k % 2 ? '#c4c2bb' : '#cfcdc6');
      }
    }
    if (pv || A('hvacFin') >= 1) { const ax = X(W) + 2 * s; rect(ax, G - 3.2 * s, 3 * s, 3 * s, '#c5cbd0'); for (let k = 1; k < 6; k++) line(ax, G - 3.2 * s + k * 0.5 * s, ax + 3 * s, G - 3.2 * s + k * 0.5 * s, '#9aa3ab', 1); circ(ax + 1.5 * s, G - 3.3 * s, 1.1 * s, '#7f8c8d'); rect(ax - 0.3 * s, G - 0.2 * s, 3.6 * s, 0.3 * s, '#bbb'); }
    if (pv || A('landscape') >= 1) {
      const r = new RNG(55);
      const base = S.view === 'out' ? 0 : -1;
      if (base === 0) for (let x = 1.5; x < W - 1; x += 3.2) { if (Math.abs(x - S.plan.door) < 3) continue; const hh = r.f(1.6, 2.6); ctx.fillStyle = shade('#3f7f3a', r.f(-0.05, 0.08)); ctx.beginPath(); ctx.ellipse(X(x), Y(hh / 2), 1.5 * s, hh / 2 * s, 0, 0, 7); ctx.fill(); if (r.chance(0.5)) circ(X(x + 0.4), Y(hh * 0.7), 2, r.pick(['#e84393', '#fdcb6e', '#fff', '#e17055'])); }
      rect(X(0) - 6, G - 3, W * s + 12, 3, '#6b4a33');
      // mailbox
      line(96, G, 96, G - 26, '#6b4a33', 3); rr(88, G - 34, 18, 9, 4, '#2d3436'); poly([[104, G - 34], [110, G - 34], [110, G - 40], [104, G - 40]], '#d63031');
      text(String(S.lot.number), 97, G - 29.5, 7, '#fff', 'center', true);
    }
  }

  // ---------- site stuff: signs, porta-potty, dumpster, power pole, stakes ----------
  function drawSiteStuff() {
    const pv = S.preview;
    const s = S.plan ? geo.s : 8;
    const signX = 150;
    if (S.sign === 'sale' || S.sign === 'sold') {
      line(signX, G, signX, G - 44, '#6b4a33', 3); line(signX + 40, G, signX + 40, G - 44, '#6b4a33', 3);
      rect(signX - 4, G - 58, 48, 24, '#fff'); ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 2; ctx.strokeRect(signX - 4, G - 58, 48, 24);
      text(S.sign === 'sale' ? 'FOR SALE' : 'SOLD!', signX + 20, G - 50, 9, '#c0392b', 'center', true);
      text(S.sign === 'sale' ? (S.lot ? S.lot.acres + ' acres' : '') : '🎉', signX + 20, G - 40, 8, '#333', 'center', true);
    }
    if (!S.plan || pv) return;
    const W = geo.W;
    const siteOn = A('temp') > 0 && A('clean') < 1;
    if (siteOn) {
      const px = 940, dx = 858;
      // porta-potty
      rect(px, G - 58, 30, 58, '#2f6fbf'); rect(px - 2, G - 62, 34, 6, '#e8e8e8'); rect(px + 4, G - 50, 22, 46, '#3b7dd8'); rect(px + 20, G - 30, 3, 6, '#ddd');
      text('🚻', px + 15, G - 40, 11, '#fff');
      // dumpster
      poly([[dx - 50, G], [dx + 40, G], [dx + 44, G - 30], [dx - 54, G - 30]], '#2e7d32'); rect(dx - 54, G - 33, 98, 5, '#1b5e20');
      const r = new RNG(9); for (let k = 0; k < 10; k++) { ctx.save(); ctx.translate(dx - 45 + r.f(0, 80), G - 33); ctx.rotate(r.f(-0.6, 0.6)); rect(-8, -3, 16, 3, r.pick(['#d9b77e', '#c9a563', '#eee', '#999'])); ctx.restore(); }
      // permit board & builder sign
      line(signX, G, signX, G - 50, '#6b4a33', 3);
      rect(signX - 18, G - 70, 36, 24, '#fdfdfd'); ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.strokeRect(signX - 18, G - 70, 36, 24);
      text('PERMIT', signX, G - 63, 7, '#c0392b', 'center', true); text('#' + (S.seed % 90000 + 10000), signX, G - 54, 7, '#333', 'center', true);
      // temp power pole
      const tx = 112; line(tx, G, tx, G - 90, '#7a5a3a', 4); rect(tx - 6, G - 50, 12, 16, '#9aa3ab'); line(tx, G - 88, 60, G - 120, '#222', 1);
    }
    // layout stakes & strings
    const la = A('layout');
    if (la > 0 && A('excavate') < 0.3) {
      const xs = [0, W]; if (geo.gW) xs.push(-geo.gW);
      xs.forEach(x => { line(X(x), G, X(x), G - 10, '#b58a50', 3); poly([[X(x), G - 10], [X(x) + 7, G - 8], [X(x), G - 6]], '#ff7f11'); });
      line(X(geo.gW ? -geo.gW : 0), G - 6, X(W), G - 6, '#ff5ea8', 1);
      [[-3, -1], [W + 1, W + 3]].forEach(([a, b]) => { line(X(a), G, X(a), G - 14, '#b58a50', 2); line(X(b), G, X(b), G - 14, '#b58a50', 2); line(X(a), G - 12, X(b), G - 12, '#d9b77e', 3); });
    }
  }

  // ---------- vehicles ----------
  function drawVehicles() {
    if (!S.plan || S.preview) return;
    const v = S.vehicle, s = Math.max(5, Math.min(8.5, geo.s)), W = geo.W;
    if (!v) return;
    if (v === 'excavator') excavator(Math.max(150, geo.left - 14 * s), G, s);
    if (v === 'mixer') mixer(Math.max(95, geo.left - 30 * s), G, s);
    if (v === 'lumber') truck(Math.max(95, geo.left - 30 * s), G, s, 'lumber');
    if (v === 'crane') crane(Math.min(LW - 150, X(W) + 8 * s), G, s);
    if (v === 'van') van(Math.max(95, geo.left - 22 * s), G, s, S.trade);
    if (v === 'skid') skid(X(W) + 12 * s + Math.sin(T * 0.8) * 20, G, s);
    if (v === 'drill') drill(X(W) + 26 * geo.s, G, s);
    if (v === 'inspector') pickup(Math.max(95, geo.left - 22 * s), G, s);
    if (v === 'moving') movingTruck(Math.max(95, geo.left - 30 * s), G, s);
  }
  function wheels(xs, y, s) { xs.forEach(x => { circ(x, y - 1.3 * s, 1.3 * s, '#1e1e1e'); circ(x, y - 1.3 * s, 0.6 * s, '#9a9a9a'); }); }
  function excavator(x, y, s) {
    rr(x - 7 * s, y - 2.4 * s, 14 * s, 2.4 * s, 1.2 * s, '#2b2b2b'); for (let k = -5; k <= 5; k += 2.5) circ(x + k * s, y - 1.2 * s, 0.7 * s, '#555');
    rect(x - 6 * s, y - 6.6 * s, 10 * s, 4.2 * s, '#f2b705'); rect(x - 6.8 * s, y - 6 * s, 2 * s, 3.4 * s, '#c89400');
    rect(x - 1.5 * s, y - 10.5 * s, 4.5 * s, 4 * s, '#f2b705'); rect(x - 1 * s, y - 10 * s, 3.5 * s, 2.6 * s, 'rgba(170,215,240,0.9)');
    const px = x + 3 * s, py = y - 6 * s;
    const a1 = -0.75 + 0.18 * Math.sin(T * 1.4), a2 = a1 + 2.0 + 0.35 * Math.sin(T * 1.4 + 1);
    const ex = px + Math.cos(a1) * 11 * s, ey = py + Math.sin(a1) * 11 * s;
    const bx = ex + Math.cos(a2) * 8 * s, by = ey + Math.sin(a2) * 8 * s;
    line(px, py, ex, ey, '#e0a800', 1.4 * s); line(ex, ey, bx, by, '#e0a800', 1 * s); line(px, py, ex, ey, '#f2b705', 1.0 * s);
    ctx.save(); ctx.translate(bx, by); ctx.rotate(a2 + 0.8); poly([[0, 0], [2.4 * s, -0.4 * s], [2.2 * s, 1.8 * s], [0.2 * s, 1.6 * s]], '#555'); ctx.restore();
  }
  function mixer(x, y, s) {
    rect(x, y - 3.5 * s, 26 * s, 1.2 * s, '#555');
    rr(x, y - 9 * s, 7 * s, 6 * s, 1 * s, '#e74c3c'); rect(x + 0.8 * s, y - 8.4 * s, 4 * s, 2.6 * s, 'rgba(170,215,240,0.9)');
    ctx.save(); ctx.beginPath(); ctx.ellipse(x + 16 * s, y - 7.8 * s, 9 * s, 4.2 * s, -0.12, 0, 7); ctx.fillStyle = '#ecf0f1'; ctx.fill(); ctx.clip();
    for (let k = -3; k < 6; k++) { const off = ((T * 18) % (4 * s)); line(x + 8 * s + k * 4 * s + off, y - 12 * s, x + 12 * s + k * 4 * s + off, y - 3 * s, '#e74c3c', 1.2 * s); }
    ctx.restore();
    line(x + 25 * s, y - 6 * s, x + 30 * s, y - 3.5 * s, '#888', 0.8 * s);
    wheels([x + 4 * s, x + 17 * s, x + 21 * s], y, s);
  }
  function truck(x, y, s, kind) {
    rect(x + 7 * s, y - 3.6 * s, 22 * s, 1.2 * s, '#444');
    rr(x, y - 9 * s, 7 * s, 6.5 * s, 1 * s, '#2c6fbb'); rect(x + 0.8 * s, y - 8.4 * s, 4 * s, 2.6 * s, 'rgba(170,215,240,0.9)');
    if (kind === 'lumber') { for (let k = 0; k < 4; k++) { rect(x + 8 * s, y - (4.6 + k * 1.2) * s, 20 * s, 1.1 * s, k % 2 ? '#d9b77e' : '#e4c690'); for (let e = 0; e < 8; e++) circ(x + 28 * s, y - (4.1 + k * 1.2) * s, 0.3 * s, '#b8925a'); } }
    wheels([x + 4 * s, x + 20 * s, x + 25 * s], y, s);
  }
  function crane(x, y, s) {
    rect(x - 2 * s, y - 3.6 * s, 20 * s, 1.4 * s, '#444'); rect(x - 4 * s, y - 2.2 * s, 24 * s, 0.4 * s, '#777');
    rr(x + 12 * s, y - 8 * s, 6 * s, 5.5 * s, 1 * s, '#f39c12'); rect(x + 2 * s, y - 7 * s, 8 * s, 3.4 * s, '#e67e22');
    const bx = x + 4 * s, by = y - 7 * s;
    const tx = X(geo.W * 0.6), ty = Y(geo.wallTop + geo.rise + 10);
    line(bx, by, tx, ty, '#f1c40f', 1.2 * s); line(bx, by, tx, ty, '#d4a106', 0.4 * s);
    const sw = Math.sin(T * 1.2) * 6;
    const cy2 = Y(geo.wallTop + geo.rise + 2);
    line(tx, ty, tx + sw, cy2, '#222', 1);
    poly([[tx + sw - 3 * geo.s, cy2 + 2 * geo.s], [tx + sw + 3 * geo.s, cy2 + 2 * geo.s], [tx + sw, cy2]], null, C.wood, 3);
    wheels([x + 1 * s, x + 7 * s, x + 15 * s], y, s);
  }
  function van(x, y, s, trade) {
    const T2 = trade ? TRADES[trade] : null;
    rr(x, y - 7.5 * s, 17 * s, 5.6 * s, 1.4 * s, '#f5f6f7', '#bbb'); poly([[x + 17 * s, y - 7.5 * s], [x + 20 * s, y - 4.5 * s], [x + 20 * s, y - 1.9 * s], [x + 17 * s, y - 1.9 * s]], '#f5f6f7');
    rect(x + 17 * s, y - 6.8 * s, 2 * s, 2 * s, 'rgba(170,215,240,0.9)');
    rect(x, y - 4.4 * s, 17 * s, 0.9 * s, T2 ? T2.hat : '#3498db');
    line(x + 1 * s, y - 8.2 * s, x + 15 * s, y - 8.2 * s, '#999', 1.5);
    if (T2) text(T2.icon, x + 8 * s, y - 6 * s, Math.max(10, 1.6 * s), '#333');
    wheels([x + 4 * s, x + 15.5 * s], y, s);
  }
  function pickup(x, y, s) {
    rr(x, y - 6 * s, 16 * s, 3.8 * s, 1 * s, '#f5f6f7', '#bbb'); rr(x + 8 * s, y - 8.5 * s, 6 * s, 3 * s, 1 * s, '#f5f6f7', '#bbb'); rect(x + 9 * s, y - 8 * s, 4.4 * s, 2 * s, 'rgba(170,215,240,0.9)');
    text('CITY INSPECTOR', x + 7 * s, y - 4 * s, Math.max(6, 0.9 * s), '#1f4e8c', 'center', true);
    wheels([x + 3.5 * s, x + 12.5 * s], y, s);
  }
  function skid(x, y, s) { rr(x - 3 * s, y - 5 * s, 6 * s, 3.8 * s, 0.8 * s, '#f2b705'); rect(x - 2 * s, y - 4.6 * s, 3 * s, 2 * s, 'rgba(170,215,240,0.8)'); rect(x + 3 * s, y - 2.2 * s, 2 * s, 1.8 * s, '#555'); rr(x - 3.2 * s, y - 1.6 * s, 6.4 * s, 1.6 * s, 0.8 * s, '#222'); }
  function drill(x, y, s) {
    if (x > LW - 20) x = LW - 60;
    rect(x - 12 * s, y - 3.6 * s, 18 * s, 1.2 * s, '#444'); rr(x - 14 * s, y - 8 * s, 5 * s, 5 * s, 1 * s, '#16a085');
    line(x, y - 2 * s, x, y - 26 * s, '#e67e22', 1 * s); line(x - 1 * s, y - 2 * s, x - 1 * s, y - 26 * s, '#d35400', 0.3 * s);
    wheels([x - 11 * s, x - 2 * s, x + 3 * s], y, s);
  }
  function movingTruck(x, y, s) {
    rect(x + 6 * s, y - 11 * s, 20 * s, 9 * s, '#f5f6f7'); ctx.strokeStyle = '#ccc'; ctx.strokeRect(x + 6 * s, y - 11 * s, 20 * s, 9 * s);
    text('🚚 MOVING DAY!', x + 16 * s, y - 6.5 * s, Math.max(8, 1.3 * s), '#e67e22', 'center', true);
    rr(x, y - 8 * s, 6.2 * s, 6 * s, 1 * s, '#e67e22'); rect(x + 0.8 * s, y - 7.4 * s, 3.5 * s, 2.4 * s, 'rgba(170,215,240,0.9)');
    wheels([x + 3.5 * s, x + 19 * s, x + 23 * s], y, s);
    const bx = x + 28 * s + Math.sin(T) * 3; rect(bx, y - 2.5 * s, 2.5 * s, 2.5 * s, '#c89f67'); rect(bx + 0.3 * s, y - 4.8 * s, 2 * s, 2.3 * s, '#d7ae76');
  }

  // ---------- people ----------
  function person(x, y, s, o) { // y = feet on ground (px)
    const hgt = (o.h || 5.8) * s;
    const bob = o.walk ? Math.abs(Math.sin(T * 6 + o.ph)) * 0.15 * s : 0;
    const legSw = o.walk ? Math.sin(T * 6 + o.ph) * 0.35 * s : 0;
    const hip = y - hgt * 0.47 - bob, sh = y - hgt * 0.8 - bob;
    line(x, hip, x - legSw, y, o.pants || '#2c3e66', Math.max(2, 0.4 * s)); line(x, hip, x + legSw, y, o.pants || '#2c3e66', Math.max(2, 0.4 * s));
    rr(x - 0.55 * s, sh, 1.1 * s, hip - sh, 0.3 * s, o.shirt || '#e67e22');
    if (o.vest) { rect(x - 0.55 * s, sh, 1.1 * s, hip - sh, '#c6ff1a'); rect(x - 0.55 * s, sh + (hip - sh) * 0.55, 1.1 * s, Math.max(1, 0.15 * s), '#d7dde0'); }
    const arm = o.hammer ? Math.sin(T * 8 + o.ph) * 1.1 : o.wave ? -2.4 + Math.sin(T * 7 + o.ph) * 0.5 : 0.2;
    const ax = x + Math.sin(arm) * 1.9 * s, ay = sh + 0.2 * s + Math.cos(arm) * 1.9 * s;
    line(x, sh + 0.2 * s, ax, ay, o.skin || '#e0ac69', Math.max(1.5, 0.3 * s)); line(x, sh + 0.2 * s, x - 0.4 * s, hip, o.skin || '#e0ac69', Math.max(1.5, 0.3 * s));
    if (o.hammer) { line(ax, ay, ax + Math.sin(arm + 1.4) * 0.9 * s, ay + Math.cos(arm + 1.4) * 0.9 * s, '#6b4a33', 1.5); }
    if (o.clip) rect(ax - 0.3 * s, ay - 0.6 * s, 0.7 * s, 0.9 * s, '#f5f5f5');
    const hy = sh - 0.5 * s;
    circ(x, hy, 0.48 * s, o.skin || '#e0ac69');
    if (o.hat) { ctx.beginPath(); ctx.arc(x, hy - 0.05 * s, 0.55 * s, Math.PI, 0); ctx.fillStyle = o.hat; ctx.fill(); rect(x - 0.72 * s, hy - 0.1 * s, 1.44 * s, Math.max(1, 0.14 * s), o.hat); }
    else if (o.hair) { ctx.beginPath(); ctx.arc(x, hy - 0.1 * s, 0.5 * s, Math.PI, 0); ctx.fillStyle = o.hair; ctx.fill(); }
  }
  const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];
  function drawWorkers() {
    if (!S.plan || S.preview || !S.workers) return;
    const wk = S.workers, g0 = geo, W = g0.W, s = g0.s;
    const Tt = wk.trade ? TRADES[wk.trade] : { hat: '#f1c40f', shirt: '#e67e22' };
    const r = new RNG(7);
    for (let k = 0; k < wk.n; k++) {
      let xf, yf;
      const ph = k * 1.9, wobble = Math.sin(T * 0.4 + ph) * 3;
      const zone = wk.zone;
      if (zone === 'hole') { xf = r.f(1, W - 1) + wobble; yf = g0.found === 'basement' ? (A('pourFoot') >= 1 ? g0.floorB : g0.footTop) : 0; if (g0.found !== 'basement') xf = k % 2 ? r.f(-1, 1.5) : W + r.f(-1.5, 1); }
      else if (zone === 'deck') { xf = r.f(1, W - 1) + wobble; yf = g0.found === 'slab' ? g0.y1 : g0.yFW; }
      else if (zone === 'floor0') { xf = r.f(1, W - 1) + wobble; yf = g0.y1; }
      else if (zone === 'floor1') { xf = r.f(1, W - 1) + wobble; yf = floorY(1); }
      else if (zone === 'roof') { xf = g0.D / 2 + r.f(0, Math.max(1, W - g0.D)) + wobble * 0.5; yf = g0.wallTop + g0.rise * r.f(0.3, 0.8); }
      else if (zone === 'inside') { const fl = k % g0.stories; xf = r.f(2, W - 2) + wobble; yf = floorY(fl); }
      else if (zone === 'yardR') { xf = W + 10 + r.f(0, 15) + wobble; yf = 0; }
      else if (zone === 'yardL') { xf = -g0.gW - 8 - r.f(0, 10) + wobble; yf = 0; }
      else if (zone === 'walls') { xf = r.f(1, W - 1) + wobble; yf = k % 2 && g0.stories > 1 ? floorY(1) - 0.5 : 0; }
      else { xf = r.f(-g0.gW, W + 6) + wobble; yf = 0; }
      if (zone === 'walls' && yf > 1) rect(X(xf) - 20, Y(yf), 40, 3, '#9a7b4f');
      person(X(xf), Y(yf), Math.min(s, 8), { hat: Tt.hat, shirt: Tt.shirt, vest: k % 2 === 0, walk: true, hammer: k % 2 === 1, ph, skin: SKINS[(k * 3 + (S.seed || 0)) % 5] });
    }
    if (S.inspector) person(geo.left - 4 * s, G, Math.min(s, 8), { hat: '#ffffff', shirt: '#1f4e8c', clip: true, walk: false, ph: 0, skin: '#c68642' });
  }
  function drawFamilyScene() {
    if (!S.moveIn || !S.family) return;
    const s = Math.min(geo.s, 8), f = S.family;
    const x0 = Math.min(LW - 120, X(geo.W) + 7 * s);
    const people = [];
    f.adults.forEach((a, i) => people.push({ h: 5.7 - i * 0.2, shirt: ['#2980b9', '#c0392b'][i % 2], hair: ['#3b2a1a', '#8e5b2c', '#111'][i % 3] }));
    f.kids.forEach((k, i) => people.push({ h: 2.8 + Math.min(k.age, 12) * 0.2, shirt: ['#27ae60', '#f39c12', '#9b59b6', '#e84393'][i % 4], hair: ['#6b4423', '#f1c27d', '#111', '#b5651d'][i % 4] }));
    people.forEach((pp, i) => person(x0 + i * 2.0 * s, G, s, Object.assign(pp, { wave: true, ph: i, skin: SKINS[(i + (S.seed || 0)) % 5], pants: '#34495e' })));
    if (f.pet) { const px = x0 + people.length * 2.2 * s + 6, py = G - Math.abs(Math.sin(T * 5)) * 4; text(f.pet.emoji, px, py - 6, Math.max(14, 1.8 * s), '#000'); }
  }

  // ---------- callout label pointing at the part being built ----------
  function drawCallout() {
    if (!S.callout || !S.plan || S.preview) return;
    const g0 = geo, W = g0.W, id = S.callout;
    const mid = W / 2;
    const M = {
      call811: [-12, 0.3, 'Utility flags'], clear: [W / 2, 0, 'Clearing'], silt: [W + 10, 1, 'Silt fence'], temp: [W + 30, 4, 'Porta-potty & dumpster'], layout: [0, 1, 'Stakes & string'],
      excavate: [mid, g0.footBot * 0.5, g0.found === 'basement' ? 'Basement hole' : 'Footing trench'], forms: [W - 0.3, g0.footBot + 0.5, 'Forms & rebar'], pourFoot: [W - 0.3, g0.footBot + 0.5, 'Footing'],
      underslab: [mid, -0.9, 'Drain pipes'], fwalls: [W - 0.3, g0.found === 'slab' ? g0.y1 - 0.2 : g0.footTop + 3, g0.found === 'slab' ? 'Slab' : 'Foundation wall'], cure: [W - 0.3, g0.footTop + 2, 'Curing concrete'],
      waterproof: [W + 0.1, g0.footTop + 2, 'Waterproofing'], backfill: [W + 2, -1.5, 'Backfill'], deck: [mid, g0.y1 - 0.4, g0.found === 'slab' ? 'Sill plate' : 'Floor joists'],
      walls1: [W * 0.3, g0.y1 + 4, 'Studs'], floor2: [mid, floorY(1) - 0.5, 'Joists'], walls2: [W * 0.3, floorY(1) + 4, 'Studs'], trusses: [mid, g0.wallTop + g0.rise * 0.5, 'Trusses'],
      sheathing: [W * 0.7, g0.wallTop + g0.rise * 0.4, 'OSB sheathing'], roofing: [W * 0.4, g0.wallTop + g0.rise * 0.5, 'Shingles'], wrap: [W * 0.8, g0.y1 + 4, 'House wrap'],
      windows: [(S.plan.floors[0].frontWin[0] || { x: 3 }).x + 1, g0.y1 + 4, 'Window'], plumbRough: [(wetXs(0)[0] || 3), g0.y1 + 2, 'Pipes'], hvacRough: [W * 0.7, g0.found === 'basement' ? g0.yFW - 0.6 : g0.wallTop + 1.8, 'Ducts'],
      elecRough: [W * 0.5, g0.y1 + 2.1, 'Wires & boxes'], insulation: [W * 0.3, g0.y1 + 5, 'Insulation'], drywallHang: [W * 0.4, g0.y1 + 5, 'Drywall'], drywallFin: [W * 0.4, g0.y1 + 4, 'Mud & tape'],
      siding: [W * 0.6, g0.y1 + 5, 'Siding'], gutters: [W * 0.9, g0.wallTop - 0.3, 'Gutter'], paint: [W * 0.4, g0.y1 + 5, 'Paint'], flatwork: [-g0.gW - 6, 0, 'Driveway'],
      utilities: [-g0.gW - 8, -g0.frost - 0.8, 'Buried pipes'], septic: [W + 12, -3, 'Septic tank'], well: [W + 26, -5, 'Well'], flooring: [W * 0.4, g0.y1, 'Flooring'],
      cabinets: [(S.plan.floors[0].back.find(r => r.type === 'kitchen') || { x: 2, w: 4 }).x + 3, g0.y1 + 3, 'Cabinets'], landscape: [W + 6, 0.5, 'Sod & plants'],
    };
    const c = M[id]; if (!c) return;
    const px = X(c[0]), py = Y(c[1]);
    const lx = Math.max(60, Math.min(LW - 60, px + (px > 500 ? -70 : 70))), ly = Math.max(24, py - 50);
    line(px, py, lx, ly, '#fff', 2.5); line(px, py, lx, ly, '#e74c3c', 1.5); circ(px, py, 3.5, '#e74c3c');
    ctx.font = 'bold 13px system-ui, sans-serif';
    const tw = ctx.measureText(c[2]).width + 16;
    rr(lx - tw / 2, ly - 12, tw, 24, 12, '#fffdf2', '#e74c3c');
    text(c[2], lx, ly + 0.5, 13, '#c0392b', 'center', true);
  }

  function drawWeatherFx() {
    const w = S.weather ? S.weather.type : 'sun';
    if (w === 'rain' || w === 'storm') {
      ctx.strokeStyle = 'rgba(200,220,240,0.55)'; ctx.lineWidth = 1.2; ctx.beginPath();
      const n = w === 'storm' ? 160 : 100, r = new RNG(3);
      for (let k = 0; k < n; k++) { const x = (r.f(0, LW + 100) + T * 60) % (LW + 100) - 50, y = (r.f(0, LH) + T * 520 * r.f(0.8, 1.2)) % G; ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 12); }
      ctx.stroke();
    }
    if (w === 'snow') {
      const r = new RNG(4); ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (let k = 0; k < 120; k++) { const x = (r.f(0, LW) + Math.sin(T + k) * 12) % LW, y = (r.f(0, G) + T * 40 * r.f(0.6, 1.3)) % G; ctx.beginPath(); ctx.arc(x, y, r.f(1.2, 2.6), 0, 7); ctx.fill(); }
    }
  }

  function burst() {
    const cols = ['#e74c3c', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6', '#e67e22'];
    for (let k = 0; k < 140; k++) confetti.push({ x: 500 + (Math.random() - 0.5) * 300, y: 180, vx: (Math.random() - 0.5) * 12, vy: -Math.random() * 12 - 3, c: cols[k % 6], r: Math.random() * 6, life: 120 });
  }
  function drawConfetti() {
    for (let k = confetti.length - 1; k >= 0; k--) {
      const c = confetti[k]; c.x += c.vx; c.y += c.vy; c.vy += 0.35; c.vx *= 0.99; c.r += 0.2; c.life--;
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.r); rect(-4, -2, 8, 4, c.c); ctx.restore();
      if (c.life <= 0 || c.y > LH) confetti.splice(k, 1);
    }
  }

  // ---------- top-down floor plan (for choosing a design) ----------
  function drawFloorPlan(canvas, plan) {
    const c2 = canvas.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = canvas.clientWidth || 300, ch = canvas.clientHeight || 150;
    canvas.width = cw * dpr; canvas.height = ch * dpr;
    c2.setTransform(dpr, 0, 0, dpr, 0, 0);
    c2.fillStyle = '#f7fbff'; c2.fillRect(0, 0, cw, ch);
    const gW = plan.garage ? 22 : 0;
    const floorsN = plan.floors.length;
    const totalW = (plan.W + gW) + (floorsN > 1 ? plan.W + 6 : 0);
    const sc = Math.min((cw - 16) / totalW, (ch - 30) / plan.D);
    let ox = 8 + (cw - 16 - totalW * sc) / 2;
    const oy = 20;
    c2.font = '600 ' + Math.max(7, Math.min(10, sc * 1.1)) + 'px system-ui, sans-serif'; c2.textAlign = 'center'; c2.textBaseline = 'middle';
    plan.floors.forEach((f, fi) => {
      let x0 = ox + (fi === 0 ? gW * sc : 0);
      if (fi === 0 && gW) {
        c2.fillStyle = '#e3e3de'; c2.fillRect(ox, oy + (plan.D - 24) * sc, gW * sc, 24 * sc); c2.strokeStyle = '#555'; c2.lineWidth = 1.5; c2.strokeRect(ox, oy + (plan.D - 24) * sc, gW * sc, 24 * sc);
        c2.fillStyle = '#666'; c2.fillText('Garage', ox + gW * sc / 2, oy + (plan.D - 12) * sc);
      }
      c2.fillStyle = '#333'; c2.fillText(fi === 0 ? (floorsN > 1 ? '1st floor' : '') : '2nd floor', x0 + plan.W * sc / 2, 9);
      [['back', 0], ['front', plan.rowD]].forEach(([side, dy]) => {
        f[side].forEach(rm => {
          const rx = x0 + rm.x * sc, ry = oy + dy * sc, rw = rm.w * sc, rh = plan.rowD * sc;
          c2.fillStyle = { bath: '#d3edf0', half: '#d3edf0', kitchen: '#fbf1d0', living: '#f4e6cf', master: '#dfe7f4', bed: '#e5f2e5', stairs: '#eee', laundry: '#e0ecf4', entry: '#efe7d8', dining: '#f6e9dc', office: '#ece6f5' }[rm.type] || '#f3f3f3';
          c2.fillRect(rx, ry, rw, rh);
          c2.strokeStyle = '#777'; c2.lineWidth = 1; c2.strokeRect(rx, ry, rw, rh);
          if (rm.type === 'stairs') { c2.strokeStyle = '#aaa'; for (let k = 1; k < 8; k++) { c2.beginPath(); c2.moveTo(rx + rw * k / 8, ry + 2); c2.lineTo(rx + rw * k / 8, ry + rh - 2); c2.stroke(); } }
          c2.fillStyle = '#333';
          const label = rm.name.replace('Main Bedroom', 'Main Bed').replace('Bedroom', 'Bed').replace('Bathroom', 'Bath').replace('Living Room', 'Living');
          if (rw > 14) c2.fillText(label, rx + rw / 2, ry + rh / 2);
        });
      });
      c2.strokeStyle = '#222'; c2.lineWidth = 2.5; c2.strokeRect(x0, oy, plan.W * sc, plan.D * sc);
      // windows
      c2.strokeStyle = '#4aa3df'; c2.lineWidth = 3;
      f.frontWin.forEach(w => { c2.beginPath(); c2.moveTo(x0 + w.x * sc, oy + plan.D * sc); c2.lineTo(x0 + (w.x + w.w) * sc, oy + plan.D * sc); c2.stroke(); });
      f.backWin.forEach(w => { c2.beginPath(); c2.moveTo(x0 + w.x * sc, oy); c2.lineTo(x0 + (w.x + w.w) * sc, oy); c2.stroke(); });
      if (fi === 0) { c2.fillStyle = '#c0392b'; c2.fillRect(x0 + (plan.door - 1.5) * sc, oy + plan.D * sc - 2, 3 * sc, 4); }
      ox = x0 + plan.W * sc + 6 * sc;
    });
  }

  return { init, burst, drawFloorPlan, resize };
})();
