// Сборка фактов из дашбордных снимков (rop.json + dialog.json) для бота «Константин».
// Даёт компактный текстовый контекст: сводка отдела + карточки менеджеров. Если в вопросе
// назван менеджер - добавляет по нему глубокую карточку (топ-сделки на дожим и застрявшие).
// БЕЗ обращения к ИИ - только детерминированный разбор снимка.
import fs from 'node:fs';

const PLAN = ["Юлия Лысанова", "Ольга Маслова", "Татьяна Лакомова", "Юлия Шура-Бура", "Алина Платонова", "Екатерина Зазноба", "Надежда Лобова"];
const nkey = s => String(s || '').trim().toLowerCase().split(/\s+/).sort().join(' ');
const M = v => (v / 1e6).toFixed(1);
const K = v => Math.round((v || 0) / 1000);
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
const med = a => { a = a.filter(x => x != null && !isNaN(x)).sort((x, y) => x - y); return a.length ? (a.length % 2 ? a[(a.length - 1) / 2] : Math.round((a[a.length / 2 - 1] + a[a.length / 2]) / 2)) : null; };

export function loadSnaps(ropPath, dialogPath) {
  return { rop: JSON.parse(fs.readFileSync(ropPath, 'utf8')), dlg: JSON.parse(fs.readFileSync(dialogPath, 'utf8')) };
}

// Кого из ростера упомянули в вопросе. Матчим по ОСНОВЕ фамилии (последний токен без
// двух последних букв), чтобы ловить склонения: «Платоновой», «Лакомовой», «по Зазнобе».
export function detectManager(q) {
  const s = String(q || '').toLowerCase();
  for (const m of PLAN) {
    const surname = m.toLowerCase().split(' ').pop();
    const stem = surname.length > 5 ? surname.slice(0, -2) : surname;
    if (stem.length >= 4 && s.includes(stem)) return m;
  }
  return null;
}

function compute(rop, dlg) {
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
  const rows = {};
  for (const m of PLAN) rows[nkey(m)] = { name: m, n: 0, rub: 0, checks: [], resp: [], kp: 0, kpSum: 0, over: 0, wait: 0, a30: 0, a30stall: 0, client: 0, assort: 0, budget: 0, kpDeals: [], stallDeals: [] };
  for (const z of dds) {
    if (z.isLead || (z.outcome || 'open') !== 'open' || PREp.has(z.stageCode)) continue;
    const k = nkey(z.mgr); if (!rows[k]) continue; const s = rows[k]; const bud = z.budget || 0;
    s.n++; s.rub += bud; if (bud) s.checks.push(bud); if (z.respMed != null) s.resp.push(z.respMed);
    if ((z.overdueD || 0) > 0) s.over++;
    if (has(z.client)) s.client++; if (has(z.assort)) s.assort++; if (bud > 0) s.budget++;
    const evs = EX[z.dealId] || [];
    const kpRow = (z.stageRows || []).find(r => r.code === 'C49:PREPAYMENT_INVOIC');
    if (kpRow && !evs.some(e => e.ts >= kpRow.ts && CF(e.type) && e.dir === 'исходящее')) { s.kp++; s.kpSum += bud; s.kpDeals.push(z); }
    const tx = evs.filter(e => TX(e.type)); const l = tx[tx.length - 1];
    if (l && l.dir === 'входящее' && !triv(l.body)) s.wait++;
    const age = z.createdAt ? (NOW - Date.parse(z.createdAt)) / 864e5 : null;
    if (age != null && age >= 30) { s.a30++; const sil = z.silenceD == null ? 999 : z.silenceD; if (sil > 14 || (z.overdueD || 0) > 0) { s.a30stall++; s.stallDeals.push(z); } }
  }
  return rows;
}

const dealLine = z => `#${z.dealId} ${K(z.budget)}к ${z.client || '?'}/${z.assort || '?'} стадия ${z.stageDays}дн "${String(z.title || '').slice(0, 40)}"`;

// Компактный контекст: сводка отдела + одна строка на менеджера. Для вопроса про менеджера -
// глубокая карточка (топ сделки на дожим и застрявшие).
export function buildFacts(rop, dlg, opts = {}) {
  const rows = compute(rop, dlg);
  const L = [];
  L.push(`Снимок Bitrix: ${dlg.generatedAt}. Воронка 49 (GG Заказы РФ). Открытые сделки до предоплаты.`);
  const T = f => PLAN.reduce((a, m) => a + (rows[nkey(m)][f] || 0), 0);
  L.push(`ОТДЕЛ: ${T('n')} сделок · ${M(T('rub'))} млн · КП без дожима ${T('kp')} · просрочка дел ${T('over')} · без ответа ${T('wait')} · 30+ дней ${T('a30')} (застряли ${T('a30stall')}).`);
  L.push('Менеджеры (сделки · млн · КП без дожима · просрочка · 30+ застряли · отклик мин · СРМ тип/ассорт/бюджет %):');
  for (const m of PLAN) {
    const s = rows[nkey(m)]; if (!s.n) continue;
    L.push(`- ${m}: ${s.n} · ${M(s.rub)} · КПбездож ${s.kp}(${M(s.kpSum)}) · просроч ${s.over} · 30+застр ${s.a30stall} · отклик ${med(s.resp) != null ? med(s.resp) : '-'} · тип ${pct(s.client, s.n)}/ассорт ${pct(s.assort, s.n)}/бюджет ${pct(s.budget, s.n)}`);
  }
  if (opts.manager) {
    const s = rows[nkey(opts.manager)];
    if (s && s.n) {
      L.push(`\nГЛУБОКО по «${opts.manager}»:`);
      L.push(`Медиана чека ${K(med(s.checks) || 0)}к. КП без дожима ${s.kp} на ${M(s.kpSum)} млн.`);
      const kp = s.kpDeals.slice().sort((a, b) => (b.budget || 0) - (a.budget || 0)).slice(0, 5);
      if (kp.length) { L.push('Топ КП без дожима:'); kp.forEach(z => L.push('  ' + dealLine(z))); }
      const st = s.stallDeals.slice().sort((a, b) => (b.budget || 0) - (a.budget || 0)).slice(0, 5);
      if (st.length) { L.push('Застрявшие 30+ (тишина>14дн или просроч.дело):'); st.forEach(z => L.push('  ' + dealLine(z))); }
    }
  }
  return L.join('\n');
}
