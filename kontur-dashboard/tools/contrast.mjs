/* Живой контраст на всех экранах: каждый видимый текст, его реальный цвет и
   реальный фон под ним сверяются с WCAG AA (4,5:1, крупный текст 3:1).
   Функция замера взята как есть из kontur-ds/tools/contrast_live.mjs (Контур DS 1.5).
   Пакетный сторож check_ds.py --live открывает только первый экран и при сбое запуска
   браузера молчит (код выхода 1 он читает как «провалы найдены», а их нет в выводе):
   здесь обходятся все экраны обоих проектов в двух темах на 1280 и 390, а сбой
   браузера роняет проверку.
   Запуск: node tools/contrast.mjs   (библиотеки как у smoke.mjs: KONTUR_LIBS, KONTUR_TMP) */
import { chromium } from 'playwright';
import fs from 'fs';
const LIBS = process.env.KONTUR_LIBS || '/tmp/claude-0';
const OUT  = process.env.KONTUR_TMP  || '/tmp/claude-0';
const CHROME = process.env.KONTUR_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
fs.mkdirSync(OUT, { recursive:true });
fs.writeFileSync(OUT + '/contrast.html', html
  .replace(/<script src="https:\/\/cdnjs[^"]+"><\/script>/, '<script src="file://' + LIBS + '/apex.js"></script>')
  .replace(/<link rel="stylesheet" href="https:\/\/fonts[^"]+">/, ''));

const CHECK = () => {
        const parse = s => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null;
          const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
        const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
        const L = c => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
        const ratio = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
        const over = (top, base) => ({ r: top.r * top.a + base.r * (1 - top.a), g: top.g * top.a + base.g * (1 - top.a), b: top.b * top.a + base.b * (1 - top.a), a: 1 });
        const bgOf = el => {
          const layers = []; let n = el;
          while (n && n.nodeType === 1) {
            const cs = getComputedStyle(n);
            if (cs.backgroundImage && cs.backgroundImage !== 'none' && !cs.backgroundImage.startsWith('url')) return 'gradient';
            const c = parse(cs.backgroundColor);
            if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; }
            n = n.parentElement;
          }
          let base = { r: 255, g: 255, b: 255, a: 1 };
          for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base);
          return base;
        };
        const hex = c => '#' + [c.r, c.g, c.b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
        const name = el => { let s = el.tagName.toLowerCase(); if (el.id) s += '#' + el.id; else if (el.classList.length) s += '.' + [...el.classList].slice(0, 2).join('.'); const p = el.closest('[data-theme]'); return s + ' @' + (p ? p.getAttribute('data-theme') : '-'); };
        const out = []; const seen = new Set();
        const all = document.querySelectorAll('body *');
        for (const el of all) {
          const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length);
          if (!own) continue;
          if (el.closest('[aria-hidden="true"], [hidden], .ks-drawer:not(.open)')) continue;
          const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
          const cs = getComputedStyle(el);
          if (cs.visibility === 'hidden' || cs.display === 'none') continue;
          const isSvg = el instanceof SVGElement;
          let fg = parse(isSvg ? (el.getAttribute('fill') && el.getAttribute('fill').startsWith('rgb') ? el.getAttribute('fill') : cs.fill) : cs.color);
          if (isSvg && (!fg || cs.fill === 'none')) { const h = el.getAttribute('fill'); if (h && /^#[0-9a-f]{6}$/i.test(h)) fg = { r: parseInt(h.slice(1,3),16), g: parseInt(h.slice(3,5),16), b: parseInt(h.slice(5,7),16), a: 1 }; }
          if (!fg) continue;
          const bg = bgOf(isSvg ? (el.closest('div') || el) : el);
          if (bg === 'gradient') continue;
          const fgc = fg.a < 1 ? over(fg, bg) : fg;
          const px = parseFloat(cs.fontSize), w = parseInt(cs.fontWeight) || 400;
          const need = (px >= 24 || (px >= 18.66 && w >= 700)) ? 3 : 4.5;
          const k = ratio(fgc, bg);
          if (k + 1e-9 < need) {
            const key = name(el) + hex(fgc) + hex(bg);
            if (seen.has(key)) continue; seen.add(key);
            out.push(`${name(el)}  ${hex(fgc)} на ${hex(bg)}  ${k.toFixed(2)}:1 < ${need}  «${el.textContent.trim().slice(0, 40)}»`);
          }
        }
        return out;
      }
;
const browser = await chromium.launch(CHROME ? { executablePath:CHROME } : {});
let total = 0, pages = 0; const agg = new Map(), errs = [];
for (const width of [1280, 390]) for (const theme of ['light', 'dark']) {
  const page = await browser.newPage({ viewport:{ width, height:900 } });
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + OUT + '/contrast.html', { waitUntil:'load', timeout:60000 });
  await page.waitForTimeout(1000);
  await page.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme);
  await page.waitForTimeout(400);
  const views = await page.evaluate(() => Object.keys(screens()));
  for (const proj of ['gm', 'gg']) for (const v of views) {
    await page.evaluate(([p, x]) => { CUR = p; go(x); }, [proj, v]);
    await page.waitForTimeout(width === 1280 ? 650 : 350);
    const fails = await page.evaluate(CHECK);
    pages++; total += fails.length;
    for (const f of fails) { const k = f.replace(/«.*»/, '');
      if (!agg.has(k)) agg.set(k, { f, where:[] }); agg.get(k).where.push(theme + '/' + width + '/' + proj + '/' + v); }
  }
  await page.close();
}
await browser.close();
for (const { f, where } of agg.values()) console.log('   ' + f + '   [' + where.length + ': ' + where.slice(0, 3).join(', ') + ']');
errs.forEach(e => console.log('  ! ' + e.slice(0, 200)));
console.log(total ? 'ПРОВАЛ контраста: ' + total + ' на ' + pages + ' проходах, разных ' + agg.size
                  : 'КОНТРАСТ: все тексты проходят WCAG AA, проходов ' + pages);
process.exit(total || errs.length || !pages ? 1 : 0);
