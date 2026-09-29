// ===== Procedural generation: family, lots, house plans, subcontractor bids, quantities =====

function genTown(r) { return r.pick(TOWN_A) + r.pick(TOWN_B); }

function genFamily(r) {
  const last = r.pick(NAMES.last);
  const nAdults = r.chance(0.8) ? 2 : 1;
  const nKids = r.pick([0, 1, 1, 2, 2, 2, 3, 3, 4]);
  const used = new Set();
  const uniq = (list) => { let n; do { n = r.pick(list); } while (used.has(n)); used.add(n); return n; };
  const adults = []; for (let i = 0; i < nAdults; i++) adults.push({ name: uniq(NAMES.adult), emoji: r.pick(NAMES.adultEmoji) });
  const kids = []; for (let i = 0; i < nKids; i++) kids.push({ name: uniq(NAMES.kid), emoji: r.pick(NAMES.kidEmoji), age: r.i(1, 12) });
  let pet = null;
  if (r.chance(0.65)) { const p = r.pick(NAMES.pet); pet = { kind: p[0], emoji: p[1], name: r.pick(p[2]) }; }
  // Bedrooms: 1 for parents + kids (little ones may share), always at least 2
  let beds = 1 + (nKids <= 2 ? nKids : nKids === 3 ? 2 + (r.chance(0.5) ? 1 : 0) : 3);
  if (r.chance(0.35)) beds++; // guest room / office
  beds = Math.max(2, Math.min(5, beds));
  const baths = beds >= 4 ? 2.5 : beds === 3 ? 2 : r.pick([1, 2]);
  const fav = r.pick(COLORS_FAV);
  const wishes = r.shuffle([
    { id: 'yard', text: 'A big yard to play in', icon: '⚽' },
    { id: 'school', text: 'Close to school', icon: '🏫' },
    { id: 'trees', text: 'Lots of trees', icon: '🌳' },
    { id: 'quiet', text: 'A quiet, peaceful spot', icon: '🦉' },
    { id: 'view', text: 'A pretty view', icon: '🏞️' },
  ]).slice(0, 2);
  const reason = r.pick(['Their family is growing!', 'They are moving here for a new job.', 'They want more room for the kids to play.',
    'Grandma is coming to visit a lot and they need space.', 'They have been saving for years to build their dream home!', 'Their old apartment is too small.']);
  return { last, adults, kids, pet, beds, baths, garage: r.chance(0.8), fav: { name: fav[0], color: fav[1] }, wishes, reason };
}

function genLots(r, g) {
  const kinds = r.shuffle(['town', 'edge', 'country']);
  const cm = CLIMATES[g.climate].cost;
  const floodIdx = r.chance(0.55) ? r.i(0, 2) : -1;
  return kinds.map((kind, i) => {
    const L = { id: i, kind };
    L.number = r.i(1, 99) * 10 + r.i(0, 9);
    L.street = r.pick(STREETS) + ' ' + r.pick(STREET_TYPES);
    if (kind === 'town') {
      L.acres = +r.f(0.18, 0.35).toFixed(2); L.perAcre = r.f(180000, 260000); L.trees = r.i(0, 3);
      L.water = 'city'; L.sewer = 'city'; L.school = r.i(2, 6); L.setback = r.i(25, 35);
    } else if (kind === 'edge') {
      L.acres = +r.f(0.45, 1.1).toFixed(2); L.perAcre = r.f(85000, 130000); L.trees = r.i(2, 7);
      L.water = 'city'; L.sewer = r.chance(0.5) ? 'city' : 'septic'; L.school = r.i(6, 12); L.setback = r.i(35, 60);
    } else {
      L.acres = +r.f(1.5, 4).toFixed(2); L.perAcre = r.f(22000, 45000); L.trees = r.i(5, 12);
      L.water = 'well'; L.sewer = 'septic'; L.school = r.i(12, 25); L.setback = r.i(60, 120);
    }
    L.slope = r.pick(kind === 'country' ? ['flat', 'gentle', 'gentle', 'steep'] : ['flat', 'flat', 'gentle', 'steep']);
    L.soil = r.pick(['loam', 'loam', 'clay', 'sandy', 'rocky']);
    L.flood = i === floodIdx;
    L.view = kind !== 'town' && r.chance(0.6);
    L.quiet = kind !== 'town' || r.chance(0.3);
    L.price = Math.round(L.acres * L.perAcre * cm * (L.flood ? 0.72 : 1) * (L.slope === 'steep' ? 0.88 : 1) / 500) * 500;
    L.wellDepth = r.i(140, 380);
    L.percPoor = L.sewer === 'septic' && r.chance(0.3);
    L.fence = r.chance(0.25);
    L.seed = r.i(1, 1e9);
    return L;
  });
}

