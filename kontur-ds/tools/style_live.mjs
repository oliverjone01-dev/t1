// Живая проверка стиля в браузере (1.5.1, выключатель и путь с # в 1.5.2): те же признаки шаблонного интерфейса, что у сторожа, но по вычисленным
// стилям отрисованной страницы, а не по тексту исходника. Ловит то, что статически не видно: цвет полосы из другого
// правила или другого файла, значения из переменных чужого файла, стиль, поставленный скриптом, запущенные анимации.
// Видит только то, что отрисовано на открытой странице: состояния по наведению и экраны за кликом не проверяются.
// Запуск: node tools/style_live.mjs templates/obzor.html specimen.html
// Выход 1, если есть находки. Строки находок начинаются с трёх пробелов: «   [КОД] файл тема ширина: что».
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// 1.5.2: выключатель ложной тревоги. Свойство --ks-allow, объявленное на самом элементе (или на его ::before/::after):
// --ks-allow: "SIDESTRIPE: рельс таймлайна". Находка с этим кодом у элемента печатается строкой ВЫКЛ с причиной
// и не считается. Без причины или с кодом не из списка это находка [ALLOW].
// Свойство регистрируется ненаследуемым (CSS.registerProperty): у потомков его нет, даже если у них тот же класс.
// Функция живёт внутри проверки, а не глобалом страницы: скрипт страницы не может её подменить.
const ALLOW_FN = `
  try { CSS.registerProperty({ name: '--ks-allow', syntax: '*', inherits: false }); } catch (e) {}
  const __t = document.createElement('div'); __t.style.setProperty('--ks-allow', 'x'); const __c = document.createElement('i'); __t.appendChild(__c); document.body.appendChild(__t);
  const __nonInh = getComputedStyle(__c).getPropertyValue('--ks-allow').trim() === ''; __t.remove();
  const __g = (e, ps) => getComputedStyle(e, ps || null).getPropertyValue('--ks-allow').trim();
  const __own = (e, ps) => {
    if (__nonInh) return (ps && __g(e, ps)) || __g(e);
    const v = __g(e), pv = e.parentElement ? __g(e.parentElement) : '';
    return v && v !== pv ? v : '';
  };
  const __ok = new Set(['SIDESTRIPE', 'DENSITYTAP', 'OPACITY', 'CAPSBADGE', 'LOOPANIM', 'HEX']);
  const __ksAllow = (el, ps) => {
    if (!el || el.nodeType !== 1) return null;
    const v = __own(el, ps); if (!v) return null;
    const m = v.match(/^["']?\\s*([A-Z][A-Z ,]*?)\\s*:\\s*(.+?)\\s*["']?$/);
    if (!m || m[2].length < 8) return { bad: v };
    const codes = m[1].split(/[ ,]+/).filter(Boolean);
    return codes.every(c => __ok.has(c)) ? { codes, why: m[2] } : { bad: v };
  };`;
const wrap = fn => `(() => { ${ALLOW_FN}\n return (${fn.toString()})(); })()`;
const open = async (page, f) => { await page.goto(pathToFileURL(path.resolve(f)).href); };

const files = process.argv.slice(2);
if (!files.length) { console.log('укажите html-файлы'); process.exit(2); }
const browser = await chromium.launch();
let total = 0;

