// Детерминированный сборщик недельного/месячного аудита отдела продаж.
// Считает срез из снимков Bitrix (rop.json + dialog.json), сравнивает с прошлым
// сохранённым срезом (динамика), пишет новый срез в стор и рендерит факты (md).
// БЕЗ обращения к платному ИИ. ИИ-коучинг добавляется отдельным шагом (audit-ai.mjs).
//
// Использование:
//   node audit-build.mjs --mode weekly  --rop /tmp/rop.json --dialog /tmp/dialog.json \
//        --store ./srez --out-facts /tmp/facts.md --out-srez /tmp/srez-new.json
//   node audit-build.mjs --mode monthly --store ./srez --out-facts /tmp/facts.md
import fs from 'node:fs';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const MODE = arg('mode', 'weekly');
const STORE = arg('store', './srez');
const OUT_FACTS = arg('out-facts', '/tmp/facts.md');
const OUT_SREZ = arg('out-srez', '/tmp/srez-new.json');

// Ольга Маслова уволена - убрана из ростера (решение Ивана 25.09).
const PLAN = ["Юлия Лысанова", "Татьяна Лакомова", "Юлия Шура-Бура", "Алина Платонова", "Екатерина Зазноба", "Надежда Лобова"];
const nkey = s => String(s || '').trim().toLowerCase().split(/\s+/).sort().join(' ');
const M = v => (v / 1e6).toFixed(1);
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
const med = a => { a = a.filter(x => x != null && !isNaN(x)).sort((x, y) => x - y); return a.length ? (a.length % 2 ? a[(a.length - 1) / 2] : Math.round((a[a.length / 2 - 1] + a[a.length / 2]) / 2)) : null; };

function isoWeek(d) { const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); const dn = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - dn + 3); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 4)); const w = 1 + Math.round(((t - y0) / 864e5 - 3 + ((y0.getUTCDay() + 6) % 7)) / 7); return t.getUTCFullYear() + '-W' + String(w).padStart(2, '0'); }

// ---- computeCurrent: срез из снимков на момент генерации ----
function computeCurrent(rop, dlg) {
  const deals = (rop.deals || []).filter(x => String(x.category) === '49');
  const dds = (dlg.scoring && dlg.scoring.deals) || [];
  const dev = dlg.events || [];
  const NOW = Date.parse(dlg.generatedAt || new Date().toISOString());
  const EX = {}; for (const e of dev) { if (!e.dealId) continue; (EX[e.dealId] = EX[e.dealId] || []).push(e); }
  for (const k in EX) EX[k].sort((a, b) => a.ts - b.ts);
  const CF = t => t && (t.indexOf('Сообщение') === 0 || t === 'Мессенджер ОЛ' || t === 'Письмо' || t === 'Звонок');
  const TX = t => t && (t.indexOf('Сообщение') === 0 || t === 'Мессенджер ОЛ' || t === 'Письмо');
  const triv = t => { const raw = String(t || '').toLowerCase().trim(); const s = raw.replace(/[^a-zа-яё]/gi, ''); return !s || /^(принято|получено|спасибо|благодарю)/.test(raw) || /^(ок|окей|хорошо|да|нет|угу|ага)$/.test(s); };
  const has = v => v && String(v).trim() && !['нет данных', 'не указано'].includes(String(v).trim().toLowerCase());
  const PREp = new Set(['C49:EXECUTING', 'C49:FINAL_INVOICE', 'C49:1', 'C49:2']);
  const blank = () => ({ n: 0, rub: 0, checks: [], resp: [], kp: 0, kpSum: 0, over: 0, overSum: 0, wait: 0, waitSum: 0, a30: 0, a30Sum: 0, a30stall: 0, client: 0, assort: 0, budget: 0, greet: 0, objT: 0, objW: 0 });
  const S = {}; for (const m of PLAN) S[nkey(m)] = blank();
  for (const z of dds) {
    if (z.isLead || (z.outcome || 'open') !== 'open' || PREp.has(z.stageCode)) continue;
    const k = nkey(z.mgr); if (!S[k]) continue; const s = S[k]; const bud = z.budget || 0;
    s.n++; s.rub += bud; if (bud) s.checks.push(bud); if (z.respMed != null) s.resp.push(z.respMed);
    if ((z.overdueD || 0) > 0) { s.over++; s.overSum += bud; }
    if (has(z.client)) s.client++; if (has(z.assort)) s.assort++; if (bud > 0) s.budget++;
    s.objT += (z.objTotal || 0); s.objW += (z.objWorked || 0);
    const evs = EX[z.dealId] || [];
    const kpRow = (z.stageRows || []).find(r => r.code === 'C49:PREPAYMENT_INVOIC');
    if (kpRow) { const after = evs.filter(e => e.ts >= kpRow.ts && CF(e.type) && e.dir === 'исходящее'); if (!after.length) { s.kp++; s.kpSum += bud; } }
    const tx = evs.filter(e => TX(e.type)); const l = tx[tx.length - 1];
    if (l && l.dir === 'входящее' && !triv(l.body)) { s.wait++; s.waitSum += bud; }
    const age = z.createdAt ? (NOW - Date.parse(z.createdAt)) / 864e5 : null;
    if (age != null && age >= 30) { s.a30++; s.a30Sum += bud; const sil = z.silenceD == null ? 999 : z.silenceD; if (sil > 14 || (z.overdueD || 0) > 0) s.a30stall++; }
    const tags = z.evTags || {}; let g = false; for (const id in tags) { for (const t of tags[id]) { if (String(t.t || '').toLowerCase().includes('приветствие')) { g = true; break; } } if (g) break; }
    if (g) s.greet++;
  }
  const mgrs = {};
  for (const m of PLAN) {
    const s = S[nkey(m)];
    mgrs[m] = { n: s.n, rub: s.rub, medChk: med(s.checks) || 0, respMed: med(s.resp), kp: s.kp, kpSum: s.kpSum, over: s.over, wait: s.wait, a30: s.a30, a30stall: s.a30stall, client: pct(s.client, s.n), assort: pct(s.assort, s.n), budget: pct(s.budget, s.n), greet: pct(s.greet, s.n), objW: s.objW, objT: s.objT };
  }
  const T = f => PLAN.reduce((a, m) => a + (S[nkey(m)][f] || 0), 0);
  const dept = { n: T('n'), rub: T('rub'), kp: T('kp'), kpSum: T('kpSum'), over: T('over'), wait: T('wait'), a30: T('a30'), a30stall: T('a30stall'), client: pct(T('client'), T('n')), assort: pct(T('assort'), T('n')), budget: pct(T('budget'), T('n')), greet: pct(T('greet'), T('n')), objW: T('objW'), objT: T('objT') };
  return { generatedAt: dlg.generatedAt, dept, mgrs };
}