function lotAddress(L, g) { return `${L.number} ${L.street}, ${g.town}`; }

function lotProsCons(L, fam) {
  const pros = [], cons = [];
  if (L.kind === 'town') { pros.push('City water & sewer are already in the street'); pros.push(`Only ${L.school} minutes to school`); cons.push('Small yard'); cons.push('Land costs a lot per acre'); }
  if (L.kind === 'edge') { pros.push('Medium-size yard'); pros.push('City water nearby'); }
  if (L.kind === 'country') { pros.push('HUGE yard'); pros.push('Land is cheap per acre'); cons.push('Must drill a well (no city water)'); cons.push(`${L.school} minutes to school`); }
  if (L.sewer === 'septic') cons.push('Needs a septic system (no city sewer)');
  if (L.trees >= 6) pros.push('Lots of big trees'); else if (L.trees === 0) pros.push('No trees to clear');
  if (L.slope === 'flat') pros.push('Flat land — easy to build on');
  if (L.slope === 'steep') cons.push('Steep hill — more digging');
  if (L.view) pros.push('Beautiful view');
  if (L.quiet) pros.push('Quiet street');
  if (L.soil === 'rocky') cons.push('Rocky soil — digging may be hard');
  return { pros, cons };
}

// Each wish the lot fulfills makes the family happier
function lotWishScore(L, fam) {
  let s = 0;
  for (const w of fam.wishes) {
    if (w.id === 'yard' && L.acres >= 0.5) s++;
    if (w.id === 'school' && L.school <= 8) s++;
    if (w.id === 'trees' && L.trees >= 5) s++;
    if (w.id === 'quiet' && L.quiet) s++;
    if (w.id === 'view' && L.view) s++;
  }
  return s;
}

// ---------- House plans ----------
const ROOM_INFO = {
  living: { name: 'Living Room', w: 16, pref: 'F' }, entry: { name: 'Entry', w: 7, pref: 'F' }, kitchen: { name: 'Kitchen', w: 14, pref: 'B' },
  dining: { name: 'Dining', w: 11, pref: null }, laundry: { name: 'Laundry', w: 7, pref: 'B' }, master: { name: 'Main Bedroom', w: 14, pref: 'F' },
  bed: { name: 'Bedroom', w: 12, pref: null }, bath: { name: 'Bathroom', w: 8, pref: 'B' }, half: { name: 'Half Bath', w: 5, pref: 'B' },
  stairs: { name: 'Stairs', w: 11, pref: 'B' }, office: { name: 'Office', w: 10, pref: 'F' }, hall: { name: 'Hall', w: 6, pref: null },
};

