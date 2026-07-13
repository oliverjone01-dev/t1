/* GG-MarkPlan 2026 · рендер разделов из data/plan-2026.json
 * Дисциплина Protocol 9 зашита в рендер: каждая цифра несёт метку [ДАННЫЕ]/[ГИПОТЕЗА],
 * пустые (неутверждённые) значения показываются как прочерк, а не как ноль/выдумка. */

const $ = (s, r = document) => r.querySelector(s);
const el = (t, c, h) => { const n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; };
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const dash = v => (v == null || v === '') ? '<span class="dash">-</span>' : esc(v);

let DATA = null;

const VIEWS = {
  overview: { title: 'Обзор', sub: 'Единый маркетинговый план 2026 по 5 брендам' },
  year: { title: 'План года', sub: 'Цели 2026: холдинг и бренды' },
  quarters: { title: 'Кварталы', sub: 'Инициативы Q1-Q4: владелец, статус, ICE, метка P9' },
  channels: { title: 'Каналы', sub: 'Микс каналов по брендам и владельцы' },
  budget: { title: 'Бюджет и KPI', sub: 'Плановые бюджеты и целевые KPI (до гейта - только гипотеза)' }
};

// метка P9: ДАННЫЕ / ГИПОТЕЗА
function p9(mark) {
  if (mark === 'ДАННЫЕ') return '<span class="p9 data">ДАННЫЕ</span>';
  return '<span class="p9 hyp">ГИПОТЕЗА</span>';
}
function statusTag(s) {
  const label = { proposed: 'proposed', committed: 'committed', done: 'done' }[s] || s;
  return `<span class="status ${esc(s)}">${esc(label)}</span>`;
}
function brandName(id) { const b = (DATA.brands || []).find(x => x.id === id); return b ? b.name : id; }
function brandChip(id) {
  const b = (DATA.brands || []).find(x => x.id === id);
  const cls = b && b.priority === 1 ? 'brandchip p1' : 'brandchip';
  return `<span class="${cls}">${esc(b ? b.name : id)}</span>`;
}
function channelName(id) { const c = (DATA.channels || []).find(x => x.id === id); return c ? c.name : id; }

function renderOverview() {
  const v = el('div');
  const brands = DATA.brands || [];
  const inits = (DATA.quarters || []).flatMap(q => q.initiatives || []);

  const kpis = el('div', 'grid g4');
  const stat = (label, val, note) => {
    const c = el('div', 'card kpi');
    c.innerHTML = `<h3>${esc(label)}</h3><div class="title" style="font-size:26px;font-family:var(--mono)">${val}</div><div class="meta">${esc(note || '')}</div>`;
    return c;
  };
  kpis.append(
    stat('Брендов в контуре', brands.length, 'GENGLASS - приоритет 1'),
    stat('Целей года', (DATA.goals || []).length, 'холдинг + бренды'),
    stat('Инициатив', inits.length, 'по 4 кварталам'),
    stat('Committed', inits.filter(i => i.status === 'committed').length, 'прошли Step 12.5')
  );
  v.append(kpis);

  const rules = el('div', 'card');
  rules.style.marginTop = '18px';
  rules.innerHTML = `
    <h3>Дисциплина плана (Protocol 9)</h3>
    <ul style="margin:4px 0 0 18px;font-size:13.5px;color:var(--muted);line-height:1.7">
      <li>Каждая цифра несёт метку ${p9('ДАННЫЕ')} (со ссылкой на источник) или ${p9('ГИПОТЕЗА')} (с допущениями).</li>
      <li>Инициатива не переходит в ${statusTag('committed')}, пока не пройдёт триаду ДАТА → ФЕНИКС → МАРКО (Step 12.5) и не получит дату первого сигнала.</li>
      <li>Бюджет &gt;200K на чистой гипотезе, ROMI &gt;50x без unit-эк, диапазон шире 2x - блок на входе.</li>
    </ul>`;
  v.append(rules);
  return v;
}

function renderYear() {
  const v = el('div');
  const goals = DATA.goals || [];
  const grid = el('div', 'grid g2');
  goals.forEach(g => {
    const c = el('div', 'card');
    const scope = g.scope === 'holding' ? 'ХОЛДИНГ' : brandName(g.scope);
    c.innerHTML = `
      <h3>${esc(scope)}</h3>
      <div class="title">${esc(g.title)}</div>
      <div class="meta" style="margin:8px 0 6px">Метрика: ${esc(g.metric)}</div>
      <div class="init row" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        <span class="tag">цель: ${dash(g.target)}</span> ${p9(g.p9)}
      </div>
      ${(g.assumptions && g.assumptions.length) ? `<div class="meta" style="margin-top:8px">Допущения: ${esc(g.assumptions.join('; '))}</div>` : ''}`;
    grid.append(c);
  });
  if (!goals.length) grid.append(el('div', 'card', '<div class="meta">Цели пока не заведены. Наполнение - marco (P1 backlog).</div>'));
  v.append(grid);
  return v;
}