function readStore() {
  if (!fs.existsSync(STORE)) return [];
  return fs.readdirSync(STORE).filter(f => f.endsWith('.json')).sort().map(f => JSON.parse(fs.readFileSync(path.join(STORE, f), 'utf8')));
}
const arrow = d => d < 0 ? '↓' : d > 0 ? '↑' : '=';
const sign = d => (d > 0 ? '+' : '') + d;

// Динамика к прошлой неделе по КАЖДОМУ показателю: «было→стало» и знак.
// lowGood - меньше значит лучше (просрочка, недожим, отклик). Маркер: ✅ лучше, 🔻 хуже, без знака - на месте.
const dyn = (c, p, lowGood, unit = '', tol = 0) => {
  if (c == null) return '-';
  if (p == null) return `${c}${unit}`;
  const d = c - p; if (Math.abs(d) <= tol) return `${c}${unit} =`;
  const good = lowGood ? d < 0 : d > 0;
  return `${p}→${c}${unit} ${good ? '✅' : '🔻'}`;
};
const METRICS = [
  ['respMed', 'отклик', true, ' мин', 2], ['kp', 'КП без дожима', true, '', 0], ['over', 'просрочка', true, '', 0],
  ['a30stall', 'застряли 30+', true, '', 0], ['wait', 'ждут ответа', true, '', 0], ['assort', 'ассортимент', false, '%', 1],
  ['budget', 'бюджет', false, '%', 1], ['greet', 'приветствие', false, '%', 1],
];
const score = (c, p) => { let up = 0, down = 0; if (!p) return { up, down };
  for (const [k, , lowGood, , tol] of METRICS) { if (c[k] == null || p[k] == null) continue; const d = c[k] - p[k]; if (Math.abs(d) <= tol) continue; ((lowGood ? d < 0 : d > 0) ? up++ : down++); }
  return { up, down }; };