function buildFloors(r, beds, baths, stories, extra) {
  const full = Math.floor(baths), half = baths % 1 ? 1 : 0;
  const floors = [];
  const mk = (type, n) => ({ type, name: ROOM_INFO[type].name + (n ? ' ' + n : ''), w: ROOM_INFO[type].w + (type === 'bed' ? r.i(-1, 1) : 0), pref: ROOM_INFO[type].pref });
  if (stories === 1) {
    const L = [mk('living'), mk('entry'), mk('kitchen'), mk('dining'), mk('laundry'), mk('master')];
    for (let i = 2; i <= beds; i++) L.push(mk('bed', i));
    for (let i = 1; i <= full; i++) L.push(mk('bath', i > 1 ? i : ''));
    if (half) L.push(mk('half'));
    if (extra) L.push(mk('office'));
    floors.push(L);
  } else {
    const F0 = [mk('stairs'), mk('living'), mk('entry'), mk('kitchen'), mk('dining'), mk('laundry'), mk(half ? 'half' : 'bath')];
    if (extra) F0.push(mk('office'));
    const F1 = [mk('stairs'), mk('master')];
    for (let i = 2; i <= beds; i++) F1.push(mk('bed', i));
    const upBaths = half ? full : Math.max(1, full - 1);
    for (let i = 1; i <= upBaths; i++) F1.push(mk('bath', i > 1 ? i : ''));
    floors.push(F0, F1);
  }
  // Split each floor into a front row and a back row
  const rows = floors.map(L => {
    const front = [], back = [];
    const sum = a => a.reduce((s, x) => s + x.w, 0);
    const fixed = L.filter(x => x.pref), flex = L.filter(x => !x.pref).sort((a, b) => b.w - a.w);
    fixed.forEach(x => (x.pref === 'F' ? front : back).push(x));
    flex.forEach(x => (sum(front) <= sum(back) ? front : back).push(x));
    // keep things balanced: move a bedroom/bath if one side is much longer
    for (let k = 0; k < 4; k++) {
      const big = sum(front) > sum(back) ? front : back, small = big === front ? back : front;
      const diff = sum(big) - sum(small);
      const cand = big.filter(x => x.type !== 'stairs' && x.type !== 'entry' && x.type !== 'kitchen' && x.type !== 'living' && x.w < diff).sort((a, b) => Math.abs(diff / 2 - a.w) - Math.abs(diff / 2 - b.w))[0];
      if (!cand || diff < 6) break;
      big.splice(big.indexOf(cand), 1); small.push(cand);
    }
    const order = (row) => {
      const st = row.filter(x => x.type === 'stairs');
      const rest = r.shuffle(row.filter(x => x.type !== 'stairs'));
      const ei = rest.findIndex(x => x.type === 'entry');
      if (ei >= 0) { const [e] = rest.splice(ei, 1); rest.splice(Math.floor(rest.length / 2), 0, e); }
      return st.concat(rest);
    };
    return { front: order(front), back: order(back) };
  });
  let W = 0;
  rows.forEach(f => { W = Math.max(W, f.front.reduce((s, x) => s + x.w, 0), f.back.reduce((s, x) => s + x.w, 0)); });
  W = Math.ceil(W / 2) * 2;
  rows.forEach(f => ['front', 'back'].forEach(side => {
    const row = f[side];
    const fixedW = row.filter(x => x.type === 'stairs').reduce((s, x) => s + x.w, 0);
    const flexW = row.filter(x => x.type !== 'stairs').reduce((s, x) => s + x.w, 0);
    const k = (W - fixedW) / flexW;
    let x = 0;
    row.forEach(rm => { if (rm.type !== 'stairs') rm.w *= k; rm.x = x; x += rm.w; delete rm.pref; });
  }));
  return { rows, W };
}

function roomWindows(rm, front) {
  const t = rm.type;
  const make = (n, w, h, sill) => { const out = []; for (let k = 0; k < n; k++) out.push({ x: rm.x + rm.w * (k + 1) / (n + 1) - w / 2, w, h, sill }); return out; };
  if (t === 'entry') return [];
  if (t === 'bath' || t === 'half') return make(1, 2, 2.5, 4.5);
  if (t === 'laundry') return front ? make(1, 2.5, 3, 4) : [];
  if (t === 'stairs') return front ? [] : make(1, 2.5, 3.5, 3.5);
  if (t === 'kitchen') return make(1, 3.5, 3.5, 3.6);
  if (t === 'hall') return [];
  if (t === 'living') return make(rm.w >= 15 ? 2 : 1, 3, 5, 2);
  return make(rm.w >= 13.5 ? 2 : 1, 3, 4.5, 2.5);
}

const PLAN_STYLES = { 1: ['Ranch', 'Cottage', 'Bungalow', 'Craftsman'], 2: ['Colonial', 'Farmhouse', 'Traditional', 'Modern'] };

function makePlan(r, g, beds, baths, stories, garage, extra, label) {
  const { rows, W } = buildFloors(r, beds, baths, stories, extra);
  const rowD = r.pick([13, 14, 14, 15]);
  const D = rowD * 2;
  const lot = g.lot;
  let found = r.pick(CLIMATES[g.climate].found);
  if (lot && lot.flood) found = 'crawl';
  const plan = {
    name: 'The ' + r.pick(STREETS).split(' ')[0] + ' ' + r.pick(PLAN_STYLES[stories]), label,
    beds, baths, stories, garage, W, D, rowD, found, floors: rows, pitch: r.pick([5, 6, 6, 7, 8]),
    sqft: W * D * stories, office: !!extra,
  };
  plan.floors.forEach(f => {
    f.frontWin = f.front.flatMap(rm => roomWindows(rm, true));
    f.backWin = f.back.flatMap(rm => roomWindows(rm, false));
  });
  const entry = plan.floors[0].front.find(x => x.type === 'entry');
  plan.door = entry ? entry.x + entry.w / 2 : W / 2;
  // second floor: put a window above the front door
  if (stories > 1) {
    const fw = plan.floors[1].frontWin;
    if (!fw.some(w => Math.abs(w.x + w.w / 2 - plan.door) < 3)) fw.push({ x: plan.door - 1.5, w: 3, h: 4.5, sill: 2.5 });
  }
  return plan;
}

