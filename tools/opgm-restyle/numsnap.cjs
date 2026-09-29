/* numsnap: снимок чисел старых экранов ОП ГМ и сравнение «до / после» по решению Р8 (ФЕНИКС, 29.09.2026).
   Метод:
   - ключ смысловой, не порядковый: плитка = подпись плитки + часть плитки, ячейка = раздел + строка + столбец,
     полоса = раздел + подпись полосы, строка вердикта = имя, прочий текст = раздел + текст блока с цифрами, заменёнными на #;
   - сравниваются мультимножества числовых токенов под ключом, а не сырой текст;
   - текст графиков ApexCharts, style и script внутри SVG не собирается; данные графика берутся из таблицы-двойника (она в DOM);
   - числа в data-tip и aria-label спарклайнов собираются под ключом узла;
   - слой поверх: у каждой плитки с деталями панель открывается, числа панели снимаются, проверяется «число плитки есть в панели»;
   - время браузера на момент выгрузки, reducedMotion, входы закреплены: sha256 канонического JSON данных в отчёте, при разных входах сравнение не идёт (код 2).
   Манифест ожидаемых изменений волны (JSON): rename [{from,to,reason}], allow_hidden [{key_re,state_re?,reason}] (узел перестал читаться по замыслу), allow_new [{key_re,state_re?,reason,value_must_exist?=true,value_from_re?}],
   allow_change [{key_re,state_re?,reason}], allow_removed [{key_re,state_re?,reason}]. Запись манифеста, которая ни разу не сработала, это провал.
   Коды выхода: 0 = необъяснённых расхождений 0; 1 = есть необъяснённые или лишние записи манифеста; 2 = разные входы или ошибка запуска.

   v2 (итерация 3 плана, ТЗ ФЕНИКСА iter2 п.1-3, 5-8):
   - порядок чисел внутри ключа сохраняется (текст, атрибуты, плитки, полосы, вердикт, график); мультимножество только у ячеек таблиц,
     где ключ уже несёт строку и столбец (п.1: перестановка внутри блока ловится);
   - у каждого ключа число читаемых узлов (прямоугольник текста > 0, visibility visible, цвет и итоговая непрозрачность с предками >= 0,5,
     кегль >= 11 px, не обрезан предком с overflow hidden/clip больше чем наполовину); снимок на ширинах 1280 и 390;
     «читался в базе, не читается после» = необъяснённое расхождение (п.2);
   - текст графиков ApexCharts (подписи осей, подписи данных, легенда) отдельным классом «график», порядок сохраняется (п.6);
   - фильтры «Все диалоги»: каждое значение «Проблема», «Отметка», «Кто начал» один раз, выбор через selectOption (события change) (п.6);
   - инвариант панели: число плитки ищется в назначенном узле панели ([data-panel-total] или кнопка «все N в «Все диалоги»»), а не среди любых чисел (п.7);
   - режим прогона в meta (views, no-drawers, close-wait, widths, no-filters); частичный снимок в diff без --allow-partial = код 2 (п.5);
   - --data DIR: реальные данные через harness/realdata.cjs, только в памяти, выходы вне git-репозитория (п.8).
   snap: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node numsnap.cjs snap --op <op-gm-automation> --src <src> --out snap.json [--fx '{"seed":..}' | --data DIR]
         [--views pulse,today] [--no-drawers] [--close-wait мс] [--widths 1280] [--no-filters]   (любой из пяти последних = частичный снимок)
   diff: node numsnap.cjs diff before.json after.json [--manifest m.json] [--show 40] [--no-values] [--allow-partial]
   Снимок реальных данных содержит числа клиентов: хранить только вне репозитория (инструмент проверяет сам). */
const fs = require('fs'), path = require('path'), crypto = require('crypto');

const HEAD_VIEWS = ['pulse', 'speed2', 'probs', 'ads', 'calls', 'cold', 'dlg'];
const CABS = ['all', 'OLD-G', 'NEW-B'], PERS = ['7', '30', '90', 'all'], TODAY = ['3', '14', '30', 'all'];
const PLAIN = ['data', 'overview', 'problems', 'speed', 'quality', 'funnel', 'dialogues', 'teardowns', 'scripts', 'actions'];

