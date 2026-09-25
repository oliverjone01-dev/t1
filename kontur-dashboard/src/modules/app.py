# -*- coding: utf-8 -*-
# Оболочка приложения по kontur-ds/templates/starter.html. Входит в основной скрипт
# страницы вместе с данными и китом, поэтому при публикации шифруется целиком
# (tools/seal_page.mjs). Сама ничего не запускает: старт идёт из appStart(), которую
# вызывает окно пароля после расшифровки.
APP = r'''
const $id = x => document.getElementById(x);
function setP(p){ if(DB.projects[p]){ CUR = p; render(); } }
function setPer(v){ if(PERIODS[v]){ PERIOD = v; $id('per').value = v; render(); } }

function render(){
  const s = screens(), fn = s[VIEW] || s.obzor;
  if(!s[VIEW]) VIEW = 'obzor';
  const mth = method(VIEW), rd = reading(VIEW);
  const tail = (rd || mth) ? '<div class="ks-grid-2 scr-tail">' + (rd || '') + (mth || '') + '</div>' : '';
  $id('view').innerHTML = '<div class="ks-fade"><div class="ks-stack scr">' + fn() + tail + '</div></div>';
  KS.charts.prune();   /* графики прежнего экрана: их контейнеры только что исчезли */
  $id('nav').innerHTML = KS.nav(NAV, VIEW);
  $id('seg').querySelectorAll('[data-p]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.p === CUR)));
  const own = ownSnaps(), pend = pendingSnap();
  $id('stamp').textContent = V().name + ' · ' + V().dom
    + (own.length ? ' · свой съём ' + ruD(own[own.length-1]) : ' · своих съёмов нет')
    + (pend ? ' · срез ' + ruD(pend) + ' не записан' : '');
  $id('per').value = PERIOD;
  $id('foot').textContent = 'Сборка данных ' + (DB.built || '').slice(0,10).split('-').reverse().join('.')
    + '. Метрика: ' + (V().ym ? 'подключена' : 'нет') + '. Директ: ' + (V().direct ? 'выгрузка есть' : 'нет') + '.';
  $id('theme').innerHTML = KS.theme.icon();
  KS.route.set({ project:CUR, view:VIEW, period:PERIOD });
  KS.ticker.run($id('view'));
  scheduleDraw();
}
/* Несколько отрисовок в одном кадре дают одну перерисовку графиков: иначе второй вызов
   уничтожает график посреди анимации первого, и SVG получает размеры NaN. */
let _raf = 0;
function scheduleDraw(){ cancelAnimationFrame(_raf); _raf = requestAnimationFrame(() => { draw(); if($id('calcout')) recalc(); }); }

/* Палитра команд (Cmd+K, Ctrl+K): все экраны, проекты, периоды и действия. */
function commands(){
  const items = [];
  NAV.forEach(g => (g.ch ? g.ch.map(c => [g.t, c]) : [[null, g]]).forEach(([grp, c]) =>
    items.push({ group:'Экраны', label:c.t, hint:grp || '', icon:g.i, keywords:grp || '',
                 run:() => KS.vt(() => { go(c.id); window.scrollTo(0, 0); }) })));
  Object.entries(DB.projects).forEach(([k, p]) =>
    items.push({ group:'Проект', label:p.name, hint:p.dom, icon:'layers', run:() => setP(k) }));
  Object.keys(PERIODS).forEach(k =>
    items.push({ group:'Период', label:PERIOD_LABEL[k], icon:'calendar', run:() => setPer(k) }));
  items.push(
    { group:'Действия', label:'Сменить тему', icon:'moon', keywords:'тёмная светлая', run:() => KS.theme.toggle() },
    { group:'Действия', label:'Переключить плотность', hint:'просторно или компактно', icon:'rows', keywords:'компактно просторно', run:() => KS.density.toggle() },
    { group:'Действия', label:'Скопировать ссылку на экран', icon:'link', run:() => {
        const bad = () => KS.toast('Не удалось скопировать: выдели адрес вручную', 'warn');
        try{ navigator.clipboard.writeText(location.href).then(() => KS.toast('Ссылка на экран скопирована'), bad); }catch(e){ bad(); } } });
  return items;
}

function appStart(){
  const g = $id('gate'); if(g) g.remove();
  $id('app').hidden = false;
  /* прежние ключи хранения: выбор темы и периода не теряется при переходе на кит */
  try{ const t = localStorage.getItem('kontur-theme');
       if(t && !localStorage.getItem('ks-theme')) localStorage.setItem('ks-theme', t);
       const sp = localStorage.getItem('kontur-period'); if(sp && PERIODS[sp]) PERIOD = sp; }catch(e){}

  $id('seg').innerHTML = Object.entries(DB.projects).map(([k, p]) =>
    '<button type="button" data-p="' + k + '" aria-pressed="false">' + esc(p.name) + '</button>').join('');
  KS.seg.wire($id('seg'));
  $id('cmdkb').outerHTML = KS.cmdk.button('Поиск');
  KS.cmdk.set(commands());

  KS.charts.onTheme = () => render();
  KS.navWire($id('nav'), v => KS.vt(() => { VIEW = v; render(); window.scrollTo(0, 0); }));
  $id('seg').addEventListener('click', e => { const b = e.target.closest('[data-p]'); if(b) setP(b.dataset.p); });
  $id('per').addEventListener('change', e => {
    PERIOD = e.target.value; try{ localStorage.setItem('kontur-period', PERIOD); }catch(x){} render(); });
  $id('theme').addEventListener('click', () => KS.theme.toggle());
  KS.shell.init({ sidebar:'#sb', backdrop:'#bd', menu:'#menu' });

  /* Старт: сначала адрес, потом тема. Смена темы перерисовывает экран и переписывает
     адрес, поэтому присланную ссылку надо прочитать до неё. */
  const r = KS.route.parse();
  KS.theme.init();
  if(r.project && DB.projects[r.project]) CUR = r.project;
  if(r.view && screens()[r.view]) VIEW = r.view;
  if(r.period && PERIODS[r.period]) PERIOD = r.period;
  render();

  const densUi = () => { const b = $id('dens'); b.innerHTML = KS.density.icon();
    b.setAttribute('data-tip', 'Плотность: ' + KS.density.label().toLowerCase()); };
  $id('dens').addEventListener('click', () => KS.density.toggle());
  document.addEventListener('ks:density', () => { densUi(); KS.toast('Плотность: ' + KS.density.label().toLowerCase()); });
  densUi();
}
'''
