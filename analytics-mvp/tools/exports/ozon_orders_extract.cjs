// Снимает «Аналитику по заказам» OZON с собранной страницы за месяц: числа ровно как на экране.
const { chromium } = require('playwright-core');
const months = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const out = {};
  for (const ym of months) {
    const p = await b.newPage({ viewport: { width: 1500, height: 1000 } });
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file:///home/user/t1/analytics-mvp/public/katya-money.html'); await p.waitForTimeout(1500);
    const [y, m] = ym.split('-').map(Number); const last = new Date(y, m, 0).getDate();
    await p.evaluate(([f0, t0]) => { const f = document.getElementById('range-from'), t = document.getElementById('range-to');
      f.value = f0; t.value = t0; ['input', 'change'].forEach(ev => { f.dispatchEvent(new Event(ev, { bubbles: true })); t.dispatchEvent(new Event(ev, { bubbles: true })); }); document.getElementById('range-apply').click(); },
      [`${ym}-01`, `${ym}-${String(last).padStart(2, '0')}`]);
    await p.waitForTimeout(2500);
    const r = await p.evaluate(() => {
      const head = [...document.querySelectorAll('#ordan-t thead th')].map(x => x.innerText.trim());
      const meta = {}; const bn = o => (String(o).split('-').length >= 3 ? String(o).replace(/-\d+$/, '') : String(o));
      AN_ORDERS.forEach(o => { if (!meta[o.order]) meta[o.order] = { d: o.d, off: o.off, cat: o.cat, ship: o.ship };
        const k = bn(o.order), m = meta[k] || (meta[k] = { d: o.d, off: o.off, cat: o.cat, offs: [] }); if (o.d < m.d) m.d = o.d; });
      const cell = td => ({ t: td.innerText.trim(), est: td.classList.contains('an-est') || !!td.querySelector('.an-est') });
      const rows = [];
      document.querySelectorAll('#ordan tr').forEach(tr => {
        const tds = [...tr.children]; if (!tds.length) return;
        const first = tds[0].innerText.trim();
        const kind = tr.classList.contains('ord-row') ? 'order' : tr.classList.contains('ord-cat') ? 'cat' : (first === 'ИТОГО' ? 'total' : 'other');
        const spans = [...tds[0].querySelectorAll('span')].map(x => x.innerText.trim()).filter(Boolean);
        rows.push({ kind, cat: tr.getAttribute('data-cat') || '', first, spans, parts: (tds[0].querySelector('span[title^="Отправления"]') || {}).title || '', cells: tds.map(cell) });
      });
      return { head, rows, meta, city: AN_ORD_CITY };
    });
    r.errs = errs; out[ym] = r; await p.close();
  }
  require('fs').writeFileSync(process.env.OUT, JSON.stringify(out));
  await b.close();
})();
