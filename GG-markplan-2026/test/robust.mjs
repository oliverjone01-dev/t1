import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', 'public');
const SP = path.join(HERE, 'fixtures') + path.sep;
const M={'.html':'text/html;charset=utf-8','.css':'text/css;charset=utf-8','.js':'application/javascript;charset=utf-8'};
const srv=http.createServer((q,r)=>{let f=decodeURIComponent(q.url.split('?')[0]); if(f==='/')f='/plan.html';
 const p=path.join(ROOT,f); if(!fs.existsSync(p)){r.writeHead(404);r.end();return;}
 r.writeHead(200,{'content-type':M[path.extname(p)]||'text/plain'});r.end(fs.readFileSync(p));});
await new Promise(r=>srv.listen(0,r)); const B='http://127.0.0.1:'+srv.address().port;
const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
let fails=0,checks=0;
const bad=(n,m)=>{fails++;console.log(`  FAIL ${n}: ${m}`)}; const ok=()=>checks++;

async function open(fixture){
  const ctx=await br.newContext({viewport:{width:1440,height:900}});
  const pg=await ctx.newPage(); const errs=[];
  pg.on('pageerror',e=>errs.push('pageerror: '+e.message));
  pg.on('console',m=>{if(m.type()==='error'&&!/CERT_|ERR_FAILED/.test(m.text()))errs.push(m.text());});
  await pg.route('**fonts.g**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
  await pg.route('**/gviz/**',r=>fixture?r.fulfill({status:200,contentType:'text/csv; charset=utf-8',body:fs.readFileSync(SP+fixture,'utf8')}):r.abort());
  await pg.addInitScript(()=>{try{localStorage.setItem('gg.theme','dark')}catch(e){}});
  await pg.goto(B+'/plan.html',{waitUntil:'load'}); await pg.waitForTimeout(1600);
  return {ctx,pg,errs};
}
const snap = pg => pg.evaluate(()=>{
  const q=s=>document.querySelector(s);
  const texts=Array.from(document.querySelectorAll('.g-left text')).map(n=>n.textContent);
  return {badge:(q('#src-badge')||{}).textContent, date:(q('#mast-date')||{}).textContent,
    late:q('#late-note')&&!q('#late-note').hidden?q('#late-note').textContent.trim():'',
    rows:document.querySelectorAll('.trow').length, blocks:document.querySelectorAll('details.bcard').length,
    hint:q('.g-hint')?q('.g-hint').textContent.trim():'',
    noDate:texts.filter(t=>/срок не назначен/.test(t)).length,
    suspect:texts.filter(t=>/\b(18\d\d|19\d\d|20[3-9]\d)\b/.test(t)),
    years:[...new Set(texts.filter(t=>/^до |^просрочено/.test(t)))].slice(0,4),
    docW:document.documentElement.scrollWidth, winW:innerWidth};
});

// 1. мусорные даты и длительности
{ const {ctx,pg,errs}=await open('gviz-garbage.csv'); const r=await snap(pg);
  console.log('garbage  ', JSON.stringify({badge:r.badge,rows:r.rows,noDate:r.noDate,suspect:r.suspect.length}));
  if(r.suspect.length) bad('garbage',`даты вне плана на экране: ${r.suspect.slice(0,3).join(' / ')}`); else ok();
  if(r.noDate<10) bad('garbage',`битые даты не превратились в «срок не назначен» (${r.noDate} из 10+)`); else ok();
  if(r.rows!==134) bad('garbage',`задач ${r.rows}, ждали 134 (ни одна не должна пропасть)`); else ok();
  if(errs.length) bad('garbage','console: '+errs.slice(0,2).join(' | ')); else ok();
  await ctx.close(); }

// 2. таблица без колонки «Приоритет» -> честный откат на снимок
{ const {ctx,pg,errs}=await open('gviz-nopr.csv'); const r=await snap(pg);
  console.log('no-prio  ', JSON.stringify({badge:r.badge,rows:r.rows}));
  if(!/^данные не обновились · список от /.test(r.badge||'')) bad('no-prio',`бейдж "${r.badge}", ждали откат на снимок`); else ok();
  if(errs.length) bad('no-prio','console: '+errs.slice(0,2).join(' | ')); else ok();
  await ctx.close(); }

// 3. пустая таблица (только шапка)
{ const {ctx,pg,errs}=await open('gviz-empty.csv'); const r=await snap(pg);
  console.log('empty    ', JSON.stringify({badge:r.badge,rows:r.rows,docW:r.docW}));
  if(r.rows!==134) bad('empty',`пустая таблица не откатилась на снимок (${r.rows} задач)`); else ok();
  if(r.docW>r.winW+1) bad('empty','горизонтальный скролл'); else ok();
  if(errs.length) bad('empty','console: '+errs.slice(0,2).join(' | ')); else ok();
  await ctx.close(); }

// 4. всё готово -> счётчик просрочки обязан исчезнуть
{ const {ctx,pg,errs}=await open('gviz-alldone.csv'); const r=await snap(pg);
  console.log('all-done ', JSON.stringify({badge:r.badge,rows:r.rows,late:r.late.slice(0,40)}));
  if(r.late) bad('all-done',`сводка просрочек осталась: "${r.late.slice(0,60)}"`); else ok();
  if(r.rows!==134) bad('all-done',`задач ${r.rows}`); else ok();
  if(errs.length) bad('all-done','console: '+errs.slice(0,2).join(' | ')); else ok();
  await ctx.close(); }

// 5. положительный контроль гейта: оценку вписали в «Обоснование» задачи.
// В файлах репозитория её нет, поймать может только проверка по отрисованному
// тексту. Если этот сценарий проходит молча, значит гейт слеп к таблице.
{ const {ctx,pg,errs}=await open('gviz-claim.csv');
  const found=await pg.evaluate(()=>{
    const t=document.body.innerText.replace(/\s+/g,' ');
    const m=t.match(/(\d+(?:[.,]\d+)?)\s*(?:из\s*10|\/\s*10)(?!\d)(?![.,]\d)/g)||[];
    return m.filter(x=>/9,9/.test(x));
  });
  console.log('claim    ', JSON.stringify({found}));
  if(!found.length) bad('claim','оценка из таблицы не видна в отрисованном тексте: гейт по тексту проверять нечего'); else ok();
  // и она обязана быть неподтверждённой: ни одного отчёта по markplan с 9.9
  const recorded=new Set();
  const epi=path.resolve(HERE,'..','..','knowledge','episodes');
  const walk=d=>{ if(!fs.existsSync(d))return;
    for(const e of fs.readdirSync(d,{withFileTypes:true})){ const p2=path.join(d,e.name);
      if(e.isDirectory()) walk(p2);
      else if(/feniks.*\.json$/.test(p2)){ try{ const j=JSON.parse(fs.readFileSync(p2,'utf8'));
        if(String(j.deliverable_ref||'').includes('GG-markplan') && j.weighted_total!=null)
          recorded.add(String(j.weighted_total).replace('.',',')); }catch(e2){} } } };
  walk(epi);
  if(recorded.has('9,9')) bad('claim','9,9 внезапно оказалась подтверждённой: контроль потерял смысл'); else ok();
  console.log('           отчёты по markplan:', [...recorded].join(', ') || 'нет');
  // A10: по умолчанию раскрыто 2 блока из 16, и свёрнутое в innerText не попадает.
  // Проверяем, что весь текст документа виден и без клика.
  const deep=await pg.evaluate(()=>{
    const t=document.documentElement.textContent.replace(/\s+/g,' ');
    return (t.match(/9,9\s*из\s*10/g)||[]).length;
  });
  if(!deep) bad('claim','оценка из свёрнутого блока не видна в textContent документа'); else ok();
  console.log('           найдено в полном тексте документа:', deep);
  if(errs.length) bad('claim','console: '+errs.slice(0,2).join(' | ')); else ok();
  await ctx.close(); }

// 6. таблица вообще недоступна
{ const {ctx,pg,errs}=await open(null); const r=await snap(pg);
  console.log('offline  ', JSON.stringify({badge:r.badge,rows:r.rows}));
  if(!/^данные не обновились · список от /.test(r.badge||'')) bad('offline',`бейдж "${r.badge}"`); else ok();
  await ctx.close(); }

await br.close(); srv.close();
console.log(`\nrobust: проверок ${checks+fails}, провалов ${fails}`);
process.exit(fails?1:0);
