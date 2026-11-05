(function(){
'use strict';
var D=window.NOVEMBER_WEEKLY;if(!D)return;
var today=/^https?:$/.test(location.protocol)?new Date(Date.now()+3*3600e3).toISOString().slice(0,10):D.today;
window.NOVEMBER_VISIBLE_DAY=today<'2026-11-30'?today:'2026-11-30';
window.NOVEMBER_CLOSED_DAY=new Date(Date.parse(today+'T00:00:00Z')-864e5).toISOString().slice(0,10);
Array.prototype.forEach.call(document.querySelectorAll('[data-nov-from]'),function(el){el.hidden=el.dataset.novFrom>today;if(el.dataset.novStageEnd){var label=el.querySelector('.nov-stage-date');if(label)label.textContent=today<el.dataset.novFrom?'Запланировано':today<=el.dataset.novStageEnd?'Окно по плану':'Срок прошёл';}});
Array.prototype.forEach.call(document.querySelectorAll('.nd-ad-grid'),function(grid){var n=grid.querySelectorAll('.nd-ad-head [data-nov-from]:not([hidden])').length;grid.style.setProperty('--nov-ad-columns',String(n+1));});
})();
