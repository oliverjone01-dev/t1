import {competitorSourceSwitch,sourceSwitchCss} from './source-switch.js';
import { readFileSync } from 'node:fs';
import { KPAGES,navButton } from '../katya-nav.js';
import { validateMatchedSnapshot,type MatchedSnapshot } from './matched-data.js';

export function matchedCompetitorPage(snapshot:MatchedSnapshot,baseCss:string,buildTs:string):string{
 const data=validateMatchedSnapshot(snapshot);
 if(!baseCss.includes('--bg-base'))throw new Error('competitors: missing KATYA design tokens');
 const css=readFileSync('katya/competitors/style.css','utf8');
 const js=readFileSync('katya/competitors/app.js','utf8');
 if(/<\/script/i.test(js))throw new Error('competitors: unsafe client script');
 const json=JSON.stringify(data).replace(/</g,'\\u003c');
 const nav=KPAGES.map(([h,l,key])=>navButton(h,l,key==='competitors')).join(' ');
 const short=(d:string)=>d.slice(8)+'.'+d.slice(5,7)+'.'+d.slice(0,4);
 return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GENGLASS · Конкуренты</title><style>${baseCss}\n${css}\n${sourceSwitchCss}</style></head><body>
 <div id="gg-nav"><div>${nav}</div></div>
 ${competitorSourceSwitch('mpstats')}<header class="topbar"><div class="brand"><div class="brand-logo">GG</div><div><div class="brand-name">GENGLASS</div><div class="brand-sub">Конкуренты · OZON</div></div></div><div class="topbar-spacer"></div><span class="cm-period">${short(data.period.d1)} - ${short(data.period.d2)}</span><span class="cm-chip">MPSTATS</span><button class="cm-info" id="cm-help" title="Источники, полнота данных и определения" aria-label="Источники и определения">ⓘ</button></header>
 <main class="main"><section id="cm-kpis" class="cm-kpis"></section><div class="cm-tabs" role="tablist"><button data-tab="compare" role="tab">Сравнение</button><button data-tab="search" role="tab">Поиск и CR</button><button data-tab="pending" role="tab">Не распределены</button></div><div id="cm-view"></div></main>
 <dialog id="cm-source-dialog"><div class="card-h"><div class="card-title">Источники и определения</div><button id="cm-help-close" aria-label="Закрыть">✕</button></div><div id="cm-source-body"></div><div class="cm-build">Сборка ${buildTs.replace(/[<>&"']/g,'')} · данные MPSTATS по ${short(data.period.d2)}</div></dialog>
 <script id="cm-data" type="application/json">${json}</script><script>${js}</script></body></html>`;
}
