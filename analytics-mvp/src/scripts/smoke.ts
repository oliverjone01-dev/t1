// @ts-nocheck
// Headless smoke-прогон контролов каждой страницы через jsdom.
// Имитирует клики собственников: периоды, сравнение, фильтры, раскрытие строк,
// чипы и ввод ассистента. Любая рантайм-ошибка = тест падает.
import { JSDOM, VirtualConsole } from "jsdom";
import { readFileSync, readdirSync } from "node:fs";
import { OUT_DIR, IS_OZON, YM_FORBIDDEN } from "../paths.js";

const PAGES = readdirSync(OUT_DIR).filter((f) => f.endsWith(".html"));

function fire(el: any, type: string) {
  const win = el.ownerDocument.defaultView;
  const ev = type === "keydown"
    ? new win.KeyboardEvent("keydown", { key: "Enter", bubbles: true })
    : new win.Event(type, { bubbles: true });
  el.dispatchEvent(ev);
}

let failed = 0;
for (const page of PAGES) {
  const errors: string[] = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e: Error) => errors.push("jsdomError: " + e.message));
  const html = readFileSync(`${OUT_DIR}/${page}`, "utf-8");
  let dom: JSDOM;
  try {
    dom = new JSDOM(html, { runScripts: "dangerously", virtualConsole: vc, pretendToBeVisual: true });
  } catch (e) {
    console.error(`FAIL ${page}: загрузка - ${(e as Error).message}`);
    failed++;
    continue;
  }
  const { document } = dom.window as any;
  const click = (sel: string) => document.querySelectorAll(sel).forEach((el: any) => { try { fire(el, "click"); } catch (e) { errors.push(`${sel}: ${(e as Error).message}`); } });
  const change = (sel: string) => document.querySelectorAll(sel).forEach((el: any) => { try { fire(el, "change"); } catch (e) { errors.push(`${sel}: ${(e as Error).message}`); } });

  // период
  click(".chip");
  // сравнение
  click("#cmpBtn");
  // фильтры (Товары)
  change("#fCat"); change("#fSub"); change("#fLine");
  // раскрытие строк (Товары)
  click("tr.line-row");
  // ассистент: чипы + ввод
  click(".qq");
  const q = document.getElementById("q");
  if (q) { q.value = "сводка за период"; const ask = document.getElementById("ask"); if (ask) fire(ask, "click"); fire(q, "keydown"); }
  // повторное переключение периода после действий
  click(".chip");
  // краевой случай: инвертированные даты (FENIX B2)
  const cf = document.getElementById("cf"), ct = document.getElementById("ct");
  if (cf && ct) { cf.value = "2026-06-01"; ct.value = "2026-05-01"; const ac = document.getElementById("applyCustom"); if (ac) fire(ac, "click"); }
  // краевой случай: пустая дата (FENIX L1)
  if (cf) { cf.value = ""; const ac = document.getElementById("applyCustom"); if (ac) fire(ac, "click"); }
  // поиск числовых поломок в ВИДИМОМ тексте (без исходника <script>)
  const clone = document.body.cloneNode(true);
  clone.querySelectorAll("script").forEach((s: any) => s.remove());
  const body = clone.textContent || "";
  if (/-?Infinity|NaN|undefined ₽/.test(body)) errors.push("в выводе Infinity/NaN/undefined");

  // ФЕНИКС G4/G5 (Маркет): на страницах /market/ не должно остаться OZON-подписей источников и ссылок
  // (реклама Маркета не подключена, Seller API/realFBS/Premium - сущности OZON). Проверяем сырой HTML,
  // потому что подписи живут внутри клиентских JS-строк.
  if (!IS_OZON) { const m = html.match(YM_FORBIDDEN); if (m) errors.push(`OZON-подпись на странице Маркета: «${m[0]}» (словарь YM_LABELS в paths.ts неполон)`); }
  // Слот OZON в селекторе каналов: на дашборде Маркета он пуст потому, что у OZON свой дашборд,
  // а не потому, что у OZON нет продаж. Без оговорки оверлей утверждает «нет данных» про живой канал.
  // Плейсхолдеры platformize обязаны раскрываться. Живой факт 2026-09-07: токен @@GG_KEEP_OZON@@
  // содержал слово, которое сам защищает, и общая замена OZON -> Яндекс Маркет съела его целиком,
  // оставив на странице «@@GG_KEEP_Яндекс Маркет@@».
  if (/@@GG_/.test(html)) {
    errors.push(`на странице остался нераскрытый плейсхолдер platformize: ${(html.match(/@@GG_[^@]*@@?/) || [""])[0]}`);
  }
  // Слой закрытых месяцев держится на подписанных Актах OZON. У Маркета такого источника нет, и
  // дословный перенос текста утверждал бы про Маркет несуществующее, вместе с зашитыми месяцами OZON.
  if (!IS_OZON && /(из подписанных Актов \(|Накоплено \(фев-апр\)|незакрытые месяцы \(май-июнь\)|DOC_0)/.test(html)) {
    errors.push("на странице Маркета утверждение про закрытый слой из подписанных Актов или зашитые месяцы OZON (у Маркета аналога Актов нет)");
  }
  if (!IS_OZON && /прочие пока не подключены к API/.test(html)) {
    errors.push("оверлей каналов на Маркете говорит «нет данных» про OZON, не оговорив его отдельный дашборд (platformize в paths.ts)");
  }
  // FENIX BLOCKER-2: скрытая линия VALONTI (перегородки) не светится - ни в тексте, ни в DATA.
  // VIOLUR (столы) - легальный бренд, показывается открыто (решение Ивана).
  if (/valonti/i.test(html)) errors.push("утечка бренда скрытой линии VALONTI в HTML/DATA");
  // FENIX BLOCKER-1, структурно: jsdom не рендерит CSS-layout, поэтому проверяем только
  // наличие скролл-обёрток у таблиц; визуальная читаемость на 390px - ручной просмотр (DoD)
  // katya.html - сторонний макет Кати (своя вёрстка), GENGLASS-гейты к нему не применяем;
  // держим только универсальное: грузится без jsdomError, нет утечки VALONTI, нет видимого NaN.
  const isKatya = page.startsWith("katya");
  const tAll = document.querySelectorAll("table").length;
  const tWrap = document.querySelectorAll(".tscroll table").length;
  if (!isKatya && tAll !== tWrap) errors.push(`таблиц без скролл-обёртки .tscroll: ${tAll - tWrap} из ${tAll}`);
  if (page === "obzor.html") {
    if (!/max-width:760px/.test(html)) errors.push("нет мобильного media-query");
    if (!document.getElementById("oos")) errors.push("нет OOS-блока на Обзоре");
  }
  if (page === "money.html" && !/закрытый месяц/i.test(body)) errors.push("нет даты последнего закрытого месяца");

  // проверка, что ключевые контейнеры заполнены (не пустые)
  const checks: Array<[string, string]> = [];
  if (document.getElementById("kpis")) checks.push(["#kpis", document.getElementById("kpis").innerHTML]);
  if (document.getElementById("rows")) checks.push(["#rows", document.getElementById("rows").innerHTML]);
  if (document.getElementById("answer")) checks.push(["#answer", document.getElementById("answer").innerHTML]);
  for (const [sel, html2] of checks) if (!html2 || html2.length < 5) errors.push(`${sel} пустой после действий`);

  if (errors.length) { console.error(`FAIL ${page}:`); errors.slice(0, 5).forEach((e) => console.error("   " + e)); failed++; }
  else console.log(`OK   ${page} (контролы отработали без ошибок)`);
  dom.window.close();
}

console.log(failed ? `\nПРОВАЛ: ${failed} страниц с ошибками` : `\nВСЕ ${PAGES.length} страниц прошли smoke-прогон контролов`);
process.exit(failed ? 1 : 0);
