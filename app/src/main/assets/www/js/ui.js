// ===== User interface: panels, dialogs, speech, sounds =====
const $ = s => document.querySelector(s);
const prefs = (() => { try { return JSON.parse(localStorage.getItem('hhh_prefs')) || {}; } catch (e) { return {}; } })();
if (prefs.sound === undefined) prefs.sound = true;
if (prefs.read === undefined) prefs.read = false;
function savePrefs() { try { localStorage.setItem('hhh_prefs', JSON.stringify(prefs)); } catch (e) { } }

// ---------- speech ----------
function cleanSpeech(t) {
  return String(t).replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{20E3}]/gu, '').replace(/\$([\d,]+)/g, '$1 dollars').replace(/\s+/g, ' ').trim();
}
function speak(t) {
  const c = cleanSpeech(t); if (!c) return;
  try {
    if (window.Android && Android.speak) { Android.speak(c); return; }
    if (window.speechSynthesis) { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(c); u.rate = 0.95; u.pitch = 1.05; speechSynthesis.speak(u); }
  } catch (e) { }
}
function stopSpeak() { try { if (window.Android && Android.stop) Android.stop(); else if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) { } }

// ---------- sounds ----------
let actx = null;
function sfx(kind) {
  if (!prefs.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const notes = { good: [523, 659, 784], bad: [220, 185], cash: [880, 1175], tap: [440], win: [523, 659, 784, 1046, 784, 1046], day: [330] }[kind] || [440];
    notes.forEach((f, i) => {
      const o = actx.createOscillator(), gn = actx.createGain();
      o.type = kind === 'bad' ? 'sawtooth' : 'triangle'; o.frequency.value = f;
      const t0 = actx.currentTime + i * 0.09;
      gn.gain.setValueAtTime(0.0001, t0); gn.gain.exponentialRampToValueAtTime(kind === 'tap' || kind === 'day' ? 0.05 : 0.12, t0 + 0.02); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
      o.connect(gn); gn.connect(actx.destination); o.start(t0); o.stop(t0 + 0.25);
    });
  } catch (e) { }
}

// ---------- small html helpers ----------
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function btn(label, act, val, cls, dis) { return `<button class="btn ${cls || ''}" data-a="${act}" ${val !== undefined ? `data-v="${esc(val)}"` : ''} ${dis ? 'disabled' : ''}>${label}</button>`; }
function boss(html) { return `<div class="bubble"><div class="face">👷</div><div class="say">${html}<button class="spk" data-say="1" aria-label="Read aloud">🔊</button></div></div>`; }
function stars(q) { let s = ''; for (let i = 1; i <= 5; i++) s += q >= i ? '★' : q >= i - 0.5 ? '⯪' : '☆'; return `<span class="stars">${s}</span>`; }
function starN(n) { return '⭐'.repeat(n) + '<span class="dim">' + '⭐'.repeat(3 - n) + '</span>'; }
function word(id) { const e = GLOSSARY[id]; return e ? `<span class="term" data-a="term" data-v="${id}">${e[0]}</span>` : id; }
function phaseName(id) { const p = PHASES.find(x => x.id === id); return p ? p.icon + ' ' + p.name : id; }
function happyFace(h) { return h >= 85 ? '😄' : h >= 70 ? '🙂' : h >= 50 ? '😐' : h >= 30 ? '🙁' : '😢'; }

// ---------- top bar & phase bar ----------
function renderTop() {
  if (!g) return;
  const l = left();
  const daysLeft = g.deadlineDay - g.day;
  $('#stMoney').innerHTML = `💰 <b class="${l < 0 ? 'neg' : ''}">${money(l)}</b><small>left</small>`;
  $('#stDay').innerHTML = `📅 <b>${fmtDate(g.day)}</b><small>${daysLeft >= 0 ? daysLeft + ' days to move-in goal' : Math.abs(daysLeft) + ' days LATE'}</small>`;
  $('#stQual').innerHTML = g.qN ? `🛠️ <b>${avgQ().toFixed(1)}</b><small>quality</small>` : `🛠️ <b>–</b><small>quality</small>`;
  $('#stHappy').innerHTML = `${happyFace(g.happy)} <b>${Math.round(clamp(g.happy, 0, 100))}</b><small>family</small>`;
  const idx = PHASES.findIndex(p => p.id === g.phase);
  $('#phases').innerHTML = PHASES.map((p, i) => `<div class="ph ${i < idx ? 'done' : i === idx ? 'now' : ''}" title="${p.name}"><span>${i < idx ? '✅' : p.icon}</span><em>${p.name}</em></div>`).join('');
  const now = $('#phases .now'); if (now && now.scrollIntoView) now.scrollIntoView({ block: 'nearest', inline: 'center' });
  // scene overlay
  const w = ['co', 'punch', 'closing', 'done'].includes(g.step) ? { icon: '☀️', temp: 72 } : (g.weatherToday || weatherOn(g, g.day));
  $('#wx').innerHTML = `${w.icon} ${w.temp}°F`;
  const canToggle = g.plan && (['design', 'colors', 'estimate', 'co', 'punch', 'closing', 'done'].includes(g.step) || (g.done && g.done.includes('walls1')));
  const v = g.plan ? (g.viewOverride || (['design', 'colors', 'estimate'].includes(g.step) ? 'out' : autoView())) : 'out';
  $('#btnView').style.display = canToggle ? '' : 'none';
  $('#btnView').textContent = v === 'out' ? '🔍 See inside' : '🏠 See outside';
  $('#btnView').dataset.v = v === 'out' ? 'in' : 'out';
}

