# -*- coding: utf-8 -*-
BODY = r'''
<div class="gate" id="gate">
  <div class="box">
    <div class="glogo hd">Контур: SEO, GEO, Директ</div>
    <p>Внутренняя панель GENGROUP. Все цифры на этой странице зашифрованы паролем: без него в её коде нет ни одного числа. После входа страницу можно сохранить или переслать, поэтому пароль не передают дальше.</p>
    <form id="gateForm">
      <input type="password" id="gatePass" placeholder="Пароль" autocomplete="current-password" autofocus>
      <span class="gerr" id="gateErr">Неверный пароль</span>
      <button class="gbtn" type="submit">Войти</button>
    </form>
  </div>
</div>

<div class="min-h-screen flex" id="app" hidden>
  <div id="bd" onclick="sbClose()" class="fixed inset-0 z-30 bg-black/40 hidden lg:hidden"></div>
  <aside id="sb" class="w-[258px] shrink-0 border-r bdr pane flex flex-col fixed lg:sticky top-0 z-40 h-screen -translate-x-full lg:translate-x-0">
    <div class="h-[58px] flex items-center gap-2.5 px-4 border-b bdr shrink-0">
      <div class="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0" style="background:linear-gradient(135deg,#5D87FF,#8A5FE9)">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 17l5-6 4 4 5-8 4 5"/></svg></div>
      <div class="lbl leading-tight"><div class="font-bold text-[14px] hd">Контур</div>
        <div class="text-[10.5px] opacity-60">SEO · GEO · Директ</div></div>
    </div>
    <nav id="nav" class="flex-1 overflow-y-auto p-2.5 space-y-[3px]"></nav>
    <div class="lbl p-3 border-t bdr text-[10.5px] opacity-55 leading-snug shrink-0">
      <span id="foot"></span>
    </div>
  </aside>

  <div class="flex-1 min-w-0 w-full">
    <header id="topbar" class="topbar h-[58px] sticky top-0 z-20 backdrop-blur border-b flex items-center gap-2 px-3 sm:px-4 min-w-0 overflow-hidden">
      <button onclick="sbTog()" class="w-8 h-8 rounded-lg hovr flex items-center justify-center transition shrink-0" title="Свернуть меню">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button>

      <div class="flex items-center gap-1 p-[3px] rounded-lg soft shrink-0 overflow-hidden">
        <button id="pgm" onclick="setP('gm')" class="px-2.5 py-1 rounded-md text-[12.5px] font-medium transition whitespace-nowrap"><span class="hidden sm:inline">GLASS-MEMORY</span><span class="sm:hidden">ГМ</span></button>
        <button id="pgg" onclick="setP('gg')" class="px-2.5 py-1 rounded-md text-[12.5px] font-medium transition whitespace-nowrap"><span class="hidden sm:inline">GENGLASS</span><span class="sm:hidden">ГГ</span></button>
      </div>

      <select id="per" onchange="setPer(this.value)" title="Период сравнения. Действует на все экраны сразу" class="text-[12px] px-2 py-1.5 rounded-lg soft border-0 outline-none cursor-pointer shrink-0">
        <option value="7d">7 дней</option><option value="30d" selected>30 дней</option><option value="90d">90 дней</option><option value="all">весь ряд</option>
      </select>

      <div class="flex-1"></div>
      <div id="stamp" class="text-[11px] opacity-55 hidden sm:block shrink-0"></div>
      <button onclick="th()" class="w-8 h-8 rounded-lg hovr flex items-center justify-center transition shrink-0" title="Тема">
        <span id="thi"></span></button>
    </header>

    <main id="main" class="p-4 sm:p-6 overflow-x-hidden"><div id="view"></div></main>
  </div>
</div>

<script>
/* Окно пароля. Единственный код страницы, который читается без пароля.
   В опубликованной странице всё приложение вместе с данными лежит в блоке
   app-sealed шифротекстом: PBKDF2-SHA256 на 600 000 итераций, AES-256-GCM,
   та же схема, что у академии. Неверный пароль не проходит проверку GCM,
   хэша пароля в странице нет, подбирать его офлайн можно только через
   медленный PBKDF2. В локальной сборке блока нет, и приложение стартует сразу. */
(function(){
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
