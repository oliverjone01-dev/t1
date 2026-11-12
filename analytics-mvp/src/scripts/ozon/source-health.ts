import {readCpo} from "./cpo-capture.js";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { closedDay, shiftDay, readRows } from "./collector-integrity.js";
import {supplements} from './cabinet-supplements.js';
import {readCaptureFile,latestCapture} from './cabinet-capture.js';

export type SourceHealth = { source: string; through: string | null; expected: string; status: "ok" | "warning" | "error"; note: string };
const json = (path: string): any => existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
const maxDate = (rows: any[], fields: string[]) => rows.flatMap(r => fields.map(f => String(r[f] ?? "").slice(0,10))).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().at(-1) ?? null;

export function sourceHealth(dir: string, now = new Date()): SourceHealth[] {
  const to = closedDay(now), today = shiftDay(to, 1), out: SourceHealth[] = [];
  const captureFile=readCaptureFile(dir),capture=captureFile&&latestCapture(captureFile);
  if(capture)out.push({source:'Кабинет: штатная выгрузка',through:capture.day,expected:today,
    status:capture.day>=today&&capture.scope.status==='complete'?'ok':'warning',
    note:`Снято ${capture.captured_at}; ${capture.day_in_progress?'день не завершён; ':''}получено ${capture.scope.matched} из ${capture.scope.expected} ожидаемых SKU; не наблюдались ${capture.scope.missing}. Измерены показы, посещения карточек, корзины, заказанные товары и позиция поиска. Закрытые дни подключены к воронке, категориям, тестам, плану карточек и показам отчёта; датированный срез доступен в Воронке и карточках тестов. Цены, соинвест, бустинг, реклама и денежные показатели сохраняют собственные источники и даты.`});
  const status = json(join(dir, "collector_status.json"));
  const attempt = json(join(dir, "collector_failures.json"));
  if (attempt.failures?.length) out.push({source:"Последняя загрузка",through:attempt.attempted_at ?? null,expected:to,status:"error",note:attempt.failures.join("; ")});
  const adjustments = json(join(dir,"ads_report_adjustments.json"));
  const adjusted: string[] = [];
  for (const [collector, campaigns] of Object.entries(adjustments)) for (const [cid, item] of Object.entries(campaigns as any)) {
    if ((item as any).reports?.length) adjusted.push(`${cid} (${collector})`);
  }
  if (adjusted.length) out.push({source:"Недатированные корректировки CSV",through:null,expected:to,status:"warning",note:`В ${adjusted.length} отчётах есть корректировка без SKU и даты операции. Сохранена отдельно, не распределена по товарам/дням: ${adjusted.join(", ")}`});
  const defs: Array<[string, string, string[], string?]> = [
    ["Заказы", "orders_daily.ndjson", ["d"]], ["Продажи", "history.ndjson", ["date"]],
    ["Дневные итоги", "daily_totals.ndjson", ["date"]], ["Воронка SKU", "sku_views.ndjson", ["date"]],
    ["Расход кампаний", "ads_daily.ndjson", ["d"]], ["Расход CPC по SKU", "ads_sku_daily.ndjson", ["d"]],
    ["Атрибуция CPC", "ads_attr_daily.ndjson", ["d"]], ["Дневная реализация", "realization_daily.ndjson", ["d"]],
    ["Начисления SKU", "acq_sku_daily.ndjson", ["d"], "acq-sku-daily"],
    ["Финансы канала", "pnl_channel_accrual_daily.ndjson", ["d"], "pnl-accrual-daily"],
    ["Финансы SKU по дате заказа", "pnl_sku_accrual_daily.ndjson", ["d"], "pnl-sku-accrual-daily"],
    ["Цены", "prices_daily.ndjson", ["d"]],
  ];
  for (const [source, file, fields, collector] of defs) {
    const rows = readRows(join(dir, file));
    const through = collector && status[collector]?.through || maxDate(rows, fields);
    // У доставленных заказов последняя дата заказа может быть старше даты выгрузки.
    const expected = collector === "pnl-sku-accrual-daily" && !status[collector] ? shiftDay(to, -7) : to;
    out.push({ source, through, expected, status: through && through >= expected ? "ok" : "error", note: collector && status[collector] ? `Успешная загрузка ${status[collector].loaded_at}` : "Дата последней строки; не подтверждает отсутствие внутренних пропусков" });
  }
  const supplemental = supplements(dir), catalog = [...supplemental.catalogs].sort((a,b)=>Date.parse(a.captured_at)-Date.parse(b.captured_at)).at(-1);
  const catalogFresh = catalog && Date.parse(catalog.captured_at)<=now.getTime()+60000 && now.getTime()-Date.parse(catalog.captured_at)<=18*3600000;
  for(const [label, fields] of [['Цены реализации и разрыв цен',['cap','buyer','gap_pct']],['Остатки каталога',['stock_ozon','stock_seller']],['Комиссии каталога',['commission_fbo','commission_fbs']],['Расчётная логистика каталога',['logistics_fbo_min','logistics_fbo_max','logistics_fbs_min','logistics_fbs_max']],['Эквайринг каталога',['acquiring']]] as [string,string[]][]){
    const observed=catalog?.items.filter(r=>fields.every(k=>(r as any)[k]!==null)).length??0;
    out.push({source:label,through:catalog?.day??null,expected:today,status:catalogFresh&&catalog?.expected===catalog?.items.length&&observed===catalog?.items.length?'ok':'error',note:`Время сеанса ${catalog?.captured_at??'неизвестно'}; ${observed} из ${catalog?.items.length??0} товаров с полями. Расчётные условия не заменяют начисления по заказам. Разрыв цен не является фактической компенсацией Ozon.`});
  }
  const ordinaryThrough=maxDate(readRows(join(dir,'gap_daily.ndjson')),['date']);
  out.push({source:'Обычная цена без карты: история для тестов',through:ordinaryThrough,expected:today,status:ordinaryThrough&&ordinaryThrough>=today?'ok':'warning',note:'Самостоятельная база сравнения. Цена реализации из каталога может учитывать скидку банка и не заменяет обычную цену без карты; новые даты не достраиваются.'});
  for(const [label,file] of [['Соинвест по карте (исторический источник)','coinv_daily.ndjson'],['Составляющие бустинга','boost_daily.ndjson']] as const){
    const through=maxDate(readRows(join(dir,file)),['date']);out.push({source:label,through,expected:today,status:through&&through>=today?'ok':'warning',note:'Отдельное наблюдение; каталог цен не содержит этого показателя. Старое значение нельзя считать текущим.'});
  }
  const comp=supplemental.competitors;
  out.push({source:'Конкуренты: кабинетные выгрузки',through:comp?.source_updated_at??null,expected:shiftDay(to,-2),status:comp&&Date.parse(comp.source_updated_at)<=now.getTime()&&now.getTime()-Date.parse(comp.source_updated_at)<=72*3600000?'warning':'error',note:comp?`Подключены ${comp.exports.length} выгрузок за 7/28 дней; получены ${comp.captured_at}. Категории ограничены 1000 строками, полного рынка и полного списка наблюдения не подтверждают.`:'Новые выгрузки не подключены; страница использует исторический снимок.'});
  const tariff=json(join(dir,'fbs_tariff.json'));out.push({source:'Фактический тариф FBS по отправлениям',through:tariff.source_date??null,expected:to,status:tariff.source_date>=to?'ok':'warning',note:'Отдельная база от расчётных тарифов каталога; необходимы сведения по отправлениям.'});
  const cabinet = json(join(dir, "reakciya.json"));
  for(const [label,key] of [['Реакция: журнал действий','updated'],['Реакция: архив воронки','data_until'],['Реакция: архив цен','prices_until']] as const){
    const through=cabinet[key]??null;
    out.push({source:label,through,expected:to,status:through&&through>=to?'ok':'warning',note:'Архив самостоятельного анализа действий. Пересборка страницы не обновляет журнал кампаний и рассчитанные эффекты. Текущие выгрузки используются в Воронке, Маркетинге и Тестах.'});
  }
  const timeline=json(join(dir,'delivery_timeline.json'));
  const timelineAge=now.getTime()-Date.parse(timeline.loaded_at);
  const timelineFresh=Number.isFinite(timelineAge)&&timelineAge>=-60000&&timelineAge<=36*3600000;
  const timelineIssues=(timeline.rows??[]).filter((r:any)=>r.missing||r.issues?.length).length;
  out.push({source:'Наша доставка: сроки и статусы',through:timeline.source_date??null,expected:to,status:!timelineFresh?'error':timelineIssues?'warning':'ok',note:`Снято ${timeline.loaded_at??'неизвестно'}; строк для проверки: ${timelineIssues}. Неполные номера отправлений сохраняются отдельно для проверки и не подтверждают доставку или просрочку. Денежная ведомость имеет собственную дату.`});
  const cpo=readCpo(f=>join(dir,f));
  if(cpo){
    const cpoJoinCurrent=createHash('sha256').update(readFileSync(join(dir,'orders_daily.ndjson'))).digest('hex')===cpo.orders_sha256;
    out.push({source:'CPO: все товары — общая настройка',through:cpo.settings.captured_at,expected:today,status:Date.parse(cpo.settings.captured_at)<=now.getTime()+60000&&now.getTime()-Date.parse(cpo.settings.captured_at)<=18*3600000?'ok':'warning',note:`${cpo.settings.active?'Активно':'Остановлено'}, ставка ${cpo.settings.bid_percent}%; ${cpo.settings.promoted_products} товаров за период интерфейса ${cpo.settings.products_period_from}..${cpo.settings.products_period_to}. Это не наблюдение ставки каждого SKU и не история ставок.`});
    out.push({source:'CPO: выгрузка по товарам и дням',through:cpo.to,expected:to,status:cpo.to>=to&&!cpo.miss.length&&cpoJoinCurrent?'ok':'warning',note:`Окно ${cpo.from}..${cpo.to}, снято ${cpo.captured_at}. Ненайденных заказов: ${cpo.miss.reduce((n,r)=>n+r.n,0)}. ${cpoJoinCurrent?'':'Заказы обновились после сопоставления; нужен повторный пересчёт CPO. '}Номера заказов остаются в локальном архиве. Дневная выручка связанных заказов рассчитана по версии данных заказов, использованной при сопоставлении.`});
  }
  for (const [source, file, fields] of [
    ["CPO: ставки и позиции", "cpo_sku_status.ndjson", ["date", "d"]],
    ["CPO: ручная выгрузка", "cpo_sku_daily.ndjson", ["d"]],
  ] as Array<[string,string,string[]]>) {
    const through = maxDate(readRows(join(dir, file)), fields);
    if(cpo && file=== "cpo_sku_daily.ndjson")continue;
    out.push({ source, through, expected: to, status: through && through >= to ? "ok" : "warning", note: "Более поздние даты не подтверждены. Нужна новая выгрузка/съём кабинета" });
  }
  const delivery = json(join(dir,"delivery_sheet_status.json"));
  if (delivery.loaded_at) {
    const expectedFiles = ["delivery_orders.ndjson","delivery_sku_daily.ndjson","delivery_city_daily.ndjson","delivery_trips_extra.ndjson","delivery_cities.json"];
    const complete = expectedFiles.every(file => existsSync(join(dir,file)) && delivery.outputs?.[file] === createHash("sha256").update(readFileSync(join(dir,file))).digest("hex"));
    const fresh = delivery.through >= to && Number.isFinite(Date.parse(delivery.loaded_at)) && now.getTime() - Date.parse(delivery.loaded_at) <= 36*3600000 && Date.parse(delivery.loaded_at) <= now.getTime()+60000;
    const incomplete = delivery.missing_cost || delivery.undated_rows || delivery.retained_unseen_events || delivery.city_unknown || delivery.missing_customer_paid;
    out.push({source:"Наша доставка: Google Таблица",through:delivery.through ?? null,expected:to,status:!complete || !fresh ? "error" : incomplete ? "warning" : "ok",note:`Успешное чтение ${delivery.loaded_at}. Рейсов с 05.10: ${delivery.events}; без счёта: ${delivery.missing_cost}; без даты: ${delivery.undated_rows}; без оплаты клиента: ${delivery.missing_customer_paid}; без города: ${delivery.city_unknown}; сохранено исчезнувших строк: ${delivery.retained_unseen_events}. ${!complete ? "Выходные файлы не соответствуют успешной загрузке. " : ""}${!fresh ? "Нужна новая загрузка. " : ""}История по 04.10 сохранена. Дата чтения не гарантирует заполнение всех счетов перевозчика.`});
  } else {
    const through = maxDate(readRows(join(dir,"delivery_sku_daily.ndjson")),["d"]);
    out.push({source:"Наша доставка: ручная ведомость",through,expected:to,status:"warning",note:"Автоматическое чтение Google Таблицы ещё не подтверждено"});
  }
  const periods = json(join(dir, "ads_periods.json")), ids = new Set<string>();
  for (const p of ["p7", "p30", "p90"]) for (const k of ["top_spend", "burners"]) for (const c of periods[p]?.[k] ?? []) ids.add(String(c.id));
  const meta = { ...periods.p90?.camp_meta, ...periods.p30?.camp_meta, ...periods.p7?.camp_meta };
  const attr = new Set(readRows(join(dir, "ads_attr_daily.ndjson")).map(r => `${r.d}|${r.id}`));
  const daily = readRows(join(dir, "ads_daily.ndjson")).filter(r => r.d >= shiftDay(to,-6) && r.d <= to && r.sp > 0 && meta[String(r.id)]?.instr === "Оплата за клик");
  const sku = new Set(readRows(join(dir,"ads_sku_daily.ndjson")).map(r=>`${r.d}|${r.cid}`));
  const skuGaps = daily.filter(r=>!sku.has(`${r.d}|${r.id}`));
  if (skuGaps.length) out.push({source:"Полнота расхода CPC по SKU",through:null,expected:to,status:"error",note:`Нет SKU для ${skuGaps.length} пар кампания/день с расходом: ${skuGaps.slice(0,8).map(r=>`${r.id} (${r.d})`).join(", ")}. Загрузка не завершена`});
  const gaps = daily.filter(r => ids.has(String(r.id)) && !attr.has(`${r.d}|${r.id}`));
  if (gaps.length) out.push({ source: "Полнота атрибуции кампаний", through: null, expected: to, status: "error", note: `Нет строк для ${gaps.length} пар кампания/день: ${gaps.map(r => `${r.id} (${r.d})`).join(", ")}. Возможен fallback на расход SKU; атрибуция продаж не подтверждена` });
  out.push({ source: "Архив transaction/list", through: "2026-09-07", expected: "2026-09-07", status: "ok", note: "Историческая граница. Метод отключён, текущие деньги берутся из accrual/реализации" });
  return out;
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
export function healthHtml(dir: string, now = new Date()): string {
  const rows = sourceHealth(dir, now), bad = rows.filter(r => r.status !== "ok");
  return `<details class="source-health" style="margin:10px 16px;padding:10px;border:1px solid ${bad.length ? "#eab308" : "#3a7666"};border-radius:8px;font:13px/1.5 system-ui"><summary>Свежесть источников: ${bad.length ? `${bad.length} требуют внимания` : "проверенные источники актуальны"}</summary><table><thead><tr><th>Источник</th><th>Данные по</th><th>Состояние</th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r.source)}</td><td>${esc(r.through ?? "не подтверждено")}</td><td>${r.status === "ok" ? "✓" : "⚠"} ${esc(r.note)}</td></tr>`).join("")}</tbody></table></details>`;
}

if (process.argv[1] && /source-health\.ts$/.test(process.argv[1])) {
  const rows = sourceHealth(process.env.DATA_DIR || "data");
  for (const r of rows.filter(r => r.status !== "ok")) console.log(`::${r.status === "error" ? "error" : "warning"}::${r.source}: по ${r.through ?? "не подтверждено"}, ожидалось ${r.expected}. ${r.note}`);
  if (rows.some(r => r.status === "error")) process.exitCode = 1;
}