// ---------- panels per step ----------
const Views = {
  intro() {
    return boss(`Hi! I'm <b>Sam</b>, your job-site foreman. You are the ${word('general_contractor')} — the boss of building a whole house!<br><br>
      A family needs a new home in <b>${g.town}</b>. You'll buy land, pick a design, get permits, hire crews, and build it step by step — until the family moves in!`) +
      `<div class="tip">💡 Tap any <span class="term">underlined word</span> to learn what it means. Tap 🔊 to hear Sam talk.</div>` +
      btn('Meet the family ➜', 'meetFamily', undefined, 'big go');
  },
  family() {
    const f = g.family;
    const who = f.adults.map(a => `<div class="mem"><span>${a.emoji}</span>${a.name}</div>`).join('') + f.kids.map(k => `<div class="mem"><span>${k.emoji}</span>${k.name}<small>age ${k.age}</small></div>`).join('') +
      (f.pet ? `<div class="mem"><span>${f.pet.emoji}</span>${f.pet.name}<small>${f.pet.kind}</small></div>` : '');
    return `<h2>The ${f.last} Family</h2><div class="members">${who}</div>` +
      boss(`${f.reason} They hired YOU to build their new house.`) +
      `<div class="card"><h3>📝 What they need</h3><ul class="needs">
        <li>🛏️ <b>${f.beds}</b> bedrooms</li><li>🛁 <b>${f.baths}</b> bathrooms</li><li>🚗 ${f.garage ? 'A garage' : 'No garage needed'}</li>
        ${f.wishes.map(w => `<li>${w.icon} ${w.text}</li>`).join('')}
        <li>🎨 Favorite color: <span class="sw" style="background:${f.fav.color}"></span> <b>${f.fav.name}</b></li></ul>
        <h3>💰 ${word('budget')}: ${money(g.budget)}</h3><p>That money must pay for the land <b>and</b> the house!</p>
        <h3>🏁 Move-in goal: ${fmtDate(g.deadlineDay)}</h3></div>` +
      btn('Find some land 🗺️', 'goLand', undefined, 'big go');
  },
  land() {
    const f = g.family;
    let h = boss(`Here are 3 pieces of land for sale near ${g.town}. Tap <b>Look</b> to see each one. Remember the family's wishes: ${f.wishes.map(w => w.icon + ' ' + w.text).join(', ')}.`);
    h += `<div class="tip">🌍 Climate: <b>${CLIMATES[g.climate].name}</b> — ${CLIMATES[g.climate].desc}</div>`;
    g.lots.forEach((L, i) => {
      const pc = lotProsCons(L, f), ws = lotWishScore(L, f);
      h += `<div class="card lot ${g.previewLot === i ? 'sel' : ''}">
        <h3>${['🏘️', '🌳', '🌾'][['town', 'edge', 'country'].indexOf(L.kind)]} Lot ${i + 1}: ${{ town: 'In town', edge: 'Edge of town', country: 'Out in the country' }[L.kind]}</h3>
        <p class="addr">${lotAddress(L, g)}</p>
        <div class="kv"><span>💲 Price</span><b>${money(L.price)}</b><span>📐 Size</span><b>${L.acres} acres</b>
        <span>🚰 Water</span><b>${L.water === 'city' ? 'City pipes' : 'Need a well'}</b><span>🚽 Sewer</span><b>${L.sewer === 'city' ? 'City sewer' : 'Need septic'}</b>
        <span>🌳 Trees</span><b>${L.trees}</b><span>⛰️ Land</span><b>${L.slope}</b><span>🏫 School</span><b>${L.school} min</b><span>❤️ Wishes</span><b>${ws} of 2</b></div>
        <ul class="pc">${pc.pros.map(p => `<li class="pro">👍 ${p}</li>`).join('')}${pc.cons.map(p => `<li class="con">👎 ${p}</li>`).join('')}</ul>
        <div class="row">${btn('👀 Look', 'previewLot', i, 'sm')}${btn(g.checked[i] ? '📄 See test results' : `🔍 Test it (${money(900 + 650 + (L.sewer === 'septic' ? 450 : 0))})`, 'checkLot', i, 'sm go')}</div></div>`;
    });
    return h;
  },
  landCheck() {
    const L = g.lots[g.lotSel], f = g.checked[g.lotSel];
    const closing = Math.round(L.price * 0.02 / 10) * 10;
    return `<h2>Lot ${g.lotSel + 1} Test Results</h2>` +
      boss(`Smart builders test land BEFORE buying it. A ${word('survey')} finds the property lines, and a ${word('soil_test')} checks the ground.`) +
      `<div class="card"><ul class="finds">${f.map(x => `<li class="${x.ok ? 'pro' : 'con'}">${x.t}</li>`).join('')}</ul>
      <div class="kv"><span>Land price</span><b>${money(L.price)}</b><span>Closing costs (2%)</span><b>${money(closing)}</b><span>Money left after</span><b>${money(left() - L.price - closing)}</b></div></div>` +
      `<div class="row">${btn(`✅ Buy this land`, 'buyLot', undefined, 'big go')}${btn('↩ Other lots', 'backToLots', undefined, 'big')}</div>`;
  },
  design() {
    const f = g.family;
    if (!g.planEst) g.planEst = g.plans.map(p => estimateBuild(g, p).total);
    let h = boss(`We own the land! 🎉 An architect drew 3 ${word('blueprints')} for us. Which house fits the ${f.last} family AND the budget? They need ${f.beds} bedrooms and ${f.baths} bathrooms. We have <b>${money(left())}</b> left.`);
    g.plans.forEach((p, i) => {
      const est = g.planEst[i];
      const fits = est * 1.1 <= left();
      h += `<div class="card plan ${g.previewPlan === i ? 'sel' : ''}"><h3>${p.name}</h3>
        <canvas class="fp" data-plan="${i}"></canvas>
        <div class="kv"><span>🛏️ Bedrooms</span><b>${p.beds} ${p.beds >= f.beds ? '✅' : '❌'}</b><span>🛁 Bathrooms</span><b>${p.baths} ${Math.ceil(p.baths) >= Math.ceil(f.baths) ? '✅' : '❌'}</b>
        <span>🚗 Garage</span><b>${p.garage ? 'Yes' : 'No'} ${f.garage && !p.garage ? '❌' : '✅'}</b><span>🏢 Floors</span><b>${p.stories}</b>
        <span>📐 Size</span><b>${p.W}×${p.D} ft = ${p.sqft.toLocaleString()} ${word('square_feet')}</b><span>🧱 Foundation</span><b>${word(p.found)}</b>
        <span>💲 Cost to build</span><b>${money(est)} ${fits ? '✅' : '❌'}</b></div>
        <div class="row">${btn('👀 See it', 'previewPlan', i, 'sm')}${btn('Choose this plan', 'choosePlan', i, 'sm go')}</div></div>`;
    });
    return h;
  },
  colors() {
    const c = g.colors, f = g.family;
    const sw = (key, list, curName) => `<div class="swatches">${list.map((x, i) => `<button class="swb ${x[0] === curName ? 'on' : ''}" data-a="setColor" data-v="${key}:${i}" title="${x[0]}" style="background:${x[1] || 'repeating-linear-gradient(45deg,#fff,#fff 4px,#ddd 4px,#ddd 8px)'}"></button>`).join('')}</div><small>${curName}</small>`;
    return boss(`The fun part — pick the colors! Psst… the family's favorite color is <b>${f.fav.name}</b>. <span class="sw" style="background:${f.fav.color}"></span>`) +
      `<div class="card"><h3>Siding type</h3><div class="row">
        ${btn(`${c.sidingType === 'vinyl' ? '✅ ' : ''}Vinyl <small>(cheaper)</small>`, 'setColor', 'sidingType:0', 'sm')}${btn(`${c.sidingType === 'fiber' ? '✅ ' : ''}Fiber-cement <small>(stronger, costs more)</small>`, 'setColor', 'sidingType:1', 'sm')}</div>
        <h3>Siding color</h3>${sw('siding', SIDING, c.sidingName)}
        <h3>Roof shingles</h3>${sw('roof', ROOFC, c.roofName)}
        <h3>Trim</h3>${sw('trim', TRIMC, c.trimName)}
        <h3>Front door</h3>${sw('door', DOORC, c.doorName)}
        <h3>Shutters</h3>${sw('shutters', SHUTC, c.shutName)}</div>` +
      btn('Looks great! ✅', 'colorsDone', undefined, 'big go');
  },
  estimate() {
    const est = g.est.total, cont = Math.round(est * 0.1 / 100) * 100;
    const need = est + cont, have = left();
    const ok = need <= have;
    return `<h2>📊 The ${word('budget')} Check</h2>` +
      boss(`Let's add it all up. This is called an <b>estimate</b>. We also save 10% extra — a ${word('contingency')} — for surprises like rain delays or a big rock!`) +
      `<div class="card"><div class="kv big">
        <span>Family budget</span><b>${money(g.budget)}</b><span>Already spent (land & tests)</span><b>- ${money(g.spent)}</b>
        <span>Money left</span><b>${money(have)}</b><span>Build the house</span><b>${money(est)}</b><span>Contingency (10%)</span><b>${money(cont)}</b>
        <span>Total needed</span><b class="${ok ? 'pos' : 'neg'}">${money(need)}</b></div>
        <p class="verdict ${ok ? 'pos' : 'neg'}">${ok ? '✅ It fits the budget!' : `❌ That is ${money(need - have)} too much! Maybe pick a smaller plan.`}</p>
        <p>⏱️ It should take about <b>${g.est.days}</b> work days to build (plus weekends & weather).</p></div>` +
      `<div class="row">${btn('📋 Get the permit ➜', 'goPermit', undefined, 'big ' + (ok ? 'go' : ''))}${btn('↩ Change the plan', 'backToDesign', undefined, 'big')}</div>`;
  },
  permit() {
    return `<h2>📋 Building Permit</h2>` +
      boss(`Before we can build, the town's building department must approve our ${word('blueprints')}. That's called a ${word('permit')}. The ${word('building_code')} is the rule book that keeps houses safe. Inspectors will check our work along the way!`) +
      `<div class="card"><div class="kv"><span>Permit fee</span><b>${money(permitFee(g.q))}</b><span>Review time</span><b>about 1–2 weeks</b></div></div>` +
      btn('📨 Submit the blueprints', 'submitPermit', undefined, 'big go');
  },
  permitWait() {
    const open = g.permitIssueState === 'open';
    return `<h2>⏳ Waiting for the permit…</h2>
      <div class="bar"><i style="width:${Math.min(100, g.permitProg / g.permitNeed * 100)}%"></i></div>
      <div class="log">${g.dayMsgs.map(m => `<p>${m}</p>`).join('')}</div>` +
      (open ? `<div class="card warn"><p>📝 ${g.permitIssue}</p>${btn('✏️ Fix the blueprints ($350)', 'fixPermit', undefined, 'go')}</div>` : '') +
      `<div class="row">${btn('⏭️ Next day', 'waitPermitDay', undefined, 'big go', open)}${btn(Auto.on ? '⏸ Pause' : '⏩ Auto', 'auto', undefined, 'big', open)}</div>`;
  },
  permitDone() {
    return `<div class="permitcard"><div>BUILDING PERMIT</div><b>#${g.seed % 90000 + 10000}</b><p>${lotAddress(g.lot, g)}</p><p>New ${g.plan.stories}-story home · ${g.plan.sqft.toLocaleString()} sq ft</p><p>APPROVED ✅ ${fmtDate(g.day)}</p></div>` +
      boss(`APPROVED! 🎉 We post the permit card at the job site where inspectors can see it. Now the real building starts. Safety first — hard hats on! ⛑️`) +
      btn('🚧 Start building!', 'startBuild', undefined, 'big go');
  },
  quiz() {
    const t = cur(), qz = g.quiz;
    const n = g.tasks.length;
    let h = `<div class="stepinfo">${phaseName(t.ph)} · Step ${g.ti + 1} of ${n} · 🧠 ${g.brain.right}/${g.brain.total}</div>`;
    if (qz.correct) {
      h += `<div class="card good"><h3>✅ Yes! ${taskName(t, g.q)}</h3></div>` + boss(t.why) + btn("Let's do it ➜", 'quizNext', undefined, 'big go');
      return h;
    }
    h += boss(qz.wrong.length ? feedbackWrong(qz.wrong[qz.wrong.length - 1]) : `What should we do <b>NEXT</b>? Think about what has to happen first!`);
    h += `<div class="choices">${qz.choices.map(id => btn(taskName(TASK[id], g.q), 'answer', id, 'choice' + (qz.wrong.includes(id) ? ' wrong' : ''), qz.wrong.includes(id))).join('')}</div>`;
    return h;
  },
  hire() {
    const t = cur(), T = TRADES[t.trade];
    const bids = g.bids[t.trade];
    let h = `<div class="stepinfo">${phaseName(t.ph)} · Hiring</div>` +
      boss(`We need a ${T.icon} <b>${T.name}</b> ${word('subcontractor')}! Here are 3 ${word('bid')}s. Cheapest is not always best — look at the stars and reviews!`);
    bids.forEach((b, i) => {
      const price = tradeLaborTotal(t.trade, b);
      const sp = b.speed >= 1.15 ? '⚡ Fast' : b.speed >= 0.95 ? '🚶 Normal' : '🐢 Slow';
      const rel = b.rel >= 0.95 ? 'Always on time' : b.rel >= 0.88 ? 'Usually on time' : 'Sometimes late';
      h += `<div class="card bid"><h3>${esc(b.name)}</h3>
        <div class="kv"><span>💲 Price</span><b>${money(price)}</b><span>🛠️ Quality</span><b>${stars(b.quality)}</b><span>⏱️ Speed</span><b>${sp}</b><span>📅 Shows up</span><b>${rel}</b><span>🏢 In business</span><b>${b.years} years</b></div>
        <p class="review">${b.review}</p>${btn('🤝 Hire them', 'hire', i, 'go')}</div>`;
    });
    return h;
  },
  order() {
    const t = cur(), m = orderList(t);
    const total = matsCost(m, 1);
    return `<div class="stepinfo">${phaseName(t.ph)} · Materials</div><h2>${taskName(t, g.q)}</h2>` +
      boss(`Time to order materials! Builders measure the ${word('blueprints')} to figure out how much of everything they need.`) +
      `<table class="mats"><tr><th>Item</th><th>How many</th><th>Cost</th></tr>${m.map(x => `<tr><td>${x[0]}</td><td>${Math.round(x[1]).toLocaleString()} ${x[2]}</td><td>${money(x[1] * x[3])}</td></tr>`).join('')}
      <tr class="tot"><td colspan="2">Total</td><td>${money(total)}</td></tr></table>` +
      btn(`🛒 Order it (${money(total)})`, 'order', undefined, 'big go');
  },
  work() {
    const t = cur(), sub = t.trade ? g.hired[t.trade] : null;
    const days = taskDays(t, g.q), pct = clamp(g.prog / days * 100, 0, 100);
    const fc = forecast(3);
    const w = g.weatherToday;
    return `<div class="stepinfo">${phaseName(t.ph)} · Step ${g.ti + 1} of ${g.tasks.length}</div><h2>${taskName(t, g.q)}</h2>
      <p class="crew">${sub ? `${TRADES[t.trade].icon} Crew: <b>${esc(sub.name)}</b> ${stars(sub.quality)}` : t.wait ? '⏳ Waiting — no crew needed' : '👷 Your own crew'}</p>
      <div class="bar"><i style="width:${pct}%"></i><span>${Math.min(days, Math.floor(g.prog * 10) / 10)} / ${days} days of work</span></div>
      <div class="today">${w.icon} ${fmtDate(g.day)} · ${w.temp}°F ${t.out ? '<small>(outdoor job — weather matters!)</small>' : ''}</div>
      <div class="log">${g.dayMsgs.length ? g.dayMsgs.map(m => `<p>${m}</p>`).join('') : `<p>Ready to start! Press <b>Next day</b>.</p>`}</div>
      <div class="fc">Forecast: ${fc.map(x => `<span title="${x.w.name}">${DAYS[dateOf(x.day).getDay()]} ${x.w.icon} ${x.w.temp}°</span>`).join('')}</div>
      <div class="row">${btn('▶️ Next day', 'workDay', undefined, 'big go')}${btn(Auto.on ? '⏸ Pause' : '⏩ Auto', 'auto', undefined, 'big')}</div>
      <details class="why"><summary>🤔 Why do we do this?</summary><p>${t.why}</p></details>`;
  },
  inspect() {
    const I = INSPECTIONS[g.insp.id], st = g.insp.state;
    let h = `<h2>🕵️ ${I.name}</h2>`;
    if (st === 'ready') h += boss(`Time for an ${word('inspection')}! ${I.what}`) + btn('📞 Call the inspector', 'callInspector', undefined, 'big go');
    if (st === 'pass') h += `<div class="stamp">APPROVED ✅</div>` + boss(`The inspector signed the permit card. We passed! 🎉 Now we can keep going.`) + btn('Keep building ➜', 'inspDone', undefined, 'big go');
    if (st === 'fail') {
      const f = g.insp.fail;
      h += `<div class="stamp bad">NOT APPROVED ❌</div>` + boss(`The inspector found a problem: <b>${f.why}</b> We have to fix it and ask them to come back. That's why good crews matter!`) +
        btn(`🔧 ${f.fix} (${money(f.cost)}, ${f.days} day)`, 'fixInspection', undefined, 'big go');
    }
    return h;
  },
  phaseDone() {
    const nt = cur();
    return `<div class="celebrate">🎉</div><h2>${phaseName(g.phaseDoneId)} — done!</h2>` +
      boss(`Great work, boss! ${g.toast || ''}<br><br>💡 <b>Did you know?</b> ${g.fact}`) +
      `<div class="card"><div class="kv"><span>Money left</span><b>${money(left())}</b><span>Quality so far</span><b>${stars(avgQ())}</b><span>Rain & cold days</span><b>${g.weatherDays}</b></div></div>` +
      btn(`Next: ${phaseName(nt.ph)} ➜`, 'nextPhase', undefined, 'big go');
  },
  co() {
    return `<div class="permitcard co"><div>CERTIFICATE OF OCCUPANCY</div><b>${g.town} Building Department</b><p>${lotAddress(g.lot, g)}</p><p>This house has passed all inspections and is safe to live in.</p><p>✅ ${fmtDate(g.day)}</p></div>` +
      boss(`WE GOT THE ${word('co')}! 🎉 That means the house is officially safe to live in. Now let's walk through the house with the ${g.family.last} family.`) +
      btn('🚶 Walk through with the family', 'startPunch', undefined, 'big go');
  },
  punch() {
    const n = g.punch.filter(p => !p.fixed).length;
    return `<h2>📝 Punch List</h2>` +
      boss(`The family walks through every room and makes a ${word('punch_list')} of little things to fix. ${n ? `Tap each one to fix it! (${n} left)` : ''}`) +
      `<div class="punch">${g.punch.map((p, i) => `<button class="pitem ${p.fixed ? 'fixed' : ''}" data-a="fixPunch" data-v="${i}" ${p.fixed ? 'disabled' : ''}><span>${p.icon}</span>${p.text}<em>${p.fixed ? '✅ Fixed' : '🔧 Fix (' + money(p.cost) + ')'}</em></button>`).join('')}</div>`;
  },
  closing() {
    const late = g.day - g.deadlineDay;
    return `<h2>🔑 Closing Day!</h2>` +
      boss(`Everything is fixed. It's ${word('closing')} day! The papers are signed, and it's time to hand the ${g.family.last} family the keys to their new home!`) +
      `<div class="card"><div class="kv big"><span>Budget</span><b>${money(g.budget)}</b><span>Spent</span><b>${money(g.spent)}</b><span>Left over</span><b class="${left() >= 0 ? 'pos' : 'neg'}">${money(left())}</b>
      <span>Move-in goal</span><b>${fmtDate(g.deadlineDay)}</b><span>Finished</span><b class="${late <= 0 ? 'pos' : 'neg'}">${fmtDate(g.day)} ${late <= 0 ? '(on time!)' : `(${late} days late)`}</b></div></div>` +
      btn('🔑 Hand over the keys!', 'handKeys', undefined, 'big go');
  },
  done() {
    const s = g.score, f = g.family;
    const quote = s.happy >= 85 ? `"This is the BEST house ever! Thank you!!" 🥰` : s.happy >= 65 ? `"We love our new home. Thank you!" 😊` : `"It's nice… but we had a few problems." 😐`;
    const rows = [['💰 Budget', s.st.budget, s.left >= 0 ? `${money(s.left)} left over` : `${money(-s.left)} over budget`],
      ['📅 On time', s.st.time, s.late <= 0 ? `${-s.late} days early` : `${s.late} days late`],
      ['🛠️ Quality', s.st.quality, `${s.q.toFixed(1)} out of 5`], ['😊 Family happiness', s.st.happy, `${s.happy} / 100`],
      ['🧠 Builder brain', s.st.brain, `${Math.round(s.brainPct * 100)}% right first try`], ['⛑️ Safety', s.st.safety, `${Math.round(g.safety)} / 100`]];
    return `<div class="celebrate">🏡🎉🔑</div><h2>The ${f.last} family moved in!</h2>
      <p class="quote">${quote}</p>
      <div class="card score">${rows.map(r => `<div class="srow"><span>${r[0]}</span><b>${starN(r[1])}</b><small>${r[2]}</small></div>`).join('')}</div>
      <h2 class="rank">${s.rank}</h2><p class="center">${s.total} of 18 stars · Built in ${s.days} days · ${g.learned.length} builder words learned</p>` +
      `<div class="row">${btn('🏠 Build another house', 'newHouse', undefined, 'big go')}${btn('📖 Handbook', 'book', undefined, 'big')}</div>`;
  },
};