function args(a){ const o = { _:[] }; for(let i = 0; i < a.length; i++){ if(a[i].startsWith('--')){ const k = a[i].slice(2); if(i + 1 < a.length && !a[i + 1].startsWith('--')) o[k] = a[++i]; else o[k] = true; } else o._.push(a[i]); } return o; }
const canon = v => Array.isArray(v) ? '[' + v.map(canon).join(',') + ']' : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}' : JSON.stringify(v);
const sha = s => crypto.createHash('sha256').update(s).digest('hex');

/* --- сборщик, выполняется в странице --- */
function collect(scopeSel){
  const scope = document.querySelector(scopeSel); if(!scope) return { keys:{}, kinds:{}, vis:{}, stats:{ nodes:0 } };
  const norm = s => String(s || '').replace(/[   ]/g, ' ').replace(/\s+/g, ' ').trim();
  const join = s => norm(s).replace(/(\d) (?=\d{3}(?!\d))/g, '$1');
  const TOK = /(?:(?<=^|[\s(«"=:])[−+-])?\d+(?:[.,]\d+)*/g;
  const toks = s => (join(s).match(TOK) || []).map(t => t.replace('−', '-'));
  const skel = s => join(s).replace(TOK, '#');
  const txt = (root, sel) => { const e = root && root.querySelector(sel); return e ? norm(e.textContent) : ''; };
  const isBlock = el => { const d = getComputedStyle(el).display; return !d.startsWith('inline') && d !== 'contents'; };
  const blockOf = el => { for(let n = el; n && n !== scope.parentElement; n = n.parentElement) if(isBlock(n)) return n; return scope; };
  const section = el => {
    for(let n = el; n && n !== document.body; n = n.parentElement){
      if(n.id === 'ks-drawer') return 'панель:' + txt(n, '#ks-drawer-title');
      if(n.classList.contains('ks-card')){ const t = txt(n, ':scope > .ks-card-head .ks-card-title'); if(t) return 'карточка:' + t; }
      if(n.classList.contains('op-queue')) return 'очередь:' + txt(n, 'h2');
      if(n.classList.contains('ks-verdict')) return 'вердикт';
    }
    return 'экран';
  };
  const cls = el => (el.className && typeof el.className === 'string' ? el.className.split(' ')[0] : el.tagName.toLowerCase());
  const ctx = el => {
    for(let n = el; n && n !== document.body; n = n.parentElement){
      if(n.matches('.ks-tile')) return ['плитка:' + txt(n, '.ks-tile-label'), n];
      if(n.matches('[data-th]')){ let h = 2166136261; for(const ch of n.getAttribute('data-th')){ h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return ['диалог:' + h.toString(36), n]; }
      if(n.matches('.ks-verdict-row')) return ['строка вердикта:' + txt(n, '.ks-verdict-name'), n];
      if(n.matches('.ks-bars > div')) return ['полоса:' + txt(n, '.ks-bar-name'), n];
      if(n.matches('td, th') && n.closest('table')){
        const tr = n.closest('tr'), cells = [...tr.children], i = cells.indexOf(n), tb = n.closest('table');
        const hs = tb.tHead ? [...tb.tHead.rows[0].children] : [];
        const col = n.getAttribute('data-label') || (hs[i] ? norm(hs[i].textContent) : '#' + i);
        const row = tr.parentElement.tagName === 'THEAD' ? 'шапка' : tr.parentElement.tagName === 'TFOOT' ? 'итог' : norm(cells[0].textContent);
        return ['ячейка:' + row + ' | ' + col, n, true];
      }
    }
    return [null, null];
  };
  const out = {}, kinds = {}, vis = {}, st = { nodes:0, tile:0, cell:0, bar:0, verdict:0, text:0, attr:0, chart:0, weak:0, unreadable:0 };
  const put = (key, tt, kind) => { (out[key] = out[key] || []).push(...tt); kinds[key] = kind; };
  const alpha = c => { const m = /rgba?\(([^)]+)\)/.exec(c); if(!m) return 1; const p = m[1].split(/[\s,\/]+/).filter(Boolean); return p.length > 3 ? parseFloat(p[3]) : 1; };
  const readable = (n, p) => {
    const r = document.createRange(); r.selectNodeContents(n); const rc = r.getBoundingClientRect();
    if(!(rc.width > 0 && rc.height > 0)) return false;
    const cs = getComputedStyle(p);
    if(cs.visibility !== 'visible' || parseFloat(cs.fontSize) < 11 || alpha(cs.color) < 0.5) return false;
    let op = 1;
    for(let e = p; e && e !== document.documentElement; e = e.parentElement){
      const c = e === p ? cs : getComputedStyle(e); op *= parseFloat(c.opacity); if(c.display === 'none') return false;
      if(e !== p && /hidden|clip/.test(c.overflowX + ' ' + c.overflowY)){ const b = e.getBoundingClientRect();
        const w = Math.min(rc.right, b.right) - Math.max(rc.left, b.left), h = Math.min(rc.bottom, b.bottom) - Math.max(rc.top, b.top);
        if(w <= 0 || h <= 0 || w * h < 0.5 * rc.width * rc.height) return false; }
    }
    return op >= 0.5;
  };
  const keyFor = el => {
    const [c, host, isCell] = ctx(el), sec = section(el), b = blockOf(el);
    if(c && isCell) return [sec + ' » ' + c, 'cell'];
    if(c) return [sec + ' » ' + c + ' » ' + cls(b) + ':' + skel(b.textContent), c.startsWith('плитка') ? 'tile' : c.startsWith('полоса') ? 'bar' : c.startsWith('диалог') ? 'text' : 'verdict'];
    const dt = b.tagName === 'DD' && b.previousElementSibling && b.previousElementSibling.tagName === 'DT' ? norm(b.previousElementSibling.textContent) + ' ' : '';
    return [sec + ' » текст:' + cls(b) + ':' + dt + skel(b.textContent), 'text'];
  };
  const skip = el => el.closest('.apexcharts-canvas, .ks-chart, style, script, noscript, template') || (el.closest('[hidden]') && !el.closest('[id^="ks-tw-"]'));
  const tw = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  for(let n = tw.nextNode(); n; n = tw.nextNode()){
    const p = n.parentElement; if(!p || !/\d/.test(n.textContent) || skip(p)) continue;
    const tt = toks(n.textContent); if(!tt.length) continue;
    const [k, kind] = keyFor(p); st.nodes++; st[kind]++;
    if(/» текст:[^:]*:[#\s.,:%-]*$/.test(k) && k.startsWith('экран')) st.weak++;
    put(k, tt, kind);
    const ok = readable(n, p); vis[k] = (vis[k] || 0) + (ok ? 1 : 0); if(!ok) st.unreadable++;
  }
  const charts = {};
  scope.querySelectorAll('.apexcharts-canvas').forEach(c => {
    const sec = section(c), i = charts[sec] = (charts[sec] || 0) + 1;
    [['ось Y', '.apexcharts-yaxis-label'], ['ось X', '.apexcharts-xaxis-label'], ['подписи данных', '.apexcharts-datalabel, .apexcharts-data-labels text'], ['легенда', '.apexcharts-legend-text']].forEach(([part, q]) => {
      const tt = [...c.querySelectorAll(q)].flatMap(e => { const ts = e.querySelectorAll('tspan'); return toks(ts.length ? [...ts].map(t => t.textContent).join(' ') : e.textContent); }) /* без <title>: иначе подпись дублируется */; if(!tt.length) return;
      st.chart++; put(sec + ' » график ' + i + ' » ' + part, tt, 'chart');
    });
  });
  scope.querySelectorAll('[data-tip], svg.ks-spark[aria-label]').forEach(el => {
    if(skip(el.parentElement || el) && !el.matches('svg.ks-spark')) return;
    const v = el.getAttribute('data-tip') || el.getAttribute('aria-label') || ''; if(!/\d/.test(v)) return;
    const [k] = keyFor(el.matches('svg') ? el.parentElement : el); st.attr++;
    put(k + ' @' + (el.hasAttribute('data-tip') ? 'tip' : 'aria') + ':' + skel(v), toks(v), 'attr');
  });
  /* мультимножество только у ячеек: ключ ячейки уже = раздел + строка + столбец; у остальных порядок в DOM и есть смысл */
  for(const k in out) if(kinds[k] === 'cell') out[k].sort();
  return { keys:out, kinds, vis, stats:st };
}

const FILTERS = [['f-prob', 'Проблема'], ['f-flag', 'Отметка'], ['f-kind', 'Кто начал']];
function mode(o){
  const widths = o.widths ? String(o.widths).split(',').map(Number) : [1280, 390];
  const m = { views:o.views ? String(o.views).split(',') : null, no_drawers:!!o['no-drawers'], close_wait:o['close-wait'] == null ? 400 : +o['close-wait'],
    widths, no_filters:!!o['no-filters'], data:o.data ? 'real' : 'fixture' };
  m.partial = !!(m.views || m.no_drawers || m.close_wait < 400 || m.no_filters || widths.join(',') !== '1280,390');
  return m;
}

async function snap(o){
  const { chromium } = require('/opt/node22/lib/node_modules/playwright');
  const { build } = require('./harness/gen.cjs');
  const OP = path.resolve(o.op), SRC = path.resolve(o.src || path.join(OP, 'src'));
  const M = mode(o);
  let REAL = null;
  if(o.data){ const RD = require('./harness/realdata.cjs'); RD.refuseInRepo(o.out, 'снимок'); REAL = RD.load(o.data); }
  const fx = o.fx ? JSON.parse(o.fx) : {};
  const html = path.join(path.dirname(path.resolve(o.out)), path.basename(o.out, '.json') + '.harness.html');
  build(OP, SRC, html);
  const exp = REAL ? new Date(Math.max(...Object.values(REAL.av.recon).map(r => Date.parse(r.exported) || 0))).toISOString() : fx.export || '2026-09-22T09:00:00+03:00';
  const full = [];
  for(const v of HEAD_VIEWS) for(const c of CABS) for(const p of PERS) full.push({ id:v + '/' + c + '/' + p, hash:c + '.' + v + '.' + p });
  for(const c of CABS) for(const t of TODAY) full.push({ id:'today/' + c + '/срок ' + t, hash:c + '.today.30', today:t });
  for(const v of PLAIN) full.push({ id:v, hash:'all.' + v + '.30' });
  const browser = await chromium.launch();
  const res = { meta:{ tool:'numsnap 2.0', created:new Date().toISOString(), src:SRC, fx:REAL ? null : fx, data_mode:M.data, clock:exp, reducedMotion:true, mode:M }, states:{}, errors:[] };
  const errs = []; let curTag = '', inputSha = null, mgrs = [], filterVals = [];
  const mkctx = async width => { const ctx = await browser.newContext({ viewport:{ width, height:900 }, reducedMotion:'reduce', locale:'ru-RU', timezoneId:'Europe/Moscow' });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status:200, contentType:'text/css', body:'' }));
    await ctx.addInitScript(x => { window.__FX_OPTS = x; try{ localStorage.setItem('ks-theme', 'light'); }catch(e){} }, fx);
    if(REAL) await ctx.addInitScript(d => { window.__REAL_D = d; }, REAL);
    return ctx; };
  const open = async (ctx, hash, today) => {
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(hash + ': ' + String(e.message).slice(0, 160)));
    page.on('console', m => { if(m.type() === 'error') errs.push(hash + curTag + ': ' + m.text().slice(0, 160)); });
    await page.clock.setFixedTime(new Date(exp));
    await page.goto('file://' + html + '#' + hash);
    await page.waitForFunction(() => window.__READY === true, null, { timeout:15000 });
    if(today){ await page.click('[data-today="' + today + '"]'); await page.waitForFunction(t => { const b = document.querySelector('[data-today="' + t + '"]'); return b && b.getAttribute('aria-pressed') === 'true'; }, today); }
    await page.waitForFunction(() => [...document.querySelectorAll('#view .ks-chart')].every(c => c.querySelector('.apexcharts-canvas')), null, { timeout:4000 }).catch(() => errs.push(hash + ': графики не дорисовались за 4 с'));
    await page.waitForTimeout(120);
    return page;
  };
  const c0 = await mkctx(1280);
  { const page = await open(c0, 'all.pulse.30');
    const d = await page.evaluate(() => JSON.stringify({ av:D.av, MGRS:D.MGRS, ORDER:D.ORDER, metrics:D.metrics, meta:D.meta, talks:D.talks }));
    inputSha = sha(canon(JSON.parse(d))); mgrs = await page.evaluate(() => D.ORDER || []); await page.close();
    const pg = await open(c0, 'all.dlg.30');
    filterVals = await pg.evaluate(F => F.flatMap(([id, l]) => [...document.querySelectorAll('#' + id + ' option')].map(x => [id, l, x.value])), FILTERS); await pg.close(); }
  for(const m of mgrs) full.push({ id:'менеджер ' + m, hash:'all.' + m + '.30' });
  const fstates = filterVals.map(([id, l, v]) => ({ id:'фильтр/' + l + '=' + v, hash:'all.dlg.30', sel:'#' + id, val:v }));
  res.meta.input_sha256 = inputSha;
  res.meta.code_sha256 = sha(['shell.html', 'opgm.js', 'legacy.js', 'opgm.css', 'kx/kx.js', 'kx/kx.css'].map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\0'));
  const pick = full.filter(s => !M.views || M.views.some(v => s.id.startsWith(v)));
  res.meta.matrix = { full_states:full.length, filter_states:fstates.length, widths:M.widths };
  let n = 0;
  for(const width of M.widths){
    const ctx = width === 1280 ? c0 : await mkctx(width), suf = width === 1280 ? '' : ' @' + width  /* суффикс: state_re манифеста вида ^today/ действует на обеих ширинах */;
    const list = pick.concat(width === 1280 && !M.no_filters ? fstates : []);
    for(const s of list){
      const page = await open(ctx, s.hash, s.today);
      if(s.sel){ curTag = ' [' + s.id + ']'; await page.selectOption(s.sel, s.val); await page.waitForTimeout(150); }
      const title = await page.evaluate(() => (document.querySelector('#view h1') || {}).textContent || '');
      const main = await page.evaluate(collect, '#view');
      const inv = [];
      if(!M.no_drawers && width === 1280 && !s.sel){
        const drills = await page.evaluate(() => [...document.querySelectorAll('#view [data-drill]')].map(el => ({ drill:el.dataset.drill, label:((el.querySelector('.ks-tile-label') || el.querySelector('.ks-card-title') || {}).textContent || '').trim(), val:((el.querySelector('.ks-tile-value') || {}).textContent || '').trim() })));
        for(const d of drills){
          curTag = ' [' + d.drill + ']';
          const ok = await page.evaluate(id => { if(!KS.drawer.providers[id]) return false; KS.drawer.open(id); return document.getElementById('ks-drawer').classList.contains('is-open'); }, d.drill);
          if(!ok){ inv.push({ drill:d.drill, label:d.label, opened:false }); continue; }
          await page.waitForFunction(() => { const d = document.getElementById('ks-drawer'); return !d.querySelector('.ks-chart') || d.querySelector('.ks-chart .apexcharts-canvas'); }, null, { timeout:3000 }).catch(() => {});
          await page.waitForTimeout(80);
          const dr = await page.evaluate(collect, '#ks-drawer');
          for(const k in dr.keys){ main.keys['[' + d.drill + '] ' + k] = dr.keys[k]; main.kinds['[' + d.drill + '] ' + k] = dr.kinds[k]; main.vis['[' + d.drill + '] ' + k] = dr.vis[k]; }
          /* назначенный узел итога панели: [data-panel-total] или кнопка «все N в «Все диалоги»»; пустая панель «таких диалогов нет» = итог 0 */
          const tot = await page.evaluate(() => { const dw = document.getElementById('ks-drawer'), t = dw.querySelector('[data-panel-total]');
            if(t) return { node:'data-panel-total', val:t.textContent };
            const b = [...dw.querySelectorAll('button, a')].find(x => /^все\s+[\d\s  ]+\s+в «Все диалоги»/.test(x.textContent.trim()));
            if(b) return { node:'кнопка «все N»', val:b.textContent };
            if(/таких диалогов нет/.test(dw.textContent)) return { node:'пустая панель', val:'0' };
            return null; });
          const nums = s => (String(s).replace(/[   ]/g, ' ').replace(/(\d) (?=\d{3}(?!\d))/g, '$1').match(/\d+(?:[.,]\d+)*/g) || []);
          const tv = nums(d.val), all = Object.values(dr.keys).flat();
          inv.push({ drill:d.drill, label:d.label, opened:true, tile:tv, total_node:tot ? tot.node : null, total:tot ? nums(tot.val) : null,
            inPanel:tot ? tv.length > 0 && JSON.stringify(nums(tot.val)) === JSON.stringify(tv) : null,
            anyNumber:tv.length > 0 && (tv.every(t => t === '0') || tv.every(t => all.includes(t))), panelNodes:dr.stats.nodes });
          await page.evaluate(() => KS.drawer.close());
          await page.waitForTimeout(M.close_wait  /* больше таймера очистки панели 320 мс, kit.js:330 */);
        }
      }
      curTag = ' [после панелей]';
      res.states[s.id + suf] = { title, keys:main.keys, kinds:main.kinds, vis:main.vis, stats:main.stats, inv };
      n++;
      await page.close();
    }
  }
  await browser.close();
  res.errors = errs;
  res.meta.states = n;
  res.meta.matrix.expected = full.length * 2 + fstates.length;
  if(REAL) require('./harness/realdata.cjs').refuseInRepo(o.out, 'снимок');
  fs.writeFileSync(o.out, JSON.stringify(res));
  const tot = Object.values(res.states).reduce((a, s) => { for(const k in s.stats) a[k] = (a[k] || 0) + s.stats[k]; return a; }, {});
  const invs = Object.values(res.states).flatMap(s => s.inv), op = invs.filter(x => x.opened), des = op.filter(x => x.total_node);
  console.log('СНИМОК', o.out, '| данные:', M.data === 'real' ? 'РЕАЛЬНЫЕ (только вне репозитория)' : 'фикстура');
  console.log('  режим:', M.partial ? 'ЧАСТИЧНЫЙ' : 'полный', '| ширины', M.widths.join(','), '| views', M.views ? M.views.join(',') : 'все', '| панели', M.no_drawers ? 'нет' : 'да', '| close-wait', M.close_wait, '| фильтры', M.no_filters ? 'нет' : 'да');
  console.log('  матрица: состояний снято', n, 'из', res.meta.matrix.expected, '(экраны ' + full.length + ' x ширины 2 + фильтры «Все диалоги» ' + fstates.length + ')');
  console.log('  ключей', Object.values(res.states).reduce((a, s) => a + Object.keys(s.keys).length, 0), '| узлов с цифрами', tot.nodes, '(плитки', tot.tile + ', ячейки', tot.cell + ', полосы', tot.bar + ', вердикт', tot.verdict + ', прочий текст', tot.text + ', атрибуты', tot.attr + ', графики', tot.chart + ') | нечитаемых узлов', tot.unreadable);
  console.log('  слабых ключей (раздел «экран», текст без слов):', tot.weak || 0);
  console.log('  панелей деталей открыто', op.length, 'из', invs.length, '| итог панели назначен', des.length, 'из', op.length, '| число плитки = итог панели:', des.filter(x => x.inPanel).length, 'да,', des.filter(x => !x.inPanel).length, 'нет | без назначенного итога', op.length - des.length, '(старое правило «число где-то в панели» дало бы да у', op.filter(x => !x.total_node && x.anyNumber).length + ')');
  const race = errs.filter(e => /\[[a-z0-9]+-[A-Z-]+\]: Error: <(svg|g|foreignObject)> attribute .*NaN/.test(e)), hard = errs.filter(e => !race.includes(e));
  console.log('  входы sha256', inputSha.slice(0, 16), '| код sha256', res.meta.code_sha256.slice(0, 16), '| часы', exp, '| ошибок консоли', hard.length, '| NaN графика панели (гонка кита, предупреждение)', race.length);
  hard.slice(0, 3).forEach(e => console.log('    ошибка:', e));
  return hard.length ? 2 : 0;
}

function diff(o){
  const A = JSON.parse(fs.readFileSync(o._[1], 'utf8')), B = JSON.parse(fs.readFileSync(o._[2], 'utf8'));
  const M = o.manifest ? JSON.parse(fs.readFileSync(o.manifest, 'utf8')) : {};
  const show = +(o.show || 30), noval = !!o['no-values'] || ((A.meta.data_mode === 'real' || B.meta.data_mode === 'real') && !o.values)  /* реальные данные: значения не печатаются, только ключи и число токенов */;
  const ma = A.meta.mode || {}, mb = B.meta.mode || {};
  const scope = m => JSON.stringify([m.views, m.no_drawers, m.close_wait, m.widths, m.no_filters]);
  if(!A.meta.mode || !B.meta.mode){ console.log('СТОП: снимок без режима прогона в meta (numsnap 1.x), пересъёмка numsnap 2.0'); return 2; }
  if(scope(ma) !== scope(mb)){ console.log('СТОП: режимы прогона разные, пара не сравнима:', scope(ma), 'против', scope(mb)); return 2; }
  if((ma.partial || mb.partial) && !o['allow-partial']){ console.log('СТОП: частичный снимок (' + scope(mb) + '), приёмка волны требует полной матрицы; сравнить частичный можно только с явным --allow-partial'); return 2; }
  if(A.meta.input_sha256 !== B.meta.input_sha256){
    console.log('СТОП: входы разные, пара «до/после» не сравнима:', A.meta.input_sha256.slice(0, 16), 'против', B.meta.input_sha256.slice(0, 16));
    return 2;
  }
  const use = {}; const mark = (kind, i) => { use[kind + i] = (use[kind + i] || 0) + 1; };
  const match = (list, kind, key, sid) => { for(let i = 0; i < (list || []).length; i++){ const e = list[i];
    if(new RegExp(e.key_re).test(key) && (!e.state_re || new RegExp(e.state_re).test(sid))) return [e, i]; } return [null, -1]; };
  const bad = [], expl = { rename:0, new:0, change:0, removed:0, vis:0 }, cnt = { same:0 };
  const weakNew = (M.allow_new || []).filter(e => e.value_must_exist !== false && !e.value_from_re).length;
  const V = t => noval ? '[' + t.length + ' ток.]' : '[' + t.join(' ') + ']';
  for(const sid of new Set([...Object.keys(A.states), ...Object.keys(B.states)])){
    const a = A.states[sid], b = B.states[sid];
    if(!a || !b){ bad.push([sid, a ? 'состояние пропало' : 'новое состояние', '', '']); continue; }
    const ak = {}, av = {}, akind = {};
    for(const [k, t] of Object.entries(a.keys)){
      let k2 = k; (M.rename || []).forEach((r, i) => { if(k2.includes(r.from)){ k2 = k2.split(r.from).join(r.to); mark('rename', i); } });
      if(k2 !== k) expl.rename++;
      (ak[k2] = ak[k2] || []).push(...t); av[k2] = (av[k2] || 0) + ((a.vis || {})[k] || 0); akind[k2] = (a.kinds || {})[k];
    }
    for(const k in ak) if(akind[k] === 'cell') ak[k].sort();
    const bk = b.keys, before = Object.values(ak).flat();
    for(const k of new Set([...Object.keys(ak), ...Object.keys(bk)])){
      const x = ak[k], y = bk[k];
      if(x && y){
        const vb = (b.vis || {})[k] || 0;
        if(vb < av[k]){ const [e, i] = match(M.allow_hidden, 'hidden', k, sid);
          if(e){ mark('allow_hidden', i); expl.vis++; } else bad.push([sid, 'перестал читаться', k, 'читаемых узлов ' + av[k] + ' -> ' + vb]); }
        if(x.join('\u0001') === y.join('\u0001')){ cnt.same++; continue; }
        const [e, i] = match(M.allow_change, 'change', k, sid);
        if(e){ mark('allow_change', i); expl.change++; continue; }
        bad.push([sid, 'изменилось', k, V(x) + ' -> ' + V(y)]);
      } else if(y){
        const [e, i] = match(M.allow_new, 'new', k, sid);
        if(e){
          const pool = e.value_from_re ? Object.entries(ak).filter(([kk]) => new RegExp(e.value_from_re).test(kk)).flatMap(([, t]) => t) : before.slice(), miss = y.filter(t => { const j = pool.indexOf(t); if(j < 0) return true; pool.splice(j, 1); return false; });
          if(e.value_must_exist === false || !miss.length){ mark('allow_new', i); expl.new++; continue; }
          bad.push([sid, 'новый узел, значения не было на экране', k, V(miss)]); continue;
        }
        bad.push([sid, 'новый узел', k, V(y)]);
      } else {
        const [e, i] = match(M.allow_removed, 'removed', k, sid);
        if(e){ mark('allow_removed', i); expl.removed++; continue; }
        bad.push([sid, 'узел пропал', k, V(x)]);
      }
    }
    /* слой поверх: число плитки = назначенный итог панели; ухудшение против базы = расхождение */
    const ai = Object.fromEntries((a.inv || []).map(x => [x.drill, x]));
    for(const x of b.inv || []){ const p = ai[x.drill];
      if(x.opened && x.inPanel === false && (!p || p.inPanel !== false)) bad.push([sid, 'итог панели не равен числу плитки', x.drill, V(x.tile) + ' против ' + V(x.total || [])]);
      if(x.opened && p && p.total_node && !x.total_node) bad.push([sid, 'назначенный итог панели пропал', x.drill, p.total_node]);
      if(!x.opened && (!p || p.opened)) bad.push([sid, 'панель деталей не открылась', x.drill, '']); }
  }
  const unused = [];
  ['rename', 'allow_new', 'allow_change', 'allow_removed', 'allow_hidden'].forEach(kind => (M[kind] || []).forEach((e, i) => { if(!use[kind + i]) unused.push(kind + '[' + i + '] ' + (e.from || e.key_re) + ' (' + (e.reason || 'без причины') + ')'); }));
  const states = Object.keys(B.states).length, keys = Object.values(B.states).reduce((s, x) => s + Object.keys(x.keys).length, 0);
  const invB = Object.values(B.states).flatMap(s => s.inv || []);
  console.log('СРАВНЕНИЕ', path.basename(o._[1]), '->', path.basename(o._[2]), '| манифест', o.manifest ? path.basename(o.manifest) : 'нет', '| данные', B.meta.data_mode || 'fixture');
  console.log('  режим:', mb.partial ? 'ЧАСТИЧНЫЙ (--allow-partial)' : 'полный', '| матрица: состояний', states, 'из', (B.meta.matrix || {}).expected, '| панелей', invB.filter(x => x.opened).length, 'из', invB.length, '| ширины', (mb.widths || []).join(','));
  console.log('  входы sha256 одинаковые:', A.meta.input_sha256.slice(0, 16), '| код до', A.meta.code_sha256.slice(0, 12), 'после', B.meta.code_sha256.slice(0, 12));
  console.log('  ключей после', keys, '| совпало', cnt.same, '| объяснено манифестом: переименований', expl.rename, ', новых узлов', expl.new, ', изменений', expl.change, ', удалений', expl.removed, ', скрытий', expl.vis);
  console.log('  НЕОБЪЯСНЁННЫХ РАСХОЖДЕНИЙ:', bad.length, '| неиспользованных записей манифеста:', unused.length);
  const byKind = {}; bad.forEach(r => byKind[r[1]] = (byKind[r[1]] || 0) + 1);
  if(bad.length) console.log('  по видам:', Object.entries(byKind).map(([k, v]) => k + ' ' + v).join(', '));
  bad.slice(0, show).forEach(r => console.log('   ', r[0], '|', r[1], '|', r[2], '|', r[3]));
  if(bad.length > show) console.log('    ... ещё', bad.length - show);
  unused.forEach(u => console.log('    манифест не сработал:', u));
  if(weakNew) console.log('    предупреждение: записей allow_new без value_from_re', weakNew, '(значение ищется по всему экрану, слабее)');
  const code = bad.length || unused.length ? 1 : 0;
  console.log(code ? 'ИТОГ: FAIL (код 1)' : 'ИТОГ: PASS (код 0)');
  return code;
}

(async () => {
  const o = args(process.argv.slice(2));
  try{
    if(o._[0] === 'snap' && o.op && o.out) process.exit(await snap(o));
    if(o._[0] === 'diff' && o._[1] && o._[2]) process.exit(diff(o));
    console.error('usage: numsnap.cjs snap --op DIR [--src DIR] --out FILE [--fx JSON | --data DIR] [--views a,b] [--no-drawers] [--close-wait MS] [--widths 1280] [--no-filters] | diff A B [--manifest M] [--allow-partial]'); process.exit(2);
  }catch(e){ console.error('ОШИБКА:', e && e.message || e); process.exit(e && e.code === 2 ? 2 : 2); }
})();