const scan = () => {
  const out = [];
  let cur = null;
  const push = it => { const a = cur && (Array.isArray(cur) ? __ksAllow(cur[0], cur[1]) : __ksAllow(cur)); if (a && a.codes && a.codes.includes(it[0])) out.push(['~' + it[0], it[1] + ' | причина: ' + a.why]); else out.push(it); };
  const name = e => ((e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '') || e.tagName.toLowerCase()).slice(0, 48);
  const root = getComputedStyle(document.documentElement);
  const probe = document.createElement('i'); document.body.appendChild(probe);
  const col = v => { probe.style.color = ''; probe.style.color = v; return getComputedStyle(probe).color; };
  const neutral = new Set(['--border', '--border-strong', '--divider', '--card-border', '--grid'].map(k => col(root.getPropertyValue(k).trim())));
  const surfC = col(root.getPropertyValue('--surface').trim());
  probe.remove();
  const clear = c => /rgba\(\d+, \d+, \d+, 0\)/.test(c) || c === 'transparent';
  // мягкий тон (контраст с поверхностью меньше 1,3: рельс, дорожка, выделение) полосой не считается
  // цвет в sRGB через холст (любая запись: oklch, color-mix, color(...)), полупрозрачный смешивается с поверхностью
  const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true });
  const rgba = c => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const alphaOf = c => rgba(c)[3];
  const S = rgba(surfC);
  const lum = c => { const [r, g, b, a] = rgba(c); const m = [r, g, b].map((v, i) => v * a + S[i] * (1 - a)); const f = x => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
  const surf = lum(surfC);
  const soft = c => { const l = lum(c); const r = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); return r(l, surf) < 1.3; };
  const colored = c => !clear(c) && !neutral.has(c) && !soft(c);
  const hasText = e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
  // aria-hidden не пропускаем: декоративная полоса часто скрыта от диктора, но видна глазу
  const skip = e => e.closest('svg, canvas, .apexcharts-canvas, .ks-sr-only, code, pre, kbd');
  for (const e of document.querySelectorAll('body *')) {
    const al = __ksAllow(e); if (al && al.bad) out.push(['ALLOW', name(e) + ' --ks-allow без причины или с правилом, которое не выключается: ' + al.bad.slice(0, 50)]);
    if (!e.getClientRects().length || skip(e)) continue;
    cur = e;
    const cs = getComputedStyle(e), r = e.getBoundingClientRect();
    // SIDESTRIPE: рамка сбоку, тень-полоса, псевдоэлемент-полоса, узкий цветной блок
    // полоса это рамка с одной стороны: рамка вокруг (выбранная карточка, кольцо аватара, fieldset) полосой не считается
    // сторона выделяется толщиной или цветом: остальные стороны тоньше, бесцветны или другого цвета
    const sideStripe = (st, who) => {
      const bw = k => st['border' + k + 'Style'] === 'none' ? 0 : parseFloat(st['border' + k + 'Width']);
      for (const side of ['Left', 'Right']) {
        const w = bw(side), c = st['border' + side + 'Color'], other = side === 'Left' ? 'Right' : 'Left';
        if (w < 2 || !colored(c)) continue;
        const quiet = k => bw(k) < w / 2 || !colored(st['border' + k + 'Color']) || st['border' + k + 'Color'] !== c;
        if (quiet('Top') && quiet('Bottom') && quiet(other)) push(['SIDESTRIPE', who + ' рамка ' + side.toLowerCase() + ' ' + w + 'px']);
      }
    };
    sideStripe(cs, name(e));
    for (const part of cs.boxShadow === 'none' ? [] : cs.boxShadow.split(/,(?![^(]*\))/)) {
      const nums = (part.match(/-?\d+(?:\.\d+)?px/g) || []).map(parseFloat); const c = (part.match(/rgba?\([^)]*\)/) || [''])[0];
      if (nums.length >= 2 && Math.abs(nums[0]) >= 2 && nums[1] === 0 && !(nums[2] > 0) && !(nums[3] > 0) && colored(c)) push(['SIDESTRIPE', name(e) + ' тень ' + part.trim().slice(0, 40)]);
    }
    for (const ps of ['::before', '::after']) {
      const p = getComputedStyle(e, ps); if (p.content === 'none' || p.display === 'none') continue;
      cur = [e, ps];
      const w = parseFloat(p.width), h = parseFloat(p.height);
      const gcol = (p.backgroundImage.match(/(?:rgba?|oklch|oklab|lab|color)\([^()]*\)/) || [''])[0];
      if (w >= 1 && w <= 4 && h >= 16 && (colored(p.backgroundColor) || (gcol && colored(gcol)))) push(['SIDESTRIPE', name(e) + ps + ' полоса ' + w + 'x' + Math.round(h)]);
      sideStripe(p, name(e) + ps);
      if (p.textTransform === 'uppercase' && p.content && p.content !== 'none' && p.content !== '""' && !e.closest('.ks-caps')) push(['CAPSBADGE', name(e) + ps + ' капс в content']);
    }
    cur = e;
    // край градиента в фоне: цвет до 6 px, дальше другой цвет или прозрачность
    const hg = cs.backgroundImage.match(/linear-gradient\((?:90deg|to right|270deg|to left)?,?\s*((?:rgba?|oklch|oklab|lab|color)\([^()]*\))\s+(\d+(?:\.\d+)?)px,\s*((?:rgba?|oklch|oklab|lab|color)\([^()]*\))\s+(?:\2px|0px)/);
    if (hg && +hg[2] <= 6 && colored(hg[1]) && hg[1] !== hg[3]) push(['SIDESTRIPE', name(e) + ' край градиента ' + hg[2] + 'px']);
    // узкий цветной блок полоса, когда он стоит с краю рядом с текстом. Столбики данных (несколько узких соседей),
    // ручки (курсор изменения размера), бегунки и линии внутри графика полосой не считаются
    if (r.width >= 1 && r.width <= 4 && r.height >= 16 && colored(cs.backgroundColor) && !/resize/.test(cs.cursor)) {
      const par = e.parentElement, kids = par ? [...par.children] : [];
      const narrowSibs = kids.filter(k => k !== e && k.getBoundingClientRect().width <= 4 && k.getBoundingClientRect().height > 0).length;
      const edgeChild = kids[0] === e || kids[kids.length - 1] === e || cs.position === 'absolute' || /^H[1-6]$/.test(par ? par.tagName : '');
      const textNear = par && (par.textContent || '').replace(e.textContent || '', '').trim().length > 0;
      if (edgeChild && textNear && narrowSibs < 2 && !(par && par.querySelector('svg, canvas')))
        push(['SIDESTRIPE', name(e) + ' узкий блок ' + Math.round(r.width) + 'x' + Math.round(r.height)]);
    }
    // CAPSBADGE: капс вне рецепта .ks-caps и вне полей ввода
    // рецепт короткой метки: разрядка --tracking-caps (как у .ks-caps) считается законным капсом
    const recipe = Math.abs(parseFloat(cs.letterSpacing) - parseFloat(root.getPropertyValue('--tracking-caps')) * parseFloat(cs.fontSize)) < 0.3;
    if (hasText(e) && (cs.textTransform === 'uppercase' || /small-caps|petite-caps/.test(cs.fontVariantCaps)) && !recipe && !e.closest('.ks-caps, input, textarea, .ks-input'))
      push(['CAPSBADGE', name(e) + ' «' + e.textContent.trim().slice(0, 20) + '»']);
    // GRADMARK: градиент на знаке бренда
    const markish = el => el && /brand|logo|emblem|monogram|mark|home|главн/i.test(((typeof el.className === 'string' ? el.className : (el.className && el.className.baseVal) || '') + ' ' + (el.id || '') + ' ' + (el.getAttribute && (el.getAttribute('aria-label') || '') || '')));
    if (markish(e) && /gradient\(/.test(cs.backgroundImage)) push(['GRADMARK', name(e)]);
    // OPACITY: текст, приглушённый прозрачностью (своей или родителя) или полупрозрачным цветом
    if (hasText(e) && !e.closest('[disabled], [aria-disabled="true"], .is-disabled, .ks-skeleton, .ks-tip, .ks-backdrop')) {
      let a = 1, n = e; while (n && n.nodeType === 1) { a *= parseFloat(getComputedStyle(n).opacity); const f = getComputedStyle(n).filter.match(/opacity\(([\d.]+)\)/); if (f) a *= parseFloat(f[1]); n = n.parentElement; }
      const ca = Math.min(alphaOf(cs.color), cs.webkitTextFillColor ? alphaOf(cs.webkitTextFillColor) : 1);
      if (a < 0.95 && a > 0.05) push(['OPACITY', name(e) + ' прозрачность ' + a.toFixed(2)]);
      else if (ca < 0.95 && ca > 0.05) push(['OPACITY', name(e) + ' цвет с прозрачностью ' + ca.toFixed(2)]);
    }
  }
  // знак бренда в SVG, залитый градиентом (свой defs, общий defs, svg внутри ссылки на главную или обёртки знака)
  for (const sv of document.querySelectorAll('svg')) {
    const r = sv.getBoundingClientRect(); if (!r.width || r.width > 64 || r.height > 64) continue;
    const host = [sv, sv.parentElement, sv.parentElement && sv.parentElement.parentElement].find(x => x && /brand|logo|emblem|monogram|mark|home|главн/i.test(((x.className && (x.className.baseVal != null ? x.className.baseVal : x.className)) || '') + ' ' + (x.id || '') + ' ' + ((x.getAttribute && x.getAttribute('aria-label')) || '')));
    if (!host) continue;
    cur = host;
    const grad = [...sv.querySelectorAll('*')].some(sh => { const f = getComputedStyle(sh).fill; const m = f && f.match(/url\("?#([^")]+)"?\)/); if (!m) return false; const g = document.getElementById(m[1]); return g && /Gradient$/.test(g.tagName); });
    if (grad) push(['GRADMARK', 'svg-знак с градиентом в ' + name(host)]);
  }
  // LOOPANIM: запущенные бесконечные анимации (CSS, Web Animations) и SMIL; вращение загрузки и скелетон разрешены
  for (const an of document.getAnimations()) {
    const t = an.effect && an.effect.getTiming && an.effect.getTiming(), tg = an.effect && an.effect.target;
    cur = tg && tg.nodeType === 1 ? tg : null;
    if (!t || !(t.iterations === Infinity || t.iterations >= 50)) continue;
    const busy = tg && tg.closest && tg.closest('.ks-sync, .ks-skeleton, [aria-busy="true"], [role="progressbar"], [class*="load"], [class*="spin"]');
    if ((an.animationName === 'ks-spin' || an.animationName === 'ks-shimmer') && busy) continue;
    push(['LOOPANIM', (tg && tg.nodeType === 1 ? name(tg) : 'анимация') + ' ' + (an.animationName || 'element.animate')]);
  }
  for (const s of document.querySelectorAll('animate, animateTransform, animateMotion, set'))
    if ((cur = s.parentElement) && /indefinite/.test((s.getAttribute('repeatCount') || '') + (s.getAttribute('repeatDur') || '')) || +(s.getAttribute('repeatCount') || 0) >= 50) push(['LOOPANIM', 'SMIL ' + s.tagName]);
  return out;
};

// мигание скриптом: элемент, который сам (без ввода) переключает класс, hidden или стиль три раза и чаще за 2 с.
// Так ловится цикл на setInterval, setTimeout и animationend, которого нет в списке анимаций браузера
const blinkScan = () => new Promise(done => {
  const n = new Map();
  const mo = new MutationObserver(ms => { for (const m of ms) { const t = m.target; if (t.nodeType !== 1 || t.closest('svg, canvas, .apexcharts-canvas, .ks-tip, .ks-toasts')) continue; n.set(t, (n.get(t) || 0) + 1); } });
  mo.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class', 'hidden', 'style'] });
  setTimeout(() => { mo.disconnect();
    const name = e => ((e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '') || e.tagName.toLowerCase()).slice(0, 48);
    done([...n].filter(([, k]) => k >= 3).map(([e, k]) => { const a = __ksAllow(e), msg = name(e) + ' переключается скриптом ' + k + ' раз за 2 с';
      return a && a.codes && a.codes.includes('LOOPANIM') ? ['~LOOPANIM', msg + ' | причина: ' + a.why] : ['LOOPANIM', msg]; })); }, 2000);
});

const tapScan = () => {
  const out = [];
  let cur = null;
  const push = it => { const a = cur && (Array.isArray(cur) ? __ksAllow(cur[0], cur[1]) : __ksAllow(cur)); if (a && a.codes && a.codes.includes(it[0])) out.push(['~' + it[0], it[1] + ' | причина: ' + a.why]); else out.push(it); };
  const name = e => ((e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '') || e.tagName.toLowerCase()).slice(0, 48);
  // цели: кнопки, поля, отдельные ссылки (ссылка в строке текста по WCAG 2.5.8 исключение), роли кнопки и вкладки
  for (const e of document.querySelectorAll('button, select, input:not([type="hidden"]), textarea, a[href], summary, [role="button"], [role="tab"], [role="switch"], [role="checkbox"], [role="radio"], [role="menuitem"], [role="option"], [tabindex]:not([tabindex="-1"]), [onclick], .ks-nav-item')) {
    // ссылка в строке текста исключение (WCAG 2.5.8); ссылка, которая одна в своём блоке, это отдельная цель
    if (e.matches('a[href]') && getComputedStyle(e).display === 'inline') { const par = e.parentElement; const rest = par ? (par.textContent || '').replace(e.textContent || '', '').trim() : ''; if (rest) continue; }
    // inert и скрытое: не цель пальца (предпросмотр, закрытые панели)
    if (!e.getClientRects().length || e.closest('[hidden], [inert], .ks-cmdk-bd[hidden]')) continue;
    let r = e.getBoundingClientRect(); if (r.width === 0) continue;
    // флажок и переключатель: цель это подпись вместе с полем; поле цвета мерится само
    if (e.matches('input[type="checkbox"], input[type="radio"]')) { const lb = e.closest('label'); if (lb) r = lb.getBoundingClientRect(); }
    if (e.matches('input[type="range"]')) continue;
    // у кнопок и полей меряется меньшая сторона, у ссылок высота: ширина ссылки задаётся словом
    // зона касания может быть шире элемента за счёт псевдоэлемента (::before с отрицательным inset)
    let hw = r.width, hh = r.height;
    for (const ps of ['::before', '::after']) { const p = getComputedStyle(e, ps); if (p.content !== 'none' && p.position === 'absolute') { hw = Math.max(hw, parseFloat(p.width) || 0); hh = Math.max(hh, parseFloat(p.height) || 0); } }
    const side = e.matches('a[href]') ? hh : Math.min(hw, hh);
    cur = e;
    if (side < 35.5) push(['DENSITYTAP', name(e) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)]);
  }
  return out;
};

