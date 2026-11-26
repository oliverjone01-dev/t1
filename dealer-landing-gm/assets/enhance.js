/* GLASS-MEMORY - движение и UX-доработки. Прогрессивное улучшение: без этого файла
   страница работает как раньше. Ничего не отправляет и не сохраняет. */
(() => {
  'use strict';
  const d = document;
  d.documentElement.classList.add('m-js'); /* без скрипта кнопки паузы не показываем */
  const $ = (s, r = d) => r.querySelector(s);
  const $$ = (s, r = d) => [...r.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const header = $('.site-header'), home = $('#home'), contact = $('#contact'), cta = $('.m-cta');

  /* ---------- Мёртвые стрелки галереи: прячем, если листать нечего ---------- */
  for (const viewport of $$('[data-carousel]')) {
    const button = $(`[data-gallery-target="${viewport.id}"]`);
    const controls = button && button.closest('.gallery-controls');
    const sync = () => {
      const scrollable = viewport.scrollWidth > viewport.clientWidth + 2;
      if (controls) controls.hidden = !scrollable;
      viewport.classList.toggle('m-drag', scrollable && fine);
    };
    new ResizeObserver(sync).observe(viewport); sync();
    if (!fine) continue;
    /* Перетаскивание мышью */
    let startX = 0, startLeft = 0, down = false, moved = false;
    viewport.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse' || e.button !== 0 || !viewport.classList.contains('m-drag')) return;
      down = true; moved = false; startX = e.clientX; startLeft = viewport.scrollLeft;
    });
    addEventListener('pointermove', e => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (!moved && Math.abs(dx) < 6) return;
      moved = true; viewport.classList.add('is-dragging'); viewport.scrollLeft = startLeft - dx;
    });
    const end = () => { if (!down) return; down = false; setTimeout(() => viewport.classList.remove('is-dragging'), 0); };
    addEventListener('pointerup', end); addEventListener('pointercancel', end);
    viewport.addEventListener('click', e => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
    viewport.addEventListener('dragstart', e => e.preventDefault());
  }

  /* ---------- Каталог: при наведении рисунок сменяется фотокопией изделия ---------- */
  const PHOTO = { '3ad21.webp': '3ad21-photo.webp', '157d4.webp': '157d4-photo.webp', 'b096b.webp': 'b096b-photo.webp', '87b59.webp': '87b59-photo.webp', '791dc.webp': '791dc-photo.webp' };
  const catalog = $('#products');
  const addPhotos = () => {
    for (const img of $$('.product-card [data-name="Large graphic"] img:not(.m-icon)')) {
      const file = img.getAttribute('src').split('/').pop();
      if (!PHOTO[file]) continue;
      const photo = img.cloneNode(false);
      photo.removeAttribute('srcset'); photo.removeAttribute('loading'); photo.alt = ''; photo.setAttribute('aria-hidden', 'true');
      photo.src = img.getAttribute('src').replace(file, PHOTO[file]);
      photo.classList.add('m-photo'); img.classList.add('m-icon');
      img.after(photo);
    }
  };
  /* Фотокопии грузятся только после первого наведения на каталог */
  if (fine && catalog) catalog.addEventListener('pointerenter', addPhotos, { once: true });

  /* ---------- Видео: грузим только рядом с экраном, играем только в кадре ---------- */
  const conn = navigator.connection || {};
  /* Экономия трафика или 2G: только постер, ролик по кнопке.
     Оценку «3g» Chrome часто даёт на нормальной сети (VPN, высокий rtt), поэтому её не учитываем. */
  const lite = !!conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '');
  const phone = matchMedia('(max-width: 767px)').matches;
  for (const box of $$('[data-film]')) {
    const v = $('video', box), btn = $('.m-vbtn', box);
    const frame = box.matches('[data-film-frame]') ? box : $('[data-film-frame]', box);
    if (!v || !btn) continue;
    let wanted = !reduced && !lite, loaded = false, visible = false;
    const load = () => {
      if (loaded) return; loaded = true;
      v.src = phone && v.dataset.srcM ? v.dataset.srcM : v.dataset.src; v.preload = 'auto';
    };
    const sync = () => {
      box.classList.toggle('is-paused', !wanted);
      btn.setAttribute('aria-label', wanted ? 'Остановить видео' : 'Включить видео');
      if (wanted && visible) { load(); v.play().catch(() => {}); } else v.pause();
    };
    btn.addEventListener('click', () => { wanted = !wanted; sync(); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(es => { if (es.some(e => e.isIntersecting) && wanted) load(); }, { rootMargin: '900px 0px' }).observe(frame);
      new IntersectionObserver(es => { for (const e of es) visible = e.isIntersecting; sync(); }, { threshold: .15 }).observe(frame);
    }
    sync();
  }
  const reel = $('[data-reel]');
  if (reel && !reduced) { reel.style.setProperty('--m-t', '0'); reel.style.setProperty('--m-e', '1'); }

  /* ---------- Шапка, прогресс, активный раздел, мобильная кнопка ---------- */
  const navLinks = $$('.desktop-nav a[href^="#"]').map(a => ({ a, s: $(a.getAttribute('href')) })).filter(x => x.s);
  let fullH = header.offsetHeight, compact = false, lastY = scrollY, current = null;
  function setCompact(v) {
    if (v === compact) return;
    compact = v; header.style.marginBottom = '';
    header.classList.toggle('is-scrolled', v);
    if (v) { const delta = fullH - header.offsetHeight; if (delta > 0) header.style.marginBottom = delta + 'px'; }
  }
  function measureHeader() {
    const was = compact; if (was) { header.classList.remove('is-scrolled'); header.style.marginBottom = ''; }
    fullH = header.offsetHeight; compact = false; if (was) setCompact(true);
  }
  function chrome(y, vh) {
    setCompact(y > fullH + 20);
    if (y < fullH + 200 || y < lastY - 4) header.classList.remove('is-hidden');
    else if (y > lastY + 4 && !d.body.classList.contains('dialog-open')) header.classList.add('is-hidden');
    lastY = y;
    const max = d.documentElement.scrollHeight - vh;
    header.style.setProperty('--m-progress', max > 0 ? clamp(y / max, 0, 1).toFixed(4) : '0');
    let now = null;
    for (const x of navLinks) if (x.s.getBoundingClientRect().top <= vh * .4) now = x;
    if (now !== current) {
      if (current) current.a.removeAttribute('aria-current');
      if (now) now.a.setAttribute('aria-current', 'true');
      current = now;
    }
    if (cta) {
      const el = d.activeElement;
      /* Не закрываем поле ввода и элемент в фокусе клавиатуры */
      const typing = el && el !== cta && (el.matches('input, textarea') || el.matches(':focus-visible'));
      cta.classList.toggle('is-on', y > home.offsetHeight * .8 && contact.getBoundingClientRect().top > vh * .85 && !typing);
    }
  }

  /* ---------- Параллакс и заполнение текста ---------- */
  const active = new Set();
  const parallax = new Map();
  let fill = null, fillWords = [];
  function motion(y, vh) {
    if (home.getBoundingClientRect().bottom > 0) home.style.setProperty('--m-sy', y.toFixed(1));
    if (reel) {
      const r = reel.getBoundingClientRect();
      if (r.bottom > 0 && r.top < vh) {
        const u = (vh - r.top) / r.height; /* 0 - блок входит снизу, 1 - уходит */
        const open = 1 - Math.pow(1 - clamp((u - .12) / .42, 0, 1), 3);
        reel.style.setProperty('--m-e', (1 - open).toFixed(4));
        reel.style.setProperty('--m-t', clamp((u - .5) / .18, 0, 1).toFixed(3));
      }
    }
    for (const el of active) {
      const r = el.getBoundingClientRect();
      const p = clamp((r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2), -1, 1);
      el.style.setProperty('--m-p', (p * parallax.get(el)).toFixed(2));
    }
    if (fill) {
      const r = fill.getBoundingClientRect();
      if (r.top < vh && r.bottom > 0) {
        const n = Math.round(clamp((vh * .88 - r.top) / (vh * .45 + r.height), 0, 1) * fillWords.length);
        fillWords.forEach((w, i) => w.classList.toggle('on', i < n));
      }
    }
  }
  let ticking = false;
  function frame() { ticking = false; const y = scrollY, vh = innerHeight; chrome(y, vh); if (!reduced) motion(y, vh); }
  function request() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
  addEventListener('scroll', request, { passive: true });
  addEventListener('resize', () => { measureHeader(); request(); });
  d.addEventListener('focusin', request); d.addEventListener('focusout', request);
  frame();
  if (reduced || !('IntersectionObserver' in window)) return;

  /* ---------- Разбиение текста на слова ---------- */
  function words(el, outer, inner) {
    const walker = d.createTreeWalker(el, NodeFilter.SHOW_TEXT), nodes = [], made = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      if (!node.nodeValue.trim()) continue;
      const f = d.createDocumentFragment();
      for (const part of node.nodeValue.split(/([ \n\t]+)/)) {
        if (!part) continue;
        if (/^[ \n\t]+$/.test(part)) { f.append(' '); continue; }
        const w = d.createElement('span'); w.className = outer;
        if (inner) { const wi = d.createElement('span'); wi.className = inner; wi.textContent = part; wi.style.setProperty('--m-i', made.length); w.append(wi); made.push(wi); }
        else { w.textContent = part; made.push(w); }
        f.append(w);
      }
      if (node.parentElement === el && inner) { const line = d.createElement('span'); line.className = 'm-l'; line.append(f); node.replaceWith(line); }
      else node.replaceWith(f);
    }
    return made;
  }

  /* ---------- Появление по прокрутке ---------- */
  const vh0 = innerHeight;
  const io = new IntersectionObserver(entries => {
    let i = 0;
    for (const e of entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left)) {
      const el = e.target; io.unobserve(el);
      if (!el.classList.contains('m-split')) el.style.setProperty('--m-i', i++);
      el.classList.remove('m-wait'); el.classList.add('m-in');
    }
  }, { rootMargin: '0px 0px -7% 0px', threshold: .01 });
  function arm(selector, kind) {
    for (const el of $$(selector)) {
      if (el.classList.contains('m-up') || el.classList.contains('m-reveal') || el.classList.contains('m-split')) continue;
      if (el.closest('.m-up, .m-reveal')) continue;
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) continue;
      if (kind === 'm-split') words(el, 'm-w', 'm-wi');
      el.classList.add(kind);
      if (r.top < vh0 && r.left < innerWidth) continue; /* уже на экране или выше - не прячем */
      el.classList.add('m-wait'); io.observe(el);
    }
  }
  arm('main h2', 'm-split');
  arm('main .photo-open, [data-name="MEDIA / installers-corrected"]', 'm-reveal');
  arm([
    'main > section > p', '[data-name="Product benefits"] > div', '.catalog-grid > .product-card', '.promo',
    '[data-gallery-card]', '[data-name="Flowerbed / details"] > *', '[data-name="Fence / details"] > *',
    '[data-name="Consumer value"] > *', '[data-name="Mounting options"] > div', '[data-name^="Photo /"] > p',
    '[data-name="Exploded layers"]', '[data-name="Strength text"] > p', '.material-note',
    '[data-name="Order sequence"] > div', '[data-name="Questions"] > div', '[data-name="Installation / visual"] > p',
    '[data-name="Contact headline"] > p', '[data-native-form]', '[data-name="Gallery controls"]', '#ready > a', '#ready > .gallery-controls'
  ].join(','), 'm-up');
  /* Пропущенное при прыжке по якорю показываем сразу, когда оно осталось выше экрана */
  let swept = 0;
  addEventListener('scroll', () => {
    const now = performance.now(); if (now - swept < 250) return; swept = now;
    for (const el of $$('.m-wait')) if (el.getBoundingClientRect().bottom < 0) { io.unobserve(el); el.classList.remove('m-wait'); el.classList.add('m-in'); }
  }, { passive: true });
  /* Фокус с клавиатуры не должен попадать в невидимый блок */
  d.addEventListener('focusin', e => { for (let el = e.target.closest('.m-wait'); el; el = el.parentElement.closest('.m-wait')) { io.unobserve(el); el.classList.remove('m-wait'); el.classList.add('m-in'); } });

  /* ---------- Параллакс: фото, силуэт в блоке заявки ---------- */
  const near = new IntersectionObserver(entries => { for (const e of entries) { e.isIntersecting ? active.add(e.target) : active.delete(e.target); } request(); }, { rootMargin: '10% 0px 10% 0px' });
  for (const el of $$('main .photo-open')) { el.classList.add('m-par'); parallax.set(el, 3); near.observe(el); }
  const silhouette = $('#contact [data-name^="Background"]');
  if (silhouette) { silhouette.classList.add('m-drift'); parallax.set(silhouette, -60); near.observe(silhouette); }

  /* ---------- Текст о триплексе проявляется по мере чтения ---------- */
  fill = $('[data-node-id="94:340"]');
  if (fill) fillWords = words(fill, 'm-f');
  request();

  if (!fine) return;
  /* ---------- Глубина первого экрана и повтор блика ---------- */
  let px = 0, py = 0, tx = 0, ty = 0, raf = 0;
  const settle = () => {
    px += (tx - px) * .08; py += (ty - py) * .08;
    home.style.setProperty('--m-px', px.toFixed(2)); home.style.setProperty('--m-py', py.toFixed(2));
    raf = Math.abs(tx - px) + Math.abs(ty - py) > .05 ? requestAnimationFrame(settle) : 0;
  };
  home.addEventListener('pointermove', e => {
    const r = home.getBoundingClientRect();
    tx = ((e.clientX - r.left) / r.width - .5) * -16; ty = ((e.clientY - r.top) / r.height - .5) * -8;
    if (!raf) raf = requestAnimationFrame(settle);
  });
  home.addEventListener('pointerleave', () => { tx = ty = 0; if (!raf) raf = requestAnimationFrame(settle); });
  const stele = $('#home .n8');
  let glareAt = performance.now();
  home.addEventListener('pointerenter', () => {
    if (!stele || performance.now() - glareAt < 6000) return;
    glareAt = performance.now(); home.classList.remove('is-glare'); void home.offsetWidth; home.classList.add('is-glare');
  });

  /* ---------- Наклон слоёв триплекса за курсором ---------- */
  const layers = $('[data-name="Exploded layers"]');
  if (layers) {
    layers.classList.add('m-tilt');
    layers.addEventListener('pointermove', e => {
      const r = layers.getBoundingClientRect();
      layers.style.setProperty('--m-ry', (((e.clientX - r.left) / r.width - .5) * 14).toFixed(2) + 'deg');
      layers.style.setProperty('--m-rx', (((e.clientY - r.top) / r.height - .5) * -9).toFixed(2) + 'deg');
    });
    layers.addEventListener('pointerleave', () => { layers.style.removeProperty('--m-ry'); layers.style.removeProperty('--m-rx'); });
  }
})();
