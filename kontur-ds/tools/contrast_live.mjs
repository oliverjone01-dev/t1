// Живая проверка контраста в браузере (автомат вместо ручного whocanuse.com).
// Для каждого видимого текста берёт реальный цвет и реальный фон под ним
// (с учётом вложенных тем, полупрозрачных подложек и SVG-подписей графиков)
// и сверяет с WCAG: 4,5:1 обычный текст, 3:1 крупный (>=24px или >=18.66px жирный).
// Запуск: node tools/contrast_live.mjs templates/starter.html specimen.html
// Выход 1, если есть провалы.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright'); // берёт и локальный, и глобальный (NODE_PATH) пакет
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const files = process.argv.slice(2);
if (!files.length) { console.log('укажите html-файлы'); process.exit(2); }
const browser = await chromium.launch();
let total = 0;

for (const f of files) {
  for (const theme of ['light', 'dark']) {
    for (const width of [1280, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.goto(pathToFileURL(path.resolve(f)).href);
      await page.evaluate(t => { document.documentElement.setAttribute('data-theme', t); }, theme);
      await page.waitForTimeout(1600);
      const fails = await page.evaluate(() => {
        // 1.5.1: любой вычисленный цвет (oklch, color-mix, lab, color(...)) браузер переводит в sRGB на холсте 1x1.
        // Раньше разбиралось только rgb(), остальной текст молча пропускался. Неразобранный цвет теперь провал
        const cv = document.createElement('canvas'); cv.width = cv.height = 1;
        const cx = cv.getContext('2d', { willReadFrequently: true });
        const parse = s => {
          if (!s || s === 'none') return null;
          const m = s.match(/^rgba?\(([^()]+)\)$/);
          if (m) { const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; }
          cx.fillStyle = '#000'; cx.fillStyle = '#fff'; cx.fillStyle = s;
          if (cx.fillStyle === '#ffffff' && !/^(?:#fff|#ffffff|white)$/i.test(s.trim())) return 'bad';
          cx.clearRect(0, 0, 1, 1); cx.fillRect(0, 0, 1, 1);
          const d = cx.getImageData(0, 0, 1, 1).data; return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
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
            if (c === 'bad') return 'bad:' + cs.backgroundColor;
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
          if (fg === 'bad') { out.push(`${name(el)}  цвет текста не разобран: ${isSvg ? cs.fill : cs.color}  «${el.textContent.trim().slice(0, 40)}»`); continue; }
          if (!fg) continue;
          const bg = bgOf(isSvg ? (el.closest('div') || el) : el);
          if (bg === 'gradient') continue;
          if (typeof bg === 'string') { out.push(`${name(el)}  цвет фона не разобран: ${bg.slice(4)}  «${el.textContent.trim().slice(0, 40)}»`); continue; }
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
      });
      console.log(`${fails.length ? 'ПРОВАЛ' : 'ок'}  ${f}  тема=${theme}  ширина=${width}  провалов=${fails.length}`);
      fails.slice(0, 25).forEach(x => console.log('   ' + x));
      total += fails.length;
      await page.close();
    }
  }
}
await browser.close();
console.log(total ? `ИТОГО провалов контраста: ${total}` : 'КОНТРАСТ: все тексты проходят WCAG AA');
process.exit(total ? 1 : 0);
