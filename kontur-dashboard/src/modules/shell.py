# -*- coding: utf-8 -*-
# Разметка каркаса по kontur-ds/templates/starter.html и окно пароля.
BODY = r'''
<div class="gate" id="gate">
  <div class="gate-box ks-card">
    <div class="ks-card-title">Контур: SEO, GEO, Директ</div>
    <p>Внутренняя панель GENGROUP. Вход по паролю.</p>
    <p>Открытую страницу можно сохранить и переслать вместе со всеми цифрами. Не пересылайте ни пароль, ни сохранённую копию.</p>
    <form id="gateForm" class="gate-form">
      <input class="ks-input" type="password" id="gatePass" placeholder="Пароль" aria-label="Пароль" autocomplete="current-password" autofocus>
      <span class="gate-err" id="gateErr" role="alert">Неверный пароль</span>
      <button class="ks-btn ks-btn--primary" type="submit">Войти</button>
    </form>
  </div>
</div>

<div class="ks-app" id="app" hidden>
  <div id="bd" class="ks-backdrop" hidden></div>
  <aside id="sb" class="ks-sidebar" aria-label="Разделы">
    <div class="ks-brand">
      <div class="ks-brand-mark"><svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 15l4-5 3 3 4-6 3 4"/></svg></div>
      <div class="ks-lbl"><div class="ks-brand-name">Контур</div><div class="ks-brand-sub">SEO · GEO · Директ</div></div>
    </div>
    <nav id="nav" class="ks-nav"></nav>
    <div class="ks-sidebar-foot ks-lbl" id="foot"></div>
  </aside>

  <div class="ks-main">
    <header class="ks-topbar">
      <button type="button" class="ks-btn ks-btn--ghost ks-btn--icon" id="menu" aria-label="Меню"></button>
      <div class="ks-topbar-tools">
        <div class="ks-seg" role="group" aria-label="Проект" id="seg"></div>
        <select class="ks-select" id="per" aria-label="Период сравнения, действует на все экраны сразу">
          <option value="7d">7 дней</option><option value="30d" selected>30 дней</option>
          <option value="90d">90 дней</option><option value="all">весь ряд</option>
        </select>
      </div>
      <div class="ks-topbar-spacer"></div>
      <div class="ks-stamp ks-hide-md" id="stamp"></div>
      <span id="cmdkb"></span>
      <button type="button" class="ks-btn ks-btn--ghost ks-btn--icon" id="dens" aria-label="Плотность интерфейса"></button>
      <button type="button" class="ks-btn ks-btn--ghost ks-btn--icon" id="theme" aria-label="Сменить тему"></button>
    </header>
    <main class="ks-view" id="view"></main>
  </div>
</div>
'''

GATE = r'''<script>
/* Окно пароля. Единственный код страницы, который читается без пароля.
   В опубликованной странице всё приложение вместе с данными и китом лежит в блоке
   app-sealed шифротекстом: PBKDF2-SHA256 на 600 000 итераций, AES-256-GCM,
   та же схема, что у академии. Неверный пароль не проходит проверку GCM,
   хэша пароля в странице нет, подбирать его офлайн можно только через
   медленный PBKDF2. В локальной сборке блока нет, и приложение стартует сразу.
   Тема и плотность ставятся до пароля: окно не мигает светлым у тёмной темы. */
(function(){
  try{ const t = localStorage.getItem('ks-theme') || localStorage.getItem('kontur-theme');
       if(t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
       if(localStorage.getItem('ks-density') === 'compact') document.documentElement.setAttribute('data-density', 'compact'); }catch(x){}
  const box = document.getElementById('app-sealed');
  if(!box){ appStart(); return; }
  const S = JSON.parse(box.textContent);
  const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const toB64 = b => btoa(String.fromCharCode(...new Uint8Array(b)));
  async function derive(pass){
    const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({name:'PBKDF2', salt:b64(S.salt), iterations:S.iter, hash:'SHA-256'},
      km, {name:'AES-GCM', length:256}, true, ['decrypt']);
  }
  async function open(key){
    const pt = await crypto.subtle.decrypt({name:'AES-GCM', iv:b64(S.iv)}, key, b64(S.ct));
    const el = document.createElement('script');
    el.textContent = new TextDecoder().decode(pt);
    document.head.appendChild(el);
    appStart();
  }
  const form = document.getElementById('gateForm'), err = document.getElementById('gateErr'),
        btn = form.querySelector('button');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.style.display = 'none'; btn.disabled = true; btn.textContent = 'Проверяю...';
    try{
      const key = await derive(document.getElementById('gatePass').value);
      await open(key);
      try{ sessionStorage.setItem('kontur.key', toB64(await crypto.subtle.exportKey('raw', key))); }catch(x){}
    }catch(x){
      err.style.display = 'block'; btn.disabled = false; btn.textContent = 'Войти';
    }
  });
  let saved = null; try{ saved = sessionStorage.getItem('kontur.key'); }catch(x){}
  if(saved){
    crypto.subtle.importKey('raw', b64(saved), {name:'AES-GCM'}, false, ['decrypt'])
      .then(open).catch(() => { try{ sessionStorage.removeItem('kontur.key'); }catch(x){} });
  }
})();
</script>
'''
