# -*- coding: utf-8 -*-
# Оболочка приложения. Входит в основной скрипт страницы вместе с данными, поэтому
# при публикации шифруется целиком (tools/seal_page.mjs). Сам ничего не запускает:
# старт идёт из appStart(), которую вызывает окно пароля после расшифровки.
APP = r'''
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
  killCharts();
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
function appStart(){
  try{ if(localStorage.getItem('kontur-theme')==='dark') document.documentElement.classList.add('dark');
       const sp = localStorage.getItem('kontur-period'); if(sp && PERIODS[sp]) PERIOD = sp; }catch(e){}
  buildNav();
  const g = document.getElementById('gate'); if(g) g.remove();
  document.getElementById('app').hidden = false;
  thIcon(); render();
  let _rt; window.addEventListener('resize',()=>{ clearTimeout(_rt); _rt=setTimeout(draw,250); });
}
'''
