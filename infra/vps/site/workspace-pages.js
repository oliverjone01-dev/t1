(function(){
 const byId=id=>document.getElementById(id);
 const sidebar=byId('gg-sidebar'),button=byId('gg-menu'),backdrop=byId('gg-backdrop');
 function close(){sidebar.classList.remove('gg-open');backdrop.hidden=true;button.setAttribute('aria-expanded','false');}
 button.onclick=()=>{const open=sidebar.classList.toggle('gg-open');backdrop.hidden=!open;button.setAttribute('aria-expanded',String(open));};backdrop.onclick=close;
 let value='light';try{value=localStorage.getItem('gg-hub-theme')||'light';}catch{}document.documentElement.dataset.theme=value;
 byId('gg-theme').onclick=()=>{const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=theme;try{localStorage.setItem('gg-hub-theme',theme);}catch{}};
 const trigger=byId('gg-company-button'),options=byId('gg-company-options');
 function closeCompanies(){options.hidden=true;trigger.setAttribute('aria-expanded','false');}
 trigger.onclick=()=>{options.hidden=!options.hidden;trigger.setAttribute('aria-expanded',String(!options.hidden));};
 options.querySelectorAll('[data-company]').forEach(a=>a.onclick=()=>{try{localStorage.setItem('gg-hub-brand',a.dataset.company);}catch{}});
 document.addEventListener('click',e=>{if(!e.target.closest('.gg-company'))closeCompanies();});document.addEventListener('keydown',e=>{if(e.key==='Escape'){close();closeCompanies();}});
 function metricRows(){document.querySelectorAll('#gg-dashboard .kpi-strip').forEach(strip=>{const cards=[...strip.children];if(cards.length<2)return;const top=Math.ceil(cards.length/2),bottom=cards.length-top;strip.style.setProperty('--gg-kpi-grid',top*bottom);cards.forEach((card,i)=>card.style.gridColumn='span '+(i<top?bottom:top));});}
 metricRows();const observer=new MutationObserver(metricRows);observer.observe(byId('gg-dashboard'),{childList:true,subtree:true});
})();
