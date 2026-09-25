/* Живой контраст на всех экранах: каждый видимый текст, его реальный цвет и
   реальный фон под ним сверяются с WCAG AA (4,5:1, крупный текст 3:1).
   Функция замера взята из kontur-ds/tools/contrast_live.mjs (Контур DS 1.5) и дополнена
   учётом прозрачности (opacity) элемента и его предков.
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
  .replace(/<script src="https:\/\/cdnjs[^"]+"[^>]*><\/script>/, '<script src="file://' + LIBS + '/apex.js"></script>')
  .replace(/<link rel="stylesheet" href="https:\/\/fonts[^"]+">/, ''));

const CHECK = () => {
        // Разбор вычисленного цвета: rgb(), color(srgb ...), oklab(), oklch(). Функция пакета
        // понимала только rgb и молча пропускала остальное: color-mix на тексте не мерился.
        const num = (x, pct) => x.endsWith('%') ? parseFloat(x) / 100 * pct : parseFloat(x);
        const enc = c => { c = Math.max(0, Math.min(1, c)); return 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055); };
        const fromOklab = (L, A, B) => { const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3, m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3,
          s = (L - 0.0894841775 * A - 1.2914855480 * B) ** 3;
          return { r: enc(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), g: enc(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
                   b: enc(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s) }; };
        const parse = s => {
          const f = s.match(/^(rgba?|color|oklab|oklch)\((.*)\)$/); if (!f) return null;
          const [main, al] = f[2].split('/'); const p = main.trim().split(/[ ,]+/).filter(Boolean);
          const a = al ? num(al.trim(), 1) : (f[1] === 'rgba' && p[3] != null ? parseFloat(p[3]) : 1);
          if (f[1].startsWith('rgb')) return { r: num(p[0], 255), g: num(p[1], 255), b: num(p[2], 255), a };
          if (f[1] === 'color') { if (p[0] !== 'srgb') return null; return { r: num(p[1], 1) * 255, g: num(p[2], 1) * 255, b: num(p[3], 1) * 255, a }; }
          if (f[1] === 'oklab') return { ...fromOklab(num(p[0], 1), num(p[1], 0.4), num(p[2], 0.4)), a };
          const L = num(p[0], 1), C = num(p[1], 0.4), h = (parseFloat(p[2]) || 0) * Math.PI / 180;
          return { ...fromOklab(L, C * Math.cos(h), C * Math.sin(h)), a };
        };
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
          // -webkit-text-fill-color рисует глифы поверх color: мерить надо то, что видно
          const tf = cs.webkitTextFillColor, fillVis = tf && tf !== cs.color && !/currentcolor/i.test(tf) ? tf : cs.color;
          let fg = parse(isSvg ? (el.getAttribute('fill') && el.getAttribute('fill').startsWith('rgb') ? el.getAttribute('fill') : cs.fill) : fillVis);
          if (isSvg && (!fg || cs.fill === 'none')) { const h = el.getAttribute('fill'); if (h && /^#[0-9a-f]{6}$/i.test(h)) fg = { r: parseInt(h.slice(1,3),16), g: parseInt(h.slice(3,5),16), b: parseInt(h.slice(5,7),16), a: 1 }; }
          if (!fg) { out.push(`${name(el)}  цвет текста не разобран: ${cs.color}  «${el.textContent.trim().slice(0, 40)}»`); continue; }
          const bg = bgOf(isSvg ? (el.closest('div') || el) : el);
          if (bg === 'gradient') continue;
          // Прозрачность самого элемента и всех предков гасит текст так же, как альфа цвета:
          // функция пакета её не видела, и opacity .3 на тексте проходила все экраны.
          for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const ns = getComputedStyle(n); let o = parseFloat(ns.opacity);
            const fo = (ns.filter || '').match(/opacity\(([\d.]+)(%?)\)/); if (fo) o *= fo[2] ? parseFloat(fo[1]) / 100 : parseFloat(fo[1]);
            if (o < 1) fg = { ...fg, a: fg.a * o }; }
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
  // «меньше движения»: кит и графики рисуются сразу в конечном виде. Иначе замер
  // попадает в середину появления, и прозрачность анимации считается провалом.
  const page = await browser.newPage({ viewport:{ width, height:900 }, reducedMotion:'reduce' });
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
