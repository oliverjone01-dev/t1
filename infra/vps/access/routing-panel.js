(function(){
 async function init(){
  const response=await fetch('/_access/api/session',{credentials:'same-origin',cache:'no-store'});
  if(!response.ok)return;const session=await response.json();if(!session.isRoutingOwner)return;
  const host=document.querySelector('.gg-content,.content,main');if(!host||document.getElementById('gg-routing-panel'))return;
  const style=document.createElement('style');style.textContent='#gg-routing-panel{box-sizing:border-box;padding:22px;margin:22px 0;border:1px solid var(--border,#34404b);border-radius:12px;background:var(--bg-card,#171b20);color:var(--ink,#edf2f7);font:13px/1.6 system-ui,sans-serif}#gg-routing-panel h2{font:600 19px system-ui;margin:0 0 8px}#gg-routing-panel p{margin:9px 0;color:var(--ink-3,#aebbc8)}#gg-routing-panel button{font:inherit;border:1px solid var(--border,#41505d);border-radius:7px;padding:9px 16px;background:transparent;color:inherit;cursor:pointer;margin:0 7px 8px 0}#gg-routing-panel button[aria-pressed=true]{color:var(--accent,#37e6ac);border-color:currentColor;background:var(--accent-soft,#163e32)}#gg-routing-panel a{color:var(--accent,#37e6ac);overflow-wrap:anywhere}#gg-routing-panel button:disabled{opacity:.6;cursor:wait}#gg-routing-panel [role=status]{min-height:21px}';
  document.head.append(style);
  const box=document.createElement('section');box.id='gg-routing-panel';box.innerHTML='<h2>Адрес дашбордов и отчётов</h2><p>Управляет только yanchoglov. Логины, пароли и права доступа сохраняются.</p><div role="group" aria-label="Рабочий адрес"><button type="button" data-route-mode="domain">Домен</button><button type="button" data-route-mode="ip">IP · аварийный</button></div><p>Рабочий адрес: <a data-route-home></a></p><p data-route-status role="status" aria-live="polite"></p><p>Ссылки в следующих отчётах используют выбранный адрес. Источник данных — VPS.</p><p>При выборе домена необходим работающий DNS. Вернуть IP можно через защищённый <a data-route-recovery>аварийный вход в настройки</a>.</p>';host.append(box);
  const status=box.querySelector('[data-route-status]');
  function paint(data){box.querySelectorAll('[data-route-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.routeMode===data.mode)));const link=box.querySelector('[data-route-home]');link.href=data.baseUrl+'/';link.textContent=data.baseUrl+'/';box.querySelector('[data-route-recovery]').href=data.recoveryUrl;}
  const current=await fetch('/_access/api/routing',{credentials:'same-origin',cache:'no-store'});if(!current.ok)throw Error('Не удалось прочитать режим.');paint(await current.json());
  box.querySelectorAll('[data-route-mode]').forEach(button=>button.onclick=async()=>{
   if(button.getAttribute('aria-pressed')==='true')return;
   const buttons=box.querySelectorAll('button');buttons.forEach(b=>b.disabled=true);status.textContent='Сохраняю режим…';
   try{const r=await fetch('/_access/api/routing',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-GG-CSRF':session.csrf},body:JSON.stringify({mode:button.dataset.routeMode})});const data=await r.json();if(!r.ok)throw Error(data.error||'Не удалось изменить режим.');paint(data);status.textContent='Режим сохранён. Откройте рабочий адрес по ссылке выше. Ранее отправленные сообщения не изменяются.';}catch(e){status.textContent=e.message;}finally{buttons.forEach(b=>b.disabled=false);}
  });
 }
 init().catch(e=>{const node=document.getElementById('gg-routing-panel');if(node)node.querySelector('[data-route-status]').textContent=e.message;});
})();
