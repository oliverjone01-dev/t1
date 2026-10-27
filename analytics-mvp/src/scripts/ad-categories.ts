// One implementation for browser rendering and tests. No allocation of a campaign across categories.
export const AD_CATEGORIES_JS = String.raw`
function adCategoryRows(a,bySku,byOffer,byCamp){
  var groups=Object.create(null),seen=Object.create(null),lineMap={'столы':'Столы','зеркала':'Зеркала','зеркала/металл':'Зеркала','свет':'Свет','консоли/тумбы':'Консоли/тумбы','комплектующие':'Комплектующие','мягкая мебель':'Мягкая мебель','хранение':'Хранение','перегородки':'Перегородки','маркерные доски':'Маркерные доски','комплект мебели':'Комплект мебели'};
  var known=function(v){return typeof v==='number'&&Number.isFinite(v);};
  var category=function(v){return typeof v==='string'&&v&&v!=='Прочее'?v:null;};
  var add=function(x,y){return known(x)&&known(y)?x+y:null;};
  var list=a.all||a.top_spend||[];
  list.forEach(function(c){
    var id=String(c.id||'');if(!id||seen[id])throw new Error('Ad category campaign ID missing/duplicated: '+id);seen[id]=true;
    var cpo=/за заказ|ALL_SKU_PROMO|^CPO$/i.test(String(c.instr||''));
    var sk=c.skus&&c.skus[0]?String(c.skus[0]):byCamp[id];
    var cat=cpo?'Оплата за заказ':category(bySku[sk])||category(byOffer[c.off])||category(lineMap[String(c.line||'').toLowerCase()])||'Категория не определена';
    var g=groups[cat]||(groups[cat]={cat:cat,sp:0,om:0,o:0,count:0,ids:[]});
    var om=c.om,o=c.o;
    // Zero API values of CPO are placeholders; only accepted full-period cabinet coverage is usable.
    if(cpo){var full=known(c.cpoRev)&&!c.cpoPart;om=full?c.cpoRev:null;o=full?c.cpoU:null;}
    g.sp=add(g.sp,c.sp);g.om=add(g.om,om);g.o=add(g.o,o);g.count++;g.ids.push(id);
  });
  var rows=Object.keys(groups).map(function(k){var g=groups[k];g.drr=known(g.sp)&&known(g.om)&&g.om>0?Math.round(g.sp/g.om*1000)/10:null;return g;});
  var sourceSpend=0,resultSpend=0,complete=true;
  list.forEach(function(c){if(!known(c.sp))complete=false;else sourceSpend+=c.sp;});
  rows.forEach(function(g){if(!known(g.sp))complete=false;else resultSpend+=g.sp;});
  if(complete&&Math.abs(sourceSpend-resultSpend)>0.01)throw new Error('Ad category expense partition mismatch');
  return rows.sort(function(x,y){return (y.sp==null?-Infinity:y.sp)-(x.sp==null?-Infinity:x.sp);});
}`;
export const adCategoryRows = new Function(AD_CATEGORIES_JS + ';return adCategoryRows;')() as (
  a: {all?: any[];top_spend?: any[]}, bySku: Record<string,string>, byOffer: Record<string,string>, byCamp: Record<string,string>
) => {cat:string;sp:number|null;om:number|null;o:number|null;drr:number|null;count:number;ids:string[]}[];
