// TURBIUM palette adaptation of the existing SVG/HTML chart primitives.
(function(){
 const root=document.getElementById('gg-dashboard');if(!root)return;
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
 let queued=false;const observer=new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;repaint();});});observer.observe(root,{childList:true,subtree:true});repaint();
})();

// Common composition appearance for the native chart engines and SVG sectors.
(function(){const root=document.getElementById("gg-dashboard");if(!root)return;const done=new WeakSet();function styleDonuts(){const css=getComputedStyle(root),background=css.getPropertyValue("--bg-card").trim();root.querySelectorAll("svg circle[stroke-dasharray],svg path[d]").forEach(node=>{if(done.has(node))return;const d=node.getAttribute("d")||"",circle=node.tagName.toLowerCase()==="circle",sector=!circle&&/[Aa]/.test(d)&&/[Zz]\s*$/.test(d)&&node.getAttribute("fill")!=="none";if(!circle&&!sector)return;if(circle){const r=Number(node.getAttribute("r"));if(!(r>10))return;node.classList.add("gg-kit-ring-arc");}else{node.classList.add("gg-kit-pie-arc");node.style.stroke="var(--bg-card)";node.style.strokeWidth="2px";}node.setAttribute("tabindex","0");done.add(node);});if(window.Chart?.instances)Object.values(window.Chart.instances).forEach(chart=>{if(done.has(chart)||chart.config?.type!=="doughnut")return;chart.options.cutout="70%";chart.options.elements=chart.options.elements||{};chart.options.elements.arc={...(chart.options.elements.arc||{}),spacing:3,hoverOffset:6,borderWidth:2,borderColor:background};chart.update("none");done.add(chart);});if(window.echarts?.getInstanceByDom)root.querySelectorAll("[_echarts_instance_]").forEach(node=>{const chart=window.echarts.getInstanceByDom(node);if(!chart||done.has(chart))return;const option=chart.getOption(),series=(option.series||[]).map(item=>item.type==="pie"?{...item,itemStyle:{...item.itemStyle,borderWidth:2,borderColor:background},emphasis:{...item.emphasis,scale:true,scaleSize:6}}:item);if(series.some(item=>item.type==="pie")){chart.setOption({series});done.add(chart);}});}let queued=false;new MutationObserver(()=>{if(!queued){queued=true;requestAnimationFrame(()=>{queued=false;styleDonuts();});}}).observe(root,{subtree:true,childList:true});styleDonuts();setTimeout(styleDonuts,1000);})();


