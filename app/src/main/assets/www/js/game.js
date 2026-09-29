// ===== Game state & rules =====
const SAVE_KEY = 'hardhathero_save_v1';
const STATS_KEY = 'hardhathero_stats_v1';
let g = null;

const SIDING = [['White', '#f2f1ec'], ['Gray', '#9aa3a8'], ['Blue', '#6f8fb0'], ['Sage Green', '#8fa688'], ['Tan', '#cdb892'], ['Yellow', '#e8cf7a'], ['Red Barn', '#9e3b32'], ['Navy', '#34466b'], ['Charcoal', '#4a4f55']];
const ROOFC = [['Charcoal', '#3e4247'], ['Brown', '#5d4a3a'], ['Weathered Wood', '#7b7367'], ['Black', '#232629'], ['Slate Blue', '#4a5866']];
const DOORC = [['Red', '#b0302a'], ['Navy', '#2c3e66'], ['Black', '#1f2326'], ['Green', '#2f6b45'], ['Yellow', '#e3b53b'], ['Wood', '#8a5a33'], ['Blue', '#3b7dd8'], ['White', '#f4f4f0']];
const TRIMC = [['White', '#fbfbf8'], ['Cream', '#efe6cf'], ['Black', '#26292d']];
const SHUTC = [['None', null], ['Black', '#26292d'], ['Navy', '#2c3e66'], ['Forest', '#2e4a36'], ['Red', '#8e2b25'], ['Wood', '#8a5a33']];
const FAV_MATCH = { blue: ['Blue', 'Slate Blue', 'Navy'], green: ['Sage Green', 'Green', 'Forest'], red: ['Red', 'Red Barn'], yellow: ['Yellow'], gray: ['Gray', 'Charcoal'], white: ['White'], tan: ['Tan', 'Wood'], navy: ['Navy'] };

const PUNCH = [['A scuff on the hallway wall', '🖌️', 80], ['A cabinet door is crooked', '🗄️', 60], ['An outlet cover is missing', '🔌', 15], ['The bedroom door sticks', '🚪', 90],
  ['A drywall "nail pop" in the ceiling', '🔨', 70], ['A gap in the caulk by the tub', '🛁', 40], ['A squeaky stair', '🪜', 120], ['A paint drip on a window', '🪟', 50],
  ['A loose towel bar', '🧻', 30], ['A scratch on the new floor', '🪵', 150], ['The gutter leaks at one corner', '🌧️', 110], ['A crooked light switch plate', '💡', 10]];

const WORK_MSGS = {
  site: ['The machines are moving dirt. 🚜', 'Vroom! Scoop, dump, repeat.', 'The operator checks the depth with a laser.'],
  concrete: ['Concrete flows like thick gray pudding!', 'The crew smooths the concrete with trowels.', 'Checking that everything is level.'],
  framing: ['Bang bang! Nail guns are popping.', 'Measure twice, cut once! 📏', 'The frame is going up!', 'Checking walls are straight with a level.'],
  roofing: ['Tap tap tap — shingles are going on.', 'Roofers wear safety harnesses up high.'],
  plumbing: ['Plumbers are connecting pipes.', 'Testing for leaks…', 'Drilling holes through the studs for pipes.'],
  hvac: ['Ducts are being connected.', 'Sealing duct joints with foil tape.'],
  electrical: ['Pulling wires through holes in the studs.', 'Wiring the breaker panel.', 'Labeling every circuit.'],
  insulation: ['Stuffing fluffy insulation into the walls.', 'Blowing insulation into the attic like snow!'],
  drywall: ['Screwing drywall to the studs.', 'Spreading mud on the seams.', 'Sanding… dust everywhere!'],
  siding: ['Siding is going up row by row.', 'Nailing trim around the windows.'],
  painting: ['Rolling on the paint. 🎨', 'Cutting in neat lines along the ceiling.'],
  cabinets: ['Leveling the cabinets carefully.', 'Setting the heavy countertops.'],
  trim: ['Nailing up baseboards.', 'Hanging the doors.'],
  flooring: ['Clicking the floor planks together.', 'Setting tiles with spacers.'],
  landscape: ['Rolling out the sod like a green carpet.', 'Planting bushes and trees.'],
  cleaning: ['Scrubbing every surface until it sparkles!'],
  survey: ['Measuring with a laser and a tripod.'],
  well: ['The drill goes deeper and deeper…'],
  septic: ['Setting the big septic tank in the hole.'],
};