function genPlans(r, g) {
  const f = g.family;
  const halfUp = b => b >= 2 ? b + 0.5 : 2;
  const opts = [
    { beds: Math.max(2, f.beds - 1), baths: Math.max(1, Math.floor(f.baths - 0.5)), garage: r.chance(0.4) && f.garage, extra: false, label: 'Small & cheap' },
    { beds: f.beds, baths: f.baths, garage: f.garage, extra: false, label: 'Just right?' },
    { beds: Math.min(5, f.beds + 1), baths: halfUp(f.baths), garage: true, extra: true, label: 'Big & fancy' },
  ];
  const plans = opts.map(o => {
    const st = o.beds >= 4 ? (r.chance(0.7) ? 2 : 1) : (r.chance(0.35) ? 2 : 1);
    return makePlan(r, g, o.beds, o.baths, st, o.garage, o.extra, o.label);
  });
  return r.shuffle(plans);
}

// ---------- Quantities (a real builder does a "takeoff" from the blueprints) ----------
function computeQty(g, planOverride) {
  const p = planOverride || g.plan, L = g.lot, clim = CLIMATES[g.climate];
  const q = {};
  q.W = p.W; q.D = p.D; q.stories = p.stories; q.found = p.found; q.garage = p.garage;
  q.gW = p.garage ? 22 : 0; q.gD = p.garage ? 24 : 0;
  q.P = 2 * (p.W + p.D); q.gP = p.garage ? q.gW * 2 + q.gD : 0; q.Pall = q.P + q.gP;
  q.foot = p.W * p.D; q.area = q.foot * p.stories;
  q.beds = p.beds; q.baths = Math.ceil(p.baths); q.fullBaths = Math.floor(p.baths);
  q.rooms = p.floors.reduce((s, f) => s + f.front.length + f.back.length, 0);
  q.wins = p.floors.reduce((s, f) => s + f.frontWin.length + f.backWin.length, 0) + 2 * p.stories;
  q.frost = clim.frost;
  q.fwH = p.found === 'basement' ? 9 : p.found === 'crawl' ? clim.frost + 2.5 : clim.frost + 1;
  q.footCY = q.Pall * 2 * 1 / 27;
  q.fwCY = q.P * q.fwH * 0.67 / 27 + q.gP * (clim.frost + 1) * 0.67 / 27;
  q.slabCY = (p.found === 'crawl' ? 0 : q.foot * 0.33 / 27) + q.gW * q.gD * 0.33 / 27;
  const digDepth = p.found === 'basement' ? 9 : p.found === 'crawl' ? clim.frost + 1 : clim.frost + 1;
  q.digCY = p.found === 'basement' ? (p.W + 4) * (p.D + 4) * digDepth / 27 : q.Pall * 2.5 * digDepth / 27;
  if (L.slope === 'steep') q.digCY *= 1.4;
  q.joists = (Math.ceil(p.W / 1.333) + 1);
  q.subSheets = Math.ceil(q.foot / 32 * 1.1);
  const intWall = q.foot / 9;
  q.studs1 = Math.round((q.P + intWall) * 0.75 * 1.2 + q.gP * 0.75);
  q.studs2 = Math.round((q.P + intWall) * 0.75 * 1.2);
  q.plates1 = Math.ceil((q.P + intWall + q.gP) * 3 / 16);
  q.plates2 = Math.ceil((q.P + intWall) * 3 / 16);
  q.headers1 = p.floors[0].frontWin.length + p.floors[0].backWin.length + 4 + (p.garage ? 1 : 0);
  q.headers2 = p.stories > 1 ? p.floors[1].frontWin.length + p.floors[1].backWin.length + 2 : 0;
  q.trusses = Math.ceil(p.W / 2) + 1 + (p.garage ? Math.ceil(q.gW / 2) + 1 : 0);
  const slope = Math.sqrt(1 + (p.pitch / 12) ** 2);
  q.roofArea = Math.round((p.W + 3) * (p.D + 3) * slope + (p.garage ? (q.gW + 2) * (q.gD + 2) * slope : 0));
  q.extWall = Math.round(q.P * 9 * p.stories + q.gP * 9);
  q.extSid = q.extWall;
  q.wallSheets = Math.ceil(q.extWall / 32 * 1.1);
  q.roofSheets = Math.ceil(q.roofArea / 32 * 1.1);
  q.bundles = Math.ceil(q.roofArea / 100 * 3 * 1.1);
  q.boardSq = Math.round(q.area * 4.4);
  q.dwSheets = Math.ceil(q.boardSq / 48 * 1.1);
  q.gutterFt = Math.round((p.W + 3) * 2 + (p.garage ? q.gW * 2 : 0));
  q.downs = p.garage ? 6 : 4;
  q.kitLf = 14 + p.beds * 2;
  q.intDoors = q.rooms + p.beds;
  q.hasStairs = p.stories > 1 || p.found === 'basement';
  q.stairSets = (p.stories > 1 ? 1 : 0) + (p.found === 'basement' ? 1 : 0);
  let tile = 0, carpet = 0;
  p.floors.forEach(f => [...f.front, ...f.back].forEach(rm => {
    const a = rm.w * p.rowD;
    if (['bath', 'half', 'laundry', 'entry'].includes(rm.type)) tile += a;
    else if (['bed', 'master'].includes(rm.type)) carpet += a;
  }));
  q.tileSq = Math.round(tile); q.carpetSq = Math.round(carpet); q.woodSq = Math.max(0, Math.round(q.area - tile - carpet));
  q.setback = L.setback; q.driveLen = L.setback + 10;
  q.driveSq = q.driveLen * (p.garage ? 20 : 12) + 60;
  q.driveCY = q.driveSq * 0.33 / 27;
  q.sodSq = Math.min(Math.round(L.acres * 43560 - q.foot - q.driveSq), 9000);
  q.treesCut = Math.min(L.trees, Math.ceil(L.trees * 0.6));
  q.wellDepth = L.wellDepth; q.percPoor = L.percPoor;
  q.cityWater = L.water === 'city'; q.citySewer = L.sewer === 'city';
  q.sidingType = (g.colors && g.colors.siding) || 'vinyl';
  return q;
}