function feedbackWrong(id) {
  const wi = g.tasks.indexOf(id);
  const nm = taskName(TASK[id], g.q);
  if (wi >= 0 && wi < g.ti) return `We already did <b>${nm}</b>! Try again. 🙂`;
  return `Hmm, not yet! <b>${nm}</b> comes later. What needs to happen before that? Try again!`;
}

// ---------- main render ----------
let lastStep = null;
function render() {
  if (!g) return;
  renderTop();
  const v = Views[g.step];
  $('#panel').innerHTML = v ? v() : '';
  if (lastStep !== g.step) { $('#panel').scrollTop = 0; lastStep = g.step; if (prefs.read) readPanel(); }
  $('#panel').querySelectorAll('canvas.fp').forEach(c => Scene.drawFloorPlan(c, g.plans[+c.dataset.plan]));
  if (g.event) showEvent();
  if (g.newTerms && g.newTerms.length) { toast(`📖 New builder word${g.newTerms.length > 1 ? 's' : ''}: ${g.newTerms.map(id => GLOSSARY[id][0]).join(', ')}`); g.newTerms = []; }
  save();
}
function readPanel() { const b = $('#panel .say'); if (b) speak(b.innerHTML); }

// ---------- auto play ----------
const Auto = {
  on: false, timer: null,
  toggle() { this.on ? this.stop() : this.start(); },
  start() { this.on = true; this.tick(); },
  stop() { this.on = false; clearTimeout(this.timer); render(); },
  tick() {
    if (!this.on) return;
    if (g.step === 'work' && !g.event) { const r = Game.workDay(); sfx('day'); if (r === 'done') { sfx('good'); this.on = false; } if (r === 'event') this.on = false; render(); }
    else if (g.step === 'permitWait' && g.permitIssueState !== 'open') { Game.waitPermitDay(); render(); }
    else { this.on = false; render(); return; }
    this.timer = setTimeout(() => this.tick(), 750);
  },
};