function renderWeekly(cur, prior) {
  const P = prior ? prior.mgrs : null; const PD = prior ? prior.dept : null;
  const L = []; const wk = cur.week;
  L.push(`📅 ИТОГ НЕДЕЛИ · ${wk}${prior ? ` · к ${prior.week}` : ''}`);
  L.push(`Отдел: ${cur.dept.n} сделок до предоплаты · ${M(cur.dept.rub)} млн${PD ? ` (было ${PD.n} · ${M(PD.rub)} млн)` : ''}.`);
  L.push(`💸 КП без дожима ${dyn(cur.dept.kp, PD && PD.kp, true)} · ${M(cur.dept.kpSum)} млн${PD ? ` (было ${M(PD.kpSum)})` : ''}`);
  L.push(`⏰ просрочка дел ${dyn(cur.dept.over, PD && PD.over, true)} · ⌛ застряли 30+ ${dyn(cur.dept.a30stall, PD && PD.a30stall, true)} · 💬 ждут ответа ${dyn(cur.dept.wait, PD && PD.wait, true)}`);
  L.push(`🧩 СРМ: тип клиента ${dyn(cur.dept.client, PD && PD.client, false, '%', 1)} · ассортимент ${dyn(cur.dept.assort, PD && PD.assort, false, '%', 1)} · бюджет ${dyn(cur.dept.budget, PD && PD.budget, false, '%', 1)}`);
  L.push(`🗣 возражения отработаны ${cur.dept.objW} из ${cur.dept.objT}${PD ? ` (было ${PD.objW} из ${PD.objT})` : ''}`);
  L.push('');
  L.push('━━ ПО МЕНЕДЖЕРАМ ━━');
  const MIN = 5;
  const order = PLAN.filter(m => cur.mgrs[m] && cur.mgrs[m].n >= MIN).sort((a, b) => cur.mgrs[b].kpSum - cur.mgrs[a].kpSum);
  const low = PLAN.filter(m => cur.mgrs[m] && cur.mgrs[m].n > 0 && cur.mgrs[m].n < MIN);
  for (const m of order) {
    const c = cur.mgrs[m]; const p = P ? P[m] : null; const sc = score(c, p);
    L.push(`${m} · ${c.n} сд · ${M(c.rub)} млн${p ? ` · к прошлой: лучше ${sc.up}, хуже ${sc.down}` : ''}`);
    L.push(`  💸 КП без дожима ${dyn(c.kp, p && p.kp, true)} (${M(c.kpSum)} млн) · ⏰ просрочка ${dyn(c.over, p && p.over, true)} · ⌛ застряли ${dyn(c.a30stall, p && p.a30stall, true)}`);
    L.push(`  ⚡ отклик ${dyn(c.respMed, p && p.respMed, true, ' мин', 2)} · 💬 ждут ответа ${dyn(c.wait, p && p.wait, true)}`);
    L.push(`  🧩 ассорт ${dyn(c.assort, p && p.assort, false, '%', 1)} · бюджет ${dyn(c.budget, p && p.budget, false, '%', 1)} · приветствие ${dyn(c.greet, p && p.greet, false, '%', 1)}`);
  }
  if (low.length) L.push('\nМало данных: ' + low.map(m => `${m} (${cur.mgrs[m].n})`).join(', '));
  if (P) {
    const ranked = order.map(m => ({ m, ...score(cur.mgrs[m], P[m]) })).filter(x => P[x.m]);
    const best = ranked.filter(x => x.up > x.down).sort((a, b) => (b.up - b.down) - (a.up - a.down)).map(x => x.m.split(' ')[1] || x.m);
    const worst = ranked.filter(x => x.down > x.up).sort((a, b) => (b.down - b.up) - (a.down - a.up)).map(x => x.m.split(' ')[1] || x.m);
    L.push('');
    L.push(`✅ Выросли к прошлой неделе: ${best.join(', ') || 'нет'}`);
    L.push(`🔻 Просели: ${worst.join(', ') || 'нет'}`);
  }
  return L.join('\n');
}

function renderMonthly(store, month) {
  const wks = store.filter(s => s.monthKey === month);
  const L = [];
  L.push(`📊 МЕСЯЧНЫЙ АУДИТ ОТДЕЛА ПРОДАЖ · ${month}`);
  if (!wks.length) { L.push('Нет сохранённых недельных срезов за месяц.'); return L.join('\n'); }
  const first = wks[0], last = wks[wks.length - 1];
  L.push(`Свод из ${wks.length} недельных срезов.`);
  L.push(`💸 КП без дожима за месяц: ${first.dept.kp} → ${last.dept.kp} (${arrow(last.dept.kp - first.dept.kp)} ${sign(last.dept.kp - first.dept.kp)}).`);
  L.push(`Портфель: ${first.dept.n} → ${last.dept.n} сделок · ${M(last.dept.rub)} млн на конец месяца.`);
  L.push(`⏰ Просрочка дел (конец месяца): ${last.dept.over} · 🧩 ассортимент заполнен ${last.dept.assort}% · 🗣 возражения ${last.dept.objW}/${last.dept.objT}.`);
  L.push('');
  L.push('Динамика КП без дожима по менеджерам за месяц:');
  for (const m of PLAN) {
    if (!last.mgrs[m] || !last.mgrs[m].n) continue;
    const a = first.mgrs[m] ? first.mgrs[m].kp : '-'; const b = last.mgrs[m].kp;
    L.push(`  ${m}: ${a} → ${b}`);
  }
  return L.join('\n');
}

// ---- main ----
const store = readStore();
if (MODE === 'monthly') {
  const month = arg('month', new Date().toISOString().slice(0, 7));
  fs.writeFileSync(OUT_FACTS, renderMonthly(store, month));
  console.log('monthly facts →', OUT_FACTS);
} else {
  const rop = JSON.parse(fs.readFileSync(arg('rop', '/tmp/rop.json'), 'utf8'));
  const dlg = JSON.parse(fs.readFileSync(arg('dialog', '/tmp/dialog.json'), 'utf8'));
  const cur = computeCurrent(rop, dlg);
  const d = new Date(cur.generatedAt || Date.now());
  cur.week = isoWeek(d); cur.monthKey = cur.generatedAt.slice(0, 7);
  const prior = store.filter(s => s.week < cur.week).pop() || null;
  fs.writeFileSync(OUT_FACTS, renderWeekly(cur, prior));
  fs.writeFileSync(OUT_SREZ, JSON.stringify(cur, null, 1));
  console.log('weekly facts →', OUT_FACTS, '| srez →', OUT_SREZ, '| week', cur.week, '| prior', prior ? prior.week : 'нет');
}