for (const f of files) {
  const seen = new Set();
  const off = new Set();
  const report = (code, where, what) => {
    if (code[0] === '~') { const k = code + what; if (!off.has(k)) { off.add(k); console.log(`   ВЫКЛ [${code.slice(1)}] ${path.basename(f)} ${where}: ${what}`); } return; }
    const k = code + what; if (seen.has(k)) return; seen.add(k); total++; console.log(`   [${code}] ${path.basename(f)} ${where}: ${what}`); };
  for (const theme of ['light', 'dark']) {
    for (const width of [1280, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await open(page, f);
      await page.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme);
      await page.waitForTimeout(1200);
      for (const [code, what] of await page.evaluate(wrap(scan))) report(code, `тема=${theme} ширина=${width}`, what);
      if (theme === 'light' && width === 1280) for (const [code, what] of await page.evaluate(wrap(blinkScan))) report(code, 'за 2 с после открытия', what);
      await page.close();
    }
  }
  // цели пальца: касание, компактная плотность, 390
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await open(page, f);
  await page.evaluate(() => document.documentElement.setAttribute('data-density', 'compact'));
  await page.waitForTimeout(900);
  for (const [code, what] of await page.evaluate(wrap(tapScan))) report(code, 'касание компакт 390', what);
  await ctx.close();
  console.log(`${seen.size ? 'есть' : 'ок '}  ${f}  находок=${seen.size}`);
}
await browser.close();
console.log(total ? `\nСТИЛЬ ЖИВЬЁМ: находок ${total}` : '\nСТИЛЬ ЖИВЬЁМ: чисто');
process.exit(total ? 1 : 0);