// ---------- actions ----------
function act(a, v) {
  if (a !== 'auto' && Auto.on && a !== 'term') Auto.stop();
  switch (a) {
    case 'auto': Auto.toggle(); return;
    case 'term': showTerm(v); return;
    case 'book': showBook(); return;
    case 'newHouse': newGame(); Scene.resize(); sfx('good'); break;
    case 'answer': {
      const ok = Game.answer(v); sfx(ok ? 'good' : 'bad');
      render(); if (prefs.read || ok) readPanel(); return;
    }
    case 'setColor': { const [k, i] = v.split(':'); Game.setColor(k, i); sfx('tap'); break; }
    case 'workDay': { const r = Game.workDay(); sfx(r === 'done' ? 'good' : 'day'); break; }
    case 'order': Game.order(); sfx('cash'); break;
    case 'hire': Game.hire(v); sfx('cash'); break;
    case 'buyLot': Game.buyLot(); sfx('win'); Scene.burst(); break;
    case 'callInspector': Game.callInspector(); sfx(g.insp.state === 'pass' ? 'win' : 'bad'); if (g.insp.state === 'pass') Scene.burst(); break;
    case 'startBuild': Game.startBuild(); sfx('win'); break;
    case 'fixPunch': Game.fixPunch(v); sfx('good'); break;
    case 'handKeys': Game.handKeys(); sfx('win'); Scene.burst(); setTimeout(() => Scene.burst(), 600); break;
    case 'view': Game.setView(v); break;
    default: if (Game[a]) Game[a](v); sfx('tap');
  }
  if (g.step === 'phaseDone' || g.step === 'co') { Scene.burst(); sfx('win'); }
  if (g.toast && g.step !== 'phaseDone') { toast(g.toast); }
  g.toast = null;
  render();
}