function renderQuarters() {
  const v = el('div');
  const qgrid = el('div', 'qgrid');
  (DATA.quarters || []).forEach(q => {
    const col = el('div', 'qcol');
    const inits = q.initiatives || [];
    col.append(el('h4', null, `${esc(q.label)}<span>${inits.length}</span>`));
    if (!inits.length) { col.append(el('div', 'empty', 'нет инициатив')); }
    inits.forEach(i => {
      const card = el('div', 'init');
      const ice = i.ice && i.ice.score != null ? `ICE ${esc(i.ice.score)}` : 'ICE -';
      card.innerHTML = `
        <div class="t">${esc(i.title)}</div>
        <div class="row">${brandChip(i.brand)} ${statusTag(i.status)}</div>
        <div class="row">
          <span class="own">@${esc(i.owner)}</span>
          <span class="tag">${esc(channelName(i.channel))}</span>
          <span class="tag">${ice}</span>
          ${p9(i.ice && i.ice.p9 ? i.ice.p9 : 'ГИПОТЕЗА')}
        </div>`;
      col.append(card);
    });
    qgrid.append(col);
  });
  v.append(qgrid);
  return v;
}

function renderChannels() {
  const v = el('div');
  const wrap = el('div', 'tbl-wrap');
  const inits = (DATA.quarters || []).flatMap(q => q.initiatives || []);
  const rows = (DATA.channels || []).map(c => {
    const used = inits.filter(i => i.channel === c.id);
    const brands = [...new Set(used.map(i => brandName(i.brand)))].join(', ');
    return `<tr>
      <td><b>${esc(c.name)}</b></td>
      <td><span class="own">@${esc(c.owner)}</span></td>
      <td class="num">${used.length}</td>
      <td>${brands ? esc(brands) : '<span class="dash">-</span>'}</td>
    </tr>`;
  }).join('');
  wrap.innerHTML = `<table>
    <thead><tr><th>Канал</th><th>Владелец</th><th class="num">Инициатив</th><th>Бренды</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="4"><span class="dash">каналы не заведены</span></td></tr>'}</tbody>
  </table>`;
  v.append(wrap);
  return v;
}

function renderBudget() {
  const v = el('div');
  if (DATA.budget && DATA.budget.note) {
    const n = el('div', 'meta');
    n.style.margin = '0 0 14px';
    n.innerHTML = esc(DATA.budget.note);
    v.append(n);
  }
  const wrap = el('div', 'tbl-wrap');
  const rows = ((DATA.budget && DATA.budget.rows) || []).map(r => `<tr>
    <td><b>${esc(channelName(r.channel))}</b></td>
    <td class="num">${r.planned == null ? '<span class="dash">-</span>' : esc(r.planned)}</td>
    <td>${esc(r.kpi)}</td>
    <td class="num">${r.target == null ? '<span class="dash">-</span>' : esc(r.target)}</td>
    <td>${p9(r.p9)}</td>
  </tr>`).join('');
  wrap.innerHTML = `<table>
    <thead><tr><th>Канал</th><th class="num">Бюджет ₽</th><th>KPI</th><th class="num">Цель</th><th>P9</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="5"><span class="dash">строки не заведены</span></td></tr>'}</tbody>
  </table>`;
  v.append(wrap);
  return v;
}

const RENDER = { overview: renderOverview, year: renderYear, quarters: renderQuarters, channels: renderChannels, budget: renderBudget };

function show(view) {
  const cfg = VIEWS[view] || VIEWS.overview;
  $('#view-title').textContent = cfg.title;
  $('#view-sub').textContent = cfg.sub;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  const host = $('#view');
  host.innerHTML = '';
  host.append((RENDER[view] || renderOverview)());
}

async function boot() {
  document.querySelectorAll('.nav-btn').forEach(b => b.addEventListener('click', () => show(b.dataset.view)));
  try {
    const res = await fetch('data/plan-2026.json', { cache: 'no-store' });
    DATA = await res.json();
  } catch (e) {
    $('#view').innerHTML = '<div class="card"><div class="meta">Не удалось загрузить data/plan-2026.json. Запустите через статик-сервер (см. README).</div></div>';
    return;
  }
  const m = DATA.meta || {};
  $('#ver').textContent = 'v' + (m.version || '0.1');
  $('#updated').textContent = m.updated ? 'обновлено ' + m.updated : '';
  if (m.status === 'skeleton') {
    $('#banner').hidden = false;
    $('#banner-text').innerHTML = '<b>Каркас, не утверждённый план.</b> ' + esc(m.note || '');
  }
  show('overview');
}

boot();