// ---------- helpers ----------
function spend(o, amt, what) { o.spent += amt; o.ledger.push([o.day, what, Math.round(amt)]); }
function learn(id) { if (GLOSSARY[id] && !g.learned.includes(id)) { g.learned.push(id); g.newTerms.push(id); } }
function dateOf(day, o) { o = o || g; return new Date(o.start[0], o.start[1], o.start[2] + day); }
function fmtDate(day, o) { const d = dateOf(day, o); return `${DAYS[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}`; }
function money(n) { return (n < 0 ? '-' : '') + '$' + Math.abs(Math.round(n)).toLocaleString('en-US'); }
function avgQ() { return g.qN ? g.qSum / g.qN : 3.5; }
function cur() { return g.tasks ? TASK[g.tasks[g.ti]] : null; }
function left() { return g.budget - g.spent; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function weatherOn(o, day) {
  const d = dateOf(day, o), m = d.getMonth(), Cl = CLIMATES[o.climate];
  const h = new RNG(hash2(o.seed, day + 1000));
  const temp = Math.round(Cl.temps[m] + h.gauss() * 8);
  const x = h.next();
  let type;
  if (x < Cl.wet[m] * 0.8) type = temp <= 33 ? 'snow' : (h.chance(m >= 4 && m <= 8 ? 0.35 : 0.1) ? 'storm' : 'rain');
  else type = h.pick(['sun', 'sun', 'part', 'part', 'cloud']);
  return Object.assign({ type, temp }, WEATHER[type]);
}
function forecast(n) {
  const out = []; let d = g.day;
  while (out.length < n) { d++; const wd = dateOf(d).getDay(); if (wd === 0 || wd === 6) continue; out.push({ day: d, w: weatherOn(g, d) }); }
  return out;
}
function advanceDay(msgs) {
  g.day++;
  const wd = dateOf(g.day).getDay();
  if (wd === 6) { g.day += 2; if (msgs) msgs.push('🛌 The weekend went by — the crews rested.'); }
  else if (wd === 0) g.day += 1;
  g.weatherToday = weatherOn(g, g.day);
}

function defaultColors(o) {
  const r = new RNG(o.seed + 9);
  const s = r.pick(SIDING), d = r.pick(DOORC), sh = r.pick(SHUTC);
  return { sidingType: 'vinyl', sidingName: s[0], siding: s[1], roofName: 'Charcoal', roof: ROOFC[0][1], doorName: d[0], door: d[1], trimName: 'White', trim: TRIMC[0][1], shutName: sh[0], shutters: sh[1] };
}

// ---------- new game ----------
function makeGame(seed) {
  seed = seed || (100000 + Math.floor(Math.random() * 899999));
  const r = new RNG(seed);
  const o = { v: 1, seed, rng: r };
  o.climate = r.pick(['north', 'middle', 'south']);
  o.market = +r.f(0.96, 1.07).toFixed(3);
  o.town = genTown(r);
  o.family = genFamily(r);
  o.lots = genLots(r, o);
  const yr = new Date().getFullYear();
  const m = r.pick([1, 2, 2, 3, 3, 4, 5, 6, 7, 8]);
  const d = new Date(yr, m, 1); while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
  o.start = [d.getFullYear(), d.getMonth(), d.getDate()];
  o.day = 0;
  // Family budget: middle-priced lot + the plan that fits them, plus a little extra
  const prices = o.lots.map(l => l.price).sort((a, b) => a - b);
  o.lot = o.lots.find(l => l.price === prices[1]);
  const target = makePlan(new RNG(seed + 1), o, o.family.beds, o.family.baths, o.family.beds >= 4 ? 2 : 1, o.family.garage, false, '');
  const est = estimateBuild(o, target);
  o.budget = Math.round((prices[1] + est.total + 6000) * r.f(1.08, 1.13) / 5000) * 5000;
  o.deadlineDay = Math.round(est.days * 1.4 * 1.15 + 50);
  o.targetBuild = est.total;
  o.lot = null;
  Object.assign(o, {
    spent: 0, ledger: [], happy: 60, safety: 85, brain: { right: 0, total: 0 }, qSum: 0, qN: 0, goodNeighbor: 0,
    hired: {}, bids: {}, done: [], learned: ['general_contractor', 'subcontractor', 'budget'], newTerms: [],
    step: 'intro', phase: 'family', viewOverride: null, lastEventDay: -99, weatherDays: 0, previewLot: 0, previewPlan: 0, checked: {}, dayMsgs: [],
  });
  o.weatherToday = weatherOn(o, 0);
  return o;
}
function newGame(seed) { g = makeGame(seed); save(); }

function save() {
  if (!g) return;
  try { const o = Object.assign({}, g, { rng: g.rng.s }); localStorage.setItem(SAVE_KEY, JSON.stringify(o)); } catch (e) { }
}
function load() {
  try {
    const s = localStorage.getItem(SAVE_KEY); if (!s) return false;
    const o = JSON.parse(s); const r = new RNG(0); r.s = o.rng; o.rng = r; g = o;
    if (g.plan) g.q = computeQty(g);
    return true;
  } catch (e) { return false; }
}
function hasSave() { try { const s = localStorage.getItem(SAVE_KEY); return !!s && JSON.parse(s).step !== 'done'; } catch (e) { return false; } }
function stats() { try { return JSON.parse(localStorage.getItem(STATS_KEY)) || { houses: 0, best: 0, stars: 0 }; } catch (e) { return { houses: 0, best: 0, stars: 0 }; } }

// ---------- going back during planning (snapshots of the game) ----------
function snapshot() {
  const o = Object.assign({}, g, { rng: g.rng.s, hist: null });
  g.hist = (g.hist || []).slice(-11);
  g.hist.push(JSON.stringify(o));
}
function canUndo() { return !!(g && g.hist && g.hist.length); }
function undo() {
  if (!canUndo()) return;
  const h = g.hist, o = JSON.parse(h.pop());
  const r = new RNG(0); r.s = o.rng; o.rng = r; o.hist = h;
  g = o;
  if (g.plan) g.q = computeQty(g);
}
// When money runs out mid-build, the family's bank covers it (the game never gets stuck)
function checkOverBudget() {
  if (!g.tasks || left() >= 0 || g.overWarned) return false;
  g.overWarned = true;
  g.happy -= 6;
  learn('loan');
  return true;
}

// ---------- pre-construction ----------
const Game = {
  meetFamily() { g.step = 'family'; g.phase = 'family'; },
  goLand() { g.step = 'land'; g.phase = 'land'; ['survey', 'zoning', 'setback'].forEach(learn); },
  previewLot(i) { g.previewLot = +i; },
  checkLot(i) {
    i = +i; const L = g.lots[i];
    g.lotSel = i; g.previewLot = i;
    if (!g.checked[i]) {
      const cost = 900 + 650 + (L.sewer === 'septic' ? 450 : 0);
      spend(g, cost, `Survey & soil tests for lot ${i + 1}`);
      const f = [];
      f.push({ ok: true, t: `📏 Survey: the lot is exactly ${L.acres} acres. Corner pins found!` });
      if (L.fence) f.push({ ok: true, t: '🏡 The survey found the neighbor\'s fence is 2 feet over the line. Good to know!' });
      if (L.soil === 'clay') f.push({ ok: false, t: '🧪 Soil test: clay soil swells when wet. The engineer wants wider footings (+$2,500).' });
      else if (L.soil === 'rocky') f.push({ ok: false, t: '🧪 Soil test: lots of rock underground. Digging might be harder.' });
      else f.push({ ok: true, t: `🧪 Soil test: good ${L.soil} soil — strong enough to hold a house.` });
      if (L.sewer === 'septic') f.push(L.percPoor ? { ok: false, t: '💧 Perc test: water soaks in slowly. Needs a bigger septic system (+$4,500).' } : { ok: true, t: '💧 Perc test: passed! Water soaks in nicely for a septic system.' });
      if (L.flood) f.push({ ok: false, t: '🌊 Uh-oh! This lot is in a FLOODPLAIN. The house must be raised up, and it costs more (+$15,000).' });
      if (L.slope === 'steep') f.push({ ok: false, t: '⛰️ The hill is steep, so there is extra digging.' });
      g.checked[i] = f;
      ['soil_test', L.sewer === 'septic' ? 'perc_test' : null, L.flood ? 'floodplain' : null, L.water === 'well' ? 'well' : null, L.sewer === 'septic' ? 'septic' : null].forEach(x => x && learn(x));
    }
    g.step = 'landCheck';
  },
  backToLots() { g.step = 'land'; },
  buyLot() {
    const L = g.lots[g.lotSel];
    g.lot = L;
    spend(g, L.price, `Land: ${lotAddress(L, g)}`);
    spend(g, Math.round(L.price * 0.02 / 10) * 10, 'Closing costs (lawyer & title)');
    const wish = lotWishScore(L, g.family);
    g.happy += wish * 5 - (L.flood ? 4 : 0);
    g.wishHits = wish;
    g.plans = genPlans(g.rng, g);
    g.planEst = null;
    g.previewPlan = 0;
    g.colors = defaultColors(g);
    g.step = 'design'; g.phase = 'design';
    ['utilities', 'blueprints', 'floor_plan', 'square_feet', 'closing'].forEach(learn);
  },
  previewPlan(i) { g.previewPlan = +i; },
  choosePlan(i) {
    const p = g.plans[+i], f = g.family;
    g.plan = p;
    g.planFit = 0;
    if (p.beds < f.beds) g.planFit -= 12; else if (p.beds > f.beds) g.planFit += 3;
    if (Math.ceil(p.baths) < Math.ceil(f.baths)) g.planFit -= 6;
    if (f.garage && !p.garage) g.planFit -= 6;
    g.step = 'colors';
  },
  setColor(key, idx) {
    idx = +idx; const c = g.colors;
    if (key === 'sidingType') c.sidingType = ['vinyl', 'fiber'][idx];
    if (key === 'siding') { c.sidingName = SIDING[idx][0]; c.siding = SIDING[idx][1]; }
    if (key === 'roof') { c.roofName = ROOFC[idx][0]; c.roof = ROOFC[idx][1]; }
    if (key === 'door') { c.doorName = DOORC[idx][0]; c.door = DOORC[idx][1]; }
    if (key === 'trim') { c.trimName = TRIMC[idx][0]; c.trim = TRIMC[idx][1]; }
    if (key === 'shutters') { c.shutName = SHUTC[idx][0]; c.shutters = SHUTC[idx][1]; }
  },
  colorsDone() {
    const fav = FAV_MATCH[g.family.fav.name] || [];
    g.colorBonus = (fav.includes(g.colors.sidingName) ? 5 : 0) + (fav.includes(g.colors.doorName) ? 3 : 0) + (fav.includes(g.colors.shutName) ? 2 : 0);
    g.q = computeQty(g);
    g.est = estimateBuild(g, g.plan);
    g.step = 'estimate';
    learn('contingency');
  },
  backToDesign() { g.plan = null; g.step = 'design'; },
  // Sell the lot back (a real sale loses the closing costs) and pick different land
  sellLand() {
    const L = g.lot, back = Math.round(L.price * 0.97 / 10) * 10;
    g.spent -= back; g.ledger.push([g.day, `Sold the land: ${lotAddress(L, g)}`, -back]);
    g.happy -= (g.wishHits || 0) * 5 - (L.flood ? 4 : 0);
    g.lot = null; g.plan = null; g.plans = null; g.planEst = null;
    g.step = 'land'; g.phase = 'land';
    g.toast = `🏷️ Land sold for ${money(back)}. Selling costs a little money, so choose carefully!`;
  },
  // Borrow more from the bank so the house fits the budget
  bankLoan() {
    const need = Math.round(g.est.total * 1.1) - left();
    const extra = Math.ceil(need / 5000) * 5000;
    g.budget += extra; g.loanExtra = (g.loanExtra || 0) + extra;
    g.happy -= clamp(Math.round(extra / 6000), 4, 20);
    learn('loan');
    g.toast = `🏦 The bank lent the family ${money(extra)} more. They will have to pay it back, so they're ${extra > 50000 ? 'VERY' : 'a little'} worried.`;
  },
  goPermit() {
    g.happy += (g.planFit || 0) + (g.colorBonus || 0);
    g.step = 'permit'; g.phase = 'permit';
    learn('permit'); learn('building_code');
  },
  submitPermit() {
    spend(g, permitFee(g.q), 'Building permit fee');
    g.permitNeed = g.rng.i(5, 9); g.permitProg = 0;
    g.permitIssue = g.rng.chance(0.5) ? g.rng.pick([
      'The plan reviewer says: "Please show smoke detectors in every bedroom on the blueprints."',
      'The plan reviewer says: "The stairs need a handrail drawn on the plans."',
      'The plan reviewer says: "Please add the engineer\'s stamp for the roof trusses."',
      'The zoning officer says: "Show the setback distances from the property lines."']) : null;
    g.permitIssueState = g.permitIssue ? 'pending' : null;
    g.step = 'permitWait';
  },
  waitPermitDay() {
    const msgs = []; advanceDay(msgs);
    if (g.permitIssueState === 'open') return;
    g.permitProg++;
    msgs.push(g.rng.pick(['The building department is reviewing your blueprints… 📋', 'The plan reviewer is checking the math…', 'Waiting on the town…']));
    if (g.permitIssueState === 'pending' && g.permitProg >= 2) { g.permitIssueState = 'open'; msgs.push('📝 The town has a question about the plans!'); }
    g.dayMsgs = msgs;
    if (g.permitProg >= g.permitNeed) g.step = 'permitDone';
  },
  fixPermit() { spend(g, 350, 'Plan revision by the architect'); g.permitIssueState = 'fixed'; g.dayMsgs = ['✏️ The architect fixed the blueprints and sent them back.']; },
  startBuild() {
    g.tasks = activeTasks(g).map(t => t.id);
    g.ti = 0;
    g.buildStartDay = g.day;
    g.hist = null; // no more going back once building starts
    learn('safety');
    beginTask();
  },
  // ----- construction -----
  answer(id) {
    const t = cur();
    if (id === t.id) {
      g.brain.total++;
      if (!g.quiz.wrong.length) g.brain.right++;
      g.quiz.correct = true;
      return true;
    }
    if (!g.quiz.wrong.includes(id)) g.quiz.wrong.push(id);
    return false;
  },
  quizNext() { afterQuiz(); },
  hire(i) {
    const t = cur(); const b = g.bids[t.trade][+i];
    g.hired[t.trade] = b;
    learn('bid');
    goOrder();
  },
  order() {
    const t = cur(), m = orderList(t);
    const total = matsCost(m, 1);
    if (total > 0) spend(g, total, `Materials: ${taskName(t, g.q)}`);
    startWork();
  },
  workDay() { return workDay(); },
  eventChoice(i) {
    const ev = EVENTS.find(e => e.id === g.event.id);
    const msg = ev.choices[+i][1](g);
    g.event.result = msg;
    g.happy = clamp(g.happy, 0, 100); g.safety = clamp(g.safety, 0, 100);
    if (ev.id === 'change') learn('change_order');
    if (ev.id === 'hardhat' || ev.id === 'heat') learn('safety');
  },
  eventClose() {
    g.event = null;
    const t = cur();
    if (g.step === 'work' && g.prog >= taskDays(t, g.q) - 1e-6) finishWork();
  },
  callInspector() {
    const msgs = []; advanceDay(msgs);
    const I = INSPECTIONS[g.insp.id];
    const trades = I.trades.filter(tr => g.hired[tr]);
    const q = trades.length ? trades.reduce((s, tr) => s + g.hired[tr].quality, 0) / trades.length : 3.5;
    const p = g.insp.tries > 0 ? 0.95 : Math.min(0.96, 0.4 + q * 0.11);
    learn('inspection');
    if (g.rng.chance(p)) { g.insp.state = 'pass'; }
    else { g.insp.state = 'fail'; g.insp.fail = g.rng.pick(I.fails); g.inspFails = (g.inspFails || 0) + 1; }
    g.dayMsgs = msgs;
  },
  fixInspection() {
    const f = g.insp.fail;
    spend(g, f.cost, `Fix: ${f.fix}`);
    for (let k = 0; k < f.days; k++) advanceDay();
    g.insp.state = 'ready'; g.insp.tries++; g.insp.fail = null;
  },
  inspDone() { g.insp = null; completeTask(); },
  nextPhase() { beginTask(); },
  startPunch() {
    const n = clamp(Math.round(6.4 - avgQ()) + g.rng.i(0, 1), 1, 6);
    g.punch = g.rng.shuffle(PUNCH.slice()).slice(0, n).map(p => ({ text: p[0], icon: p[1], cost: p[2], fixed: false }));
    g.step = 'punch'; learn('punch_list');
  },
  fixPunch(i) {
    const p = g.punch[+i]; if (p.fixed) return;
    p.fixed = true; spend(g, p.cost, `Punch list: ${p.text}`);
    if (g.punch.every(x => x.fixed)) { advanceDay(); g.step = 'closing'; learn('closing'); }
  },
  handKeys() {
    g.score = finalScores();
    g.step = 'done';
    const st = stats(); st.houses++; st.stars += g.score.total; st.best = Math.max(st.best, g.score.total);
    try { localStorage.setItem(STATS_KEY, JSON.stringify(st)); } catch (e) { }
  },
  setView(v) { g.viewOverride = v; },
};

function orderList(t) {
  const m = t.mats(g.q).map(x => [x[0], x[1], x[2], Math.round(x[3] * g.market * 100) / 100]);
  if (t.id === 'forms' && g.lot.soil === 'clay') m.push(['Wider engineered footings (clay soil)', 1, 'job', 2500]);
  if (t.id === 'fwalls' && g.lot.flood) m.push(['Raise the house above flood level', 1, 'job', 15000]);
  return m;
}

function makeQuiz() {
  const ids = g.tasks, ti = g.ti, r = g.rng;
  const name = id => taskName(TASK[id], g.q);
  const cn = name(ids[ti]);
  const pool = r.shuffle(ids.slice(ti + 3, ti + 14)).filter(id => name(id) !== cn);
  const picks = pool.slice(0, 2);
  const earlier = r.shuffle(ids.slice(Math.max(0, ti - 5), ti));
  while (picks.length < 2 && earlier.length) picks.push(earlier.pop());
  if (!picks.length) return null;
  return { choices: r.shuffle([ids[ti], ...picks]), wrong: [], correct: false };
}

function beginTask() {
  const t = cur();
  if (g.phase !== t.ph) g.viewOverride = null;
  g.phase = t.ph; g.prog = 0; g.dayMsgs = []; g.workingToday = false;
  g.quiz = makeQuiz();
  if (g.quiz) g.step = 'quiz'; else afterQuiz();
}
function afterQuiz() {
  const t = cur();
  if (t.trade && !g.hired[t.trade]) {
    if (!g.bids[t.trade]) g.bids[t.trade] = genBids(g, t.trade);
    g.step = 'hire';
  } else goOrder();
}
function tradeLaborTotal(trade, bid) {
  const cm = CLIMATES[g.climate].cost;
  return g.tasks.map(id => TASK[id]).filter(t => t.trade === trade).reduce((s, t) => s + Math.round(t.labor(g.q) * cm * bid.price), 0);
}
function goOrder() {
  const t = cur();
  if (orderList(t).length) g.step = 'order'; else startWork();
}
function startWork() { g.step = 'work'; g.prog = 0; g.dayMsgs = []; g.workingToday = false; }

function workDay() {
  const t = cur(), q = g.q, msgs = [];
  advanceDay(msgs);
  const w = g.weatherToday;
  const sub = t.trade ? g.hired[t.trade] : null;
  g.workingToday = false;
  if (t.wait) {
    g.prog += 1;
    if (t.id === 'call811') msgs.push(g.prog >= 2 ? '🚩 The locators came and marked the buried lines with paint and flags!' : '📞 Waiting for the 811 locators to come…');
    else if (t.id === 'cure') msgs.push(g.rng.pick(['The concrete is curing and getting stronger… 💪', 'The crew sprays water on the concrete so it cures slowly and strong.', 'Tap tap — it is getting harder every day!']));
    else msgs.push('Waiting…');
  } else if (t.out && w.bad) {
    msgs.push(`${w.icon} ${w.name}! Outdoor work had to stop today.`);
    g.weatherDays++; learn('weather_delay');
  } else if (t.conc && w.temp < 40) {
    msgs.push(`🥶 Only ${w.temp}°F — too cold to pour concrete! It could freeze before it cures.`);
    g.weatherDays++; learn('weather_delay');
  } else if (sub && !g.rng.chance(sub.rel)) {
    msgs.push(`😴 ${sub.name} did not show up today!`);
  } else {
    g.prog += sub ? sub.speed : 1;
    g.workingToday = true;
    msgs.push(g.rng.pick(WORK_MSGS[t.trade] || ['Setting up the job site: porta-potty, dumpster and power pole.']));
    if (!t.out && w.bad) msgs.push(`${w.icon} ${w.name} outside — good thing this crew works indoors!`);
  }
  g.dayMsgs = msgs;
  // random events
  if (g.workingToday && g.day - g.lastEventDay > 5 && g.rng.chance(0.16)) {
    const pool = EVENTS.filter(e => e.when(g, t) && (e.id !== 'rock' || g.lot.soil === 'rocky' || g.rng.chance(0.3)) && (e.id !== 'mud' || g.weatherDays > 1));
    if (pool.length) {
      const ev = g.rng.pick(pool);
      g.event = { id: ev.id, icon: ev.icon, title: ev.title, text: typeof ev.text === 'function' ? ev.text(g) : ev.text, choices: ev.choices.map(c => c[0]), result: null };
      g.lastEventDay = g.day;
      return 'event';
    }
  }
  if (g.prog >= taskDays(t, q) - 1e-6) { finishWork(); return 'done'; }
  return 'day';
}

function finishWork() {
  const t = cur(), q = g.q, sub = t.trade ? g.hired[t.trade] : null;
  const cm = CLIMATES[g.climate].cost;
  const labor = Math.round(t.labor(q) * cm * (sub ? sub.price : 1));
  if (labor > 0) spend(g, labor, `Labor: ${sub ? sub.name : 'your crew'} — ${taskName(t, q)}`);
  if (sub) { g.qSum += clamp(sub.quality + g.rng.f(-0.4, 0.4), 1, 5); g.qN++; }
  g.done.push(t.id);
  taskLearn(t, q).forEach(learn);
  g.justDone = t.id;
  if (t.insp) { g.insp = { id: t.insp, state: 'ready', tries: 0 }; g.step = 'inspect'; }
  else completeTask();
}
function completeTask() {
  const t = cur();
  g.ti++;
  g.toast = t.id === 'windows' ? '🎉 The house is DRIED IN! Rain can\'t get inside now.' : `✅ Done: ${taskName(t, g.q)}`;
  if (g.ti >= g.tasks.length) { g.step = 'co'; learn('co'); return; }
  const nt = cur();
  if (nt.ph !== t.ph) { g.step = 'phaseDone'; g.phaseDoneId = t.ph; g.fact = g.rng.pick(FACTS); }
  else beginTask();
}

function finalScores() {
  const lft = left(), pct = lft / g.budget;
  const late = g.day - g.deadlineDay;
  const q = avgQ();
  let happy = g.happy + (q - 3) * 6 + (pct >= 0 ? 5 : -10) + (late <= 0 ? 6 : -Math.ceil(late / 7) * 2);
  happy = Math.round(clamp(happy, 5, 100));
  const brainPct = g.brain.total ? g.brain.right / g.brain.total : 1;
  const st = {
    budget: pct >= 0.04 ? 3 : pct >= 0 ? 2 : 1,
    time: late <= 0 ? 3 : late <= 21 ? 2 : 1,
    quality: q >= 4.1 ? 3 : q >= 3.2 ? 2 : 1,
    happy: happy >= 85 ? 3 : happy >= 65 ? 2 : 1,
    brain: brainPct >= 0.8 ? 3 : brainPct >= 0.55 ? 2 : 1,
    safety: g.safety >= 85 ? 3 : g.safety >= 65 ? 2 : 1,
  };
  const total = Object.values(st).reduce((a, b) => a + b, 0);
  const rank = total >= 17 ? 'Master Builder 🏆' : total >= 14 ? 'Pro General Contractor 🥇' : total >= 11 ? 'Journeyman Builder 🥈' : 'Apprentice Builder 🥉';
  return { st, total, rank, happy, left: lft, late, q, brainPct, days: g.day - (g.buildStartDay || 0), totalDays: g.day };
}

// ---------- what the renderer should draw ----------
let demo = null;
function makeDemo() {
  const o = makeGame(100000 + Math.floor(Math.random() * 899999));
  o.lot = o.lots[o.rng.i(0, 2)];
  o.plans = genPlans(o.rng, o); o.plan = o.plans[1]; o.colors = defaultColors(o);
  o.weatherToday = { type: 'sun', temp: 72 };
  return o;
}
function autoView() {
  if (['rough', 'walls', 'int'].includes(g.phase)) return 'in';
  if (g.step === 'done' || g.step === 'closing') return 'in';
  return 'out';
}
function sceneState(o, forcePreview) {
  if (!o) return null;
  const base = { seed: o.seed, clim: CLIMATES[o.climate], climKey: o.climate, family: o.family, month: dateOf(o.day, o).getMonth(), weather: o.weatherToday };
  const all = () => 1, none = () => 0;
  if (forcePreview) return Object.assign(base, { lot: o.lot, plan: o.plan, colors: o.colors, preview: true, furnish: true, amt: all, done: () => true, view: 'out' });
  const st = o.step;
  if (st === 'intro' || st === 'family') return Object.assign(base, { lot: null, amt: none, done: () => false, view: 'out' });
  if (st === 'land' || st === 'landCheck') return Object.assign(base, { lot: o.lots[o.previewLot], amt: none, done: () => false, sign: 'sale', view: 'out' });
  if (['design', 'colors', 'estimate'].includes(st)) {
    const plan = o.plan || o.plans[o.previewPlan];
    return Object.assign(base, { lot: o.lot, plan, colors: o.colors, preview: true, furnish: true, amt: all, done: () => true, view: o.viewOverride || 'out' });
  }
  if (st.startsWith('permit')) return Object.assign(base, { lot: o.lot, amt: none, done: () => false, sign: 'sold', view: 'out' });
  const t = o.tasks ? TASK[o.tasks[o.ti]] : null;
  const doneSet = new Set(o.done);
  const frac = t && o.step === 'work' ? clamp(o.prog / taskDays(t, o.q), 0, 1) : 0;
  const amt = id => doneSet.has(id) ? 1 : (t && t.id === id && o.step === 'work' ? frac : 0);
  const finished = ['co', 'punch', 'closing', 'done'].includes(st);
  const S = Object.assign(base, {
    lot: o.lot, plan: o.plan, colors: o.colors, amt, done: id => doneSet.has(id), view: o.viewOverride || autoView(),
    trade: t ? t.trade : null,
  });
  if (st === 'work' && t) {
    S.callout = t.id;
    if (o.workingToday) S.workers = { zone: t.zone || 'site', trade: t.trade, n: t.trade ? 3 : 2 };
    if (t.veh && (o.workingToday || o.prog === 0)) S.vehicle = t.veh;
  }
  if (st === 'inspect') { S.inspector = true; S.vehicle = 'inspector'; S.callout = o.justDone; }
  if (st === 'done' || st === 'closing') { S.moveIn = st === 'done'; S.furnish = S.moveIn; S.lights = true; if (st === 'done') S.vehicle = 'moving'; }
  if (finished) S.weather = { type: 'sun', temp: 72 };
  return S;
}