// ---------- dialogs ----------
function modal(html, cls) {
  $('#modalCard').className = 'mcard ' + (cls || '');
  $('#modalCard').innerHTML = html + `<button class="x" data-m="close" aria-label="Close">✕</button>`;
  $('#modal').classList.remove('hidden');
}
function closeModal() { $('#modal').classList.add('hidden'); }
function showEvent() {
  const e = g.event;
  if (e.result) modal(`<div class="evicon">${e.icon}</div><h2>${e.title}</h2><p class="big">${e.result}</p><button class="btn big go" data-m="evclose">OK 👍</button>`, 'event');
  else modal(`<div class="evicon">${e.icon}</div><h2>${e.title}</h2><p class="big">${e.text}</p><p class="dim">You're the boss. What do you do?</p>${e.choices.map((c, i) => `<button class="btn choice" data-m="ev" data-v="${i}">${c}</button>`).join('')}<button class="spk" data-say2="1">🔊</button>`, 'event noclose');
  if (prefs.read) speak(e.result || e.text);
}
function showTerm(id) {
  const e = GLOSSARY[id]; if (!e) return;
  modal(`<h2>📖 ${e[0]}</h2><p class="big">${e[1]}</p><button class="spk" data-say2="1">🔊</button>`);
  if (prefs.read) speak(e[0] + '. ' + e[1]);
}
function showBook() {
  const all = Object.keys(GLOSSARY), got = g ? g.learned : [];
  modal(`<h2>📖 Builder's Handbook</h2><p>You learned <b>${got.length}</b> of <b>${all.length}</b> builder words!</p>
    <div class="book">${all.map(id => got.includes(id) ? `<div class="bt"><b>${GLOSSARY[id][0]}</b><p>${GLOSSARY[id][1]}</p></div>` : `<div class="bt locked"><b>🔒 ???</b></div>`).join('')}</div>`, 'wide');
}
function showMoney() {
  if (!g) return;
  const cats = { Land: 0, Materials: 0, Labor: 0, 'Permits & fees': 0, 'Fixes & surprises': 0 };
  g.ledger.forEach(([d, w, a]) => {
    if (/^Land|Closing|Survey/.test(w)) cats.Land += a; else if (/^Materials/.test(w)) cats.Materials += a; else if (/^Labor/.test(w)) cats.Labor += a;
    else if (/permit|Plan revision/i.test(w)) cats['Permits & fees'] += a; else cats['Fixes & surprises'] += a;
  });
  modal(`<h2>💰 Money Report</h2><div class="kv big"><span>Family budget</span><b>${money(g.budget)}</b><span>Spent</span><b>${money(g.spent)}</b><span>Left</span><b class="${left() < 0 ? 'neg' : 'pos'}">${money(left())}</b></div>
    <h3>Where the money went</h3><div class="kv">${Object.entries(cats).map(([k, v]) => `<span>${k}</span><b>${money(v)}</b>`).join('')}</div>
    <h3>Latest bills</h3><table class="mats">${g.ledger.slice(-12).reverse().map(([d, w, a]) => `<tr><td>${fmtDate(d)}</td><td>${esc(w)}</td><td>${money(a)}</td></tr>`).join('')}</table>`, 'wide');
}
function showMenu() {
  modal(`<h2>☰ Menu</h2>
    <button class="btn big" data-m="money">💰 Money report</button>
    <button class="btn big" data-m="book">📖 Builder's Handbook</button>
    <button class="btn big" data-m="help">❓ How to play</button>
    <button class="btn big" data-m="read">🔊 Read aloud: <b>${prefs.read ? 'ON' : 'OFF'}</b></button>
    <button class="btn big" data-m="sound">🔈 Sounds: <b>${prefs.sound ? 'ON' : 'OFF'}</b></button>
    <button class="btn big" data-m="title">🏠 Title screen</button>
    <p class="dim center">House #${g ? g.seed : ''}</p>`);
}
function showHelp() {
  modal(`<h2>❓ How to Play</h2><div class="help">
    <p>👷 You are the <b>General Contractor</b> — the boss who builds the house!</p>
    <p>1️⃣ Meet the family and learn what they need.</p><p>2️⃣ Buy land. Test it first!</p><p>3️⃣ Pick a house plan that fits the family and the budget.</p>
    <p>4️⃣ Get a building permit from the town.</p><p>5️⃣ Build it step by step. Choose what comes <b>next</b>, hire crews, order materials, and press <b>Next day</b>.</p>
    <p>🌧️ Rain and snow stop outdoor work. Check the forecast!</p><p>🕵️ Inspectors check the work. Good crews pass more often.</p>
    <p>🔍 Tap <b>See inside</b> to look inside the walls!</p><p>⭐ Try to finish on time, on budget, with happy customers!</p></div>`);
}
let toastT = null;
function toast(msg) { const t = $('#toast'); t.innerHTML = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3200); }

