// Partner-facing presentation. Keep record identifiers, never navigation into CRM.
function dgSafeMarkup(html){
  return String(html).replace(/<a\b((?:"[^"]*"|'[^']*'|[^'">])*)>([\s\S]*?)<\/a>/gi,(whole,attrs,body)=>{
    const href=attrs.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i),value=href&&(href[1]||href[2]||href[3]);
    if(/^#sec[123]$/.test(value||''))return whole;
    const clean=attrs.replace(/\s(?:href|target|rel|title|onclick)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,'');
    return '<span'+clean+'>'+body.replace(/\s*↗/g,'')+'</span>';
  });
}
function dgVerticalConversion(leads,qualified,sales,cr1,cr2){
  const values=[leads,qualified,sales],labels=['Заявки','Квалифицированные лиды','Продажи'],max=Math.max(...values,1);
  return `<div class="dg-cross-layout"><div class="dg-cross-vertical">${values.map((value,i)=>`<div class="dg-cross-stage" data-cross-count="${value}"><span>${labels[i]}</span><div class="dg-cross-bar" style="width:${Math.max(14,100*value/max)}%;background:${i?'#2E9E74':'#3DAEC2'}"><b>${fmt(value)}</b></div>${i<2?`<small>${i?'CR2':'CR1'} · ${pct(i?cr2:cr1)}</small>`:''}</div>`).join('')}</div><div class="dg-cross-total">Сквозная заявка → продажа<b>${pct(leads?sales/leads:0)}</b></div></div>`;
}
function dgFirstStageDate(d,code){return (d.hist||[]).filter(h=>h[0]===code&&h[1]).map(h=>h[1]).sort()[0]||null;}
updBadge=()=>{const el=document.getElementById('nextUpd');if(el)el.textContent='↻ обновление на сервере каждые 15 минут'+(S.end===DATA.to?' · МСК · текущий день не завершён':'');};
