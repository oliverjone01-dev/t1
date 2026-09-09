# -*- coding: utf-8 -*-
BODY = r'''
<div class="min-h-screen flex">
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
const wide = () => window.matchMedia('(min-width:1024px)').matches;
function sbTog(){
  const s=document.getElementById('sb');
  if(!wide()){ // на узком экране меню выезжает поверх
    const open = s.classList.toggle('-translate-x-full');
    document.getElementById('bd').classList.toggle('hidden', open);
    return;
  }
  const n = s.classList.toggle('w-[72px]');
  s.classList.toggle('w-[258px]', !n);
  document.querySelectorAll('.lbl').forEach(e=>e.classList.toggle('hidden', n));
}
function sbClose(){
  document.getElementById('sb').classList.add('-translate-x-full');
  document.getElementById('bd').classList.add('hidden');
}
function setP(p){ CUR=p; render(); }
function setPer(v){ PERIOD=v; try{ localStorage.setItem('kontur-period', v); }catch(e){} render(); }
function th(){
  const dk=document.documentElement.classList.toggle('dark');
  try{ localStorage.setItem('kontur-theme', dk?'dark':'light'); }catch(e){}
  thIcon(); render();
}
function thIcon(){
  const dk=document.documentElement.classList.contains('dark');
  document.getElementById('thi').innerHTML = dk
   ? '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/></svg>'
   : '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/></svg>';
}
function render(){
  if(!wide()) sbClose();
  const s=screens(), fn=s[VIEW]||s.obzor;
  const v=document.getElementById('view');
  const mth = method(VIEW), rd = reading(VIEW);
  const tail = (rd||mth) ? '<div class="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">'+(rd||'')+(mth||'')+'</div>' : '';
  v.innerHTML='<div class="fade">'+fn()+tail+'</div>';

  document.querySelectorAll('[data-v]').forEach(b=>{
    b.classList.toggle('navon', b.dataset.v===VIEW);
  });
  openFor(VIEW);
  refreshBadges();

  ['gm','gg'].forEach(p=>{
    const b=document.getElementById('p'+p), on=(p===CUR);
    b.classList.toggle('pane', on);
    b.classList.toggle('hd', on);
    b.classList.toggle('shadow-sm', on);
    b.classList.toggle('opacity-55', !on);
  });
  const ss = SER();
  document.getElementById('stamp').textContent =
    V().name + ' · ' + V().dom + (ss.length ? ' · последний съём ' + ruD(ss[ss.length-1].date) + ' · точек ' + ss.length : ' · ряда нет');
  const sel = document.getElementById('per'); if(sel) sel.value = PERIOD;
  const ft = document.getElementById('foot');
  if(ft) ft.textContent = 'Сборка данных ' + (DB.built||'').slice(0,10).split('-').reverse().join('.')
    + '. Метрика: ' + (V().ym ? 'подключена' : 'нет') + '. Директ: ' + (V().direct ? 'выгрузка есть' : 'нет') + '.';
  requestAnimationFrame(()=>{ draw(); if(document.getElementById('calcout')) recalc(); });
}
try{ if(localStorage.getItem('kontur-theme')==='dark') document.documentElement.classList.add('dark');
     const sp = localStorage.getItem('kontur-period'); if(sp && PERIODS[sp]) PERIOD = sp; }catch(e){}
thIcon(); buildNav(); render();
let _rt; window.addEventListener('resize',()=>{ clearTimeout(_rt); _rt=setTimeout(draw,250); });
</script>
'''