function activeTasks(g, planOverride) {
  const gg = planOverride ? Object.assign({}, g, { plan: planOverride }) : g;
  return TASKS.filter(t => !t.when || t.when(gg));
}
function taskName(t, q) { return typeof t.name === 'function' ? t.name(q) : t.name; }
function taskDays(t, q) { return t.days(q); }
function taskLearn(t, q) { return typeof t.learn === 'function' ? t.learn(q) : t.learn; }
function matsCost(mats, mult) { return mats.reduce((s, m) => s + Math.round(m[1] * m[3] * mult), 0); }

// Full cost estimate for a plan: labor + materials for every task, plus permit fee
function estimateBuild(g, plan) {
  const q = computeQty(g, plan);
  const cm = CLIMATES[g.climate].cost;
  let total = 0, days = 0;
  for (const t of activeTasks(g, plan)) {
    total += Math.round(t.labor(q) * cm) + matsCost(t.mats(q), cm * g.market);
    days += taskDays(t, q);
  }
  total += permitFee(q) + (g.lot.flood ? 15000 : 0) + (g.lot.soil === 'clay' ? 2500 : 0);
  return { total: Math.round(total / 100) * 100, days };
}
function permitFee(q) { return Math.round((1200 + q.area * 0.55) / 10) * 10; }

// ---------- Subcontractor bids ----------
function genBids(g, trade) {
  const r = g.rng, T = TRADES[trade];
  const kinds = r.shuffle(['budget', 'standard', 'premium']);
  const used = new Set();
  return kinds.map(kind => {
    let name;
    do {
      const style = r.i(0, 3);
      const w = r.pick(T.words);
      name = style === 0 ? `${r.pick(NAMES.last)}'s ${w}` : style === 1 ? `${r.pick(COMPANY_ADJ)} ${w}` : style === 2 ? `${r.pick(NAMES.last)} & Sons ${w}` : `${r.pick(NAMES.last)} Brothers ${w}`;
    } while (used.has(name));
    used.add(name);
    let b;
    if (kind === 'budget') b = { price: r.f(0.78, 0.9), quality: r.pick([2, 2.5, 3]), speed: r.f(0.8, 1.02), rel: r.f(0.8, 0.9) };
    else if (kind === 'standard') b = { price: r.f(0.95, 1.06), quality: r.pick([3, 3.5, 4]), speed: r.f(0.95, 1.15), rel: r.f(0.9, 0.96) };
    else b = { price: r.f(1.15, 1.35), quality: r.pick([4, 4.5, 5]), speed: r.f(1.05, 1.35), rel: r.f(0.96, 0.99) };
    if (kind === 'budget' && r.chance(0.12)) b.quality += 1; // hidden gem
    if (kind === 'premium' && r.chance(0.1)) b.quality -= 1;   // fancy but not great
    b.name = name; b.kind = kind; b.trade = trade;
    b.review = r.pick(b.quality >= 4 ? REVIEWS.good : b.quality >= 3 ? REVIEWS.mid : REVIEWS.bad);
    b.years = r.i(2, 35);
    return b;
  });
}
