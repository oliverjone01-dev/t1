// TURBIUM palette adaptation of the existing SVG/HTML chart primitives.
(function(){
 const root=document.getElementById('root');if(!root)return;
 const roles={
  '#22d3ee':'--cat-1','#06b6d4':'--cat-1','#0e7490':'--cat-1','#2e9e74':'--up','#10b981':'--up','#34d399':'--up','#3acfb3':'--up',
  '#6366f1':'--cat-2','#60a5fa':'--cat-2','#3b82f6':'--cat-2','#3b8bdf':'--cat-2','#6f89d8':'--cat-2',
  '#a78bfa':'--cat-4','#8b5cf6':'--cat-4','#f472b6':'--cat-4','#ec4899':'--cat-4',
  '#f59e0b':'--warn','#fb923c':'--cat-3','#d9773a':'--cat-3','#c2873c':'--warn','#d9a441':'--warn',
  '#f43f5e':'--dn','#cc5867':'--dn','#f8717a':'--dn','#ef4444':'--dn',
  '#d7e1ea':'--ink-2','#a0aab8':'--ink-3','#7c8aa5':'--ink-3','#6a7484':'--ink-3'
 };
 function mixed(role,alpha){return alpha===1?'var('+role+')':'color-mix(in srgb,var('+role+') '+(alpha*100).toFixed(2)+'%,transparent)';}
 function adapt(value){return value.replace(/#[0-9a-f]{8}\b|#[0-9a-f]{6}\b/gi,h=>{const role=roles[h.slice(0,7).toLowerCase()];return role?mixed(role,h.length===9?parseInt(h.slice(7),16)/255:1):h;}).replace(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/gi,(all,r,g,b,a)=>{const hex='#'+[r,g,b].map(x=>Number(x).toString(16).padStart(2,'0')).join('');return roles[hex]?mixed(roles[hex],a===undefined?1:Number(a)):all;});}
 function repaint(){root.querySelectorAll('[style],[fill],[stroke],[stop-color]').forEach(n=>{for(const attr of ['style','fill','stroke','stop-color']){const value=n.getAttribute(attr);if(value){const updated=adapt(value);if(updated!==value)n.setAttribute(attr,updated);}}});}
 const prior=render;render=function(){prior();repaint();};repaint();
})();