// ---------- title screen ----------
function showTitle() {
  demo = makeDemo();
  const st = stats();
  $('#title').classList.remove('hidden');
  $('#titleBtns').innerHTML = (hasSave() ? `<button class="btn big go" data-t="continue">▶️ Continue building</button>` : '') +
    `<button class="btn big ${hasSave() ? '' : 'go'}" data-t="new">🏗️ Build a new house</button>
     <button class="btn big" data-t="help">❓ How to play</button>` +
    (st.houses ? `<p class="dim">🏠 Houses built: ${st.houses} · Best: ${st.best}/18 ⭐</p>` : '');
}
function hideTitle() { $('#title').classList.add('hidden'); demo = null; Scene.resize(); }

// ---------- wiring ----------
window.addEventListener('DOMContentLoaded', () => {
  Scene.init($('#scene'), () => {
    if (demo && !$('#title').classList.contains('hidden')) return sceneState(demo, true);
    return g ? sceneState(g) : null;
  });
  $('#panel').addEventListener('click', e => {
    const s = e.target.closest('[data-say]'); if (s) { speak(s.parentElement.innerHTML); return; }
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    act(b.dataset.a, b.dataset.v);
  });
  $('#btnView').addEventListener('click', e => act('view', e.currentTarget.dataset.v));
  $('#btnMenu').addEventListener('click', showMenu);
  $('#btnBook').addEventListener('click', showBook);
  $('#stMoney').addEventListener('click', showMoney);
  $('#modal').addEventListener('click', e => {
    if (e.target.id === 'modal' && !$('#modalCard').classList.contains('noclose')) { closeModal(); return; }
    const t = e.target.closest('[data-a="term"]'); if (t) { showTerm(t.dataset.v); return; }
    if (e.target.closest('[data-say2]')) { speak($('#modalCard').innerText.replace('✕', '')); return; }
    const m = e.target.closest('[data-m]'); if (!m) return;
    const k = m.dataset.m;
    if (k === 'close') closeModal();
    if (k === 'ev') { Game.eventChoice(m.dataset.v); sfx('tap'); showEvent(); }
    if (k === 'evclose') { closeModal(); Game.eventClose(); render(); }
    if (k === 'money') showMoney();
    if (k === 'book') showBook();
    if (k === 'help') showHelp();
    if (k === 'read') { prefs.read = !prefs.read; savePrefs(); showMenu(); if (!prefs.read) stopSpeak(); }
    if (k === 'sound') { prefs.sound = !prefs.sound; savePrefs(); showMenu(); }
    if (k === 'title') { closeModal(); Auto.on = false; showTitle(); }
  });
  $('#title').addEventListener('click', e => {
    const b = e.target.closest('[data-t]'); if (!b) return;
    const k = b.dataset.t;
    if (k === 'help') { showHelp(); return; }
    if (k === 'continue') { load(); hideTitle(); render(); }
    if (k === 'new') { newGame(); hideTitle(); render(); if (prefs.read) readPanel(); }
    sfx('good');
  });
  showTitle();
});
// Android back button: close dialogs first, then go to title; returns true if handled
window.onAndroidBack = function () {
  if (!$('#modal').classList.contains('hidden') && !$('#modalCard').classList.contains('noclose')) { closeModal(); return true; }
  if ($('#title').classList.contains('hidden')) { Auto.on = false; showTitle(); return true; }
  return false;
};
